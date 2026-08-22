import type { PrismaProviderPayoutRepository } from "../../../src/modules/providers/infrastructure/prisma-provider-payout.repository.js";
import type { PrismaProviderVerificationRepository } from "../../../src/modules/providers/infrastructure/prisma-provider-verification.repository.js";
import { ProviderPayoutReviewQueryService } from "../../../src/modules/providers/provider-payout-review-query.service.js";
import { ProviderVerificationQueryService } from "../../../src/modules/providers/provider-verification-query.service.js";
import { ProviderDocumentReviewQueryService } from "../../../src/modules/providers/provider-document-review-query.service.js";
import { ProviderPayoutConflictService } from "../../../src/modules/providers/provider-payout-conflict.service.js";

const principal = {
  userId: "owner-1",
  sessionId: "session-1",
  status: "ACTIVE",
  capability: "FULL",
} as const;

const payoutRow = (id: string, submittedAt: Date) => ({
  id,
  providerId: "provider-1",
  kind: "MOBILE_WALLET" as const,
  identityClaim: {
    kind: "MOBILE_WALLET" as const,
    callingCode: "20",
    ibanCountryPrefix: null,
    lastFour: "5678",
    identifierLength: 13,
  },
  operator: { code: "TEST_OPERATOR", labelEn: "Synthetic Operator" },
  bank: null,
  holderRelationship: "PROVIDER_OWNER" as const,
  status: "PENDING_VERIFICATION" as const,
  version: 2,
  submittedAt,
  decisions: [{
    id: "decision-1",
    outcome: "REQUEST_CHANGES",
    verificationMethod: "MANUAL_WALLET_TRANSFER_CHECK",
    reasonCode: "CORRECTION_REQUIRED",
    verificationNote: "Synthetic correction note",
    actorUserId: "staff-1",
    decidedAt: new Date("2026-08-13T09:05:00.000Z"),
    expectedDestinationVersion: 1,
  }],
});

describe("R1-P06 thin-controller query services", () => {
  it("derives Provider verification truth and stable document pages in the service layer", async () => {
    const updatedAt = new Date("2026-08-13T09:00:00.000Z");
    const repository = {
      async readProviderAccess() {
        return {
          id: "provider-1",
          kind: "REGISTERED_COMPANY",
          applicationStatus: "APPROVED",
          operationalStatus: "ACTIVE",
          profile: { country: { id: "country-eg", code: "EG", isActive: true } },
          members: [{ status: "ACTIVE", level: "OWNER" }],
        };
      },
      async readEffectivePolicy() {
        return {
          id: "policy-1",
          policyVersion: 1,
          effectiveAt: updatedAt,
          items: [{
            isRequired: true,
            position: 0,
            fieldRules: {},
            documentType: { code: "COMMERCIAL_REGISTRATION", displayNameAr: "سجل", displayNameEn: "Registration" },
          }],
        };
      },
      async listEffectiveDocumentTypeCodes() { return ["COMMERCIAL_REGISTRATION"]; },
      async listDocuments() {
        return ["document-1", "document-2"].map((id) => ({
          id,
          chainId: "chain-1",
          chain: { documentType: { code: "COMMERCIAL_REGISTRATION" }, effectiveVersionId: "document-1" },
          sequence: 1,
          status: "APPROVED",
          countryCode: "EG",
          issueDate: updatedAt,
          expiresAt: null,
          evidenceFormat: "PDF",
          evidence: [{ id: "evidence-1" }],
          predecessorVersionId: null,
          version: 2,
          createdAt: updatedAt,
          submittedAt: updatedAt,
          updatedAt,
        }));
      },
    } as unknown as PrismaProviderVerificationRepository;
    const payouts = { async isPayoutDestinationReady() { return true; } } as unknown as PrismaProviderPayoutRepository;
    const service = new ProviderVerificationQueryService(repository, payouts, undefined, () => updatedAt);

    await expect(service.overview(principal as never, "provider-1")).resolves.toMatchObject({
      documentsVerified: { status: "SATISFIED", satisfied: true },
      payoutDestinationReady: true,
      badgeTruth: "EARNED",
    });
    await expect(service.requirements(principal as never, "provider-1")).resolves.toMatchObject({
      policyVersionId: "policy-1",
      requirements: [{ typeCode: "COMMERCIAL_REGISTRATION" }],
    });
    await expect(service.listDocuments(principal as never, "provider-1", { limit: 1 })).resolves.toMatchObject({
      items: [{ documentVersionId: "document-1", effective: true }],
      nextCursor: expect.any(String),
    });

    const memberOnly = {
      ...repository,
      async readProviderAccess() {
        const allowed = await repository.readProviderAccess("provider-1", "member-1");
        return { ...allowed, members: [{ status: "ACTIVE", level: "MEMBER" }] };
      },
    } as unknown as PrismaProviderVerificationRepository;
    await expect(new ProviderVerificationQueryService(memberOnly).overview(principal as never, "provider-1"))
      .rejects.toThrow("PROVIDER_SCOPE_DENIED");
    await expect(service.overview({ ...principal, verificationOnly: true } as never, "provider-1"))
      .rejects.toThrow("PROVIDER_SCOPE_DENIED");
  });

  it("returns only safe Staff queue/dossier projections from the service layer", async () => {
    const submittedAt = new Date("2026-08-13T09:00:00.000Z");
    const first = payoutRow("destination-1", submittedAt);
    const second = payoutRow("destination-2", submittedAt);
    const repository = {
      async listQueue() { return [first, second]; },
      async read() { return first; },
      safeMask() { return "+20••••••5678"; },
    } as unknown as PrismaProviderPayoutRepository;
    const service = new ProviderPayoutReviewQueryService(repository, async () => true);

    await expect(service.listQueue({ actorUserId: "staff-1", requestId: "request-1", limit: 1 })).resolves.toMatchObject({
      items: [{ destinationVersionId: "destination-1", mask: "+20••••••5678" }],
      nextCursor: expect.any(String),
    });
    const dossier = await service.dossier({ actorUserId: "staff-1", providerId: "provider-1", destinationVersionId: "destination-1", requestId: "request-2" });
    expect(dossier).toMatchObject({ destinationVersionId: "destination-1", decisions: [{ exactVersion: 1 }] });
    expect(JSON.stringify(dossier)).not.toMatch(/walletNumber|fullIdentifier|ciphertext|fingerprint/u);
  });

  it("paginates the Staff document queue and issues private dossier delivery per evidence item", async () => {
    const submittedAt = new Date("2026-08-13T09:00:00.000Z");
    const documents = ["document-1", "document-2"].map((id) => ({ id, submittedAt }));
    const document = {
      id: "document-1",
      evidence: [
        { mediaFileId: "media-1" },
        { mediaFileId: "media-2" },
      ],
    };
    const repository = {
      listDocumentReviewQueue: vi.fn().mockResolvedValue(documents),
      readDocument: vi.fn().mockResolvedValue(document),
    };
    const media = {
      issuePrivateDelivery: vi.fn().mockImplementation(async ({ mediaFileId }: { mediaFileId: string }) => ({ mediaFileId, url: "https://invalid.example/private" })),
    };
    const authorizeStaff = vi.fn().mockResolvedValue(true);
    const service = new ProviderDocumentReviewQueryService(repository as never, media as never, authorizeStaff);

    const page = await service.listQueue("staff-1", { limit: 1 });
    expect(page).toMatchObject({ items: [{ id: "document-1" }], nextCursor: expect.any(String) });
    expect(repository.listDocumentReviewQueue).toHaveBeenCalledWith({ limit: 2 });

    const dossier = await service.dossier({ actorUserId: "staff-1", providerId: "provider-1", documentVersionId: "document-1" });
    expect(dossier.delivery).toHaveLength(2);
    expect(media.issuePrivateDelivery).toHaveBeenNthCalledWith(1, {
      mediaFileId: "media-1",
      providerId: "provider-1",
      documentVersionId: "document-1",
      purpose: "STAFF_DOCUMENT_REVIEW",
      actorUserId: "staff-1",
    });

    if (page.nextCursor === null) throw new Error("Expected document queue cursor");
    const secondPage = await service.listQueue("staff-1", { cursor: page.nextCursor, limit: 1000 });
    expect(secondPage.nextCursor).toBeNull();
    expect(repository.listDocumentReviewQueue).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 101, cursorId: "document-1", cursorSubmittedAt: submittedAt }));
  });

  it("fails closed for unauthorized Staff document queue/dossier access and missing documents", async () => {
    const repository = { listDocumentReviewQueue: vi.fn(), readDocument: vi.fn().mockResolvedValue(null) };
    const media = { issuePrivateDelivery: vi.fn() };
    const denied = new ProviderDocumentReviewQueryService(repository as never, media as never, async () => false);
    await expect(denied.listQueue("staff-denied")).rejects.toThrow("PROVIDER_SCOPE_DENIED");
    await expect(denied.dossier({ actorUserId: "staff-denied", providerId: "provider-1", documentVersionId: "document-1" }))
      .rejects.toThrow("PROVIDER_SCOPE_DENIED");
    expect(repository.readDocument).not.toHaveBeenCalled();

    const missing = new ProviderDocumentReviewQueryService(repository as never, media as never, async () => true);
    await expect(missing.dossier({ actorUserId: "staff-1", providerId: "provider-1", documentVersionId: "missing" }))
      .rejects.toThrow("DOCUMENT_STATE_CONFLICT");
    expect(media.issuePrivateDelivery).not.toHaveBeenCalled();
  });

  it("records, paginates, and resolves cross-Provider conflicts through Staff-only commands", async () => {
    const openedAt = new Date("2026-08-13T09:00:00.000Z");
    const rows = ["conflict-1", "conflict-2"].map((id) => ({ id, openedAt }));
    const repository = {
      recordConflict: vi.fn().mockResolvedValue(rows[0]),
      listOpenConflicts: vi.fn().mockResolvedValue(rows),
      resolveConflict: vi.fn().mockResolvedValue({ ...rows[0], status: "RESOLVED" }),
    };
    const service = new ProviderPayoutConflictService(repository as never, async () => true, () => new Date("2026-08-14T10:00:00.000Z"));
    await expect(service.record({
      providerId: "provider-1",
      commandId: "command-1",
      kind: "MOBILE_WALLET",
      safeMask: "+20••••••5678",
      incumbentClaimId: "claim-1",
      actorUserId: "owner-1",
      requestId: "request-conflict-record",
    })).resolves.toBe(rows[0]);

    const page = await service.list("staff-1", { limit: 1 });
    expect(page).toMatchObject({ items: [{ id: "conflict-1" }], nextCursor: expect.any(String) });
    if (page.nextCursor === null) throw new Error("Expected payout conflict cursor");
    await service.list("staff-1", { cursor: page.nextCursor, limit: 1000 });
    expect(repository.listOpenConflicts).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 101, cursorId: "conflict-1", cursorOpenedAt: openedAt }));

    await service.resolve({
      actorUserId: "staff-1",
      conflictId: "conflict-1",
      providerId: "provider-1",
      expectedVersion: 1,
      outcome: "CANDIDATE_REJECTED",
      reason: "Candidate belongs to another Provider and was rejected",
      commandId: "command-2",
      requestId: "request-conflict-resolve",
    });
    expect(repository.resolveConflict).toHaveBeenCalledWith(expect.objectContaining({
      conflictId: "conflict-1",
      now: new Date("2026-08-14T10:00:00.000Z"),
    }));
  });

  it("denies conflict queue/resolution without Staff permission and validates the resolution note", async () => {
    const repository = { listOpenConflicts: vi.fn(), resolveConflict: vi.fn() };
    const denied = new ProviderPayoutConflictService(repository as never, async () => false);
    await expect(denied.list("staff-denied")).rejects.toThrow("PROVIDER_SCOPE_DENIED");
    await expect(denied.resolve({
      actorUserId: "staff-denied", conflictId: "conflict-1", providerId: "provider-1", expectedVersion: 1,
      outcome: "RESOLVED_AFTER_RELEASE", reason: "Conflict was safely resolved after release", commandId: "command-1", requestId: "request-1",
    })).rejects.toThrow("PROVIDER_SCOPE_DENIED");

    const invalid = new ProviderPayoutConflictService(repository as never, async () => true);
    await expect(invalid.resolve({
      actorUserId: "staff-1", conflictId: "conflict-1", providerId: "provider-1", expectedVersion: 1,
      outcome: "CANDIDATE_REJECTED", reason: "short", commandId: "command-1", requestId: "request-1",
    })).rejects.toThrow("VALIDATION_ERROR");
    expect(repository.resolveConflict).not.toHaveBeenCalled();
  });
});
