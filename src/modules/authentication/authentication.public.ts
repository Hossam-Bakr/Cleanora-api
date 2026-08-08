import type {
  AccountCategory,
  AuthenticationPrincipal,
  UserStatus,
} from "./domain/authentication.types.js";
import { findPrivilegedActionReason } from "./domain/authorization.catalog.js";

export type { AccountCategory, AuthenticationPrincipal, UserStatus };
export { findPrivilegedActionReason };

/**
 * Approved public type/capability surface for cross-module consumers.
 * Business modules must import from this file only — not from
 * `domain/` or `infrastructure/`.
 */
export const AUTHENTICATION_PUBLIC_CONTRACT = "authentication.public" as const;
