import type { DocumentVerificationTruth } from "./domain/provider-verification.policy.js";
import type { ProviderDocumentStatus, VerificationBadgeState } from "./domain/provider-verification.types.js";

export interface VerificationOverviewDto {
  readonly providerId: string;
  readonly providerKind: "INDIVIDUAL_TEAM" | "REGISTERED_COMPANY";
  readonly applicationStatus: string;
  readonly operationalStatus: string;
  readonly documentsVerified: Omit<DocumentVerificationTruth, "badge">;
  readonly payoutDestinationReady: boolean;
  readonly badgeTruth: VerificationBadgeState;
  readonly safeBlockerCodes: readonly string[];
  readonly capabilities: readonly string[];
}

export interface ProviderDocumentSummaryDto {
  readonly documentVersionId: string;
  readonly chainId: string;
  readonly typeCode: string;
  readonly sequence: number;
  readonly status: ProviderDocumentStatus;
  readonly countryCode: string;
  readonly issueDate: string;
  readonly expiresAt: string | null;
  readonly evidenceFormat: "PDF" | "IMAGE_SET" | null;
  readonly evidenceCount: number;
  readonly effective: boolean;
  readonly predecessorVersionId: string | null;
  readonly version: number;
  readonly createdAt: string;
  readonly submittedAt: string | null;
  readonly safeNextActions: readonly string[];
}

export function mapVerificationOverview(input: {
  readonly providerId: string;
  readonly providerKind: "INDIVIDUAL_TEAM" | "REGISTERED_COMPANY";
  readonly applicationStatus: string;
  readonly operationalStatus: string;
  readonly truth: DocumentVerificationTruth;
  readonly payoutDestinationReady: boolean;
  readonly capabilities: readonly string[];
}): VerificationOverviewDto {
  const { badge, ...documentsVerified } = input.truth;
  return {
    providerId: input.providerId,
    providerKind: input.providerKind,
    applicationStatus: input.applicationStatus,
    operationalStatus: input.operationalStatus,
    documentsVerified,
    payoutDestinationReady: input.payoutDestinationReady,
    badgeTruth: badge,
    safeBlockerCodes: [...documentsVerified.blockerCodes],
    capabilities: [...input.capabilities],
  };
}

export function safeDocumentHistoryEvent<T extends Readonly<Record<string, unknown>>>(event: T): T {
  const forbidden = new Set(["documentNumber", "legalName", "issuerName", "storageKey", "url", "metadata"]);
  for (const key of Object.keys(event)) if (forbidden.has(key)) throw new Error("DOCUMENT_EVIDENCE_UNSAFE");
  return event;
}
