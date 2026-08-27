import type { ProvidersWorkforceUnitOfWorkPort } from "./domain/provider-workforce.types.js";
import { WorkforcePolicyError } from "./domain/provider-workforce.policy.js";
import type { WorkerInvitationProofPort } from "./domain/worker-invitation-proof.policy.js";

function invalidInvitation(): never {
  throw new WorkforcePolicyError("WORKER_INVITATION_INVALID");
}

function maskEmail(emailNormalized: string): string {
  const separator = emailNormalized.indexOf("@");
  if (separator < 1 || separator === emailNormalized.length - 1) invalidInvitation();
  return `${emailNormalized[0]}***${emailNormalized.slice(separator)}`;
}

export class ProviderWorkforceInvitationQueryService {
  public constructor(private readonly dependencies: {
    readonly unitOfWork: ProvidersWorkforceUnitOfWorkPort;
    readonly invitationProof: WorkerInvitationProofPort;
    readonly now?: () => Date;
  }) {}

  public async inspect(input: { readonly invitationProof: string }) {
    const routing = this.dependencies.invitationProof.inspectRouting(input.invitationProof);
    if (routing === null) invalidInvitation();
    const now = this.dependencies.now?.() ?? new Date();
    const outcome = await this.dependencies.unitOfWork.run(async (context) => {
      const routedWorker = await context.workforce.getWorkerForInvitation(routing.invitationId);
      if (routedWorker === null) invalidInvitation();
      if (await context.workforce.lockProvider(routedWorker.providerId) === null) invalidInvitation();
      const worker = await context.workforce.lockWorker(routedWorker.providerId, routedWorker.id);
      if (worker === null) invalidInvitation();
      const invitation = await context.workforce.getInvitation(routing.invitationId);
      const latest = await context.workforce.getLatestInvitation(worker.id);
      if (invitation === null || latest === null || invitation.workerId !== worker.id) invalidInvitation();

      const isExactCurrent = invitation.status === "PENDING"
        && latest.id === invitation.id
        && latest.invitationVersion === invitation.invitationVersion
        && worker.access?.status === "INVITED"
        && worker.access.currentInvitationId === invitation.id;
      if (isExactCurrent && invitation.expiresAt.getTime() <= now.getTime()) {
        await context.workforce.transitionInvitation({
          providerId: worker.providerId,
          workerId: worker.id,
          invitationId: invitation.id,
          expectedInvitationVersion: invitation.version,
          expectedAccessVersion: worker.access!.version,
          status: "EXPIRED",
          transitionedAt: now,
        });
        return { expired: true as const };
      }
      if (!isExactCurrent
        || worker.endedAt !== null
        || worker.identityUserId !== null
        || routing.invitationVersion !== invitation.invitationVersion
        || routing.expiresAt.getTime() !== invitation.expiresAt.getTime()
        || !this.dependencies.invitationProof.verify(input.invitationProof, {
          invitationId: invitation.id,
          invitationVersion: invitation.invitationVersion,
          emailNormalized: invitation.emailNormalized,
          locale: invitation.locale,
          expiresAt: invitation.expiresAt,
        }, now)) invalidInvitation();

      return {
        expired: false as const,
        projection: {
          providerId: worker.providerId,
          workerId: worker.id,
          invitationVersion: invitation.invitationVersion,
          expectedVersion: invitation.version,
          locale: invitation.locale,
          maskedEmail: maskEmail(invitation.emailNormalized),
          expiresAt: invitation.expiresAt,
          onboardingMode: "AUTHENTICATE_OR_CREATE" as const,
          expectedWorkerVersion: worker.version,
          expectedAccessVersion: worker.access.version,
        },
      };
    });
    if (outcome.expired) invalidInvitation();
    return outcome.projection;
  }
}
