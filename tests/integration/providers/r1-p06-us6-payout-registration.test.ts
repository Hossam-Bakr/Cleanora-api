import { payoutDraftBody, payoutSubmitBody, payoutUpdateBody } from "../../../src/modules/providers/provider-payout.schema.js";
import { ProviderPayoutDestinationService } from "../../../src/modules/providers/provider-payout-destination.service.js";
import { createPayoutDataCrypto } from "../../../src/modules/providers/infrastructure/payout-data-crypto.adapter.js";
import { buildBankDraft, buildWalletDraft, R1_P06_IDS, R1_P06_SENTINELS } from "../../helpers/r1-p06-fixtures.js";
import { r1P06TestKeyRing } from "../../helpers/r1-p06-test-doubles.js";
import { mapPayoutAdminView, mapPayoutOwnerView } from "../../../src/modules/providers/provider-payout.dto.js";

const now = new Date("2026-08-14T10:00:00.000Z");
const principal = {
  userId: R1_P06_IDS.ownerUserId,
  sessionId: R1_P06_IDS.sessionId,
  accountCategories: [],
  verifiedCategories: [],
  pendingCategories: [],
  status: "ACTIVE" as const,
  verificationOnly: false,
};

function providerAccess(level: "OWNER" | "ADMIN" = "OWNER") {
  return {
    applicationStatus: "APPROVED",
    ownerUserId: R1_P06_IDS.ownerUserId,
    applicationOwnerUserId: "application-owner-r1p06",
    kind: "REGISTERED_COMPANY",
    payoutPrimaryStateVersion: 4,
    profile: { country: { id: "country-eg", code: "EG", isActive: true } },
    members: [{ level, status: "ACTIVE" }],
  };
}

function payoutHarness() {
  const rings = r1P06TestKeyRing();
  const crypto = createPayoutDataCrypto(rings);
  const holderEnvelope = crypto.encrypt(R1_P06_SENTINELS.holderName, {
    providerId: R1_P06_IDS.providerId,
    destinationChainId: R1_P06_IDS.chainId,
    destinationVersionId: R1_P06_IDS.destinationVersionId,
    destinationSequence: 1,
    destinationType: "MOBILE_WALLET",
    fieldName: "HOLDER_NAME",
    encryptionKeyId: rings.encryption.activeKeyId,
  });
  const storedRow = {
    id: R1_P06_IDS.destinationVersionId,
    providerId: R1_P06_IDS.providerId,
    chainId: R1_P06_IDS.chainId,
    sequence: 1,
    version: 1,
    kind: "MOBILE_WALLET",
    status: "DRAFT",
    predecessorVersionId: null,
    holderRelationship: "PROVIDER_OWNER",
    holderNameCiphertext: holderEnvelope.ciphertext,
    holderNameNonce: holderEnvelope.nonce,
    holderNameTag: holderEnvelope.authenticationTag,
    holderNameEncryptionKeyId: holderEnvelope.encryptionKeyId,
    identityClaim: { callingCode: "20", ibanCountryPrefix: null, lastFour: "5678", identifierLength: 13 },
    operator: { code: "TEST_OPERATOR", labelEn: "Synthetic operator" },
    bank: null,
    chain: { destinationTypeId: "type-wallet", currentVersionId: R1_P06_IDS.destinationVersionId, effectiveApprovedVersionId: null },
    primaryForProvider: null,
    createdAt: now,
    updatedAt: now,
    submittedAt: null,
    decisions: [],
  };
  const repository = {
    readAccess: vi.fn().mockResolvedValue(providerAccess()),
    list: vi.fn().mockResolvedValue([storedRow]),
    read: vi.fn().mockResolvedValue(storedRow),
    findCollision: vi.fn().mockResolvedValue(null),
    createDraft: vi.fn().mockResolvedValue(storedRow),
    updateDraft: vi.fn().mockResolvedValue({ ...storedRow, version: 2 }),
    findPayoutSubmitReplay: vi.fn().mockResolvedValue(null),
    submit: vi.fn().mockResolvedValue({ ...storedRow, status: "PENDING_VERIFICATION", version: 2 }),
    createSuccessor: vi.fn().mockResolvedValue({ ...storedRow, id: "successor-version", sequence: 2 }),
  };
  const registries = {
    readOptions: vi.fn().mockResolvedValue({
      policy: { allowedCurrencyCodes: ["EGP"] },
      types: [{ code: "MOBILE_WALLET", labelAr: "محفظة", labelEn: "Wallet" }],
      operators: [{ code: "TEST_OPERATOR", labelAr: "مشغل", labelEn: "Operator" }],
      banks: [{ code: "TEST_BANK", nameAr: "بنك", nameEn: "Bank" }],
    }),
    resolveWallet: vi.fn().mockResolvedValue({ type: { id: "type-wallet" }, operator: { id: "operator-test" }, policy: { callingCodes: ["20"] } }),
    resolveBank: vi.fn().mockResolvedValue({ type: { id: "type-bank" }, bank: { id: "bank-test" }, policy: { ibanLengths: [28] } }),
  };
  const holderReader = {
    readLegalNameFacts: vi.fn().mockResolvedValue({
      legalEntityName: R1_P06_SENTINELS.holderName,
      ownerLegalName: R1_P06_SENTINELS.holderName,
    }),
  };
  const proofVerifier = { verify: vi.fn().mockResolvedValue({ proofId: "proof-r1p06" }) };
  const conflicts = { record: vi.fn().mockResolvedValue({ id: "conflict-r1p06" }) };
  const service = new ProviderPayoutDestinationService(
    repository as never,
    registries as never,
    holderReader as never,
    proofVerifier as never,
    conflicts as never,
    rings,
    () => now,
  );
  return { service, repository, registries, holderReader, proofVerifier, conflicts, storedRow };
}

describe("R1-P06 US6 payout registration contract", () => {
  const safeRow = {
    destinationVersionId: R1_P06_IDS.destinationVersionId,
    chainId: R1_P06_IDS.chainId,
    type: "MOBILE_WALLET" as const,
    mask: "+20••••••5678",
    institution: { code: "TEST_OPERATOR", label: "Synthetic operator" },
    holderRelationship: "PROVIDER_OWNER" as const,
    status: "DRAFT" as const,
    primary: false,
    sequence: 1,
    version: 1,
    createdAt: "2026-08-13T09:00:00.000Z",
    submittedAt: null,
    decidedAt: null,
  };

  it("accepts only strict registry-keyed wallet input and complete re-entry updates", () => {
    expect(payoutDraftBody.parse(buildWalletDraft())).toMatchObject({ type: "MOBILE_WALLET", operatorCode: "TEST_OPERATOR" });
    expect(payoutUpdateBody.parse({ ...buildWalletDraft(), expectedVersion: 1 })).toMatchObject({ expectedVersion: 1 });
    expect(() => payoutDraftBody.parse({ ...buildWalletDraft(), operator: "free text" })).toThrow();
    expect(() => payoutUpdateBody.parse({ type: "MOBILE_WALLET", expectedVersion: 1, commandId: R1_P06_IDS.commandId })).toThrow();
  });

  it("authorizes the exact Owner for registry options and decrypts holder data only in Owner views", async () => {
    const { service, repository, registries, storedRow } = payoutHarness();
    await expect(service.options({ principal, providerId: R1_P06_IDS.providerId })).resolves.toMatchObject({
      countryCode: "EG",
      primaryStateVersion: 4,
      currencyCodes: ["EGP"],
    });
    expect(registries.readOptions).toHaveBeenCalledWith("EG");

    repository.list.mockResolvedValueOnce([storedRow, { ...storedRow, id: "second-version", updatedAt: new Date("2026-08-14T09:00:00.000Z") }]);
    const ownerList = await service.list({ principal, providerId: R1_P06_IDS.providerId, limit: 1 });
    expect(ownerList.items[0]).toMatchObject({
      destinationVersionId: R1_P06_IDS.destinationVersionId,
      holderLegalName: R1_P06_SENTINELS.holderName,
      holderRelationship: "PROVIDER_OWNER",
      mask: expect.stringMatching(/^\+20/),
    });
    expect(ownerList.nextCursor).not.toBeNull();
    await expect(service.detail({ principal, providerId: R1_P06_IDS.providerId, destinationVersionId: R1_P06_IDS.destinationVersionId }))
      .resolves.toMatchObject({ holderLegalName: R1_P06_SENTINELS.holderName, primary: false });

    repository.readAccess.mockResolvedValue(providerAccess("ADMIN"));
    const adminPrincipal = { ...principal, userId: R1_P06_IDS.adminUserId };
    const adminList = await service.list({ principal: adminPrincipal, providerId: R1_P06_IDS.providerId });
    expect(adminList.items[0]).not.toHaveProperty("holderLegalName");
    const adminDetail = await service.detail({ principal: adminPrincipal, providerId: R1_P06_IDS.providerId, destinationVersionId: R1_P06_IDS.destinationVersionId });
    expect(adminDetail).not.toHaveProperty("holderLegalName");
  });

  it("creates wallet and bank drafts with encrypted values, deterministic fingerprints, and request correlation", async () => {
    const { service, repository } = payoutHarness();
    const wallet = await service.createDraft({
      principal,
      providerId: R1_P06_IDS.providerId,
      requestId: "request-wallet-create",
      draft: buildWalletDraft(),
    });
    expect(wallet).toMatchObject({ safeMask: expect.stringMatching(/^\+20/), holderLegalName: R1_P06_SENTINELS.holderName });
    const walletCommand = repository.createDraft.mock.calls[0]?.[0];
    expect(walletCommand).toMatchObject({
      kind: "MOBILE_WALLET",
      requestId: "request-wallet-create",
      countryCode: "EG",
      operatorId: "operator-test",
      currencyCode: null,
      bankId: null,
    });
    expect(walletCommand.identifierEnvelope.ciphertext).not.toContain(R1_P06_SENTINELS.wallet);
    expect(walletCommand.holderEnvelope.ciphertext).not.toContain(R1_P06_SENTINELS.holderName);
    expect(walletCommand.fingerprints).toHaveLength(1);

    await service.createDraft({
      principal,
      providerId: R1_P06_IDS.providerId,
      requestId: "request-bank-create",
      draft: buildBankDraft(),
    });
    expect(repository.createDraft).toHaveBeenLastCalledWith(expect.objectContaining({
      kind: "BANK_ACCOUNT",
      requestId: "request-bank-create",
      currencyCode: "EGP",
      operatorId: null,
      bankId: "bank-test",
    }));
  });

  it("updates a complete draft and preserves the caller request ID at the repository boundary", async () => {
    const { service, repository, storedRow } = payoutHarness();
    await expect(service.updateDraft({
      principal,
      providerId: R1_P06_IDS.providerId,
      destinationVersionId: R1_P06_IDS.destinationVersionId,
      expectedVersion: 1,
      requestId: "request-wallet-update",
      draft: buildWalletDraft(),
    })).resolves.toMatchObject({ holderLegalName: R1_P06_SENTINELS.holderName });
    expect(repository.updateDraft).toHaveBeenCalledWith(expect.objectContaining({
      destinationVersionId: R1_P06_IDS.destinationVersionId,
      expectedVersion: 1,
      requestId: "request-wallet-update",
      now,
    }));

    repository.read.mockResolvedValueOnce({ ...storedRow, status: "APPROVED", version: 7 });
    await expect(service.updateDraft({
      principal,
      providerId: R1_P06_IDS.providerId,
      destinationVersionId: R1_P06_IDS.destinationVersionId,
      expectedVersion: 1,
      requestId: "request-stale-update",
      draft: buildWalletDraft(),
    })).rejects.toThrow("PAYOUT_DESTINATION_VERSION_CONFLICT");
  });

  it("requires a proof-bound exact-version submit command", () => {
    expect(payoutSubmitBody.parse({ expectedVersion: 1, reauthenticationProof: "synthetic-proof-at-least-16", commandId: R1_P06_IDS.commandId })).toBeTruthy();
    expect(() => payoutSubmitBody.parse({ expectedVersion: 1, commandId: R1_P06_IDS.commandId })).toThrow();
  });

  it("submits with recent reauthentication and returns an exact replay without verifying twice", async () => {
    const { service, repository, proofVerifier, storedRow } = payoutHarness();
    await service.submit({
      principal,
      providerId: R1_P06_IDS.providerId,
      destinationVersionId: R1_P06_IDS.destinationVersionId,
      expectedVersion: 1,
      reauthenticationProof: "opaque-proof-at-least-16",
      commandId: R1_P06_IDS.commandId,
      requestId: "request-wallet-submit",
    });
    expect(proofVerifier.verify).toHaveBeenCalledWith(expect.objectContaining({
      purpose: "PROVIDER_PAYOUT_SUBMIT",
      maximumAgeSeconds: 600,
      requestId: "request-wallet-submit",
    }));
    expect(repository.submit).toHaveBeenCalledWith(expect.objectContaining({ proofId: "proof-r1p06", now }));

    repository.findPayoutSubmitReplay.mockResolvedValueOnce({ ...storedRow, status: "PENDING_VERIFICATION" });
    await service.submit({
      principal,
      providerId: R1_P06_IDS.providerId,
      destinationVersionId: R1_P06_IDS.destinationVersionId,
      expectedVersion: 1,
      reauthenticationProof: "opaque-proof-at-least-16",
      commandId: R1_P06_IDS.commandId,
      requestId: "request-wallet-submit",
    });
    expect(proofVerifier.verify).toHaveBeenCalledTimes(1);
  });

  it("creates an exact-version successor in the same chain and forwards request correlation", async () => {
    const { service, repository, storedRow } = payoutHarness();
    repository.read.mockResolvedValueOnce({
      ...storedRow,
      status: "APPROVED",
      version: 4,
      chain: { destinationTypeId: "type-wallet" },
    });
    await expect(service.createSuccessor({
      principal,
      providerId: R1_P06_IDS.providerId,
      predecessorVersionId: R1_P06_IDS.destinationVersionId,
      predecessorExpectedVersion: 4,
      requestId: "request-wallet-successor",
      draft: buildWalletDraft(),
    })).resolves.toMatchObject({ holderLegalName: R1_P06_SENTINELS.holderName });
    expect(repository.createSuccessor).toHaveBeenCalledWith(expect.objectContaining({
      requestId: "request-wallet-successor",
      predecessorVersionId: R1_P06_IDS.destinationVersionId,
      predecessorExpectedVersion: 4,
      sequence: 2,
      reuseChainId: R1_P06_IDS.chainId,
    }));
  });

  it("deduplicates before persistence and records only cross-Provider conflicts", async () => {
    const sameProvider = payoutHarness();
    sameProvider.repository.findCollision.mockResolvedValueOnce({ claimId: "claim-existing", claim: { providerId: R1_P06_IDS.providerId } });
    await expect(sameProvider.service.createDraft({
      principal,
      providerId: R1_P06_IDS.providerId,
      requestId: "request-same-provider-conflict",
      draft: buildWalletDraft(),
    })).rejects.toThrow("PAYOUT_SUCCESSOR_CONFLICT");
    expect(sameProvider.conflicts.record).not.toHaveBeenCalled();

    const crossProvider = payoutHarness();
    crossProvider.repository.findCollision.mockResolvedValueOnce({ claimId: "claim-incumbent", claim: { providerId: "another-provider" } });
    await expect(crossProvider.service.createDraft({
      principal,
      providerId: R1_P06_IDS.providerId,
      requestId: "request-cross-provider-conflict",
      draft: buildWalletDraft(),
    })).rejects.toThrow("PAYOUT_DESTINATION_CONFLICT");
    expect(crossProvider.conflicts.record).toHaveBeenCalledWith(expect.objectContaining({
      incumbentClaimId: "claim-incumbent",
      safeMask: expect.stringMatching(/^\+20/),
      requestId: "request-cross-provider-conflict",
    }));
  });

  it("fails closed for inactive or non-Owner principals and authoritative-name mismatches", async () => {
    const denied = payoutHarness();
    denied.repository.readAccess.mockResolvedValueOnce(providerAccess("ADMIN"));
    await expect(denied.service.createDraft({
      principal: { ...principal, userId: R1_P06_IDS.adminUserId },
      providerId: R1_P06_IDS.providerId,
      requestId: "request-admin-create",
      draft: buildWalletDraft(),
    })).rejects.toThrow("PROVIDER_SCOPE_DENIED");

    const mismatch = payoutHarness();
    mismatch.holderReader.readLegalNameFacts.mockResolvedValueOnce({ legalEntityName: "Different Company", ownerLegalName: "Different Owner" });
    await expect(mismatch.service.createDraft({
      principal,
      providerId: R1_P06_IDS.providerId,
      requestId: "request-name-mismatch",
      draft: buildWalletDraft(),
    })).rejects.toThrow("PAYOUT_HOLDER_NAME_MISMATCH");

    const inactive = payoutHarness();
    inactive.repository.readAccess.mockResolvedValueOnce({ ...providerAccess(), profile: { country: { id: "country-eg", code: "EG", isActive: false } } });
    await expect(inactive.service.options({ principal, providerId: R1_P06_IDS.providerId })).rejects.toThrow("PAYOUT_REGISTRY_INACTIVE");
  });

  it("fails closed across list, detail, country, identifier, submit, and successor boundaries", async () => {
    const deniedList = payoutHarness();
    await expect(deniedList.service.list({ principal: { ...principal, status: "SUSPENDED" }, providerId: R1_P06_IDS.providerId }))
      .rejects.toThrow("PROVIDER_SCOPE_DENIED");

    const missingDetail = payoutHarness();
    missingDetail.repository.read.mockResolvedValueOnce(null);
    await expect(missingDetail.service.detail({ principal, providerId: R1_P06_IDS.providerId, destinationVersionId: "missing" }))
      .rejects.toThrow("PAYOUT_DESTINATION_STATE_CONFLICT");

    const foreignCountry = payoutHarness();
    await expect(foreignCountry.service.createDraft({
      principal,
      providerId: R1_P06_IDS.providerId,
      requestId: "request-foreign-country",
      draft: buildWalletDraft({ countryCode: "SA" }),
    })).rejects.toThrow("PAYOUT_REGISTRY_INACTIVE");

    const invalidIban = payoutHarness();
    invalidIban.registries.resolveBank.mockResolvedValueOnce({ type: { id: "type-bank" }, bank: { id: "bank-test" }, policy: { ibanLengths: [27] } });
    await expect(invalidIban.service.createDraft({
      principal,
      providerId: R1_P06_IDS.providerId,
      requestId: "request-invalid-iban",
      draft: buildBankDraft(),
    })).rejects.toThrow("PAYOUT_IDENTIFIER_INVALID");

    const staleSubmit = payoutHarness();
    staleSubmit.repository.read.mockResolvedValueOnce(null);
    await expect(staleSubmit.service.submit({
      principal,
      providerId: R1_P06_IDS.providerId,
      destinationVersionId: "missing",
      expectedVersion: 1,
      reauthenticationProof: "opaque-proof-at-least-16",
      commandId: R1_P06_IDS.commandId,
      requestId: "request-stale-submit",
    })).rejects.toThrow("PAYOUT_DESTINATION_VERSION_CONFLICT");

    const wrongSuccessorType = payoutHarness();
    wrongSuccessorType.repository.read.mockResolvedValueOnce({ ...wrongSuccessorType.storedRow, status: "APPROVED", version: 4 });
    await expect(wrongSuccessorType.service.createSuccessor({
      principal,
      providerId: R1_P06_IDS.providerId,
      predecessorVersionId: R1_P06_IDS.destinationVersionId,
      predecessorExpectedVersion: 4,
      requestId: "request-wrong-successor-type",
      draft: buildBankDraft(),
    })).rejects.toThrow("PAYOUT_REGISTRY_INACTIVE");
  });

  it("records a cross-Provider claim discovered only after a raced unique-claim write", async () => {
    const raced = payoutHarness();
    raced.repository.createDraft.mockRejectedValueOnce(new Error("PAYOUT_DESTINATION_CONFLICT"));
    raced.repository.findCollision
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ claimId: "raced-incumbent-claim", claim: { providerId: "another-provider" } });
    await expect(raced.service.createDraft({
      principal,
      providerId: R1_P06_IDS.providerId,
      requestId: "request-raced-conflict",
      draft: buildWalletDraft(),
    })).rejects.toThrow("PAYOUT_DESTINATION_CONFLICT");
    expect(raced.conflicts.record).toHaveBeenCalledWith(expect.objectContaining({
      incumbentClaimId: "raced-incumbent-claim",
      requestId: "request-raced-conflict",
    }));
  });

  it("keeps Admin views masked and gives only the exact Owner holder name", () => {
    expect(mapPayoutAdminView(safeRow)).not.toHaveProperty("institution");
    expect(mapPayoutAdminView(safeRow)).not.toHaveProperty("holderRelationship");
    expect(mapPayoutOwnerView({ ...safeRow, holderLegalName: "Synthetic Owner" })).toMatchObject({ mask: "+20••••••5678", holderLegalName: "Synthetic Owner" });
  });
});
