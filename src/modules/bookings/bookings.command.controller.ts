import type { Request, RequestHandler, Response } from "express";

import type { AuthenticationPrincipal } from "#modules/authentication/authentication.public";
import { AppError } from "#shared/errors/app-error";
import { sendSuccess } from "#shared/http/api-response";

import {
  attachBookingMediaBodySchema,
  bookingParamsSchema,
  bookingVersionBodySchema,
  cancelBookingBodySchema,
  createBookingBodySchema,
  idempotencyKeySchema,
  listBookingsQuerySchema,
  patchBookingBodySchema,
} from "./bookings.command.schema.js";
import type { BookingsCommandService } from "./bookings.command.service.js";
import { bookingError } from "./bookings.errors.js";

export interface BookingsCommandControllerDependencies {
  readonly service: BookingsCommandService;
}

function principalOf(response: Response): AuthenticationPrincipal {
  const principal = response.locals["authenticationPrincipal"] as
    | AuthenticationPrincipal
    | undefined;
  if (principal === undefined) {
    throw bookingError("AUTHENTICATION_REQUIRED");
  }
  return principal;
}

function requestIdOf(request: Request): string | undefined {
  return typeof request.requestId === "string" ? request.requestId : undefined;
}

function requireIdempotencyKey(request: Request): string {
  const header = request.get("idempotency-key");
  const parsed = idempotencyKeySchema.safeParse(header);
  if (!parsed.success) {
    throw bookingError("VALIDATION_FAILED", { field: "Idempotency-Key" });
  }
  return parsed.data;
}

/**
 * Thin booking-command HTTP handlers. Workflows live in BookingsCommandService.
 */
export function createBookingsCommandController(
  dependencies: BookingsCommandControllerDependencies,
): {
  readonly create: RequestHandler;
  readonly list: RequestHandler;
  readonly get: RequestHandler;
  readonly patch: RequestHandler;
  readonly submitForDeposit: RequestHandler;
  readonly cancel: RequestHandler;
  readonly attachMedia: RequestHandler;
} {
  return {
    /**
     * @desc Create a browse-path DRAFT booking with a server quote.
     * @route POST /api/v1/bookings
     * @access Verified customer
     */
    async create(request, response, next): Promise<void> {
      try {
        const body = createBookingBodySchema.parse(request.body);
        const data = await dependencies.service.createDraft(
          principalOf(response),
          body,
          requireIdempotencyKey(request),
        );
        sendSuccess(request, response, 201, data, {
          ...(requestIdOf(request) === undefined
            ? {}
            : { requestId: requestIdOf(request) }),
        });
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc List the caller's bookings.
     * @route GET /api/v1/bookings
     * @access Verified customer
     */
    async list(request, response, next): Promise<void> {
      try {
        const query = listBookingsQuerySchema.parse(request.query);
        const data = await dependencies.service.list(principalOf(response), query);
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc Get one owned booking aggregate.
     * @route GET /api/v1/bookings/:bookingId
     * @access Verified customer
     */
    async get(request, response, next): Promise<void> {
      try {
        const params = bookingParamsSchema.parse(request.params);
        const data = await dependencies.service.get(
          principalOf(response),
          params.bookingId,
        );
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc Patch draft notes, answers, or address only.
     * @route PATCH /api/v1/bookings/:bookingId
     * @access Verified customer
     */
    async patch(request, response, next): Promise<void> {
      try {
        const params = bookingParamsSchema.parse(request.params);
        const body = patchBookingBodySchema.parse(request.body);
        const data = await dependencies.service.patchDraft(
          principalOf(response),
          params.bookingId,
          body,
        );
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc Freeze the quote and move DRAFT to AWAITING_DEPOSIT.
     * @route POST /api/v1/bookings/:bookingId/submit-for-deposit
     * @access Verified customer
     */
    async submitForDeposit(request, response, next): Promise<void> {
      try {
        const params = bookingParamsSchema.parse(request.params);
        const body = bookingVersionBodySchema.parse(request.body);
        const data = await dependencies.service.submitForDeposit(
          principalOf(response),
          params.bookingId,
          body.version,
          requireIdempotencyKey(request),
        );
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc Cancel a DRAFT or AWAITING_DEPOSIT booking without fees.
     * @route POST /api/v1/bookings/:bookingId/cancel
     * @access Verified customer
     */
    async cancel(request, response, next): Promise<void> {
      try {
        const params = bookingParamsSchema.parse(request.params);
        const body = cancelBookingBodySchema.parse(request.body);
        const data = await dependencies.service.cancel(
          principalOf(response),
          params.bookingId,
          body,
          requireIdempotencyKey(request),
          requestIdOf(request),
        );
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc Attach a READY BOOKING_ATTACHMENT image to a draft.
     * @route POST /api/v1/bookings/:bookingId/media
     * @access Verified customer
     */
    async attachMedia(request, response, next): Promise<void> {
      try {
        const params = bookingParamsSchema.parse(request.params);
        const body = attachBookingMediaBodySchema.parse(request.body);
        const data = await dependencies.service.attachMedia(
          principalOf(response),
          params.bookingId,
          body,
          requireIdempotencyKey(request),
        );
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },
  };
}

function mapZod(error: unknown): unknown {
  if (
    error !== null &&
    typeof error === "object" &&
    "name" in error &&
    (error as { name: unknown }).name === "ZodError" &&
    "issues" in error
  ) {
    return new AppError({
      code: "VALIDATION_FAILED",
      message: "Booking request validation failed",
      statusCode: 400,
      details: {
        issues: Array.isArray((error as { issues: unknown }).issues)
          ? ((error as { issues: readonly Record<string, unknown>[] }).issues).map(
              (issue) => ({
                path: Array.isArray(issue["path"]) ? issue["path"].join(".") : "",
                code: issue["code"],
                message: issue["message"],
              }),
            )
          : [],
      },
    });
  }
  return error;
}
