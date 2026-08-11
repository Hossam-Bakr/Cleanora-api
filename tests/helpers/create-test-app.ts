import type { Router } from "express";

import {
  createApp,
  type CreateAppOptions,
} from "../../src/app.js";
import type {
  DatabaseProbe,
  ReadinessProbe,
} from "../../src/database/prisma-lifecycle.js";
import { MemoryRateLimiterAdapter } from "../../src/integrations/security/memory-rate-limiter.adapter.js";
import type { RateLimiterPort } from "../../src/middlewares/rate-limit.types.js";
import type { Logger } from "../../src/shared/logger.js";
import type { AppEnvironment } from "../../src/config/env.js";

interface CreateTestAppDependencies extends CreateAppOptions {
  readonly environment: AppEnvironment;
  readonly logger: Logger;
  readonly rateLimiter?: RateLimiterPort;
  readonly databaseProbe?: DatabaseProbe;
  readonly readinessProbes?: readonly ReadinessProbe[];
  readonly authenticationRouter?: Router;
  readonly providersRouter?: Router;
  readonly staffProvidersRouter?: Router;
  readonly providerAdminInvitationRouter?: Router;
}

/** Compose the real public routes for focused app and integration tests. */
export function createTestApp(
  dependencies: CreateTestAppDependencies,
): ReturnType<typeof createApp> {
  const {
    environment,
    logger,
    rateLimiter = new MemoryRateLimiterAdapter(),
    databaseProbe,
    readinessProbes = [],
    authenticationRouter,
    providersRouter,
    staffProvidersRouter,
    providerAdminInvitationRouter,
    httpLogStream,
    mountTestRoutes,
  } = dependencies;

  return createApp(
    {
      environment,
      logger,
      rateLimiter,
      ...(databaseProbe === undefined ? {} : { databaseProbe }),
      readinessProbes,
      ...(authenticationRouter === undefined
        ? {}
        : { authenticationRouter }),
      ...(providersRouter === undefined ? {} : { providersRouter }),
      ...(staffProvidersRouter === undefined
        ? {}
        : { staffProvidersRouter }),
      ...(providerAdminInvitationRouter === undefined
        ? {}
        : { providerAdminInvitationRouter }),
    },
    {
      ...(httpLogStream === undefined ? {} : { httpLogStream }),
      ...(mountTestRoutes === undefined ? {} : { mountTestRoutes }),
    },
  );
}
