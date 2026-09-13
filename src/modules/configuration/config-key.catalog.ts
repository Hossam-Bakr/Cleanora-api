import { z } from "zod";

import { isRecognizedIanaTimeZone } from "./time-zone.js";

export type ConfigResolutionPolicy =
  | "GLOBAL_ONLY"
  | "COUNTRY_OVERRIDE_WITH_GLOBAL_FALLBACK"
  | "COUNTRY_REQUIRED";

export interface ConfigKeyDefinition {
  readonly valueSchema: z.ZodType<unknown>;
  readonly valueKind: "STRING" | "NUMBER" | "BOOLEAN" | "OBJECT" | "ARRAY";
  readonly resolutionPolicy: ConfigResolutionPolicy;
}

const displayNameSchema = z
  .object({
    en: z.string().min(1),
    ar: z.string().min(1),
  })
  .strict();

export const CONFIG_KEY_CATALOG = {
  "auth.signin_policy": {
    valueSchema: z
      .object({
        maxFailures: z.number().int().positive(),
        windowSeconds: z.number().int().positive(),
        lockSeconds: z.number().int().positive(),
      })
      .strict(),
    valueKind: "OBJECT",
    resolutionPolicy: "GLOBAL_ONLY",
  },
  "auth.verification_policy": {
    valueSchema: z
      .object({
        ttlSeconds: z.number().int().positive(),
        maxAttempts: z.number().int().positive(),
        resendSeconds: z.number().int().positive(),
      })
      .strict(),
    valueKind: "OBJECT",
    resolutionPolicy: "COUNTRY_OVERRIDE_WITH_GLOBAL_FALLBACK",
  },
  "auth.recovery_policy": {
    valueSchema: z
      .object({
        ttlSeconds: z.number().int().positive(),
        maxAttempts: z.number().int().positive(),
      })
      .strict(),
    valueKind: "OBJECT",
    resolutionPolicy: "COUNTRY_OVERRIDE_WITH_GLOBAL_FALLBACK",
  },
  "auth.endpoint_limits": {
    valueSchema: z
      .object({
        signupPer15Minutes: z.number().int().positive(),
        loginPer15Minutes: z.number().int().positive(),
      })
      .strict(),
    valueKind: "OBJECT",
    resolutionPolicy: "GLOBAL_ONLY",
  },
  /**
   * R1-P10 (DEC-053): evolved from GLOBAL_ONLY to COUNTRY_REQUIRED. Staff
   * administer one IANA time zone per country; Egypt is `Africa/Cairo`. This
   * remains the single time-zone source — no second Configuration key exists.
   */
  "platform.default_timezone": {
    valueSchema: z
      .string()
      .min(1)
      .max(64)
      .regex(
        /^[A-Za-z][A-Za-z_]*(?:\/[A-Za-z][A-Za-z0-9_+-]*){1,2}$/u,
        "must be a valid IANA time zone identifier (e.g. Africa/Cairo)",
      )
      .refine(isRecognizedIanaTimeZone, "must be a recognized IANA time zone"),
    valueKind: "STRING",
    resolutionPolicy: "COUNTRY_REQUIRED",
  },
  "country.display_name": {
    valueSchema: displayNameSchema,
    valueKind: "OBJECT",
    resolutionPolicy: "COUNTRY_REQUIRED",
  },
  "country.supported_locales": {
    valueSchema: z.array(z.string().min(1)).min(1),
    valueKind: "ARRAY",
    resolutionPolicy: "COUNTRY_OVERRIDE_WITH_GLOBAL_FALLBACK",
  },
  "country.currency_code": {
    valueSchema: z.string().regex(/^[A-Z]{3}$/u),
    valueKind: "STRING",
    resolutionPolicy: "COUNTRY_REQUIRED",
  },
  "commercial.deposit_percent": {
    valueSchema: z
      .number()
      .gte(0)
      .lte(100)
      .refine(
        (value) => Number.isFinite(value),
        "deposit percent must be a finite number",
      ),
    valueKind: "NUMBER",
    resolutionPolicy: "COUNTRY_REQUIRED",
  },
  "commercial.provider_response_hours": {
    valueSchema: z
      .number()
      .int()
      .gte(1)
      .lte(168)
      .refine(
        (value) => Number.isFinite(value),
        "provider response hours must be a finite integer",
      ),
    valueKind: "NUMBER",
    resolutionPolicy: "COUNTRY_REQUIRED",
  },
  "providers.service_pricing_policy": {
    valueSchema: z
      .object({
        approvalRequired: z.boolean(),
        maximumPrice: z
          .string()
          .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/u)
          .refine(
            (value) => !/^0(?:\.0+)?$/u.test(value),
            "maximumPrice must be a positive canonical decimal string",
          ),
      })
      .strict(),
    valueKind: "OBJECT",
    resolutionPolicy: "COUNTRY_REQUIRED",
  },
} as const satisfies Record<string, ConfigKeyDefinition>;

const secretKeyPattern =
  /(secret|password|credential|token|api[_-]?key|cookie|otp)/iu;

export function assertConfigValueIsNotSecret(
  key: string,
  value: unknown,
): void {
  if (secretKeyPattern.test(key) || containsSecretLikeKey(value)) {
    throw new Error("CONFIG_SECRET_VALUE_REJECTED");
  }
}

function containsSecretLikeKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsSecretLikeKey);
  }
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return Object.entries(value).some(
    ([entryKey, entryValue]) =>
      secretKeyPattern.test(entryKey) ||
      containsSecretLikeKey(entryValue),
  );
}

export function getConfigKeyDefinition(
  key: string,
): ConfigKeyDefinition | undefined {
  return CONFIG_KEY_CATALOG[key as keyof typeof CONFIG_KEY_CATALOG];
}
