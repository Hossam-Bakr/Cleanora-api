/**
 * Thin HTTP adapters for Provider availability management (R1-P10).
 */

import type { NextFunction, Request, Response } from "express";

import type { AuthenticationPrincipal } from "#modules/authentication/authentication.public";
import { AppError } from "#shared/errors/app-error";
import { sendSuccess } from "#shared/http/api-response";

import {
  ProviderAvailabilityError,
  rethrowProviderAvailabilityAsAppError,
} from "./domain/provider-availability.errors.js";
import type { ProviderAvailabilityService } from "./provider-availability.service.js";
import type { ProviderWorkerAvailabilityService } from "./provider-worker-availability.service.js";
import {
  providerWorkerCalendarParamsSchema,
  providerIdParamsSchema,
  replaceProviderCapacityBodySchema,
  replaceProviderCalendarBodySchema,
  replaceCoverageBodySchema,
  replaceWorkerCalendarBodySchema,
  resumeProviderPauseBodySchema,
  startProviderPauseBodySchema,
} from "./provider-availability.schema.js";
import type { ProviderCapacityService } from "./provider-capacity.service.js";

function principal(response: Response): AuthenticationPrincipal {
  const value = response.locals["authenticationPrincipal"] as
    | AuthenticationPrincipal
    | undefined;
  if (value === undefined) {
    throw new AppError({
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication is required",
      statusCode: 401,
      expose: true,
    });
  }
  return value;
}

function forward(error: unknown, next: NextFunction): void {
  if (error instanceof ProviderAvailabilityError) {
    try {
      rethrowProviderAvailabilityAsAppError(error);
    } catch (mapped) {
      next(mapped);
      return;
    }
  }
  next(error);
}

function commandMeta(
  actor: AuthenticationPrincipal,
  request: Request,
): { readonly actorUserId: string; readonly requestId?: string } {
  return {
    actorUserId: actor.userId,
    ...(typeof request.requestId === "string"
      ? { requestId: request.requestId }
      : {}),
  };
}

export function createProviderAvailabilityController(
  service: ProviderAvailabilityService,
  workerAvailabilityService: ProviderWorkerAvailabilityService,
  capacityService: ProviderCapacityService,
): {
  readonly getCoverage: (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => Promise<void>;
  readonly replaceCoverage: (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => Promise<void>;
  readonly getCalendar: (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => Promise<void>;
  readonly replaceCalendar: (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => Promise<void>;
  readonly getWorkerCalendar: (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => Promise<void>;
  readonly replaceWorkerCalendar: (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => Promise<void>;
  readonly getCapacity: (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => Promise<void>;
  readonly replaceCapacity: (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => Promise<void>;
  readonly getPause: (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => Promise<void>;
  readonly startPause: (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => Promise<void>;
  readonly resumePause: (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => Promise<void>;
} {
  return {
    /**
     * @desc Read current textual coverage for one exact approved Provider.
     * @route GET /api/v1/providers/:providerId/availability/coverage
     * @access Protected Provider OWNER/ADMIN
     */
    async getCoverage(request, response, next): Promise<void> {
      try {
        const actor = principal(response);
        const params = providerIdParamsSchema.parse(request.params);
        const coverage = await service.getCoverage(
          { actorUserId: actor.userId },
          params.providerId,
        );
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 200, coverage);
      } catch (error) {
        forward(error, next);
      }
    },

    /**
     * @desc Full-replace textual coverage at an exact expected version.
     * @route PUT /api/v1/providers/:providerId/availability/coverage
     * @access Protected Provider OWNER/ADMIN
     */
    async replaceCoverage(request, response, next): Promise<void> {
      try {
        const actor = principal(response);
        const params = providerIdParamsSchema.parse(request.params);
        const body = replaceCoverageBodySchema.parse(request.body);
        const result = await service.replaceCoverage(
          commandMeta(actor, request),
          params.providerId,
          {
            selections: body.selections,
            expectedVersion: body.expectedVersion,
            idempotencyKey: body.idempotencyKey,
            ...(body.reasonCode === undefined ? {} : { reasonCode: body.reasonCode }),
          },
        );
        sendSuccess(request, response, 200, result.coverage, {
          replayed: result.replayed,
        });
      } catch (error) {
        forward(error, next);
      }
    },

    /**
     * @desc Read Provider weekly schedule periods and dated exceptions.
     * @route GET /api/v1/providers/:providerId/availability/calendar
     * @access Protected Provider OWNER/ADMIN
     */
    async getCalendar(request, response, next): Promise<void> {
      try {
        const actor = principal(response);
        const params = providerIdParamsSchema.parse(request.params);
        const calendar = await service.getCalendar(
          { actorUserId: actor.userId },
          params.providerId,
        );
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 200, calendar);
      } catch (error) {
        forward(error, next);
      }
    },

    /**
     * @desc Full-replace Provider weekly periods and dated exceptions.
     * @route PUT /api/v1/providers/:providerId/availability/calendar
     * @access Protected Provider OWNER/ADMIN
     */
    async replaceCalendar(request, response, next): Promise<void> {
      try {
        const actor = principal(response);
        const params = providerIdParamsSchema.parse(request.params);
        const body = replaceProviderCalendarBodySchema.parse(request.body);
        const result = await service.replaceCalendar(
          commandMeta(actor, request),
          params.providerId,
          {
            weeklyPeriods: body.weeklyPeriods,
            exceptions: body.exceptions.map((exception) => ({
              localDate: exception.localDate,
              closed: exception.closed,
              ...(exception.startMinute === undefined
                ? {}
                : { startMinute: exception.startMinute }),
              ...(exception.endMinute === undefined
                ? {}
                : { endMinute: exception.endMinute }),
              ...(exception.endsNextDay === undefined
                ? {}
                : { endsNextDay: exception.endsNextDay }),
            })),
            expectedVersion: body.expectedVersion,
            idempotencyKey: body.idempotencyKey,
            ...(body.reasonCode === undefined ? {} : { reasonCode: body.reasonCode }),
          },
        );
        sendSuccess(request, response, 200, result.calendar, {
          replayed: result.replayed,
        });
      } catch (error) {
        forward(error, next);
      }
    },

    /**
     * @desc Read one owned Worker's weekly schedule periods and dated exceptions.
     * @route GET /api/v1/providers/:providerId/availability/workers/:workerId/calendar
     * @access Protected Provider OWNER/ADMIN
     */
    async getWorkerCalendar(request, response, next): Promise<void> {
      try {
        const actor = principal(response);
        const params = providerWorkerCalendarParamsSchema.parse(request.params);
        const calendar = await workerAvailabilityService.getWorkerCalendar(
          { actorUserId: actor.userId },
          params.providerId,
          params.workerId,
        );
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 200, calendar);
      } catch (error) {
        forward(error, next);
      }
    },

    /**
     * @desc Full-replace one owned Worker's weekly periods and dated exceptions.
     * @route PUT /api/v1/providers/:providerId/availability/workers/:workerId/calendar
     * @access Protected Provider OWNER/ADMIN
     */
    async replaceWorkerCalendar(request, response, next): Promise<void> {
      try {
        const actor = principal(response);
        const params = providerWorkerCalendarParamsSchema.parse(request.params);
        const body = replaceWorkerCalendarBodySchema.parse(request.body);
        const result = await workerAvailabilityService.replaceWorkerCalendar(
          commandMeta(actor, request),
          params.providerId,
          params.workerId,
          {
            weeklyPeriods: body.weeklyPeriods,
            exceptions: body.exceptions.map((exception) => ({
              localDate: exception.localDate,
              closed: exception.closed,
              ...(exception.startMinute === undefined
                ? {}
                : { startMinute: exception.startMinute }),
              ...(exception.endMinute === undefined
                ? {}
                : { endMinute: exception.endMinute }),
              ...(exception.endsNextDay === undefined
                ? {}
                : { endsNextDay: exception.endsNextDay }),
            })),
            expectedVersion: body.expectedVersion,
            idempotencyKey: body.idempotencyKey,
            ...(body.reasonCode === undefined ? {} : { reasonCode: body.reasonCode }),
          },
        );
        sendSuccess(request, response, 200, result.calendar, {
          replayed: result.replayed,
        });
      } catch (error) {
        forward(error, next);
      }
    },

    /**
     * @desc Read the Provider capacity rule.
     * @route GET /api/v1/providers/:providerId/availability/capacity
     * @access Protected Provider OWNER/ADMIN
     */
    async getCapacity(request, response, next): Promise<void> {
      try {
        const actor = principal(response);
        const params = providerIdParamsSchema.parse(request.params);
        const capacity = await capacityService.getCapacityRule(
          { actorUserId: actor.userId },
          params.providerId,
        );
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 200, capacity);
      } catch (error) {
        forward(error, next);
      }
    },

    /**
     * @desc Full-replace the Provider capacity rule at an expected version.
     * @route PUT /api/v1/providers/:providerId/availability/capacity
     * @access Protected Provider OWNER/ADMIN
     */
    async replaceCapacity(request, response, next): Promise<void> {
      try {
        const actor = principal(response);
        const params = providerIdParamsSchema.parse(request.params);
        const body = replaceProviderCapacityBodySchema.parse(request.body);
        const result = await capacityService.replaceCapacityRule(
          commandMeta(actor, request),
          params.providerId,
          {
            maxSimultaneousTeams: body.maxSimultaneousTeams,
            expectedVersion: body.expectedVersion,
            idempotencyKey: body.idempotencyKey,
            ...(body.reasonCode === undefined ? {} : { reasonCode: body.reasonCode }),
          },
        );
        sendSuccess(request, response, 200, result.capacity, {
          replayed: result.replayed,
        });
      } catch (error) {
        forward(error, next);
      }
    },

    /**
     * @desc Read the current unresolved temporary pause for one Provider.
     * @route GET /api/v1/providers/:providerId/availability/pause
     * @access Protected Provider OWNER/ADMIN
     */
    async getPause(request, response, next): Promise<void> {
      try {
        const actor = principal(response);
        const params = providerIdParamsSchema.parse(request.params);
        const pause = await service.getPause(
          { actorUserId: actor.userId },
          params.providerId,
        );
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 200, pause);
      } catch (error) {
        forward(error, next);
      }
    },

    /**
     * @desc Start one immediate temporary pause with optional endsAt.
     * @route POST /api/v1/providers/:providerId/availability/pause
     * @access Protected Provider OWNER/ADMIN
     */
    async startPause(request, response, next): Promise<void> {
      try {
        const actor = principal(response);
        const params = providerIdParamsSchema.parse(request.params);
        const body = startProviderPauseBodySchema.parse(request.body);
        const result = await service.startPause(
          commandMeta(actor, request),
          params.providerId,
          {
            ...(body.endsAt === undefined
              ? {}
              : { endsAt: body.endsAt === null ? null : new Date(body.endsAt) }),
            expectedVersion: body.expectedVersion,
            idempotencyKey: body.idempotencyKey,
            ...(body.reasonCode === undefined ? {} : { reasonCode: body.reasonCode }),
          },
        );
        sendSuccess(request, response, 200, result.pause, {
          replayed: result.replayed,
        });
      } catch (error) {
        forward(error, next);
      }
    },

    /**
     * @desc Resume the unresolved temporary pause early.
     * @route POST /api/v1/providers/:providerId/availability/pause/resume
     * @access Protected Provider OWNER/ADMIN
     */
    async resumePause(request, response, next): Promise<void> {
      try {
        const actor = principal(response);
        const params = providerIdParamsSchema.parse(request.params);
        const body = resumeProviderPauseBodySchema.parse(request.body);
        const result = await service.resumePause(
          commandMeta(actor, request),
          params.providerId,
          {
            expectedVersion: body.expectedVersion,
            idempotencyKey: body.idempotencyKey,
            ...(body.reasonCode === undefined ? {} : { reasonCode: body.reasonCode }),
          },
        );
        sendSuccess(request, response, 200, result.pause, {
          replayed: result.replayed,
        });
      } catch (error) {
        forward(error, next);
      }
    },
  };
}
