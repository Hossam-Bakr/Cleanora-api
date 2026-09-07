/**
 * Thin HTTP adapters for Provider Service management (R1-P09 US1–US2).
 */

import type { NextFunction, Request, Response } from "express";

import type { AuthenticationPrincipal } from "#modules/authentication/authentication.public";
import { AppError } from "#shared/errors/app-error";
import { sendSuccess } from "#shared/http/api-response";

import {
  ProviderServiceError,
  providerServiceErrorToAppError,
} from "./domain/provider-service.errors.js";
import type { ProviderServiceQueryService } from "./provider-service-query.service.js";
import type { ProviderServiceService } from "./provider-service.service.js";
import type {
  CreateProviderServiceBody,
  ProposeProviderServicePriceBody,
  ProviderServiceLifecycleBody,
  ReplaceProviderServiceConfigurationBody,
  StaffPriceDecisionBody,
} from "./provider-service.schema.js";

export type ProviderServiceHttpService = Pick<
  ProviderServiceService,
  "createOffering" | "replaceConfiguration" | "proposePrice" | "applyLifecycle"
> &
  Pick<
    ProviderServiceQueryService,
    "list" | "get" | "listPriceHistory" | "listStatusHistory"
  >;

export type StaffProviderServiceHttpService = Pick<
  ProviderServiceService,
  "decidePriceProposal"
> &
  Pick<
    ProviderServiceQueryService,
    "listStaffPendingPriceProposals" | "getStaffPendingPriceDossier"
  >;

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

function param(request: Request, key: string): string {
  const value = request.params[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new ProviderServiceError("REQUEST_VALIDATION_FAILED", undefined, {
      details: { field: key, reason: "MISSING" },
    });
  }
  return value;
}

function forward(error: unknown, next: NextFunction): void {
  if (error instanceof ProviderServiceError) {
    next(providerServiceErrorToAppError(error));
    return;
  }
  next(error);
}

/**
 * @desc Create thin Provider Service HTTP handlers.
 * @access HTTP adapter
 */
export function createProviderServiceController(
  service: ProviderServiceHttpService,
) {
  return {
    /**
     * @desc List Provider Service offerings for one exact Provider.
     * @route GET /api/v1/providers/:providerId/services
     * @access Protected Provider OWNER/ADMIN
     * @explanation Validates params/query then delegates to the query service.
     */
    async listServices(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const actor = principal(response);
        const query = request.query as {
          readonly cursor?: string;
          readonly limit?: string | number;
        };
        const result = await service.list({
          actorUserId: actor.userId,
          providerId: param(request, "providerId"),
          ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
          ...(query.limit === undefined
            ? {}
            : { limit: Number(query.limit) }),
        });
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 200, result.items, {
          nextCursor: result.nextCursor,
        });
      } catch (error) {
        forward(error, next);
      }
    },

    /**
     * @desc Create one disabled Provider Service offering and initial price.
     * @route POST /api/v1/providers/:providerId/services
     * @access Protected Provider OWNER/ADMIN
     * @explanation Strict body validation runs before orchestration; fresh
     * creates return 201 and matching replays return 200 with meta.replayed.
     */
    async createService(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const actor = principal(response);
        const body = request.body as CreateProviderServiceBody;
        const result = await service.createOffering({
          actorUserId: actor.userId,
          providerId: param(request, "providerId"),
          requestId: request.requestId,
          idempotencyKey: body.idempotencyKey,
          expectedVersion: 0,
          catalogServiceCode: body.catalogServiceCode,
          catalogPriceUnitId: body.catalogPriceUnitId,
          price: body.price,
          minimumCharge: body.minimumCharge,
          estimatedDurationMinutes: body.estimatedDurationMinutes,
          ...(body.noteAr === undefined ? {} : { noteAr: body.noteAr }),
          ...(body.noteEn === undefined ? {} : { noteEn: body.noteEn }),
        });
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(
          request,
          response,
          result.replayed ? 200 : 201,
          result.offering,
          { replayed: result.replayed },
        );
      } catch (error) {
        forward(error, next);
      }
    },

    /**
     * @desc Read one exact-Provider offering management detail.
     * @route GET /api/v1/providers/:providerId/services/:providerServiceId
     * @access Protected Provider OWNER/ADMIN
     * @explanation Cross-Provider and unknown targets share a safe not-found.
     */
    async getService(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const actor = principal(response);
        const result = await service.get({
          actorUserId: actor.userId,
          providerId: param(request, "providerId"),
          providerServiceId: param(request, "providerServiceId"),
        });
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 200, result);
      } catch (error) {
        forward(error, next);
      }
    },

    /**
     * @desc Replace offering duration and optional AR/EN notes.
     * @route PUT /api/v1/providers/:providerId/services/:providerServiceId/configuration
     * @access Protected Provider OWNER/ADMIN
     * @explanation Never creates or mutates price rows; replays set meta.replayed.
     */
    async replaceConfiguration(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const actor = principal(response);
        const body = request.body as ReplaceProviderServiceConfigurationBody;
        const result = await service.replaceConfiguration({
          actorUserId: actor.userId,
          providerId: param(request, "providerId"),
          providerServiceId: param(request, "providerServiceId"),
          requestId: request.requestId,
          idempotencyKey: body.idempotencyKey,
          expectedVersion: body.expectedVersion,
          estimatedDurationMinutes: body.estimatedDurationMinutes,
          noteAr: body.noteAr,
          noteEn: body.noteEn,
        });
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 200, result.offering, {
          replayed: result.replayed,
        });
      } catch (error) {
        forward(error, next);
      }
    },

    /**
     * @desc Submit a retained replacement price proposal.
     * @route POST /api/v1/providers/:providerId/services/:providerServiceId/price-proposals
     * @access Protected Provider OWNER/ADMIN
     * @explanation Fresh proposals return 201; matching replays return 200.
     */
    async proposePrice(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const actor = principal(response);
        const body = request.body as ProposeProviderServicePriceBody;
        const result = await service.proposePrice({
          actorUserId: actor.userId,
          providerId: param(request, "providerId"),
          providerServiceId: param(request, "providerServiceId"),
          requestId: request.requestId,
          idempotencyKey: body.idempotencyKey,
          expectedVersion: body.expectedVersion,
          catalogPriceUnitId: body.catalogPriceUnitId,
          price: body.price,
          minimumCharge: body.minimumCharge,
          reason: body.reason,
        });
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(
          request,
          response,
          result.replayed ? 200 : 201,
          result.offering,
          { replayed: result.replayed },
        );
      } catch (error) {
        forward(error, next);
      }
    },

    /**
     * @desc Enable or disable an offering with a trimmed reason.
     * @route POST /api/v1/providers/:providerId/services/:providerServiceId/lifecycle
     * @access Protected Provider OWNER/ADMIN
     * @explanation Enable checks DEC-051 usability; disable needs no price approval.
     */
    async applyLifecycle(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const actor = principal(response);
        const body = request.body as ProviderServiceLifecycleBody;
        const result = await service.applyLifecycle({
          actorUserId: actor.userId,
          providerId: param(request, "providerId"),
          providerServiceId: param(request, "providerServiceId"),
          requestId: request.requestId,
          idempotencyKey: body.idempotencyKey,
          expectedVersion: body.expectedVersion,
          action: body.action,
          reason: body.reason,
        });
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 200, result.offering, {
          replayed: result.replayed,
        });
      } catch (error) {
        forward(error, next);
      }
    },

    /**
     * @desc List append-only price history without receipt fields.
     * @route GET /api/v1/providers/:providerId/services/:providerServiceId/price-history
     * @access Protected Provider OWNER/ADMIN
     */
    async listPriceHistory(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const actor = principal(response);
        const query = request.query as {
          readonly cursor?: string;
          readonly limit?: string | number;
        };
        const result = await service.listPriceHistory({
          actorUserId: actor.userId,
          providerId: param(request, "providerId"),
          providerServiceId: param(request, "providerServiceId"),
          ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
          ...(query.limit === undefined
            ? {}
            : { limit: Number(query.limit) }),
        });
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 200, result.items, {
          nextCursor: result.nextCursor,
        });
      } catch (error) {
        forward(error, next);
      }
    },

    /**
     * @desc List enable/disable status history only (excludes create/config receipts).
     * @route GET /api/v1/providers/:providerId/services/:providerServiceId/status-history
     * @access Protected Provider OWNER/ADMIN
     */
    async listStatusHistory(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const actor = principal(response);
        const query = request.query as {
          readonly cursor?: string;
          readonly limit?: string | number;
        };
        const result = await service.listStatusHistory({
          actorUserId: actor.userId,
          providerId: param(request, "providerId"),
          providerServiceId: param(request, "providerServiceId"),
          ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
          ...(query.limit === undefined
            ? {}
            : { limit: Number(query.limit) }),
        });
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 200, result.items, {
          nextCursor: result.nextCursor,
        });
      } catch (error) {
        forward(error, next);
      }
    },
  };
}

/**
 * @desc Create thin Staff Provider Service price-approval HTTP handlers.
 * @access HTTP adapter
 */
export function createStaffProviderServiceController(
  service: StaffProviderServiceHttpService,
) {
  return {
    /**
     * @desc List PENDING Provider service price proposals for Staff.
     * @route GET /api/v1/staff/providers/service-price-proposals
     * @access Staff Admin with providers.services.prices.approve
     * @explanation Pending rows remain listable after policy disable; only
     * fresh decisions recheck current approvalRequired.
     */
    async listPendingPriceProposals(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const actor = principal(response);
        const query = request.query as {
          readonly countryCode?: string;
          readonly cursor?: string;
          readonly limit?: string | number;
        };
        const result = await service.listStaffPendingPriceProposals({
          actorUserId: actor.userId,
          ...(query.countryCode === undefined
            ? {}
            : { countryCode: query.countryCode }),
          ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
          ...(query.limit === undefined
            ? {}
            : { limit: Number(query.limit) }),
        });
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 200, result.items, {
          nextCursor: result.nextCursor,
        });
      } catch (error) {
        forward(error, next);
      }
    },

    /**
     * @desc Read one Staff-safe pending price dossier.
     * @route GET /api/v1/staff/providers/:providerId/services/:providerServiceId/price-proposals/:providerServicePriceId
     * @access Staff Admin with providers.services.prices.approve
     */
    async getPendingPriceDossier(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const actor = principal(response);
        const result = await service.getStaffPendingPriceDossier({
          actorUserId: actor.userId,
          providerId: param(request, "providerId"),
          providerServiceId: param(request, "providerServiceId"),
          providerServicePriceId: param(request, "providerServicePriceId"),
        });
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 200, result);
      } catch (error) {
        forward(error, next);
      }
    },

    /**
     * @desc Approve or reject one PENDING price proposal.
     * @route POST /api/v1/staff/providers/:providerId/services/:providerServiceId/price-proposals/:providerServicePriceId/decisions
     * @access Staff Admin with providers.services.prices.approve
     * @explanation Matching replay returns after authz before fresh policy/
     * version checks. Fresh decisions require current approvalRequired=true.
     */
    async decidePriceProposal(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const actor = principal(response);
        const body = request.body as StaffPriceDecisionBody;
        const result = await service.decidePriceProposal({
          actorUserId: actor.userId,
          providerId: param(request, "providerId"),
          providerServiceId: param(request, "providerServiceId"),
          providerServicePriceId: param(request, "providerServicePriceId"),
          decision: body.decision,
          reason: body.reason,
          expectedVersion: body.expectedVersion,
          requestId: request.requestId,
          idempotencyKey: body.idempotencyKey,
        });
        response.setHeader("Cache-Control", "no-store, private");
        sendSuccess(request, response, 200, result.result, {
          replayed: result.replayed,
        });
      } catch (error) {
        forward(error, next);
      }
    },
  };
}
