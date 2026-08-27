import { getPrismaClient } from "#database/prisma";
import { Prisma } from "#generated/prisma/client";
import type { ProviderPayoutDestinationVersion, ProviderPayoutKeyRotationRun } from "#generated/prisma/client";

import type { EncryptedPayoutField, PayoutDestinationKind } from "../domain/provider-verification.types.js";
import { shouldInitializeFirstPrimary } from "../domain/provider-payout-primary.policy.js";
import type {
  PayoutRevealAuditGate,
  PrivilegedAuditWriter,
  TransactionalAcceptedPayoutRevealAuthorizerFactory,
} from "../../admin/audit.public.js";
import type { AuthenticationProofPurpose, TransactionalAuthenticationProofUseAuthorizerFactory, TransactionalStaffPermissionAuthorizerFactory } from "../../authentication/authentication.public.js";
import type { TransactionalProviderPayoutHolderAuthorityReaderFactory } from "../../customers/customers.public.js";

const ACTIVE_CHAIN_STATES = ["DRAFT", "PENDING_VERIFICATION", "CHANGES_REQUESTED", "APPROVED", "REPLACEMENT_REQUESTED"] as const;

function sameFingerprintSet(
  existing: readonly { readonly lookupKeyId: string; readonly fingerprint: string }[],
  expected: readonly { readonly lookupKeyId: string; readonly fingerprint: string }[],
): boolean {
  if (existing.length !== expected.length) return false;
  const byKey = new Map(existing.map((item) => [item.lookupKeyId, item.fingerprint]));
  return expected.every((item) => byKey.get(item.lookupKeyId) === item.fingerprint);
}

export class PrismaProviderPayoutRepository {
  public constructor(
    private readonly db = getPrismaClient(),
    private readonly createAuditWriter?: (transaction: Prisma.TransactionClient) => PrivilegedAuditWriter,
    private readonly createStaffPermissionAuthorizer?: TransactionalStaffPermissionAuthorizerFactory,
    private readonly createProofUseAuthorizer?: TransactionalAuthenticationProofUseAuthorizerFactory,
    private readonly createAcceptedRevealAuthorizer?: TransactionalAcceptedPayoutRevealAuthorizerFactory,
    private readonly createHolderAuthorityReader?: TransactionalProviderPayoutHolderAuthorityReaderFactory,
    private readonly createPayoutRevealAuditGate?: (transaction: Prisma.TransactionClient) => PayoutRevealAuditGate,
  ) {}

  private async assertStaffPayoutPermission(transaction: Prisma.TransactionClient, actorUserId: string): Promise<void> {
    const authorizer = this.createStaffPermissionAuthorizer?.(transaction);
    if (authorizer === undefined || !(await authorizer.authorize(actorUserId, "providers.payout-destinations.verify"))) {
      throw new Error("PROVIDER_SCOPE_DENIED");
    }
  }

  private async assertConsumedProof(
    transaction: Prisma.TransactionClient,
    input: {
      readonly proofId: string;
      readonly actorUserId: string;
      readonly purpose: AuthenticationProofPurpose;
      readonly providerId: string;
      readonly destinationVersionId: string;
      readonly requestId: string;
      readonly maximumAgeSeconds: 600 | 300;
      readonly now: Date;
    },
  ): Promise<void> {
    const authorizer = this.createProofUseAuthorizer?.(transaction);
    if (authorizer === undefined || !(await authorizer.assertConsumed(input))) {
      throw new Error(input.purpose === "STAFF_PAYOUT_REVEAL" ? "PAYOUT_STEP_UP_REQUIRED" : "PAYOUT_REAUTHENTICATION_REQUIRED");
    }
  }

  private async assertOwnerMutationAuthority(
    transaction: Prisma.TransactionClient,
    input: {
      readonly providerId: string;
      readonly actorUserId: string;
      readonly countryId?: string;
      readonly countryCode?: string;
    },
  ): Promise<void> {
    const provider = await transaction.provider.findFirst({
      where: {
        id: input.providerId,
        applicationStatus: "APPROVED",
        ownerUserId: input.actorUserId,
        members: { some: { userId: input.actorUserId, level: "OWNER", status: "ACTIVE" } },
        ...(input.countryId === undefined || input.countryCode === undefined ? {} : {
          profile: { countryId: input.countryId, country: { code: input.countryCode, isActive: true } },
        }),
      },
      select: { id: true },
    });
    if (provider === null) throw new Error("PROVIDER_SCOPE_DENIED");
  }

  private async assertCurrentHolderAuthority(
    transaction: Prisma.TransactionClient,
    input: {
      readonly providerId: string;
      readonly holderRelationship: "PROVIDER_LEGAL_ENTITY" | "PROVIDER_OWNER";
      readonly expectedHolderLegalName: string;
    },
  ): Promise<void> {
    const provider = await transaction.provider.findUnique({
      where: { id: input.providerId },
      select: {
        kind: true,
        applicationStatus: true,
        applicationOwnerUserId: true,
        ownerUserId: true,
        members: {
          where: { level: "OWNER", status: "ACTIVE" },
          select: { id: true, userId: true },
        },
      },
    });
    if (
      provider === null ||
      provider.applicationStatus !== "APPROVED" ||
      provider.ownerUserId === null ||
      !provider.members.some((member) => member.userId === provider.ownerUserId)
    ) throw new Error("PAYOUT_HOLDER_AUTHORITY_UNAVAILABLE");
    const lockedOwners = await transaction.$queryRaw<readonly { readonly id: string }[]>`
      SELECT id FROM provider_members
      WHERE provider_id = ${input.providerId}
        AND user_id = ${provider.ownerUserId}
        AND level = 'OWNER'
        AND status = 'ACTIVE'
      FOR SHARE
    `;
    if (lockedOwners.length !== 1) throw new Error("PAYOUT_HOLDER_AUTHORITY_UNAVAILABLE");
    const reader = this.createHolderAuthorityReader?.(transaction);
    if (reader === undefined) throw new Error("PAYOUT_HOLDER_AUTHORITY_UNAVAILABLE");
    const names = await reader.readLegalNameFacts({
      providerKind: provider.kind,
      applicationOwnerUserId: provider.applicationOwnerUserId,
      activeOwnerUserId: provider.ownerUserId,
    });
    const authoritativeName = input.holderRelationship === "PROVIDER_LEGAL_ENTITY"
      ? names.legalEntityName
      : names.ownerLegalName;
    if (
      authoritativeName === null ||
      authoritativeName.trim() !== input.expectedHolderLegalName.trim()
    ) throw new Error("PAYOUT_HOLDER_NAME_MISMATCH");
  }

  private async readExactActiveOwnerRecipient(
    transaction: Prisma.TransactionClient,
    providerId: string,
  ): Promise<string> {
    const provider = await transaction.provider.findUnique({
      where: { id: providerId },
      select: {
        ownerUserId: true,
        members: {
          where: { level: "OWNER", status: "ACTIVE" },
          select: { userId: true },
        },
      },
    });
    if (
      provider === null ||
      provider.ownerUserId === null ||
      !provider.members.some((member) => member.userId === provider.ownerUserId)
    ) {
      throw new Error("PAYOUT_HOLDER_AUTHORITY_UNAVAILABLE");
    }
    return provider.ownerUserId;
  }

  private async assertActiveRegistry(
    transaction: Prisma.TransactionClient,
    input: {
      readonly destinationTypeId: string;
      readonly kind: PayoutDestinationKind;
      readonly countryId: string;
      readonly currencyCode: string | null;
      readonly operatorId: string | null;
      readonly bankId: string | null;
    },
  ): Promise<void> {
    const [destinationType, policy, institution, currency] = await Promise.all([
      transaction.payoutDestinationType.findFirst({
        where: { id: input.destinationTypeId, code: input.kind, isActive: true },
        select: { id: true },
      }),
      transaction.payoutCountryPolicy.findFirst({
        where: {
          countryId: input.countryId,
          isActive: true,
          allowedDestinationTypes: { has: input.kind },
          ...(input.currencyCode === null ? {} : { allowedCurrencyCodes: { has: input.currencyCode } }),
        },
        select: { id: true },
      }),
      input.kind === "MOBILE_WALLET"
        ? transaction.payoutOperator.findFirst({
          where: { id: input.operatorId ?? "", countryId: input.countryId, isActive: true },
          select: { id: true },
        })
        : transaction.payoutBank.findFirst({
          where: { id: input.bankId ?? "", countryId: input.countryId, isActive: true },
          select: { id: true },
        }),
      input.currencyCode === null
        ? Promise.resolve({ code: "NOT_APPLICABLE" })
        : transaction.currency.findFirst({ where: { code: input.currencyCode, isActive: true }, select: { code: true } }),
    ]);
    if (destinationType === null || policy === null || institution === null || currency === null) {
      throw new Error("PAYOUT_REGISTRY_INACTIVE");
    }
  }

  public async readAccess(providerId: string, actorUserId: string) {
    return this.db.provider.findUnique({
      where: { id: providerId },
      select: {
        id: true, kind: true, applicationStatus: true, operationalStatus: true,
        payoutPrimaryStateVersion: true,
        applicationOwnerUserId: true, ownerUserId: true,
        profile: { select: { country: { select: { id: true, code: true, isActive: true } } } },
        members: { where: { userId: actorUserId }, select: { userId: true, level: true, status: true } },
      },
    });
  }

  public async readHolderAuthority(providerId: string) {
    return this.db.provider.findUnique({
      where: { id: providerId },
      select: {
        kind: true,
        applicationStatus: true,
        applicationOwnerUserId: true,
        ownerUserId: true,
        members: {
          where: { level: "OWNER", status: "ACTIVE" },
          select: { userId: true },
        },
      },
    });
  }

  public async list(input: { readonly providerId: string; readonly limit: number; readonly cursorUpdatedAt?: Date; readonly cursorId?: string }) {
    return this.db.providerPayoutDestinationVersion.findMany({
      where: {
        providerId: input.providerId,
        ...(input.cursorUpdatedAt === undefined || input.cursorId === undefined ? {} : {
          OR: [{ updatedAt: { lt: input.cursorUpdatedAt } }, { updatedAt: input.cursorUpdatedAt, id: { lt: input.cursorId } }],
        }),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: Math.min(101, Math.max(1, input.limit)),
      include: {
        identityClaim: true, operator: true, bank: true,
        chain: true, primaryForProvider: true, decisions: { orderBy: { decidedAt: "desc" }, take: 1 },
      },
    });
  }

  public async read(providerId: string, destinationVersionId: string) {
    return this.db.providerPayoutDestinationVersion.findFirst({
      where: { id: destinationVersionId, providerId },
      include: {
        identityClaim: { include: { fingerprints: true } }, operator: true, bank: true,
        chain: true, primaryForProvider: true, decisions: { orderBy: { decidedAt: "desc" } },
        predecessor: true, successor: true,
      },
    });
  }

  public async commitRevealGate<T>(input: {
    readonly actorUserId: string;
    readonly providerId: string;
    readonly destinationVersionId: string;
    readonly expectedVersion: number;
    readonly purpose: "MANUAL_PAYOUT_DESTINATION_VERIFICATION";
    readonly reasonCode: string;
    readonly requestId: string;
    readonly proofId: string;
    readonly now: Date;
    readonly prepareSensitiveResult: (
      row: NonNullable<Awaited<ReturnType<PrismaProviderPayoutRepository["read"]>>>,
      authority: { readonly legalEntityName: string | null; readonly ownerLegalName: string | null },
    ) => T;
  }) {
    return this.db.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM providers WHERE id = ${input.providerId} FOR UPDATE`;
      const approvedProvider = await transaction.provider.findFirst({
        where: { id: input.providerId, applicationStatus: "APPROVED" },
        select: {
          kind: true,
          applicationOwnerUserId: true,
          ownerUserId: true,
          members: { where: { level: "OWNER", status: "ACTIVE" }, select: { id: true, userId: true } },
        },
      });
      if (approvedProvider === null) throw new Error("PROVIDER_NOT_APPROVED");
      if (
        approvedProvider.ownerUserId === null ||
        !approvedProvider.members.some((member) => member.userId === approvedProvider.ownerUserId)
      ) throw new Error("PAYOUT_HOLDER_AUTHORITY_UNAVAILABLE");
      await this.assertStaffPayoutPermission(transaction, input.actorUserId);
      await this.assertConsumedProof(transaction, {
        proofId: input.proofId,
        actorUserId: input.actorUserId,
        purpose: "STAFF_PAYOUT_REVEAL",
        providerId: input.providerId,
        destinationVersionId: input.destinationVersionId,
        requestId: input.requestId,
        maximumAgeSeconds: 300,
        now: input.now,
      });
      await transaction.$queryRaw`SELECT id FROM provider_payout_destination_versions WHERE id = ${input.destinationVersionId} FOR UPDATE`;
      const row = await transaction.providerPayoutDestinationVersion.findFirst({
        where: {
          id: input.destinationVersionId,
          providerId: input.providerId,
          status: "PENDING_VERIFICATION",
          version: input.expectedVersion,
        },
        include: {
          identityClaim: { include: { fingerprints: true } },
          operator: true,
          bank: true,
          chain: true,
          primaryForProvider: true,
          decisions: { orderBy: { decidedAt: "desc" } },
          predecessor: true,
          successor: true,
        },
      });
      if (row === null) throw new Error("PAYOUT_DESTINATION_STATE_CONFLICT");
      const lockedOwners = await transaction.$queryRaw<readonly { readonly id: string }[]>`
        SELECT id FROM provider_members
        WHERE provider_id = ${input.providerId}
          AND user_id = ${approvedProvider.ownerUserId}
          AND level = 'OWNER'
          AND status = 'ACTIVE'
        FOR SHARE
      `;
      if (lockedOwners.length !== 1) throw new Error("PAYOUT_HOLDER_AUTHORITY_UNAVAILABLE");
      const holderReader = this.createHolderAuthorityReader?.(transaction);
      if (holderReader === undefined) throw new Error("PAYOUT_HOLDER_AUTHORITY_UNAVAILABLE");
      const authority = await holderReader.readLegalNameFacts({
        providerKind: approvedProvider.kind,
        applicationOwnerUserId: approvedProvider.applicationOwnerUserId,
        activeOwnerUserId: approvedProvider.ownerUserId,
      });
      const sensitiveResult = input.prepareSensitiveResult(row, authority);
      const auditGate = this.createPayoutRevealAuditGate?.(transaction);
      if (auditGate === undefined) throw new Error("AUDIT_WRITE_FAILED");
      const audit = await auditGate.commitAcceptedReveal({
        actorUserId: input.actorUserId,
        providerId: input.providerId,
        destinationVersionId: row.id,
        expectedVersion: row.version,
        purpose: input.purpose,
        reasonCode: input.reasonCode,
        requestId: input.requestId,
        encryptionKeyIds: [row.identifierEncryptionKeyId, row.holderNameEncryptionKeyId],
        lookupKeyIds: row.identityClaim.fingerprints.map((item) => item.lookupKeyId),
        now: input.now,
      });
      return { sensitiveResult, audit };
    });
  }

  public async findCollision(fingerprints: readonly { readonly lookupKeyId: string; readonly fingerprint: string }[]) {
    return this.db.providerPayoutLookupFingerprint.findFirst({
      where: {
        claimStatus: "ACTIVE", retiredAt: null,
        OR: fingerprints.map((item) => ({ lookupKeyId: item.lookupKeyId, fingerprint: item.fingerprint })),
      },
      include: { claim: true },
    });
  }

  public async createDraft(input: {
    readonly ids: { readonly chainId: string; readonly claimId: string; readonly destinationVersionId: string };
    readonly providerId: string;
    readonly actorUserId: string;
    readonly destinationTypeId: string;
    readonly kind: PayoutDestinationKind;
    readonly countryId: string;
    readonly countryCode: string;
    readonly currencyCode: string | null;
    readonly operatorId: string | null;
    readonly bankId: string | null;
    readonly holderRelationship: "PROVIDER_LEGAL_ENTITY" | "PROVIDER_OWNER";
    readonly expectedHolderLegalName: string;
    readonly protectedHolderMatches: (row: ProviderPayoutDestinationVersion) => boolean;
    readonly identifierEnvelope: EncryptedPayoutField;
    readonly holderEnvelope: EncryptedPayoutField;
    readonly maskFacts: {
      readonly callingCode: string | null;
      readonly ibanCountryPrefix: string | null;
      readonly lastFour: string;
      readonly identifierLength: number;
    };
    readonly fingerprints: readonly { readonly lookupKeyId: string; readonly fingerprint: string }[];
    readonly commandId: string;
    readonly requestId: string;
  }): Promise<ProviderPayoutDestinationVersion> {
    const prior = await this.db.providerPayoutDestinationVersion.findUnique({
      where: { idempotencyKey: input.commandId },
      include: { identityClaim: { include: { fingerprints: true } } },
    });
    if (prior !== null) {
      const history = await this.db.providerPayoutHistory.findUnique({
        where: { operationKey: `payout-draft:${input.commandId}` },
      });
      if (
        history === null ||
        history.event !== "DESTINATION_DRAFT_CREATED" ||
        history.providerId !== input.providerId ||
        history.destinationVersionId !== prior.id ||
        history.actorUserId !== input.actorUserId ||
        history.requestId !== input.requestId ||
        history.exactVersion !== 1 ||
        prior.providerId !== input.providerId ||
        prior.status !== "DRAFT" ||
        prior.version !== 1 ||
        prior.kind !== input.kind ||
        prior.countryId !== input.countryId ||
        prior.countryCode !== input.countryCode ||
        prior.currencyCode !== input.currencyCode ||
        prior.operatorId !== input.operatorId ||
        prior.bankId !== input.bankId ||
        prior.holderRelationship !== input.holderRelationship ||
        prior.createdByUserId !== input.actorUserId ||
        !input.protectedHolderMatches(prior) ||
        !sameFingerprintSet(prior.identityClaim.fingerprints, input.fingerprints)
      ) throw new Error("PAYOUT_DESTINATION_VERSION_CONFLICT");
      return prior;
    }
    try {
      return await this.db.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT id FROM providers WHERE id = ${input.providerId} FOR UPDATE`;
        await this.assertOwnerMutationAuthority(transaction, input);
        await this.assertCurrentHolderAuthority(transaction, input);
        await this.assertActiveRegistry(transaction, input);
        const count = await transaction.providerPayoutDestinationChain.count({
          where: {
            providerId: input.providerId,
            OR: [
              { currentVersion: { status: { in: [...ACTIVE_CHAIN_STATES] } } },
              { effectiveApprovedVersionId: { not: null } },
            ],
          },
        });
        if (count >= 5) throw new Error("PAYOUT_DESTINATION_LIMIT_REACHED");
        const collision = await transaction.providerPayoutLookupFingerprint.findFirst({
          where: {
            claimStatus: "ACTIVE", retiredAt: null,
            OR: input.fingerprints.map((item) => ({ lookupKeyId: item.lookupKeyId, fingerprint: item.fingerprint })),
          }, include: { claim: true },
        });
        if (collision !== null) throw new Error(collision.claim.providerId === input.providerId ? "PAYOUT_SUCCESSOR_CONFLICT" : "PAYOUT_DESTINATION_CONFLICT");
        const historicalSameProvider = await transaction.providerPayoutLookupFingerprint.findFirst({
          where: {
            claim: { providerId: input.providerId },
            OR: input.fingerprints.map((item) => ({ lookupKeyId: item.lookupKeyId, fingerprint: item.fingerprint })),
          },
          select: { claimId: true },
        });
        if (historicalSameProvider !== null) throw new Error("PAYOUT_SUCCESSOR_CONFLICT");
        await transaction.providerPayoutDestinationChain.create({
          data: { id: input.ids.chainId, providerId: input.providerId, destinationTypeId: input.destinationTypeId },
        });
        await transaction.providerPayoutIdentityClaim.create({
          data: {
            id: input.ids.claimId, providerId: input.providerId, chainId: input.ids.chainId, kind: input.kind,
            countryCode: input.kind === "MOBILE_WALLET" ? input.countryCode : null,
            callingCode: input.maskFacts.callingCode,
            ibanCountryPrefix: input.maskFacts.ibanCountryPrefix,
            lastFour: input.maskFacts.lastFour,
            identifierLength: input.maskFacts.identifierLength,
            fingerprints: { create: input.fingerprints.map((item) => ({ ...item, claimStatus: "ACTIVE" })) },
          },
        });
        const version = await transaction.providerPayoutDestinationVersion.create({
          data: {
            id: input.ids.destinationVersionId,
            chainId: input.ids.chainId,
            providerId: input.providerId,
            identityClaimId: input.ids.claimId,
            sequence: 1,
            kind: input.kind,
            countryId: input.countryId,
            countryCode: input.countryCode,
            currencyCode: input.currencyCode,
            operatorId: input.operatorId,
            bankId: input.bankId,
            holderRelationship: input.holderRelationship,
            identifierCiphertext: input.identifierEnvelope.ciphertext,
            identifierNonce: input.identifierEnvelope.nonce,
            identifierTag: input.identifierEnvelope.authenticationTag,
            identifierEncryptionKeyId: input.identifierEnvelope.encryptionKeyId,
            holderNameCiphertext: input.holderEnvelope.ciphertext,
            holderNameNonce: input.holderEnvelope.nonce,
            holderNameTag: input.holderEnvelope.authenticationTag,
            holderNameEncryptionKeyId: input.holderEnvelope.encryptionKeyId,
            createdByUserId: input.actorUserId,
            idempotencyKey: input.commandId,
          },
        });
        await transaction.providerPayoutDestinationChain.update({
          where: { id: input.ids.chainId }, data: { currentVersionId: version.id },
        });
        await transaction.providerPayoutHistory.create({
          data: {
            providerId: input.providerId, chainId: input.ids.chainId, destinationVersionId: version.id,
            event: "DESTINATION_DRAFT_CREATED", toStatus: "DRAFT", actorType: "USER",
            actorUserId: input.actorUserId, safeMask: this.maskFromFacts(input.kind, input.maskFacts),
            requestId: input.requestId, exactVersion: version.version, operationKey: `payout-draft:${input.commandId}`,
          },
        });
        return version;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const retry = await this.db.providerPayoutDestinationVersion.findUnique({ where: { idempotencyKey: input.commandId } });
        if (retry !== null) return this.createDraft(input);
        const collision = await this.findCollision(input.fingerprints);
        throw new Error(collision?.claim.providerId === input.providerId ? "PAYOUT_SUCCESSOR_CONFLICT" : "PAYOUT_DESTINATION_CONFLICT");
      }
      throw error;
    }
  }

  public async createSuccessor(input: Parameters<PrismaProviderPayoutRepository["createDraft"]>[0] & {
    readonly predecessorVersionId: string;
    readonly predecessorExpectedVersion: number;
    readonly sequence: number;
    readonly reuseChainId: string;
  }): Promise<ProviderPayoutDestinationVersion> {
    const prior = await this.db.providerPayoutDestinationVersion.findUnique({
      where: { idempotencyKey: input.commandId },
      include: { identityClaim: { include: { fingerprints: true } } },
    });
    if (prior !== null) {
      const history = await this.db.providerPayoutHistory.findUnique({
        where: { operationKey: `payout-successor:${input.commandId}` },
      });
      if (
        history === null ||
        history.event !== "DESTINATION_DRAFT_CREATED" ||
        history.providerId !== input.providerId ||
        history.destinationVersionId !== prior.id ||
        history.chainId !== input.reuseChainId ||
        history.actorUserId !== input.actorUserId ||
        history.requestId !== input.requestId ||
        history.exactVersion !== input.predecessorExpectedVersion ||
        prior.providerId !== input.providerId ||
        prior.predecessorVersionId !== input.predecessorVersionId ||
        prior.kind !== input.kind ||
        prior.countryId !== input.countryId ||
        prior.countryCode !== input.countryCode ||
        prior.currencyCode !== input.currencyCode ||
        prior.operatorId !== input.operatorId ||
        prior.bankId !== input.bankId ||
        prior.holderRelationship !== input.holderRelationship ||
        prior.createdByUserId !== input.actorUserId ||
        prior.sequence !== input.sequence ||
        !input.protectedHolderMatches(prior) ||
        !sameFingerprintSet(prior.identityClaim.fingerprints, input.fingerprints)
      ) throw new Error("PAYOUT_DESTINATION_VERSION_CONFLICT");
      return prior;
    }
    try {
      return await this.db.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM providers WHERE id = ${input.providerId} FOR UPDATE`;
      await this.assertOwnerMutationAuthority(transaction, input);
      await this.assertCurrentHolderAuthority(transaction, input);
      await this.assertActiveRegistry(transaction, input);
      const predecessor = await transaction.providerPayoutDestinationVersion.findFirst({
        where: {
          id: input.predecessorVersionId,
          providerId: input.providerId,
          version: input.predecessorExpectedVersion,
          status: { in: ["APPROVED", "CHANGES_REQUESTED", "REPLACEMENT_REQUESTED", "REJECTED", "INVALIDATED"] },
        },
      });
      if (predecessor === null) throw new Error("PAYOUT_DESTINATION_VERSION_CONFLICT");
      const open = await transaction.providerPayoutDestinationVersion.findFirst({
        where: { predecessorVersionId: predecessor.id, status: { in: [...ACTIVE_CHAIN_STATES] } },
      });
      if (open !== null) throw new Error("PAYOUT_SUCCESSOR_CONFLICT");
      const claimCollision = await transaction.providerPayoutLookupFingerprint.findFirst({
        where: { claimStatus: "ACTIVE", retiredAt: null, OR: input.fingerprints.map((item) => ({ lookupKeyId: item.lookupKeyId, fingerprint: item.fingerprint })) },
        include: { claim: true },
      });
      let claimId = input.ids.claimId;
      if (claimCollision !== null) {
        if (claimCollision.claim.providerId !== input.providerId || claimCollision.claim.chainId !== predecessor.chainId) throw new Error("PAYOUT_DESTINATION_CONFLICT");
        claimId = claimCollision.claimId;
      } else {
        const historicalSameChain = await transaction.providerPayoutLookupFingerprint.findFirst({
          where: {
            claim: { providerId: input.providerId, chainId: predecessor.chainId },
            OR: input.fingerprints.map((item) => ({ lookupKeyId: item.lookupKeyId, fingerprint: item.fingerprint })),
          },
          select: { claimId: true },
        });
        if (historicalSameChain !== null) {
          claimId = historicalSameChain.claimId;
          await this.reactivateClaim(transaction, claimId, input.fingerprints);
        } else {
          await transaction.providerPayoutIdentityClaim.create({
            data: {
              id: claimId, providerId: input.providerId, chainId: predecessor.chainId, kind: input.kind,
              countryCode: input.kind === "MOBILE_WALLET" ? input.countryCode : null,
              callingCode: input.maskFacts.callingCode, ibanCountryPrefix: input.maskFacts.ibanCountryPrefix,
              lastFour: input.maskFacts.lastFour, identifierLength: input.maskFacts.identifierLength,
              fingerprints: { create: input.fingerprints.map((item) => ({ ...item, claimStatus: "ACTIVE" })) },
            },
          });
        }
      }
      const version = await transaction.providerPayoutDestinationVersion.create({
        data: {
          id: input.ids.destinationVersionId, chainId: predecessor.chainId, providerId: input.providerId,
          identityClaimId: claimId, sequence: input.sequence, predecessorVersionId: predecessor.id,
          kind: input.kind, countryId: input.countryId, countryCode: input.countryCode,
          currencyCode: input.currencyCode, operatorId: input.operatorId, bankId: input.bankId,
          holderRelationship: input.holderRelationship,
          identifierCiphertext: input.identifierEnvelope.ciphertext, identifierNonce: input.identifierEnvelope.nonce,
          identifierTag: input.identifierEnvelope.authenticationTag, identifierEncryptionKeyId: input.identifierEnvelope.encryptionKeyId,
          holderNameCiphertext: input.holderEnvelope.ciphertext, holderNameNonce: input.holderEnvelope.nonce,
          holderNameTag: input.holderEnvelope.authenticationTag, holderNameEncryptionKeyId: input.holderEnvelope.encryptionKeyId,
          createdByUserId: input.actorUserId, idempotencyKey: input.commandId,
        },
      });
      await transaction.providerPayoutDestinationChain.update({ where: { id: predecessor.chainId }, data: { currentVersionId: version.id, version: { increment: 1 } } });
      await transaction.providerPayoutHistory.create({
        data: {
          providerId: input.providerId,
          chainId: predecessor.chainId,
          destinationVersionId: version.id,
          event: "DESTINATION_DRAFT_CREATED",
          fromStatus: predecessor.status,
          toStatus: "DRAFT",
          actorType: "USER",
          actorUserId: input.actorUserId,
          safeMask: this.maskFromFacts(input.kind, input.maskFacts),
          requestId: input.requestId,
          exactVersion: input.predecessorExpectedVersion,
          operationKey: `payout-successor:${input.commandId}`,
        },
      });
        return version;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const retry = await this.db.providerPayoutDestinationVersion.findUnique({ where: { idempotencyKey: input.commandId } });
        if (retry !== null) return this.createSuccessor(input);
        const collision = await this.findCollision(input.fingerprints);
        throw new Error(collision?.claim.providerId === input.providerId ? "PAYOUT_SUCCESSOR_CONFLICT" : "PAYOUT_DESTINATION_CONFLICT");
      }
      throw error;
    }
  }

  public async updateDraft(input: Omit<Parameters<PrismaProviderPayoutRepository["createDraft"]>[0], "ids"> & {
    readonly destinationVersionId: string;
    readonly expectedVersion: number;
    readonly claimId: string;
    readonly now: Date;
  }): Promise<ProviderPayoutDestinationVersion> {
    const operationKey = `payout-draft-update:${input.destinationVersionId}:${input.commandId}`;
    const prior = await this.db.providerPayoutHistory.findUnique({ where: { operationKey } });
    if (prior !== null) {
      const current = await this.db.providerPayoutDestinationVersion.findUniqueOrThrow({
        where: { id: input.destinationVersionId },
        include: { identityClaim: { include: { fingerprints: true } } },
      });
      if (
        prior.providerId !== input.providerId ||
        prior.destinationVersionId !== input.destinationVersionId ||
        prior.exactVersion !== input.expectedVersion ||
        prior.actorUserId !== input.actorUserId ||
        prior.requestId !== input.requestId ||
        current.status !== "DRAFT" ||
        current.version !== input.expectedVersion + 1 ||
        current.kind !== input.kind ||
        current.countryId !== input.countryId ||
        current.countryCode !== input.countryCode ||
        current.currencyCode !== input.currencyCode ||
        current.operatorId !== input.operatorId ||
        current.bankId !== input.bankId ||
        current.holderRelationship !== input.holderRelationship ||
        !input.protectedHolderMatches(current) ||
        !sameFingerprintSet(current.identityClaim.fingerprints.filter((item) => item.claimStatus === "ACTIVE"), input.fingerprints)
      ) throw new Error("PAYOUT_DESTINATION_VERSION_CONFLICT");
      return current;
    }
    try {
      return await this.db.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT id FROM providers WHERE id = ${input.providerId} FOR UPDATE`;
        await this.assertOwnerMutationAuthority(transaction, input);
        await this.assertCurrentHolderAuthority(transaction, input);
        await this.assertActiveRegistry(transaction, input);
        const row = await transaction.providerPayoutDestinationVersion.findFirst({
          where: {
            id: input.destinationVersionId,
            providerId: input.providerId,
            status: "DRAFT",
            version: input.expectedVersion,
          },
          include: { identityClaim: { include: { fingerprints: true } } },
        });
        if (row === null) throw new Error("PAYOUT_DESTINATION_VERSION_CONFLICT");
        const collision = await transaction.providerPayoutLookupFingerprint.findFirst({
          where: {
            claimStatus: "ACTIVE",
            retiredAt: null,
            claimId: { not: row.identityClaimId },
            OR: input.fingerprints.map((item) => ({ lookupKeyId: item.lookupKeyId, fingerprint: item.fingerprint })),
          },
          include: { claim: true },
        });
        if (collision !== null && (collision.claim.providerId !== input.providerId || collision.claim.chainId !== row.chainId)) {
          throw new Error(collision.claim.providerId === input.providerId ? "PAYOUT_SUCCESSOR_CONFLICT" : "PAYOUT_DESTINATION_CONFLICT");
        }
        const sameIdentity = input.fingerprints.every((candidate) =>
          row.identityClaim.fingerprints.some((existing) =>
            existing.lookupKeyId === candidate.lookupKeyId && existing.fingerprint === candidate.fingerprint,
          ),
        );
        let claimId = row.identityClaimId;
        if (!sameIdentity) {
          await this.releaseClaimIfUnused(transaction, row.identityClaimId, row.id, input.now);
          const historicalSameProvider = collision ?? await transaction.providerPayoutLookupFingerprint.findFirst({
            where: {
              claimId: { not: row.identityClaimId },
              claim: { providerId: input.providerId },
              OR: input.fingerprints.map((item) => ({ lookupKeyId: item.lookupKeyId, fingerprint: item.fingerprint })),
            },
            include: { claim: true },
          });
          if (historicalSameProvider !== null && historicalSameProvider.claim.chainId !== row.chainId) {
            throw new Error("PAYOUT_SUCCESSOR_CONFLICT");
          }
          if (historicalSameProvider !== null) {
            claimId = historicalSameProvider.claimId;
            await this.reactivateClaim(transaction, claimId, input.fingerprints);
          } else {
            claimId = input.claimId;
            await transaction.providerPayoutIdentityClaim.create({
              data: {
                id: claimId,
                providerId: input.providerId,
                chainId: row.chainId,
                kind: input.kind,
                countryCode: input.kind === "MOBILE_WALLET" ? input.countryCode : null,
                callingCode: input.maskFacts.callingCode,
                ibanCountryPrefix: input.maskFacts.ibanCountryPrefix,
                lastFour: input.maskFacts.lastFour,
                identifierLength: input.maskFacts.identifierLength,
                fingerprints: { create: input.fingerprints.map((item) => ({ ...item, claimStatus: "ACTIVE" })) },
              },
            });
          }
        }
        const updated = await transaction.providerPayoutDestinationVersion.update({
          where: { id: row.id },
          data: {
            identityClaimId: claimId,
            kind: input.kind,
            countryId: input.countryId,
            countryCode: input.countryCode,
            currencyCode: input.currencyCode,
            operatorId: input.operatorId,
            bankId: input.bankId,
            holderRelationship: input.holderRelationship,
            identifierCiphertext: input.identifierEnvelope.ciphertext,
            identifierNonce: input.identifierEnvelope.nonce,
            identifierTag: input.identifierEnvelope.authenticationTag,
            identifierEncryptionKeyId: input.identifierEnvelope.encryptionKeyId,
            holderNameCiphertext: input.holderEnvelope.ciphertext,
            holderNameNonce: input.holderEnvelope.nonce,
            holderNameTag: input.holderEnvelope.authenticationTag,
            holderNameEncryptionKeyId: input.holderEnvelope.encryptionKeyId,
            version: { increment: 1 },
          },
        });
        await transaction.providerPayoutDestinationChain.update({
          where: { id: row.chainId },
          data: { destinationTypeId: input.destinationTypeId, version: { increment: 1 } },
        });
        await transaction.providerPayoutHistory.create({
          data: {
            providerId: input.providerId,
            chainId: row.chainId,
            destinationVersionId: row.id,
            event: "DESTINATION_DRAFT_UPDATED",
            fromStatus: "DRAFT",
            toStatus: "DRAFT",
            actorType: "USER",
            actorUserId: input.actorUserId,
            safeMask: this.maskFromFacts(input.kind, input.maskFacts),
            requestId: input.requestId,
            exactVersion: input.expectedVersion,
            operationKey,
          },
        });
        return updated;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const retry = await this.db.providerPayoutHistory.findUnique({ where: { operationKey } });
        if (retry !== null) return this.updateDraft(input);
        const collision = await this.findCollision(input.fingerprints);
        throw new Error(collision?.claim.providerId === input.providerId ? "PAYOUT_SUCCESSOR_CONFLICT" : "PAYOUT_DESTINATION_CONFLICT");
      }
      throw error;
    }
  }

  public async submit(input: {
    readonly providerId: string; readonly destinationVersionId: string; readonly expectedVersion: number;
    readonly actorUserId: string; readonly proofId: string; readonly commandId: string; readonly requestId: string; readonly now: Date;
  }) {
    const replay = await this.findPayoutSubmitReplay(input);
    if (replay !== null) return replay;
    const operationKey = `payout-submit:${input.destinationVersionId}:${input.commandId}`;
    const prior = await this.db.providerPayoutHistory.findUnique({ where: { operationKey } });
    if (prior !== null) {
      if (
        prior.providerId !== input.providerId ||
        prior.destinationVersionId !== input.destinationVersionId ||
        prior.exactVersion !== input.expectedVersion ||
        prior.actorUserId !== input.actorUserId ||
        prior.requestId !== input.requestId
      ) throw new Error("PAYOUT_DESTINATION_VERSION_CONFLICT");
      return this.db.providerPayoutDestinationVersion.findUniqueOrThrow({ where: { id: input.destinationVersionId } });
    }
    return this.db.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM providers WHERE id = ${input.providerId} FOR UPDATE`;
      await transaction.$queryRaw`SELECT id FROM provider_payout_destination_versions WHERE id = ${input.destinationVersionId} FOR UPDATE`;
      const candidate = await transaction.providerPayoutDestinationVersion.findFirst({
        where: { id: input.destinationVersionId, providerId: input.providerId, status: "DRAFT", version: input.expectedVersion },
        include: { chain: { include: { destinationType: true } } },
      });
      if (candidate === null) throw new Error("PAYOUT_DESTINATION_VERSION_CONFLICT");
      await this.assertOwnerMutationAuthority(transaction, {
        providerId: input.providerId,
        actorUserId: input.actorUserId,
        countryId: candidate.countryId,
        countryCode: candidate.countryCode,
      });
      await this.assertActiveRegistry(transaction, {
        destinationTypeId: candidate.chain.destinationTypeId,
        kind: candidate.kind,
        countryId: candidate.countryId,
        currencyCode: candidate.currencyCode,
        operatorId: candidate.operatorId,
        bankId: candidate.bankId,
      });
      await this.assertConsumedProof(transaction, {
        proofId: input.proofId,
        actorUserId: input.actorUserId,
        purpose: candidate.predecessorVersionId === null ? "PROVIDER_PAYOUT_SUBMIT" : "PROVIDER_PAYOUT_SUCCESSOR_SUBMIT",
        providerId: input.providerId,
        destinationVersionId: input.destinationVersionId,
        requestId: input.requestId,
        maximumAgeSeconds: 600,
        now: input.now,
      });
      const changed = await transaction.providerPayoutDestinationVersion.updateMany({
        where: { id: input.destinationVersionId, providerId: input.providerId, status: "DRAFT", version: input.expectedVersion },
        data: { status: "PENDING_VERIFICATION", submittedByUserId: input.actorUserId, submittedAt: input.now, version: { increment: 1 } },
      });
      if (changed.count !== 1) throw new Error("PAYOUT_DESTINATION_VERSION_CONFLICT");
      const version = await transaction.providerPayoutDestinationVersion.findUniqueOrThrow({
        where: { id: input.destinationVersionId }, include: { identityClaim: true },
      });
      const history = await transaction.providerPayoutHistory.create({
        data: {
          providerId: input.providerId, chainId: version.chainId, destinationVersionId: version.id,
          event: "DESTINATION_SUBMITTED", fromStatus: "DRAFT", toStatus: "PENDING_VERIFICATION",
          actorType: "USER", actorUserId: input.actorUserId,
          reasonCode: "SUBMITTED_BY_OWNER",
          safeMask: this.maskFromClaim(version.identityClaim), requestId: input.requestId,
          exactVersion: input.expectedVersion, operationKey,
        },
      });
      const recipientUserId = await this.readExactActiveOwnerRecipient(transaction, input.providerId);
      await transaction.providerEmailOutbox.create({
        data: {
          providerId: input.providerId, template: "PAYOUT_DESTINATION_SUBMITTED",
          recipientUserId, payoutHistoryId: history.id,
          idempotencyKey: `payout-submitted-email:${input.commandId}`,
        },
      });
      return version;
    });
  }

  public async findPayoutSubmitReplay(input: {
    readonly providerId: string;
    readonly destinationVersionId: string;
    readonly expectedVersion: number;
    readonly actorUserId: string;
    readonly commandId: string;
    readonly requestId: string;
  }): Promise<ProviderPayoutDestinationVersion | null> {
    const operationKey = `payout-submit:${input.destinationVersionId}:${input.commandId}`;
    const prior = await this.db.providerPayoutHistory.findUnique({ where: { operationKey } });
    if (prior === null) return null;
    if (
      prior.event !== "DESTINATION_SUBMITTED" ||
      prior.providerId !== input.providerId ||
      prior.destinationVersionId !== input.destinationVersionId ||
      prior.exactVersion !== input.expectedVersion ||
      prior.actorUserId !== input.actorUserId ||
      prior.requestId !== input.requestId
    ) throw new Error("PAYOUT_DESTINATION_VERSION_CONFLICT");
    return this.db.providerPayoutDestinationVersion.findUniqueOrThrow({ where: { id: input.destinationVersionId } });
  }

  public async readPrimary(providerId: string) {
    return this.db.providerPrimaryPayoutDestination.findUnique({ where: { providerId } });
  }

  public readPrimaryState(providerId: string) {
    return this.db.provider.findUnique({
      where: { id: providerId },
      select: { payoutPrimaryStateVersion: true, primaryPayoutDestination: true },
    });
  }

  public async isPayoutDestinationReady(providerId: string): Promise<boolean> {
    const primary = await this.db.providerPrimaryPayoutDestination.findFirst({
      where: {
        providerId,
        destinationVersion: {
          status: "APPROVED",
          effectiveForChain: { isNot: null },
        },
      },
      select: { destinationVersionId: true },
    });
    return primary !== null;
  }

  public async setPrimary(input: {
    readonly providerId: string; readonly destinationVersionId: string; readonly expectedDestinationVersion: number;
    readonly expectedPrimaryVersion: number; readonly actorUserId: string; readonly proofId: string; readonly commandId: string; readonly requestId: string; readonly now: Date;
  }) {
    const replay = await this.findPrimaryReplay(input);
    if (replay !== null) return replay;
    const operationKey = `payout-primary:${input.providerId}:${input.commandId}`;
    const prior = await this.db.providerPayoutHistory.findUnique({ where: { operationKey } });
    if (prior !== null) {
      if (
        prior.providerId !== input.providerId ||
        prior.destinationVersionId !== input.destinationVersionId ||
        prior.exactVersion !== input.expectedDestinationVersion ||
        prior.expectedPrimaryVersion !== input.expectedPrimaryVersion ||
        prior.actorUserId !== input.actorUserId ||
        prior.requestId !== input.requestId
      ) throw new Error("PAYOUT_PRIMARY_CONFLICT");
      return this.db.providerPrimaryPayoutDestination.findUnique({ where: { providerId: input.providerId } });
    }
    return this.db.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM providers WHERE id = ${input.providerId} FOR UPDATE`;
      const target = await transaction.providerPayoutDestinationVersion.findFirst({
        where: {
          id: input.destinationVersionId, providerId: input.providerId, version: input.expectedDestinationVersion,
          status: "APPROVED", chain: { currentVersionId: input.destinationVersionId, effectiveApprovedVersionId: input.destinationVersionId },
        }, include: { identityClaim: true, chain: { include: { destinationType: true } } },
      });
      if (target === null) throw new Error("PAYOUT_PRIMARY_CONFLICT");
      await this.assertOwnerMutationAuthority(transaction, {
        providerId: input.providerId,
        actorUserId: input.actorUserId,
        countryId: target.countryId,
        countryCode: target.countryCode,
      });
      await this.assertActiveRegistry(transaction, {
        destinationTypeId: target.chain.destinationTypeId,
        kind: target.kind,
        countryId: target.countryId,
        currencyCode: target.currencyCode,
        operatorId: target.operatorId,
        bankId: target.bankId,
      });
      await this.assertConsumedProof(transaction, {
        proofId: input.proofId,
        actorUserId: input.actorUserId,
        purpose: "PROVIDER_PAYOUT_PRIMARY_CHANGE",
        providerId: input.providerId,
        destinationVersionId: input.destinationVersionId,
        requestId: input.requestId,
        maximumAgeSeconds: 600,
        now: input.now,
      });
      const existing = await transaction.providerPrimaryPayoutDestination.findUnique({ where: { providerId: input.providerId } });
      const providerState = await transaction.provider.findUniqueOrThrow({ where: { id: input.providerId }, select: { payoutPrimaryStateVersion: true } });
      if (providerState.payoutPrimaryStateVersion !== input.expectedPrimaryVersion) throw new Error("PAYOUT_PRIMARY_CONFLICT");
      const primary = existing === null
        ? await transaction.providerPrimaryPayoutDestination.create({ data: { providerId: input.providerId, destinationVersionId: target.id, selectedByUserId: input.actorUserId, selectedAt: input.now, selectionReasonCode: "OWNER_SELECTED" } })
        : await transaction.providerPrimaryPayoutDestination.update({ where: { providerId: input.providerId }, data: { destinationVersionId: target.id, selectedByUserId: input.actorUserId, selectedAt: input.now, selectionReasonCode: "OWNER_SELECTED", version: { increment: 1 } } });
      await transaction.provider.update({
        where: { id: input.providerId },
        data: { payoutPrimaryStateVersion: { increment: 1 } },
      });
      const history = await transaction.providerPayoutHistory.create({
        data: {
          providerId: input.providerId, chainId: target.chainId, destinationVersionId: target.id,
          event: existing === null ? "PRIMARY_INITIALIZED" : "PRIMARY_CHANGED", toStatus: "APPROVED", actorType: "USER",
          actorUserId: input.actorUserId, safeMask: this.maskFromClaim(target.identityClaim),
          reasonCode: "OWNER_SELECTED",
          requestId: input.requestId, exactVersion: input.expectedDestinationVersion,
          expectedPrimaryVersion: input.expectedPrimaryVersion, operationKey,
        },
      });
      const recipientUserId = await this.readExactActiveOwnerRecipient(transaction, input.providerId);
      await transaction.providerEmailOutbox.create({
        data: {
          providerId: input.providerId,
          template: "PAYOUT_PRIMARY_CHANGED",
          recipientUserId,
          payoutHistoryId: history.id,
          idempotencyKey: `payout-primary-email:${input.commandId}`,
        },
      });
      await this.createAuditWriter?.(transaction).append({
        actorType: "USER",
        actorId: input.actorUserId,
        action: "PROVIDER_PAYOUT_PRIMARY_CHANGED",
        targetType: "PROVIDER_PAYOUT_DESTINATION_VERSION",
        targetId: target.id,
        reason: "OWNER_SELECTED",
        requestId: input.requestId,
        context: { providerId: input.providerId, expectedVersion: input.expectedDestinationVersion, outcome: "PRIMARY_SELECTED" },
      });
      return primary;
    });
  }

  public async findPrimaryReplay(input: {
    readonly providerId: string;
    readonly destinationVersionId: string;
    readonly expectedDestinationVersion: number;
    readonly expectedPrimaryVersion: number;
    readonly actorUserId: string;
    readonly commandId: string;
    readonly requestId: string;
  }) {
    const operationKey = `payout-primary:${input.providerId}:${input.commandId}`;
    const prior = await this.db.providerPayoutHistory.findUnique({ where: { operationKey } });
    if (prior === null) return null;
    if (
      !["PRIMARY_INITIALIZED", "PRIMARY_CHANGED"].includes(prior.event) ||
      prior.providerId !== input.providerId ||
      prior.destinationVersionId !== input.destinationVersionId ||
      prior.exactVersion !== input.expectedDestinationVersion ||
      prior.expectedPrimaryVersion !== input.expectedPrimaryVersion ||
      prior.actorUserId !== input.actorUserId ||
      prior.requestId !== input.requestId
    ) throw new Error("PAYOUT_PRIMARY_CONFLICT");
    return this.db.providerPrimaryPayoutDestination.findUnique({ where: { providerId: input.providerId } });
  }

  public async decide(input: {
    readonly providerId: string; readonly destinationVersionId: string; readonly expectedVersion: number;
    readonly outcome: "APPROVE" | "REJECT" | "REQUEST_CHANGES" | "REQUEST_REPLACEMENT" | "INVALIDATE";
    readonly verificationMethod: "MANUAL_WALLET_TRANSFER_CHECK" | "MANUAL_BANK_BENEFICIARY_CHECK";
    readonly reasonCode: string; readonly verificationNote: string; readonly acceptedRevealAttemptId: string | null;
    readonly approvalHolderAuthority?: {
      readonly holderRelationship: "PROVIDER_LEGAL_ENTITY" | "PROVIDER_OWNER";
      readonly authoritativeHolderLegalName: string;
      readonly protectedHolderMatches: (row: ProviderPayoutDestinationVersion) => boolean;
    };
    readonly actorUserId: string; readonly commandId: string; readonly requestId: string; readonly now: Date;
  }) {
    const replay = await this.findPayoutDecisionReplay(input);
    if (replay !== null) return replay;
    const operationKey = `payout-decision:${input.destinationVersionId}:${input.commandId}`;
    const prior = await this.db.providerPayoutDecision.findUnique({ where: { operationKey } });
    if (prior !== null) {
      if (
        prior.providerId !== input.providerId ||
        prior.destinationVersionId !== input.destinationVersionId ||
        prior.expectedDestinationVersion !== input.expectedVersion ||
        prior.outcome !== input.outcome ||
        prior.verificationMethod !== input.verificationMethod ||
        prior.reasonCode !== input.reasonCode ||
        prior.verificationNote !== input.verificationNote ||
        prior.actorUserId !== input.actorUserId ||
        prior.acceptedRevealAttemptId !== input.acceptedRevealAttemptId ||
        prior.requestId !== input.requestId
      ) throw new Error("PAYOUT_DESTINATION_VERSION_CONFLICT");
      return prior;
    }
    return this.db.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM providers WHERE id = ${input.providerId} FOR UPDATE`;
      const approvedProvider = await transaction.provider.findFirst({
        where: { id: input.providerId, applicationStatus: "APPROVED" }, select: { id: true },
      });
      if (approvedProvider === null) throw new Error("PROVIDER_NOT_APPROVED");
      await this.assertStaffPayoutPermission(transaction, input.actorUserId);
      const row = await transaction.providerPayoutDestinationVersion.findFirst({
        where: { id: input.destinationVersionId, providerId: input.providerId },
        include: {
          identityClaim: { include: { fingerprints: true } },
          chain: { include: { destinationType: true } },
          predecessor: { include: { identityClaim: true } },
        },
      });
      if (row === null || row.version !== input.expectedVersion) throw new Error("PAYOUT_DESTINATION_VERSION_CONFLICT");
      const methodMatches = (row.kind === "MOBILE_WALLET" && input.verificationMethod === "MANUAL_WALLET_TRANSFER_CHECK") ||
        (row.kind === "BANK_ACCOUNT" && input.verificationMethod === "MANUAL_BANK_BENEFICIARY_CHECK");
      if (!methodMatches) throw new Error("PAYOUT_DESTINATION_STATE_CONFLICT");
      if (input.outcome === "APPROVE" && input.acceptedRevealAttemptId === null) throw new Error("PAYOUT_STEP_UP_REQUIRED");
      if (input.acceptedRevealAttemptId !== null) {
        const revealAuthorizer = this.createAcceptedRevealAuthorizer?.(transaction);
        if (
          revealAuthorizer === undefined ||
          !(await revealAuthorizer.authorize({
            attemptId: input.acceptedRevealAttemptId,
            actorUserId: input.actorUserId,
            providerId: input.providerId,
            destinationVersionId: input.destinationVersionId,
            expectedVersion: input.expectedVersion,
            purpose: "MANUAL_PAYOUT_DESTINATION_VERIFICATION",
          }))
        ) {
          throw new Error("PAYOUT_STEP_UP_REQUIRED");
        }
      }
      if (input.outcome === "APPROVE") {
        if (
          input.approvalHolderAuthority === undefined ||
          input.approvalHolderAuthority.holderRelationship !== row.holderRelationship ||
          !input.approvalHolderAuthority.protectedHolderMatches(row)
        ) throw new Error("PAYOUT_HOLDER_NAME_MISMATCH");
        await this.assertCurrentHolderAuthority(transaction, {
          providerId: input.providerId,
          holderRelationship: row.holderRelationship,
          expectedHolderLegalName: input.approvalHolderAuthority.authoritativeHolderLegalName,
        });
      }
      const target = input.outcome === "APPROVE" ? "APPROVED" : input.outcome === "REJECT" ? "REJECTED"
        : input.outcome === "REQUEST_CHANGES" ? "CHANGES_REQUESTED" : input.outcome === "REQUEST_REPLACEMENT" ? "REPLACEMENT_REQUESTED" : "INVALIDATED";
      const legal = (row.status === "PENDING_VERIFICATION" && ["APPROVED", "REJECTED", "CHANGES_REQUESTED"].includes(target)) ||
        (row.status === "APPROVED" && ["REPLACEMENT_REQUESTED", "INVALIDATED"].includes(target));
      if (!legal) throw new Error("PAYOUT_DESTINATION_STATE_CONFLICT");
      if (target === "APPROVED") {
        await this.assertActiveRegistry(transaction, {
          destinationTypeId: row.chain.destinationTypeId,
          kind: row.kind,
          countryId: row.countryId,
          currencyCode: row.currencyCode,
          operatorId: row.operatorId,
          bankId: row.bankId,
        });
      }
      await transaction.providerPayoutDestinationVersion.update({
        where: { id: row.id },
        data: {
          status: target, version: { increment: 1 },
          ...(target === "APPROVED" ? { approvedAt: input.now } : {}),
          ...(target === "REJECTED" ? { rejectedAt: input.now } : {}),
          ...(target === "CHANGES_REQUESTED" ? { changesRequestedAt: input.now } : {}),
          ...(target === "REPLACEMENT_REQUESTED" ? { replacementRequestedAt: input.now } : {}),
          ...(target === "INVALIDATED" ? { invalidatedAt: input.now } : {}),
        },
      });
      const primaryBefore = await transaction.providerPrimaryPayoutDestination.findUnique({ where: { providerId: input.providerId } });
      const providerPrimaryState = await transaction.provider.findUniqueOrThrow({
        where: { id: input.providerId },
        select: { payoutPrimaryStateVersion: true },
      });
      let successorSupersededPredecessor = false;
      let successorInheritedPrimary = false;
      let successorRestoredPrimary = false;
      if (target === "APPROVED") {
        await transaction.providerPayoutDestinationChain.update({
          where: { id: row.chainId },
          data: {
            currentVersionId: row.id,
            effectiveApprovedVersionId: row.id,
            formerPrimaryEligible: false,
            primaryRestorationStateVersion: null,
            version: { increment: 1 },
          },
        });
        if (row.predecessor !== null) {
          await transaction.providerPayoutDestinationVersion.updateMany({
            where: {
              id: row.predecessor.id,
              status: { in: ["APPROVED", "CHANGES_REQUESTED", "REPLACEMENT_REQUESTED"] },
            },
            data: { status: "SUPERSEDED", supersededAt: input.now, version: { increment: 1 } },
          });
          successorSupersededPredecessor = true;
          if (row.predecessor.identityClaimId !== row.identityClaimId) {
            await this.releaseClaimIfUnused(transaction, row.predecessor.identityClaimId, row.predecessor.id, input.now);
          }
          const inheritsExistingPrimary = primaryBefore?.destinationVersionId === row.predecessor.id;
          const restoresFormerPrimary = primaryBefore === null &&
            row.chain.formerPrimaryEligible &&
            row.chain.primaryRestorationStateVersion === providerPrimaryState.payoutPrimaryStateVersion;
          if (inheritsExistingPrimary && primaryBefore !== null) {
            await transaction.providerPrimaryPayoutDestination.update({
              where: { providerId: input.providerId },
              data: {
                destinationVersionId: row.id,
                selectedByUserId: input.actorUserId,
                selectedAt: input.now,
                selectionReasonCode: "SUCCESSOR_INHERITED",
                version: { increment: 1 },
              },
            });
            await transaction.provider.update({ where: { id: input.providerId }, data: { payoutPrimaryStateVersion: { increment: 1 } } });
            successorInheritedPrimary = true;
          } else if (restoresFormerPrimary) {
            await transaction.providerPrimaryPayoutDestination.create({
              data: {
                providerId: input.providerId,
                destinationVersionId: row.id,
                selectedByUserId: input.actorUserId,
                selectedAt: input.now,
                selectionReasonCode: "SUCCESSOR_RESTORED",
              },
            });
            await transaction.provider.update({ where: { id: input.providerId }, data: { payoutPrimaryStateVersion: { increment: 1 } } });
            successorRestoredPrimary = true;
          }
        }
      } else if (row.status === "APPROVED") {
        const wasPrimary = primaryBefore?.destinationVersionId === row.id;
        const primaryStateAfterChallenge = wasPrimary
          ? await transaction.provider.update({
              where: { id: input.providerId },
              data: { payoutPrimaryStateVersion: { increment: 1 } },
              select: { payoutPrimaryStateVersion: true },
            })
          : providerPrimaryState;
        await transaction.providerPayoutDestinationChain.update({
          where: { id: row.chainId },
          data: {
            effectiveApprovedVersionId: null,
            formerPrimaryEligible: target === "REPLACEMENT_REQUESTED" && wasPrimary,
            primaryRestorationStateVersion: target === "REPLACEMENT_REQUESTED" && wasPrimary ? primaryStateAfterChallenge.payoutPrimaryStateVersion : null,
            version: { increment: 1 },
          },
        });
        await transaction.providerPrimaryPayoutDestination.deleteMany({ where: { providerId: input.providerId, destinationVersionId: row.id } });
        if (target === "INVALIDATED") await this.releaseClaimIfUnused(transaction, row.identityClaimId, row.id, input.now);
      }
      if (target === "REJECTED") await this.releaseClaimIfUnused(transaction, row.identityClaimId, row.id, input.now);
      const primary = await transaction.providerPrimaryPayoutDestination.findUnique({ where: { providerId: input.providerId } });
      if (target === "APPROVED" && shouldInitializeFirstPrimary({
        primaryDestinationVersionId: primary?.destinationVersionId ?? null,
        predecessorVersionId: row.predecessorVersionId,
        primaryStateVersion: providerPrimaryState.payoutPrimaryStateVersion,
      })) {
        await transaction.providerPrimaryPayoutDestination.create({ data: { providerId: input.providerId, destinationVersionId: row.id, selectedByUserId: input.actorUserId, selectedAt: input.now, selectionReasonCode: "FIRST_APPROVAL" } });
        await transaction.provider.update({ where: { id: input.providerId }, data: { payoutPrimaryStateVersion: { increment: 1 } } });
      }
      const decision = await transaction.providerPayoutDecision.create({
        data: {
          providerId: input.providerId, destinationVersionId: row.id, outcome: input.outcome,
          verificationMethod: input.verificationMethod, reasonCode: input.reasonCode,
          verificationNote: input.verificationNote, actorUserId: input.actorUserId,
          decidedAt: input.now, expectedDestinationVersion: input.expectedVersion,
          acceptedRevealAttemptId: input.acceptedRevealAttemptId, requestId: input.requestId,
          operationKey, fromStatus: row.status, toStatus: target,
          encryptionKeyIds: [row.identifierEncryptionKeyId, row.holderNameEncryptionKeyId],
          lookupKeyIds: row.identityClaim.fingerprints.map((item) => item.lookupKeyId),
        },
      });
      const event = target === "APPROVED" ? "DESTINATION_APPROVED" : target === "REJECTED" ? "DESTINATION_REJECTED"
        : target === "CHANGES_REQUESTED" ? "DESTINATION_CHANGES_REQUESTED" : target === "INVALIDATED" ? "DESTINATION_INVALIDATED" : "DESTINATION_REPLACEMENT_REQUESTED";
      const history = await transaction.providerPayoutHistory.create({
        data: {
          providerId: input.providerId, chainId: row.chainId, destinationVersionId: row.id, decisionId: decision.id,
          event, fromStatus: row.status, toStatus: target, actorType: "USER", actorUserId: input.actorUserId,
          reasonCode: input.reasonCode, safeMask: this.maskFromClaim(row.identityClaim), requestId: input.requestId,
          exactVersion: input.expectedVersion, operationKey: `history:${operationKey}`,
        },
      });
      if (successorSupersededPredecessor && row.predecessor !== null) {
        await transaction.providerPayoutHistory.create({
          data: {
            providerId: input.providerId,
            chainId: row.chainId,
            destinationVersionId: row.predecessor.id,
            decisionId: decision.id,
            event: "DESTINATION_SUPERSEDED",
            fromStatus: row.predecessor.status,
            toStatus: "SUPERSEDED",
            actorType: "USER",
            actorUserId: input.actorUserId,
            reasonCode: input.reasonCode,
            requestId: input.requestId,
            exactVersion: row.predecessor.version,
            operationKey: `supersede:${operationKey}`,
          },
        });
      }
      if (successorInheritedPrimary || successorRestoredPrimary) {
        await transaction.providerPayoutHistory.create({
          data: {
            providerId: input.providerId,
            chainId: row.chainId,
            destinationVersionId: row.id,
            decisionId: decision.id,
            event: successorInheritedPrimary ? "PRIMARY_CHANGED" : "PRIMARY_INITIALIZED",
            actorType: "USER",
            actorUserId: input.actorUserId,
            exactVersion: input.expectedVersion,
            operationKey: `successor-primary:${operationKey}`,
          },
        });
      }
      const recipientUserId = await this.readExactActiveOwnerRecipient(transaction, input.providerId);
      await transaction.providerEmailOutbox.create({ data: { providerId: input.providerId, template: target === "APPROVED" && row.predecessorVersionId !== null ? "PAYOUT_SUCCESSOR_APPROVED" : "PAYOUT_DESTINATION_DECIDED", recipientUserId, payoutHistoryId: history.id, idempotencyKey: `payout-decision-email:${input.commandId}` } });
      await this.createAuditWriter?.(transaction).append({
        actorType: "USER",
        actorId: input.actorUserId,
        action: `PROVIDER_PAYOUT_DESTINATION_${input.outcome}`,
        targetType: "PROVIDER_PAYOUT_DESTINATION_VERSION",
        targetId: row.id,
        reason: input.reasonCode,
        requestId: input.requestId,
        context: {
          providerId: input.providerId,
          expectedVersion: input.expectedVersion,
          outcome: input.outcome,
          verificationMethod: input.verificationMethod,
          encryptionKeyIds: [row.identifierEncryptionKeyId, row.holderNameEncryptionKeyId],
          lookupKeyIds: row.identityClaim.fingerprints.map((item) => item.lookupKeyId),
        },
      });
      return decision;
    });
  }

  public async findPayoutDecisionReplay(input: {
    readonly providerId: string;
    readonly destinationVersionId: string;
    readonly expectedVersion: number;
    readonly outcome: "APPROVE" | "REJECT" | "REQUEST_CHANGES" | "REQUEST_REPLACEMENT" | "INVALIDATE";
    readonly verificationMethod: "MANUAL_WALLET_TRANSFER_CHECK" | "MANUAL_BANK_BENEFICIARY_CHECK";
    readonly reasonCode: string;
    readonly verificationNote: string;
    readonly acceptedRevealAttemptId: string | null;
    readonly actorUserId: string;
    readonly commandId: string;
    readonly requestId: string;
  }) {
    const operationKey = `payout-decision:${input.destinationVersionId}:${input.commandId}`;
    const prior = await this.db.providerPayoutDecision.findUnique({ where: { operationKey } });
    if (prior === null) return null;
    if (
      prior.providerId !== input.providerId ||
      prior.destinationVersionId !== input.destinationVersionId ||
      prior.expectedDestinationVersion !== input.expectedVersion ||
      prior.outcome !== input.outcome ||
      prior.verificationMethod !== input.verificationMethod ||
      prior.reasonCode !== input.reasonCode ||
      prior.verificationNote !== input.verificationNote ||
      prior.actorUserId !== input.actorUserId ||
      prior.acceptedRevealAttemptId !== input.acceptedRevealAttemptId ||
      prior.requestId !== input.requestId
    ) throw new Error("PAYOUT_DESTINATION_VERSION_CONFLICT");
    return prior;
  }

  public async remove(input: {
    readonly providerId: string; readonly destinationVersionId: string; readonly expectedVersion: number;
    readonly expectedPrimaryVersion: number;
    readonly replacementPrimaryDestinationVersionId: string | null;
    readonly acknowledgeReadinessLoss: boolean;
    readonly actorUserId: string; readonly proofId: string; readonly reason: string; readonly commandId: string; readonly requestId: string; readonly now: Date;
  }) {
    const replay = await this.findPayoutRemovalReplay(input);
    if (replay !== null) return replay;
    const operationKey = `payout-remove:${input.commandId}`;
    const prior = await this.db.providerPayoutHistory.findUnique({ where: { operationKey } });
    if (prior !== null) {
      if (
        prior.providerId !== input.providerId ||
        prior.destinationVersionId !== input.destinationVersionId ||
        prior.exactVersion !== input.expectedVersion ||
        prior.expectedPrimaryVersion !== input.expectedPrimaryVersion ||
        prior.replacementDestinationVersionId !== input.replacementPrimaryDestinationVersionId ||
        prior.acknowledgeReadinessLoss !== input.acknowledgeReadinessLoss ||
        prior.actorUserId !== input.actorUserId ||
        prior.reasonText !== input.reason ||
        prior.requestId !== input.requestId
      ) throw new Error("PAYOUT_DESTINATION_VERSION_CONFLICT");
      return this.db.providerPayoutDestinationVersion.findUniqueOrThrow({ where: { id: input.destinationVersionId } });
    }
    return this.db.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM providers WHERE id = ${input.providerId} FOR UPDATE`;
      await this.assertOwnerMutationAuthority(transaction, { providerId: input.providerId, actorUserId: input.actorUserId });
      const row = await transaction.providerPayoutDestinationVersion.findFirst({ where: { id: input.destinationVersionId, providerId: input.providerId }, include: { identityClaim: true } });
      if (row === null || row.version !== input.expectedVersion) throw new Error("PAYOUT_DESTINATION_VERSION_CONFLICT");
      if (!["DRAFT", "PENDING_VERIFICATION", "APPROVED", "CHANGES_REQUESTED", "REPLACEMENT_REQUESTED"].includes(row.status)) throw new Error("PAYOUT_DESTINATION_STATE_CONFLICT");
      await this.assertConsumedProof(transaction, {
        proofId: input.proofId,
        actorUserId: input.actorUserId,
        purpose: row.status === "PENDING_VERIFICATION" ? "PROVIDER_PAYOUT_WITHDRAW" : "PROVIDER_PAYOUT_REMOVE",
        providerId: input.providerId,
        destinationVersionId: input.destinationVersionId,
        requestId: input.requestId,
        maximumAgeSeconds: 600,
        now: input.now,
      });
      const primary = await transaction.providerPrimaryPayoutDestination.findUnique({ where: { providerId: input.providerId } });
      const providerState = await transaction.provider.findUniqueOrThrow({ where: { id: input.providerId }, select: { payoutPrimaryStateVersion: true } });
      if (providerState.payoutPrimaryStateVersion !== input.expectedPrimaryVersion) throw new Error("PAYOUT_PRIMARY_CONFLICT");
      const removingPrimary = primary?.destinationVersionId === row.id;
      let replacement: { readonly id: string; readonly chainId: string } | null = null;
      if (input.replacementPrimaryDestinationVersionId !== null) {
        if (!removingPrimary) throw new Error("PAYOUT_PRIMARY_CONFLICT");
        replacement = await transaction.providerPayoutDestinationVersion.findFirst({
          where: {
            id: input.replacementPrimaryDestinationVersionId,
            providerId: input.providerId,
            status: "APPROVED",
            chain: {
              currentVersionId: input.replacementPrimaryDestinationVersionId,
              effectiveApprovedVersionId: input.replacementPrimaryDestinationVersionId,
            },
          },
          select: { id: true, chainId: true },
        });
        if (replacement === null) throw new Error("PAYOUT_PRIMARY_CONFLICT");
      }
      if (removingPrimary && replacement === null && !input.acknowledgeReadinessLoss) {
        throw new Error("PAYOUT_LAST_PRIMARY_ACKNOWLEDGEMENT_REQUIRED");
      }
      if (removingPrimary && replacement === null) {
        const anotherApproved = await transaction.providerPayoutDestinationVersion.findFirst({
          where: {
            providerId: input.providerId,
            id: { not: row.id },
            status: "APPROVED",
            chain: { currentVersionId: { not: null }, effectiveApprovedVersionId: { not: null } },
          },
          select: { id: true },
        });
        if (anotherApproved !== null) throw new Error("PAYOUT_REPLACEMENT_PRIMARY_REQUIRED");
      }
      if (removingPrimary && primary !== null) {
        if (replacement === null) {
          await transaction.providerPrimaryPayoutDestination.delete({ where: { providerId: input.providerId } });
        } else {
          await transaction.providerPrimaryPayoutDestination.update({
            where: { providerId: input.providerId },
            data: {
              destinationVersionId: replacement.id,
              selectedByUserId: input.actorUserId,
              selectedAt: input.now,
              selectionReasonCode: "REMOVAL_REPLACEMENT",
              version: { increment: 1 },
            },
          });
        }
        await transaction.provider.update({ where: { id: input.providerId }, data: { payoutPrimaryStateVersion: { increment: 1 } } });
      }
      await transaction.providerPayoutDestinationVersion.update({ where: { id: row.id }, data: { status: "REMOVED", removedAt: input.now, version: { increment: 1 } } });
      await this.releaseClaimIfUnused(transaction, row.identityClaimId, row.id, input.now);
      await transaction.providerPayoutDestinationChain.update({ where: { id: row.chainId }, data: { currentVersionId: null, effectiveApprovedVersionId: null, version: { increment: 1 } } });
      const removalHistory = await transaction.providerPayoutHistory.create({ data: { providerId: input.providerId, chainId: row.chainId, destinationVersionId: row.id, event: "DESTINATION_REMOVED", fromStatus: row.status, toStatus: "REMOVED", actorType: "USER", actorUserId: input.actorUserId, reasonCode: "REMOVED_BY_OWNER", reasonText: input.reason, safeMask: this.maskFromClaim(row.identityClaim), requestId: input.requestId, exactVersion: input.expectedVersion, expectedPrimaryVersion: input.expectedPrimaryVersion, replacementDestinationVersionId: input.replacementPrimaryDestinationVersionId, acknowledgeReadinessLoss: input.acknowledgeReadinessLoss, operationKey } });
      if (removingPrimary) {
        await transaction.providerPayoutHistory.create({
          data: {
            providerId: input.providerId,
            chainId: replacement?.chainId ?? row.chainId,
            destinationVersionId: replacement?.id ?? row.id,
            event: replacement === null ? "PRIMARY_CLEARED" : "PRIMARY_CHANGED",
            actorType: "USER",
            actorUserId: input.actorUserId,
            exactVersion: input.expectedVersion,
            operationKey: `primary:${operationKey}`,
          },
        });
      }
      const recipientUserId = await this.readExactActiveOwnerRecipient(transaction, input.providerId);
      await transaction.providerEmailOutbox.create({
        data: {
          providerId: input.providerId,
          template: "PAYOUT_DESTINATION_REMOVED",
          recipientUserId,
          payoutHistoryId: removalHistory.id,
          idempotencyKey: `payout-removed-email:${input.commandId}`,
        },
      });
      await this.createAuditWriter?.(transaction).append({
        actorType: "USER",
        actorId: input.actorUserId,
        action: "PROVIDER_PAYOUT_DESTINATION_REMOVED",
        targetType: "PROVIDER_PAYOUT_DESTINATION_VERSION",
        targetId: row.id,
        reason: "REMOVED_BY_OWNER",
        requestId: input.requestId,
        context: { providerId: input.providerId, expectedVersion: input.expectedVersion, outcome: "REMOVED" },
      });
      return transaction.providerPayoutDestinationVersion.findUniqueOrThrow({ where: { id: row.id } });
    });
  }

  public async findPayoutRemovalReplay(input: {
    readonly providerId: string;
    readonly destinationVersionId: string;
    readonly expectedVersion: number;
    readonly expectedPrimaryVersion: number;
    readonly replacementPrimaryDestinationVersionId: string | null;
    readonly acknowledgeReadinessLoss: boolean;
    readonly actorUserId: string;
    readonly reason: string;
    readonly commandId: string;
    readonly requestId: string;
  }): Promise<ProviderPayoutDestinationVersion | null> {
    const operationKey = `payout-remove:${input.commandId}`;
    const prior = await this.db.providerPayoutHistory.findUnique({ where: { operationKey } });
    if (prior === null) return null;
    if (
      prior.event !== "DESTINATION_REMOVED" ||
      prior.providerId !== input.providerId ||
      prior.destinationVersionId !== input.destinationVersionId ||
      prior.exactVersion !== input.expectedVersion ||
      prior.expectedPrimaryVersion !== input.expectedPrimaryVersion ||
      prior.replacementDestinationVersionId !== input.replacementPrimaryDestinationVersionId ||
      prior.acknowledgeReadinessLoss !== input.acknowledgeReadinessLoss ||
      prior.actorUserId !== input.actorUserId ||
      prior.reasonText !== input.reason ||
      prior.requestId !== input.requestId
    ) throw new Error("PAYOUT_DESTINATION_VERSION_CONFLICT");
    return this.db.providerPayoutDestinationVersion.findUniqueOrThrow({ where: { id: input.destinationVersionId } });
  }

  public listQueue(input: { readonly limit: number; readonly cursorSubmittedAt?: Date; readonly cursorId?: string }) {
    return this.db.providerPayoutDestinationVersion.findMany({
      where: {
        status: "PENDING_VERIFICATION",
        ...(input.cursorSubmittedAt === undefined || input.cursorId === undefined ? {} : {
          OR: [{ submittedAt: { gt: input.cursorSubmittedAt } }, { submittedAt: input.cursorSubmittedAt, id: { gt: input.cursorId } }],
        }),
      }, orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
      take: Math.min(101, Math.max(1, input.limit)), include: { identityClaim: true, operator: true, bank: true, chain: true },
    });
  }

  public listHistory(providerId: string, limit = 20, cursor?: { readonly createdAt: Date; readonly id: string }) {
    return this.db.providerPayoutHistory.findMany({
      where: { providerId, ...(cursor === undefined ? {} : { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: Math.min(101, Math.max(1, limit)),
    });
  }

  public listOpenConflicts(input: { readonly limit: number; readonly cursorOpenedAt?: Date; readonly cursorId?: string }) {
    return this.db.providerPayoutConflict.findMany({
      where: {
        status: "OPEN",
        ...(input.cursorOpenedAt === undefined || input.cursorId === undefined ? {} : {
          OR: [{ openedAt: { gt: input.cursorOpenedAt } }, { openedAt: input.cursorOpenedAt, id: { gt: input.cursorId } }],
        }),
      }, orderBy: [{ openedAt: "asc" }, { id: "asc" }], take: Math.min(101, Math.max(1, input.limit)),
    });
  }

  public async recordConflict(input: {
    readonly providerId: string; readonly commandId: string; readonly kind: PayoutDestinationKind;
    readonly safeMask: string; readonly incumbentClaimId: string; readonly actorUserId: string; readonly requestId: string;
  }) {
    const operationKey = `payout-conflict:${input.providerId}:${input.commandId}`;
    const prior = await this.db.providerPayoutConflict.findUnique({ where: { operationKey } });
    if (prior !== null) {
      if (
        prior.providerId !== input.providerId ||
        prior.commandId !== input.commandId ||
        prior.kind !== input.kind ||
        prior.safeMask !== input.safeMask ||
        prior.incumbentClaimId !== input.incumbentClaimId ||
        prior.openedByUserId !== input.actorUserId ||
        prior.openedRequestId !== input.requestId
      ) throw new Error("PAYOUT_DESTINATION_CONFLICT");
      return prior;
    }
    return this.db.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM providers WHERE id = ${input.providerId} FOR UPDATE`;
      await this.assertOwnerMutationAuthority(transaction, { providerId: input.providerId, actorUserId: input.actorUserId });
      const row = await transaction.providerPayoutConflict.create({
        data: {
          providerId: input.providerId, commandId: input.commandId, operationKey, kind: input.kind,
          safeMask: input.safeMask, incumbentClaimId: input.incumbentClaimId,
          openedByUserId: input.actorUserId, openedRequestId: input.requestId,
        },
      });
      await transaction.providerPayoutHistory.create({
        data: {
          providerId: input.providerId,
          conflictId: row.id,
          event: "IDENTITY_CONFLICT_OPENED",
          actorType: "USER",
          actorUserId: input.actorUserId,
          safeMask: input.safeMask,
          requestId: input.requestId,
          operationKey: `history:${operationKey}`,
        },
      });
      await this.createAuditWriter?.(transaction).append({
        actorType: "USER",
        actorId: input.actorUserId,
        action: "PROVIDER_PAYOUT_CONFLICT_OPENED",
        targetType: "PROVIDER_PAYOUT_CONFLICT",
        targetId: row.id,
        reason: "IDENTITY_CONFLICT",
        requestId: input.requestId,
        context: { providerId: input.providerId, outcome: "OPEN" },
      });
      return row;
    });
  }

  public async resolveConflict(input: {
    readonly conflictId: string; readonly providerId: string; readonly expectedVersion: number;
    readonly outcome: "CANDIDATE_REJECTED" | "RESOLVED_AFTER_RELEASE"; readonly reason: string;
    readonly actorUserId: string; readonly commandId: string; readonly requestId: string; readonly now: Date;
  }) {
    const operationKey = `payout-conflict-resolution:${input.conflictId}:${input.commandId}`;
    const prior = await this.db.providerPayoutHistory.findUnique({ where: { operationKey } });
    if (prior !== null) {
      const conflict = await this.db.providerPayoutConflict.findUnique({ where: { id: input.conflictId } });
      if (
        prior.providerId !== input.providerId ||
        prior.conflictId !== input.conflictId ||
        prior.exactVersion !== input.expectedVersion ||
        prior.actorUserId !== input.actorUserId ||
        prior.reasonText !== input.reason ||
        prior.requestId !== input.requestId ||
        conflict?.status !== input.outcome
      ) throw new Error("PAYOUT_DESTINATION_CONFLICT");
      return conflict;
    }
    return this.db.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM providers WHERE id = ${input.providerId} FOR UPDATE`;
      await this.assertStaffPayoutPermission(transaction, input.actorUserId);
      await transaction.$queryRaw`SELECT id FROM provider_payout_conflicts WHERE id = ${input.conflictId} FOR UPDATE`;
      const conflict = await transaction.providerPayoutConflict.findFirst({
        where: { id: input.conflictId, providerId: input.providerId, status: "OPEN", version: input.expectedVersion },
        include: { incumbentClaim: true },
      });
      if (conflict === null) throw new Error("PAYOUT_DESTINATION_VERSION_CONFLICT");
      if (input.outcome === "RESOLVED_AFTER_RELEASE" && conflict.incumbentClaim.status !== "RELEASED") {
        throw new Error("PAYOUT_DESTINATION_CONFLICT");
      }
      const row = await transaction.providerPayoutConflict.update({
        where: { id: conflict.id },
        data: { status: input.outcome, resolutionReason: input.reason, resolvedByUserId: input.actorUserId, resolvedAt: input.now, version: { increment: 1 } },
      });
      await transaction.providerPayoutHistory.create({
        data: {
          providerId: input.providerId,
          conflictId: row.id,
          event: "IDENTITY_CONFLICT_RESOLVED",
          actorType: "USER",
          actorUserId: input.actorUserId,
          reasonCode: input.outcome,
          reasonText: input.reason,
          safeMask: row.safeMask,
          requestId: input.requestId,
          exactVersion: input.expectedVersion,
          operationKey,
        },
      });
      await this.createAuditWriter?.(transaction).append({
        actorType: "USER",
        actorId: input.actorUserId,
        action: "PROVIDER_PAYOUT_CONFLICT_RESOLVED",
        targetType: "PROVIDER_PAYOUT_CONFLICT",
        targetId: row.id,
        reason: input.outcome,
        requestId: input.requestId,
        context: { providerId: input.providerId, expectedVersion: input.expectedVersion, outcome: input.outcome },
      });
      return row;
    });
  }

  public async countKeyReferences(input: { readonly encryptionKeyId?: string; readonly lookupKeyId?: string }): Promise<number> {
    if (input.encryptionKeyId !== undefined) {
      return this.db.providerPayoutDestinationVersion.count({ where: { OR: [{ identifierEncryptionKeyId: input.encryptionKeyId }, { holderNameEncryptionKeyId: input.encryptionKeyId }] } });
    }
    if (input.lookupKeyId === undefined) return 0;
    return this.db.providerPayoutLookupFingerprint.count({ where: { lookupKeyId: input.lookupKeyId } });
  }

  public async createRotationRun(input: {
    readonly purpose: "ENCRYPTION" | "LOOKUP_HMAC";
    readonly fromKeyIds: readonly string[];
    readonly toActiveKeyId: string;
    readonly batchSize: number;
    readonly startedByUserId: string;
    readonly commandId: string;
  }): Promise<ProviderPayoutKeyRotationRun> {
    const operationKey = `payout-key-rotation:${input.commandId}`;
    const normalizedBatchSize = Math.min(1000, Math.max(1, input.batchSize));
    const prior = await this.db.providerPayoutKeyRotationRun.findUnique({ where: { operationKey } });
    if (prior !== null) {
      if (
        prior.purpose !== input.purpose ||
        prior.toActiveKeyId !== input.toActiveKeyId ||
        prior.batchSize !== normalizedBatchSize ||
        prior.startedByUserId !== input.startedByUserId ||
        prior.fromKeyIds.length !== input.fromKeyIds.length ||
        prior.fromKeyIds.some((keyId, index) => keyId !== input.fromKeyIds[index])
      ) throw new Error("PAYOUT_KEY_ROTATION_CONFLICT");
      return prior;
    }
    try {
      return await this.db.providerPayoutKeyRotationRun.create({
        data: {
        purpose: input.purpose,
        fromKeyIds: [...input.fromKeyIds],
        toActiveKeyId: input.toActiveKeyId,
        status: "RUNNING",
        batchSize: normalizedBatchSize,
        startedByUserId: input.startedByUserId,
        operationKey,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return this.createRotationRun(input);
      }
      throw error;
    }
  }

  public readRotationRun(runId: string) {
    return this.db.providerPayoutKeyRotationRun.findUnique({ where: { id: runId } });
  }

  public listEncryptionRotationCandidates(input: { readonly fromKeyIds: readonly string[]; readonly cursor: string | null; readonly limit: number }) {
    return this.db.providerPayoutDestinationVersion.findMany({
      where: {
        ...(input.cursor === null ? {} : { id: { gt: input.cursor } }),
        OR: [
          { identifierEncryptionKeyId: { in: [...input.fromKeyIds] } },
          { holderNameEncryptionKeyId: { in: [...input.fromKeyIds] } },
        ],
      },
      orderBy: { id: "asc" },
      take: Math.min(1000, Math.max(1, input.limit)),
    });
  }

  public listLookupRotationCandidates(input: { readonly fromKeyIds: readonly string[]; readonly cursor: string | null; readonly limit: number }) {
    return this.db.providerPayoutIdentityClaim.findMany({
      where: {
        ...(input.cursor === null ? {} : { id: { gt: input.cursor } }),
        fingerprints: { some: { lookupKeyId: { in: [...input.fromKeyIds] } } },
      },
      orderBy: { id: "asc" },
      take: Math.min(1000, Math.max(1, input.limit)),
      include: {
        fingerprints: true,
        destinationVersions: { orderBy: { sequence: "desc" }, take: 1 },
      },
    });
  }

  public async updateEncryptionRotation(input: {
    readonly destinationVersionId: string;
    readonly expectedCryptoRevision: number;
    readonly identifierEnvelope: EncryptedPayoutField;
    readonly holderEnvelope: EncryptedPayoutField;
  }): Promise<void> {
    const changed = await this.db.providerPayoutDestinationVersion.updateMany({
      where: { id: input.destinationVersionId, cryptoRevision: input.expectedCryptoRevision },
      data: {
        identifierCiphertext: input.identifierEnvelope.ciphertext,
        identifierNonce: input.identifierEnvelope.nonce,
        identifierTag: input.identifierEnvelope.authenticationTag,
        identifierEncryptionKeyId: input.identifierEnvelope.encryptionKeyId,
        holderNameCiphertext: input.holderEnvelope.ciphertext,
        holderNameNonce: input.holderEnvelope.nonce,
        holderNameTag: input.holderEnvelope.authenticationTag,
        holderNameEncryptionKeyId: input.holderEnvelope.encryptionKeyId,
        cryptoRevision: { increment: 1 },
      },
    });
    if (changed.count !== 1) throw new Error("PAYOUT_KEY_ROTATION_CONFLICT");
  }

  public async updateLookupRotation(input: {
    readonly claimId: string;
    readonly claimStatus: "ACTIVE" | "RELEASED";
    readonly fromKeyIds: readonly string[];
    readonly fingerprints: readonly { readonly lookupKeyId: string; readonly fingerprint: string }[];
    readonly now: Date;
  }): Promise<void> {
    await this.db.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM provider_payout_identity_claims WHERE id = ${input.claimId} FOR UPDATE`;
      for (const fingerprint of input.fingerprints) {
        await transaction.providerPayoutLookupFingerprint.upsert({
          where: { claimId_lookupKeyId: { claimId: input.claimId, lookupKeyId: fingerprint.lookupKeyId } },
          update: {
            fingerprint: fingerprint.fingerprint,
            claimStatus: input.claimStatus,
            retiredAt: input.claimStatus === "RELEASED" ? input.now : null,
          },
          create: {
            claimId: input.claimId,
            ...fingerprint,
            claimStatus: input.claimStatus,
            retiredAt: input.claimStatus === "RELEASED" ? input.now : null,
          },
        });
      }
      await transaction.providerPayoutLookupFingerprint.deleteMany({
        where: { claimId: input.claimId, lookupKeyId: { in: [...input.fromKeyIds] } },
      });
      await transaction.providerPayoutIdentityClaim.update({ where: { id: input.claimId }, data: { version: { increment: 1 } } });
    });
  }

  public async updateRotationProgress(input: {
    readonly runId: string;
    readonly expectedVersion: number;
    readonly cursor: string | null;
    readonly scanned: number;
    readonly updated: number;
    readonly failed: number;
    readonly complete: boolean;
    readonly remainingReferenceCount: number | null;
    readonly verifiedByUserId: string | null;
    readonly lastSafeErrorCode: string | null;
  }) {
    const changed = await this.db.providerPayoutKeyRotationRun.updateMany({
      where: { id: input.runId, version: input.expectedVersion, status: { in: ["RUNNING", "VERIFYING"] } },
      data: {
        cursor: input.cursor,
        scannedCount: { increment: input.scanned },
        updatedCount: { increment: input.updated },
        failedCount: { increment: input.failed },
        status: input.complete ? "READY_FOR_RETIREMENT" : "RUNNING",
        remainingReferenceCount: input.remainingReferenceCount,
        verifiedByUserId: input.complete ? input.verifiedByUserId : null,
        lastSafeErrorCode: input.lastSafeErrorCode,
        ...(input.complete && input.remainingReferenceCount === 0 ? { verifiedAt: new Date() } : { verifiedAt: null }),
        version: { increment: 1 },
      },
    });
    if (changed.count !== 1) throw new Error("PAYOUT_KEY_ROTATION_CONFLICT");
    return this.db.providerPayoutKeyRotationRun.findUniqueOrThrow({ where: { id: input.runId } });
  }

  public async approveRotationRetirement(input: {
    readonly runId: string;
    readonly expectedVersion: number;
    readonly approvedByUserId: string;
    readonly reason: string;
    readonly now: Date;
  }) {
    const changed = await this.db.providerPayoutKeyRotationRun.updateMany({
      where: { id: input.runId, version: input.expectedVersion, status: "READY_FOR_RETIREMENT", remainingReferenceCount: 0 },
      data: {
        status: "COMPLETED",
        retirementApprovedAt: input.now,
        retirementApprovedByUserId: input.approvedByUserId,
        retirementReason: input.reason,
        version: { increment: 1 },
      },
    });
    if (changed.count !== 1) throw new Error("PAYOUT_KEY_ROTATION_CONFLICT");
    return this.db.providerPayoutKeyRotationRun.findUniqueOrThrow({ where: { id: input.runId } });
  }

  private maskFromFacts(kind: PayoutDestinationKind, facts: { readonly callingCode: string | null; readonly ibanCountryPrefix: string | null; readonly lastFour: string; readonly identifierLength: number }): string {
    const prefix = kind === "MOBILE_WALLET" ? `+${facts.callingCode ?? ""}` : facts.ibanCountryPrefix ?? "";
    const raw = `${prefix}${"•".repeat(Math.max(0, facts.identifierLength - prefix.length - facts.lastFour.length))}${facts.lastFour}`;
    return kind === "BANK_ACCOUNT" ? raw.match(/.{1,4}/gu)?.join(" ") ?? raw : raw;
  }

  private async releaseClaimIfUnused(
    transaction: Prisma.TransactionClient,
    claimId: string,
    excludingDestinationVersionId: string,
    now: Date,
  ): Promise<void> {
    const retained = await transaction.providerPayoutDestinationVersion.findFirst({
      where: {
        identityClaimId: claimId,
        id: { not: excludingDestinationVersionId },
        status: { in: [...ACTIVE_CHAIN_STATES] },
      },
      select: { id: true },
    });
    if (retained !== null) return;
    await transaction.providerPayoutIdentityClaim.update({
      where: { id: claimId },
      data: {
        status: "RELEASED",
        releasedAt: now,
        version: { increment: 1 },
        fingerprints: { updateMany: { where: {}, data: { claimStatus: "RELEASED", retiredAt: now } } },
      },
    });
  }

  private async reactivateClaim(
    transaction: Prisma.TransactionClient,
    claimId: string,
    fingerprints: readonly { readonly lookupKeyId: string; readonly fingerprint: string }[],
  ): Promise<void> {
    await transaction.providerPayoutIdentityClaim.update({
      where: { id: claimId },
      data: { status: "ACTIVE", releasedAt: null, version: { increment: 1 } },
    });
    for (const fingerprint of fingerprints) {
      await transaction.providerPayoutLookupFingerprint.upsert({
        where: { claimId_lookupKeyId: { claimId, lookupKeyId: fingerprint.lookupKeyId } },
        update: { fingerprint: fingerprint.fingerprint, claimStatus: "ACTIVE", retiredAt: null },
        create: { claimId, ...fingerprint, claimStatus: "ACTIVE" },
      });
    }
  }

  private maskFromClaim(claim: { readonly kind: PayoutDestinationKind; readonly callingCode: string | null; readonly ibanCountryPrefix: string | null; readonly lastFour: string; readonly identifierLength: number }): string {
    return this.maskFromFacts(claim.kind, claim);
  }

  public safeMask(claim: { readonly kind: PayoutDestinationKind; readonly callingCode: string | null; readonly ibanCountryPrefix: string | null; readonly lastFour: string; readonly identifierLength: number }): string {
    return this.maskFromClaim(claim);
  }
}
