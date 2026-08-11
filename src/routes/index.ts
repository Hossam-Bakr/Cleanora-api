import type { Express, Router } from "express";

import { SYSTEM_ROUTE_SUFFIX } from "#config/constants";
import type { AppEnvironment } from "#config/env";
import type {
  DatabaseProbe,
  ReadinessProbe,
} from "#database/prisma-lifecycle";
import type { RateLimiterPort } from "#middlewares/rate-limit.types";
import type { Logger } from "#shared/logger";

import { createSwaggerRouter } from "../swagger/swagger.router.js";
import { createSystemRouter } from "./system.routes.js";

export interface RouteDependencies {
  readonly environment: AppEnvironment;
  readonly logger: Logger;
  readonly rateLimiter: RateLimiterPort;
  readonly databaseProbe?: DatabaseProbe;
  readonly readinessProbes?: readonly ReadinessProbe[];
  readonly authenticationRouter?: Router;
  readonly ownerInternalRouter?: Router;
  /** Present only once completed customer story handlers are composed. */
  readonly customersRouter?: Router;
  /** Provider applicant and member routes. */
  readonly providersRouter?: Router;
  /** Staff Admin Provider review and lifecycle routes owned by providers. */
  readonly staffProvidersRouter?: Router;
  /** Body-token Provider Admin invitation onboarding routes. */
  readonly providerAdminInvitationRouter?: Router;
}

/**
 * Mount every public API group in one visible route map.
 *
 * Open this file first to discover the HTTP surface of the application.
 */
export function mountRoutes(
  app: Express,
  dependencies: RouteDependencies,
): void {
  const apiPrefix = dependencies.environment.API_PREFIX;

  app.use(`${apiPrefix}/docs`, createSwaggerRouter(apiPrefix));

  app.use(
    `${apiPrefix}${SYSTEM_ROUTE_SUFFIX}`,
    createSystemRouter({
      logger: dependencies.logger,
      rateLimiter: dependencies.rateLimiter,
      ...(dependencies.databaseProbe === undefined
        ? {}
        : { databaseProbe: dependencies.databaseProbe }),
      readinessProbes: dependencies.readinessProbes ?? [],
    }),
  );

  if (dependencies.authenticationRouter !== undefined) {
    app.use(`${apiPrefix}/auth`, dependencies.authenticationRouter);
  }

  if (dependencies.ownerInternalRouter !== undefined) {
    app.use(`${apiPrefix}/internal/owner`, dependencies.ownerInternalRouter);
  }

  if (dependencies.customersRouter !== undefined) {
    app.use(`${apiPrefix}/customers`, dependencies.customersRouter);
  }

  if (dependencies.providersRouter !== undefined) {
    app.use(`${apiPrefix}/providers`, dependencies.providersRouter);
  }

  if (dependencies.providerAdminInvitationRouter !== undefined) {
    app.use(
      `${apiPrefix}/provider-admin-invitations`,
      dependencies.providerAdminInvitationRouter,
    );
  }

  if (dependencies.staffProvidersRouter !== undefined) {
    app.use(`${apiPrefix}/staff/providers`, dependencies.staffProvidersRouter);
  }
}
