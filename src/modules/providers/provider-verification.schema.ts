import { z } from "zod";
import { isMeaningfulSafeNote } from "./domain/provider-verification.catalog.js";

const commandId = z.string().uuid();
const expectedVersion = z.number().int().min(1);
const countryCode = z.string().regex(/^[A-Z]{2}$/u);
const hasNoControlCharacters = (value: string): boolean => ![...value].some((character) => {
  const codePoint = character.codePointAt(0) ?? 0;
  return codePoint <= 31 || codePoint === 127;
});
const meaningfulReason = z.string().trim().min(10).max(1000)
  .refine(hasNoControlCharacters)
  .refine(isMeaningfulSafeNote);
const documentPolicyFieldRules = z.object({
  schemaVersion: z.literal(1),
  requiredMetadata: z.tuple([
    z.literal("countryCode"),
    z.literal("documentNumber"),
    z.literal("legalName"),
    z.literal("issuerName"),
    z.literal("issueDate"),
  ]),
  issueDate: z.literal("NOT_FUTURE"),
  expiresAt: z.literal("OPTIONAL_AFTER_ISSUE_DATE"),
  evidence: z.tuple([z.literal("PDF"), z.literal("IMAGE_SET")]),
}).strict();

export const documentVersionParams = z.object({
  providerId: z.string().min(1).max(64),
  documentVersionId: z.string().min(1).max(64),
}).strict();
export const policyVersionParams = z.object({
  policyVersionId: z.string().min(1).max(64),
}).strict();

export const verificationDocumentDraftBody = z.object({
  typeCode: z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/u),
  countryCode,
  documentNumber: z.string().trim().min(1).max(300),
  legalName: z.string().trim().min(2).max(300),
  issuerName: z.string().trim().min(2).max(300),
  issueDate: z.iso.date(),
  expiresAt: z.iso.date().nullable(),
  commandId,
}).strict();

export const verificationDocumentUpdateBody = verificationDocumentDraftBody.omit({ typeCode: true }).extend({ expectedVersion }).strict();
export const versionCommandBody = z.object({ expectedVersion, commandId }).strict();
export const documentEvidenceMutationBody = z.object({ expectedVersion, commandId }).strict();
export const documentEvidenceOrderBody = z.object({
  evidenceIds: z.array(z.string().min(1).max(64)).min(1).max(20),
  expectedVersion,
  commandId,
}).strict();
export const documentEvidenceParams = documentVersionParams.extend({
  evidenceId: z.string().min(1).max(64),
}).strict();
export const documentDecisionBody = z.object({
  outcome: z.enum(["APPROVE", "REJECT", "REQUEST_REPLACEMENT", "INVALIDATE"]),
  reason: meaningfulReason,
  expectedVersion,
  commandId,
}).strict();
export const documentHistoryQuery = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
export const documentPolicyDraftBody = z.object({
  countryCode,
  providerKind: z.literal("REGISTERED_COMPANY"),
  effectiveAt: z.coerce.date(),
  expectedVersion: expectedVersion.optional(),
  commandId,
  items: z.array(z.object({
    documentTypeCode: z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/u),
    isRequired: z.boolean(),
    isActive: z.boolean(),
    position: z.number().int().min(0),
    fieldRules: documentPolicyFieldRules,
  }).strict()).min(1).max(20),
}).strict();
export const documentPolicyPublishBody = z.object({
  expectedVersion,
  reason: meaningfulReason,
  commandId,
}).strict();
export const documentPolicyReplaceBody = documentPolicyDraftBody.omit({
  countryCode: true,
  providerKind: true,
}).extend({ expectedVersion }).strict();
