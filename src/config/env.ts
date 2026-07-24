import { z } from "zod";

import {
  DEFAULT_REQUEST_BODY_LIMIT,
  DEFAULT_SHUTDOWN_TIMEOUT_MS
} from "./constants.js";

const secretSchema = z
  .string()
  .min(32, "JWT secrets must contain at least 32 characters");

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(8_000),
    API_PREFIX: z
      .string()
      .regex(/^\/api\/v\d+$/, "API_PREFIX must look like /api/v1")
      .default("/api/v1"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
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
    JWT_ACCESS_SECRET: secretSchema.optional(),
    JWT_ACCESS_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(900),
    JWT_REFRESH_SECRET: secretSchema.optional(),
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
      .default("cleanora_refresh"),
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
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    GOOGLE_REDIRECT_URI: z.url().optional(),
    SHUTDOWN_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(DEFAULT_SHUTDOWN_TIMEOUT_MS),
    REQUEST_BODY_LIMIT: z.string().min(1).default(DEFAULT_REQUEST_BODY_LIMIT)
  })
  .superRefine((environment, context) => {
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
      environment.GOOGLE_REDIRECT_URI
    ];
    if (
      !googleValues.every((value) => value === undefined) &&
      googleValues.includes(undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["GOOGLE_CLIENT_ID"],
        message:
          "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI must be provided together"
      });
    }
  });

export type AppEnvironment = z.infer<typeof environmentSchema>;

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
