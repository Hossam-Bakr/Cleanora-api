import { createServer, type Server } from "node:http";

import { APPLICATION_NAME } from "#config/constants";
import {
  loadEnvironment,
  mapEnvironmentDiagnostics,
  type AppEnvironment,
} from "#config/env";
import type {
  DatabaseProbe,
  ReadinessProbe,
} from "#database/prisma-lifecycle";
import { bindPrismaClient } from "#database/prisma";
import { PrismaLifecycle } from "#database/prisma-lifecycle";
import type { PrismaClient } from "#generated/prisma/client";
import {
  createApplicationLogger,
  type Logger,
} from "#shared/logger";

import { createApp } from "./app.js";

import { Argon2PasswordHasherAdapter } from "./integrations/authentication/argon2-password-hasher.adapter.js";
import { CryptoVerifierAdapter } from "./integrations/authentication/crypto-verifier.adapter.js";
import { JwtTokenServiceAdapter } from "./integrations/authentication/jwt-token-service.adapter.js";
import {
  createAuthenticationModule,
  createAuthenticationPolicy,
} from "./modules/authentication/auth.module.js";
import { MemoryRateLimiterAdapter } from "./integrations/security/memory-rate-limiter.adapter.js";
import { OpenIdClientGoogleAdapter } from "./integrations/google/openid-client-google.adapter.js";
import { MemoryGoogleTransactionStoreAdapter } from "./integrations/authentication/memory-google-transaction-store.adapter.js";
import { AuthenticationEmailAdapter } from "./integrations/email/authentication-email.adapter.js";
import {
  createNodemailerEmailAdapter,
} from "./integrations/email/nodemailer.adapter.js";
import { UnavailableEmailAdapter } from "./integrations/email/unavailable-email.adapter.js";

interface DatabaseLifecycle {
  readonly client: PrismaClient;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  databaseProbe(): DatabaseProbe;
  readinessProbe(): ReadinessProbe;
}

interface HttpServer {
  listen(
    port: number,
    hostname: string,
    callback: () => void,
  ): Server;
}

export const HTTP_BIND_HOST = "0.0.0.0";

export interface StartApplicationDependencies {
  readonly environmentInput?: NodeJS.ProcessEnv;
  readonly createDatabase?: (connectionString: string) => DatabaseLifecycle;
  readonly createLogger?: (
    level: AppEnvironment["LOG_LEVEL"],
    baseContext: Readonly<Record<string, unknown>>,
  ) => Logger;
  readonly createApplication?: typeof createApp;
  readonly createHttpServer?: typeof createServer;
  readonly installSignalHandlers?: boolean;
}

export interface StartedApplication {
  readonly server: Server;
  readonly shutdown: (signal: NodeJS.Signals) => Promise<void>;
}

/**
 * Bind the HTTP server to every container network interface.
 *
 * Railway and other container platforms route traffic through an external
 * proxy, so binding only to localhost makes an otherwise healthy process
 * unreachable. The port remains environment-owned.
 */
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

/**
 * @desc Start the Cleanora API process from one explicit composition root.
 * @access Internal process entry
 * @explanation Environment validation completes before database creation or
 * listening. One connected Prisma lifecycle is bound before module
 * registration and is reused by health probes, repositories, and shutdown.
 */
export async function startApplication(
  dependencies: StartApplicationDependencies = {},
): Promise<StartedApplication> {
  const environment = loadEnvironment(
    dependencies.environmentInput ?? process.env,
  );
  const loggerFactory = dependencies.createLogger ?? createApplicationLogger;
  const logger = loggerFactory(environment.LOG_LEVEL, {
    application: APPLICATION_NAME,
    environment: environment.NODE_ENV,
  });
  const database =
    dependencies.createDatabase?.(environment.DATABASE_URL) ??
    new PrismaLifecycle(environment.DATABASE_URL);

  await database.connect();

  try {
    bindPrismaClient(database.client);
    const applicationFactory = dependencies.createApplication ?? createApp;
    const rateLimiter = new MemoryRateLimiterAdapter();
    const emailPort = environment.AUTH_ENABLED && environment.EMAIL_AUTH_ENABLED
      ? createNodemailerEmailAdapter({
          host: environment.SMTP_HOST!,
          port: environment.SMTP_PORT!,
          secure: environment.SMTP_SECURE!,
          requireTls: environment.SMTP_REQUIRE_TLS!,
          user: environment.SMTP_USER!,
          password: environment.SMTP_PASSWORD!,
          fromName: environment.SMTP_FROM_NAME!,
          fromEmail: environment.SMTP_FROM_EMAIL!,
          connectionTimeoutMilliseconds: environment.SMTP_CONNECTION_TIMEOUT_MS!,
          socketTimeoutMilliseconds: environment.SMTP_SOCKET_TIMEOUT_MS!,
        })
      : new UnavailableEmailAdapter();
    const authentication = environment.AUTH_ENABLED
      ? createAuthenticationModule({
          trustedOrigins: environment.CORS_ORIGINS,
          cookie: {
            name: environment.AUTH_REFRESH_COOKIE_NAME,
            path: environment.AUTH_REFRESH_COOKIE_PATH,
            secure: environment.AUTH_COOKIE_SECURE,
            sameSite: environment.AUTH_COOKIE_SAME_SITE,
          },
          passwordHasher: new Argon2PasswordHasherAdapter(),
          tokens: new JwtTokenServiceAdapter({
            accessSecret: environment.JWT_ACCESS_SECRET!,
            refreshSecret: environment.JWT_REFRESH_SECRET!,
            issuer: environment.JWT_ISSUER,
            audience: environment.JWT_AUDIENCE,
            accessTtlSeconds: environment.JWT_ACCESS_TTL_SECONDS,
          }),
          verifier: new CryptoVerifierAdapter(
            environment.AUTH_VERIFIER_SECRET!,
          ),
          privacyHashSecret: environment.AUTH_PRIVACY_HASH_SECRET!,
          policy: createAuthenticationPolicy(),
          email: new AuthenticationEmailAdapter(emailPort),
          accessTtlSeconds: environment.JWT_ACCESS_TTL_SECONDS,
          refreshTtlSeconds: environment.JWT_REFRESH_TTL_SECONDS,
          rateLimiter,
          ...(environment.GOOGLE_AUTH_ENABLED
            ? {
                googleIdentity: new OpenIdClientGoogleAdapter(
                  environment.GOOGLE_CLIENT_ID!,
                  environment.GOOGLE_CLIENT_SECRET!,
                  environment.GOOGLE_REDIRECT_URI!,
                ),
                googleTransactions: new MemoryGoogleTransactionStoreAdapter(),
                googleProviderCallbackUri:
                  environment.GOOGLE_REDIRECT_URI!,
                googleFrontendCallbackUri:
                  environment.GOOGLE_FRONTEND_CALLBACK_URI!,
              }
            : {}),
        })
      : undefined;
    const app = applicationFactory({
      environment,
      logger,
      databaseProbe: database.databaseProbe(),
      readinessProbes: [database.readinessProbe()],
      rateLimiter,
      ...(authentication === undefined
        ? {}
        : { authenticationRouter: authentication.router }),
    });
    const httpServerFactory =
      dependencies.createHttpServer ?? createServer;
    const httpServer = httpServerFactory(app);
    const server = listenForHttp(httpServer, environment.PORT, () => {
      logger.info("HTTP server listening", {
        host: HTTP_BIND_HOST,
        port: environment.PORT,
      });
    });
    const shutdown = createGracefulShutdown(
      server,
      database,
      logger,
      environment.SHUTDOWN_TIMEOUT_MS,
    );

    if (dependencies.installSignalHandlers !== false) {
      for (const signal of ["SIGINT", "SIGTERM"] as const) {
        process.once(signal, () => {
          void shutdown(signal).catch((error: unknown) => {
            logger.error("Graceful shutdown failed", {
              errorName: error instanceof Error ? error.name : "UnknownError",
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
  error: unknown,
): Readonly<Record<string, unknown>> {
  const diagnostics = mapEnvironmentDiagnostics(error);
  const errorCode =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[A-Z][A-Z0-9_]{1,31}$/u.test(error.code)
      ? error.code
      : undefined;

  return {
    errorName: error instanceof Error ? error.name : "UnknownError",
    ...(errorCode === undefined ? {} : { errorCode }),
    ...(diagnostics.length === 0
      ? {}
      : { environmentDiagnostics: diagnostics }),
  };
}

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
