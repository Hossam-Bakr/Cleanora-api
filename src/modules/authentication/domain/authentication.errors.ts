import { AppError } from "#core/errors/app-error";

export type AuthenticationErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "AUTHENTICATION_FAILED"
  | "AUTH_ACCESS_TOKEN_INVALID"
  | "AUTH_REFRESH_TOKEN_INVALID"
  | "AUTH_VERIFICATION_REQUIRED"
  | "AUTH_ACCOUNT_UNAVAILABLE"
  | "AUTH_ACCOUNT_CATEGORY_NOT_ALLOWED"
  | "AUTH_CATEGORY_STATE_CONFLICT"
  | "AUTH_SIGNUP_UNAVAILABLE"
  | "AUTH_PHONE_ALREADY_REGISTERED"
  | "AUTH_EMAIL_ALREADY_REGISTERED"
  | "AUTH_SIGNUP_IDENTIFIERS_ALREADY_REGISTERED"
  | "AUTH_PHONE_FORMAT_INVALID"
  | "AUTH_EMAIL_FORMAT_INVALID"
  | "AUTH_VERIFICATION_FAILED"
  | "AUTH_PASSWORD_RESET_FAILED"
  | "AUTH_CURRENT_PASSWORD_INVALID"
  | "AUTH_PASSWORD_POLICY_FAILED"
  | "AUTH_SOCIAL_AUTHENTICATION_FAILED"
  | "AUTH_SOCIAL_LINK_FAILED"
  | "AUTH_SOCIAL_UNLINK_UNSAFE"
  | "AUTH_GOOGLE_EMAIL_UNAVAILABLE"
  | "AUTH_REQUEST_ORIGIN_REJECTED"
  | "AUTH_PROVIDER_UNAVAILABLE"
  | "AUTH_EVENT_WRITE_FAILED";

interface AuthenticationErrorDefinition {
  readonly statusCode: number;
  readonly message: string;
  readonly expose?: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
}

const definitions: Record<
  AuthenticationErrorCode,
  AuthenticationErrorDefinition
> = {
  AUTHENTICATION_REQUIRED: {
    statusCode: 401,
    message: "Sign in to continue.",
  },
  AUTHENTICATION_FAILED: {
    statusCode: 401,
    message: "The phone number or password is incorrect.",
  },
  AUTH_ACCESS_TOKEN_INVALID: {
    statusCode: 401,
    message: "Your access token is invalid or expired. Refresh the session and try again.",
  },
  AUTH_REFRESH_TOKEN_INVALID: {
    statusCode: 401,
    message: "Your session is invalid or expired. Please sign in again.",
  },
  AUTH_VERIFICATION_REQUIRED: {
    statusCode: 403,
    message: "Complete account verification before continuing.",
  },
  AUTH_ACCOUNT_UNAVAILABLE: {
    statusCode: 403,
    message: "This account is currently unavailable.",
  },
  AUTH_ACCOUNT_CATEGORY_NOT_ALLOWED: {
    statusCode: 403,
    message: "This account category is not allowed for this operation.",
  },
  AUTH_CATEGORY_STATE_CONFLICT: {
    statusCode: 409,
    message: "This account category is already enrolled or cannot be changed in its current state.",
    details: { field: "accountCategory", reason: "state_conflict" },
  },
  AUTH_SIGNUP_UNAVAILABLE: {
    statusCode: 409,
    message: "Signup could not be completed with the provided data.",
  },
  AUTH_PHONE_ALREADY_REGISTERED: {
    statusCode: 409,
    message: "This phone number is already registered. Sign in to use the existing account.",
    details: {
      field: "phone",
      reason: "already_registered",
      issues: [
        {
          path: "phone",
          code: "already_registered",
          message: "This phone number is already registered.",
        },
      ],
    },
  },
  AUTH_EMAIL_ALREADY_REGISTERED: {
    statusCode: 409,
    message: "This email address is already registered. Sign in to use the existing account.",
    details: {
      field: "email",
      reason: "already_registered",
      issues: [
        {
          path: "email",
          code: "already_registered",
          message: "This email address is already registered.",
        },
      ],
    },
  },
  AUTH_SIGNUP_IDENTIFIERS_ALREADY_REGISTERED: {
    statusCode: 409,
    message: "The phone number and email address are already registered.",
  },
  AUTH_PHONE_FORMAT_INVALID: {
    statusCode: 400,
    message: "Enter a valid international phone number, for example +201012345678.",
    details: {
      field: "phone",
      reason: "invalid_format",
      format: "E.164",
    },
  },
  AUTH_EMAIL_FORMAT_INVALID: {
    statusCode: 400,
    message: "Enter a valid email address.",
    details: { field: "email", reason: "invalid_format" },
  },
  AUTH_VERIFICATION_FAILED: {
    statusCode: 400,
    message: "The verification code is invalid, expired, exhausted, or has already been used.",
  },
  AUTH_PASSWORD_RESET_FAILED: {
    statusCode: 400,
    message: "The password reset credential is invalid, expired, exhausted, or has already been used.",
  },
  AUTH_CURRENT_PASSWORD_INVALID: {
    statusCode: 400,
    message: "The current password is incorrect.",
    details: { field: "currentPassword", reason: "incorrect" },
  },
  AUTH_PASSWORD_POLICY_FAILED: {
    statusCode: 400,
    message: "Password must contain 7 to 128 characters and must not be common, repeated, or sequential.",
    details: {
      field: "password",
      reason: "weak_password",
      minLength: 7,
      maxLength: 128,
      allowsNumbersOnly: true,
      disallowedPatterns: ["common", "repeated", "sequential"],
    },
  },
  AUTH_SOCIAL_AUTHENTICATION_FAILED: {
    statusCode: 401,
    message: "Google sign-in could not be completed. Please try again.",
  },
  AUTH_SOCIAL_LINK_FAILED: {
    statusCode: 409,
    message: "Google account linking could not be completed or the Google account is already linked.",
  },
  AUTH_SOCIAL_UNLINK_UNSAFE: {
    statusCode: 409,
    message: "Google cannot be disconnected until another login method is available.",
  },
  AUTH_GOOGLE_EMAIL_UNAVAILABLE: {
    statusCode: 403,
    message:
      "Phone verification cannot be delivered because this account has no verified Google email.",
  },
  AUTH_REQUEST_ORIGIN_REJECTED: {
    statusCode: 403,
    message: "This request origin is not allowed.",
  },
  AUTH_PROVIDER_UNAVAILABLE: {
    statusCode: 503,
    message: "The verification provider is temporarily unavailable. Please try again later.",
  },
  AUTH_EVENT_WRITE_FAILED: {
    statusCode: 500,
    message: "Required authentication evidence could not be recorded.",
    expose: false,
  },
};

/**
 * Create a stable public authentication error without exposing credentials,
 * account records, provider payloads, or persistence details.
 */
export function authenticationError(code: AuthenticationErrorCode): AppError {
  const definition = definitions[code];
  return new AppError({
    code,
    message: definition.message,
    statusCode: definition.statusCode,
    expose: definition.expose ?? definition.statusCode < 500,
    ...(definition.details === undefined
      ? {}
      : { details: definition.details }),
  });
}

export function signupIdentifierConflictError(
  fields: readonly ("phone" | "email")[],
): AppError {
  const uniqueFields = [...new Set(fields)];
  if (uniqueFields.length === 1) {
    return authenticationError(
      uniqueFields[0] === "phone"
        ? "AUTH_PHONE_ALREADY_REGISTERED"
        : "AUTH_EMAIL_ALREADY_REGISTERED",
    );
  }
  return new AppError({
    code: "AUTH_SIGNUP_IDENTIFIERS_ALREADY_REGISTERED",
    statusCode: 409,
    message: definitions.AUTH_SIGNUP_IDENTIFIERS_ALREADY_REGISTERED.message,
    expose: true,
    details: {
      issues: uniqueFields.map((field) => ({
        path: field,
        code: "already_registered",
        message:
          field === "phone"
            ? "This phone number is already registered."
            : "This email address is already registered.",
      })),
    },
  });
}
