import { ProviderDocumentReviewService } from "../../../src/modules/providers/provider-document-review.service.js";
import { PrismaProviderVerificationRepository } from "../../../src/modules/providers/infrastructure/prisma-provider-verification.repository.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("R1-P06 US3 document review", () => {
  it("requires capability and meaningful reason before the exact decision write", async () => {
    const evidence = { id: "evidence-1", mediaFileId: "media-1", canonicalContentType: "application/pdf", byteSize: 100, pageCount: 1 };
    const repository = {
      decideDocument: vi.fn().mockResolvedValue({ id: "decision" }),
      findDocumentDecisionReplay: vi.fn().mockResolvedValue(null),
      readDocument: vi.fn().mockResolvedValue({ status: "SUBMITTED", version: 2, expiresAt: null, documentNumber: "DOC-001", legalName: "Synthetic Company", issuerName: "Registry Authority", evidence: [evidence] }),
    };
    const media = {
      readValidationReceipt: vi.fn().mockResolvedValue({ mediaFileId: "media-1", providerId: "provider", documentVersionId: "document", state: "READY", canonicalContentType: "application/pdf", byteSize: 100, pageCount: 1, safeReceiptId: "receipt-1" }),
    };
    const allowed = new ProviderDocumentReviewService(repository as never, media as never, async () => true);
    await allowed.decide({ actorUserId: "staff", providerId: "provider", documentVersionId: "document", outcome: "APPROVE", reason: "Verified against the submitted authoritative evidence", expectedVersion: 2, commandId: "command", requestId: "request" });
    expect(repository.decideDocument).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: 2, outcome: "APPROVE" }));
    const denied = new ProviderDocumentReviewService(repository as never, media as never, async () => false);
    await expect(denied.decide({ actorUserId: "provider-owner", providerId: "provider", documentVersionId: "document", outcome: "APPROVE", reason: "Verified against the submitted authoritative evidence", expectedVersion: 2, commandId: "command", requestId: "request" })).rejects.toThrow("PROVIDER_SCOPE_DENIED");
  });

  it("fails closed when submitted evidence is no longer READY", async () => {
    const repository = {
      decideDocument: vi.fn(),
      findDocumentDecisionReplay: vi.fn().mockResolvedValue(null),
      readDocument: vi.fn().mockResolvedValue({
        status: "SUBMITTED",
        version: 2,
        expiresAt: null,
        documentNumber: "DOC-001",
        legalName: "Synthetic Company",
        issuerName: "Registry Authority",
        evidence: [{ id: "evidence-1", mediaFileId: "media-1", canonicalContentType: "application/pdf", byteSize: 100, pageCount: 1 }],
      }),
    };
    const media = { readValidationReceipt: vi.fn().mockResolvedValue({ mediaFileId: "media-1", providerId: "provider", documentVersionId: "document", state: "FAILED", canonicalContentType: "application/pdf", byteSize: 100, pageCount: 1, safeReceiptId: "receipt-1" }) };
    const service = new ProviderDocumentReviewService(repository as never, media as never, async () => true);
    await expect(service.decide({ actorUserId: "staff", providerId: "provider", documentVersionId: "document", outcome: "APPROVE", reason: "Verified against the submitted authoritative evidence", expectedVersion: 2, commandId: "command", requestId: "request" })).rejects.toThrow("DOCUMENT_EVIDENCE_NOT_READY");
    expect(repository.decideDocument).not.toHaveBeenCalled();
  });

  it("allows a safe rejection when evidence is no longer usable", async () => {
    const repository = {
      decideDocument: vi.fn().mockResolvedValue({ id: "decision", outcome: "REJECT" }),
      findDocumentDecisionReplay: vi.fn().mockResolvedValue(null),
      readDocument: vi.fn().mockResolvedValue({
        status: "SUBMITTED",
        version: 2,
        expiresAt: null,
        documentNumber: "DOC-001",
        legalName: "Synthetic Company",
        issuerName: "Registry Authority",
        evidence: [{ id: "evidence-1", mediaFileId: "media-1", canonicalContentType: "application/pdf", byteSize: 100, pageCount: 1 }],
      }),
    };
    const media = { readValidationReceipt: vi.fn() };
    const service = new ProviderDocumentReviewService(repository as never, media as never, async () => true);
    await expect(service.decide({
      actorUserId: "staff",
      providerId: "provider",
      documentVersionId: "document",
      outcome: "REJECT",
      reason: "Submitted evidence is no longer readable and must be replaced",
      expectedVersion: 2,
      commandId: "command",
      requestId: "request",
    })).resolves.toEqual({ id: "decision", outcome: "REJECT" });
    expect(media.readValidationReceipt).not.toHaveBeenCalled();
    expect(repository.decideDocument).toHaveBeenCalledWith(expect.objectContaining({ outcome: "REJECT" }));
  });

  it("returns a matching replay before re-reading now-terminal evidence", async () => {
    const prior = { id: "review-1", outcome: "APPROVE" };
    const repository = {
      findDocumentDecisionReplay: vi.fn().mockResolvedValue(prior),
      readDocument: vi.fn(),
      decideDocument: vi.fn(),
    };
    const service = new ProviderDocumentReviewService(repository as never, {} as never, async () => true);
    await expect(service.decide({ actorUserId: "staff", providerId: "provider", documentVersionId: "document", outcome: "APPROVE", reason: "Verified against the submitted authoritative evidence", expectedVersion: 2, commandId: "command", requestId: "request" })).resolves.toBe(prior);
    expect(repository.readDocument).not.toHaveBeenCalled();
    expect(repository.decideDocument).not.toHaveBeenCalled();
  });

  it("rejects decision text that copies private document metadata", async () => {
    const repository = {
      findDocumentDecisionReplay: vi.fn().mockResolvedValue(null),
      readDocument: vi.fn().mockResolvedValue({
        status: "SUBMITTED",
        version: 2,
        expiresAt: null,
        documentNumber: "PRIVATE-DOCUMENT-7788",
        legalName: "Synthetic Company",
        issuerName: "Registry Authority",
        evidence: [{ id: "evidence-1", mediaFileId: "media-1", canonicalContentType: "application/pdf", byteSize: 100, pageCount: 1 }],
      }),
      decideDocument: vi.fn(),
    };
    const service = new ProviderDocumentReviewService(repository as never, {} as never, async () => true);
    await expect(service.decide({
      actorUserId: "staff",
      providerId: "provider",
      documentVersionId: "document",
      outcome: "REJECT",
      reason: "The submitted PRIVATE-DOCUMENT-7788 could not be verified",
      expectedVersion: 2,
      commandId: "command",
      requestId: "request",
    })).rejects.toThrow("VALIDATION_ERROR");
    expect(repository.decideDocument).not.toHaveBeenCalled();
  });

  it("returns an exact prior document decision but rejects an altered replay", async () => {
    const prior = {
      id: "review-1",
      providerId: "provider",
      documentVersionId: "document",
      expectedDocumentVersion: 2,
      outcome: "APPROVE",
      reason: "Verified against the submitted authoritative evidence",
      actorUserId: "staff",
      requestId: "request",
    };
    const repository = new PrismaProviderVerificationRepository({
      providerDocumentReview: { findUnique: vi.fn().mockResolvedValue(prior) },
    } as never);
    const command = {
      providerId: prior.providerId,
      documentVersionId: prior.documentVersionId,
      expectedVersion: prior.expectedDocumentVersion,
      outcome: prior.outcome as "APPROVE",
      reason: prior.reason,
      actorUserId: prior.actorUserId,
      commandId: "command",
      requestId: prior.requestId,
      now: new Date("2026-08-13T20:00:00.000Z"),
    };
    await expect(repository.decideDocument(command)).resolves.toBe(prior);
    await expect(repository.decideDocument({ ...command, reason: "A materially different decision reason" }))
      .rejects.toThrow("DOCUMENT_VERSION_CONFLICT");
  });

  it("serializes document decisions by Provider then exact document row", () => {
    const source = readFileSync(resolve("src/modules/providers/infrastructure/prisma-provider-verification.repository.ts"), "utf8");
    const decision = source.slice(source.indexOf("public async decideDocument"), source.indexOf("public async findDocumentDecisionReplay"));
    expect(decision.indexOf("SELECT id FROM providers")).toBeGreaterThan(-1);
    expect(decision.indexOf("SELECT id FROM provider_document_versions")).toBeGreaterThan(decision.indexOf("SELECT id FROM providers"));
    expect(decision).toContain('if (target === "APPROVED")');
  });
});
