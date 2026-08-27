import type { RecentAuthenticationProofVerifier } from "../authentication/authentication.public.js";
import type { PayoutRevealAuditGate } from "../admin/audit.public.js";
import type { PayoutKeyRings } from "./domain/provider-verification.types.js";
import { createPayoutDataCrypto } from "./infrastructure/payout-data-crypto.adapter.js";
import type { PrismaProviderPayoutRepository } from "./infrastructure/prisma-provider-payout.repository.js";
import { isMeaningfulSafeNote } from "./domain/provider-verification.catalog.js";

function normalizedForContainment(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en");
}

function assertRevealReasonExcludesProtectedValues(
  reason: string,
  protectedValues: readonly string[],
): void {
  const normalizedReason = normalizedForContainment(reason);
  if (protectedValues.some((value) => {
    const normalizedValue = normalizedForContainment(value);
    return normalizedValue.length > 0 && normalizedReason.includes(normalizedValue);
  })) {
    throw new Error("VALIDATION_ERROR");
  }
}

export class ProviderPayoutRevealService {
  private readonly crypto;
  public constructor(
    private readonly repository: PrismaProviderPayoutRepository,
    private readonly proofVerifier: RecentAuthenticationProofVerifier,
    private readonly auditGate: PayoutRevealAuditGate,
    private readonly authorizeStaff: (actorUserId: string, permission: "providers.payout-destinations.verify") => Promise<boolean>,
    rings: PayoutKeyRings,
    private readonly now: () => Date = () => new Date(),
  ) { this.crypto = createPayoutDataCrypto(rings); }
  public async reveal(input: {
    readonly actorUserId: string; readonly sessionId: string; readonly providerId: string;
    readonly destinationVersionId: string; readonly expectedVersion: number;
    readonly purpose: "MANUAL_PAYOUT_DESTINATION_VERIFICATION"; readonly reason: string;
    readonly stepUpProof: string; readonly commandId: string; readonly requestId: string;
  }) {
    let acceptedAuditPersisted = false;
    let revealReasonCheckedAgainstProtectedValues = false;
    let applicableEncryptionKeyIds: readonly string[] | undefined;
    let applicableLookupKeyIds: readonly string[] | undefined;
    try {
      if (!isMeaningfulSafeNote(input.reason)) throw new Error("VALIDATION_ERROR");
      if (!(await this.authorizeStaff(input.actorUserId, "providers.payout-destinations.verify"))) throw new Error("PROVIDER_SCOPE_DENIED");
      const proof = await this.proofVerifier.verify({ principalUserId: input.actorUserId, sessionId: input.sessionId, opaqueProof: input.stepUpProof, purpose: "STAFF_PAYOUT_REVEAL", providerId: input.providerId, destinationVersionId: input.destinationVersionId, requestId: input.requestId, maximumAgeSeconds: 300 });
      const committed = await this.repository.commitRevealGate({
        actorUserId: input.actorUserId,
        providerId: input.providerId,
        destinationVersionId: input.destinationVersionId,
        expectedVersion: input.expectedVersion,
        purpose: input.purpose,
        reasonCode: input.reason,
        requestId: input.requestId,
        proofId: proof.proofId,
        now: this.now(),
        prepareSensitiveResult: (row, authority) => {
          applicableEncryptionKeyIds = [row.identifierEncryptionKeyId, row.holderNameEncryptionKeyId];
          applicableLookupKeyIds = row.identityClaim.fingerprints.map((item) => item.lookupKeyId);
          const base = { providerId: row.providerId, destinationChainId: row.chainId, destinationVersionId: row.id, destinationSequence: row.sequence, destinationType: row.kind } as const;
          const identifier = this.crypto.decrypt({ ciphertext: row.identifierCiphertext, nonce: row.identifierNonce, authenticationTag: row.identifierTag, encryptionKeyId: row.identifierEncryptionKeyId }, { ...base, fieldName: "IDENTIFIER", encryptionKeyId: row.identifierEncryptionKeyId });
          const holderLegalName = this.crypto.decrypt({ ciphertext: row.holderNameCiphertext, nonce: row.holderNameNonce, authenticationTag: row.holderNameTag, encryptionKeyId: row.holderNameEncryptionKeyId }, { ...base, fieldName: "HOLDER_NAME", encryptionKeyId: row.holderNameEncryptionKeyId });
          const authoritativeHolderLegalName = row.holderRelationship === "PROVIDER_LEGAL_ENTITY"
            ? authority.legalEntityName
            : authority.ownerLegalName;
          if (authoritativeHolderLegalName === null) throw new Error("PAYOUT_HOLDER_AUTHORITY_UNAVAILABLE");
          assertRevealReasonExcludesProtectedValues(input.reason, [
            identifier,
            holderLegalName,
            authoritativeHolderLegalName,
          ]);
          revealReasonCheckedAgainstProtectedValues = true;
          return {
            type: row.kind,
            fullIdentifier: identifier,
            holderLegalName,
            authoritativeHolderLegalName,
            holderRelationship: row.holderRelationship,
            institution: row.operator === null ? row.bank === null ? null : { code: row.bank.code, label: row.bank.nameEn } : { code: row.operator.code, label: row.operator.labelEn },
          };
        },
      });
      if (!committed.audit.accepted) throw new Error(committed.audit.safeCode);
      acceptedAuditPersisted = true;
      return {
        destinationVersionId: input.destinationVersionId,
        revealAttemptId: committed.audit.attemptId,
        ...committed.sensitiveResult,
      };
    } catch (error) {
      const safeCode = error instanceof Error && /^[A-Z][A-Z0-9_]{2,99}$/u.test(error.message)
        ? error.message
        : "PAYOUT_REVEAL_DENIED";
      if (!acceptedAuditPersisted && safeCode !== "PAYOUT_REVEAL_RATE_LIMITED") {
        await this.auditGate.appendDeniedReveal({
          actorUserId: input.actorUserId,
          providerId: input.providerId,
          destinationVersionId: input.destinationVersionId,
          expectedVersion: input.expectedVersion,
          purpose: input.purpose,
          safeReason: revealReasonCheckedAgainstProtectedValues ? input.reason.trim() : safeCode,
          safeCode,
          requestId: input.requestId,
          ...(applicableEncryptionKeyIds === undefined ? {} : { encryptionKeyIds: applicableEncryptionKeyIds }),
          ...(applicableLookupKeyIds === undefined ? {} : { lookupKeyIds: applicableLookupKeyIds }),
          now: this.now(),
        });
      }
      throw error;
    }
  }
}
