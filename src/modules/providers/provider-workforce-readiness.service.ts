import type {
  BookingAssignmentWorkerFact,
  ProviderWorkforcePublicReader,
  ProviderWorkersReadyFacts,
} from "./providers.public.js";
import type {
  ProvidersWorkforceTransactionContext,
  ProvidersWorkforceUnitOfWorkPort,
  WorkerSnapshot,
  WorkerType,
} from "./domain/provider-workforce.types.js";
import {
  isQualifyingWorker,
  validateWorkerProfile,
  WorkforcePolicyError,
} from "./domain/provider-workforce.policy.js";
import { coversWorkerBookingWindow } from "./provider-worker-booking-window.js";
import type { ProviderAvailabilityTransactionContext } from "./infrastructure/prisma-provider-availability.repository.js";

type BlockerCode = ProviderWorkersReadyFacts["blockerCodes"][number];

/**
 * Ad-hoc assign-workers cleans defaults (MVB — no request override):
 * CLEANING_STAFF → true; ESCORT → false; OTHER → false.
 */
export function defaultCleansForWorkerType(workerType: WorkerType): boolean {
  return workerType === "CLEANING_STAFF";
}

function mapWorkerGender(
  gender: WorkerSnapshot["profile"]["gender"],
): BookingAssignmentWorkerFact["gender"] {
  if (gender === "MALE") {
    return "male";
  }
  if (gender === "FEMALE") {
    return "female";
  }
  return "other_or_unspecified";
}

function mapWorkerFact(worker: WorkerSnapshot): BookingAssignmentWorkerFact {
  let profileComplete = true;
  try {
    validateWorkerProfile(worker.profile);
  } catch {
    profileComplete = false;
  }
  const display =
    worker.profile.displayTitle?.trim() ||
    worker.profile.fullLegalName.trim() ||
    worker.id;
  return {
    workerId: worker.id,
    workerUserId: worker.identityUserId,
    workerType: worker.profile.workerType,
    gender: mapWorkerGender(worker.profile.gender),
    cleans: defaultCleansForWorkerType(worker.profile.workerType),
    status: worker.status,
    displayNameEn: display.slice(0, 200),
    displayNameAr: display.slice(0, 200),
    profileComplete,
  };
}

export class ProviderWorkforceReadinessService implements ProviderWorkforcePublicReader {
  public constructor(
    private readonly unitOfWork: ProvidersWorkforceUnitOfWorkPort,
    private readonly runAvailabilityRead:
      | (<T>(
          work: (context: ProviderAvailabilityTransactionContext) => Promise<T>,
        ) => Promise<T>)
      | undefined = undefined,
  ) {}

  public getWorkersReady(providerId: string): Promise<ProviderWorkersReadyFacts | null> {
    return this.unitOfWork.run(async (context) => {
      if (await context.workforce.lockProvider(providerId) === null) return null;
      return this.derive(context, providerId);
    });
  }

  public getBookingSafeTeamFacts(input: { readonly providerId: string; readonly teamId: string }) {
    return this.unitOfWork.run(async (context) => {
      if (await context.workforce.lockProvider(input.providerId) === null) return null;
      const team = await context.workforce.getTeam(input.providerId, input.teamId);
      if (team === null) return null;
      const members = await context.workforce.listCurrentTeamMembers(team.id);
      return {
        providerId: input.providerId,
        teamId: team.id,
        teamVersion: team.version,
        active: team.status === "ACTIVE",
        members: members.map((member) => ({
          workerId: member.workerId,
          gender: member.worker.profile.gender.toLocaleLowerCase("en-US") as "male" | "female",
          workerType: member.worker.profile.workerType,
          cleans: member.cleans,
        })),
      } as const;
    });
  }

  /**
   * @desc Resolve worker facts for assign-workers (cleans from workerType defaults).
   * @access Providers public reader
   */
  public getAssignmentWorkerFacts(input: {
    readonly providerId: string;
    readonly workerIds: readonly string[];
  }): Promise<readonly BookingAssignmentWorkerFact[] | null> {
    return this.unitOfWork.run(async (context) => {
      if (await context.workforce.lockProvider(input.providerId) === null) {
        return null;
      }
      const facts: BookingAssignmentWorkerFact[] = [];
      const seen = new Set<string>();
      for (const workerId of input.workerIds) {
        if (seen.has(workerId)) {
          continue;
        }
        seen.add(workerId);
        const worker = await context.workforce.getWorker(input.providerId, workerId);
        if (worker === null) {
          continue;
        }
        facts.push(mapWorkerFact(worker));
      }
      return facts;
    });
  }

  /**
   * @desc Whether the worker calendar covers the booking window.
   * @access Providers public reader
   */
  public async coversWorkerBookingWindow(input: {
    readonly providerId: string;
    readonly workerId: string;
    readonly startsAt: Date;
    readonly endsAt: Date;
  }): Promise<boolean> {
    if (this.runAvailabilityRead === undefined) {
      return false;
    }
    return coversWorkerBookingWindow(this.runAvailabilityRead, input);
  }

  public async getForActor(input: { readonly actorUserId: string; readonly providerId: string }) {
    return this.unitOfWork.run(async (context) => {
      const provider = await context.workforce.lockProvider(input.providerId);
      if (provider === null) {
        throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      }
      const membership = await context.workforce.readActorMembership(input.providerId, input.actorUserId);
      if (membership === null || !membership.active) {
        throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
      }
      return {
        ...(await this.derive(context, input.providerId)),
        workforceVersion: provider.workforceStateVersion,
      };
    });
  }

  private async derive(
    context: ProvidersWorkforceTransactionContext,
    providerId: string,
  ): Promise<ProviderWorkersReadyFacts> {
    const candidates = await context.workforce.listReadinessCandidates(providerId);
    let qualifyingWorkerCount = 0;
    let hasActiveCleaningWorker = false;
    let hasCompleteActiveCleaningWorker = false;
    let hasAccountAndRoleEligibleWorker = false;
    for (const worker of candidates) {
      const activeCleaning = worker.status === "ACTIVE" && worker.endedAt === null && worker.profile.workerType === "CLEANING_STAFF";
      if (activeCleaning) hasActiveCleaningWorker = true;
      let profileComplete = true;
      try { validateWorkerProfile(worker.profile); } catch { profileComplete = false; }
      if (activeCleaning && profileComplete) hasCompleteActiveCleaningWorker = true;
      const identity = worker.identityUserId === null ? null : await context.identityReader.getIdentity(worker.identityUserId);
      const identityActive = identity?.isAccountActive === true;
      const workerRoleEnabled = identity?.workerRoleEnabled === true;
      if (activeCleaning && profileComplete && identityActive && workerRoleEnabled) hasAccountAndRoleEligibleWorker = true;
      if (isQualifyingWorker({
        status: worker.status,
        profileComplete,
        workerType: worker.profile.workerType,
        identityActive,
        workerRoleEnabled,
        loginAccessActive: worker.access?.status === "ACTIVE",
      })) qualifyingWorkerCount += 1;
    }
    const blockerCodes: BlockerCode[] = [];
    if (qualifyingWorkerCount === 0) {
      if (!hasActiveCleaningWorker) blockerCodes.push("NO_ACTIVE_CLEANING_WORKER");
      else if (!hasCompleteActiveCleaningWorker) blockerCodes.push("PROFILE_INCOMPLETE");
      else if (!hasAccountAndRoleEligibleWorker) blockerCodes.push("WORKER_ACCOUNT_OR_ROLE_INACTIVE");
      else blockerCodes.push("WORKER_LOGIN_ACCESS_INACTIVE");
    }
    return { providerId, workersReady: qualifyingWorkerCount > 0, qualifyingWorkerCount, blockerCodes };
  }
}
