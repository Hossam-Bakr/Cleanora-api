import type { PrismaProviderPayoutRepository } from "../../../src/modules/providers/infrastructure/prisma-provider-payout.repository.js";
import { createPayoutDataCrypto } from "../../../src/modules/providers/infrastructure/payout-data-crypto.adapter.js";
import { ProviderPayoutKeyRotationService } from "../../../src/modules/providers/provider-payout-key-rotation.service.js";
import type { PayoutKeyRings } from "../../../src/modules/providers/domain/provider-verification.types.js";

describe("R1-P06 mixed-key rotation", () => {
  const rings: PayoutKeyRings = {
    encryption: { activeKeyId: "enc-v2", keys: new Map([["enc-v1", Buffer.alloc(32, 0x11)], ["enc-v2", Buffer.alloc(32, 0x12)]]) },
    lookup: { activeKeyId: "lookup-v2", keys: new Map([["lookup-v1", Buffer.alloc(32, 0x21)], ["lookup-v2", Buffer.alloc(32, 0x22)]]) },
  };
  const crypto = createPayoutDataCrypto(rings);
  const base = { providerId: "provider-1", destinationChainId: "chain-1", destinationVersionId: "version-1", destinationSequence: 1, destinationType: "MOBILE_WALLET" as const };
  const identifier = crypto.encrypt("+201012345678", { ...base, fieldName: "IDENTIFIER", encryptionKeyId: "enc-v1" });
  const holder = crypto.encrypt("Synthetic Holder", { ...base, fieldName: "HOLDER_NAME", encryptionKeyId: "enc-v1" });

  it("re-encrypts one bounded batch without changing the business version", async () => {
    const updates: Array<Readonly<Record<string, unknown>>> = [];
    const progress: Array<Readonly<Record<string, unknown>>> = [];
    const repository = {
      async readRotationRun() { return { id: "run-1", purpose: "ENCRYPTION", status: "RUNNING", fromKeyIds: ["enc-v1"], batchSize: 10, cursor: null, version: 1 }; },
      async listEncryptionRotationCandidates() {
        return [{
          id: "version-1", providerId: "provider-1", chainId: "chain-1", sequence: 1, kind: "MOBILE_WALLET",
          identifierCiphertext: identifier.ciphertext, identifierNonce: identifier.nonce, identifierTag: identifier.authenticationTag,
          identifierEncryptionKeyId: identifier.encryptionKeyId, holderNameCiphertext: holder.ciphertext,
          holderNameNonce: holder.nonce, holderNameTag: holder.authenticationTag, holderNameEncryptionKeyId: holder.encryptionKeyId,
          cryptoRevision: 4, version: 9,
        }];
      },
      async updateEncryptionRotation(input: Readonly<Record<string, unknown>>) { updates.push(input); },
      async countKeyReferences() { return 0; },
      async updateRotationProgress(input: Readonly<Record<string, unknown>>) { progress.push(input); return input; },
    } as unknown as PrismaProviderPayoutRepository;
    const service = new ProviderPayoutKeyRotationService(repository, rings);
    await service.runBatch("run-1");
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ destinationVersionId: "version-1", expectedCryptoRevision: 4 });
    expect(updates[0]).not.toHaveProperty("expectedVersion");
    expect(progress[0]).toMatchObject({ scanned: 1, updated: 1, failed: 0, complete: true, remainingReferenceCount: 0 });
  });

  it("blocks active-key self-rotation and human retirement with remaining references", async () => {
    const repository = {
      async createRotationRun() { return { id: "run-1" }; },
      async countKeyReferences() { return 2; },
      async approveRotationRetirement(input: object) { return input; },
    } as unknown as PrismaProviderPayoutRepository;
    const service = new ProviderPayoutKeyRotationService(repository, rings);
    expect(() => service.start({ purpose: "ENCRYPTION", fromKeyIds: ["enc-v2"], batchSize: 10, startedByUserId: "staff-1", commandId: "command-1" })).toThrow("PAYOUT_KEY_ROTATION_CONFLICT");
    await expect(service.verifyRetirement({ purpose: "ENCRYPTION", oldKeyId: "enc-v1", approvedByUserId: "staff-1", reason: "Validated old key reference coverage" })).resolves.toEqual({ remainingReferenceCount: 2, retirementApproved: false });
  });

  it("rewinds a failed batch so retained old-key references remain retryable", async () => {
    const progress: Array<Readonly<Record<string, unknown>>> = [];
    const repository = {
      async readRotationRun() { return { id: "run-1", purpose: "ENCRYPTION", status: "RUNNING", fromKeyIds: ["enc-v1"], batchSize: 10, cursor: "before", version: 2, startedByUserId: "staff-1" }; },
      async listEncryptionRotationCandidates() {
        return [{
          id: "version-1", providerId: "provider-1", chainId: "chain-1", sequence: 1, kind: "MOBILE_WALLET",
          identifierCiphertext: "invalid", identifierNonce: identifier.nonce, identifierTag: identifier.authenticationTag,
          identifierEncryptionKeyId: identifier.encryptionKeyId, holderNameCiphertext: holder.ciphertext,
          holderNameNonce: holder.nonce, holderNameTag: holder.authenticationTag, holderNameEncryptionKeyId: holder.encryptionKeyId,
          cryptoRevision: 4,
        }];
      },
      async countKeyReferences() { return 1; },
      async updateRotationProgress(input: Readonly<Record<string, unknown>>) { progress.push(input); return input; },
    } as unknown as PrismaProviderPayoutRepository;
    const service = new ProviderPayoutKeyRotationService(repository, rings);
    await service.runBatch("run-1", "staff-1");
    expect(progress[0]).toMatchObject({
      cursor: null,
      failed: 1,
      complete: false,
      remainingReferenceCount: 1,
      lastSafeErrorCode: "PAYOUT_KEY_ROTATION_ITEM_FAILED",
    });
  });

  it("rejects duplicate, unavailable, and out-of-range rotation inputs", () => {
    const repository = { createRotationRun: vi.fn() } as unknown as PrismaProviderPayoutRepository;
    const service = new ProviderPayoutKeyRotationService(repository, rings);
    const baseInput = { purpose: "ENCRYPTION" as const, batchSize: 10, startedByUserId: "staff-1", commandId: "command-1" };
    expect(() => service.start({ ...baseInput, fromKeyIds: ["enc-v1", "enc-v1"] })).toThrow("PAYOUT_KEY_ROTATION_CONFLICT");
    expect(() => service.start({ ...baseInput, fromKeyIds: ["enc-missing"] })).toThrow("PAYOUT_KEY_ROTATION_CONFLICT");
    expect(() => service.start({ ...baseInput, fromKeyIds: ["enc-v1"], batchSize: 1001 })).toThrow("PAYOUT_KEY_ROTATION_CONFLICT");
    expect(repository.createRotationRun).not.toHaveBeenCalled();
  });
});
