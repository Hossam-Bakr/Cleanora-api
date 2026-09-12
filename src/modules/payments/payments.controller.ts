import type { Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";

import type { AuthenticationPrincipal } from "#modules/authentication/authentication.public";
import { AppError } from "#shared/errors/app-error";
import { sendSuccess } from "#shared/http/api-response";

import { isVerifiedCustomerPrincipal } from "#modules/bookings/bookings.customer";

import {
  isPaymentsError,
  paymentsError,
  toPaymentsHttpError,
} from "./payments.errors.js";
import type { PaymentsApplicationService } from "./payments.public.js";
import {
  browserReturnQuerySchema,
  idempotencyKeySchema,
  initiateDepositBodySchema,
  listMethodsQuerySchema,
  methodParamsSchema,
  paymentParamsSchema,
  setMethodEnabledBodySchema,
} from "./payments.schemas.js";

export interface PaymentsControllerDependencies {
  readonly service: PaymentsApplicationService;
  readonly isStaffAdmin: (userId: string) => Promise<boolean>;
}

function principalOf(response: Response): AuthenticationPrincipal {
  const principal = response.locals["authenticationPrincipal"] as
    | AuthenticationPrincipal
    | undefined;
  if (principal === undefined) {
    throw paymentsError("AUTHENTICATION_REQUIRED");
  }
  return principal;
}

function requireCustomer(response: Response): AuthenticationPrincipal {
  const principal = principalOf(response);
  if (!isVerifiedCustomerPrincipal(principal)) {
    throw paymentsError("FORBIDDEN");
  }
  return principal;
}

function requireIdempotencyKey(request: Request): string {
  const header = request.get("idempotency-key");
  const parsed = idempotencyKeySchema.safeParse(header);
  if (!parsed.success) {
    throw paymentsError("VALIDATION_FAILED", { field: "Idempotency-Key" });
  }
  return parsed.data;
}

function mapError(error: unknown): unknown {
  if (error instanceof ZodError) {
    return new AppError({
      code: "VALIDATION_FAILED",
      message: "Payments request validation failed",
      statusCode: 400,
      details: { issues: error.issues },
    });
  }
  if (isPaymentsError(error)) {
    return toPaymentsHttpError(error);
  }
  return error;
}

/**
 * Thin payments HTTP handlers. Workflows live in PaymentsApplicationService.
 */
export function createPaymentsController(
  dependencies: PaymentsControllerDependencies,
): {
  readonly listMethods: RequestHandler;
  readonly initiateDeposit: RequestHandler;
  readonly browserReturn: RequestHandler;
  readonly getPayment: RequestHandler;
  readonly setMethodEnabled: RequestHandler;
  readonly paymobWebhook: RequestHandler;
} {
  return {
    /**
     * @desc List enabled payment methods for a country.
     * @route GET /api/v1/payments/methods
     * @access Verified customer
     */
    async listMethods(request, response, next): Promise<void> {
      try {
        requireCustomer(response);
        const query = listMethodsQuerySchema.parse(request.query);
        const items = await dependencies.service.listEnabledMethodsForCountry({
          countryId: query.countryId,
        });
        sendSuccess(request, response, 200, { items });
      } catch (error) {
        next(mapError(error));
      }
    },

    /**
     * @desc Initiate an idempotent booking deposit attempt.
     * @route POST /api/v1/payments/deposits
     * @access Verified customer
     */
    async initiateDeposit(request, response, next): Promise<void> {
      try {
        const principal = requireCustomer(response);
        const body = initiateDepositBodySchema.parse(request.body);
        const data = await dependencies.service.initiateBookingDeposit({
          actorUserId: principal.userId,
          bookingId: body.bookingId,
          paymentMethodId: body.paymentMethodId,
          idempotencyKey: requireIdempotencyKey(request),
        });
        sendSuccess(request, response, 201, data);
      } catch (error) {
        next(mapError(error));
      }
    },

    /**
     * @desc Browser return status projection only — never marks paid.
     * @route GET /api/v1/payments/return
     * @access Authenticated customer or signed return token
     */
    async browserReturn(request, response, next): Promise<void> {
      try {
        const query = browserReturnQuerySchema.parse(request.query);
        const principal = response.locals["authenticationPrincipal"] as
          | AuthenticationPrincipal
          | undefined;
        const data = await dependencies.service.getBrowserReturnStatus({
          ...(principal === undefined ? {} : { actorUserId: principal.userId }),
          ...(query.paymentId === undefined ? {} : { paymentId: query.paymentId }),
          ...(query.attemptId === undefined ? {} : { attemptId: query.attemptId }),
          ...(query.returnToken === undefined
            ? {}
            : { returnToken: query.returnToken }),
        });
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapError(error));
      }
    },

    /**
     * @desc Payment detail including receipt when present.
     * @route GET /api/v1/payments/:paymentId
     * @access Owner customer or staff_admin
     */
    async getPayment(request, response, next): Promise<void> {
      try {
        const principal = principalOf(response);
        const params = paymentParamsSchema.parse(request.params);
        const staff = await dependencies.isStaffAdmin(principal.userId);
        const data = await dependencies.service.getPaymentForReader({
          paymentId: params.paymentId,
          reader: staff
            ? { kind: "STAFF_ADMIN", userId: principal.userId }
            : { kind: "CUSTOMER", userId: principal.userId },
        });
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapError(error));
      }
    },

    /**
     * @desc Enable or disable a payment method.
     * @route PATCH /api/v1/staff/payments/methods/:methodId
     * @access staff_admin
     */
    async setMethodEnabled(request, response, next): Promise<void> {
      try {
        const principal = principalOf(response);
        const staff = await dependencies.isStaffAdmin(principal.userId);
        if (!staff) {
          throw paymentsError("FORBIDDEN");
        }
        const params = methodParamsSchema.parse(request.params);
        const body = setMethodEnabledBodySchema.parse(request.body);
        const data = await dependencies.service.setPaymentMethodEnabled({
          staffUserId: principal.userId,
          methodId: params.methodId,
          enabled: body.enabled,
        });
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapError(error));
      }
    },

    /**
     * @desc Paymob webhook receiver with raw-body signature verification.
     * @route POST /api/v1/webhooks/paymob
     * @access Signature-gated (no user principal)
     */
    async paymobWebhook(request, response, next): Promise<void> {
      try {
        const rawBody = (request as Request & { rawBody?: Buffer }).rawBody;
        if (rawBody === undefined) {
          throw paymentsError("VALIDATION_FAILED", { reason: "RAW_BODY" });
        }
        const signature =
          request.get("hmac") ??
          request.get("x-paymob-hmac") ??
          request.get("x-hmac");
        const data = await dependencies.service.processPaymobWebhook({
          rawBody,
          signatureHeader: signature ?? undefined,
        });
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapError(error));
      }
    },
  };
}
