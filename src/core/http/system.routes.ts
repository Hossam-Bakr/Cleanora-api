import { Router } from "express";

import type { DatabaseProbe } from "#core/health/database-probe";
import type { ReadinessProbe } from "#core/health/readiness";
import type { Logger } from "#core/logging/logger";

import { createFailureResponse, sendSuccess } from "./api-response.js";

export interface SystemRouterDependencies {
  readonly databaseProbe?: DatabaseProbe;
  readonly logger: Logger;
  readonly readinessProbes: readonly ReadinessProbe[];
}

/**
 * @desc Create system health and readiness routes.
 * @route GET /api/v1/system/health/live
 * @route GET /api/v1/system/health/ready
 * @access Public
 * @explanation These endpoints show process and dependency health without
 * returning credentials, queries, or private infrastructure details.
 */
export function createSystemRouter(
  dependencies: SystemRouterDependencies
): Router {
  const router = Router();

  /**
   * @desc Check whether the Node.js process is alive.
   * @route GET /api/v1/system/health/live
   * @access Public
   * @explanation This route does not call external dependencies.
   */
  router.get("/health/live", (_request, response) => {
    sendSuccess(_request, response, 200, { status: "ok" });
  });

  /**
   * @desc Check whether required application dependencies are ready.
   * @route GET /api/v1/system/health/ready
   * @access Public
   * @explanation This route checks PostgreSQL and future readiness probes and
   * returns only safe dependency names when a check fails.
   */
  router.get("/health/ready", async (request, response) => {
    const results = await Promise.allSettled(
      dependencies.readinessProbes.map(async (probe) => {
        await probe.check();
        return probe.name;
      })
    );

    const failed = results.flatMap((result, index) =>
      result.status === "rejected"
        ? [dependencies.readinessProbes[index]?.name ?? "unknown"]
        : []
    );

    if (failed.length > 0) {
      dependencies.logger.warn("Readiness check failed", {
        requestId: request.requestId,
        failedProbes: failed
      });
      response.status(503).json(
        createFailureResponse(request, {
          code: "DEPENDENCY_NOT_READY",
          message: "One or more required services are unavailable",
          details: { failed }
        })
      );
      return;
    }

    sendSuccess(request, response, 200, { status: "ready" });
  });

  /**
   * @desc Check PostgreSQL connectivity without exposing database details.
   * @route GET /api/v1/system/health/database
   * @access Public
   * @explanation This route lets operators distinguish a database outage from
   * a process outage or another readiness-probe failure.
   */
  router.get("/health/database", async (request, response) => {
    try {
      if (dependencies.databaseProbe === undefined) {
        throw new Error("Database probe is not configured");
      }

      await dependencies.databaseProbe.check();
      sendSuccess(request, response, 200, { status: "up" });
    } catch {
      dependencies.logger.warn("Database health check failed", {
        requestId: request.requestId
      });
      response.status(503).json(
        createFailureResponse(request, {
          code: "DATABASE_UNAVAILABLE",
          message: "Database is unavailable",
          details: {}
        })
      );
    }
  });

  return router;
}
