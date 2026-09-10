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
  /** R1-P07 Provider-owned Worker/Team management routes. */
  readonly providerWorkforceRouter?: Router;
  /** R1-P07 trusted-current-identity Worker self-service routes. */
  readonly providerWorkerSelfRouter?: Router;
  /** R1-P07 Worker invitation inspect/onboarding/accept routes. */
  readonly providerWorkforceInvitationRouter?: Router;
  /** R1-P09 Provider Service management routes. */
  readonly providerServiceRouter?: Router;
  /** R1-P09 Staff Provider Service price-approval routes. */
  readonly staffProviderServiceRouter?: Router;
  /** R1-P08 protected staff Catalog management routes. */
  readonly staffCatalogRouter?: Router;
  /** R1-P10 protected staff Configuration locality/time-zone routes. */
  readonly staffConfigurationLocalityRouter?: Router;
  /** R1-P10 protected Provider availability coverage routes. */
  readonly providerAvailabilityRouter?: Router;
  /** R1-P12 guest-capable marketplace Browse routes. */
  readonly bookingsBrowseRouter?: Router;
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

  if (dependencies.providerWorkforceRouter !== undefined) {
    app.use(`${apiPrefix}/providers`, dependencies.providerWorkforceRouter);
  }

  if (dependencies.providerServiceRouter !== undefined) {
    app.use(`${apiPrefix}/providers`, dependencies.providerServiceRouter);
  }

  if (dependencies.providerWorkerSelfRouter !== undefined) {
    app.use(`${apiPrefix}/workers`, dependencies.providerWorkerSelfRouter);
  }

  if (dependencies.providerWorkforceInvitationRouter !== undefined) {
    app.use(`${apiPrefix}/worker-invitations`, dependencies.providerWorkforceInvitationRouter);
  }

  if (dependencies.providerAdminInvitationRouter !== undefined) {
    app.use(
      `${apiPrefix}/provider-admin-invitations`,
      dependencies.providerAdminInvitationRouter,
    );
  }

  if (dependencies.staffProviderServiceRouter !== undefined) {
    app.use(
      `${apiPrefix}/staff/providers`,
      dependencies.staffProviderServiceRouter,
    );
  }

  if (dependencies.staffProvidersRouter !== undefined) {
    app.use(`${apiPrefix}/staff/providers`, dependencies.staffProvidersRouter);
  }

  if (dependencies.staffCatalogRouter !== undefined) {
    app.use(`${apiPrefix}/staff/catalog`, dependencies.staffCatalogRouter);
  }

  if (dependencies.staffConfigurationLocalityRouter !== undefined) {
    app.use(
      `${apiPrefix}/staff/configuration`,
      dependencies.staffConfigurationLocalityRouter,
    );
  }

  if (dependencies.providerAvailabilityRouter !== undefined) {
    app.use(`${apiPrefix}/providers`, dependencies.providerAvailabilityRouter);
  }

  if (dependencies.bookingsBrowseRouter !== undefined) {
    app.use(`${apiPrefix}/browse`, dependencies.bookingsBrowseRouter);
  }
}
