import { z } from "zod";

import {
  PROVIDER_ADMIN_GRANT_REASONS,
  PROVIDER_ADMIN_REVOCATION_REASONS,
  WORKER_ACCESS_REVOCATION_REASONS,
  WORKER_DEACTIVATION_REASONS,
  WORKER_REMOVAL_REASONS,
} from "./domain/provider-workforce.policy.js";

export const workforceProviderParamsSchema = z.object({ providerId: z.string().min(1) });
export const workforceWorkerParamsSchema = workforceProviderParamsSchema.extend({ workerId: z.string().min(1) });
export const workforceTeamParamsSchema = workforceProviderParamsSchema.extend({ teamId: z.string().min(1) });

const workforceCommandMetaFields = {
  expectedVersion: z.number().int().positive(),
  idempotencyKey: z.string().uuid(),
} as const;

export const workforceCommandMetaSchema = z.object(workforceCommandMetaFields).strict();

const workerSkillTagsSchema = z.array(z.string().trim().min(1).max(100)).max(50);

export const workerProfileSchema = z.object({
  fullLegalName: z.string().trim().min(1).max(200),
  gender: z.enum(["male", "female"]),
  operationalPhoneE164: z.string().regex(/^\+[1-9][0-9]{7,14}$/u),
  workerType: z.enum(["CLEANING_STAFF", "ESCORT", "OTHER"]),
  displayTitle: z.string().trim().min(1).max(120).nullable().default(null),
  supervisorCapable: z.boolean().default(false),
  skillTags: workerSkillTagsSchema.default([]),
}).strict();

export const createWorkerSchema = workerProfileSchema.extend({
  expectedVersion: z.number().int().positive(),
  idempotencyKey: z.string().uuid(),
}).strict();

export const replaceWorkerProfileSchema = createWorkerSchema.extend({
  supervisorCapable: z.boolean(),
  skillTags: workerSkillTagsSchema,
}).strict();
export const workerAvatarCommandSchema = workforceCommandMetaSchema;
export const workforceVersionCommandSchema = workforceCommandMetaSchema;
export const workerLeaveCommandSchema = workforceCommandMetaSchema.extend({
  expectedTeamVersion: z.number().int().positive().nullable().optional(),
  expectedMembershipVersion: z.number().int().positive().nullable().optional(),
  confirmTeamImpact: z.boolean().default(false),
  confirmReadinessImpact: z.boolean().default(false),
}).strict();

const meaningfulNote = z.string().trim().min(10).max(1000);
const optionalNote = z.string().trim().min(1).max(1000).nullable().optional();

export const workerLifecycleCommandSchema = z.discriminatedUnion("action", [
  z.object({ ...workforceCommandMetaFields, action: z.literal("ACTIVATE") }).strict(),
  z.object({ ...workforceCommandMetaFields, action: z.literal("REACTIVATE") }).strict(),
  z.object({
    ...workforceCommandMetaFields,
    action: z.literal("DEACTIVATE"),
    reasonCode: z.enum(WORKER_DEACTIVATION_REASONS),
    note: optionalNote,
    confirmTeamImpact: z.boolean().default(false),
    confirmReadinessImpact: z.boolean().default(false),
    expectedTeamVersion: z.number().int().positive().nullable().optional(),
    expectedMembershipVersion: z.number().int().positive().nullable().optional(),
  }).strict().superRefine((value, context) => {
    if (value.reasonCode === "OTHER" && (value.note?.trim().length ?? 0) < 10) {
      context.addIssue({ code: "custom", message: "OTHER requires a meaningful note", path: ["note"] });
    }
  }),
  z.object({
    ...workforceCommandMetaFields,
    action: z.literal("REMOVE"),
    reasonCode: z.enum(WORKER_REMOVAL_REASONS),
    note: meaningfulNote,
    recentAuthenticationProof: z.string().min(1),
    confirmTeamImpact: z.boolean().default(false),
    confirmReadinessImpact: z.boolean().default(false),
    expectedTeamVersion: z.number().int().positive().nullable().optional(),
    expectedMembershipVersion: z.number().int().positive().nullable().optional(),
  }).strict(),
]);

export const workerLoginAccessCommandSchema = z.discriminatedUnion("action", [
  z.object({ ...workforceCommandMetaFields, action: z.enum(["ISSUE_INVITATION", "RESEND_INVITATION"]), locale: z.enum(["AR", "EN"]), email: z.string().email().max(320), recentAuthenticationProof: z.string().min(1), expectedAccessVersion: z.number().int().positive().nullable() }).strict(),
  z.object({ ...workforceCommandMetaFields, action: z.literal("RESET_ACCESS"), locale: z.enum(["AR", "EN"]), email: z.string().email().max(320), recentAuthenticationProof: z.string().min(1), expectedAccessVersion: z.number().int().positive() }).strict(),
  z.object({ ...workforceCommandMetaFields, action: z.literal("REVOKE_ACCESS"), reasonCode: z.enum(WORKER_ACCESS_REVOCATION_REASONS), note: optionalNote, recentAuthenticationProof: z.string().min(1), expectedAccessVersion: z.number().int().positive() }).strict().superRefine((value, context) => {
    if (value.reasonCode === "OTHER" && (value.note?.trim().length ?? 0) < 10) context.addIssue({ code: "custom", message: "OTHER requires a meaningful note", path: ["note"] });
  }),
]);

export const workerAdminMembershipCommandSchema = z.discriminatedUnion("action", [
  z.object({ ...workforceCommandMetaFields, action: z.literal("GRANT"), reasonCode: z.enum(PROVIDER_ADMIN_GRANT_REASONS), note: optionalNote, recentAuthenticationProof: z.string().min(1), expectedMembershipVersion: z.number().int().positive().nullable() }).strict(),
  z.object({ ...workforceCommandMetaFields, action: z.literal("REVOKE"), reasonCode: z.enum(PROVIDER_ADMIN_REVOCATION_REASONS), note: optionalNote, recentAuthenticationProof: z.string().min(1), expectedMembershipVersion: z.number().int().positive() }).strict(),
]).superRefine((value, context) => {
  if (value.reasonCode === "OTHER" && (value.note?.trim().length ?? 0) < 10) context.addIssue({ code: "custom", message: "OTHER requires a meaningful note", path: ["note"] });
});

export const teamDraftSchema = workforceCommandMetaSchema.omit({ expectedVersion: true }).extend({
  expectedVersion: z.number().int().positive(),
  name: z.string().trim().min(1).max(160).nullable().default(null),
});

export const replaceTeamNameSchema = workforceCommandMetaSchema.extend({
  name: z.string().trim().min(1).max(160),
}).strict();

export const teamLifecycleCommandSchema = workforceCommandMetaSchema.extend({
  action: z.enum(["ACTIVATE", "DEACTIVATE", "REACTIVATE", "ARCHIVE"]),
});

export const teamMembershipCommandSchema = z.discriminatedUnion("action", [
  z.object({ ...workforceCommandMetaFields, action: z.literal("ADD"), workerId: z.string().min(1), cleans: z.boolean(), expectedWorkerVersion: z.number().int().positive(), expectedMembershipVersion: z.null().optional(), expectedTargetTeamVersion: z.null().optional(), confirmLastCleanerImpact: z.boolean().default(false) }).strict(),
  z.object({ ...workforceCommandMetaFields, action: z.literal("UPDATE_CLEANS"), workerId: z.string().min(1), membershipId: z.string().min(1), cleans: z.boolean(), expectedWorkerVersion: z.number().int().positive(), expectedMembershipVersion: z.number().int().positive(), expectedTargetTeamVersion: z.null().optional(), confirmLastCleanerImpact: z.boolean().default(false) }).strict(),
  z.object({ ...workforceCommandMetaFields, action: z.literal("REMOVE"), workerId: z.string().min(1), membershipId: z.string().min(1), expectedWorkerVersion: z.number().int().positive(), expectedMembershipVersion: z.number().int().positive(), expectedTargetTeamVersion: z.null().optional(), confirmLastCleanerImpact: z.boolean().default(false) }).strict(),
  z.object({ ...workforceCommandMetaFields, action: z.literal("MOVE"), workerId: z.string().min(1), membershipId: z.string().min(1), targetTeamId: z.string().min(1), expectedWorkerVersion: z.number().int().positive(), expectedMembershipVersion: z.number().int().positive(), expectedTargetTeamVersion: z.number().int().positive(), cleans: z.boolean(), confirmLastCleanerImpact: z.boolean().default(false) }).strict(),
]);

export const teamSupervisorCommandSchema = z.discriminatedUnion("action", [
  z.object({ ...workforceCommandMetaFields, action: z.literal("ASSIGN"), workerId: z.string().min(1), expectedWorkerVersion: z.number().int().positive(), expectedMembershipVersion: z.number().int().positive() }).strict(),
  z.object({ ...workforceCommandMetaFields, action: z.literal("CLEAR"), expectedWorkerVersion: z.number().int().positive().nullable().optional(), expectedMembershipVersion: z.number().int().positive().nullable().optional() }).strict(),
]);

export const invitationProofSchema = z.object({ invitationProof: z.string().min(1).max(2000) }).strict();

export const invitationOnboardingStartSchema = workforceCommandMetaSchema.extend({
  invitationProof: z.string().min(1).max(2000),
  password: z.string().min(1),
}).strict();

export const invitationEmailVerificationSchema = workforceCommandMetaSchema.extend({
  invitationProof: z.string().min(1).max(2000),
  challengeId: z.string().min(1),
  code: z.string().min(1),
}).strict();

export const invitationAcceptSchema = workforceCommandMetaSchema.extend({
  invitationProof: z.string().min(1).max(2000),
  expectedWorkerVersion: z.number().int().positive(),
  expectedAccessVersion: z.number().int().positive(),
  operationalPhoneE164: z.string().regex(/^\+[1-9][0-9]{7,14}$/u),
}).strict();

export const workforceCursorQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
