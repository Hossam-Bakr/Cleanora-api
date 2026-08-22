import { randomUUID } from "node:crypto";

import type { AuthenticationPrincipal, RecentAuthenticationProofVerifier } from "../authentication/authentication.public.js";
import type { ProviderPayoutHolderAuthorityReader } from "../customers/customers.public.js";
import type { PayoutKeyRings } from "./domain/provider-verification.types.js";
import { buildIbanMask, buildWalletMask, normalizeIban, normalizeWalletE164 } from "./domain/payout-destination.policy.js";
import { createPayoutDataCrypto, payoutLookupFingerprints } from "./infrastructure/payout-data-crypto.adapter.js";
import type { PrismaPayoutRegistryRepository } from "./infrastructure/prisma-payout-registry.repository.js";
import type { PrismaProviderPayoutRepository } from "./infrastructure/prisma-provider-payout.repository.js";
import { decodeR1P06Cursor, encodeR1P06Cursor } from "./domain/r1-p06.cursor.js";
import type { ProviderPayoutConflictService } from "./provider-payout-conflict.service.js";
import type { ProviderDenialAuditService } from "./provider-denial-audit.service.js";

export type PayoutDraftInput =
  | { readonly type: "MOBILE_WALLET"; readonly countryCode: string; readonly walletNumber: string; readonly operatorCode: string; readonly holderLegalName: string; readonly holderRelationship: "PROVIDER_LEGAL_ENTITY" | "PROVIDER_OWNER"; readonly commandId: string }
  | { readonly type: "BANK_ACCOUNT"; readonly countryCode: string; readonly currencyCode: string; readonly bankCode: string; readonly iban: string; readonly holderLegalName: string; readonly holderRelationship: "PROVIDER_LEGAL_ENTITY" | "PROVIDER_OWNER"; readonly commandId: string };

interface StoredHolderEnvelopeRow {
  readonly providerId: string;
  readonly chainId: string;
  readonly id: string;
  readonly sequence: number;
  readonly kind: "MOBILE_WALLET" | "BANK_ACCOUNT";
  readonly holderNameCiphertext: string;
  readonly holderNameNonce: string;
  readonly holderNameTag: string;
  readonly holderNameEncryptionKeyId: string;
}

export class ProviderPayoutDestinationService {
  private readonly crypto;
  public constructor(
    private readonly repository: PrismaProviderPayoutRepository,
    private readonly registries: PrismaPayoutRegistryRepository,
    private readonly holderReader: ProviderPayoutHolderAuthorityReader,
    private readonly proofVerifier: RecentAuthenticationProofVerifier,
    private readonly conflicts: ProviderPayoutConflictService,
    rings: PayoutKeyRings,
    private readonly now: () => Date = () => new Date(),
    private readonly denialAudit?: ProviderDenialAuditService,
  ) { this.crypto = createPayoutDataCrypto(rings); this.rings = rings; }
  private readonly rings: PayoutKeyRings;

  private storedHolderMatches(row: StoredHolderEnvelopeRow, expectedHolderLegalName: string): boolean {
    const stored = this.crypto.decrypt({
      ciphertext: row.holderNameCiphertext,
      nonce: row.holderNameNonce,
      authenticationTag: row.holderNameTag,
      encryptionKeyId: row.holderNameEncryptionKeyId,
    }, {
      providerId: row.providerId,
      destinationChainId: row.chainId,
      destinationVersionId: row.id,
      destinationSequence: row.sequence,
      destinationType: row.kind,
      fieldName: "HOLDER_NAME",
      encryptionKeyId: row.holderNameEncryptionKeyId,
    });
    return stored.trim() === expectedHolderLegalName.trim();
  }

  private async denyProviderScope(
    principal: AuthenticationPrincipal,
    providerId: string,
    action: string,
    publicErrorCode: "PROVIDER_SCOPE_DENIED" | "PROVIDER_NOT_APPROVED" = "PROVIDER_SCOPE_DENIED",
  ): Promise<never> {
    if (this.denialAudit !== undefined) {
      return this.denialAudit.denyR1P06({
        actorUserId: principal.userId,
        action,
        targetId: providerId,
        publicErrorCode,
      });
    }
    throw new Error(publicErrorCode);
  }

  private async authorizeOwner(principal: AuthenticationPrincipal, providerId: string) {
    const provider = await this.repository.readAccess(providerId, principal.userId);
    if (principal.status !== "ACTIVE" || principal.verificationOnly || provider === null || provider.applicationStatus !== "APPROVED") {
      return this.denyProviderScope(principal, providerId, "PROVIDER_PAYOUT_DESTINATION_MUTATION", "PROVIDER_NOT_APPROVED");
    }
    const member = provider.members[0];
    if (member?.status !== "ACTIVE" || member.level !== "OWNER" || provider.ownerUserId !== principal.userId) {
      return this.denyProviderScope(principal, providerId, "PROVIDER_PAYOUT_DESTINATION_MUTATION");
    }
    const country = provider.profile?.country;
    if (country === null || country === undefined || country.isActive !== true) throw new Error("PAYOUT_REGISTRY_INACTIVE");
    return { provider, country };
  }

  public async options(input: { readonly principal: AuthenticationPrincipal; readonly providerId: string }) {
    const { provider, country } = await this.authorizeOwner(input.principal, input.providerId);
    const options = await this.registries.readOptions(country.code);
    return {
      countryCode: country.code,
      primaryStateVersion: provider.payoutPrimaryStateVersion,
      currencyCodes: options.policy.allowedCurrencyCodes,
      types: options.types.map((item) => ({ code: item.code, labelAr: item.labelAr, labelEn: item.labelEn })),
      operators: options.operators.map((item) => ({ code: item.code, labelAr: item.labelAr, labelEn: item.labelEn })),
      banks: options.banks.map((item) => ({ code: item.code, labelAr: item.nameAr, labelEn: item.nameEn })),
    };
  }

  public async list(input: { readonly principal: AuthenticationPrincipal; readonly providerId: string; readonly limit?: number; readonly cursor?: string }) {
    const provider = await this.repository.readAccess(input.providerId, input.principal.userId);
    const member = provider?.members[0];
    if (input.principal.status !== "ACTIVE" || input.principal.verificationOnly || provider?.applicationStatus !== "APPROVED" || member?.status !== "ACTIVE" || !["OWNER", "ADMIN"].includes(member.level)) {
      return this.denyProviderScope(input.principal, input.providerId, "PROVIDER_PAYOUT_DESTINATION_LIST");
    }
    const limit = Math.min(100, Math.max(1, input.limit ?? 20));
    const cursor = decodeR1P06Cursor(input.cursor, "provider-payout-destinations");
    const rows = await this.repository.list({ providerId: input.providerId, limit: limit + 1, ...(cursor === undefined ? {} : { cursorUpdatedAt: cursor.at, cursorId: cursor.id }) });
    const visible = rows.slice(0, limit);
    const items = visible.map((row) => {
      const prefix = row.kind === "MOBILE_WALLET" ? `+${row.identityClaim.callingCode ?? ""}` : row.identityClaim.ibanCountryPrefix ?? "";
      const rawMask = `${prefix}${"•".repeat(Math.max(0, row.identityClaim.identifierLength - prefix.length - row.identityClaim.lastFour.length))}${row.identityClaim.lastFour}`;
      const mask = row.kind === "BANK_ACCOUNT" ? rawMask.match(/.{1,4}/gu)?.join(" ") ?? rawMask : rawMask;
      let holderLegalName: string | undefined;
      if (member.level === "OWNER") {
        holderLegalName = this.crypto.decrypt({ ciphertext: row.holderNameCiphertext, nonce: row.holderNameNonce, authenticationTag: row.holderNameTag, encryptionKeyId: row.holderNameEncryptionKeyId }, {
          providerId: row.providerId, destinationChainId: row.chainId, destinationVersionId: row.id,
          destinationSequence: row.sequence, destinationType: row.kind, fieldName: "HOLDER_NAME",
          encryptionKeyId: row.holderNameEncryptionKeyId,
        });
      }
      return {
        destinationVersionId: row.id, chainId: row.chainId, type: row.kind, mask,
        ...(member.level === "OWNER" ? {
          institution: row.operator === null ? row.bank === null ? null : { code: row.bank.code, label: row.bank.nameEn } : { code: row.operator.code, label: row.operator.labelEn },
          holderRelationship: row.holderRelationship,
          holderLegalName,
          sequence: row.sequence,
          version: row.version,
        } : {}),
        status: row.status, primary: row.primaryForProvider !== null,
        createdAt: row.createdAt.toISOString(), submittedAt: row.submittedAt?.toISOString() ?? null,
        decidedAt: row.decisions[0]?.decidedAt.toISOString() ?? null,
      };
    });
    const last = visible.at(-1);
    return {
      items,
      nextCursor: rows.length > limit && last !== undefined ? encodeR1P06Cursor("provider-payout-destinations", last.updatedAt, last.id) : null,
      primaryStateVersion: provider.payoutPrimaryStateVersion,
    };
  }

  public async detail(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly destinationVersionId: string;
  }) {
    const provider = await this.repository.readAccess(input.providerId, input.principal.userId);
    const member = provider?.members[0];
    if (input.principal.status !== "ACTIVE" || input.principal.verificationOnly || provider?.applicationStatus !== "APPROVED" || member?.status !== "ACTIVE" || !["OWNER", "ADMIN"].includes(member.level)) {
      return this.denyProviderScope(input.principal, input.providerId, "PROVIDER_PAYOUT_DESTINATION_READ");
    }
    const row = await this.repository.read(input.providerId, input.destinationVersionId);
    if (row === null) throw new Error("PAYOUT_DESTINATION_STATE_CONFLICT");
    const prefix = row.kind === "MOBILE_WALLET" ? `+${row.identityClaim.callingCode ?? ""}` : row.identityClaim.ibanCountryPrefix ?? "";
    const rawMask = `${prefix}${"•".repeat(Math.max(0, row.identityClaim.identifierLength - prefix.length - row.identityClaim.lastFour.length))}${row.identityClaim.lastFour}`;
    const mask = row.kind === "BANK_ACCOUNT" ? rawMask.match(/.{1,4}/gu)?.join(" ") ?? rawMask : rawMask;
    let holderLegalName: string | undefined;
    if (member.level === "OWNER") {
      holderLegalName = this.crypto.decrypt({ ciphertext: row.holderNameCiphertext, nonce: row.holderNameNonce, authenticationTag: row.holderNameTag, encryptionKeyId: row.holderNameEncryptionKeyId }, {
        providerId: row.providerId, destinationChainId: row.chainId, destinationVersionId: row.id,
        destinationSequence: row.sequence, destinationType: row.kind, fieldName: "HOLDER_NAME",
        encryptionKeyId: row.holderNameEncryptionKeyId,
      });
    }
    return {
      destinationVersionId: row.id,
      chainId: row.chainId,
      type: row.kind,
      mask,
      ...(member.level === "OWNER" ? {
        institution: row.operator === null ? row.bank === null ? null : { code: row.bank.code, label: row.bank.nameEn } : { code: row.operator.code, label: row.operator.labelEn },
        holderRelationship: row.holderRelationship,
        holderLegalName,
        sequence: row.sequence,
        version: row.version,
      } : {}),
      status: row.status,
      primary: row.primaryForProvider !== null,
      createdAt: row.createdAt.toISOString(),
      submittedAt: row.submittedAt?.toISOString() ?? null,
      decidedAt: row.decisions[0]?.decidedAt.toISOString() ?? null,
    };
  }

  public async createDraft(input: { readonly principal: AuthenticationPrincipal; readonly providerId: string; readonly requestId: string; readonly draft: PayoutDraftInput }) {
    const { provider, country } = await this.authorizeOwner(input.principal, input.providerId);
    if (country.code !== input.draft.countryCode) throw new Error("PAYOUT_REGISTRY_INACTIVE");
    const names = await this.holderReader.readLegalNameFacts({
      providerKind: provider.kind,
      applicationOwnerUserId: provider.applicationOwnerUserId,
      activeOwnerUserId: input.principal.userId,
    });
    const authoritativeName = input.draft.holderRelationship === "PROVIDER_LEGAL_ENTITY" ? names.legalEntityName : names.ownerLegalName;
    if (authoritativeName === null || input.draft.holderLegalName.trim() !== authoritativeName.trim()) throw new Error("PAYOUT_HOLDER_NAME_MISMATCH");

    const ids = { chainId: randomUUID(), claimId: randomUUID(), destinationVersionId: randomUUID() };
    const keyId = this.rings.encryption.activeKeyId;
    let normalized: string;
    let typeId: string;
    let currencyCode: string | null = null;
    let operatorId: string | null = null;
    let bankId: string | null = null;
    let safeMask: string;
    let maskFacts: { callingCode: string | null; ibanCountryPrefix: string | null; lastFour: string; identifierLength: number };
    if (input.draft.type === "MOBILE_WALLET") {
      const registry = await this.registries.resolveWallet({ countryCode: input.draft.countryCode, operatorCode: input.draft.operatorCode });
      normalized = normalizeWalletE164(input.draft.walletNumber, registry.policy.callingCodes);
      const mask = buildWalletMask(normalized, registry.policy.callingCodes);
      typeId = registry.type.id;
      operatorId = registry.operator.id;
      safeMask = mask.mask;
      maskFacts = { callingCode: mask.callingCode, ibanCountryPrefix: null, lastFour: mask.lastFour, identifierLength: normalized.length };
    } else {
      const registry = await this.registries.resolveBank({ countryCode: input.draft.countryCode, currencyCode: input.draft.currencyCode, bankCode: input.draft.bankCode });
      normalized = normalizeIban(input.draft.iban, input.draft.countryCode);
      if (registry.policy.ibanLengths.length > 0 && !registry.policy.ibanLengths.includes(normalized.length)) throw new Error("PAYOUT_IDENTIFIER_INVALID");
      const mask = buildIbanMask(normalized);
      typeId = registry.type.id;
      currencyCode = input.draft.currencyCode;
      bankId = registry.bank.id;
      safeMask = mask.mask;
      maskFacts = { callingCode: null, ibanCountryPrefix: mask.ibanCountryPrefix, lastFour: mask.lastFour, identifierLength: normalized.length };
    }
    const fingerprints = payoutLookupFingerprints(this.rings.lookup, input.draft.type === "MOBILE_WALLET"
      ? { kind: "MOBILE_WALLET", countryCode: input.draft.countryCode, normalizedIdentifier: normalized }
      : { kind: "BANK_ACCOUNT", normalizedIdentifier: normalized });
    const collision = await this.repository.findCollision(fingerprints);
    if (collision !== null) {
      if (collision.claim.providerId === input.providerId) throw new Error("PAYOUT_SUCCESSOR_CONFLICT");
      await this.conflicts.record({
        providerId: input.providerId, commandId: input.draft.commandId, kind: input.draft.type,
        safeMask, incumbentClaimId: collision.claimId, actorUserId: input.principal.userId, requestId: input.requestId,
      });
      throw new Error("PAYOUT_DESTINATION_CONFLICT");
    }
    const aadBase = {
      providerId: input.providerId, destinationChainId: ids.chainId,
      destinationVersionId: ids.destinationVersionId, destinationSequence: 1,
      destinationType: input.draft.type, encryptionKeyId: keyId,
    } as const;
    const identifierEnvelope = this.crypto.encrypt(normalized, { ...aadBase, fieldName: "IDENTIFIER" });
    const holderEnvelope = this.crypto.encrypt(input.draft.holderLegalName.trim(), { ...aadBase, fieldName: "HOLDER_NAME" });
    try {
      const row = await this.repository.createDraft({
        ids, providerId: input.providerId, actorUserId: input.principal.userId, destinationTypeId: typeId,
        kind: input.draft.type, countryId: country.id, countryCode: country.code, currencyCode,
        operatorId, bankId, holderRelationship: input.draft.holderRelationship,
        expectedHolderLegalName: authoritativeName,
        protectedHolderMatches: (candidate) => this.storedHolderMatches(candidate, input.draft.holderLegalName),
        identifierEnvelope, holderEnvelope, maskFacts, fingerprints, commandId: input.draft.commandId,
        requestId: input.requestId,
      });
      return { row, safeMask, holderLegalName: input.draft.holderLegalName.trim() };
    } catch (error) {
      if (error instanceof Error && error.message === "PAYOUT_DESTINATION_CONFLICT") {
        const raced = await this.repository.findCollision(fingerprints);
        if (raced !== null && raced.claim.providerId !== input.providerId) {
          await this.conflicts.record({
            providerId: input.providerId, commandId: input.draft.commandId, kind: input.draft.type,
            safeMask, incumbentClaimId: raced.claimId, actorUserId: input.principal.userId, requestId: input.requestId,
          });
        }
      }
      throw error;
    }
  }

  public async updateDraft(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly destinationVersionId: string;
    readonly expectedVersion: number;
    readonly requestId: string;
    readonly draft: PayoutDraftInput;
  }) {
    const { provider, country } = await this.authorizeOwner(input.principal, input.providerId);
    const current = await this.repository.read(input.providerId, input.destinationVersionId);
    if (
      current === null ||
      current.status !== "DRAFT" ||
      ![input.expectedVersion, input.expectedVersion + 1].includes(current.version)
    ) {
      throw new Error("PAYOUT_DESTINATION_VERSION_CONFLICT");
    }
    if (country.code !== input.draft.countryCode) throw new Error("PAYOUT_REGISTRY_INACTIVE");
    const names = await this.holderReader.readLegalNameFacts({
      providerKind: provider.kind,
      applicationOwnerUserId: provider.applicationOwnerUserId,
      activeOwnerUserId: input.principal.userId,
    });
    const authoritativeName = input.draft.holderRelationship === "PROVIDER_LEGAL_ENTITY" ? names.legalEntityName : names.ownerLegalName;
    if (authoritativeName === null || input.draft.holderLegalName.trim() !== authoritativeName.trim()) throw new Error("PAYOUT_HOLDER_NAME_MISMATCH");
    let normalized: string;
    let typeId: string;
    let currencyCode: string | null = null;
    let operatorId: string | null = null;
    let bankId: string | null = null;
    let safeMask: string;
    let maskFacts: { callingCode: string | null; ibanCountryPrefix: string | null; lastFour: string; identifierLength: number };
    if (input.draft.type === "MOBILE_WALLET") {
      const registry = await this.registries.resolveWallet({ countryCode: input.draft.countryCode, operatorCode: input.draft.operatorCode });
      normalized = normalizeWalletE164(input.draft.walletNumber, registry.policy.callingCodes);
      const mask = buildWalletMask(normalized, registry.policy.callingCodes);
      typeId = registry.type.id;
      operatorId = registry.operator.id;
      safeMask = mask.mask;
      maskFacts = { callingCode: mask.callingCode, ibanCountryPrefix: null, lastFour: mask.lastFour, identifierLength: normalized.length };
    } else {
      const registry = await this.registries.resolveBank({ countryCode: input.draft.countryCode, currencyCode: input.draft.currencyCode, bankCode: input.draft.bankCode });
      normalized = normalizeIban(input.draft.iban, input.draft.countryCode);
      if (registry.policy.ibanLengths.length > 0 && !registry.policy.ibanLengths.includes(normalized.length)) throw new Error("PAYOUT_IDENTIFIER_INVALID");
      const mask = buildIbanMask(normalized);
      typeId = registry.type.id;
      currencyCode = input.draft.currencyCode;
      bankId = registry.bank.id;
      safeMask = mask.mask;
      maskFacts = { callingCode: null, ibanCountryPrefix: mask.ibanCountryPrefix, lastFour: mask.lastFour, identifierLength: normalized.length };
    }
    const fingerprints = payoutLookupFingerprints(this.rings.lookup, input.draft.type === "MOBILE_WALLET"
      ? { kind: "MOBILE_WALLET", countryCode: input.draft.countryCode, normalizedIdentifier: normalized }
      : { kind: "BANK_ACCOUNT", normalizedIdentifier: normalized });
    const keyId = this.rings.encryption.activeKeyId;
    const aadBase = {
      providerId: input.providerId,
      destinationChainId: current.chainId,
      destinationVersionId: current.id,
      destinationSequence: current.sequence,
      destinationType: input.draft.type,
      encryptionKeyId: keyId,
    } as const;
    const identifierEnvelope = this.crypto.encrypt(normalized, { ...aadBase, fieldName: "IDENTIFIER" });
    const holderEnvelope = this.crypto.encrypt(input.draft.holderLegalName.trim(), { ...aadBase, fieldName: "HOLDER_NAME" });
    try {
      const row = await this.repository.updateDraft({
        destinationVersionId: current.id,
        expectedVersion: input.expectedVersion,
        claimId: randomUUID(),
        providerId: input.providerId,
        actorUserId: input.principal.userId,
        destinationTypeId: typeId,
        kind: input.draft.type,
        countryId: country.id,
        countryCode: country.code,
        currencyCode,
        operatorId,
        bankId,
      holderRelationship: input.draft.holderRelationship,
      expectedHolderLegalName: authoritativeName,
      protectedHolderMatches: (candidate) => this.storedHolderMatches(candidate, input.draft.holderLegalName),
      identifierEnvelope,
        holderEnvelope,
        maskFacts,
        fingerprints,
        commandId: input.draft.commandId,
        requestId: input.requestId,
        now: this.now(),
      });
      return { row, safeMask, holderLegalName: input.draft.holderLegalName.trim() };
    } catch (error) {
      if (error instanceof Error && error.message === "PAYOUT_DESTINATION_CONFLICT") {
        const collision = await this.repository.findCollision(fingerprints);
        if (collision !== null && collision.claim.providerId !== input.providerId) {
          await this.conflicts.record({
            providerId: input.providerId,
            commandId: input.draft.commandId,
            kind: input.draft.type,
            safeMask,
            incumbentClaimId: collision.claimId,
            actorUserId: input.principal.userId,
            requestId: input.requestId,
          });
        }
      }
      throw error;
    }
  }

  public async submit(input: {
    readonly principal: AuthenticationPrincipal; readonly providerId: string; readonly destinationVersionId: string;
    readonly expectedVersion: number; readonly reauthenticationProof: string; readonly commandId: string; readonly requestId: string;
  }) {
    await this.authorizeOwner(input.principal, input.providerId);
    const replay = await this.repository.findPayoutSubmitReplay({
      providerId: input.providerId,
      destinationVersionId: input.destinationVersionId,
      expectedVersion: input.expectedVersion,
      actorUserId: input.principal.userId,
      commandId: input.commandId,
      requestId: input.requestId,
    });
    if (replay !== null) return replay;
    const row = await this.repository.read(input.providerId, input.destinationVersionId);
    if (row === null || row.version !== input.expectedVersion) throw new Error("PAYOUT_DESTINATION_VERSION_CONFLICT");
    const proof = await this.proofVerifier.verify({
      principalUserId: input.principal.userId, sessionId: input.principal.sessionId,
      opaqueProof: input.reauthenticationProof,
      purpose: row.predecessorVersionId === null ? "PROVIDER_PAYOUT_SUBMIT" : "PROVIDER_PAYOUT_SUCCESSOR_SUBMIT",
      providerId: input.providerId, destinationVersionId: input.destinationVersionId,
      requestId: input.requestId, maximumAgeSeconds: 600,
    });
    return this.repository.submit({ ...input, actorUserId: input.principal.userId, proofId: proof.proofId, now: this.now() });
  }

  public async createSuccessor(input: {
    readonly principal: AuthenticationPrincipal; readonly providerId: string; readonly predecessorVersionId: string;
    readonly predecessorExpectedVersion: number; readonly requestId: string; readonly draft: PayoutDraftInput;
  }) {
    const { provider, country } = await this.authorizeOwner(input.principal, input.providerId);
    const predecessor = await this.repository.read(input.providerId, input.predecessorVersionId);
    if (predecessor === null || predecessor.version !== input.predecessorExpectedVersion || !["APPROVED", "CHANGES_REQUESTED", "REPLACEMENT_REQUESTED", "REJECTED", "INVALIDATED"].includes(predecessor.status)) {
      throw new Error("PAYOUT_DESTINATION_VERSION_CONFLICT");
    }
    if (input.draft.countryCode !== country.code || input.draft.type !== predecessor.kind) throw new Error("PAYOUT_REGISTRY_INACTIVE");
    const names = await this.holderReader.readLegalNameFacts({
      providerKind: provider.kind,
      applicationOwnerUserId: provider.applicationOwnerUserId,
      activeOwnerUserId: input.principal.userId,
    });
    const authoritativeName = input.draft.holderRelationship === "PROVIDER_LEGAL_ENTITY" ? names.legalEntityName : names.ownerLegalName;
    if (authoritativeName === null || input.draft.holderLegalName.trim() !== authoritativeName.trim()) throw new Error("PAYOUT_HOLDER_NAME_MISMATCH");
    const ids = { chainId: predecessor.chainId, claimId: randomUUID(), destinationVersionId: randomUUID() };
    let normalized: string;
    let currencyCode: string | null = null;
    let operatorId: string | null = null;
    let bankId: string | null = null;
    let safeMask: string;
    let maskFacts: { callingCode: string | null; ibanCountryPrefix: string | null; lastFour: string; identifierLength: number };
    if (input.draft.type === "MOBILE_WALLET") {
      const registry = await this.registries.resolveWallet({ countryCode: input.draft.countryCode, operatorCode: input.draft.operatorCode });
      normalized = normalizeWalletE164(input.draft.walletNumber, registry.policy.callingCodes);
      const mask = buildWalletMask(normalized, registry.policy.callingCodes);
      operatorId = registry.operator.id;
      safeMask = mask.mask;
      maskFacts = { callingCode: mask.callingCode, ibanCountryPrefix: null, lastFour: mask.lastFour, identifierLength: normalized.length };
    } else {
      const registry = await this.registries.resolveBank({ countryCode: input.draft.countryCode, currencyCode: input.draft.currencyCode, bankCode: input.draft.bankCode });
      normalized = normalizeIban(input.draft.iban, input.draft.countryCode);
      if (registry.policy.ibanLengths.length > 0 && !registry.policy.ibanLengths.includes(normalized.length)) throw new Error("PAYOUT_IDENTIFIER_INVALID");
      const mask = buildIbanMask(normalized);
      currencyCode = input.draft.currencyCode;
      bankId = registry.bank.id;
      safeMask = mask.mask;
      maskFacts = { callingCode: null, ibanCountryPrefix: mask.ibanCountryPrefix, lastFour: mask.lastFour, identifierLength: normalized.length };
    }
    const fingerprints = payoutLookupFingerprints(this.rings.lookup, input.draft.type === "MOBILE_WALLET"
      ? { kind: "MOBILE_WALLET", countryCode: input.draft.countryCode, normalizedIdentifier: normalized }
      : { kind: "BANK_ACCOUNT", normalizedIdentifier: normalized });
    const keyId = this.rings.encryption.activeKeyId;
    const aadBase = {
      providerId: input.providerId, destinationChainId: predecessor.chainId,
      destinationVersionId: ids.destinationVersionId, destinationSequence: predecessor.sequence + 1,
      destinationType: input.draft.type, encryptionKeyId: keyId,
    } as const;
    const identifierEnvelope = this.crypto.encrypt(normalized, { ...aadBase, fieldName: "IDENTIFIER" });
    const holderEnvelope = this.crypto.encrypt(input.draft.holderLegalName.trim(), { ...aadBase, fieldName: "HOLDER_NAME" });
    try {
      const row = await this.repository.createSuccessor({
        ids, providerId: input.providerId, actorUserId: input.principal.userId,
        destinationTypeId: predecessor.chain.destinationTypeId,
        kind: input.draft.type, countryId: country.id, countryCode: country.code,
        currencyCode, operatorId, bankId, holderRelationship: input.draft.holderRelationship,
        expectedHolderLegalName: authoritativeName,
        protectedHolderMatches: (candidate) => this.storedHolderMatches(candidate, input.draft.holderLegalName),
        identifierEnvelope, holderEnvelope, maskFacts, fingerprints, commandId: input.draft.commandId,
        requestId: input.requestId,
        predecessorVersionId: predecessor.id, predecessorExpectedVersion: input.predecessorExpectedVersion,
        sequence: predecessor.sequence + 1, reuseChainId: predecessor.chainId,
      });
      return { row, safeMask, holderLegalName: input.draft.holderLegalName.trim() };
    } catch (error) {
      if (error instanceof Error && error.message === "PAYOUT_DESTINATION_CONFLICT") {
        const raced = await this.repository.findCollision(fingerprints);
        if (raced !== null && raced.claim.providerId !== input.providerId) {
          await this.conflicts.record({
            providerId: input.providerId, commandId: input.draft.commandId, kind: input.draft.type,
            safeMask, incumbentClaimId: raced.claimId, actorUserId: input.principal.userId, requestId: input.requestId,
          });
        }
      }
      throw error;
    }
  }
}
