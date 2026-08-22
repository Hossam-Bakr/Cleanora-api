import type { PrismaProviderPayoutRepository } from "../../../src/modules/providers/infrastructure/prisma-provider-payout.repository.js";
import type { PrismaProviderVerificationRepository } from "../../../src/modules/providers/infrastructure/prisma-provider-verification.repository.js";
import { ProviderPayoutHistoryService } from "../../../src/modules/providers/provider-payout-history.service.js";
import { ProviderVerificationHistoryService } from "../../../src/modules/providers/provider-verification-history.service.js";
import { ProviderDenialAuditService } from "../../../src/modules/providers/provider-denial-audit.service.js";
import { ProviderDocumentExpirySweep } from "../../../src/modules/providers/provider-document-expiry.sweep.js";
import { ProviderPolicyActivationSweep } from "../../../src/modules/providers/provider-policy-activation.sweep.js";
import { R1P06AuditDouble } from "../../helpers/r1-p06-test-doubles.js";

const principal = { userId: "owner-1", sessionId: "session-1", status: "ACTIVE", capability: "FULL" } as const;
const access = { applicationStatus: "APPROVED", members: [{ status: "ACTIVE", level: "OWNER" }] };

describe("R1-P06 chronological safe histories", () => {
  it("writes minimized denial evidence for unavailable, access, eligibility, and R1-P06 outcomes", async () => {
    const audit = new R1P06AuditDouble();
    const service = new ProviderDenialAuditService(audit as never);
    await expect(service.denyAsUnavailable({ actorUserId: "user-1", action: "FOREIGN_READ", targetId: "provider-1", requestId: "request-1" }))
      .rejects.toMatchObject({ code: "PROVIDER_NOT_FOUND" });
    await expect(service.denyAccess({ actorUserId: "user-2", action: "PRIVATE_WRITE", reason: "ROLE_DENIED", context: { role: "MEMBER", exact: true } }))
      .rejects.toMatchObject({ code: "PROVIDER_ACCESS_DENIED" });
    await expect(service.denyR1P06({ actorUserId: "user-3", action: "PAYOUT_WRITE", publicErrorCode: "PROVIDER_SCOPE_DENIED" }))
      .rejects.toThrow("PROVIDER_SCOPE_DENIED");
    await expect(service.denyEligibility({
      actorUserId: "user-4",
      action: "DOCUMENT_CREATE",
      denialCodes: ["CATEGORY_NOT_VERIFIED"],
      recoveryHints: ["VERIFY_CATEGORY"],
      providerKind: "INDIVIDUAL",
      requiredCategory: "PROVIDER",
      requestId: "request-4",
    })).rejects.toMatchObject({ code: "PROVIDER_ELIGIBILITY_DENIED" });
    expect(audit.entries).toHaveLength(4);
    expect(audit.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ actorId: "user-1", targetId: "provider-1", outcome: "DENIED", requestId: "request-1" }),
      expect.objectContaining({ actorId: "user-2", reason: "ROLE_DENIED", context: { role: "MEMBER", exact: true } }),
      expect.objectContaining({ actorId: "user-3", reason: "PROVIDER_SCOPE_DENIED" }),
      expect.objectContaining({ actorId: "user-4", reason: "PROVIDER_ELIGIBILITY_DENIED", context: expect.objectContaining({ providerKind: "INDIVIDUAL" }) }),
    ]));
    expect(JSON.stringify(audit.entries)).not.toMatch(/walletNumber|holderLegalName|ciphertext|fingerprint/u);
  });

  it("runs bounded expiry and policy activation batches with deterministic clocks and limits", async () => {
    const now = new Date("2026-08-14T10:00:00.000Z");
    const repository = { expireApproved: vi.fn().mockResolvedValue(7) };
    await expect(new ProviderDocumentExpirySweep(repository as never, () => now).runBatch(25)).resolves.toBe(7);
    expect(repository.expireApproved).toHaveBeenCalledWith(now, 25);

    const activateBatch = vi.fn().mockResolvedValue({ processed: 3, nextCursor: "cursor-2" });
    const sweep = new ProviderPolicyActivationSweep(activateBatch);
    await expect(sweep.runBatch(null, 0)).resolves.toEqual({ processed: 3, nextCursor: "cursor-2" });
    expect(activateBatch).toHaveBeenCalledWith({ cursor: null, limit: 1 });
    await sweep.runBatch("cursor-2", 1000);
    expect(activateBatch).toHaveBeenLastCalledWith({ cursor: "cursor-2", limit: 100 });
  });

  it("treats the HTTP request correlation as part of exact document-draft replay identity", async () => {
    const existing = {
      id: "document-1",
      providerId: "provider-1",
      status: "DRAFT",
      version: 1,
      countryCode: "EG",
      documentNumber: "DOC-001",
      legalName: "Synthetic Company",
      issuerName: "Registry Authority",
      issueDate: new Date("2026-08-01T00:00:00.000Z"),
      expiresAt: null,
      createdByUserId: "owner-1",
      chain: { documentType: { code: "COMMERCIAL_REGISTRATION" } },
    };
    const history = {
      event: "DOCUMENT_DRAFT_CREATED",
      providerId: "provider-1",
      documentVersionId: "document-1",
      actorUserId: "owner-1",
      requestId: "request-1",
      exactVersion: 1,
    };
    const repository = new (await import("../../../src/modules/providers/infrastructure/prisma-provider-verification.repository.js")).PrismaProviderVerificationRepository({
      providerDocumentVersion: { findUnique: vi.fn().mockResolvedValue(existing) },
      providerVerificationHistory: { findUnique: vi.fn().mockResolvedValue(history) },
    } as never);
    const command = {
      providerId: "provider-1",
      typeCode: "COMMERCIAL_REGISTRATION",
      countryCode: "EG",
      documentNumber: "DOC-001",
      legalName: "Synthetic Company",
      issuerName: "Registry Authority",
      issueDate: new Date("2026-08-01T00:00:00.000Z"),
      expiresAt: null,
      actorUserId: "owner-1",
      commandId: "command-1",
      requestId: "request-1",
      now: new Date("2026-08-14T00:00:00.000Z"),
    };
    await expect(repository.createDraft(command)).resolves.toBe(existing);
    await expect(repository.createDraft({ ...command, requestId: "request-2" }))
      .rejects.toThrow("DOCUMENT_VERSION_CONFLICT");
  });

  it("treats request correlation and predecessor identity as part of payout draft/successor replay", async () => {
    const fingerprint = { lookupKeyId: "lookup-v1", fingerprint: "fingerprint-r1p06", claimStatus: "ACTIVE" };
    const baseVersion = {
      id: "payout-version-1",
      providerId: "provider-1",
      chainId: "chain-1",
      status: "DRAFT",
      version: 1,
      sequence: 1,
      kind: "MOBILE_WALLET",
      countryId: "country-eg",
      countryCode: "EG",
      currencyCode: null,
      operatorId: "operator-1",
      bankId: null,
      holderRelationship: "PROVIDER_OWNER",
      createdByUserId: "owner-1",
      predecessorVersionId: null,
      identityClaim: { fingerprints: [fingerprint] },
    };
    const draftHistory = {
      event: "DESTINATION_DRAFT_CREATED",
      providerId: "provider-1",
      destinationVersionId: "payout-version-1",
      chainId: "chain-1",
      actorUserId: "owner-1",
      requestId: "request-payout-draft",
      exactVersion: 1,
    };
    const repository = new (await import("../../../src/modules/providers/infrastructure/prisma-provider-payout.repository.js")).PrismaProviderPayoutRepository({
      providerPayoutDestinationVersion: { findUnique: vi.fn().mockResolvedValue(baseVersion) },
      providerPayoutHistory: { findUnique: vi.fn().mockResolvedValue(draftHistory) },
    } as never);
    const envelope = { ciphertext: "ciphertext", nonce: "nonce", authenticationTag: "tag", encryptionKeyId: "enc-v1" };
    const draftCommand = {
      ids: { chainId: "chain-1", claimId: "claim-1", destinationVersionId: "payout-version-1" },
      providerId: "provider-1",
      actorUserId: "owner-1",
      destinationTypeId: "type-wallet",
      kind: "MOBILE_WALLET" as const,
      countryId: "country-eg",
      countryCode: "EG",
      currencyCode: null,
      operatorId: "operator-1",
      bankId: null,
      holderRelationship: "PROVIDER_OWNER" as const,
      expectedHolderLegalName: "Synthetic Owner",
      protectedHolderMatches: () => true,
      identifierEnvelope: envelope,
      holderEnvelope: envelope,
      maskFacts: { callingCode: "20", ibanCountryPrefix: null, lastFour: "5678", identifierLength: 13 },
      fingerprints: [{ lookupKeyId: fingerprint.lookupKeyId, fingerprint: fingerprint.fingerprint }],
      commandId: "command-payout-draft",
      requestId: "request-payout-draft",
    };
    await expect(repository.createDraft(draftCommand)).resolves.toBe(baseVersion);
    await expect(repository.createDraft({ ...draftCommand, requestId: "request-altered" }))
      .rejects.toThrow("PAYOUT_DESTINATION_VERSION_CONFLICT");

    const successor = { ...baseVersion, id: "payout-version-2", sequence: 2, predecessorVersionId: "payout-version-1" };
    const successorHistory = {
      ...draftHistory,
      destinationVersionId: "payout-version-2",
      requestId: "request-payout-successor",
      exactVersion: 4,
    };
    const successorRepository = new (await import("../../../src/modules/providers/infrastructure/prisma-provider-payout.repository.js")).PrismaProviderPayoutRepository({
      providerPayoutDestinationVersion: { findUnique: vi.fn().mockResolvedValue(successor) },
      providerPayoutHistory: { findUnique: vi.fn().mockResolvedValue(successorHistory) },
    } as never);
    const successorCommand = {
      ...draftCommand,
      ids: { chainId: "chain-1", claimId: "claim-2", destinationVersionId: "payout-version-2" },
      commandId: "command-payout-successor",
      requestId: "request-payout-successor",
      predecessorVersionId: "payout-version-1",
      predecessorExpectedVersion: 4,
      sequence: 2,
      reuseChainId: "chain-1",
    };
    await expect(successorRepository.createSuccessor(successorCommand)).resolves.toBe(successor);
    await expect(successorRepository.createSuccessor({ ...successorCommand, predecessorVersionId: "different-predecessor" }))
      .rejects.toThrow("PAYOUT_DESTINATION_VERSION_CONFLICT");
    await expect(successorRepository.createSuccessor({ ...successorCommand, requestId: "request-altered" }))
      .rejects.toThrow("PAYOUT_DESTINATION_VERSION_CONFLICT");
  });

  it("rejects altered payout draft-update replays before returning protected state", async () => {
    const current = {
      id: "payout-version-1",
      providerId: "provider-1",
      status: "DRAFT",
      version: 2,
      kind: "MOBILE_WALLET",
      countryId: "country-eg",
      countryCode: "EG",
      currencyCode: null,
      operatorId: "operator-1",
      bankId: null,
      holderRelationship: "PROVIDER_OWNER",
      identityClaim: { fingerprints: [{ lookupKeyId: "lookup-v1", fingerprint: "fingerprint-r1p06", claimStatus: "ACTIVE" }] },
    };
    const history = {
      providerId: "provider-1",
      destinationVersionId: "payout-version-1",
      exactVersion: 1,
      actorUserId: "owner-1",
      requestId: "request-payout-update",
    };
    const repository = new (await import("../../../src/modules/providers/infrastructure/prisma-provider-payout.repository.js")).PrismaProviderPayoutRepository({
      providerPayoutHistory: { findUnique: vi.fn().mockResolvedValue(history) },
      providerPayoutDestinationVersion: { findUniqueOrThrow: vi.fn().mockResolvedValue(current) },
    } as never);
    const envelope = { ciphertext: "ciphertext", nonce: "nonce", authenticationTag: "tag", encryptionKeyId: "enc-v1" };
    const command = {
      destinationVersionId: "payout-version-1",
      expectedVersion: 1,
      claimId: "claim-2",
      now: new Date("2026-08-14T10:00:00.000Z"),
      providerId: "provider-1",
      actorUserId: "owner-1",
      destinationTypeId: "type-wallet",
      kind: "MOBILE_WALLET" as const,
      countryId: "country-eg",
      countryCode: "EG",
      currencyCode: null,
      operatorId: "operator-1",
      bankId: null,
      holderRelationship: "PROVIDER_OWNER" as const,
      expectedHolderLegalName: "Synthetic Owner",
      protectedHolderMatches: () => true,
      identifierEnvelope: envelope,
      holderEnvelope: envelope,
      maskFacts: { callingCode: "20", ibanCountryPrefix: null, lastFour: "5678", identifierLength: 13 },
      fingerprints: [{ lookupKeyId: "lookup-v1", fingerprint: "fingerprint-r1p06" }],
      commandId: "command-payout-update",
      requestId: "request-payout-update",
    };
    await expect(repository.updateDraft(command)).resolves.toBe(current);
    await expect(repository.updateDraft({ ...command, requestId: "request-altered" }))
      .rejects.toThrow("PAYOUT_DESTINATION_VERSION_CONFLICT");
  });

  it("returns bounded document events without private document fields", async () => {
    const repository = {
      async readProviderAccess() { return access; },
      async listHistory() { return [{ id: "h1", event: "DOCUMENT_SUBMITTED", fromStatus: "DRAFT", toStatus: "SUBMITTED", actorType: "PROVIDER_OWNER", reasonCode: null, reasonText: null, exactVersion: 2, createdAt: new Date("2026-08-13T09:00:00.000Z") }]; },
    } as unknown as PrismaProviderVerificationRepository;
    const page = await new ProviderVerificationHistoryService(repository).list(principal as never, "provider-1", { limit: 20 });
    expect(page.items).toEqual([expect.objectContaining({ event: "DOCUMENT_SUBMITTED", exactVersion: 2 })]);
    expect(page.nextCursor).toBeNull();
    expect(JSON.stringify(page)).not.toMatch(/documentNumber|storageKey|url/u);
  });

  it("returns masked payout events and denies inactive actors", async () => {
    const repository = {
      async readAccess() { return access; },
      async listHistory() { return [{ id: "p1", event: "DESTINATION_APPROVED", fromStatus: "PENDING_VERIFICATION", toStatus: "APPROVED", actorType: "STAFF_ADMIN", reasonCode: "VERIFIED_MATCH", reasonText: "Manual verification completed", safeMask: "+20••••••5678", exactVersion: 3, createdAt: new Date("2026-08-13T09:05:00.000Z") }]; },
    } as unknown as PrismaProviderPayoutRepository;
    const audit = new R1P06AuditDouble();
    const service = new ProviderPayoutHistoryService(
      repository,
      new ProviderDenialAuditService(audit as never),
    );
    const page = await service.list(principal as never, "provider-1", { limit: 20 });
    expect(page).toEqual({ items: [expect.objectContaining({ mask: "+20••••••5678", exactVersion: 3 })], nextCursor: null });
    expect(page.items[0]).not.toHaveProperty("reasonText");
    await expect(service.list({ ...principal, status: "DISABLED" } as never, "provider-1", { limit: 20 })).rejects.toThrow("PROVIDER_SCOPE_DENIED");
    await expect(service.list({ ...principal, verificationOnly: true } as never, "provider-1", { limit: 20 })).rejects.toThrow("PROVIDER_SCOPE_DENIED");
    expect(audit.entries).toEqual([
      expect.objectContaining({
        action: "PROVIDER_PAYOUT_HISTORY_READ",
        targetId: "provider-1",
        outcome: "DENIED",
      }),
      expect.objectContaining({
        action: "PROVIDER_PAYOUT_HISTORY_READ",
        targetId: "provider-1",
        outcome: "DENIED",
      }),
    ]);
    expect(JSON.stringify(audit.entries)).not.toMatch(/holderLegalName|ciphertext|fingerprint|walletNumber|iban/u);
  });
});
