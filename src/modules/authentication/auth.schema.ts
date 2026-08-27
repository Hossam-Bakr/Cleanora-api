import { z } from "zod";
import {
  isPasswordPolicySatisfied,
  isPhoneFormatValid,
} from "./domain/auth.policy.js";

export const categorySchema = z.enum([
  "INDIVIDUAL",
  "COMPANY",
  "ENGINEER",
  "PROVIDER_OWNER",
  "WORKER",
]);

/** Public self-signup / ordinary enrollment only — excludes PROVIDER_OWNER. */
export const selfSignupCategorySchema = z.enum([
  "INDIVIDUAL",
  "COMPANY",
  "ENGINEER",
]);

const requiredPhoneSchema = z
  .string()
  .min(1, "Phone number is required")
  .refine((phone) => phone.length === 0 || isPhoneFormatValid(phone), {
    message: "Enter a valid international phone number, for example +201012345678",
  });
const requiredEmailSchema = z
  .string()
  .trim()
  .pipe(z.email("Enter a valid email address"));
const passwordSchema = z
  .string()
  .min(7, "Password must contain at least 7 characters")
  .max(128, "Password must not exceed 128 characters")
  .superRefine((password, context) => {
    if (
      password.length >= 7 &&
      password.length <= 128 &&
      !isPasswordPolicySatisfied(password)
    ) {
      context.addIssue({
        code: "custom",
        message: "Password must not be common, repeated, or sequential",
      });
    }
  });

const requiredProfileText = z
  .string()
  .trim()
  .min(1, "This field is required")
  .max(200, "This field is too long");

const signupIdentityFields = {
  phone: requiredPhoneSchema,
  email: requiredEmailSchema,
  password: passwordSchema,
} as const;

export const signupSchema = z.object({
  body: z.discriminatedUnion("accountCategory", [
    z.object({
      accountCategory: z.literal("INDIVIDUAL"),
      ...signupIdentityFields,
      fullName: requiredProfileText,
    }).strict(),
    z.object({
      accountCategory: z.literal("COMPANY"),
      ...signupIdentityFields,
      companyName: requiredProfileText,
      representativeFullName: requiredProfileText,
    }).strict(),
    z.object({
      accountCategory: z.literal("ENGINEER"),
      ...signupIdentityFields,
      fullName: requiredProfileText,
      professionalTitle: requiredProfileText,
    }).strict(),
  ]),
});

export const enrollSchema = z.object({
  body: z.discriminatedUnion("accountCategory", [
    z.object({
      accountCategory: z.literal("INDIVIDUAL"),
      fullName: requiredProfileText,
    }).strict(),
    z.object({
      accountCategory: z.literal("COMPANY"),
      companyName: requiredProfileText,
      representativeFullName: requiredProfileText,
    }).strict(),
    z.object({
      accountCategory: z.literal("ENGINEER"),
      fullName: requiredProfileText,
      professionalTitle: requiredProfileText,
    }).strict(),
  ]),
});

export const otpRequestSchema = z.object({
  body: z
    .object({
      challengeId: z.string().min(1, "Challenge ID is required").optional(),
      userId: z.string().min(1, "User ID is required").optional(),
      accountCategory: selfSignupCategorySchema.optional(),
      purpose: z
        .literal("CATEGORY_VERIFICATION")
        .optional(),
    })
    .strict()
    .superRefine((value, context) => {
      if (value.challengeId !== undefined) {
        return;
      }
      if (
        value.userId !== undefined &&
        value.accountCategory !== undefined
      ) {
        return;
      }
      context.addIssue({
        code: "custom",
        message: "Provide challengeId, or userId with accountCategory",
        path: ["challengeId"],
      });
    }),
});

export const otpVerifySchema = z.object({
  body: z
    .object({
      challengeId: z.string().min(1, "Challenge ID is required"),
      code: z
        .string()
        .regex(/^\d{6}$/, "Verification code must contain exactly 6 digits"),
    })
    .strict(),
});

export const loginSchema = z.object({
  body: z
    .object({
      phone: requiredPhoneSchema,
      password: z.string().min(1, "Password is required"),
    })
    .strict(),
});

export const forgotSchema = z.object({
  body: z
    .object({
      accountCategory: categorySchema,
      identifier: requiredEmailSchema,
    })
    .strict(),
});

export const resetSchema = z.object({
  body: z
    .object({
      challengeId: z.uuid("Password reset challenge ID is invalid"),
      code: z
        .string()
        .regex(/^\d{4}$/u, "Password reset code must contain exactly 4 digits"),
      newPassword: passwordSchema,
    })
    .strict(),
});

export const changeSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().min(1, "Current password is required"),
      newPassword: passwordSchema,
    })
    .strict(),
});

export const sensitiveActionProofSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1).max(128),
    purpose: z.enum([
      "PROVIDER_PAYOUT_SUBMIT",
      "PROVIDER_PAYOUT_SUCCESSOR_SUBMIT",
      "PROVIDER_PAYOUT_PRIMARY_CHANGE",
      "PROVIDER_PAYOUT_WITHDRAW",
      "PROVIDER_PAYOUT_REMOVE",
      "STAFF_PAYOUT_REVEAL",
      "WORKER_ACCESS_ISSUE",
      "WORKER_ACCESS_RESET",
      "WORKER_ACCESS_REVOKE",
      "WORKER_REMOVE",
      "PROVIDER_ADMIN_GRANT",
      "PROVIDER_ADMIN_REVOKE",
    ]),
    providerId: z.string().min(1).max(64),
    destinationVersionId: z.string().min(1).max(64),
    requestId: z.string().uuid(),
  }).strict(),
});
