import {
  assertSafeNoteExcludesProtectedValues,
  isMeaningfulSafeNote,
  isPayoutDecisionReasonAllowed,
} from "./domain/provider-verification.catalog.js";
import type { ProviderPayoutHolderAuthorityReader } from "../customers/customers.public.js";
import type { PayoutKeyRings } from "./domain/provider-verification.types.js";
import { createPayoutDataCrypto } from "./infrastructure/payout-data-crypto.adapter.js";
import type { PrismaProviderPayoutRepository } from "./infrastructure/prisma-provider-payout.repository.js";
import type { ProviderDenialAuditService } from "./provider-denial-audit.service.js";

export class ProviderPayoutVerificationService {
  private readonly crypto;
  public constructor(
    private readonly repository: PrismaProviderPayoutRepository,
    private readonly authorizeStaff: (actorUserId: string, permission: "providers.payout-destinations.verify") => Promise<boolean>,
    private readonly acceptedRevealBelongsToDecision: (input: {
      readonly attemptId: string;
      readonly actorUserId: string;
      readonly providerId: string;
      readonly destinationVersionId: string;
      readonly expectedVersion: number;
      readonly purpose: "MANUAL_PAYOUT_DESTINATION_VERIFICATION";
    }) => Promise<boolean>,
    private readonly holderReader: ProviderPayoutHolderAuthorityReader,
    rings: PayoutKeyRings,
    private readonly now: () => Date = () => new Date(),
    private readonly denialAudit?: ProviderDenialAuditService,
  ) { this.crypto = createPayoutDataCrypto(rings); }
  public async decide(input: {
    readonly actorUserId: string; readonly providerId: string; readonly destinationVersionId: string;
    readonly expectedVersion: number; readonly outcome: "APPROVE" | "REJECT" | "REQUEST_CHANGES" | "REQUEST_REPLACEMENT" | "INVALIDATE";
    readonly verificationMethod: "MANUAL_WALLET_TRANSFER_CHECK" | "MANUAL_BANK_BENEFICIARY_CHECK";
    readonly reasonCode: string; readonly verificationNote: string; readonly acceptedRevealAttemptId: string | null;
    readonly commandId: string; readonly requestId: string;
  }) {
    if (!(await this.authorizeStaff(input.actorUserId, "providers.payout-destinations.verify"))) {
      if (this.denialAudit !== undefined) return this.denialAudit.denyR1P06({ actorUserId: input.actorUserId, action: "STAFF_PAYOUT_DESTINATION_DECISION", targetId: input.providerId, requestId: input.requestId, publicErrorCode: "PROVIDER_SCOPE_DENIED" });
      throw new Error("PROVIDER_SCOPE_DENIED");
    }
    if (!isPayoutDecisionReasonAllowed(input.outcome, input.reasonCode) || !isMeaningfulSafeNote(input.verificationNote)) throw new Error("VALIDATION_ERROR");
    const replay = await this.repository.findPayoutDecisionReplay(input);
    if (replay !== null) return replay;
    const [provider, row] = await Promise.all([
      this.repository.readHolderAuthority(input.providerId),
      this.repository.read(input.providerId, input.destinationVersionId),
    ]);
    const legalSourceAndOutcome = row !== null && (
      (row.status === "PENDING_VERIFICATION" && ["APPROVE", "REJECT", "REQUEST_CHANGES"].includes(input.outcome)) ||
      (row.status === "APPROVED" && ["REQUEST_REPLACEMENT", "INVALIDATE"].includes(input.outcome))
    );
    if (
      provider === null ||
      provider.applicationStatus !== "APPROVED" ||
      row === null ||
      !legalSourceAndOutcome ||
      row.version !== input.expectedVersion
    ) throw new Error("PAYOUT_DESTINATION_STATE_CONFLICT");
    const expectedMethod = row.kind === "MOBILE_WALLET"
      ? "MANUAL_WALLET_TRANSFER_CHECK"
      : "MANUAL_BANK_BENEFICIARY_CHECK";
    if (input.verificationMethod !== expectedMethod) throw new Error("VALIDATION_ERROR");
    const protectedFieldContext = {
      providerId: row.providerId,
      destinationChainId: row.chainId,
      destinationVersionId: row.id,
      destinationSequence: row.sequence,
      destinationType: row.kind,
    } as const;
    const storedIdentifier = this.crypto.decrypt({
      ciphertext: row.identifierCiphertext,
      nonce: row.identifierNonce,
      authenticationTag: row.identifierTag,
      encryptionKeyId: row.identifierEncryptionKeyId,
    }, {
      ...protectedFieldContext,
      fieldName: "IDENTIFIER",
      encryptionKeyId: row.identifierEncryptionKeyId,
    });
    const storedHolderLegalName = this.crypto.decrypt({
      ciphertext: row.holderNameCiphertext,
      nonce: row.holderNameNonce,
      authenticationTag: row.holderNameTag,
      encryptionKeyId: row.holderNameEncryptionKeyId,
    }, {
      ...protectedFieldContext,
      fieldName: "HOLDER_NAME",
      encryptionKeyId: row.holderNameEncryptionKeyId,
    });
    assertSafeNoteExcludesProtectedValues(input.verificationNote, [
      storedIdentifier,
      storedHolderLegalName,
    ]);
    let approvalHolderAuthority:
      | {
          readonly holderRelationship: "PROVIDER_LEGAL_ENTITY" | "PROVIDER_OWNER";
          readonly authoritativeHolderLegalName: string;
          readonly protectedHolderMatches: (
            candidate: Parameters<PrismaProviderPayoutRepository["decide"]>[0]["approvalHolderAuthority"] extends infer T
              ? T extends { protectedHolderMatches: infer F } ? F extends (...args: infer A) => boolean ? A[0] : never : never
              : never,
          ) => boolean;
        }
      | undefined;
    if (
      input.outcome === "APPROVE" && input.acceptedRevealAttemptId === null ||
      input.acceptedRevealAttemptId !== null && !(await this.acceptedRevealBelongsToDecision({
        attemptId: input.acceptedRevealAttemptId,
        actorUserId: input.actorUserId,
        providerId: input.providerId,
        destinationVersionId: input.destinationVersionId,
        expectedVersion: input.expectedVersion,
        purpose: "MANUAL_PAYOUT_DESTINATION_VERIFICATION",
      }))
    ) throw new Error("PAYOUT_STEP_UP_REQUIRED");
    if (input.outcome === "APPROVE") {
      if (
        provider.ownerUserId === null ||
        !provider.members.some((member) => member.userId === provider.ownerUserId)
      ) throw new Error("PAYOUT_HOLDER_AUTHORITY_UNAVAILABLE");
      const authority = await this.holderReader.readLegalNameFacts({
        providerKind: provider.kind,
        applicationOwnerUserId: provider.applicationOwnerUserId,
        activeOwnerUserId: provider.ownerUserId,
      });
      const authoritativeHolderLegalName = row.holderRelationship === "PROVIDER_LEGAL_ENTITY"
        ? authority.legalEntityName
        : authority.ownerLegalName;
      if (authoritativeHolderLegalName === null) throw new Error("PAYOUT_HOLDER_AUTHORITY_UNAVAILABLE");
      if (storedHolderLegalName.trim() !== authoritativeHolderLegalName.trim()) {
        throw new Error("PAYOUT_HOLDER_NAME_MISMATCH");
      }
      approvalHolderAuthority = {
        holderRelationship: row.holderRelationship,
        authoritativeHolderLegalName,
        protectedHolderMatches: (candidate) => {
          const candidateHolder = this.crypto.decrypt({
            ciphertext: candidate.holderNameCiphertext,
            nonce: candidate.holderNameNonce,
            authenticationTag: candidate.holderNameTag,
            encryptionKeyId: candidate.holderNameEncryptionKeyId,
          }, {
            providerId: candidate.providerId,
            destinationChainId: candidate.chainId,
            destinationVersionId: candidate.id,
            destinationSequence: candidate.sequence,
            destinationType: candidate.kind,
            fieldName: "HOLDER_NAME",
            encryptionKeyId: candidate.holderNameEncryptionKeyId,
          });
          return candidateHolder.trim() === authoritativeHolderLegalName.trim();
        },
      };
    }
    return this.repository.decide({
      ...input,
      ...(approvalHolderAuthority === undefined ? {} : { approvalHolderAuthority }),
      now: this.now(),
    });
  }
}
