import { z } from "zod";

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
  "platform.default_timezone": {
    valueSchema: z.string().min(1),
    valueKind: "STRING",
    resolutionPolicy: "GLOBAL_ONLY",
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
