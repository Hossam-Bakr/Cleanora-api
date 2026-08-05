import type { CorsOptions } from "cors";
import type { Express } from "express";

import { createErrorMiddleware } from "#middlewares/error.middleware";
import {
  createHttpLogger,
  type HttpLogStream,
} from "#middlewares/http-logger";
import { notFoundMiddleware } from "#middlewares/not-found.middleware";
import { requestIdMiddleware } from "#middlewares/request-id.middleware";
import type { RouteDependencies } from "#routes/index";
import { mountRoutes } from "#routes/index";
import { AppError } from "#shared/errors/app-error";

const cookieParser = require("cookie-parser") as typeof import("cookie-parser");
const cors = require("cors") as typeof import("cors");
const express = require("express") as typeof import("express");
const helmet = require("helmet").default as typeof import("helmet").default;

export interface CreateAppOptions {
  readonly httpLogStream?: HttpLogStream;
  /** Test-only routes mounted before the 404 handler. */
  readonly mountTestRoutes?: (app: Express) => void;
}

function createCorsOptions(
  environment: RouteDependencies["environment"],
): CorsOptions {
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

/** Create Express, mount middleware/routes, and return the app. */
export function createApp(
  routes: RouteDependencies,
  options: CreateAppOptions = {},
): Express {
  const app = express();

  // Request tracing and safe HTTP logs.
  app.disable("x-powered-by");
  app.use(requestIdMiddleware);
  app.use(
    createHttpLogger(routes.environment.NODE_ENV, options.httpLogStream),
  );

  // Security and request parsing.
  app.use(helmet());
  app.use(cors(createCorsOptions(routes.environment)));
  app.use(express.json({ limit: routes.environment.REQUEST_BODY_LIMIT }));
  app.use(cookieParser());

  // Public routes must be mounted before the terminal handlers.
  mountRoutes(app, routes);
  options.mountTestRoutes?.(app);
  app.use(notFoundMiddleware);
  app.use(createErrorMiddleware(routes.logger));

  return app;
}
