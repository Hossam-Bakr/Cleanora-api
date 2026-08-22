import { z } from "zod";
import { isMeaningfulSafeNote } from "./domain/provider-verification.catalog.js";

const commandId = z.string().uuid();
const expectedVersion = z.number().int().min(1);
const relationship = z.enum(["PROVIDER_LEGAL_ENTITY", "PROVIDER_OWNER"]);
const countryCode = z.string().regex(/^[A-Z]{2}$/u);
const holderLegalName = z.string().trim().min(2).max(300);
const hasNoControlCharacters = (value: string): boolean => ![...value].some((character) => {
  const codePoint = character.codePointAt(0) ?? 0;
  return codePoint <= 31 || codePoint === 127;
});
const safeReason = z.string().trim().min(10).max(1000)
  .refine(hasNoControlCharacters)
  .refine(isMeaningfulSafeNote);

export const walletDraftBody = z.object({
  type: z.literal("MOBILE_WALLET"),
  countryCode,
  walletNumber: z.string().trim().regex(/^\+[1-9][0-9\s()-]{5,20}$/u),
  operatorCode: z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/u),
  holderLegalName,
  holderRelationship: relationship,
  commandId,
}).strict();

export const bankDraftBody = z.object({
  type: z.literal("BANK_ACCOUNT"),
  countryCode,
  currencyCode: z.string().regex(/^[A-Z]{3}$/u),
  bankCode: z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/u),
  iban: z.string().trim().min(15).max(64),
  holderLegalName,
  holderRelationship: relationship,
  commandId,
}).strict();

export const payoutDraftBody = z.discriminatedUnion("type", [walletDraftBody, bankDraftBody]);
export const payoutUpdateBody = z.discriminatedUnion("type", [
  walletDraftBody.extend({ expectedVersion }),
  bankDraftBody.extend({ expectedVersion }),
]);
export const payoutSubmitBody = z.object({ expectedVersion, reauthenticationProof: z.string().min(16).max(4096), commandId }).strict();
export const payoutSuccessorBody = z.discriminatedUnion("type", [
  walletDraftBody.extend({ expectedVersion }), bankDraftBody.extend({ expectedVersion }),
]);
export const payoutPrimaryBody = z.object({
  destinationVersionId: z.string().min(1).max(64),
  expectedDestinationVersion: expectedVersion,
  expectedPrimaryVersion: z.number().int().min(0),
  reauthenticationProof: z.string().min(16).max(4096),
  commandId,
}).strict();
export const payoutRemoveBody = z.object({
  expectedVersion,
  expectedPrimaryVersion: z.number().int().min(0),
  replacementPrimaryDestinationVersionId: z.string().min(1).max(64).nullable(),
  acknowledgeReadinessLoss: z.boolean(),
  reason: safeReason,
  reauthenticationProof: z.string().min(16).max(4096),
  commandId,
}).strict();
export const payoutRevealBody = z.object({
  expectedVersion,
  purpose: z.literal("MANUAL_PAYOUT_DESTINATION_VERIFICATION"),
  reason: safeReason,
  stepUpProof: z.string().min(16).max(4096),
  commandId,
}).strict();
export const payoutDecisionBody = z.object({
  outcome: z.enum(["APPROVE", "REJECT", "REQUEST_CHANGES", "REQUEST_REPLACEMENT", "INVALIDATE"]),
  verificationMethod: z.enum(["MANUAL_WALLET_TRANSFER_CHECK", "MANUAL_BANK_BENEFICIARY_CHECK"]),
  reasonCode: z.enum(["VERIFIED_MATCH", "HOLDER_NAME_MISMATCH", "IDENTIFIER_MISMATCH", "BENEFICIARY_UNAVAILABLE", "CORRECTION_REQUIRED", "REPLACEMENT_REQUIRED", "DESTINATION_INVALIDATED"]),
  verificationNote: safeReason,
  acceptedRevealAttemptId: z.string().min(1).max(200).nullable(),
  expectedVersion,
  commandId,
}).strict();
export const payoutDestinationParams = z.object({ providerId: z.string().min(1).max(64), destinationVersionId: z.string().min(1).max(64) }).strict();
export const payoutConflictParams = z.object({ providerId: z.string().min(1).max(64), conflictId: z.string().min(1).max(64) }).strict();
export const payoutCursorQuery = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
export const payoutConflictResolutionBody = z.object({
  outcome: z.enum(["CANDIDATE_REJECTED", "RESOLVED_AFTER_RELEASE"]),
  reason: safeReason,
  expectedVersion,
  commandId,
}).strict();
