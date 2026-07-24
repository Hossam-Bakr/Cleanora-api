import type { Server } from "node:http";

import { APPLICATION_NAME, loadEnvironment } from "#config/index";
import { PrismaLifecycle } from "#integrations/database/index";
import { createPinoLogging } from "#integrations/logging/index";

import { createApp } from "./app.js";

/**
 * @desc Close the HTTP listener without dropping active connections.
 * @access Internal process lifecycle
 * @explanation This function waits until Node finishes active connections or
 * returns an error to the shutdown coordinator.
 */
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
 * @desc Start the Cleanora API process.
 * @access Internal process entry
 * @explanation This function validates environment data, connects PostgreSQL,
 * creates the Express app, and installs graceful shutdown handling.
 */
async function start(): Promise<void> {
  const environment = loadEnvironment();
  const logging = createPinoLogging(environment.LOG_LEVEL, {
    application: APPLICATION_NAME,
    environment: environment.NODE_ENV
  });
  const { logger } = logging;
  const database = new PrismaLifecycle(environment.DATABASE_URL);

  await database.connect();

  const app = createApp({
    environment,
    logger,
    requestLogger: logging.requestLogger,
    databaseProbe: database.databaseProbe(),
    readinessProbes: [database.readinessProbe()]
  });
  const server = app.listen(environment.PORT, () => {
    logger.info("HTTP server listening", { port: environment.PORT });
  });

  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.info("Graceful shutdown started", { signal });

    let timeout: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        (async (): Promise<void> => {
          await closeServer(server);
          await database.disconnect();
        })(),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => {
            reject(new Error("Graceful shutdown timed out"));
          }, environment.SHUTDOWN_TIMEOUT_MS);
          timeout.unref();
        })
      ]);
      logger.info("Graceful shutdown completed");
    } catch (error: unknown) {
      server.closeAllConnections();
      await database.disconnect().catch(() => undefined);
      throw error;
    } finally {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    }
  };

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

void start().catch((error: unknown) => {
  const { logger } = createPinoLogging("error", {
    application: APPLICATION_NAME
  });
  logger.error("Application startup failed", {
    errorName: error instanceof Error ? error.name : "UnknownError"
  });
  process.exitCode = 1;
});
