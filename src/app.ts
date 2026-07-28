import type { Express, RequestHandler } from "express";
import type { CorsOptions } from "cors";

import { SYSTEM_ROUTE_SUFFIX, type AppEnvironment } from "#config/index";
import { AppError } from "#core/errors/app-error";


import {
  createErrorMiddleware,
  createSystemRouter,
  notFoundMiddleware,
  requestIdMiddleware,
} from "#core/http/index";


import type { DatabaseProbe } from "#core/health/database-probe";
import type { ReadinessProbe } from "#core/health/readiness";
import type { Logger } from "#core/logging/logger";
import type { RateLimiterPort } from "#core/security/rate-limit.port";
import { createRateLimitMiddleware } from "#core/security/rate-limit.middleware";
import { MemoryRateLimiterAdapter } from "#integrations/security/memory-rate-limiter.adapter";
import { createSwaggerRouter } from "./swagger/index.js";

import {
  foundationModuleRegistrars,
  registerModules,
  type ModuleRegistrar,
} from "#routes/index";

const cookieParser = require("cookie-parser") as typeof import("cookie-parser");
const cors = require("cors") as typeof import("cors");
const express = require("express") as typeof import("express");
const helmet = require("helmet").default as typeof import("helmet").default;

export interface CreateAppDependencies {
  readonly environment: AppEnvironment;
  readonly logger: Logger;
  readonly requestLogger?: RequestHandler;
  readonly rateLimiter?: RateLimiterPort;
  readonly databaseProbe?: DatabaseProbe;
  readonly readinessProbes?: readonly ReadinessProbe[];
  /**
   * Register only endpoints that must read raw bytes (for example signed webhooks).
   * Each registrar must attach its own narrow raw-body parser.
   */
  readonly rawBodyRegistrars?: readonly ModuleRegistrar[];
  readonly modules?: readonly ModuleRegistrar[];
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
 * @desc Create the configured Cleanora Express application.
 * @access Internal composition root
 * @explanation This function assembles safe middleware, system routes, and
 * approved business modules without starting a network listener.
 */
export function createApp(dependencies: CreateAppDependencies): Express {
  // Create the Express application using the requested CommonJS runtime style.
  const app = express();
  app.disable("x-powered-by");

  // Add request tracing before logging so every log line has the same ID.
  app.use(requestIdMiddleware);
  if (dependencies.requestLogger !== undefined) {
    app.use(dependencies.requestLogger);
  }

  // Add secure HTTP headers and an allowlisted credential-aware CORS policy.
  app.use(helmet());
  app.use(cors(createCorsOptions(dependencies.environment)));

  // Expose read-only interactive and machine-readable API documentation.
  app.use(
    `${dependencies.environment.API_PREFIX}/docs`,
    createSwaggerRouter(dependencies.environment.API_PREFIX),
  );

  // Register signed webhook parsers before the global JSON parser.
  registerModules(app, dependencies.rawBodyRegistrars ?? []);




  // Parse normal API bodies and cookies after raw webhook routes.
  app.use(express.json({ limit: dependencies.environment.REQUEST_BODY_LIMIT }));
  app.use(cookieParser());



  // Mount public system endpoints under the configured API version.
  app.use(
    `${dependencies.environment.API_PREFIX}${SYSTEM_ROUTE_SUFFIX}/health/ready`,
    createRateLimitMiddleware({
      limiter: dependencies.rateLimiter ?? new MemoryRateLimiterAdapter(),
      scope: "system-health-ready",
      limit: 120,
      windowSeconds: 60,
      subject: (requestIp) => requestIp ?? "unknown",
    }),
  );



  app.use(
    `${dependencies.environment.API_PREFIX}${SYSTEM_ROUTE_SUFFIX}`,
    createSystemRouter({
      logger: dependencies.logger,
      ...(dependencies.databaseProbe === undefined
        ? {}
        : { databaseProbe: dependencies.databaseProbe }),
      readinessProbes: dependencies.readinessProbes ?? [],
    }),
  );




  // Register only business modules approved by the active phase.
  registerModules(app, [
    ...foundationModuleRegistrars,
    ...(dependencies.modules ?? []),
  ]);

  // Finish the pipeline with standard not-found and error responses.
  app.use(notFoundMiddleware);
  app.use(createErrorMiddleware(dependencies.logger));

  return app;
}
