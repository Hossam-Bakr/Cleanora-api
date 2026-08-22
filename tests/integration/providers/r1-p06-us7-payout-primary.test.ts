import {
  assertPrimaryRemoval,
  derivePayoutDestinationReady,
  isPayoutVersionPrimaryEligible,
  shouldInitializeFirstPrimary,
  shouldRestoreFormerPrimary,
} from "../../../src/modules/providers/domain/provider-payout-primary.policy.js";
import { ProviderPayoutVerificationService } from "../../../src/modules/providers/provider-payout-verification.service.js";
import { createPayoutDataCrypto } from "../../../src/modules/providers/infrastructure/payout-data-crypto.adapter.js";
import { PrismaProviderPayoutRepository } from "../../../src/modules/providers/infrastructure/prisma-provider-payout.repository.js";
import { r1P06TestKeyRing } from "../../helpers/r1-p06-test-doubles.js";
import { R1_P06_IDS, R1_P06_SENTINELS } from "../../helpers/r1-p06-fixtures.js";

describe("R1-P06 US7 primary lifecycle", () => {
  it("initializes readiness only from an effective approved primary", () => {
    expect(isPayoutVersionPrimaryEligible({ status: "APPROVED", isCurrentVersion: true, isEffectiveApprovedVersion: true })).toBe(true);
    expect(derivePayoutDestinationReady({ primaryDestinationVersionId: "approved-v1", currentApprovedDestinationVersionIds: ["approved-v1"] })).toBe(true);
    expect(derivePayoutDestinationReady({ primaryDestinationVersionId: "pending-v2", currentApprovedDestinationVersionIds: ["approved-v1"] })).toBe(false);
  });

  it("requires atomic replacement when another approved destination exists", () => {
    expect(() => assertPrimaryRemoval({ isPrimary: true, otherApprovedDestinationIds: ["approved-v2"], replacementPrimaryDestinationVersionId: null, acknowledgeReadinessLoss: false })).toThrow("PAYOUT_PRIMARY_CONFLICT");
    expect(() => assertPrimaryRemoval({ isPrimary: true, otherApprovedDestinationIds: ["approved-v2"], replacementPrimaryDestinationVersionId: "approved-v2", acknowledgeReadinessLoss: false })).not.toThrow();
  });

  it("restores a challenged former primary only when the primary state did not move", () => {
    expect(shouldRestoreFormerPrimary({ formerPrimaryEligible: true, primaryStateVersionAtChallenge: 4, currentPrimaryStateVersion: 4 })).toBe(true);
    expect(shouldRestoreFormerPrimary({ formerPrimaryEligible: true, primaryStateVersionAtChallenge: 4, currentPrimaryStateVersion: 5 })).toBe(false);
  });

  it("does not auto-promote an unrelated approval after Staff clears a former primary", () => {
    expect(shouldInitializeFirstPrimary({
      primaryDestinationVersionId: null,
      predecessorVersionId: null,
      primaryStateVersion: 3,
    })).toBe(false);
  });

  it("rejects approval when the current authoritative Owner name changed after submission", async () => {
    const rings = r1P06TestKeyRing();
    const crypto = createPayoutDataCrypto(rings);
    const aad = {
      providerId: R1_P06_IDS.providerId,
      destinationChainId: R1_P06_IDS.chainId,
      destinationVersionId: R1_P06_IDS.destinationVersionId,
      destinationSequence: 1,
      destinationType: "MOBILE_WALLET" as const,
      fieldName: "HOLDER_NAME" as const,
      encryptionKeyId: rings.encryption.activeKeyId,
    };
    const storedHolder = crypto.encrypt(R1_P06_SENTINELS.holderName, aad);
    const storedIdentifier = crypto.encrypt(R1_P06_SENTINELS.wallet, { ...aad, fieldName: "IDENTIFIER" });
    const decide = vi.fn();
    const repository = {
      async findPayoutDecisionReplay() { return null; },
      async readHolderAuthority() {
        return {
          kind: "REGISTERED_COMPANY" as const,
          applicationStatus: "APPROVED" as const,
          applicationOwnerUserId: "applicant-1",
          ownerUserId: "current-owner-2",
          members: [{ userId: "current-owner-2" }],
        };
      },
      async read() {
        return {
          id: R1_P06_IDS.destinationVersionId,
          providerId: R1_P06_IDS.providerId,
          chainId: R1_P06_IDS.chainId,
          sequence: 1,
          kind: "MOBILE_WALLET" as const,
          status: "PENDING_VERIFICATION" as const,
          version: 3,
          holderRelationship: "PROVIDER_OWNER" as const,
          identifierCiphertext: storedIdentifier.ciphertext,
          identifierNonce: storedIdentifier.nonce,
          identifierTag: storedIdentifier.authenticationTag,
          identifierEncryptionKeyId: storedIdentifier.encryptionKeyId,
          holderNameCiphertext: storedHolder.ciphertext,
          holderNameNonce: storedHolder.nonce,
          holderNameTag: storedHolder.authenticationTag,
          holderNameEncryptionKeyId: storedHolder.encryptionKeyId,
        };
      },
      decide,
    };
    const service = new ProviderPayoutVerificationService(
      repository as never,
      async () => true,
      async () => true,
      { async readLegalNameFacts() { return { legalEntityName: "Synthetic Company", ownerLegalName: "Different Current Owner" }; } },
      rings,
    );
    await expect(service.decide({
      actorUserId: R1_P06_IDS.staffUserId,
      providerId: R1_P06_IDS.providerId,
      destinationVersionId: R1_P06_IDS.destinationVersionId,
      expectedVersion: 3,
      outcome: "APPROVE",
      verificationMethod: "MANUAL_WALLET_TRANSFER_CHECK",
      reasonCode: "VERIFIED_MATCH",
      verificationNote: "Manual wallet beneficiary lookup completed",
      acceptedRevealAttemptId: "accepted-attempt-1",
      commandId: R1_P06_IDS.commandId,
      requestId: R1_P06_IDS.requestId,
    })).rejects.toThrow("PAYOUT_HOLDER_NAME_MISMATCH");
    expect(decide).not.toHaveBeenCalled();
  });

  it("passes the exact decrypted and authoritative holder facts into the committing approval", async () => {
    const rings = r1P06TestKeyRing();
    const crypto = createPayoutDataCrypto(rings);
    const aad = {
      providerId: R1_P06_IDS.providerId,
      destinationChainId: R1_P06_IDS.chainId,
      destinationVersionId: R1_P06_IDS.destinationVersionId,
      destinationSequence: 1,
      destinationType: "MOBILE_WALLET" as const,
      fieldName: "HOLDER_NAME" as const,
      encryptionKeyId: rings.encryption.activeKeyId,
    };
    const storedHolder = crypto.encrypt(R1_P06_SENTINELS.holderName, aad);
    const storedIdentifier = crypto.encrypt(R1_P06_SENTINELS.wallet, { ...aad, fieldName: "IDENTIFIER" });
    const decide = vi.fn().mockResolvedValue({ id: "decision-1" });
    const repository = {
      findPayoutDecisionReplay: vi.fn().mockResolvedValue(null),
      readHolderAuthority: vi.fn().mockResolvedValue({
        kind: "REGISTERED_COMPANY",
        applicationStatus: "APPROVED",
        applicationOwnerUserId: "applicant-1",
        ownerUserId: "owner-1",
        members: [{ userId: "owner-1" }],
      }),
      read: vi.fn().mockResolvedValue({
        id: R1_P06_IDS.destinationVersionId,
        providerId: R1_P06_IDS.providerId,
        chainId: R1_P06_IDS.chainId,
        sequence: 1,
        kind: "MOBILE_WALLET",
        status: "PENDING_VERIFICATION",
        version: 3,
        holderRelationship: "PROVIDER_OWNER",
        identifierCiphertext: storedIdentifier.ciphertext,
        identifierNonce: storedIdentifier.nonce,
        identifierTag: storedIdentifier.authenticationTag,
        identifierEncryptionKeyId: storedIdentifier.encryptionKeyId,
        holderNameCiphertext: storedHolder.ciphertext,
        holderNameNonce: storedHolder.nonce,
        holderNameTag: storedHolder.authenticationTag,
        holderNameEncryptionKeyId: storedHolder.encryptionKeyId,
      }),
      decide,
    };
    const service = new ProviderPayoutVerificationService(
      repository as never,
      async () => true,
      async () => true,
      { async readLegalNameFacts() { return { legalEntityName: "Synthetic Company", ownerLegalName: R1_P06_SENTINELS.holderName }; } },
      rings,
    );
    await expect(service.decide({
      actorUserId: R1_P06_IDS.staffUserId,
      providerId: R1_P06_IDS.providerId,
      destinationVersionId: R1_P06_IDS.destinationVersionId,
      expectedVersion: 3,
      outcome: "APPROVE",
      verificationMethod: "MANUAL_WALLET_TRANSFER_CHECK",
      reasonCode: "VERIFIED_MATCH",
      verificationNote: `Beneficiary shown as ${R1_P06_SENTINELS.holderName}`,
      acceptedRevealAttemptId: "accepted-attempt-1",
      commandId: R1_P06_IDS.commandId,
      requestId: R1_P06_IDS.requestId,
    })).rejects.toThrow("VALIDATION_ERROR");
    expect(decide).not.toHaveBeenCalled();
    await service.decide({
      actorUserId: R1_P06_IDS.staffUserId,
      providerId: R1_P06_IDS.providerId,
      destinationVersionId: R1_P06_IDS.destinationVersionId,
      expectedVersion: 3,
      outcome: "APPROVE",
      verificationMethod: "MANUAL_WALLET_TRANSFER_CHECK",
      reasonCode: "VERIFIED_MATCH",
      verificationNote: "Manual wallet beneficiary lookup completed",
      acceptedRevealAttemptId: "accepted-attempt-1",
      commandId: R1_P06_IDS.commandId,
      requestId: R1_P06_IDS.requestId,
    });
    expect(decide).toHaveBeenCalledWith(expect.objectContaining({
      approvalHolderAuthority: {
        holderRelationship: "PROVIDER_OWNER",
        authoritativeHolderLegalName: R1_P06_SENTINELS.holderName,
        protectedHolderMatches: expect.any(Function),
      },
    }));
  });

  it("allows Staff to invalidate an exact approved version without requiring a reveal", async () => {
    const rings = r1P06TestKeyRing();
    const crypto = createPayoutDataCrypto(rings);
    const protectedContext = {
      providerId: R1_P06_IDS.providerId,
      destinationChainId: R1_P06_IDS.chainId,
      destinationVersionId: R1_P06_IDS.destinationVersionId,
      destinationSequence: 1,
      destinationType: "MOBILE_WALLET" as const,
      encryptionKeyId: rings.encryption.activeKeyId,
    };
    const identifier = crypto.encrypt(R1_P06_SENTINELS.wallet, { ...protectedContext, fieldName: "IDENTIFIER" });
    const holder = crypto.encrypt(R1_P06_SENTINELS.holderName, { ...protectedContext, fieldName: "HOLDER_NAME" });
    const decide = vi.fn().mockResolvedValue({ id: "decision-invalidate-1" });
    const repository = {
      findPayoutDecisionReplay: vi.fn().mockResolvedValue(null),
      readHolderAuthority: vi.fn().mockResolvedValue({ applicationStatus: "APPROVED" }),
      read: vi.fn().mockResolvedValue({
        id: R1_P06_IDS.destinationVersionId,
        providerId: R1_P06_IDS.providerId,
        chainId: R1_P06_IDS.chainId,
        sequence: 1,
        kind: "MOBILE_WALLET",
        status: "APPROVED",
        version: 4,
        holderRelationship: "PROVIDER_OWNER",
        identifierCiphertext: identifier.ciphertext,
        identifierNonce: identifier.nonce,
        identifierTag: identifier.authenticationTag,
        identifierEncryptionKeyId: identifier.encryptionKeyId,
        holderNameCiphertext: holder.ciphertext,
        holderNameNonce: holder.nonce,
        holderNameTag: holder.authenticationTag,
        holderNameEncryptionKeyId: holder.encryptionKeyId,
      }),
      decide,
    };
    const acceptedRevealBelongsToDecision = vi.fn();
    const holderReader = { readLegalNameFacts: vi.fn() };
    const service = new ProviderPayoutVerificationService(
      repository as never,
      async () => true,
      acceptedRevealBelongsToDecision,
      holderReader as never,
      rings,
    );
    await expect(service.decide({
      actorUserId: R1_P06_IDS.staffUserId,
      providerId: R1_P06_IDS.providerId,
      destinationVersionId: R1_P06_IDS.destinationVersionId,
      expectedVersion: 4,
      outcome: "INVALIDATE",
      verificationMethod: "MANUAL_WALLET_TRANSFER_CHECK",
      reasonCode: "DESTINATION_INVALIDATED",
      verificationNote: "Destination invalidated after an operational review",
      acceptedRevealAttemptId: null,
      commandId: R1_P06_IDS.commandId,
      requestId: R1_P06_IDS.requestId,
    })).resolves.toEqual({ id: "decision-invalidate-1" });
    expect(acceptedRevealBelongsToDecision).not.toHaveBeenCalled();
    expect(holderReader.readLegalNameFacts).not.toHaveBeenCalled();
    expect(decide).toHaveBeenCalledWith(expect.objectContaining({
      outcome: "INVALIDATE",
      acceptedRevealAttemptId: null,
    }));
  });

  it("rejects an outcome/reason mismatch and validates every supplied reveal reference", async () => {
    const rings = r1P06TestKeyRing();
    const crypto = createPayoutDataCrypto(rings);
    const protectedContext = {
      providerId: R1_P06_IDS.providerId,
      destinationChainId: R1_P06_IDS.chainId,
      destinationVersionId: R1_P06_IDS.destinationVersionId,
      destinationSequence: 1,
      destinationType: "MOBILE_WALLET" as const,
      encryptionKeyId: rings.encryption.activeKeyId,
    };
    const identifier = crypto.encrypt(R1_P06_SENTINELS.wallet, { ...protectedContext, fieldName: "IDENTIFIER" });
    const holder = crypto.encrypt(R1_P06_SENTINELS.holderName, { ...protectedContext, fieldName: "HOLDER_NAME" });
    const decide = vi.fn().mockResolvedValue({ id: "decision-reject-1" });
    const repository = {
      findPayoutDecisionReplay: vi.fn().mockResolvedValue(null),
      readHolderAuthority: vi.fn().mockResolvedValue({ applicationStatus: "APPROVED" }),
      read: vi.fn().mockResolvedValue({
        id: R1_P06_IDS.destinationVersionId,
        providerId: R1_P06_IDS.providerId,
        chainId: R1_P06_IDS.chainId,
        sequence: 1,
        kind: "MOBILE_WALLET",
        status: "PENDING_VERIFICATION",
        version: 3,
        holderRelationship: "PROVIDER_OWNER",
        identifierCiphertext: identifier.ciphertext,
        identifierNonce: identifier.nonce,
        identifierTag: identifier.authenticationTag,
        identifierEncryptionKeyId: identifier.encryptionKeyId,
        holderNameCiphertext: holder.ciphertext,
        holderNameNonce: holder.nonce,
        holderNameTag: holder.authenticationTag,
        holderNameEncryptionKeyId: holder.encryptionKeyId,
      }),
      decide,
    };
    const acceptedRevealBelongsToDecision = vi.fn().mockResolvedValue(false);
    const service = new ProviderPayoutVerificationService(
      repository as never,
      async () => true,
      acceptedRevealBelongsToDecision,
      {} as never,
      rings,
    );
    const base = {
      actorUserId: R1_P06_IDS.staffUserId,
      providerId: R1_P06_IDS.providerId,
      destinationVersionId: R1_P06_IDS.destinationVersionId,
      expectedVersion: 3,
      outcome: "REJECT" as const,
      verificationMethod: "MANUAL_WALLET_TRANSFER_CHECK" as const,
      verificationNote: "Manual beneficiary lookup could not verify the account",
      acceptedRevealAttemptId: "accepted-attempt-unbound",
      commandId: R1_P06_IDS.commandId,
      requestId: R1_P06_IDS.requestId,
    };
    await expect(service.decide({ ...base, reasonCode: "VERIFIED_MATCH" })).rejects.toThrow("VALIDATION_ERROR");
    expect(repository.read).not.toHaveBeenCalled();
    await expect(service.decide({ ...base, reasonCode: "BENEFICIARY_UNAVAILABLE" })).rejects.toThrow("PAYOUT_STEP_UP_REQUIRED");
    expect(acceptedRevealBelongsToDecision).toHaveBeenCalledWith(expect.objectContaining({
      attemptId: "accepted-attempt-unbound",
      expectedVersion: 3,
    }));
    expect(decide).not.toHaveBeenCalled();
  });

  it("returns a matching Staff replay before re-reading the now-approved destination", async () => {
    const prior = { id: "decision-1", outcome: "APPROVE" };
    const repository = {
      findPayoutDecisionReplay: vi.fn().mockResolvedValue(prior),
      readHolderAuthority: vi.fn(),
      read: vi.fn(),
      decide: vi.fn(),
    };
    const service = new ProviderPayoutVerificationService(repository as never, async () => true, async () => true, {} as never, r1P06TestKeyRing());
    await expect(service.decide({
      actorUserId: R1_P06_IDS.staffUserId,
      providerId: R1_P06_IDS.providerId,
      destinationVersionId: R1_P06_IDS.destinationVersionId,
      expectedVersion: 3,
      outcome: "APPROVE",
      verificationMethod: "MANUAL_WALLET_TRANSFER_CHECK",
      reasonCode: "VERIFIED_MATCH",
      verificationNote: "Manual wallet beneficiary lookup completed",
      acceptedRevealAttemptId: "accepted-attempt-1",
      commandId: R1_P06_IDS.commandId,
      requestId: R1_P06_IDS.requestId,
    })).resolves.toBe(prior);
    expect(repository.read).not.toHaveBeenCalled();
    expect(repository.decide).not.toHaveBeenCalled();
  });

  it("returns an exact prior Staff decision but rejects an altered replay", async () => {
    const prior = {
      id: "decision-1",
      providerId: R1_P06_IDS.providerId,
      destinationVersionId: R1_P06_IDS.destinationVersionId,
      expectedDestinationVersion: 3,
      outcome: "APPROVE",
      verificationMethod: "MANUAL_WALLET_TRANSFER_CHECK",
      reasonCode: "VERIFIED_MATCH",
      verificationNote: "Manual wallet beneficiary lookup completed",
      actorUserId: R1_P06_IDS.staffUserId,
      acceptedRevealAttemptId: "accepted-attempt-1",
      requestId: R1_P06_IDS.requestId,
    };
    const repository = new PrismaProviderPayoutRepository({
      providerPayoutDecision: { findUnique: vi.fn().mockResolvedValue(prior) },
    } as never);
    const command = {
      providerId: prior.providerId,
      destinationVersionId: prior.destinationVersionId,
      expectedVersion: prior.expectedDestinationVersion,
      outcome: prior.outcome as "APPROVE",
      verificationMethod: prior.verificationMethod as "MANUAL_WALLET_TRANSFER_CHECK",
      reasonCode: prior.reasonCode,
      verificationNote: prior.verificationNote,
      acceptedRevealAttemptId: prior.acceptedRevealAttemptId,
      actorUserId: prior.actorUserId,
      commandId: R1_P06_IDS.commandId,
      requestId: prior.requestId,
      now: new Date("2026-08-13T20:00:00.000Z"),
    };
    await expect(repository.decide(command)).resolves.toBe(prior);
    await expect(repository.decide({ ...command, verificationNote: "Different verification result" }))
      .rejects.toThrow("PAYOUT_DESTINATION_VERSION_CONFLICT");
  });
});
