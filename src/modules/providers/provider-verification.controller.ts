import type { NextFunction, Request, RequestHandler, Response } from "express";

import type { AuthenticationPrincipal } from "../authentication/authentication.public.js";
import { sendSuccess } from "#shared/http/api-response";
import type { ProviderDocumentService } from "./provider-document.service.js";
import type { ProviderDocumentReviewService } from "./provider-document-review.service.js";
import type { ProviderDocumentReviewQueryService } from "./provider-document-review-query.service.js";
import type { ProviderDocumentPolicyService } from "./provider-document-policy.service.js";
import type { ProviderVerificationHistoryService } from "./provider-verification-history.service.js";
import type { ProviderVerificationQueryService } from "./provider-verification-query.service.js";
import { toR1P06HttpError } from "./domain/r1-p06.errors.js";

export interface ProviderVerificationControllerDependencies {
  readonly documents: ProviderDocumentService;
  readonly history: ProviderVerificationHistoryService;
  readonly queries: ProviderVerificationQueryService;
}

export interface StaffProviderVerificationControllerDependencies {
  readonly reviews: ProviderDocumentReviewService;
  readonly reviewQueries: ProviderDocumentReviewQueryService;
  readonly policies: ProviderDocumentPolicyService;
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

export function createProviderVerificationController(dependencies: ProviderVerificationControllerDependencies) {
  return {
    getOverview: route(async (request, response) => {
      sendSuccess(request, response, 200, await dependencies.queries.overview(
        principal(response),
        param(request, "providerId"),
      ));
    }),
    getRequirements: route(async (request, response) => {
      sendSuccess(request, response, 200, await dependencies.queries.requirements(
        principal(response),
        param(request, "providerId"),
      ));
    }),
    listDocuments: route(async (request, response) => {
      const page = await dependencies.queries.listDocuments(
        principal(response),
        param(request, "providerId"),
        {
          limit: Number(request.query["limit"] ?? 20),
          ...(typeof request.query["cursor"] === "string" ? { cursor: request.query["cursor"] } : {}),
        },
      );
      sendSuccess(request, response, 200, page.items, { nextCursor: page.nextCursor });
    }),
    getDocument: route(async (request, response) => {
      const row = await dependencies.documents.getDetail({
        principal: principal(response),
        providerId: param(request, "providerId"),
        documentVersionId: param(request, "documentVersionId"),
      });
      sendSuccess(request, response, 200, {
        documentVersionId: row.id,
        chainId: row.chainId,
        typeCode: row.chain.documentType.code,
        sequence: row.sequence,
        status: row.status,
        countryCode: row.countryCode,
        documentNumber: row.documentNumber,
        legalName: row.legalName,
        issuerName: row.issuerName,
        issueDate: row.issueDate.toISOString().slice(0, 10),
        expiresAt: row.expiresAt?.toISOString().slice(0, 10) ?? null,
        evidence: row.evidence.map((item) => ({
          evidenceId: item.id,
          contentType: item.canonicalContentType,
          byteSize: item.byteSize,
          pageCount: item.pageCount,
          position: item.position,
        })),
        version: row.version,
      });
    }),
    updateDocument: route(async (request, response) => {
      const result = await dependencies.documents.updateDraft({
        principal: principal(response),
        providerId: param(request, "providerId"),
        documentVersionId: param(request, "documentVersionId"),
        ...(request.body as Omit<Parameters<ProviderDocumentService["updateDraft"]>[0], "principal" | "providerId" | "documentVersionId" | "requestId">),
        requestId: request.requestId,
      });
      sendSuccess(request, response, 200, { documentVersionId: result.id, status: result.status, version: result.version });
    }),
    addEvidence: route(async (request, response) => {
      if (request.file === undefined) throw new Error("DOCUMENT_EVIDENCE_INVALID");
      const extension = request.file.originalname.toLowerCase().match(/\.(pdf|jpe?g|png)$/u)?.[0];
      if (extension === undefined) throw new Error("DOCUMENT_EVIDENCE_INVALID");
      const result = await dependencies.documents.ingestEvidence({
        principal: principal(response),
        providerId: param(request, "providerId"),
        documentVersionId: param(request, "documentVersionId"),
        originalExtension: extension as ".pdf" | ".jpg" | ".jpeg" | ".png",
        declaredContentType: request.file.mimetype,
        bytes: request.file.buffer,
        ...(request.body as { position: number; expectedVersion: number; commandId: string }),
        requestId: request.requestId,
      });
      sendSuccess(request, response, 202, {
        evidenceId: result.document.evidence.find((item) => item.mediaFileId === result.receipt.mediaFileId)?.id,
        mediaFileId: result.receipt.mediaFileId,
        state: result.receipt.state,
        contentType: result.receipt.canonicalContentType,
        version: result.document.version,
      });
    }),
    removeEvidence: route(async (request, response) => {
      const result = await dependencies.documents.removeEvidence({
        principal: principal(response),
        providerId: param(request, "providerId"),
        documentVersionId: param(request, "documentVersionId"),
        evidenceId: param(request, "evidenceId"),
        ...(request.body as { expectedVersion: number; commandId: string }),
        requestId: request.requestId,
      });
      sendSuccess(request, response, 200, { version: result.version });
    }),
    reorderEvidence: route(async (request, response) => {
      const result = await dependencies.documents.reorderEvidence({
        principal: principal(response),
        providerId: param(request, "providerId"),
        documentVersionId: param(request, "documentVersionId"),
        ...(request.body as { evidenceIds: string[]; expectedVersion: number; commandId: string }),
        requestId: request.requestId,
      });
      sendSuccess(request, response, 200, result);
    }),
    createDocument: route(async (request, response) => {
      const result = await dependencies.documents.createDraft({ principal: principal(response), providerId: param(request, "providerId"), ...(request.body as Omit<Parameters<ProviderDocumentService["createDraft"]>[0], "principal" | "providerId" | "requestId">), requestId: request.requestId });
      sendSuccess(request, response, 201, { documentVersionId: result.id, status: result.status, version: result.version });
    }),
    submitDocument: route(async (request, response) => {
      const result = await dependencies.documents.submit({ principal: principal(response), providerId: param(request, "providerId"), documentVersionId: param(request, "documentVersionId"), ...(request.body as { expectedVersion: number; commandId: string }), requestId: request.requestId });
      sendSuccess(request, response, 200, { documentVersionId: result.id, status: result.status, version: result.version });
    }),
    createSuccessor: route(async (request, response) => {
      const result = await dependencies.documents.createSuccessor({ principal: principal(response), providerId: param(request, "providerId"), predecessorVersionId: param(request, "documentVersionId"), ...(request.body as { expectedVersion: number; commandId: string }), requestId: request.requestId });
      sendSuccess(request, response, 201, { documentVersionId: result.id, predecessorVersionId: result.predecessorVersionId, status: result.status, version: result.version });
    }),
    listHistory: route(async (request, response) => {
      const page = await dependencies.history.list(principal(response), param(request, "providerId"), {
        limit: Number(request.query["limit"] ?? 20),
        ...(typeof request.query["cursor"] === "string" ? { cursor: request.query["cursor"] } : {}),
      });
      sendSuccess(request, response, 200, page.items, { nextCursor: page.nextCursor });
    }),
  };
}

export function createStaffProviderVerificationController(dependencies: StaffProviderVerificationControllerDependencies) {
  return {
    listQueue: route(async (request, response) => {
      const page = await dependencies.reviewQueries.listQueue(principal(response).userId, {
        limit: Number(request.query["limit"] ?? 20),
        ...(typeof request.query["cursor"] === "string" ? { cursor: request.query["cursor"] } : {}),
      });
      sendSuccess(request, response, 200, page.items.map((row) => ({ id: row.id, providerId: row.providerId, typeCode: row.chain.documentType.code, status: row.status, version: row.version, submittedAt: row.submittedAt?.toISOString() ?? null })), { nextCursor: page.nextCursor });
    }),
    decide: route(async (request, response) => {
      const result = await dependencies.reviews.decide({ actorUserId: principal(response).userId, providerId: param(request, "providerId"), documentVersionId: param(request, "documentVersionId"), ...(request.body as { outcome: "APPROVE" | "REJECT" | "REQUEST_REPLACEMENT" | "INVALIDATE"; reason: string; expectedVersion: number; commandId: string }), requestId: request.requestId });
      sendSuccess(request, response, 200, { decisionId: result.id, outcome: result.outcome, decidedAt: result.decidedAt.toISOString() });
    }),
    dossier: route(async (request, response) => {
      sendSuccess(request, response, 200, await dependencies.reviewQueries.dossier({
        actorUserId: principal(response).userId,
        providerId: param(request, "providerId"),
        documentVersionId: param(request, "documentVersionId"),
      }));
    }),
    listTypes: route(async (request, response) => {
      sendSuccess(request, response, 200, await dependencies.policies.listTypes(principal(response).userId));
    }),
    listPolicies: route(async (request, response) => {
      const page = await dependencies.policies.list(principal(response).userId, {
        limit: Number(request.query["limit"] ?? 20),
        ...(typeof request.query["cursor"] === "string" ? { cursor: request.query["cursor"] } : {}),
      });
      sendSuccess(request, response, 200, page.items, { nextCursor: page.nextCursor });
    }),
    replacePolicy: route(async (request, response) => {
      const result = await dependencies.policies.replaceDraft({
        actorUserId: principal(response).userId,
        policyVersionId: param(request, "policyVersionId"),
        ...(request.body as Omit<Parameters<ProviderDocumentPolicyService["replaceDraft"]>[0], "actorUserId" | "policyVersionId">),
      });
      sendSuccess(request, response, 200, result);
    }),
    createPolicy: route(async (request, response) => {
      const result = await dependencies.policies.createDraft({ actorUserId: principal(response).userId, ...(request.body as Omit<Parameters<ProviderDocumentPolicyService["createDraft"]>[0], "actorUserId">) });
      sendSuccess(request, response, 201, result);
    }),
    publishPolicy: route(async (request, response) => {
      const body = request.body as { expectedVersion: number; reason: string; commandId: string };
      const result = await dependencies.policies.publish({ actorUserId: principal(response).userId, policyVersionId: param(request, "policyVersionId"), expectedVersion: body.expectedVersion, reason: body.reason, commandId: body.commandId });
      sendSuccess(request, response, 200, result);
    }),
  };
}
