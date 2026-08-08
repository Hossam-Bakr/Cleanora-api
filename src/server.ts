import { createServer, type Server } from "node:http";

import { APPLICATION_NAME } from "#config/constants";
import {
  createStartupFailureContext,
  loadEnvironment,
} from "#config/env";
import { bindPrismaClient } from "#database/prisma";
import { createApplicationLogger } from "#shared/logger";

import { createApp } from "./app.js";
import { createRuntimeDependencies } from "./composition.js";
import {
  createGracefulShutdown,
  HTTP_BIND_HOST,
  listenForHttp,
} from "./server-lifecycle.js";

export interface StartedApplication {
  readonly server: Server;
  readonly shutdown: (signal: NodeJS.Signals) => Promise<void>;
}

/** Start the Cleanora HTTP server. */
export async function startApplication(): Promise<StartedApplication> {
  // 1. Read and validate environment variables.
  const environment = loadEnvironment(process.env);

  // 2. Create the database, logger, adapters, and routes.
  const runtime = createRuntimeDependencies(environment);

  // 3. Connect one Prisma client before accepting requests.
  await runtime.database.connect();

  try {
    bindPrismaClient(runtime.database.client);

    // 4. Create Express and mount all public routes.
    const app = createApp(runtime.routes);
    const httpServer = createServer(app);

    // 5. Start listening on the configured port.
    const server = listenForHttp(httpServer, environment.PORT, () => {
      runtime.logger.info("HTTP server listening", {
        host: HTTP_BIND_HOST,
        port: environment.PORT,
      });
    });
    const stopCustomersBackgroundTasks = runtime.startCustomersBackgroundTasks?.();

    // 6. Close HTTP and database connections on Ctrl+C or deployment stop.
    const closeRuntime = createGracefulShutdown(
      server,
      runtime.database,
      runtime.logger,
      environment.SHUTDOWN_TIMEOUT_MS,
    );
    const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
      stopCustomersBackgroundTasks?.();
      await closeRuntime(signal);
    };
    const logShutdownError = (error: unknown): void => {
      runtime.logger.error("Graceful shutdown failed", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      process.exitCode = 1;
    };

    process.once("SIGINT", () => {
      void shutdown("SIGINT").catch(logShutdownError);
    });
    process.once("SIGTERM", () => {
      void shutdown("SIGTERM").catch(logShutdownError);
    });

    return { server, shutdown };
  } catch (error: unknown) {
    // Startup failed after connecting, so release the database first.
    try {
      await runtime.database.disconnect();
    } catch {
      // Keep the original startup error as the useful failure.
    }
    throw error;
  }
}

// Run automatically only when this file is the process entry point.
if (require.main === module) {
  void startApplication().catch((error: unknown) => {
    const logger = createApplicationLogger("error", {
      application: APPLICATION_NAME,
    });
    logger.error(
      "Application startup failed",
      createStartupFailureContext(error),
    );
    process.exitCode = 1;
  });
}
