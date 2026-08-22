import type { NextFunction, Request, RequestHandler, Response } from "express";

import type { AuthenticationPrincipal } from "../authentication/authentication.public.js";
import { sendSuccess } from "#shared/http/api-response";
import type { ProviderPayoutDestinationService, PayoutDraftInput } from "./provider-payout-destination.service.js";
import type { ProviderPayoutPrimaryService } from "./provider-payout-primary.service.js";
import type { ProviderPayoutHistoryService } from "./provider-payout-history.service.js";
import type { ProviderPayoutRevealService } from "./provider-payout-reveal.service.js";
import type { ProviderPayoutVerificationService } from "./provider-payout-verification.service.js";
import type { ProviderPayoutConflictService } from "./provider-payout-conflict.service.js";
import type { ProviderPayoutReviewQueryService } from "./provider-payout-review-query.service.js";
import { toR1P06HttpError } from "./domain/r1-p06.errors.js";

export interface ProviderPayoutControllerDependencies {
  readonly destinations: ProviderPayoutDestinationService;
  readonly primary: ProviderPayoutPrimaryService;
  readonly history: ProviderPayoutHistoryService;
}
export interface StaffProviderPayoutControllerDependencies {
  readonly reviewQueries: ProviderPayoutReviewQueryService;
  readonly reveal: ProviderPayoutRevealService;
  readonly verification: ProviderPayoutVerificationService;
  readonly conflicts: ProviderPayoutConflictService;
}

function principal(response: Response): AuthenticationPrincipal {
  const value = response.locals["authenticationPrincipal"] as AuthenticationPrincipal | undefined;
  if (value === undefined) throw new Error("AUTHENTICATION_REQUIRED");
  return value;
}
function param(request: Request, key: string): string {
  const value = request.params[key];
  if (typeof value !== "string" || value.length === 0) throw new Error("VALIDATION_ERROR");
  return value;
}
const route = (work: (request: Request, response: Response) => Promise<void>): RequestHandler =>
  (request, response, next: NextFunction) => { void work(request, response).catch((error: unknown) => next(toR1P06HttpError(error))); };

export function createProviderPayoutController(dependencies: ProviderPayoutControllerDependencies) {
  return {
    options: route(async (request, response) => {
      sendSuccess(request, response, 200, await dependencies.destinations.options({ principal: principal(response), providerId: param(request, "providerId") }));
    }),
    list: route(async (request, response) => {
      const page = await dependencies.destinations.list({
        principal: principal(response), providerId: param(request, "providerId"), limit: Number(request.query["limit"] ?? 20),
        ...(typeof request.query["cursor"] === "string" ? { cursor: request.query["cursor"] } : {}),
      });
      sendSuccess(request, response, 200, page.items, { nextCursor: page.nextCursor, primaryStateVersion: page.primaryStateVersion });
    }),
    detail: route(async (request, response) => {
      sendSuccess(request, response, 200, await dependencies.destinations.detail({
        principal: principal(response),
        providerId: param(request, "providerId"),
        destinationVersionId: param(request, "destinationVersionId"),
      }));
    }),
    create: route(async (request, response) => {
      const result = await dependencies.destinations.createDraft({ principal: principal(response), providerId: param(request, "providerId"), requestId: request.requestId, draft: request.body as PayoutDraftInput });
      sendSuccess(request, response, 201, { destinationVersionId: result.row.id, status: result.row.status, version: result.row.version, mask: result.safeMask });
    }),
    update: route(async (request, response) => {
      const body = request.body as PayoutDraftInput & { expectedVersion: number };
      const { expectedVersion, ...draft } = body;
      const result = await dependencies.destinations.updateDraft({
        principal: principal(response),
        providerId: param(request, "providerId"),
        destinationVersionId: param(request, "destinationVersionId"),
        expectedVersion,
        requestId: request.requestId,
        draft: draft as PayoutDraftInput,
      });
      sendSuccess(request, response, 200, { destinationVersionId: result.row.id, status: result.row.status, version: result.row.version, mask: result.safeMask });
    }),
    submit: route(async (request, response) => {
      const result = await dependencies.destinations.submit({ principal: principal(response), providerId: param(request, "providerId"), destinationVersionId: param(request, "destinationVersionId"), ...(request.body as { expectedVersion: number; reauthenticationProof: string; commandId: string }), requestId: request.requestId });
      sendSuccess(request, response, 200, { destinationVersionId: result.id, status: result.status, version: result.version });
    }),
    successor: route(async (request, response) => {
      const body = request.body as PayoutDraftInput & { expectedVersion: number };
      const { expectedVersion, ...draft } = body;
      const result = await dependencies.destinations.createSuccessor({ principal: principal(response), providerId: param(request, "providerId"), predecessorVersionId: param(request, "destinationVersionId"), predecessorExpectedVersion: expectedVersion, requestId: request.requestId, draft });
      sendSuccess(request, response, 201, { destinationVersionId: result.row.id, status: result.row.status, version: result.row.version, mask: result.safeMask });
    }),
    setPrimary: route(async (request, response) => {
      const body = request.body as { destinationVersionId: string; expectedDestinationVersion: number; expectedPrimaryVersion: number; reauthenticationProof: string; commandId: string };
      sendSuccess(request, response, 200, await dependencies.primary.setPrimary({ principal: principal(response), providerId: param(request, "providerId"), ...body, requestId: request.requestId }));
    }),
    remove: route(async (request, response) => {
      sendSuccess(request, response, 200, await dependencies.primary.remove({ principal: principal(response), providerId: param(request, "providerId"), destinationVersionId: param(request, "destinationVersionId"), ...(request.body as Omit<Parameters<ProviderPayoutPrimaryService["remove"]>[0], "principal" | "providerId" | "destinationVersionId" | "requestId">), requestId: request.requestId }));
    }),
    history: route(async (request, response) => {
      const page = await dependencies.history.list(principal(response), param(request, "providerId"), {
        limit: Number(request.query["limit"] ?? 20),
        ...(typeof request.query["cursor"] === "string" ? { cursor: request.query["cursor"] } : {}),
      });
      sendSuccess(request, response, 200, page.items, { nextCursor: page.nextCursor });
    }),
  };
}

export function createStaffProviderPayoutController(dependencies: StaffProviderPayoutControllerDependencies) {
  return {
    queue: route(async (request, response) => {
      const actor = principal(response);
      const page = await dependencies.reviewQueries.listQueue({
        actorUserId: actor.userId,
        requestId: request.requestId,
        limit: Number(request.query["limit"] ?? 20),
        ...(typeof request.query["cursor"] === "string" ? { cursor: request.query["cursor"] } : {}),
      });
      sendSuccess(request, response, 200, page.items, { nextCursor: page.nextCursor });
    }),
    dossier: route(async (request, response) => {
      const actor = principal(response);
      sendSuccess(request, response, 200, await dependencies.reviewQueries.dossier({
        actorUserId: actor.userId,
        providerId: param(request, "providerId"),
        destinationVersionId: param(request, "destinationVersionId"),
        requestId: request.requestId,
      }));
    }),
    reveal: route(async (request, response) => {
      const actor = principal(response);
      const result = await dependencies.reveal.reveal({ actorUserId: actor.userId, sessionId: actor.sessionId, providerId: param(request, "providerId"), destinationVersionId: param(request, "destinationVersionId"), ...(request.body as { expectedVersion: number; purpose: "MANUAL_PAYOUT_DESTINATION_VERIFICATION"; reason: string; stepUpProof: string; commandId: string }), requestId: request.requestId });
      response.setHeader("Cache-Control", "no-store, private");
      response.setHeader("Pragma", "no-cache");
      sendSuccess(request, response, 200, result);
    }),
    decide: route(async (request, response) => {
      const result = await dependencies.verification.decide({ actorUserId: principal(response).userId, providerId: param(request, "providerId"), destinationVersionId: param(request, "destinationVersionId"), ...(request.body as Omit<Parameters<ProviderPayoutVerificationService["decide"]>[0], "actorUserId" | "providerId" | "destinationVersionId" | "requestId">), requestId: request.requestId });
      sendSuccess(request, response, 200, { decisionId: result.id, outcome: result.outcome, decidedAt: result.decidedAt.toISOString() });
    }),
    conflicts: route(async (request, response) => {
      const page = await dependencies.conflicts.list(principal(response).userId, {
        limit: Number(request.query["limit"] ?? 20),
        ...(typeof request.query["cursor"] === "string" ? { cursor: request.query["cursor"] } : {}),
      });
      sendSuccess(request, response, 200, page.items, { nextCursor: page.nextCursor });
    }),
    resolveConflict: route(async (request, response) => {
      sendSuccess(request, response, 200, await dependencies.conflicts.resolve({ actorUserId: principal(response).userId, providerId: param(request, "providerId"), conflictId: param(request, "conflictId"), ...(request.body as Omit<Parameters<ProviderPayoutConflictService["resolve"]>[0], "actorUserId" | "providerId" | "conflictId" | "requestId">), requestId: request.requestId }));
    }),
  };
}
