import { isMeaningfulSafeNote } from "./domain/provider-verification.catalog.js";
import type { PayoutKeyRings } from "./domain/provider-verification.types.js";
import { createPayoutDataCrypto, payoutLookupFingerprints } from "./infrastructure/payout-data-crypto.adapter.js";
import type { PrismaProviderPayoutRepository } from "./infrastructure/prisma-provider-payout.repository.js";

export class ProviderPayoutKeyRotationService {
  private readonly crypto;
  public constructor(
    private readonly repository: PrismaProviderPayoutRepository,
    private readonly rings: PayoutKeyRings,
    private readonly now: () => Date = () => new Date(),
  ) { this.crypto = createPayoutDataCrypto(rings); }

  public start(input: {
    readonly purpose: "ENCRYPTION" | "LOOKUP_HMAC";
    readonly fromKeyIds: readonly string[];
    readonly batchSize: number;
    readonly startedByUserId: string;
    readonly commandId: string;
  }) {
    const activeKeyId = input.purpose === "ENCRYPTION" ? this.rings.encryption.activeKeyId : this.rings.lookup.activeKeyId;
    const availableKeys = input.purpose === "ENCRYPTION" ? this.rings.encryption.keys : this.rings.lookup.keys;
    if (
      input.fromKeyIds.length === 0 ||
      new Set(input.fromKeyIds).size !== input.fromKeyIds.length ||
      input.fromKeyIds.includes(activeKeyId) ||
      input.fromKeyIds.some((keyId) => !availableKeys.has(keyId)) ||
      !Number.isInteger(input.batchSize) ||
      input.batchSize < 1 ||
      input.batchSize > 1000
    ) throw new Error("PAYOUT_KEY_ROTATION_CONFLICT");
    return this.repository.createRotationRun({ ...input, toActiveKeyId: activeKeyId });
  }

  public async runBatch(runId: string, verifiedByUserId?: string) {
    const run = await this.repository.readRotationRun(runId);
    if (run === null || !["RUNNING", "VERIFYING"].includes(run.status)) throw new Error("PAYOUT_KEY_ROTATION_CONFLICT");
    let updated = 0;
    let failed = 0;
    let cursor = run.cursor;
    if (run.purpose === "ENCRYPTION") {
      const rows = await this.repository.listEncryptionRotationCandidates({ fromKeyIds: run.fromKeyIds, cursor, limit: run.batchSize });
      for (const row of rows) {
        cursor = row.id;
        try {
          const base = { providerId: row.providerId, destinationChainId: row.chainId, destinationVersionId: row.id, destinationSequence: row.sequence, destinationType: row.kind } as const;
          const identifier = this.crypto.decrypt({ ciphertext: row.identifierCiphertext, nonce: row.identifierNonce, authenticationTag: row.identifierTag, encryptionKeyId: row.identifierEncryptionKeyId }, { ...base, fieldName: "IDENTIFIER", encryptionKeyId: row.identifierEncryptionKeyId });
          const holderName = this.crypto.decrypt({ ciphertext: row.holderNameCiphertext, nonce: row.holderNameNonce, authenticationTag: row.holderNameTag, encryptionKeyId: row.holderNameEncryptionKeyId }, { ...base, fieldName: "HOLDER_NAME", encryptionKeyId: row.holderNameEncryptionKeyId });
          const activeKeyId = this.rings.encryption.activeKeyId;
          await this.repository.updateEncryptionRotation({
            destinationVersionId: row.id,
            expectedCryptoRevision: row.cryptoRevision,
            identifierEnvelope: this.crypto.encrypt(identifier, { ...base, fieldName: "IDENTIFIER", encryptionKeyId: activeKeyId }),
            holderEnvelope: this.crypto.encrypt(holderName, { ...base, fieldName: "HOLDER_NAME", encryptionKeyId: activeKeyId }),
          });
          updated += 1;
        } catch { failed += 1; }
      }
      const exhaustedCursorWindow = rows.length < run.batchSize;
      const remainingReferenceCount = exhaustedCursorWindow
        ? (await Promise.all(run.fromKeyIds.map((keyId) => this.repository.countKeyReferences({ encryptionKeyId: keyId })))).reduce((sum, value) => sum + value, 0)
        : null;
      const complete = remainingReferenceCount === 0;
      return this.repository.updateRotationProgress({
        runId,
        expectedVersion: run.version,
        cursor: failed > 0 || (exhaustedCursorWindow && !complete) ? null : cursor,
        scanned: rows.length,
        updated,
        failed,
        complete,
        remainingReferenceCount,
        verifiedByUserId: complete ? (verifiedByUserId ?? run.startedByUserId) : null,
        lastSafeErrorCode: failed > 0 ? "PAYOUT_KEY_ROTATION_ITEM_FAILED" : null,
      });
    }

    const claims = await this.repository.listLookupRotationCandidates({ fromKeyIds: run.fromKeyIds, cursor, limit: run.batchSize });
    for (const claim of claims) {
      cursor = claim.id;
      const row = claim.destinationVersions[0];
      if (row === undefined) { failed += 1; continue; }
      try {
        const base = { providerId: row.providerId, destinationChainId: row.chainId, destinationVersionId: row.id, destinationSequence: row.sequence, destinationType: row.kind } as const;
        const identifier = this.crypto.decrypt({ ciphertext: row.identifierCiphertext, nonce: row.identifierNonce, authenticationTag: row.identifierTag, encryptionKeyId: row.identifierEncryptionKeyId }, { ...base, fieldName: "IDENTIFIER", encryptionKeyId: row.identifierEncryptionKeyId });
        const fingerprints = payoutLookupFingerprints(this.rings.lookup, row.kind === "MOBILE_WALLET"
          ? { kind: "MOBILE_WALLET", countryCode: row.countryCode, normalizedIdentifier: identifier }
          : { kind: "BANK_ACCOUNT", normalizedIdentifier: identifier });
        await this.repository.updateLookupRotation({
          claimId: claim.id,
          claimStatus: claim.status,
          fromKeyIds: run.fromKeyIds,
          fingerprints,
          now: this.now(),
        });
        updated += 1;
      } catch { failed += 1; }
    }
    const exhaustedCursorWindow = claims.length < run.batchSize;
    const remainingReferenceCount = exhaustedCursorWindow
      ? (await Promise.all(run.fromKeyIds.map((keyId) => this.repository.countKeyReferences({ lookupKeyId: keyId })))).reduce((sum, value) => sum + value, 0)
      : null;
    const complete = remainingReferenceCount === 0;
    return this.repository.updateRotationProgress({
      runId,
      expectedVersion: run.version,
      cursor: failed > 0 || (exhaustedCursorWindow && !complete) ? null : cursor,
      scanned: claims.length,
      updated,
      failed,
      complete,
      remainingReferenceCount,
      verifiedByUserId: complete ? (verifiedByUserId ?? run.startedByUserId) : null,
      lastSafeErrorCode: failed > 0 ? "PAYOUT_KEY_ROTATION_ITEM_FAILED" : null,
    });
  }

  public async verifyRetirement(input: {
    readonly purpose: "ENCRYPTION" | "LOOKUP_HMAC";
    readonly oldKeyId: string;
    readonly approvedByUserId: string;
    readonly reason: string;
  }): Promise<{ readonly remainingReferenceCount: number; readonly retirementApproved: boolean }> {
    if (!isMeaningfulSafeNote(input.reason)) throw new Error("VALIDATION_ERROR");
    const remainingReferenceCount = await this.repository.countKeyReferences(input.purpose === "ENCRYPTION" ? { encryptionKeyId: input.oldKeyId } : { lookupKeyId: input.oldKeyId });
    return { remainingReferenceCount, retirementApproved: remainingReferenceCount === 0 };
  }

  public async approveRetirement(input: {
    readonly runId: string;
    readonly expectedVersion: number;
    readonly approvedByUserId: string;
    readonly reason: string;
  }) {
    if (!isMeaningfulSafeNote(input.reason)) throw new Error("VALIDATION_ERROR");
    return this.repository.approveRotationRetirement({ ...input, now: this.now() });
  }
}
