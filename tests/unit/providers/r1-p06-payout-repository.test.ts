import { PrismaProviderPayoutRepository } from "../../../src/modules/providers/infrastructure/prisma-provider-payout.repository.js";

const now = new Date("2026-08-24T12:00:00.000Z");
const envelope = {
  ciphertext: "ciphertext",
  nonce: "nonce",
  authenticationTag: "tag",
  encryptionKeyId: "enc-v1",
};
const fingerprints = [{ lookupKeyId: "lookup-v1", fingerprint: "fingerprint-v1" }];
const maskFacts = { callingCode: "20", ibanCountryPrefix: null, lastFour: "5678", identifierLength: 12 };

function transactionDatabase(overrides: Record<string, unknown> = {}) {
  const database: Record<string, unknown> = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "locked-owner" }]),
    ...overrides,
  };
  database["$transaction"] = vi.fn(async (work: (transaction: unknown) => Promise<unknown>) => work(database));
  return database;
}

function repository(database: Record<string, unknown>) {
  return new PrismaProviderPayoutRepository(
    database as never,
    () => ({ append: vi.fn().mockResolvedValue(undefined) }) as never,
    () => ({ authorize: vi.fn().mockResolvedValue(true) }),
    () => ({ assertConsumed: vi.fn().mockResolvedValue(true) }),
    () => ({ authorize: vi.fn().mockResolvedValue(true) }),
    () => ({ readLegalNameFacts: vi.fn().mockResolvedValue({ legalEntityName: "Synthetic Company", ownerLegalName: "Synthetic Owner" }) }),
    () => ({ commitAcceptedReveal: vi.fn().mockResolvedValue({ id: "audit-1" }) }) as never,
  );
}

function ownerProvider() {
  return {
    id: "provider-1",
    kind: "REGISTERED_COMPANY",
    applicationStatus: "APPROVED",
    applicationOwnerUserId: "owner-1",
    ownerUserId: "owner-1",
    members: [{ id: "member-1", userId: "owner-1" }],
  };
}

function claim(kind: "MOBILE_WALLET" | "BANK_ACCOUNT" = "MOBILE_WALLET") {
  return {
    id: "claim-1",
    kind,
    callingCode: kind === "MOBILE_WALLET" ? "20" : null,
    ibanCountryPrefix: kind === "BANK_ACCOUNT" ? "EG" : null,
    lastFour: "5678",
    identifierLength: kind === "MOBILE_WALLET" ? 12 : 29,
    fingerprints,
  };
}

function registry(database: Record<string, unknown>) {
  Object.assign(database, {
    payoutDestinationType: { findFirst: vi.fn().mockResolvedValue({ id: "type-1" }) },
    payoutCountryPolicy: { findFirst: vi.fn().mockResolvedValue({ id: "policy-1" }) },
    payoutOperator: { findFirst: vi.fn().mockResolvedValue({ id: "operator-1" }) },
    payoutBank: { findFirst: vi.fn().mockResolvedValue({ id: "bank-1" }) },
    currency: { findFirst: vi.fn().mockResolvedValue({ code: "EGP" }) },
  });
  return database;
}

function draftInput(overrides: Record<string, unknown> = {}) {
  return {
    ids: { chainId: "chain-1", claimId: "claim-1", destinationVersionId: "destination-1" },
    providerId: "provider-1",
    actorUserId: "owner-1",
    destinationTypeId: "type-1",
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
    maskFacts,
    fingerprints,
    commandId: "draft-command",
    requestId: "request-1",
    ...overrides,
  };
}

describe("R1-P06 payout repository executable coverage", () => {
  it("builds bounded reads, queues, conflicts, masks, and key queries", async () => {
    const versions = {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue({ id: "destination-1" }),
      count: vi.fn().mockResolvedValue(2),
    };
    const providers = { findUnique: vi.fn().mockResolvedValue(ownerProvider()) };
    const primary = {
      findUnique: vi.fn().mockResolvedValue({ destinationVersionId: "destination-1" }),
      findFirst: vi.fn().mockResolvedValue({ destinationVersionId: "destination-1" }),
    };
    const history = { findMany: vi.fn().mockResolvedValue([]) };
    const conflicts = { findMany: vi.fn().mockResolvedValue([]) };
    const lookup = { findFirst: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(3) };
    const rotations = { findUnique: vi.fn().mockResolvedValue({ id: "run-1" }) };
    const claims = { findMany: vi.fn().mockResolvedValue([]) };
    const subject = repository({
      provider: providers,
      providerPayoutDestinationVersion: versions,
      providerPrimaryPayoutDestination: primary,
      providerPayoutHistory: history,
      providerPayoutConflict: conflicts,
      providerPayoutLookupFingerprint: lookup,
      providerPayoutKeyRotationRun: rotations,
      providerPayoutIdentityClaim: claims,
    });

    await subject.readAccess("provider-1", "owner-1");
    await subject.readHolderAuthority("provider-1");
    await subject.list({ providerId: "provider-1", limit: 0 });
    await subject.list({ providerId: "provider-1", limit: 500, cursorUpdatedAt: now, cursorId: "cursor" });
    await subject.read("provider-1", "destination-1");
    await subject.findCollision(fingerprints);
    await subject.readPrimary("provider-1");
    await subject.readPrimaryState("provider-1");
    await expect(subject.isPayoutDestinationReady("provider-1")).resolves.toBe(true);
    await subject.listQueue({ limit: 0 });
    await subject.listQueue({ limit: 500, cursorSubmittedAt: now, cursorId: "cursor" });
    await subject.listHistory("provider-1");
    await subject.listHistory("provider-1", 500, { createdAt: now, id: "cursor" });
    await subject.listOpenConflicts({ limit: 0 });
    await subject.listOpenConflicts({ limit: 500, cursorOpenedAt: now, cursorId: "cursor" });
    await expect(subject.countKeyReferences({ encryptionKeyId: "enc-v1" })).resolves.toBe(2);
    await expect(subject.countKeyReferences({ lookupKeyId: "lookup-v1" })).resolves.toBe(3);
    await expect(subject.countKeyReferences({})).resolves.toBe(0);
    await subject.readRotationRun("run-1");
    await subject.listEncryptionRotationCandidates({ fromKeyIds: ["enc-v1"], cursor: null, limit: 0 });
    await subject.listEncryptionRotationCandidates({ fromKeyIds: ["enc-v1"], cursor: "cursor", limit: 5000 });
    await subject.listLookupRotationCandidates({ fromKeyIds: ["lookup-v1"], cursor: null, limit: 0 });
    await subject.listLookupRotationCandidates({ fromKeyIds: ["lookup-v1"], cursor: "cursor", limit: 5000 });
    expect(subject.safeMask(claim())).toMatch(/^\+20/u);
    expect(subject.safeMask(claim("BANK_ACCOUNT"))).toContain(" ");
  });

  it("commits a reveal only after proof, authority, and audit gates", async () => {
    const row = {
      id: "destination-1", version: 3, status: "PENDING_VERIFICATION",
      identifierEncryptionKeyId: "enc-v1", holderNameEncryptionKeyId: "enc-v1",
      identityClaim: claim(),
    };
    const db = transactionDatabase({
      provider: { findFirst: vi.fn().mockResolvedValue(ownerProvider()) },
      providerPayoutDestinationVersion: { findFirst: vi.fn().mockResolvedValue(row) },
    });
    await expect(repository(db).commitRevealGate({
      actorUserId: "staff-1", providerId: "provider-1", destinationVersionId: "destination-1",
      expectedVersion: 3, purpose: "MANUAL_PAYOUT_DESTINATION_VERIFICATION",
      reasonCode: "VERIFIED_MATCH", requestId: "request-reveal", proofId: "proof-1", now,
      prepareSensitiveResult: (destination, authority) => ({ id: destination.id, owner: authority.ownerLegalName }),
    })).resolves.toMatchObject({ sensitiveResult: { id: "destination-1", owner: "Synthetic Owner" }, audit: { id: "audit-1" } });
  });

  it("creates a first draft after registry, holder, limit, and collision checks", async () => {
    const version = { id: "destination-1", version: 1, status: "DRAFT" };
    const db = registry(transactionDatabase({
      provider: {
        findFirst: vi.fn().mockResolvedValue({ id: "provider-1" }),
        findUnique: vi.fn().mockResolvedValue(ownerProvider()),
      },
      providerPayoutDestinationVersion: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(version) },
      providerPayoutHistory: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      providerPayoutDestinationChain: {
        count: vi.fn().mockResolvedValue(0), create: vi.fn().mockResolvedValue({}), update: vi.fn().mockResolvedValue({}),
      },
      providerPayoutLookupFingerprint: { findFirst: vi.fn().mockResolvedValue(null) },
      providerPayoutIdentityClaim: { create: vi.fn().mockResolvedValue({}) },
    }));
    await expect(repository(db).createDraft(draftInput())).resolves.toBe(version);
  });

  it("creates a successor and updates a draft while preserving identity", async () => {
    const predecessor = { id: "destination-1", providerId: "provider-1", chainId: "chain-1", status: "APPROVED", version: 3 };
    const successor = { id: "destination-2", version: 1, status: "DRAFT" };
    const successorDb = registry(transactionDatabase({
      provider: { findFirst: vi.fn().mockResolvedValue({ id: "provider-1" }), findUnique: vi.fn().mockResolvedValue(ownerProvider()) },
      providerPayoutDestinationVersion: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValueOnce(predecessor).mockResolvedValueOnce(null),
        create: vi.fn().mockResolvedValue(successor),
      },
      providerPayoutHistory: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      providerPayoutLookupFingerprint: { findFirst: vi.fn().mockResolvedValue(null) },
      providerPayoutIdentityClaim: { create: vi.fn().mockResolvedValue({}) },
      providerPayoutDestinationChain: { update: vi.fn().mockResolvedValue({}) },
    }));
    await expect(repository(successorDb).createSuccessor({
      ...draftInput({
        ids: { chainId: "ignored-chain", claimId: "claim-2", destinationVersionId: "destination-2" },
        commandId: "successor-command",
      }),
      predecessorVersionId: "destination-1", predecessorExpectedVersion: 3, sequence: 2, reuseChainId: "chain-1",
    })).resolves.toBe(successor);

    const current = {
      id: "destination-2", chainId: "chain-1", identityClaimId: "claim-1", status: "DRAFT", version: 1,
      identityClaim: { fingerprints: [{ ...fingerprints[0], claimStatus: "ACTIVE" }] },
    };
    const updated = { ...current, version: 2 };
    const updateDb = registry(transactionDatabase({
      provider: { findFirst: vi.fn().mockResolvedValue({ id: "provider-1" }), findUnique: vi.fn().mockResolvedValue(ownerProvider()) },
      providerPayoutHistory: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      providerPayoutDestinationVersion: { findFirst: vi.fn().mockResolvedValue(current), update: vi.fn().mockResolvedValue(updated) },
      providerPayoutLookupFingerprint: { findFirst: vi.fn().mockResolvedValue(null) },
      providerPayoutDestinationChain: { update: vi.fn().mockResolvedValue({}) },
    }));
    await expect(repository(updateDb).updateDraft({
      ...draftInput({ commandId: "update-command" }),
      destinationVersionId: "destination-2", expectedVersion: 1, claimId: "claim-2", now,
    })).resolves.toBe(updated);
  });

  it("submits a draft and initializes or changes a primary destination", async () => {
    const submitted = {
      id: "destination-1", chainId: "chain-1", status: "PENDING_VERIFICATION", version: 2,
      identityClaim: claim(),
    };
    const candidate = {
      id: "destination-1", providerId: "provider-1", status: "DRAFT", version: 1,
      countryId: "country-eg", countryCode: "EG", currencyCode: null, operatorId: "operator-1", bankId: null,
      kind: "MOBILE_WALLET", predecessorVersionId: null,
      chain: { destinationTypeId: "type-1", destinationType: { id: "type-1" } },
    };
    const submitDb = registry(transactionDatabase({
      provider: {
        findFirst: vi.fn().mockResolvedValue({ id: "provider-1" }),
        findUnique: vi.fn().mockResolvedValue(ownerProvider()),
      },
      providerPayoutHistory: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "history-1" }) },
      providerPayoutDestinationVersion: {
        findFirst: vi.fn().mockResolvedValue(candidate), updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(submitted),
      },
      providerEmailOutbox: { create: vi.fn().mockResolvedValue({}) },
    }));
    await expect(repository(submitDb).submit({
      providerId: "provider-1", destinationVersionId: "destination-1", expectedVersion: 1,
      actorUserId: "owner-1", proofId: "proof-1", commandId: "submit-command", requestId: "request-submit", now,
    })).resolves.toBe(submitted);

    for (const existing of [null, { providerId: "provider-1", destinationVersionId: "destination-old" }]) {
      const target = {
        ...candidate, status: "APPROVED", version: 2, identityClaim: claim(),
        chain: { destinationTypeId: "type-1", currentVersionId: "destination-1", effectiveApprovedVersionId: "destination-1" },
      };
      const primaryResult = { providerId: "provider-1", destinationVersionId: "destination-1" };
      const primaryDb = registry(transactionDatabase({
        provider: {
          findFirst: vi.fn().mockResolvedValue({ id: "provider-1" }),
          findUnique: vi.fn().mockResolvedValue(ownerProvider()),
          findUniqueOrThrow: vi.fn().mockResolvedValue({ payoutPrimaryStateVersion: 4 }),
          update: vi.fn().mockResolvedValue({}),
        },
        providerPayoutHistory: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "history-primary" }) },
        providerPayoutDestinationVersion: { findFirst: vi.fn().mockResolvedValue(target) },
        providerPrimaryPayoutDestination: {
          findUnique: vi.fn().mockResolvedValue(existing),
          create: vi.fn().mockResolvedValue(primaryResult), update: vi.fn().mockResolvedValue(primaryResult),
        },
        providerEmailOutbox: { create: vi.fn().mockResolvedValue({}) },
      }));
      await expect(repository(primaryDb).setPrimary({
        providerId: "provider-1", destinationVersionId: "destination-1", expectedDestinationVersion: 2,
        expectedPrimaryVersion: 4, actorUserId: "owner-1", proofId: "proof-primary",
        commandId: `primary-${existing === null ? "create" : "update"}`, requestId: "request-primary", now,
      })).resolves.toBe(primaryResult);
    }
  });

  it.each([
    ["APPROVE", "PENDING_VERIFICATION", "APPROVED"],
    ["REJECT", "PENDING_VERIFICATION", "REJECTED"],
    ["REQUEST_CHANGES", "PENDING_VERIFICATION", "CHANGES_REQUESTED"],
    ["REQUEST_REPLACEMENT", "APPROVED", "REPLACEMENT_REQUESTED"],
    ["INVALIDATE", "APPROVED", "INVALIDATED"],
  ] as const)("commits %s payout decisions", async (outcome, status, targetStatus) => {
    const destinationClaim = claim();
    const row = {
      id: "destination-1", providerId: "provider-1", chainId: "chain-1", identityClaimId: "claim-1",
      predecessorVersionId: null, predecessor: null, status, version: 3, kind: "MOBILE_WALLET",
      countryId: "country-eg", countryCode: "EG", currencyCode: null, operatorId: "operator-1", bankId: null,
      holderRelationship: "PROVIDER_OWNER", identifierEncryptionKeyId: "enc-v1", holderNameEncryptionKeyId: "enc-v1",
      identityClaim: destinationClaim,
      chain: { destinationTypeId: "type-1", formerPrimaryEligible: false, primaryRestorationStateVersion: null },
    };
    const decision = { id: `decision-${outcome}`, outcome };
    const versionFindFirst = vi.fn().mockResolvedValueOnce(row).mockResolvedValue(null);
    const db = registry(transactionDatabase({
      provider: {
        findFirst: vi.fn().mockResolvedValue({ id: "provider-1" }),
        findUnique: vi.fn().mockResolvedValue(ownerProvider()),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ payoutPrimaryStateVersion: 0 }),
        update: vi.fn().mockResolvedValue({ payoutPrimaryStateVersion: 1 }),
      },
      providerPayoutDecision: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(decision) },
      providerPayoutDestinationVersion: { findFirst: versionFindFirst, update: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      providerPayoutDestinationChain: { update: vi.fn().mockResolvedValue({}) },
      providerPrimaryPayoutDestination: {
        findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}), deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      providerPayoutIdentityClaim: { update: vi.fn().mockResolvedValue({}) },
      providerPayoutHistory: { create: vi.fn().mockResolvedValue({ id: "history-1" }) },
      providerEmailOutbox: { create: vi.fn().mockResolvedValue({}) },
    }));
    await expect(repository(db).decide({
      providerId: "provider-1", destinationVersionId: "destination-1", expectedVersion: 3,
      outcome, verificationMethod: "MANUAL_WALLET_TRANSFER_CHECK", reasonCode: "VERIFIED_MATCH",
      verificationNote: "Manual verification completed", acceptedRevealAttemptId: outcome === "APPROVE" ? "reveal-1" : null,
      ...(outcome === "APPROVE" ? {
        approvalHolderAuthority: { holderRelationship: "PROVIDER_OWNER" as const, authoritativeHolderLegalName: "Synthetic Owner", protectedHolderMatches: () => true },
      } : {}),
      actorUserId: "staff-1", commandId: `decision-${outcome}`, requestId: `request-${outcome}`, now,
    })).resolves.toBe(decision);
    expect((db["providerPayoutDestinationVersion"] as { update: ReturnType<typeof vi.fn> }).update)
      .toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: targetStatus }) }));
  });

  it("removes a non-primary destination and records conflict open/resolution", async () => {
    const removed = { id: "destination-1", status: "REMOVED", version: 4 };
    const row = {
      id: "destination-1", chainId: "chain-1", identityClaimId: "claim-1", status: "DRAFT", version: 3,
      identityClaim: claim(),
    };
    const removeDb = transactionDatabase({
      provider: {
        findFirst: vi.fn().mockResolvedValue({ id: "provider-1" }),
        findUnique: vi.fn().mockResolvedValue(ownerProvider()),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ payoutPrimaryStateVersion: 2 }),
      },
      providerPayoutHistory: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "history-remove" }) },
      providerPayoutDestinationVersion: {
        findFirst: vi.fn().mockResolvedValueOnce(row).mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({}), findUniqueOrThrow: vi.fn().mockResolvedValue(removed),
      },
      providerPrimaryPayoutDestination: { findUnique: vi.fn().mockResolvedValue(null) },
      providerPayoutIdentityClaim: { update: vi.fn().mockResolvedValue({}) },
      providerPayoutDestinationChain: { update: vi.fn().mockResolvedValue({}) },
      providerEmailOutbox: { create: vi.fn().mockResolvedValue({}) },
    });
    await expect(repository(removeDb).remove({
      providerId: "provider-1", destinationVersionId: "destination-1", expectedVersion: 3,
      expectedPrimaryVersion: 2, replacementPrimaryDestinationVersionId: null, acknowledgeReadinessLoss: false,
      actorUserId: "owner-1", proofId: "proof-remove", reason: "No longer required",
      commandId: "remove-command", requestId: "request-remove", now,
    })).resolves.toBe(removed);

    const conflict = { id: "conflict-1", safeMask: "+20••••5678", status: "OPEN", version: 1, incumbentClaim: { status: "RELEASED" } };
    const resolved = { ...conflict, status: "RESOLVED_AFTER_RELEASE", version: 2 };
    const conflictDb = transactionDatabase({
      provider: { findFirst: vi.fn().mockResolvedValue({ id: "provider-1" }) },
      providerPayoutConflict: {
        findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(conflict),
        findFirst: vi.fn().mockResolvedValue(conflict), update: vi.fn().mockResolvedValue(resolved),
      },
      providerPayoutHistory: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
    });
    const subject = repository(conflictDb);
    await expect(subject.recordConflict({
      providerId: "provider-1", commandId: "conflict-command", kind: "MOBILE_WALLET",
      safeMask: conflict.safeMask, incumbentClaimId: "claim-incumbent", actorUserId: "owner-1", requestId: "request-conflict",
    })).resolves.toBe(conflict);
    await expect(subject.resolveConflict({
      conflictId: "conflict-1", providerId: "provider-1", expectedVersion: 1,
      outcome: "RESOLVED_AFTER_RELEASE", reason: "Incumbent released", actorUserId: "staff-1",
      commandId: "resolve-command", requestId: "request-resolve", now,
    })).resolves.toBe(resolved);
  });

  it("runs encryption and lookup rotations through retirement", async () => {
    const run = { id: "run-1", purpose: "ENCRYPTION", fromKeyIds: ["enc-v1"], toActiveKeyId: "enc-v2", batchSize: 1, startedByUserId: "staff-1" };
    const db = transactionDatabase({
      providerPayoutKeyRotationRun: {
        findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(run),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: vi.fn().mockResolvedValue(run),
      },
      providerPayoutDestinationVersion: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      providerPayoutLookupFingerprint: {
        upsert: vi.fn().mockResolvedValue({}), deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      providerPayoutIdentityClaim: { update: vi.fn().mockResolvedValue({}) },
    });
    const subject = repository(db);
    await expect(subject.createRotationRun({
      purpose: "ENCRYPTION", fromKeyIds: ["enc-v1"], toActiveKeyId: "enc-v2", batchSize: 0,
      startedByUserId: "staff-1", commandId: "rotation-command",
    })).resolves.toBe(run);
    await expect(subject.updateEncryptionRotation({
      destinationVersionId: "destination-1", expectedCryptoRevision: 1,
      identifierEnvelope: { ...envelope, encryptionKeyId: "enc-v2" }, holderEnvelope: { ...envelope, encryptionKeyId: "enc-v2" },
    })).resolves.toBeUndefined();
    await subject.updateLookupRotation({
      claimId: "claim-1", claimStatus: "ACTIVE", fromKeyIds: ["lookup-v1"], fingerprints, now,
    });
    await subject.updateLookupRotation({
      claimId: "claim-1", claimStatus: "RELEASED", fromKeyIds: ["lookup-v1"], fingerprints, now,
    });
    await expect(subject.updateRotationProgress({
      runId: "run-1", expectedVersion: 1, cursor: "cursor", scanned: 2, updated: 2, failed: 0,
      complete: false, remainingReferenceCount: null, verifiedByUserId: null, lastSafeErrorCode: null,
    })).resolves.toBe(run);
    await expect(subject.updateRotationProgress({
      runId: "run-1", expectedVersion: 1, cursor: null, scanned: 0, updated: 0, failed: 0,
      complete: true, remainingReferenceCount: 0, verifiedByUserId: "staff-1", lastSafeErrorCode: null,
    })).resolves.toBe(run);
    await expect(subject.approveRotationRetirement({
      runId: "run-1", expectedVersion: 2, approvedByUserId: "staff-1", reason: "No remaining references", now,
    })).resolves.toBe(run);
  });

  it("accepts exact draft replays and rejects every material draft mutation", async () => {
    const input = draftInput();
    const prior = {
      id: "destination-1", providerId: "provider-1", status: "DRAFT", version: 1,
      kind: "MOBILE_WALLET", countryId: "country-eg", countryCode: "EG", currencyCode: null,
      operatorId: "operator-1", bankId: null, holderRelationship: "PROVIDER_OWNER",
      createdByUserId: "owner-1", identityClaim: { fingerprints },
    };
    const history = {
      event: "DESTINATION_DRAFT_CREATED", providerId: "provider-1", destinationVersionId: "destination-1",
      actorUserId: "owner-1", requestId: "request-1", exactVersion: 1,
    };
    const replay = (
      row: Record<string, unknown> = prior,
      historyRow: Record<string, unknown> | null = history,
      replayInput: ReturnType<typeof draftInput> = input,
    ) => repository({
      providerPayoutDestinationVersion: { findUnique: vi.fn().mockResolvedValue(row) },
      providerPayoutHistory: { findUnique: vi.fn().mockResolvedValue(historyRow) },
    }).createDraft(replayInput);
    await expect(replay()).resolves.toBe(prior);
    const variants: Array<[Record<string, unknown>, Record<string, unknown>]> = [
      [{}, { event: "OTHER" }], [{}, { providerId: "other" }], [{}, { destinationVersionId: "other" }],
      [{}, { actorUserId: "other" }], [{}, { requestId: "other" }], [{}, { exactVersion: 2 }],
      [{ providerId: "other" }, {}], [{ status: "PENDING_VERIFICATION" }, {}], [{ version: 2 }, {}],
      [{ kind: "BANK_ACCOUNT" }, {}], [{ countryId: "other" }, {}], [{ countryCode: "US" }, {}],
      [{ currencyCode: "EGP" }, {}], [{ operatorId: "other" }, {}], [{ bankId: "bank-1" }, {}],
      [{ holderRelationship: "PROVIDER_LEGAL_ENTITY" }, {}], [{ createdByUserId: "other" }, {}],
      [{ identityClaim: { fingerprints: [] } }, {}],
      [{ identityClaim: { fingerprints: [{ lookupKeyId: "lookup-v1", fingerprint: "other" }] } }, {}],
    ];
    for (const [rowPatch, historyPatch] of variants) {
      await expect(replay({ ...prior, ...rowPatch }, { ...history, ...historyPatch }))
        .rejects.toThrow("PAYOUT_DESTINATION_VERSION_CONFLICT");
    }
    await expect(replay(prior, history, { ...input, protectedHolderMatches: () => false }))
      .rejects.toThrow("PAYOUT_DESTINATION_VERSION_CONFLICT");
  });

  it("validates exact successor and update replays field by field", async () => {
    const successorInput = {
      ...draftInput({
        ids: { chainId: "ignored", claimId: "claim-2", destinationVersionId: "destination-2" },
        commandId: "successor-command", requestId: "request-successor",
      }),
      predecessorVersionId: "destination-1", predecessorExpectedVersion: 3, sequence: 2, reuseChainId: "chain-1",
    };
    const successor = {
      id: "destination-2", providerId: "provider-1", predecessorVersionId: "destination-1",
      kind: "MOBILE_WALLET", countryId: "country-eg", countryCode: "EG", currencyCode: null,
      operatorId: "operator-1", bankId: null, holderRelationship: "PROVIDER_OWNER",
      createdByUserId: "owner-1", sequence: 2, identityClaim: { fingerprints },
    };
    const successorHistory = {
      event: "DESTINATION_DRAFT_CREATED", providerId: "provider-1", destinationVersionId: "destination-2",
      chainId: "chain-1", actorUserId: "owner-1", requestId: "request-successor", exactVersion: 3,
    };
    const successorReplay = (
      row: Record<string, unknown> = successor,
      historyRow: Record<string, unknown> | null = successorHistory,
      replayInput = successorInput,
    ) => repository({
      providerPayoutDestinationVersion: { findUnique: vi.fn().mockResolvedValue(row) },
      providerPayoutHistory: { findUnique: vi.fn().mockResolvedValue(historyRow) },
    }).createSuccessor(replayInput);
    await expect(successorReplay()).resolves.toBe(successor);
    const successorVariants: Array<[Record<string, unknown>, Record<string, unknown>]> = [
      [{}, { event: "OTHER" }], [{}, { providerId: "other" }], [{}, { destinationVersionId: "other" }],
      [{}, { chainId: "other" }], [{}, { actorUserId: "other" }], [{}, { requestId: "other" }], [{}, { exactVersion: 4 }],
      [{ providerId: "other" }, {}], [{ predecessorVersionId: "other" }, {}], [{ kind: "BANK_ACCOUNT" }, {}],
      [{ countryId: "other" }, {}], [{ countryCode: "US" }, {}], [{ currencyCode: "EGP" }, {}],
      [{ operatorId: "other" }, {}], [{ bankId: "bank-1" }, {}], [{ holderRelationship: "PROVIDER_LEGAL_ENTITY" }, {}],
      [{ createdByUserId: "other" }, {}], [{ sequence: 3 }, {}], [{ identityClaim: { fingerprints: [] } }, {}],
    ];
    for (const [rowPatch, historyPatch] of successorVariants) {
      await expect(successorReplay({ ...successor, ...rowPatch }, { ...successorHistory, ...historyPatch }))
        .rejects.toThrow("PAYOUT_DESTINATION_VERSION_CONFLICT");
    }
    await expect(successorReplay(successor, successorHistory, { ...successorInput, protectedHolderMatches: () => false }))
      .rejects.toThrow("PAYOUT_DESTINATION_VERSION_CONFLICT");

    const updateInput = {
      ...draftInput({ commandId: "update-command", requestId: "request-update" }),
      destinationVersionId: "destination-1", expectedVersion: 1, claimId: "claim-1", now,
    };
    const current = {
      id: "destination-1", providerId: "provider-1", status: "DRAFT", version: 2,
      kind: "MOBILE_WALLET", countryId: "country-eg", countryCode: "EG", currencyCode: null,
      operatorId: "operator-1", bankId: null, holderRelationship: "PROVIDER_OWNER",
      identityClaim: { fingerprints: [{ ...fingerprints[0], claimStatus: "ACTIVE" }] },
    };
    const updateHistory = {
      providerId: "provider-1", destinationVersionId: "destination-1", exactVersion: 1,
      actorUserId: "owner-1", requestId: "request-update",
    };
    const updateReplay = (
      row: Record<string, unknown> = current,
      historyRow: Record<string, unknown> = updateHistory,
      replayInput = updateInput,
    ) => repository({
      providerPayoutHistory: { findUnique: vi.fn().mockResolvedValue(historyRow) },
      providerPayoutDestinationVersion: { findUniqueOrThrow: vi.fn().mockResolvedValue(row) },
    }).updateDraft(replayInput);
    await expect(updateReplay()).resolves.toBe(current);
    const updateVariants: Array<[Record<string, unknown>, Record<string, unknown>]> = [
      [{}, { providerId: "other" }], [{}, { destinationVersionId: "other" }], [{}, { exactVersion: 2 }],
      [{}, { actorUserId: "other" }], [{}, { requestId: "other" }], [{ status: "PENDING_VERIFICATION" }, {}],
      [{ version: 3 }, {}], [{ kind: "BANK_ACCOUNT" }, {}], [{ countryId: "other" }, {}], [{ countryCode: "US" }, {}],
      [{ currencyCode: "EGP" }, {}], [{ operatorId: "other" }, {}], [{ bankId: "bank-1" }, {}],
      [{ holderRelationship: "PROVIDER_LEGAL_ENTITY" }, {}], [{ identityClaim: { fingerprints: [] } }, {}],
    ];
    for (const [rowPatch, historyPatch] of updateVariants) {
      await expect(updateReplay({ ...current, ...rowPatch }, { ...updateHistory, ...historyPatch }))
        .rejects.toThrow("PAYOUT_DESTINATION_VERSION_CONFLICT");
    }
    await expect(updateReplay(current, updateHistory, { ...updateInput, protectedHolderMatches: () => false }))
      .rejects.toThrow("PAYOUT_DESTINATION_VERSION_CONFLICT");
  });

  it("validates submit, primary, decision, removal, conflict, and rotation replays", async () => {
    const submitInput = {
      providerId: "provider-1", destinationVersionId: "destination-1", expectedVersion: 1,
      actorUserId: "owner-1", commandId: "submit-command", requestId: "request-submit",
    };
    const submitHistory = {
      event: "DESTINATION_SUBMITTED", providerId: "provider-1", destinationVersionId: "destination-1",
      exactVersion: 1, actorUserId: "owner-1", requestId: "request-submit",
    };
    const submitted = { id: "destination-1", status: "PENDING_VERIFICATION" };
    const submitReplay = (row = submitHistory) => repository({
      providerPayoutHistory: { findUnique: vi.fn().mockResolvedValue(row) },
      providerPayoutDestinationVersion: { findUniqueOrThrow: vi.fn().mockResolvedValue(submitted) },
    }).findPayoutSubmitReplay(submitInput);
    await expect(submitReplay()).resolves.toBe(submitted);
    for (const patch of [
      { event: "OTHER" }, { providerId: "other" }, { destinationVersionId: "other" },
      { exactVersion: 2 }, { actorUserId: "other" }, { requestId: "other" },
    ]) await expect(submitReplay({ ...submitHistory, ...patch })).rejects.toThrow("PAYOUT_DESTINATION_VERSION_CONFLICT");

    const primaryInput = {
      providerId: "provider-1", destinationVersionId: "destination-1", expectedDestinationVersion: 2,
      expectedPrimaryVersion: 4, actorUserId: "owner-1", commandId: "primary-command", requestId: "request-primary",
    };
    const primaryHistory = {
      event: "PRIMARY_CHANGED", providerId: "provider-1", destinationVersionId: "destination-1",
      exactVersion: 2, expectedPrimaryVersion: 4, actorUserId: "owner-1", requestId: "request-primary",
    };
    const primary = { providerId: "provider-1", destinationVersionId: "destination-1" };
    const primaryReplay = (row = primaryHistory) => repository({
      providerPayoutHistory: { findUnique: vi.fn().mockResolvedValue(row) },
      providerPrimaryPayoutDestination: { findUnique: vi.fn().mockResolvedValue(primary) },
    }).findPrimaryReplay(primaryInput);
    await expect(primaryReplay()).resolves.toBe(primary);
    for (const patch of [
      { event: "OTHER" }, { providerId: "other" }, { destinationVersionId: "other" }, { exactVersion: 3 },
      { expectedPrimaryVersion: 5 }, { actorUserId: "other" }, { requestId: "other" },
    ]) await expect(primaryReplay({ ...primaryHistory, ...patch })).rejects.toThrow("PAYOUT_PRIMARY_CONFLICT");

    const decisionInput = {
      providerId: "provider-1", destinationVersionId: "destination-1", expectedVersion: 3,
      outcome: "APPROVE" as const, verificationMethod: "MANUAL_WALLET_TRANSFER_CHECK" as const,
      reasonCode: "VERIFIED_MATCH", verificationNote: "Manual verification completed",
      acceptedRevealAttemptId: "reveal-1", actorUserId: "staff-1", commandId: "decision-command", requestId: "request-decision",
    };
    const decision = {
      providerId: "provider-1", destinationVersionId: "destination-1", expectedDestinationVersion: 3,
      outcome: "APPROVE", verificationMethod: "MANUAL_WALLET_TRANSFER_CHECK", reasonCode: "VERIFIED_MATCH",
      verificationNote: "Manual verification completed", actorUserId: "staff-1",
      acceptedRevealAttemptId: "reveal-1", requestId: "request-decision",
    };
    const decisionReplay = (row = decision) => repository({ providerPayoutDecision: { findUnique: vi.fn().mockResolvedValue(row) } }).findPayoutDecisionReplay(decisionInput);
    await expect(decisionReplay()).resolves.toBe(decision);
    for (const patch of [
      { providerId: "other" }, { destinationVersionId: "other" }, { expectedDestinationVersion: 4 },
      { outcome: "REJECT" }, { verificationMethod: "MANUAL_BANK_BENEFICIARY_CHECK" }, { reasonCode: "OTHER" },
      { verificationNote: "Other" }, { actorUserId: "other" }, { acceptedRevealAttemptId: "other" }, { requestId: "other" },
    ]) await expect(decisionReplay({ ...decision, ...patch })).rejects.toThrow("PAYOUT_DESTINATION_VERSION_CONFLICT");

    const removalInput = {
      providerId: "provider-1", destinationVersionId: "destination-1", expectedVersion: 3, expectedPrimaryVersion: 4,
      replacementPrimaryDestinationVersionId: null, acknowledgeReadinessLoss: true,
      actorUserId: "owner-1", reason: "No longer required", commandId: "remove-command", requestId: "request-remove",
    };
    const removalHistory = {
      event: "DESTINATION_REMOVED", providerId: "provider-1", destinationVersionId: "destination-1",
      exactVersion: 3, expectedPrimaryVersion: 4, replacementDestinationVersionId: null,
      acknowledgeReadinessLoss: true, actorUserId: "owner-1", reasonText: "No longer required", requestId: "request-remove",
    };
    const removed = { id: "destination-1", status: "REMOVED" };
    const removalReplay = (row: Record<string, unknown> = removalHistory) => repository({
      providerPayoutHistory: { findUnique: vi.fn().mockResolvedValue(row) },
      providerPayoutDestinationVersion: { findUniqueOrThrow: vi.fn().mockResolvedValue(removed) },
    }).findPayoutRemovalReplay(removalInput);
    await expect(removalReplay()).resolves.toBe(removed);
    for (const patch of [
      { event: "OTHER" }, { providerId: "other" }, { destinationVersionId: "other" }, { exactVersion: 4 },
      { expectedPrimaryVersion: 5 }, { replacementDestinationVersionId: "other" }, { acknowledgeReadinessLoss: false },
      { actorUserId: "other" }, { reasonText: "Other" }, { requestId: "other" },
    ]) await expect(removalReplay({ ...removalHistory, ...patch })).rejects.toThrow("PAYOUT_DESTINATION_VERSION_CONFLICT");

    const conflictInput = {
      providerId: "provider-1", commandId: "conflict-command", kind: "MOBILE_WALLET" as const,
      safeMask: "+20••••5678", incumbentClaimId: "claim-1", actorUserId: "owner-1", requestId: "request-conflict",
    };
    const conflict = {
      providerId: "provider-1", commandId: "conflict-command", kind: "MOBILE_WALLET",
      safeMask: "+20••••5678", incumbentClaimId: "claim-1", openedByUserId: "owner-1", openedRequestId: "request-conflict",
    };
    const conflictReplay = (row = conflict) => repository({ providerPayoutConflict: { findUnique: vi.fn().mockResolvedValue(row) } }).recordConflict(conflictInput);
    await expect(conflictReplay()).resolves.toBe(conflict);
    for (const patch of [
      { providerId: "other" }, { commandId: "other" }, { kind: "BANK_ACCOUNT" }, { safeMask: "other" },
      { incumbentClaimId: "other" }, { openedByUserId: "other" }, { openedRequestId: "other" },
    ]) await expect(conflictReplay({ ...conflict, ...patch })).rejects.toThrow("PAYOUT_DESTINATION_CONFLICT");

    const rotationInput = {
      purpose: "ENCRYPTION" as const, fromKeyIds: ["enc-v1", "enc-old"], toActiveKeyId: "enc-v2",
      batchSize: 10, startedByUserId: "staff-1", commandId: "rotation-command",
    };
    const rotation = {
      purpose: "ENCRYPTION", fromKeyIds: ["enc-v1", "enc-old"], toActiveKeyId: "enc-v2",
      batchSize: 10, startedByUserId: "staff-1",
    };
    const rotationReplay = (row = rotation) => repository({ providerPayoutKeyRotationRun: { findUnique: vi.fn().mockResolvedValue(row) } }).createRotationRun(rotationInput);
    await expect(rotationReplay()).resolves.toBe(rotation);
    for (const patch of [
      { purpose: "LOOKUP_HMAC" }, { toActiveKeyId: "other" }, { batchSize: 11 }, { startedByUserId: "other" },
      { fromKeyIds: ["enc-v1"] }, { fromKeyIds: ["enc-v1", "other"] },
    ]) await expect(rotationReplay({ ...rotation, ...patch })).rejects.toThrow("PAYOUT_KEY_ROTATION_CONFLICT");
  });

  it("honors exact replays discovered inside mutating transactions", async () => {
    const submitted = { id: "destination-1", status: "PENDING_VERIFICATION" };
    const submitInput = {
      providerId: "provider-1", destinationVersionId: "destination-1", expectedVersion: 1,
      actorUserId: "owner-1", proofId: "proof-1", commandId: "submit-command", requestId: "request-submit", now,
    };
    const submitPrior = {
      providerId: "provider-1", destinationVersionId: "destination-1", exactVersion: 1,
      actorUserId: "owner-1", requestId: "request-submit",
    };
    const submitDb = transactionDatabase({
      providerPayoutHistory: { findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValue(submitPrior) },
      providerPayoutDestinationVersion: { findUniqueOrThrow: vi.fn().mockResolvedValue(submitted) },
    });
    await expect(repository(submitDb).submit(submitInput)).resolves.toBe(submitted);

    const primary = { providerId: "provider-1", destinationVersionId: "destination-1" };
    const primaryInput = {
      providerId: "provider-1", destinationVersionId: "destination-1", expectedDestinationVersion: 2,
      expectedPrimaryVersion: 4, actorUserId: "owner-1", proofId: "proof-1",
      commandId: "primary-command", requestId: "request-primary", now,
    };
    const primaryPrior = {
      providerId: "provider-1", destinationVersionId: "destination-1", exactVersion: 2,
      expectedPrimaryVersion: 4, actorUserId: "owner-1", requestId: "request-primary",
    };
    const primaryDb = transactionDatabase({
      providerPayoutHistory: { findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValue(primaryPrior) },
      providerPrimaryPayoutDestination: { findUnique: vi.fn().mockResolvedValue(primary) },
    });
    await expect(repository(primaryDb).setPrimary(primaryInput)).resolves.toBe(primary);

    const decisionInput = {
      providerId: "provider-1", destinationVersionId: "destination-1", expectedVersion: 3,
      outcome: "APPROVE" as const, verificationMethod: "MANUAL_WALLET_TRANSFER_CHECK" as const,
      reasonCode: "VERIFIED_MATCH", verificationNote: "Manual verification completed",
      acceptedRevealAttemptId: "reveal-1", actorUserId: "staff-1", commandId: "decision-command", requestId: "request-decision", now,
    };
    const decisionPrior = {
      providerId: "provider-1", destinationVersionId: "destination-1", expectedDestinationVersion: 3,
      outcome: "APPROVE", verificationMethod: "MANUAL_WALLET_TRANSFER_CHECK", reasonCode: "VERIFIED_MATCH",
      verificationNote: "Manual verification completed", actorUserId: "staff-1",
      acceptedRevealAttemptId: "reveal-1", requestId: "request-decision",
    };
    const decisionDb = transactionDatabase({
      providerPayoutDecision: { findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValue(decisionPrior) },
    });
    await expect(repository(decisionDb).decide(decisionInput)).resolves.toBe(decisionPrior);

    const removed = { id: "destination-1", status: "REMOVED" };
    const removeInput = {
      providerId: "provider-1", destinationVersionId: "destination-1", expectedVersion: 3, expectedPrimaryVersion: 4,
      replacementPrimaryDestinationVersionId: null, acknowledgeReadinessLoss: true,
      actorUserId: "owner-1", proofId: "proof-1", reason: "No longer required",
      commandId: "remove-command", requestId: "request-remove", now,
    };
    const removePrior = {
      providerId: "provider-1", destinationVersionId: "destination-1", exactVersion: 3,
      expectedPrimaryVersion: 4, replacementDestinationVersionId: null, acknowledgeReadinessLoss: true,
      actorUserId: "owner-1", reasonText: "No longer required", requestId: "request-remove",
    };
    const removeDb = transactionDatabase({
      providerPayoutHistory: { findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValue(removePrior) },
      providerPayoutDestinationVersion: { findUniqueOrThrow: vi.fn().mockResolvedValue(removed) },
    });
    await expect(repository(removeDb).remove(removeInput)).resolves.toBe(removed);

    const conflict = { id: "conflict-1", status: "CANDIDATE_REJECTED" };
    const resolveInput = {
      conflictId: "conflict-1", providerId: "provider-1", expectedVersion: 1,
      outcome: "CANDIDATE_REJECTED" as const, reason: "Candidate rejected", actorUserId: "staff-1",
      commandId: "resolve-command", requestId: "request-resolve", now,
    };
    const resolvePrior = {
      providerId: "provider-1", conflictId: "conflict-1", exactVersion: 1,
      actorUserId: "staff-1", reasonText: "Candidate rejected", requestId: "request-resolve",
    };
    const resolveDb = transactionDatabase({
      providerPayoutHistory: { findUnique: vi.fn().mockResolvedValue(resolvePrior) },
      providerPayoutConflict: { findUnique: vi.fn().mockResolvedValue(conflict) },
    });
    await expect(repository(resolveDb).resolveConflict(resolveInput)).resolves.toBe(conflict);

    const resolveFields = ["providerId", "conflictId", "exactVersion", "actorUserId", "reasonText", "requestId"] as const;
    for (const field of resolveFields) {
      const badDb = transactionDatabase({
        providerPayoutHistory: { findUnique: vi.fn().mockResolvedValue({ ...resolvePrior, [field]: field === "exactVersion" ? 2 : "other" }) },
        providerPayoutConflict: { findUnique: vi.fn().mockResolvedValue(conflict) },
      });
      await expect(repository(badDb).resolveConflict(resolveInput)).rejects.toThrow("PAYOUT_DESTINATION_CONFLICT");
    }
    const badStatusDb = transactionDatabase({
      providerPayoutHistory: { findUnique: vi.fn().mockResolvedValue(resolvePrior) },
      providerPayoutConflict: { findUnique: vi.fn().mockResolvedValue({ ...conflict, status: "OPEN" }) },
    });
    await expect(repository(badStatusDb).resolveConflict(resolveInput)).rejects.toThrow("PAYOUT_DESTINATION_CONFLICT");
  });

  it("fails closed on registry, limits, collisions, authority, and optimistic updates", async () => {
    const registryKeys = ["payoutDestinationType", "payoutCountryPolicy", "payoutOperator", "currency"] as const;
    for (const missing of registryKeys) {
      const db = registry(transactionDatabase({
        provider: { findFirst: vi.fn().mockResolvedValue({ id: "provider-1" }), findUnique: vi.fn().mockResolvedValue(ownerProvider()) },
        providerPayoutDestinationVersion: { findUnique: vi.fn().mockResolvedValue(null) },
        providerPayoutHistory: { findUnique: vi.fn().mockResolvedValue(null) },
        providerPayoutDestinationChain: { count: vi.fn().mockResolvedValue(0) },
      }));
      (db[missing] as { findFirst: ReturnType<typeof vi.fn> }).findFirst.mockResolvedValue(null);
      const candidate = missing === "currency"
        ? draftInput({ currencyCode: "EGP" })
        : draftInput();
      await expect(repository(db).createDraft(candidate)).rejects.toThrow("PAYOUT_REGISTRY_INACTIVE");
    }

    const limitedDb = registry(transactionDatabase({
      provider: { findFirst: vi.fn().mockResolvedValue({ id: "provider-1" }), findUnique: vi.fn().mockResolvedValue(ownerProvider()) },
      providerPayoutDestinationVersion: { findUnique: vi.fn().mockResolvedValue(null) },
      providerPayoutHistory: { findUnique: vi.fn().mockResolvedValue(null) },
      providerPayoutDestinationChain: { count: vi.fn().mockResolvedValue(5) },
    }));
    await expect(repository(limitedDb).createDraft(draftInput())).rejects.toThrow("PAYOUT_DESTINATION_LIMIT_REACHED");

    for (const collisionProviderId of ["provider-1", "provider-2"]) {
      const collisionDb = registry(transactionDatabase({
        provider: { findFirst: vi.fn().mockResolvedValue({ id: "provider-1" }), findUnique: vi.fn().mockResolvedValue(ownerProvider()) },
        providerPayoutDestinationVersion: { findUnique: vi.fn().mockResolvedValue(null) },
        providerPayoutHistory: { findUnique: vi.fn().mockResolvedValue(null) },
        providerPayoutDestinationChain: { count: vi.fn().mockResolvedValue(0) },
        providerPayoutLookupFingerprint: { findFirst: vi.fn().mockResolvedValue({ claim: { providerId: collisionProviderId } }) },
      }));
      await expect(repository(collisionDb).createDraft(draftInput())).rejects.toThrow(
        collisionProviderId === "provider-1" ? "PAYOUT_SUCCESSOR_CONFLICT" : "PAYOUT_DESTINATION_CONFLICT",
      );
    }

    const historicalDb = registry(transactionDatabase({
      provider: { findFirst: vi.fn().mockResolvedValue({ id: "provider-1" }), findUnique: vi.fn().mockResolvedValue(ownerProvider()) },
      providerPayoutDestinationVersion: { findUnique: vi.fn().mockResolvedValue(null) },
      providerPayoutHistory: { findUnique: vi.fn().mockResolvedValue(null) },
      providerPayoutDestinationChain: { count: vi.fn().mockResolvedValue(0) },
      providerPayoutLookupFingerprint: { findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValue({ claimId: "old-claim" }) },
    }));
    await expect(repository(historicalDb).createDraft(draftInput())).rejects.toThrow("PAYOUT_SUCCESSOR_CONFLICT");

    const deniedDb = transactionDatabase({
      provider: { findFirst: vi.fn().mockResolvedValue(null) },
      providerPayoutConflict: { findUnique: vi.fn().mockResolvedValue(null) },
    });
    await expect(repository(deniedDb).recordConflict({
      providerId: "provider-1", commandId: "conflict-denied", kind: "MOBILE_WALLET", safeMask: "+20••••5678",
      incumbentClaimId: "claim-1", actorUserId: "owner-1", requestId: "request-denied",
    })).rejects.toThrow("PROVIDER_SCOPE_DENIED");

    const optimisticDb = transactionDatabase({
      providerPayoutDestinationVersion: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      providerPayoutKeyRotationRun: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    });
    const optimistic = repository(optimisticDb);
    await expect(optimistic.updateEncryptionRotation({
      destinationVersionId: "destination-1", expectedCryptoRevision: 1,
      identifierEnvelope: envelope, holderEnvelope: envelope,
    })).rejects.toThrow("PAYOUT_KEY_ROTATION_CONFLICT");
    await expect(optimistic.updateRotationProgress({
      runId: "run-1", expectedVersion: 1, cursor: null, scanned: 0, updated: 0, failed: 1,
      complete: false, remainingReferenceCount: null, verifiedByUserId: null, lastSafeErrorCode: "SAFE_ERROR",
    })).rejects.toThrow("PAYOUT_KEY_ROTATION_CONFLICT");
    await expect(optimistic.approveRotationRetirement({
      runId: "run-1", expectedVersion: 1, approvedByUserId: "staff-1", reason: "No references", now,
    })).rejects.toThrow("PAYOUT_KEY_ROTATION_CONFLICT");
  });

  it.each(["INHERIT", "RESTORE"] as const)("approves a successor and %s its primary authority", async (mode) => {
    const predecessor = {
      id: "destination-0", identityClaimId: "claim-1", status: "APPROVED", version: 2,
    };
    const row = {
      id: "destination-1", providerId: "provider-1", chainId: "chain-1", identityClaimId: "claim-1",
      predecessorVersionId: "destination-0", predecessor, status: "PENDING_VERIFICATION", version: 3,
      kind: "MOBILE_WALLET", countryId: "country-eg", countryCode: "EG", currencyCode: null,
      operatorId: "operator-1", bankId: null, holderRelationship: "PROVIDER_OWNER",
      identifierEncryptionKeyId: "enc-v1", holderNameEncryptionKeyId: "enc-v1", identityClaim: claim(),
      chain: {
        destinationTypeId: "type-1",
        formerPrimaryEligible: mode === "RESTORE",
        primaryRestorationStateVersion: mode === "RESTORE" ? 4 : null,
      },
    };
    const decision = { id: `decision-${mode}`, outcome: "APPROVE" };
    const primaryBefore = mode === "INHERIT" ? { destinationVersionId: "destination-0" } : null;
    const db = registry(transactionDatabase({
      provider: {
        findFirst: vi.fn().mockResolvedValue({ id: "provider-1" }),
        findUnique: vi.fn().mockResolvedValue(ownerProvider()),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ payoutPrimaryStateVersion: 4 }),
        update: vi.fn().mockResolvedValue({ payoutPrimaryStateVersion: 5 }),
      },
      providerPayoutDecision: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(decision) },
      providerPayoutDestinationVersion: {
        findFirst: vi.fn().mockResolvedValueOnce(row),
        update: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      providerPayoutDestinationChain: { update: vi.fn().mockResolvedValue({}) },
      providerPrimaryPayoutDestination: {
        findUnique: vi.fn().mockResolvedValue(primaryBefore),
        create: vi.fn().mockResolvedValue({}), update: vi.fn().mockResolvedValue({}),
      },
      providerPayoutHistory: { create: vi.fn().mockResolvedValue({ id: "history-successor" }) },
      providerEmailOutbox: { create: vi.fn().mockResolvedValue({}) },
    }));
    await expect(repository(db).decide({
      providerId: "provider-1", destinationVersionId: "destination-1", expectedVersion: 3,
      outcome: "APPROVE", verificationMethod: "MANUAL_WALLET_TRANSFER_CHECK", reasonCode: "VERIFIED_MATCH",
      verificationNote: "Manual successor verification completed", acceptedRevealAttemptId: "reveal-1",
      approvalHolderAuthority: {
        holderRelationship: "PROVIDER_OWNER", authoritativeHolderLegalName: "Synthetic Owner", protectedHolderMatches: () => true,
      },
      actorUserId: "staff-1", commandId: `successor-${mode}`, requestId: `request-${mode}`, now,
    })).resolves.toBe(decision);
    const primaryRepository = db["providerPrimaryPayoutDestination"] as {
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    if (mode === "INHERIT") expect(primaryRepository.update).toHaveBeenCalledTimes(1);
    else expect(primaryRepository.create).toHaveBeenCalledTimes(1);
  });

  it.each(["CLEAR", "REPLACE"] as const)("removes a primary destination with %s semantics", async (mode) => {
    const row = {
      id: "destination-1", chainId: "chain-1", identityClaimId: "claim-1",
      status: "APPROVED", version: 3, identityClaim: claim(),
    };
    const replacement = mode === "REPLACE" ? { id: "destination-2", chainId: "chain-2" } : null;
    const removed = { ...row, status: "REMOVED", version: 4 };
    const findFirst = vi.fn().mockResolvedValueOnce(row);
    if (mode === "REPLACE") findFirst.mockResolvedValueOnce(replacement).mockResolvedValueOnce(null);
    else findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const db = transactionDatabase({
      provider: {
        findFirst: vi.fn().mockResolvedValue({ id: "provider-1" }),
        findUnique: vi.fn().mockResolvedValue(ownerProvider()),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ payoutPrimaryStateVersion: 4 }),
        update: vi.fn().mockResolvedValue({}),
      },
      providerPayoutHistory: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "history-remove" }) },
      providerPayoutDestinationVersion: {
        findFirst, update: vi.fn().mockResolvedValue({}), findUniqueOrThrow: vi.fn().mockResolvedValue(removed),
      },
      providerPrimaryPayoutDestination: {
        findUnique: vi.fn().mockResolvedValue({ providerId: "provider-1", destinationVersionId: "destination-1" }),
        delete: vi.fn().mockResolvedValue({}), update: vi.fn().mockResolvedValue({}),
      },
      providerPayoutIdentityClaim: { update: vi.fn().mockResolvedValue({}) },
      providerPayoutDestinationChain: { update: vi.fn().mockResolvedValue({}) },
      providerEmailOutbox: { create: vi.fn().mockResolvedValue({}) },
    });
    await expect(repository(db).remove({
      providerId: "provider-1", destinationVersionId: "destination-1", expectedVersion: 3, expectedPrimaryVersion: 4,
      replacementPrimaryDestinationVersionId: replacement?.id ?? null,
      acknowledgeReadinessLoss: mode === "CLEAR", actorUserId: "owner-1", proofId: "proof-remove",
      reason: "Primary destination removed", commandId: `remove-${mode}`, requestId: `request-${mode}`, now,
    })).resolves.toBe(removed);
  });
});
