import type {
  ProvidersWorkforceTransactionContext,
  TeamMemberSnapshot,
  TeamSnapshot,
} from "./domain/provider-workforce.types.js";
import { isValidCleaningMember, WorkforcePolicyError } from "./domain/provider-workforce.policy.js";

export interface LockedTeamCleanerImpactInput {
  readonly context: ProvidersWorkforceTransactionContext;
  readonly team: TeamSnapshot;
  readonly membership: TeamMemberSnapshot;
  readonly actorIsPrimarySupervisor: boolean;
  readonly confirmed: boolean;
  readonly expectedTeamVersion?: number | null;
  readonly expectedMembershipVersion?: number | null;
}

export interface LockedTeamCleanerImpact {
  readonly teamId: string;
  readonly teamVersion: number;
  readonly membershipId: string;
  readonly membershipVersion: number;
  readonly teamWillBecomeInactive: boolean;
}

/**
 * Discovers a Worker's current membership, then makes the discovery stable by
 * locking the owning Team before the membership row. Callers must already hold
 * the Provider and Worker locks. A concurrent move/end is a safe conflict; no
 * business decision may be made from the earlier unlocked discovery row.
 */
export async function lockCurrentTeamMembership(
  context: ProvidersWorkforceTransactionContext,
  providerId: string,
  workerId: string,
): Promise<{ readonly team: TeamSnapshot; readonly membership: TeamMemberSnapshot } | null> {
  const preview = await context.workforce.getCurrentMembershipForWorker(workerId);
  if (preview === null) return null;
  const team = await context.workforce.lockTeam(providerId, preview.teamId);
  if (team === null) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
  const membership = await context.workforce.getMembership(team.id, preview.id);
  if (membership === null
    || membership.teamId !== team.id
    || membership.workerId !== workerId
    || membership.endedAt !== null) {
    throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
  }
  return { team, membership };
}

/**
 * Evaluates the final-cleaner invariant only after callers have locked the
 * current Team and membership rows. The returned projection contains no Worker
 * phone/identity data and is safe for conflict details and command evidence.
 */
export async function evaluateLockedTeamCleanerImpact(
  input: LockedTeamCleanerImpactInput,
): Promise<LockedTeamCleanerImpact> {
  const projection = {
    teamId: input.team.id,
    teamVersion: input.team.version,
    membershipId: input.membership.id,
    membershipVersion: input.membership.version,
    teamWillBecomeInactive: false,
  } as const;
  if (input.team.status !== "ACTIVE" || !isValidCleaningMember(input.membership)) {
    return projection;
  }
  const validCleaners = (await input.context.workforce.listCurrentTeamMembers(input.team.id))
    .filter(isValidCleaningMember);
  if (validCleaners.length !== 1 || validCleaners[0]?.id !== input.membership.id) {
    return projection;
  }
  const impact = { ...projection, teamWillBecomeInactive: true } as const;
  const safeDetails = {
    teamId: impact.teamId,
    teamVersion: impact.teamVersion,
    teamWillBecomeInactive: true,
  } as const;
  if (input.actorIsPrimarySupervisor) {
    throw new WorkforcePolicyError("WORKFORCE_FINAL_CLEANER_CONFLICT", safeDetails);
  }
  const staleConfirmation = input.expectedTeamVersion !== undefined
    && (input.expectedTeamVersion !== input.team.version
      || input.expectedMembershipVersion !== input.membership.version);
  if (!input.confirmed || staleConfirmation) {
    throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT", safeDetails);
  }
  return impact;
}
