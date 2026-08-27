import type { WorkerInvitationIdentityOnboarding } from "../authentication/authentication.public.js";
import type {
  ProvidersWorkforceTransactionContext,
  ProvidersWorkforceUnitOfWorkPort,
  WorkerSnapshot,
} from "./domain/provider-workforce.types.js";
import { WorkforcePolicyError } from "./domain/provider-workforce.policy.js";
import type { WorkerInvitationProofPort } from "./domain/worker-invitation-proof.policy.js";

function invalidInvitation(): never {
  throw new WorkforcePolicyError("WORKER_INVITATION_INVALID");
}

interface OnboardingCommandBase {
  readonly invitationProof: string;
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
}

export class ProviderWorkforceOnboardingService {
  public constructor(private readonly dependencies: {
    readonly unitOfWork: ProvidersWorkforceUnitOfWorkPort;
    readonly invitationProof: WorkerInvitationProofPort;
    readonly onboarding: WorkerInvitationIdentityOnboarding;
    readonly now?: () => Date;
  }) {}

  public async start(command: OnboardingCommandBase & { readonly password: string }) {
    const resolved = await this.resolve(command);
    const result = await this.dependencies.onboarding.startNewUser({
      invitationId: resolved.invitation.id,
      invitationVersion: resolved.invitation.invitationVersion,
      fixedEmailNormalized: resolved.invitation.emailNormalized,
      password: command.password,
      idempotencyKey: command.idempotencyKey,
    });
    await this.resolve(command);
    return {
      challengeId: result.challengeId,
      maskedDestination: result.maskedDestination,
      expiresAt: result.expiresAt,
    };
  }

  public async verifyEmail(command: OnboardingCommandBase & {
    readonly challengeId: string;
    readonly code: string;
  }) {
    const resolved = await this.resolve(command);
    const result = await this.dependencies.onboarding.verifyEmail({
      invitationId: resolved.invitation.id,
      invitationVersion: resolved.invitation.invitationVersion,
      challengeId: command.challengeId,
      code: command.code,
      fixedEmailNormalized: resolved.invitation.emailNormalized,
      idempotencyKey: command.idempotencyKey,
    });
    if (result.emailNormalized !== resolved.invitation.emailNormalized
      || result.capability !== "WORKER_INVITATION_ONBOARDING"
      || result.allowedActions.length !== 2
      || result.allowedActions[0] !== "WORKER_INVITATION_ACCEPT"
      || result.allowedActions[1] !== "SESSION_CLEANUP"
      || result.principal.userId.trim().length === 0
      || result.principal.invitationOnboardingOnly !== true) invalidInvitation();
    await this.resolve(command);
    return result;
  }

  private async resolve(command: OnboardingCommandBase) {
    if (!Number.isSafeInteger(command.expectedVersion) || command.expectedVersion <= 0) {
      throw new WorkforcePolicyError("WORKFORCE_VALIDATION_FAILED", { field: "expectedVersion" });
    }
    const routing = this.dependencies.invitationProof.inspectRouting(command.invitationProof);
    if (routing === null) invalidInvitation();
    const now = this.dependencies.now?.() ?? new Date();
    const outcome = await this.dependencies.unitOfWork.run(async (context) => {
      const routedWorker = await context.workforce.getWorkerForInvitation(routing.invitationId);
      if (routedWorker === null) invalidInvitation();
      return this.lockAndResolve(context, routedWorker, routing, command, now);
    });
    if (outcome.expired) invalidInvitation();
    return outcome;
  }

  private async lockAndResolve(
    context: ProvidersWorkforceTransactionContext,
    routedWorker: WorkerSnapshot,
    routing: { readonly invitationId: string; readonly invitationVersion: number; readonly expiresAt: Date },
    command: OnboardingCommandBase,
    now: Date,
  ) {
    if (await context.workforce.lockProvider(routedWorker.providerId) === null) invalidInvitation();
    const worker = await context.workforce.lockWorker(routedWorker.providerId, routedWorker.id);
    if (worker === null) invalidInvitation();
    const invitation = await context.workforce.getInvitation(routing.invitationId);
    const latest = await context.workforce.getLatestInvitation(worker.id);
    if (invitation === null || latest === null || invitation.workerId !== worker.id) invalidInvitation();
    const exactCurrent = invitation.status === "PENDING"
      && invitation.id === latest.id
      && invitation.version === command.expectedVersion
      && invitation.invitationVersion === routing.invitationVersion
      && invitation.expiresAt.getTime() === routing.expiresAt.getTime()
      && worker.identityUserId === null
      && worker.endedAt === null
      && worker.access?.status === "INVITED"
      && worker.access.currentInvitationId === invitation.id;
    if (exactCurrent && invitation.expiresAt.getTime() <= now.getTime()) {
      await context.workforce.transitionInvitation({
        providerId: worker.providerId,
        workerId: worker.id,
        invitationId: invitation.id,
        expectedInvitationVersion: invitation.version,
        expectedAccessVersion: worker.access!.version,
        status: "EXPIRED",
        transitionedAt: now,
      });
      return { expired: true as const, worker, invitation };
    }
    if (!exactCurrent || !this.dependencies.invitationProof.verify(command.invitationProof, {
      invitationId: invitation.id,
      invitationVersion: invitation.invitationVersion,
      emailNormalized: invitation.emailNormalized,
      locale: invitation.locale,
      expiresAt: invitation.expiresAt,
    }, now)) invalidInvitation();
    return { expired: false as const, worker, invitation };
  }
}
