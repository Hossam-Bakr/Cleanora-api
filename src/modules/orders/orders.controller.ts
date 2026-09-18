import type { Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";

import type { AuthenticationPrincipal } from "#modules/authentication/authentication.public";
import { AppError } from "#shared/errors/app-error";
import { sendSuccess } from "#shared/http/api-response";

import { ordersError } from "./orders.errors.js";
import {
  addNoteBodySchema,
  attachMediaBodySchema,
  bookingIdParamsSchema,
  completeOrderBodySchema,
  emptyTransitionBodySchema,
  idempotencyKeySchema,
  orderIdParamsSchema,
} from "./orders.schema.js";
import type { OrdersService } from "./orders.service.js";

export interface OrdersControllerDependencies {
  readonly service: OrdersService;
}

function principalOf(response: Response): AuthenticationPrincipal {
  const principal = response.locals["authenticationPrincipal"] as
    | AuthenticationPrincipal
    | undefined;
  if (principal === undefined) {
    throw ordersError("AUTHENTICATION_REQUIRED");
  }
  return principal;
}

function requireIdempotencyKey(request: Request, bodyKey?: string): string {
  const header = request.get("idempotency-key");
  if (typeof header === "string" && header.trim().length > 0) {
    const parsed = idempotencyKeySchema.safeParse(header.trim());
    if (!parsed.success) {
      throw ordersError("VALIDATION_FAILED", { field: "Idempotency-Key" });
    }
    return parsed.data;
  }
  if (typeof bodyKey === "string" && bodyKey.length > 0) {
    return bodyKey;
  }
  throw ordersError("VALIDATION_FAILED", { field: "Idempotency-Key" });
}

function mapZod(error: unknown): unknown {
  if (error instanceof ZodError) {
    return new AppError({
      code: "VALIDATION_FAILED",
      message: "Order request validation failed",
      statusCode: 400,
      details: { issues: error.issues },
    });
  }
  return error;
}

/**
 * Thin HTTP adapters for Orders routes.
 * @access Orders HTTP
 */
export function createOrdersController(
  dependencies: OrdersControllerDependencies,
): {
  readonly getOrder: RequestHandler;
  readonly getByBooking: RequestHandler;
  readonly getTimeline: RequestHandler;
  readonly onTheWay: RequestHandler;
  readonly inProgress: RequestHandler;
  readonly readyToComplete: RequestHandler;
  readonly complete: RequestHandler;
  readonly resendCode: RequestHandler;
  readonly attachMedia: RequestHandler;
  readonly addNote: RequestHandler;
  readonly listMedia: RequestHandler;
} {
  return {
    /**
     * @desc Get order dossier (never returns completion-code plaintext).
     * @route GET /api/v1/orders/:orderId
     * @access Customer owner, provider OWNER/ADMIN, ACTIVE assignment member, staff
     */
    async getOrder(request, response, next): Promise<void> {
      try {
        const params = orderIdParamsSchema.parse(request.params);
        const data = await dependencies.service.getOrder({
          orderId: params.orderId,
          actorUserId: principalOf(response).userId,
        });
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc Ensure+get order by booking id.
     * @route GET /api/v1/orders/by-booking/:bookingId
     * @access Same entitlement as getOrder
     */
    async getByBooking(request, response, next): Promise<void> {
      try {
        const params = bookingIdParamsSchema.parse(request.params);
        const data = await dependencies.service.getOrEnsureByBooking({
          bookingId: params.bookingId,
          actorUserId: principalOf(response).userId,
        });
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc Chronological order timeline (code plaintext redacted).
     * @route GET /api/v1/orders/:orderId/timeline
     * @access Entitled readers
     */
    async getTimeline(request, response, next): Promise<void> {
      try {
        const params = orderIdParamsSchema.parse(request.params);
        const data = await dependencies.service.getTimeline({
          orderId: params.orderId,
          actorUserId: principalOf(response).userId,
        });
        sendSuccess(request, response, 200, { items: data });
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc ASSIGNED → ON_THE_WAY.
     * @route POST /api/v1/orders/:orderId/transitions/on-the-way
     * @access Field actor
     */
    async onTheWay(request, response, next): Promise<void> {
      try {
        const params = orderIdParamsSchema.parse(request.params);
        const body = emptyTransitionBodySchema.parse(request.body ?? {});
        const data = await dependencies.service.transitionOnTheWay({
          orderId: params.orderId,
          actorUserId: principalOf(response).userId,
          idempotencyKey: requireIdempotencyKey(request, body.idempotencyKey),
        });
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc ON_THE_WAY → IN_PROGRESS.
     * @route POST /api/v1/orders/:orderId/transitions/in-progress
     * @access Field actor
     */
    async inProgress(request, response, next): Promise<void> {
      try {
        const params = orderIdParamsSchema.parse(request.params);
        const body = emptyTransitionBodySchema.parse(request.body ?? {});
        const data = await dependencies.service.transitionInProgress({
          orderId: params.orderId,
          actorUserId: principalOf(response).userId,
          idempotencyKey: requireIdempotencyKey(request, body.idempotencyKey),
        });
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc IN_PROGRESS → READY_TO_COMPLETE (issues hashed code + intent).
     * @route POST /api/v1/orders/:orderId/transitions/ready-to-complete
     * @access Field actor
     */
    async readyToComplete(request, response, next): Promise<void> {
      try {
        const params = orderIdParamsSchema.parse(request.params);
        const body = emptyTransitionBodySchema.parse(request.body ?? {});
        const data = await dependencies.service.transitionReadyToComplete({
          orderId: params.orderId,
          actorUserId: principalOf(response).userId,
          idempotencyKey: requireIdempotencyKey(request, body.idempotencyKey),
        });
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc Complete with six-digit code proof.
     * @route POST /api/v1/orders/:orderId/complete
     * @access Field actor
     */
    async complete(request, response, next): Promise<void> {
      try {
        const params = orderIdParamsSchema.parse(request.params);
        const body = completeOrderBodySchema.parse(request.body);
        const data = await dependencies.service.complete({
          orderId: params.orderId,
          actorUserId: principalOf(response).userId,
          code: body.code,
          idempotencyKey: requireIdempotencyKey(request, body.idempotencyKey),
        });
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc Supersede ACTIVE completion code and emit new intent.
     * @route POST /api/v1/orders/:orderId/completion-code/resend
     * @access Field actor
     */
    async resendCode(request, response, next): Promise<void> {
      try {
        const params = orderIdParamsSchema.parse(request.params);
        const body = emptyTransitionBodySchema.parse(request.body ?? {});
        const data = await dependencies.service.resendCompletionCode({
          orderId: params.orderId,
          actorUserId: principalOf(response).userId,
          idempotencyKey: requireIdempotencyKey(request, body.idempotencyKey),
        });
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc Attach progress/completion media.
     * @route POST /api/v1/orders/:orderId/media
     * @access Field actor
     */
    async attachMedia(request, response, next): Promise<void> {
      try {
        const params = orderIdParamsSchema.parse(request.params);
        const body = attachMediaBodySchema.parse(request.body);
        const data = await dependencies.service.attachMedia({
          orderId: params.orderId,
          actorUserId: principalOf(response).userId,
          mediaFileId: body.mediaFileId,
          kind: body.kind,
          idempotencyKey: requireIdempotencyKey(request, body.idempotencyKey),
        });
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc Add a field note.
     * @route POST /api/v1/orders/:orderId/notes
     * @access Field actor
     */
    async addNote(request, response, next): Promise<void> {
      try {
        const params = orderIdParamsSchema.parse(request.params);
        const body = addNoteBodySchema.parse(request.body);
        const data = await dependencies.service.addNote({
          orderId: params.orderId,
          actorUserId: principalOf(response).userId,
          body: body.body,
          idempotencyKey: requireIdempotencyKey(request, body.idempotencyKey),
        });
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc List role-filtered order media.
     * @route GET /api/v1/orders/:orderId/media
     * @access Entitled readers with visibility rules
     */
    async listMedia(request, response, next): Promise<void> {
      try {
        const params = orderIdParamsSchema.parse(request.params);
        const data = await dependencies.service.listMedia({
          orderId: params.orderId,
          actorUserId: principalOf(response).userId,
        });
        sendSuccess(request, response, 200, { items: data });
      } catch (error) {
        next(mapZod(error));
      }
    },
  };
}
