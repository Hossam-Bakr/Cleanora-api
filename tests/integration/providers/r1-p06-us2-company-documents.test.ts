import { ProviderDocumentService } from "../../../src/modules/providers/provider-document.service.js";
import {
  documentDecisionBody,
  documentEvidenceOrderBody,
  documentHistoryQuery,
  documentPolicyDraftBody,
  documentPolicyPublishBody,
  documentVersionParams,
  verificationDocumentDraftBody,
  verificationDocumentUpdateBody,
} from "../../../src/modules/providers/provider-verification.schema.js";
import { buildDocumentDraft, R1_P06_IDS } from "../../helpers/r1-p06-fixtures.js";

const principal = { userId: R1_P06_IDS.ownerUserId, sessionId: R1_P06_IDS.sessionId, accountCategories: [], verifiedCategories: [], pendingCategories: [], status: "ACTIVE" as const, verificationOnly: false };
const now = new Date("2026-08-14T10:00:00.000Z");

function documentHarness() {
  const access = {
    applicationStatus: "APPROVED",
    kind: "REGISTERED_COMPANY",
    profile: { country: { id: "country-eg", code: "EG", isActive: true } },
    members: [{ level: "OWNER", status: "ACTIVE" }],
  };
  const policy = {
    id: "policy-r1p06",
    items: [{
      id: "policy-item-commercial-registration",
      isRequired: true,
      fieldRules: { expiryRequired: false },
      documentType: { code: "COMMERCIAL_REGISTRATION" },
    }],
  };
  const evidence = {
    id: "evidence-r1p06",
    mediaFileId: "media-r1p06",
    canonicalContentType: "image/jpeg",
    byteSize: 123,
    position: 0,
    pageCount: null,
  };
  const document = {
    id: R1_P06_IDS.documentVersionId,
    providerId: R1_P06_IDS.providerId,
    status: "DRAFT",
    version: 1,
    issueDate: new Date("2026-08-01T00:00:00.000Z"),
    expiresAt: null,
    chain: { documentType: { code: "COMMERCIAL_REGISTRATION" } },
    evidence: [evidence],
  };
  const receipt = {
    mediaFileId: evidence.mediaFileId,
    providerId: R1_P06_IDS.providerId,
    documentVersionId: R1_P06_IDS.documentVersionId,
    state: "READY",
    canonicalContentType: "image/jpeg",
    byteSize: evidence.byteSize,
    pageCount: null,
    safeReceiptId: "receipt-r1p06",
  };
  const repository = {
    readProviderAccess: vi.fn().mockResolvedValue(access),
    readEffectivePolicy: vi.fn().mockResolvedValue(policy),
    createDraft: vi.fn().mockResolvedValue(document),
    updateDraft: vi.fn().mockResolvedValue({ ...document, version: 2 }),
    readDocument: vi.fn().mockResolvedValue(document),
    bindEvidence: vi.fn().mockResolvedValue({ ...document, version: 2 }),
    removeEvidence: vi.fn().mockResolvedValue(evidence),
    reorderEvidence: vi.fn().mockResolvedValue({ ...document, version: 2 }),
    findDocumentSubmitReplay: vi.fn().mockResolvedValue(null),
    submitDocument: vi.fn().mockResolvedValue({ ...document, status: "SUBMITTED", version: 2 }),
    createSuccessor: vi.fn().mockResolvedValue({ ...document, id: "document-successor", version: 1 }),
  };
  const media = {
    reserve: vi.fn().mockResolvedValue({ mediaFileId: evidence.mediaFileId, uploadUrl: "https://invalid.example/upload" }),
    readValidationReceipt: vi.fn().mockResolvedValue(receipt),
    ingest: vi.fn().mockResolvedValue(receipt),
    requestCleanup: vi.fn().mockResolvedValue(undefined),
  };
  const service = new ProviderDocumentService(repository as never, media as never, () => now);
  return { service, repository, media, access, policy, document, receipt, evidence };
}

describe("R1-P06 US2 company document orchestration", () => {
  it("validates strict document, policy, history, and meaningful Staff-decision contracts", () => {
    expect(verificationDocumentDraftBody.parse(buildDocumentDraft())).toMatchObject({ countryCode: "EG", typeCode: "COMMERCIAL_REGISTRATION" });
    const { typeCode: _typeCode, ...documentUpdate } = buildDocumentDraft();
    expect(verificationDocumentUpdateBody.parse({ ...documentUpdate, expectedVersion: 1 })).not.toHaveProperty("typeCode");
    expect(documentVersionParams.parse({ providerId: "provider-1", documentVersionId: "document-1" })).toBeTruthy();
    expect(documentEvidenceOrderBody.parse({ evidenceIds: ["evidence-1"], expectedVersion: 1, commandId: R1_P06_IDS.commandId })).toBeTruthy();
    expect(documentHistoryQuery.parse({ limit: "100" })).toEqual({ limit: 100 });
    expect(documentDecisionBody.parse({ outcome: "APPROVE", reason: "Verified against the authoritative registry", expectedVersion: 2, commandId: R1_P06_IDS.commandId })).toBeTruthy();
    expect(() => documentDecisionBody.parse({ outcome: "APPROVE", reason: "short", expectedVersion: 2, commandId: R1_P06_IDS.commandId })).toThrow();
    expect(() => documentDecisionBody.parse({ outcome: "APPROVE", reason: "Unsafe note\nwith control", expectedVersion: 2, commandId: R1_P06_IDS.commandId })).toThrow();

    const fieldRules = {
      schemaVersion: 1 as const,
      requiredMetadata: ["countryCode", "documentNumber", "legalName", "issuerName", "issueDate"] as const,
      issueDate: "NOT_FUTURE" as const,
      expiresAt: "OPTIONAL_AFTER_ISSUE_DATE" as const,
      evidence: ["PDF", "IMAGE_SET"] as const,
    };
    const policyDraft = {
      countryCode: "EG",
      providerKind: "REGISTERED_COMPANY",
      effectiveAt: now,
      commandId: R1_P06_IDS.commandId,
      items: [{ documentTypeCode: "COMMERCIAL_REGISTRATION", isRequired: true, isActive: true, position: 0, fieldRules }],
    };
    expect(documentPolicyDraftBody.parse(policyDraft)).toMatchObject({ countryCode: "EG" });
    expect(documentPolicyPublishBody.parse({ expectedVersion: 1, reason: "Publishing the approved verification policy", commandId: R1_P06_IDS.commandId })).toBeTruthy();
  });

  it("creates and updates a country-policy draft with canonical dates and command correlation", async () => {
    const { service, repository } = documentHarness();
    await service.createDraft({
      principal,
      providerId: R1_P06_IDS.providerId,
      requestId: "request-document-create",
      ...buildDocumentDraft(),
    });
    expect(repository.readEffectivePolicy).toHaveBeenCalledWith({ countryId: "country-eg", providerKind: "REGISTERED_COMPANY", now });
    expect(repository.createDraft).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: R1_P06_IDS.ownerUserId,
      requestId: "request-document-create",
      issueDate: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: null,
      now,
    }));

    await service.updateDraft({
      principal,
      providerId: R1_P06_IDS.providerId,
      documentVersionId: R1_P06_IDS.documentVersionId,
      countryCode: "EG",
      documentNumber: "UPDATED-DOCUMENT-NUMBER",
      legalName: "R1P06 Synthetic Company",
      issuerName: "R1P06 Synthetic Authority",
      issueDate: "2026-02-01",
      expiresAt: "2027-02-01",
      expectedVersion: 1,
      commandId: R1_P06_IDS.commandId,
      requestId: "request-document-update",
    });
    expect(repository.updateDraft).toHaveBeenCalledWith(expect.objectContaining({
      expectedVersion: 1,
      requestId: "request-document-update",
      issueDate: new Date("2026-02-01T00:00:00.000Z"),
      expiresAt: new Date("2027-02-01T00:00:00.000Z"),
    }));
  });

  it("reads exact-Provider detail and reserves JPEG evidence only for the exact draft version", async () => {
    const { service, repository, media, document } = documentHarness();
    await expect(service.getDetail({ principal, providerId: R1_P06_IDS.providerId, documentVersionId: R1_P06_IDS.documentVersionId }))
      .resolves.toBe(document);
    await service.reserveEvidence({
      principal,
      providerId: R1_P06_IDS.providerId,
      documentVersionId: R1_P06_IDS.documentVersionId,
      originalExtension: ".jpg",
      declaredContentType: "image/jpeg",
      byteSize: 123,
      expectedVersion: 1,
    });
    expect(media.reserve).toHaveBeenCalledWith(expect.objectContaining({
      ownerUserId: R1_P06_IDS.ownerUserId,
      originalExtension: ".jpg",
      declaredContentType: "image/jpeg",
    }));

    repository.readDocument.mockResolvedValueOnce({ ...document, version: 2 });
    await expect(service.reserveEvidence({
      principal,
      providerId: R1_P06_IDS.providerId,
      documentVersionId: R1_P06_IDS.documentVersionId,
      originalExtension: ".jpeg",
      declaredContentType: "image/jpeg",
      byteSize: 123,
      expectedVersion: 1,
    })).rejects.toThrow("DOCUMENT_VERSION_CONFLICT");
  });

  it("ingests, binds, reorders, and removes evidence with cleanup ownership", async () => {
    const { service, repository, media } = documentHarness();
    await expect(service.ingestEvidence({
      principal,
      providerId: R1_P06_IDS.providerId,
      documentVersionId: R1_P06_IDS.documentVersionId,
      originalExtension: ".jpg",
      declaredContentType: "image/jpeg",
      bytes: Buffer.from("synthetic-jpeg"),
      position: 0,
      expectedVersion: 1,
      commandId: R1_P06_IDS.commandId,
      requestId: "request-document-ingest",
    })).resolves.toMatchObject({ receipt: { state: "READY" }, document: { version: 2 } });
    expect(repository.bindEvidence).toHaveBeenCalledWith(expect.objectContaining({
      canonicalContentType: "image/jpeg",
      requestId: "request-document-ingest",
    }));

    await service.reorderEvidence({
      principal,
      providerId: R1_P06_IDS.providerId,
      documentVersionId: R1_P06_IDS.documentVersionId,
      evidenceIds: ["evidence-r1p06"],
      expectedVersion: 2,
      commandId: R1_P06_IDS.commandId,
      requestId: "request-document-reorder",
    });
    expect(repository.reorderEvidence).toHaveBeenCalledWith(expect.objectContaining({ evidenceIds: ["evidence-r1p06"], expectedVersion: 2 }));

    await service.removeEvidence({
      principal,
      providerId: R1_P06_IDS.providerId,
      documentVersionId: R1_P06_IDS.documentVersionId,
      evidenceId: "evidence-r1p06",
      expectedVersion: 2,
      commandId: R1_P06_IDS.commandId,
      requestId: "request-document-remove",
    });
    expect(media.requestCleanup).toHaveBeenCalledWith({ mediaFileId: "media-r1p06", safeReasonCode: "PROVIDER_DOCUMENT_EVIDENCE_REMOVED" });
  });

  it("compensates a successful media ingest when optimistic binding loses a race", async () => {
    const { service, repository, media } = documentHarness();
    repository.bindEvidence.mockRejectedValueOnce(new Error("DOCUMENT_VERSION_CONFLICT"));
    await expect(service.ingestEvidence({
      principal,
      providerId: R1_P06_IDS.providerId,
      documentVersionId: R1_P06_IDS.documentVersionId,
      originalExtension: ".jpg",
      declaredContentType: "image/jpeg",
      bytes: Buffer.from("synthetic-jpeg"),
      position: 0,
      expectedVersion: 1,
      commandId: R1_P06_IDS.commandId,
      requestId: "request-bind-race",
    })).rejects.toThrow("DOCUMENT_VERSION_CONFLICT");
    expect(media.requestCleanup).toHaveBeenCalledWith({ mediaFileId: "media-r1p06", safeReasonCode: "PROVIDER_DOCUMENT_BIND_FAILED" });
  });

  it("submits a complete READY image set under the captured policy and returns exact retries", async () => {
    const { service, repository, document } = documentHarness();
    await service.submit({
      principal,
      providerId: R1_P06_IDS.providerId,
      documentVersionId: R1_P06_IDS.documentVersionId,
      expectedVersion: 1,
      commandId: R1_P06_IDS.commandId,
      requestId: "request-document-submit",
    });
    expect(repository.submitDocument).toHaveBeenCalledWith(expect.objectContaining({
      policyVersionId: "policy-r1p06",
      policyItemId: "policy-item-commercial-registration",
      policyRuleSnapshot: { expiryRequired: false },
      evidenceFormat: "IMAGE_SET",
      expectedVersion: 1,
      requestId: "request-document-submit",
      now,
    }));

    repository.findDocumentSubmitReplay.mockResolvedValueOnce({ ...document, status: "SUBMITTED" });
    await service.submit({
      principal,
      providerId: R1_P06_IDS.providerId,
      documentVersionId: R1_P06_IDS.documentVersionId,
      expectedVersion: 1,
      commandId: R1_P06_IDS.commandId,
      requestId: "request-document-submit",
    });
    expect(repository.submitDocument).toHaveBeenCalledTimes(1);
  });

  it("creates a successor only from an eligible terminal or effective predecessor", async () => {
    const { service, repository, document } = documentHarness();
    repository.readDocument.mockResolvedValueOnce({ ...document, status: "APPROVED" });
    await service.createSuccessor({
      principal,
      providerId: R1_P06_IDS.providerId,
      predecessorVersionId: R1_P06_IDS.documentVersionId,
      expectedVersion: 3,
      commandId: R1_P06_IDS.commandId,
      requestId: "request-document-successor",
    });
    expect(repository.createSuccessor).toHaveBeenCalledWith(expect.objectContaining({
      predecessorVersionId: R1_P06_IDS.documentVersionId,
      expectedVersion: 3,
      actorUserId: R1_P06_IDS.ownerUserId,
    }));

    repository.readDocument.mockResolvedValueOnce({ ...document, status: "SUBMITTED" });
    await expect(service.createSuccessor({
      principal,
      providerId: R1_P06_IDS.providerId,
      predecessorVersionId: R1_P06_IDS.documentVersionId,
      expectedVersion: 3,
      commandId: R1_P06_IDS.commandId,
      requestId: "request-ineligible-successor",
    })).rejects.toThrow("DOCUMENT_STATE_CONFLICT");
  });

  it("fails closed for foreign country, invalid dates, ineligible Provider type, and unauthorized members", async () => {
    const foreign = documentHarness();
    await expect(foreign.service.createDraft({
      principal,
      providerId: R1_P06_IDS.providerId,
      requestId: "request-foreign-document",
      ...buildDocumentDraft({ countryCode: "SA" }),
    })).rejects.toThrow("VERIFICATION_POLICY_NOT_FOUND");

    const invalidDate = documentHarness();
    await expect(invalidDate.service.createDraft({
      principal,
      providerId: R1_P06_IDS.providerId,
      requestId: "request-invalid-date",
      ...buildDocumentDraft({ issueDate: "2027-01-01" }),
    })).rejects.toThrow("DOCUMENT_METADATA_INVALID");

    const wrongKind = documentHarness();
    wrongKind.repository.readProviderAccess.mockResolvedValueOnce({ ...wrongKind.access, kind: "INDIVIDUAL" });
    await expect(wrongKind.service.getDetail({ principal, providerId: R1_P06_IDS.providerId, documentVersionId: R1_P06_IDS.documentVersionId }))
      .rejects.toThrow("VERIFICATION_POLICY_NOT_FOUND");

    const denied = documentHarness();
    denied.repository.readProviderAccess.mockResolvedValueOnce({ ...denied.access, members: [{ level: "MEMBER", status: "ACTIVE" }] });
    await expect(denied.service.getDetail({ principal, providerId: R1_P06_IDS.providerId, documentVersionId: R1_P06_IDS.documentVersionId }))
      .rejects.toThrow("PROVIDER_SCOPE_DENIED");
  });

  it("re-reads READY Media receipt before binding evidence", async () => {
    const repository = {
      readProviderAccess: vi.fn().mockResolvedValue({ applicationStatus: "APPROVED", kind: "REGISTERED_COMPANY", profile: { country: { id: "eg", code: "EG", isActive: true } }, members: [{ level: "OWNER", status: "ACTIVE" }] }),
      bindEvidence: vi.fn().mockResolvedValue({ id: "document", version: 2 }),
    };
    const media = { readValidationReceipt: vi.fn().mockResolvedValue({ mediaFileId: "media", providerId: "provider", documentVersionId: "document", state: "READY", canonicalContentType: "image/jpeg", byteSize: 123, pageCount: null, safeReceiptId: "receipt" }) };
    const service = new ProviderDocumentService(repository as never, media as never);
    await service.bindReadyEvidence({ principal, providerId: "provider", documentVersionId: "document", mediaFileId: "media", position: 0, expectedVersion: 1, commandId: R1_P06_IDS.commandId, requestId: "request-document-evidence-bind" });
    expect(media.readValidationReceipt).toHaveBeenCalledWith("media");
    expect(repository.bindEvidence).toHaveBeenCalledWith(expect.objectContaining({
      canonicalContentType: "image/jpeg",
      expectedVersion: 1,
      commandId: R1_P06_IDS.commandId,
      requestId: "request-document-evidence-bind",
    }));
  });

  it("rejects a READY receipt reserved for another Provider document", async () => {
    const repository = {
      readProviderAccess: vi.fn().mockResolvedValue({ applicationStatus: "APPROVED", kind: "REGISTERED_COMPANY", profile: { country: { id: "eg", code: "EG", isActive: true } }, members: [{ level: "OWNER", status: "ACTIVE" }] }),
      bindEvidence: vi.fn(),
    };
    const media = { readValidationReceipt: vi.fn().mockResolvedValue({ mediaFileId: "media", providerId: "other-provider", documentVersionId: "other-document", state: "READY", canonicalContentType: "image/jpeg", byteSize: 123, pageCount: null, safeReceiptId: "receipt" }) };
    const service = new ProviderDocumentService(repository as never, media as never);
    await expect(service.bindReadyEvidence({ principal, providerId: "provider", documentVersionId: "document", mediaFileId: "media", position: 0, expectedVersion: 1, commandId: R1_P06_IDS.commandId, requestId: "request-document-evidence-bind" })).rejects.toThrow("DOCUMENT_EVIDENCE_NOT_READY");
    expect(repository.bindEvidence).not.toHaveBeenCalled();
  });

  it("fails closed while evidence is still processing", async () => {
    const repository = { readProviderAccess: vi.fn().mockResolvedValue({ applicationStatus: "APPROVED", kind: "REGISTERED_COMPANY", profile: { country: { id: "eg", code: "EG", isActive: true } }, members: [{ level: "ADMIN", status: "ACTIVE" }] }) };
    const media = { readValidationReceipt: vi.fn().mockResolvedValue({ state: "PROCESSING" }) };
    const service = new ProviderDocumentService(repository as never, media as never);
    await expect(service.bindReadyEvidence({ principal, providerId: "provider", documentVersionId: "document", mediaFileId: "media", position: 0, expectedVersion: 1, commandId: R1_P06_IDS.commandId, requestId: "request-document-evidence-bind" })).rejects.toThrow("DOCUMENT_EVIDENCE_NOT_READY");
  });
});
