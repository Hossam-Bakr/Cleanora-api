import type { Server } from "node:http";

import type { Logger } from "#shared/logger";

interface HttpServer {
  listen(
    port: number,
    hostname: string,
    callback: () => void,
  ): Server;
}

export const HTTP_BIND_HOST = "0.0.0.0";

/** Bind the HTTP listener to every container network interface. */
export function listenForHttp(
  server: HttpServer,
  port: number,
  onListening: () => void,
): Server {
  return server.listen(port, HTTP_BIND_HOST, onListening);
}

function rejectAfter(
  timeoutMilliseconds: number,
  setTimer: (timer: NodeJS.Timeout) => void,
): Promise<never> {
  return new Promise<never>((_resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Graceful shutdown timed out"));
    }, timeoutMilliseconds);
    timer.unref();
    setTimer(timer);
  });
}

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

/** Create one idempotent graceful-shutdown operation. */
export function createGracefulShutdown(
  server: Server,
  database: { disconnect(): Promise<void> },
  logger: Logger,
  timeoutMilliseconds: number,
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
          rejectAfter(timeoutMilliseconds, (timer) => {
            timeout = timer;
          }),
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
