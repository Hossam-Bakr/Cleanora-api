import type { CorsOptions } from "cors";
import type { Express } from "express";

import type { AppEnvironment } from "#config/env";
import type {
  DatabaseProbe,
  ReadinessProbe,
} from "#database/prisma-lifecycle";
import { MemoryRateLimiterAdapter } from "#integrations/security/memory-rate-limiter.adapter";
import { createErrorMiddleware } from "#middlewares/error.middleware";
import {
  createHttpLogger,
  type HttpLogStream,
} from "#middlewares/http-logger";
import { notFoundMiddleware } from "#middlewares/not-found.middleware";
import type { RateLimiterPort } from "#middlewares/rate-limit.types";
import { requestIdMiddleware } from "#middlewares/request-id.middleware";
import { AppError } from "#shared/errors/app-error";
import type { Logger } from "#shared/logger";

import { mountRoutes } from "./routes/index.js";

const cookieParser = require("cookie-parser") as typeof import("cookie-parser");
const cors = require("cors") as typeof import("cors");
const express = require("express") as typeof import("express");
const helmet = require("helmet").default as typeof import("helmet").default;

export interface CreateAppDependencies {
  readonly environment: AppEnvironment;
  readonly logger: Logger;
  readonly rateLimiter?: RateLimiterPort;
  readonly databaseProbe?: DatabaseProbe;
  readonly readinessProbes?: readonly ReadinessProbe[];
  readonly authenticationRouter?: import("express").Router;
  readonly httpLogStream?: HttpLogStream;
  /** Test-only hook for focused integration routes before the 404 handler. */
  readonly mountTestRoutes?: (app: Express) => void;
}

function createCorsOptions(environment: AppEnvironment): CorsOptions {
  return {
    credentials: true,
    exposedHeaders: ["x-request-id"],
    maxAge: 600,
    origin(origin, callback) {
      if (origin === undefined || environment.CORS_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(
        new AppError({
          code: "CORS_ORIGIN_NOT_ALLOWED",
          message: "The request origin is not allowed",
          statusCode: 403,
          expose: true,
        }),
      );
    },
  };
}

/**
 * Create the configured Express app without opening a network port.
 */
export function createApp(dependencies: CreateAppDependencies): Express {
  const app = express();
  app.disable("x-powered-by");

  app.use(requestIdMiddleware);
  app.use(
    createHttpLogger(
      dependencies.environment.NODE_ENV,
      dependencies.httpLogStream,
    ),
  );
  app.use(helmet());
  app.use(cors(createCorsOptions(dependencies.environment)));
  app.use(express.json({ limit: dependencies.environment.REQUEST_BODY_LIMIT }));
  app.use(cookieParser());

  mountRoutes(app, {
    environment: dependencies.environment,
    logger: dependencies.logger,
    rateLimiter:
      dependencies.rateLimiter ?? new MemoryRateLimiterAdapter(),
    ...(dependencies.databaseProbe === undefined
      ? {}
      : { databaseProbe: dependencies.databaseProbe }),
    readinessProbes: dependencies.readinessProbes ?? [],
    ...(dependencies.authenticationRouter === undefined
      ? {}
      : { authenticationRouter: dependencies.authenticationRouter }),
  });

  dependencies.mountTestRoutes?.(app);

  app.use(notFoundMiddleware);
  app.use(createErrorMiddleware(dependencies.logger));

  return app;
}
