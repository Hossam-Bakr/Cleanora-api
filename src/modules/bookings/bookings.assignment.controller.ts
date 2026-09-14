import type { Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";

import type { AuthenticationPrincipal } from "#modules/authentication/authentication.public";
import { AppError } from "#shared/errors/app-error";
import { sendSuccess } from "#shared/http/api-response";

import { bookingAssignmentError } from "./bookings.errors.js";
import { idempotencyKeySchema } from "./bookings.command.schema.js";
import type { BookingAssignmentService } from "./bookings.assignment.service.js";
import {
  assignTeamBodySchema,
  assignWorkersBodySchema,
  assignmentProviderBookingParamsSchema,
} from "./bookings.assignment.schema.js";

export interface BookingAssignmentControllerDependencies {
  readonly service: BookingAssignmentService;
}

function principalOf(response: Response): AuthenticationPrincipal {
  const principal = response.locals["authenticationPrincipal"] as
    | AuthenticationPrincipal
    | undefined;
  if (principal === undefined) {
    throw bookingAssignmentError("AUTHENTICATION_REQUIRED");
  }
  return principal;
}

function requireIdempotencyKey(request: Request): string {
  const parsed = idempotencyKeySchema.safeParse(request.get("idempotency-key"));
  if (!parsed.success) {
    throw bookingAssignmentError("VALIDATION_FAILED", { field: "Idempotency-Key" });
  }
  return parsed.data;
}

function requestIdOf(request: Request): string {
  const header = request.get("x-request-id");
  if (typeof header === "string" && header.trim().length > 0) {
    return header.trim().slice(0, 200);
  }
  return `req_${Date.now()}`;
}

function mapZod(error: unknown): unknown {
  if (error instanceof ZodError) {
    return new AppError({
      code: "VALIDATION_FAILED",
      message: "Booking request validation failed",
      statusCode: 400,
      details: { issues: error.issues },
    });
  }
  return error;
}

/**
 * Thin HTTP adapters for provider booking assignment commands.
 * @access Bookings HTTP
 */
export function createBookingAssignmentController(
  dependencies: BookingAssignmentControllerDependencies,
): {
  readonly assignTeam: RequestHandler;
  readonly assignWorkers: RequestHandler;
  readonly replaceTeam: RequestHandler;
  readonly replaceWorkers: RequestHandler;
  readonly getCurrent: RequestHandler;
  readonly getHistory: RequestHandler;
  readonly listMyAssignments: RequestHandler;
} {
  return {
    /**
     * @desc Assign Browse-selected team to an ACCEPTED booking.
     * @route POST /api/v1/providers/:providerId/bookings/:bookingId/assignments/team
     * @access Provider OWNER/ADMIN
     */
    async assignTeam(request, response, next): Promise<void> {
      try {
        const params = assignmentProviderBookingParamsSchema.parse(request.params);
        const body = assignTeamBodySchema.parse(request.body);
        const data = await dependencies.service.assignTeam({
          actorUserId: principalOf(response).userId,
          providerId: params.providerId,
          bookingId: params.bookingId,
          teamId: body.teamId,
          expectedBookingVersion: body.expectedBookingVersion,
          idempotencyKey: requireIdempotencyKey(request),
          requestId: requestIdOf(request),
        });
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc Assign ad-hoc workers to an ACCEPTED booking.
     * @route POST /api/v1/providers/:providerId/bookings/:bookingId/assignments/workers
     * @access Provider OWNER/ADMIN
     */
    async assignWorkers(request, response, next): Promise<void> {
      try {
        const params = assignmentProviderBookingParamsSchema.parse(request.params);
        const body = assignWorkersBodySchema.parse(request.body);
        const data = await dependencies.service.assignWorkers({
          actorUserId: principalOf(response).userId,
          providerId: params.providerId,
          bookingId: params.bookingId,
          workerIds: body.workerIds,
          expectedBookingVersion: body.expectedBookingVersion,
          idempotencyKey: requireIdempotencyKey(request),
          requestId: requestIdOf(request),
        });
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc Replace ACTIVE assignment with Browse-selected team.
     * @route POST /api/v1/providers/:providerId/bookings/:bookingId/assignments/team/replace
     * @access Provider OWNER/ADMIN
     */
    async replaceTeam(request, response, next): Promise<void> {
      try {
        const params = assignmentProviderBookingParamsSchema.parse(request.params);
        const body = assignTeamBodySchema.parse(request.body);
        const data = await dependencies.service.replaceTeam({
          actorUserId: principalOf(response).userId,
          providerId: params.providerId,
          bookingId: params.bookingId,
          teamId: body.teamId,
          expectedBookingVersion: body.expectedBookingVersion,
          idempotencyKey: requireIdempotencyKey(request),
          requestId: requestIdOf(request),
        });
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc Replace ACTIVE assignment with ad-hoc workers.
     * @route POST /api/v1/providers/:providerId/bookings/:bookingId/assignments/workers/replace
     * @access Provider OWNER/ADMIN
     */
    async replaceWorkers(request, response, next): Promise<void> {
      try {
        const params = assignmentProviderBookingParamsSchema.parse(request.params);
        const body = assignWorkersBodySchema.parse(request.body);
        const data = await dependencies.service.replaceWorkers({
          actorUserId: principalOf(response).userId,
          providerId: params.providerId,
          bookingId: params.bookingId,
          workerIds: body.workerIds,
          expectedBookingVersion: body.expectedBookingVersion,
          idempotencyKey: requireIdempotencyKey(request),
          requestId: requestIdOf(request),
        });
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc Read current ACTIVE assignment.
     * @route GET /api/v1/providers/:providerId/bookings/:bookingId/assignments/current
     * @access Provider OWNER/ADMIN
     */
    async getCurrent(request, response, next): Promise<void> {
      try {
        const params = assignmentProviderBookingParamsSchema.parse(request.params);
        const data = await dependencies.service.getCurrent({
          actorUserId: principalOf(response).userId,
          providerId: params.providerId,
          bookingId: params.bookingId,
        });
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc Read assignment history for a booking.
     * @route GET /api/v1/providers/:providerId/bookings/:bookingId/assignments/history
     * @access Provider OWNER/ADMIN
     */
    async getHistory(request, response, next): Promise<void> {
      try {
        const params = assignmentProviderBookingParamsSchema.parse(request.params);
        const data = await dependencies.service.getHistory({
          actorUserId: principalOf(response).userId,
          providerId: params.providerId,
          bookingId: params.bookingId,
        });
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc List ACTIVE assignments for the authenticated worker.
     * @route GET /api/v1/workers/me/assignments
     * @access Authenticated worker
     */
    async listMyAssignments(request, response, next): Promise<void> {
      try {
        const data = await dependencies.service.listWorkerAssignments({
          workerUserId: principalOf(response).userId,
        });
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },
  };
}
