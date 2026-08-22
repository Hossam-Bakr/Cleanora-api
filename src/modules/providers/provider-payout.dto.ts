import type { PayoutDestinationKind, PayoutDestinationStatus } from "./domain/provider-verification.types.js";

export interface PayoutSafeRow {
  readonly destinationVersionId: string;
  readonly chainId: string;
  readonly type: PayoutDestinationKind;
  readonly mask: string;
  readonly institution: { readonly code: string; readonly label: string } | null;
  readonly holderRelationship: "PROVIDER_LEGAL_ENTITY" | "PROVIDER_OWNER";
  readonly status: PayoutDestinationStatus;
  readonly primary: boolean;
  readonly sequence: number;
  readonly version: number;
  readonly createdAt: string;
  readonly submittedAt: string | null;
  readonly decidedAt: string | null;
}

export function mapPayoutOwnerView(input: PayoutSafeRow & { readonly holderLegalName: string }): PayoutSafeRow & { readonly holderLegalName: string } {
  return { ...input };
}

export function mapPayoutAdminView(input: PayoutSafeRow): Omit<PayoutSafeRow, "institution" | "holderRelationship"> {
  const { institution: _institution, holderRelationship: _holderRelationship, ...safe } = input;
  return safe;
}

export function mapPayoutStaffSafeDossier(input: PayoutSafeRow & {
  readonly comparisonSourceAvailable: boolean;
  readonly acceptedRevealRequired: true;
}) {
  return { ...input, holderName: undefined, fullIdentifier: undefined };
}

const forbiddenPayoutHistoryKeys = new Set([
  "holderLegalName", "walletNumber", "iban", "identifier", "ciphertext", "nonce",
  "authenticationTag", "fingerprint", "stepUpProof", "reauthenticationProof", "encryptionKey",
  "reasonText",
]);

export function safePayoutHistoryEvent<T extends Readonly<Record<string, unknown>>>(event: T): T {
  for (const key of Object.keys(event)) if (forbiddenPayoutHistoryKeys.has(key)) throw new Error("PAYOUT_PROTECTED_VALUE_UNAVAILABLE");
  return event;
}
