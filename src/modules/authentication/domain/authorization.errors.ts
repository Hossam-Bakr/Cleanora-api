import { AppError } from "#shared/errors/app-error";

import type { AuthorizationDenialCode } from "./authorization.types.js";

export type AuthorizationErrorCode =
  | "AUTHZ_ACCOUNT_STATE_DENIED"
  | "AUTHZ_PERMISSION_DENIED"
  | "AUTHZ_OWNERSHIP_DENIED"
  | "AUTHZ_SCOPE_DENIED"
  | "AUTHZ_RESOURCE_STATE_DENIED"
  | "AUTHZ_SELF_MANAGEMENT_DENIED"
  | "AUTHZ_TARGET_USER_NOT_FOUND"
  | "AUTHZ_ROLE_UNKNOWN"
  | "AUTHZ_OPERATION_UNKNOWN"
  | "AUTHZ_REASON_INVALID"
  | "AUTHZ_REASON_UNAUTHORIZED"
  | "AUTHZ_ROLE_TRANSITION_INVALID";

interface AuthorizationErrorDefinition {
  readonly statusCode: number;
  readonly message: string;
}

/**
 * Public messages stay generic on purpose. A denial must never reveal another
 * user's roles, grants, or authorization internals.
 */
const definitions: Record<
  AuthorizationErrorCode,
  AuthorizationErrorDefinition
> = {
  AUTHZ_ACCOUNT_STATE_DENIED: {
    statusCode: 403,
    message: "This account state does not allow this action.",
  },
  AUTHZ_PERMISSION_DENIED: {
    statusCode: 403,
    message: "You are not allowed to perform this action.",
  },
  AUTHZ_OWNERSHIP_DENIED: {
    statusCode: 403,
    message: "You are not allowed to act on this resource.",
  },
  AUTHZ_SCOPE_DENIED: {
    statusCode: 403,
    message: "You are not allowed to act in this scope.",
  },
  AUTHZ_RESOURCE_STATE_DENIED: {
    statusCode: 409,
    message: "This resource state does not allow this action.",
  },
  AUTHZ_SELF_MANAGEMENT_DENIED: {
    statusCode: 403,
    message: "You cannot change your own role grants.",
  },
  AUTHZ_TARGET_USER_NOT_FOUND: {
    statusCode: 404,
    message: "The target user could not be found.",
  },
  AUTHZ_ROLE_UNKNOWN: {
    statusCode: 400,
    message: "The requested role is not part of the approved role catalog.",
  },
  AUTHZ_OPERATION_UNKNOWN: {
    statusCode: 500,
    message: "This protected operation is not declared.",
  },
  AUTHZ_REASON_INVALID: {
    statusCode: 400,
    message:
      "A privileged reason code approved for this exact operation is required.",
  },
  AUTHZ_REASON_UNAUTHORIZED: {
    statusCode: 403,
    message: "You are not allowed to supply a privileged reason.",
  },
  AUTHZ_ROLE_TRANSITION_INVALID: {
    statusCode: 409,
    message: "This role grant cannot change to the requested state.",
  },
};

/** Create one safe authorization error without leaking grant internals. */
export function authorizationError(code: AuthorizationErrorCode): AppError {
  const definition = definitions[code];
  return new AppError({
    code,
    message: definition.message,
    statusCode: definition.statusCode,
    expose: true,
  });
}

const denialErrorCodes: Record<
  AuthorizationDenialCode,
  AuthorizationErrorCode
> = {
  ACCOUNT_STATE_DENIED: "AUTHZ_ACCOUNT_STATE_DENIED",
  PERMISSION_DENIED: "AUTHZ_PERMISSION_DENIED",
  OWNERSHIP_DENIED: "AUTHZ_OWNERSHIP_DENIED",
  SCOPE_DENIED: "AUTHZ_SCOPE_DENIED",
  RESOURCE_STATE_DENIED: "AUTHZ_RESOURCE_STATE_DENIED",
};

/** Turn a denial code from an authorization decision into a safe error. */
export function authorizationDenialError(
  denialCode: AuthorizationDenialCode | undefined,
): AppError {
  if (denialCode === undefined) {
    return authorizationError("AUTHZ_PERMISSION_DENIED");
  }
  return authorizationError(denialErrorCodes[denialCode]);
}
