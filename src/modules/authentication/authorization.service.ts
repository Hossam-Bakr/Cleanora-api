import {
  isAccountStateUsableForAuthorization,
  isOwnershipRuleSatisfied,
  isScopeRuleSatisfied,
} from "./authorization.policy.js";
import { findProtectedOperation } from "./domain/authorization.catalog.js";
import { authorizationError } from "./domain/authorization.errors.js";
import type { AuthorizationGrantReader } from "./domain/authorization.ports.js";
import type {
  AuthorizationDecision,
  AuthorizationDenialCode,
  AuthorizeInput,
  AuthorizeProtectedOperationInput,
  EffectivePermissions,
  OwnershipRule,
  ScopeRule,
} from "./domain/authorization.types.js";
import type { AuthenticationPrincipal } from "./domain/authentication.types.js";

const NO_PERMISSIONS: EffectivePermissions = {
  roleCodes: [],
  permissionCodes: [],
};

function allow(): AuthorizationDecision {
  return { allowed: true };
}

function deny(denialCode: AuthorizationDenialCode): AuthorizationDecision {
  return { allowed: false, denialCode };
}

/**
 * Is this principal a real, server-established, usable actor?
 *
 * A missing principal means the authentication middleware did not install one,
 * so authorization fails closed instead of evaluating anything further.
 */
function isUsableActor(principal: AuthenticationPrincipal | undefined): boolean {
  if (principal === undefined) {
    return false;
  }
  return isAccountStateUsableForAuthorization(principal);
}

/**
 * Evaluates authorization for R1-P03 protected operations.
 *
 * Every decision starts from a denial and only becomes an allow when the
 * account state, the required permission, and the required ownership and scope
 * rules all pass. Nothing is cached: each call reads current grants, so a
 * revoked or disabled grant stops granting access on the very next check.
 */
export class AuthorizationService {
  private readonly grants: AuthorizationGrantReader;

  constructor(grants: AuthorizationGrantReader) {
    this.grants = grants;
  }

  /** Permissions the actor's ENABLED grants currently give, unioned by role. */
  async effectivePermissions(
    principal: AuthenticationPrincipal,
  ): Promise<EffectivePermissions> {
    if (!isUsableActor(principal)) {
      return NO_PERMISSIONS;
    }
    return this.grants.findEnabledRolesAndPermissions(principal.userId);
  }

  /** Check one permission with optional ownership, scope, and state facts. */
  async authorize(input: AuthorizeInput): Promise<AuthorizationDecision> {
    const ownershipRule: OwnershipRule =
      input.ownership === undefined ? "NONE" : "SELF";
    const scopeRule: ScopeRule =
      input.scope === undefined ? "NONE" : input.scope.kind;

    return this.evaluate({
      input,
      permissionCode: input.permissionCode,
      ownershipRule,
      scopeRule,
    });
  }

  /** Check one declared protected operation using its own required rules. */
  async authorizeProtectedOperation(
    input: AuthorizeProtectedOperationInput,
  ): Promise<AuthorizationDecision> {
    const operation = findProtectedOperation(input.operationId);
    if (operation === undefined) {
      throw authorizationError("AUTHZ_OPERATION_UNKNOWN");
    }

    return this.evaluate({
      input,
      permissionCode: operation.permissionCode,
      ownershipRule: operation.ownership,
      scopeRule: operation.scope,
    });
  }

  private async evaluate(check: {
    readonly input: AuthorizeInput | AuthorizeProtectedOperationInput;
    readonly permissionCode: string;
    readonly ownershipRule: OwnershipRule;
    readonly scopeRule: ScopeRule;
  }): Promise<AuthorizationDecision> {
    const { input, permissionCode, ownershipRule, scopeRule } = check;

    if (!isUsableActor(input.principal)) {
      return deny("ACCOUNT_STATE_DENIED");
    }
    if (input.resourceState !== undefined && !input.resourceState.usable) {
      return deny("RESOURCE_STATE_DENIED");
    }

    const permissions = await this.grants.findEnabledRolesAndPermissions(
      input.principal.userId,
    );
    if (!permissions.permissionCodes.includes(permissionCode)) {
      return deny("PERMISSION_DENIED");
    }

    if (
      !isOwnershipRuleSatisfied(ownershipRule, input.principal, input.ownership)
    ) {
      return deny("OWNERSHIP_DENIED");
    }
    if (!isScopeRuleSatisfied(scopeRule, input.scope)) {
      return deny("SCOPE_DENIED");
    }

    return allow();
  }
}

export { allow, deny };
