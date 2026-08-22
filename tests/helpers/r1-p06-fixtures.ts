/** Synthetic-only R1-P06 fixtures. Never use these values as runtime secrets. */
export const R1_P06_SENTINELS = {
  wallet: "+201012345678",
  iban: "EG42001900050000000026318002",
  holderName: "R1P06 Synthetic Holder Sentinel",
  documentNumber: "R1P06-SYNTHETIC-DOC-0001",
  encryptionKey: Buffer.alloc(32, 0x11).toString("base64"),
  lookupKey: Buffer.alloc(32, 0x22).toString("base64"),
} as const;

export const R1_P06_IDS = {
  providerId: "provider-r1p06-synthetic",
  ownerUserId: "owner-r1p06-synthetic",
  adminUserId: "admin-r1p06-synthetic",
  staffUserId: "staff-r1p06-synthetic",
  sessionId: "session-r1p06-synthetic",
  chainId: "payout-chain-r1p06-synthetic",
  destinationVersionId: "payout-version-r1p06-synthetic",
  documentChainId: "document-chain-r1p06-synthetic",
  documentVersionId: "document-version-r1p06-synthetic",
  commandId: "00000000-0000-4000-8000-000000000006",
  requestId: "request-r1p06-synthetic",
} as const;

export function buildWalletDraft(
  overrides: Partial<{
    countryCode: string;
    walletNumber: string;
    operatorCode: string;
    holderLegalName: string;
    holderRelationship: "PROVIDER_LEGAL_ENTITY" | "PROVIDER_OWNER";
    commandId: string;
  }> = {},
) {
  return {
    type: "MOBILE_WALLET" as const,
    countryCode: "EG",
    walletNumber: R1_P06_SENTINELS.wallet,
    operatorCode: "TEST_OPERATOR",
    holderLegalName: R1_P06_SENTINELS.holderName,
    holderRelationship: "PROVIDER_OWNER" as const,
    commandId: R1_P06_IDS.commandId,
    ...overrides,
  };
}

export function buildBankDraft(
  overrides: Partial<{
    countryCode: string;
    currencyCode: string;
    bankCode: string;
    iban: string;
    holderLegalName: string;
    holderRelationship: "PROVIDER_LEGAL_ENTITY" | "PROVIDER_OWNER";
    commandId: string;
  }> = {},
) {
  return {
    type: "BANK_ACCOUNT" as const,
    countryCode: "EG",
    currencyCode: "EGP",
    bankCode: "TEST_BANK",
    iban: R1_P06_SENTINELS.iban,
    holderLegalName: R1_P06_SENTINELS.holderName,
    holderRelationship: "PROVIDER_LEGAL_ENTITY" as const,
    commandId: "00000000-0000-4000-8000-000000000007",
    ...overrides,
  };
}

export function buildDocumentDraft(
  overrides: Partial<{
    typeCode: string;
    countryCode: string;
    documentNumber: string;
    legalName: string;
    issuerName: string;
    issueDate: string;
    expiresAt: string | null;
    commandId: string;
  }> = {},
) {
  return {
    typeCode: "COMMERCIAL_REGISTRATION",
    countryCode: "EG",
    documentNumber: R1_P06_SENTINELS.documentNumber,
    legalName: "R1P06 Synthetic Company",
    issuerName: "R1P06 Synthetic Authority",
    issueDate: "2026-01-01",
    expiresAt: null,
    commandId: "00000000-0000-4000-8000-000000000008",
    ...overrides,
  };
}
