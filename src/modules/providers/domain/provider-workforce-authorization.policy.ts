export type WorkforceAuthorizationOperation =
  | "LIST_WORKFORCE"
  | "READ_WORKER"
  | "CREATE_OR_EDIT_WORKER"
  | "MANAGE_WORKER_LIFECYCLE"
  | "REMOVE_WORKER"
  | "MANAGE_LOGIN_ACCESS"
  | "MANAGE_ADMIN_MEMBERSHIP"
  | "LEAVE_PROVIDER"
  | "MANAGE_TEAM"
  | "UPDATE_TEAM_CLEANS"
  | "CONFIRM_FINAL_CLEANER"
  | "READ_HISTORY"
  | "READ_READINESS";

export interface WorkforceAuthorizationFacts {
  readonly managementLevel: "OWNER" | "ADMIN" | null;
  readonly sameProvider: boolean;
  readonly isSelf: boolean;
  readonly isPrimarySupervisor: boolean;
  readonly targetIsCurrentTeamMember: boolean;
}

export type WorkforceAuthorizationDecision =
  | { readonly allowed: true; readonly scope: "PROVIDER" | "CURRENT_TEAM" | "SELF" }
  | { readonly allowed: false; readonly scope: "NONE" };

const deny: WorkforceAuthorizationDecision = { allowed: false, scope: "NONE" };

export function decideWorkforceAuthorization(
  operation: WorkforceAuthorizationOperation,
  facts: WorkforceAuthorizationFacts,
): WorkforceAuthorizationDecision {
  if (!facts.sameProvider) return deny;
  const manager = facts.managementLevel === "OWNER" || facts.managementLevel === "ADMIN";
  const owner = facts.managementLevel === "OWNER";
  switch (operation) {
    case "LIST_WORKFORCE":
      if (manager) return { allowed: true, scope: "PROVIDER" };
      return facts.isPrimarySupervisor
        ? { allowed: true, scope: "CURRENT_TEAM" }
        : deny;
    case "READ_WORKER":
      if (manager) return { allowed: true, scope: "PROVIDER" };
      if (facts.isSelf) return { allowed: true, scope: "SELF" };
      return facts.isPrimarySupervisor && facts.targetIsCurrentTeamMember
        ? { allowed: true, scope: "CURRENT_TEAM" }
        : deny;
    case "CREATE_OR_EDIT_WORKER":
    case "MANAGE_WORKER_LIFECYCLE":
    case "MANAGE_TEAM":
    case "CONFIRM_FINAL_CLEANER":
    case "READ_HISTORY":
    case "READ_READINESS":
      return manager ? { allowed: true, scope: "PROVIDER" } : deny;
    case "REMOVE_WORKER":
      return owner ? { allowed: true, scope: "PROVIDER" } : deny;
    case "MANAGE_LOGIN_ACCESS":
    case "MANAGE_ADMIN_MEMBERSHIP":
      return owner ? { allowed: true, scope: "PROVIDER" } : deny;
    case "LEAVE_PROVIDER":
      return facts.isSelf ? { allowed: true, scope: "SELF" } : deny;
    case "UPDATE_TEAM_CLEANS":
      if (manager) return { allowed: true, scope: "PROVIDER" };
      return facts.isPrimarySupervisor && facts.targetIsCurrentTeamMember
        ? { allowed: true, scope: "CURRENT_TEAM" }
        : deny;
  }
}
