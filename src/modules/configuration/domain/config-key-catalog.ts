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

const displayNameSchema = z.object({
  en: z.string().min(1),
  ar: z.string().min(1)
}).strict();

export const CONFIG_KEY_CATALOG = {
  "platform.default_timezone": {
    valueSchema: z.string().min(1),
    valueKind: "STRING",
    resolutionPolicy: "GLOBAL_ONLY"
  },
  "country.display_name": {
    valueSchema: displayNameSchema,
    valueKind: "OBJECT",
    resolutionPolicy: "COUNTRY_REQUIRED"
  },
  "country.supported_locales": {
    valueSchema: z.array(z.string().min(1)).min(1),
    valueKind: "ARRAY",
    resolutionPolicy: "COUNTRY_OVERRIDE_WITH_GLOBAL_FALLBACK"
  },
  "country.currency_code": {
    valueSchema: z.string().regex(/^[A-Z]{3}$/),
    valueKind: "STRING",
    resolutionPolicy: "COUNTRY_REQUIRED"
  }
} as const satisfies Record<string, ConfigKeyDefinition>;

const secretKeyPattern = /(secret|password|credential|token|api[_-]?key|cookie|otp)/i;

/**
 * Reject keys and payload fields that could turn configuration into a secret store.
 */
export function assertConfigValueIsNotSecret(key: string, value: unknown): void {
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
      secretKeyPattern.test(entryKey) || containsSecretLikeKey(entryValue)
  );
}

export function getConfigKeyDefinition(key: string): ConfigKeyDefinition | undefined {
  return CONFIG_KEY_CATALOG[key as keyof typeof CONFIG_KEY_CATALOG];
}
