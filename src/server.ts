import type { Server } from "node:http";

import {
  APPLICATION_NAME,
  loadEnvironment,
  mapEnvironmentDiagnostics,
  type AppEnvironment
} from "#config/index";
import type { DatabaseProbe } from "#core/health/database-probe";
import type { ReadinessProbe } from "#core/health/readiness";
import type { Logger } from "#core/logging/logger";
import type { PrismaClient } from "#generated/prisma/client";
import {
  bindPrismaClient,
  PrismaLifecycle
} from "#integrations/database/index";
import {
  createPinoLogging,
  type PinoLogging
} from "#integrations/logging/index";

import { createApp } from "./app.js";

interface DatabaseLifecycle {
  readonly client: PrismaClient;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  databaseProbe(): DatabaseProbe;
  readinessProbe(): ReadinessProbe;
}

export interface StartApplicationDependencies {
  readonly environmentInput?: NodeJS.ProcessEnv;
  readonly createDatabase?: (connectionString: string) => DatabaseLifecycle;
  readonly createLogging?: (
    level: AppEnvironment["LOG_LEVEL"],
    baseContext: Readonly<Record<string, unknown>>
  ) => PinoLogging;
  readonly createApplication?: typeof createApp;
  readonly installSignalHandlers?: boolean;
}

export interface StartedApplication {
  readonly server: Server;
  readonly shutdown: (signal: NodeJS.Signals) => Promise<void>;
}

/** Close the HTTP listener without dropping active connections. */
async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error !== undefined) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

/**
 * Coordinate one graceful shutdown attempt. Repeated signals share the same
 * promise, and the process-wide database lifecycle is disconnected once.
 */
export function createGracefulShutdown(
  server: Server,
  database: Pick<DatabaseLifecycle, "disconnect">,
  logger: Logger,
  timeoutMilliseconds: number
): (signal: NodeJS.Signals) => Promise<void> {
  let shutdownPromise: Promise<void> | undefined;

  return (signal: NodeJS.Signals): Promise<void> => {
    shutdownPromise ??= (async (): Promise<void> => {
      logger.info("Graceful shutdown started", { signal });

      let timeout: NodeJS.Timeout | undefined;
      const closeResources = (async (): Promise<void> => {
        try {
          await closeServer(server);
        } finally {
          await database.disconnect();
        }
      })();

      try {
        await Promise.race([
          closeResources,
          new Promise<never>((_resolve, reject) => {
            timeout = setTimeout(() => {
              reject(new Error("Graceful shutdown timed out"));
            }, timeoutMilliseconds);
            timeout.unref();
          })
        ]);
        logger.info("Graceful shutdown completed");
      } catch (error: unknown) {
        server.closeAllConnections();
        throw error;
      } finally {
        if (timeout !== undefined) {
          clearTimeout(timeout);
        }
      }
    })();

    return shutdownPromise;
  };
}

/**
 * @desc Start the Cleanora API process from one explicit composition root.
 * @access Internal process entry
 * @explanation Environment validation completes before database creation or
 * listening. One connected Prisma lifecycle is bound before module
 * registration and is reused by health probes, repositories, and shutdown.
 */
export async function startApplication(
  dependencies: StartApplicationDependencies = {}
): Promise<StartedApplication> {
  const environment = loadEnvironment(
    dependencies.environmentInput ?? process.env
  );
  const loggingFactory = dependencies.createLogging ?? createPinoLogging;
  const logging = loggingFactory(environment.LOG_LEVEL, {
    application: APPLICATION_NAME,
    environment: environment.NODE_ENV
  });
  const { logger } = logging;
  const database =
    dependencies.createDatabase?.(environment.DATABASE_URL) ??
    new PrismaLifecycle(environment.DATABASE_URL);

  await database.connect();

  try {
    bindPrismaClient(database.client);
    const applicationFactory = dependencies.createApplication ?? createApp;
    const app = applicationFactory({
      environment,
      logger,
      requestLogger: logging.requestLogger,
      databaseProbe: database.databaseProbe(),
      readinessProbes: [database.readinessProbe()]
    });
    const server = app.listen(environment.PORT, () => {
      logger.info("HTTP server listening", { port: environment.PORT });
    });
    const shutdown = createGracefulShutdown(
      server,
      database,
      logger,
      environment.SHUTDOWN_TIMEOUT_MS
    );

    if (dependencies.installSignalHandlers !== false) {
      for (const signal of ["SIGINT", "SIGTERM"] as const) {
        process.once(signal, () => {
          void shutdown(signal).catch((error: unknown) => {
            logger.error("Graceful shutdown failed", {
              errorName: error instanceof Error ? error.name : "UnknownError"
            });
            process.exitCode = 1;
          });
        });
      }
    }

    return { server, shutdown };
  } catch (error: unknown) {
    await database.disconnect().catch(() => undefined);
    throw error;
  }
}

/** Create a structured, value-free startup failure context for the logger. */
export function createStartupFailureContext(
  error: unknown
): Readonly<Record<string, unknown>> {
  const diagnostics = mapEnvironmentDiagnostics(error);

  return {
    errorName: error instanceof Error ? error.name : "UnknownError",
    ...(diagnostics.length === 0
      ? {}
      : { environmentDiagnostics: diagnostics })
  };
}

if (require.main === module) {
  void startApplication().catch((error: unknown) => {
    const { logger } = createPinoLogging("error", {
      application: APPLICATION_NAME
    });
    logger.error("Application startup failed", createStartupFailureContext(error));
    process.exitCode = 1;
  });
}
