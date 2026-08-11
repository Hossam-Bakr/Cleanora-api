import { z } from "zod";

/** Strict Provider HTTP schemas for application create/list/get/kind. */

export const providerIdParams = z
  .object({
    providerId: z.string().min(1).max(64),
  })
  .strict();

export const createProviderBody = z
  .object({
    providerKind: z.enum(["INDIVIDUAL_TEAM", "REGISTERED_COMPANY"]),
  })
  .strict();

export const changeProviderKindBody = z
  .object({
    providerKind: z.enum(["INDIVIDUAL_TEAM", "REGISTERED_COMPANY"]),
    expectedVersion: z.number().int().min(1),
  })
  .strict();

export const submitProviderApplicationBody = z
  .object({
    expectedVersion: z.number().int().min(1),
  })
  .strict();

export const listProvidersQuery = z
  .object({
    cursor: z.string().min(1).max(256).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

export const providerHistoryQuery = z
  .object({
    cursor: z.string().min(1).max(256).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

export const replaceProviderProfileBody = z
  .object({
    displayNameAr: z.string().max(200),
    displayNameEn: z.string().max(200).nullable(),
    descriptionAr: z.string().max(4000),
    descriptionEn: z.string().max(4000).nullable(),
    countryCode: z.string().min(2).max(3),
    expectedVersion: z.number().int().min(1),
  })
  .strict();

export const providerContactChannelSchema = z
  .object({
    type: z.enum(["WHATSAPP", "SOCIAL", "WEBSITE", "EXTERNAL_BOOKING"]),
    value: z.string().min(1).max(2048),
  })
  .strict();

export const replaceProviderContactsBody = z
  .object({
    operationalEmail: z.string().email().max(320),
    operationalPhone: z.string().regex(/^\+[1-9][0-9]{7,14}$/u),
    channels: z.array(providerContactChannelSchema).max(20),
    expectedVersion: z.number().int().min(1),
  })
  .strict();

export const providerMediaVersionBody = z
  .object({
    expectedVersion: z.number().int().min(1),
  })
  .strict();

export const providerGalleryOrderBody = z
  .object({
    orderedGalleryItemIds: z.array(z.string().min(1).max(64)).max(20),
    expectedVersion: z.number().int().min(1),
  })
  .strict();

export const providerGalleryItemParams = z
  .object({
    providerId: z.string().min(1).max(64),
    galleryItemId: z.string().min(1).max(64),
  })
  .strict();

export const staffApplicationsQuery = z
  .object({
    status: z
      .enum([
        "DRAFT",
        "PENDING_REVIEW",
        "CHANGES_REQUESTED",
        "APPROVED",
        "REJECTED",
      ])
      .optional(),
    providerKind: z.enum(["INDIVIDUAL_TEAM", "REGISTERED_COMPANY"]).optional(),
    submittedFrom: z.coerce.date().optional(),
    submittedTo: z.coerce.date().optional(),
    cursor: z.string().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

export const approveProviderApplicationBody = z
  .object({
    expectedVersion: z.number().int().min(1),
  })
  .strict();

export const reasonedProviderVersionBody = z
  .object({
    reason: z.string().min(1).max(2000),
    expectedVersion: z.number().int().min(1),
  })
  .strict();

export const invitationIdParams = z
  .object({
    providerId: z.string().min(1).max(64),
    invitationId: z.string().min(1).max(64),
  })
  .strict();

export const memberUserIdParams = z
  .object({
    providerId: z.string().min(1).max(64),
    userId: z.string().min(1).max(64),
  })
  .strict();

export const listInvitationsQuery = z
  .object({
    cursor: z.string().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    status: z
      .enum(["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"])
      .optional(),
  })
  .strict();

export const createInvitationBody = z
  .object({
    email: z.string().email().max(320),
    expectedVersion: z.number().int().min(1),
  })
  .strict();

export const invitationVersionBody = z
  .object({
    expectedVersion: z.number().int().min(1),
  })
  .strict();

export const invitationTokenBody = z
  .object({
    token: z.string().min(32).max(512),
  })
  .strict();

export const invitationOnboardingStartBody = z
  .object({
    token: z.string().min(32).max(512),
    phone: z.string().regex(/^\+[1-9][0-9]{7,14}$/u),
    password: z.string().min(8).max(128),
  })
  .strict();

export const invitationVerifyEmailBody = z
  .object({
    token: z.string().min(32).max(512),
    challengeId: z.string().min(1).max(64),
    code: z.string().min(4).max(12),
  })
  .strict();

export type CreateProviderBody = z.infer<typeof createProviderBody>;
export type ChangeProviderKindBody = z.infer<typeof changeProviderKindBody>;
export type SubmitProviderApplicationBody = z.infer<
  typeof submitProviderApplicationBody
>;
export type ListProvidersQuery = z.infer<typeof listProvidersQuery>;
export type ReplaceProviderProfileBody = z.infer<typeof replaceProviderProfileBody>;
export type ReplaceProviderContactsBody = z.infer<
  typeof replaceProviderContactsBody
>;
export type ProviderMediaVersionBody = z.infer<typeof providerMediaVersionBody>;
export type ProviderGalleryOrderBody = z.infer<typeof providerGalleryOrderBody>;
export type StaffApplicationsQuery = z.infer<typeof staffApplicationsQuery>;
export type ApproveProviderApplicationBody = z.infer<
  typeof approveProviderApplicationBody
>;
export type ReasonedProviderVersionBody = z.infer<
  typeof reasonedProviderVersionBody
>;
export type CreateInvitationBody = z.infer<typeof createInvitationBody>;
export type InvitationOnboardingStartBody = z.infer<
  typeof invitationOnboardingStartBody
>;
export type InvitationVerifyEmailBody = z.infer<typeof invitationVerifyEmailBody>;
