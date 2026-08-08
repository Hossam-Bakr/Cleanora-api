import { z } from "zod";

import {
  DEFAULT_REQUEST_BODY_LIMIT,
  DEFAULT_SHUTDOWN_TIMEOUT_MS
} from "./constants.js";

export interface EnvironmentDiagnostic {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

const secretSchema = z
  .string()
  .min(32, "JWT secrets must contain at least 32 characters");

const optionalSecretSchema = z.preprocess(
  emptyStringToUndefined,
  secretSchema.optional()
);
const optionalTextSchema = z.preprocess(
  emptyStringToUndefined,
  z.string().min(1).optional()
);
const optionalUrlSchema = z.preprocess(
  emptyStringToUndefined,
  z.url().optional()
);
const optionalEmailSchema = z.preprocess(
  emptyStringToUndefined,
  z.email().optional()
);
const optionalPositiveIntegerSchema = z.preprocess(
  emptyStringToUndefined,
  z.coerce.number().int().positive().optional()
);
const optionalBooleanFlagSchema = z.preprocess(
  emptyStringToUndefined,
  z.enum(["true", "false"]).transform((value) => value === "true").optional()
);

const booleanFlagSchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

const databaseUrlSchema = z
  .string()
  .min(1, "DATABASE_URL is required")
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "postgresql:" || url.protocol === "postgres:";
    } catch {
      return false;
    }
  }, "DATABASE_URL must be a valid PostgreSQL URL");

const environmentSchema = z
  .object({
    AUTH_ENABLED: booleanFlagSchema.default(false),
    EMAIL_AUTH_ENABLED: booleanFlagSchema.default(false),
    EMAIL_PROVIDER: z.preprocess(
      emptyStringToUndefined,
      z.enum(["smtp"]).optional()
    ),
    SMTP_HOST: optionalTextSchema,
    SMTP_PORT: optionalPositiveIntegerSchema.pipe(
      z.number().int().max(65_535).optional()
    ),
    SMTP_SECURE: optionalBooleanFlagSchema,
    SMTP_REQUIRE_TLS: optionalBooleanFlagSchema,
    SMTP_USER: optionalTextSchema,
    SMTP_PASSWORD: optionalTextSchema,
    SMTP_FROM_NAME: optionalTextSchema,
    SMTP_FROM_EMAIL: optionalEmailSchema,
    SMTP_CONNECTION_TIMEOUT_MS: optionalPositiveIntegerSchema,
    SMTP_SOCKET_TIMEOUT_MS: optionalPositiveIntegerSchema,
    GOOGLE_AUTH_ENABLED: booleanFlagSchema.default(false),
    AUTH_VERIFIER_SECRET: optionalSecretSchema,
    AUTH_PRIVACY_HASH_SECRET: optionalSecretSchema,
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(8_000),
    API_PREFIX: z
      .string()
      .regex(/^\/api\/v\d+$/, "API_PREFIX must look like /api/v1")
      .default("/api/v1"),
    DATABASE_URL: databaseUrlSchema,
    CORS_ORIGINS: z
      .string()
      .min(1, "CORS_ORIGINS is required")
      .transform((value) =>
        value
          .split(",")
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0)
      )
      .pipe(z.array(z.url()).min(1)),
    LOG_LEVEL: z
      .enum(["debug", "info", "warn", "error"])
      .default("info"),
    JWT_ACCESS_SECRET: optionalSecretSchema,
    JWT_ACCESS_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(900),
    JWT_REFRESH_SECRET: optionalSecretSchema,
    JWT_REFRESH_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(2_592_000),
    JWT_ISSUER: z.string().min(1).default("cleanora-api"),
    JWT_AUDIENCE: z.string().min(1).default("cleanora-web"),
    AUTH_REFRESH_COOKIE_NAME: z
      .string()
      .regex(/^[a-z][a-z0-9_]*$/i)
      .default("cleanora_refresh_token"),
    AUTH_REFRESH_COOKIE_PATH: z
      .string()
      .regex(/^\//, "AUTH_REFRESH_COOKIE_PATH must start with /")
      .default("/api/v1/auth"),
    AUTH_COOKIE_SECURE: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .default(false),
    AUTH_COOKIE_SAME_SITE: z
      .enum(["lax", "strict", "none"])
      .default("lax"),
    GOOGLE_CLIENT_ID: optionalTextSchema,
    GOOGLE_CLIENT_SECRET: optionalTextSchema,
    GOOGLE_REDIRECT_URI: optionalUrlSchema,
    GOOGLE_FRONTEND_CALLBACK_URI: optionalUrlSchema,
    OWNER_ADMIN_API_ENABLED: booleanFlagSchema.default(false),
    OWNER_ADMIN_SECRET: optionalSecretSchema,
    MEDIA_STORAGE_PROVIDER: optionalTextSchema,
    CLOUDINARY_CLOUD_NAME: optionalTextSchema,
    CLOUDINARY_API_KEY: optionalTextSchema,
    CLOUDINARY_API_SECRET: optionalTextSchema,
    CLOUDINARY_PROFILE_IMAGE_FOLDER: optionalTextSchema,
    CLOUDINARY_SIGNED_URL_TTL_SECONDS: optionalPositiveIntegerSchema,
    MEDIA_IMAGE_MAX_BYTES: optionalPositiveIntegerSchema,
    PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS: optionalPositiveIntegerSchema,
    SHUTDOWN_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(DEFAULT_SHUTDOWN_TIMEOUT_MS),
    REQUEST_BODY_LIMIT: z.string().min(1).default(DEFAULT_REQUEST_BODY_LIMIT)
  })
  .superRefine((environment, context) => {
    if (environment.OWNER_ADMIN_API_ENABLED && environment.OWNER_ADMIN_SECRET === undefined) {
      context.addIssue({
        code: "custom",
        path: ["OWNER_ADMIN_SECRET"],
        message: "OWNER_ADMIN_SECRET is required when OWNER_ADMIN_API_ENABLED=true",
      });
    }
    if (environment.AUTH_ENABLED) {
      const required = [
        ['JWT_ACCESS_SECRET', environment.JWT_ACCESS_SECRET],
        ['JWT_REFRESH_SECRET', environment.JWT_REFRESH_SECRET],
        ['AUTH_VERIFIER_SECRET', environment.AUTH_VERIFIER_SECRET],
        ['AUTH_PRIVACY_HASH_SECRET', environment.AUTH_PRIVACY_HASH_SECRET]
      ] as const;

      for (const [field, value] of required) {
        if (value === undefined) {
          context.addIssue({
            code: 'custom',
            path: [field],
            message: `${field} is required when AUTH_ENABLED=true`
          });
        }
      }

      const distinctSecrets = required
        .map(([, value]) => value)
        .filter((value): value is string => value !== undefined);
      if (new Set(distinctSecrets).size !== distinctSecrets.length) {
        context.addIssue({
          code: 'custom',
          path: ['AUTH_VERIFIER_SECRET'],
          message: 'Authentication secrets must be independent'
        });
      }
    }

    if (environment.EMAIL_AUTH_ENABLED && !environment.AUTH_ENABLED) {
      context.addIssue({
        code: "custom",
        path: ["EMAIL_AUTH_ENABLED"],
        message: "Email authentication requires AUTH_ENABLED=true"
      });
    }

    if (environment.AUTH_ENABLED && !environment.EMAIL_AUTH_ENABLED) {
      context.addIssue({
        code: "custom",
        path: ["EMAIL_AUTH_ENABLED"],
        message:
          "R1-P02 authentication requires EMAIL_AUTH_ENABLED=true because email is the only verification channel"
      });
    }

    if (environment.AUTH_ENABLED && environment.EMAIL_AUTH_ENABLED) {
      const smtpRequired = [
        ["EMAIL_PROVIDER", environment.EMAIL_PROVIDER],
        ["SMTP_HOST", environment.SMTP_HOST],
        ["SMTP_PORT", environment.SMTP_PORT],
        ["SMTP_SECURE", environment.SMTP_SECURE],
        ["SMTP_REQUIRE_TLS", environment.SMTP_REQUIRE_TLS],
        ["SMTP_USER", environment.SMTP_USER],
        ["SMTP_PASSWORD", environment.SMTP_PASSWORD],
        ["SMTP_FROM_NAME", environment.SMTP_FROM_NAME],
        ["SMTP_FROM_EMAIL", environment.SMTP_FROM_EMAIL],
        ["SMTP_CONNECTION_TIMEOUT_MS", environment.SMTP_CONNECTION_TIMEOUT_MS],
        ["SMTP_SOCKET_TIMEOUT_MS", environment.SMTP_SOCKET_TIMEOUT_MS]
      ] as const;
      for (const [field, value] of smtpRequired) {
        if (value === undefined) {
          context.addIssue({
            code: "custom",
            path: [field],
            message: `${field} is required when email authentication is enabled`
          });
        }
      }
    }

    if (environment.GOOGLE_AUTH_ENABLED && !environment.AUTH_ENABLED) {
      context.addIssue({
        code: 'custom',
        path: ['GOOGLE_AUTH_ENABLED'],
        message: 'Google authentication requires AUTH_ENABLED=true'
      });
    }

    if (environment.GOOGLE_AUTH_ENABLED) {
      const googleRequired = [
        environment.GOOGLE_CLIENT_ID,
        environment.GOOGLE_CLIENT_SECRET,
        environment.GOOGLE_REDIRECT_URI,
        environment.GOOGLE_FRONTEND_CALLBACK_URI
      ];
      if (googleRequired.some((value) => value === undefined)) {
        context.addIssue({
          code: 'custom',
          path: ['GOOGLE_CLIENT_ID'],
          message: 'Enabled Google authentication requires complete OIDC configuration'
        });
      }
      if (
        environment.GOOGLE_FRONTEND_CALLBACK_URI !== undefined &&
        !environment.CORS_ORIGINS.includes(
          new URL(environment.GOOGLE_FRONTEND_CALLBACK_URI).origin
        )
      ) {
        context.addIssue({
          code: 'custom',
          path: ['GOOGLE_FRONTEND_CALLBACK_URI'],
          message: 'Google frontend callback origin must be included in CORS_ORIGINS'
        });
      }
    }
    if (
      environment.AUTH_COOKIE_SAME_SITE === "none" &&
      !environment.AUTH_COOKIE_SECURE
    ) {
      context.addIssue({
        code: "custom",
        path: ["AUTH_COOKIE_SECURE"],
        message: "SameSite=None requires AUTH_COOKIE_SECURE=true"
      });
    }
    if (environment.NODE_ENV === 'production' && environment.AUTH_ENABLED && !environment.AUTH_COOKIE_SECURE) {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_COOKIE_SECURE'],
        message: 'Production authentication requires AUTH_COOKIE_SECURE=true'
      });
    }

    if (
      environment.JWT_ACCESS_SECRET !== undefined &&
      environment.JWT_REFRESH_SECRET !== undefined &&
      environment.JWT_ACCESS_SECRET === environment.JWT_REFRESH_SECRET
    ) {
      context.addIssue({
        code: "custom",
        path: ["JWT_REFRESH_SECRET"],
        message: "Access and refresh token secrets must be different"
      });
    }

    const googleValues = [
      environment.GOOGLE_CLIENT_ID,
      environment.GOOGLE_CLIENT_SECRET,
      environment.GOOGLE_REDIRECT_URI,
      environment.GOOGLE_FRONTEND_CALLBACK_URI
    ];
    if (
      !googleValues.every((value) => value === undefined) &&
      googleValues.includes(undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["GOOGLE_CLIENT_ID"],
        message:
          "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, and GOOGLE_FRONTEND_CALLBACK_URI must be provided together"
      });
    }
  });

export type AppEnvironment = z.infer<typeof environmentSchema>;

/** Customers-runtime env subset required when composing customers/media. */
export type CustomersRuntimeEnvironment = AppEnvironment & {
  readonly MEDIA_STORAGE_PROVIDER: "cloudinary";
  readonly CLOUDINARY_CLOUD_NAME: string;
  readonly CLOUDINARY_API_KEY: string;
  readonly CLOUDINARY_API_SECRET: string;
  readonly CLOUDINARY_PROFILE_IMAGE_FOLDER: string;
  readonly CLOUDINARY_SIGNED_URL_TTL_SECONDS: number;
  readonly MEDIA_IMAGE_MAX_BYTES: number;
  readonly PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS: number;
};

function emptyStringToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim().length === 0
    ? undefined
    : value;
}

/**
 * @desc Fail closed when customers/media runtime is composed without Cloudinary
 * media configuration or retention days (DEC-033).
 * @access Composition / readiness
 * @explanation Foundation tooling that never composes customers must not call
 * this helper, so Cloudinary secrets and
 * `PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS` stay optional at base
 * `loadEnvironment` time. Selecting `s3` fails clearly — not implemented in
 * R1-P04.
 */
export function assertCustomersRuntimeEnvironment(
  environment: AppEnvironment,
): asserts environment is CustomersRuntimeEnvironment {
  const provider = environment.MEDIA_STORAGE_PROVIDER;
  if (provider === undefined || provider.trim().length === 0) {
    throw new Error(
      "MEDIA_STORAGE_PROVIDER is required when customers runtime is composed",
    );
  }
  if (provider === "s3") {
    throw new Error("S3 is not implemented in R1-P04");
  }
  if (provider !== "cloudinary") {
    throw new Error(
      `Unsupported MEDIA_STORAGE_PROVIDER '${provider}'. R1-P04 supports cloudinary only.`,
    );
  }
  if (
    environment.CLOUDINARY_CLOUD_NAME === undefined ||
    environment.CLOUDINARY_CLOUD_NAME.trim().length === 0 ||
    environment.CLOUDINARY_API_KEY === undefined ||
    environment.CLOUDINARY_API_KEY.trim().length === 0 ||
    environment.CLOUDINARY_API_SECRET === undefined ||
    environment.CLOUDINARY_API_SECRET.trim().length === 0 ||
    environment.CLOUDINARY_PROFILE_IMAGE_FOLDER === undefined ||
    environment.CLOUDINARY_PROFILE_IMAGE_FOLDER.trim().length === 0
  ) {
    throw new Error(
      "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, and CLOUDINARY_PROFILE_IMAGE_FOLDER are required when MEDIA_STORAGE_PROVIDER=cloudinary",
    );
  }
  if (
    environment.CLOUDINARY_SIGNED_URL_TTL_SECONDS === undefined ||
    !Number.isInteger(environment.CLOUDINARY_SIGNED_URL_TTL_SECONDS) ||
    environment.CLOUDINARY_SIGNED_URL_TTL_SECONDS < 60 ||
    environment.CLOUDINARY_SIGNED_URL_TTL_SECONDS > 86_400
  ) {
    throw new Error(
      "CLOUDINARY_SIGNED_URL_TTL_SECONDS must be a positive integer between 60 and 86400 when customers runtime is composed",
    );
  }
  if (environment.MEDIA_IMAGE_MAX_BYTES !== 5 * 1024 * 1024) {
    throw new Error(
      "MEDIA_IMAGE_MAX_BYTES must equal 5242880 (5 MiB) for R1-P04",
    );
  }
  if (
    environment.PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS === undefined ||
    !Number.isInteger(environment.PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS) ||
    environment.PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS < 1
  ) {
    throw new Error(
      "PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS is required as a positive integer when customers runtime is composed",
    );
  }
}

/**
 * @desc Validate and normalize application environment values.
 * @access Internal configuration
 * @explanation This function stops startup when foundation configuration is
 * missing or unsafe. R1-P02 authentication values remain optional until auth
 * is enabled, but are validated when they are supplied.
 */
export function loadEnvironment(
  input: NodeJS.ProcessEnv = process.env
): AppEnvironment {
  return environmentSchema.parse(input);
}

/**
 * @desc Map Zod environment failures into safe structured diagnostics.
 * @access Internal process lifecycle
 * @explanation Only field paths, issue codes, and schema-authored messages are
 * returned. Raw issues and received environment values are deliberately
 * excluded so startup logging cannot expose credentials or secrets.
 */
export function mapEnvironmentDiagnostics(
  error: unknown
): readonly EnvironmentDiagnostic[] {
  if (!(error instanceof z.ZodError)) {
    return [];
  }

  return error.issues.map((issue) => ({
    field:
      issue.path.length === 0
        ? "environment"
        : issue.path.map(String).join("."),
    code: issue.code,
    message: issue.message
  }));
}

/** Build safe startup log details without exposing environment values. */
export function createStartupFailureContext(
  error: unknown,
): Readonly<Record<string, unknown>> {
  const diagnostics = mapEnvironmentDiagnostics(error);
  const context: Record<string, unknown> = {
    errorName: error instanceof Error ? error.name : "UnknownError",
  };

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[A-Z][A-Z0-9_]{1,31}$/u.test(error.code)
  ) {
    context["errorCode"] = error.code;
  }

  if (diagnostics.length > 0) {
    context["environmentDiagnostics"] = diagnostics;
  }

  return context;
}
