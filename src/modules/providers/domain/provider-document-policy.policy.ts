import { isMeaningfulSafeNote } from "./provider-verification.catalog.js";

export interface DocumentPolicyItemInput {
  readonly documentTypeCode: string;
  readonly isRequired: boolean;
  readonly isActive: boolean;
  readonly position: number;
  readonly fieldRules: Readonly<Record<string, unknown>>;
}

export const R1_DOCUMENT_REQUIRED_METADATA = [
  "countryCode",
  "documentNumber",
  "legalName",
  "issuerName",
  "issueDate",
] as const;

export const R1_DOCUMENT_FIELD_RULES = {
  schemaVersion: 1,
  requiredMetadata: R1_DOCUMENT_REQUIRED_METADATA,
  issueDate: "NOT_FUTURE",
  expiresAt: "OPTIONAL_AFTER_ISSUE_DATE",
  evidence: ["PDF", "IMAGE_SET"],
} as const;

export function assertDocumentPolicyFieldRules(value: Readonly<Record<string, unknown>>): void {
  const keys = Object.keys(value).sort();
  const expectedKeys = ["evidence", "expiresAt", "issueDate", "requiredMetadata", "schemaVersion"].sort();
  const requiredMetadata = value["requiredMetadata"];
  const evidence = value["evidence"];
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index]) ||
    value["schemaVersion"] !== 1 ||
    value["issueDate"] !== "NOT_FUTURE" ||
    value["expiresAt"] !== "OPTIONAL_AFTER_ISSUE_DATE" ||
    !Array.isArray(requiredMetadata) ||
    requiredMetadata.length !== R1_DOCUMENT_REQUIRED_METADATA.length ||
    requiredMetadata.some((field, index) => field !== R1_DOCUMENT_REQUIRED_METADATA[index]) ||
    !Array.isArray(evidence) ||
    evidence.length !== R1_DOCUMENT_FIELD_RULES.evidence.length ||
    evidence.some((format, index) => format !== R1_DOCUMENT_FIELD_RULES.evidence[index])
  ) throw new Error("POLICY_FIELD_RULES_INVALID");
}

export function assertDocumentPolicyItems(items: readonly DocumentPolicyItemInput[]): void {
  if (items.length === 0) throw new Error("VERIFICATION_POLICY_NOT_FOUND");
  const codes = new Set<string>();
  const positions = new Set<number>();
  for (const item of items) {
    if (!/^[A-Z][A-Z0-9_]{2,99}$/u.test(item.documentTypeCode) || item.position < 0) {
      throw new Error("VERIFICATION_POLICY_NOT_FOUND");
    }
    if (codes.has(item.documentTypeCode) || positions.has(item.position)) {
      throw new Error("POLICY_VERSION_CONFLICT");
    }
    assertDocumentPolicyFieldRules(item.fieldRules);
    codes.add(item.documentTypeCode);
    positions.add(item.position);
  }
}

export function assertDocumentPolicyDraft(input: {
  readonly countryCode: string;
  readonly providerKind: "REGISTERED_COMPANY";
  readonly effectiveAt: Date;
  readonly items: readonly DocumentPolicyItemInput[];
}): void {
  if (!/^[A-Z]{2}$/u.test(input.countryCode) || Number.isNaN(input.effectiveAt.getTime())) {
    throw new Error("VERIFICATION_POLICY_NOT_FOUND");
  }
  assertDocumentPolicyItems(input.items);
}

export function assertCanPublishDocumentPolicy(input: {
  readonly status: "DRAFT" | "PUBLISHED";
  readonly reason: string;
  readonly effectiveAt: Date | null;
}): void {
  if (input.status !== "DRAFT") throw new Error("POLICY_IMMUTABLE");
  if (input.effectiveAt === null || !isMeaningfulSafeNote(input.reason)) {
    throw new Error("VALIDATION_ERROR");
  }
}

export function selectCurrentEffectivePolicy<T extends {
  readonly status: "DRAFT" | "PUBLISHED";
  readonly effectiveAt: Date | null;
  readonly policyVersion: number;
}>(rows: readonly T[], now: Date): T | null {
  return rows
    .filter((row) => row.status === "PUBLISHED" && row.effectiveAt !== null && row.effectiveAt <= now)
    .sort((left, right) => right.policyVersion - left.policyVersion)[0] ?? null;
}
