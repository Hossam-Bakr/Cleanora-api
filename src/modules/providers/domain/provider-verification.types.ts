export const PROVIDER_DOCUMENT_STATUSES = [
  "DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "REPLACEMENT_REQUESTED",
  "EXPIRED", "INVALIDATED", "SUPERSEDED",
] as const;
export type ProviderDocumentStatus = (typeof PROVIDER_DOCUMENT_STATUSES)[number];

export const PAYOUT_DESTINATION_STATUSES = [
  "DRAFT", "PENDING_VERIFICATION", "CHANGES_REQUESTED", "APPROVED", "REJECTED",
  "REPLACEMENT_REQUESTED", "INVALIDATED", "SUPERSEDED", "REMOVED",
] as const;
export type PayoutDestinationStatus = (typeof PAYOUT_DESTINATION_STATUSES)[number];
export type PayoutDestinationKind = "MOBILE_WALLET" | "BANK_ACCOUNT";
export type PayoutHolderRelationship = "PROVIDER_LEGAL_ENTITY" | "PROVIDER_OWNER";
export type VerificationBadgeState = "NOT_ELIGIBLE" | "NOT_EARNED" | "EARNED";

export interface PayoutEncryptionKeyRing {
  readonly activeKeyId: string;
  readonly keys: ReadonlyMap<string, Buffer>;
}

export interface PayoutLookupKeyRing {
  readonly activeKeyId: string;
  readonly keys: ReadonlyMap<string, Buffer>;
}

export interface PayoutKeyRings {
  readonly encryption: PayoutEncryptionKeyRing;
  readonly lookup: PayoutLookupKeyRing;
}

export interface PayoutAadContext {
  readonly providerId: string;
  readonly destinationChainId: string;
  readonly destinationVersionId: string;
  readonly destinationSequence: number;
  readonly destinationType: PayoutDestinationKind;
  readonly fieldName: "IDENTIFIER" | "HOLDER_NAME";
  readonly encryptionKeyId: string;
}

export interface EncryptedPayoutField {
  readonly ciphertext: string;
  readonly nonce: string;
  readonly authenticationTag: string;
  readonly encryptionKeyId: string;
}

export interface WalletMaskFacts {
  readonly callingCode: string;
  readonly lastFour: string;
  readonly nationalLength: number;
  readonly mask: string;
}

export interface IbanMaskFacts {
  readonly ibanCountryPrefix: string;
  readonly lastFour: string;
  readonly normalizedLength: number;
  readonly mask: string;
}

export type SafePayoutProjection = {
  readonly destinationVersionId: string;
  readonly chainId: string;
  readonly type: PayoutDestinationKind;
  readonly mask: string;
  readonly status: PayoutDestinationStatus;
  readonly primary: boolean;
  readonly version: number;
};

export interface ProviderVerificationRepositoryPort {
  readonly providerOwnedPersistence: true;
}

export interface ProviderPayoutRepositoryPort {
  readonly providerOwnedPersistence: true;
}
