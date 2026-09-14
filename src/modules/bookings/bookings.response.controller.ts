import type { Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";

import type { AuthenticationPrincipal } from "#modules/authentication/authentication.public";
import { AppError } from "#shared/errors/app-error";
import { sendSuccess } from "#shared/http/api-response";

import { bookingError } from "./bookings.errors.js";
import { idempotencyKeySchema } from "./bookings.command.schema.js";
import type { BookingResponseService } from "./bookings.response.service.js";
import {
  cancellationReasonsQuerySchema,
  inboxQuerySchema,
  providerBookingParamsSchema,
  providerInboxParamsSchema,
  reasonVersionBodySchema,
  staffBookingParamsSchema,
  versionBodySchema,
} from "./bookings.response.schema.js";

export interface BookingResponseControllerDependencies {
  readonly service: BookingResponseService;
}

function principalOf(response: Response): AuthenticationPrincipal {
  const principal = response.locals["authenticationPrincipal"] as
    | AuthenticationPrincipal
    | undefined;
  if (principal === undefined) {
    throw bookingError("AUTHENTICATION_REQUIRED");
  } else {
    return principal;
  }
}

function requireIdempotencyKey(request: Request): string {
  const parsed = idempotencyKeySchema.safeParse(request.get("idempotency-key"));
  if (!parsed.success) {
    throw bookingError("VALIDATION_FAILED", { field: "Idempotency-Key" });
  } else {
    return parsed.data;
  }
}

function mapZod(error: unknown): unknown {
  if (error instanceof ZodError) {
    return new AppError({
      code: "VALIDATION_FAILED",
      message: "Booking request validation failed",
      statusCode: 400,
      details: { issues: error.issues },
    });
  } else {
    return error;
  }
}

/**
 * Thin HTTP adapters for provider/staff booking response commands.
 * @access Bookings HTTP
 */
export function createBookingResponseController(
  dependencies: BookingResponseControllerDependencies,
): {
  readonly inbox: RequestHandler;
  readonly providerGet: RequestHandler;
  readonly accept: RequestHandler;
  readonly reject: RequestHandler;
  readonly providerCancel: RequestHandler;
  readonly reasons: RequestHandler;
  readonly staffGet: RequestHandler;
  readonly staffCancel: RequestHandler;
} {
  return {
    /**
     * @desc List the selected provider's pending confirmed bookings.
     * @route GET /api/v1/providers/:providerId/bookings/inbox
     * @access Provider OWNER/ADMIN
     */
    async inbox(request, response, next): Promise<void> {
      try {
        const params = providerInboxParamsSchema.parse(request.params);
        const query = inboxQuerySchema.parse(request.query);
        const data = await dependencies.service.listInbox({
          actorUserId: principalOf(response).userId,
          providerId: params.providerId,
          limit: query.limit === undefined ? 20 : query.limit,
        });
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc Read the selected-provider booking dossier.
     * @route GET /api/v1/providers/:providerId/bookings/:bookingId
     * @access Provider OWNER/ADMIN of the selected provider
     */
    async providerGet(request, response, next): Promise<void> {
      try {
        const params = providerBookingParamsSchema.parse(request.params);
        const data = await dependencies.service.getProviderDossier({
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
     * @desc Accept a confirmed booking.
     * @route POST /api/v1/providers/:providerId/bookings/:bookingId/accept
     * @access Provider OWNER/ADMIN of the selected provider
     */
    async accept(request, response, next): Promise<void> {
      try {
        const params = providerBookingParamsSchema.parse(request.params);
        const body = versionBodySchema.parse(request.body);
        const data = await dependencies.service.accept({
          actorUserId: principalOf(response).userId,
          providerId: params.providerId,
          bookingId: params.bookingId,
          version: body.version,
          idempotencyKey: requireIdempotencyKey(request),
        });
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc Reject a confirmed booking with a seeded reason.
     * @route POST /api/v1/providers/:providerId/bookings/:bookingId/reject
     * @access Provider OWNER/ADMIN of the selected provider
     */
    async reject(request, response, next): Promise<void> {
      try {
        const params = providerBookingParamsSchema.parse(request.params);
        const body = reasonVersionBodySchema.parse(request.body);
        const data = await dependencies.service.reject({
          actorUserId: principalOf(response).userId,
          providerId: params.providerId,
          bookingId: params.bookingId,
          version: body.version,
          reasonCode: body.reasonCode,
          idempotencyKey: requireIdempotencyKey(request),
        });
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc Cancel an accepted booking as the selected provider.
     * @route POST /api/v1/providers/:providerId/bookings/:bookingId/cancel
     * @access Provider OWNER/ADMIN of the selected provider
     */
    async providerCancel(request, response, next): Promise<void> {
      try {
        const params = providerBookingParamsSchema.parse(request.params);
        const body = reasonVersionBodySchema.parse(request.body);
        const data = await dependencies.service.providerCancel({
          actorUserId: principalOf(response).userId,
          providerId: params.providerId,
          bookingId: params.bookingId,
          version: body.version,
          reasonCode: body.reasonCode,
          idempotencyKey: requireIdempotencyKey(request),
        });
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc List active cancellation or reject reasons for an actor.
     * @route GET /api/v1/bookings/cancellation-reasons
     * @access Authenticated
     */
    async reasons(request, response, next): Promise<void> {
      try {
        principalOf(response);
        const query = cancellationReasonsQuerySchema.parse(request.query);
        const items = await dependencies.service.listReasons(query);
        sendSuccess(request, response, 200, { items });
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc Staff booking dossier.
     * @route GET /api/v1/staff/bookings/:bookingId
     * @access staff_admin
     */
    async staffGet(request, response, next): Promise<void> {
      try {
        const params = staffBookingParamsSchema.parse(request.params);
        const data = await dependencies.service.getStaffDossier({
          actorUserId: principalOf(response).userId,
          bookingId: params.bookingId,
        });
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc Staff privileged cancel of a confirmed or accepted booking.
     * @route POST /api/v1/staff/bookings/:bookingId/cancel
     * @access staff_admin
     */
    async staffCancel(request, response, next): Promise<void> {
      try {
        const params = staffBookingParamsSchema.parse(request.params);
        const body = reasonVersionBodySchema.parse(request.body);
        const data = await dependencies.service.staffCancel({
          actorUserId: principalOf(response).userId,
          bookingId: params.bookingId,
          version: body.version,
          reasonCode: body.reasonCode,
          idempotencyKey: requireIdempotencyKey(request),
        });
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },
  };
}
