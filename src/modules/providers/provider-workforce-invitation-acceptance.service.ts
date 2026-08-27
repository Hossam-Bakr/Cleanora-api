import type { AuthenticationPrincipal } from "../authentication/authentication.public.js";
import type {
  ProvidersWorkforceTransactionContext,
  ProvidersWorkforceUnitOfWorkPort,
  WorkerSnapshot,
} from "./domain/provider-workforce.types.js";
import {
  fingerprintWorkforceCommand,
  WorkforcePolicyError,
} from "./domain/provider-workforce.policy.js";
import { resolveWorkforceLocale } from "./domain/provider-workforce-notification.policy.js";
import type { WorkerInvitationProofPort } from "./domain/worker-invitation-proof.policy.js";
import { mapWorkerSelfDto } from "./provider-workforce.dto.js";

export interface AcceptWorkerInvitationCommand {
  readonly principal: AuthenticationPrincipal;
  readonly invitationProof: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  /** Exact invitation row version returned by inspection. */
  readonly expectedVersion: number;
  readonly expectedWorkerVersion: number;
  readonly expectedAccessVersion: number;
  readonly operationalPhoneE164: string;
}

function invalidInvitation(): never {
  throw new WorkforcePolicyError("WORKER_INVITATION_INVALID");
}

function validateCommand(command: AcceptWorkerInvitationCommand): void {
  for (const value of [
    command.expectedVersion,
    command.expectedWorkerVersion,
    command.expectedAccessVersion,
  ]) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new WorkforcePolicyError("WORKFORCE_VALIDATION_FAILED", { field: "expectedVersion" });
    }
  }
  if (!/^\+[1-9][0-9]{7,14}$/u.test(command.operationalPhoneE164)) {
    throw new WorkforcePolicyError("WORKFORCE_PHONE_INVALID");
  }
  if (command.principal.status !== "ACTIVE") invalidInvitation();
  if (command.principal.verificationOnly
    && command.principal.invitationOnboardingOnly !== true) invalidInvitation();
}

function readReplayTarget(result: Readonly<Record<string, unknown>> | null): string {
  const targetId = result?.["targetId"];
  if (typeof targetId !== "string" || targetId.length === 0) {
    throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
  }
  return targetId;
}

export class ProviderWorkforceInvitationAcceptanceService {
  public constructor(private readonly dependencies: {
    readonly unitOfWork: ProvidersWorkforceUnitOfWorkPort;
    readonly invitationProof: WorkerInvitationProofPort;
    readonly now?: () => Date;
  }) {}

  public async accept(command: AcceptWorkerInvitationCommand) {
    validateCommand(command);
    const routing = this.dependencies.invitationProof.inspectRouting(command.invitationProof);
    if (routing === null) invalidInvitation();
    const now = this.dependencies.now?.() ?? new Date();
    if (await this.expireIfDue(command, routing, now)) invalidInvitation();

    return this.dependencies.unitOfWork.run(async (context) => {
      const routedWorker = await context.workforce.getWorkerForInvitation(routing.invitationId);
      if (routedWorker === null) invalidInvitation();
      const scopeKey = `provider:${routedWorker.providerId}:worker:${routedWorker.id}:invitation-accept`;
      const requestFingerprint = fingerprintWorkforceCommand({
        operation: "ACCEPT_WORKER_INVITATION",
        providerId: routedWorker.providerId,
        workerId: routedWorker.id,
        identityUserId: command.principal.userId,
        invitationId: routing.invitationId,
        invitationVersion: routing.invitationVersion,
        expectedVersion: command.expectedVersion,
        expectedWorkerVersion: command.expectedWorkerVersion,
        expectedAccessVersion: command.expectedAccessVersion,
        operationalPhoneE164: command.operationalPhoneE164,
      });
      const idempotency = await context.commands.begin({
        providerId: routedWorker.providerId,
        scopeKey,
        idempotencyKey: command.idempotencyKey,
        requestFingerprint,
        actorUserId: command.principal.userId,
      });
      if (idempotency.replay) {
        const replayed = await context.workforce.getWorker(
          routedWorker.providerId,
          readReplayTarget(idempotency.result),
        );
        if (replayed === null || replayed.identityUserId !== command.principal.userId) {
          throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
        }
        return mapWorkerSelfDto(replayed);
      }

      const locked = await this.lockAndValidate(context, command, routing, now, routedWorker);
      const identity = await context.identityReader.getIdentity(command.principal.userId);
      if (identity?.isAccountActive !== true
        || identity.status !== "ACTIVE"
        || identity.emailNormalized !== locked.invitation.emailNormalized) invalidInvitation();

      const currentClaim = await context.workforce.getCurrentWorkerByIdentity(command.principal.userId);
      if (currentClaim !== null && currentClaim.id !== locked.worker.id) {
        throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
      }
      const predecessor = await context.workforce.getLatestRemovedWorkerByIdentity(
        locked.worker.providerId,
        command.principal.userId,
      );

      const accepted = await context.workforce.acceptInvitation({
        actorUserId: command.principal.userId,
        providerId: locked.worker.providerId,
        requestId: command.requestId,
        idempotencyKey: command.idempotencyKey,
        workerId: locked.worker.id,
        invitationId: locked.invitation.id,
        expectedInvitationVersion: command.expectedVersion,
        expectedWorkerVersion: command.expectedWorkerVersion,
        expectedAccessVersion: command.expectedAccessVersion,
        identityUserId: command.principal.userId,
        predecessorWorkerId: predecessor?.id ?? null,
        operationalPhoneE164: command.operationalPhoneE164,
        acceptedLocale: locked.invitation.locale,
        acceptedAt: now,
      });
      await context.identityAuthority.reconcileWorkerRole({
        userId: command.principal.userId,
        shouldBeEnabled: true,
      });
      const primarySupervisorAssignments = await context.workforce
        .countPrimarySupervisorAssignments(command.principal.userId);
      await context.identityAuthority.reconcileProviderSupervisorRole({
        userId: command.principal.userId,
        shouldBeEnabled: primarySupervisorAssignments > 0,
      });
      const invitationHistory = await this.appendEvidence(
        context,
        command,
        locked.worker,
        locked.invitation.version,
        accepted.worker,
        accepted.invitation.version,
        accepted.invitation.id,
        predecessor,
      );
      const locale = resolveWorkforceLocale({
        preferredLanguage: identity.preferredLanguage,
        acceptedInvitationLocale: accepted.worker.acceptedInvitationLocale,
      });
      await context.notifications.insert({
        providerId: accepted.worker.providerId,
        template: "LOGIN_ACCESS_ACTIVATED",
        locale,
        recipientUserId: command.principal.userId,
        invitationId: accepted.invitation.id,
        historyId: invitationHistory.id,
        safeVariables: { workerVersion: accepted.worker.version },
        idempotencyKey: `worker-invitation:${accepted.invitation.id}:accepted`,
      });
      const result = {
        outcomeCode: "WORKER_INVITATION_ACCEPTED",
        targetId: accepted.worker.id,
        version: accepted.worker.version,
        impacts: [
          {
            targetType: "INVITATION",
            targetId: accepted.invitation.id,
            outcomeCode: "WORKER_INVITATION_ACCEPTED",
            version: accepted.invitation.version,
          },
          {
            targetType: "LOGIN_ACCESS",
            targetId: accepted.worker.id,
            outcomeCode: "WORKER_LOGIN_ACCESS_ACTIVATED",
            version: accepted.worker.access?.version ?? command.expectedAccessVersion + 1,
          },
          {
            targetType: "WORKER_PROFILE",
            targetId: accepted.worker.id,
            outcomeCode: "WORKER_OPERATIONAL_PHONE_REVIEWED",
            version: accepted.worker.profile.version,
          },
        ],
      } as const;
      await context.commands.accept({
        scopeKey,
        idempotencyKey: command.idempotencyKey,
        safeResultCode: result.outcomeCode,
        safeResult: result,
      });
      return mapWorkerSelfDto(accepted.worker);
    });
  }

  private async expireIfDue(
    command: AcceptWorkerInvitationCommand,
    routing: { readonly invitationId: string; readonly invitationVersion: number; readonly expiresAt: Date },
    now: Date,
  ): Promise<boolean> {
    return this.dependencies.unitOfWork.run(async (context) => {
      const routedWorker = await context.workforce.getWorkerForInvitation(routing.invitationId);
      if (routedWorker === null) return false;
      if (await context.workforce.lockProvider(routedWorker.providerId) === null) return false;
      const worker = await context.workforce.lockWorker(routedWorker.providerId, routedWorker.id);
      if (worker === null) return false;
      const invitation = await context.workforce.getInvitation(routing.invitationId);
      const latest = await context.workforce.getLatestInvitation(worker.id);
      const exactDueInvitation = invitation !== null
        && latest !== null
        && invitation.id === latest.id
        && invitation.workerId === worker.id
        && invitation.status === "PENDING"
        && invitation.invitationVersion === routing.invitationVersion
        && invitation.expiresAt.getTime() === routing.expiresAt.getTime()
        && invitation.expiresAt.getTime() <= now.getTime()
        && worker.endedAt === null
        && worker.access?.status === "INVITED"
        && worker.access.currentInvitationId === invitation.id;
      if (!exactDueInvitation || invitation === null || worker.access === null) return false;
      const transitioned = await context.workforce.transitionInvitation({
        providerId: worker.providerId,
        workerId: worker.id,
        invitationId: invitation.id,
        expectedInvitationVersion: invitation.version,
        expectedAccessVersion: worker.access.version,
        status: "EXPIRED",
        transitionedAt: now,
      });
      await context.history.append({
        providerId: worker.providerId,
        targetType: "INVITATION",
        targetId: invitation.id,
        targetVersion: transitioned.invitation.version,
        eventCode: "WORKER_INVITATION_EXPIRED",
        actorUserId: command.principal.userId,
        safeBefore: { status: invitation.status, version: invitation.version },
        safeAfter: { status: transitioned.invitation.status, version: transitioned.invitation.version },
        requestId: command.requestId,
      });
      await context.history.append({
        providerId: worker.providerId,
        targetType: "LOGIN_ACCESS",
        targetId: worker.id,
        targetVersion: transitioned.worker.access?.version ?? worker.access.version + 1,
        eventCode: "WORKER_LOGIN_ACCESS_EXPIRED",
        actorUserId: command.principal.userId,
        safeBefore: { status: worker.access.status, version: worker.access.version },
        safeAfter: {
          status: transitioned.worker.access?.status ?? "EXPIRED",
          version: transitioned.worker.access?.version ?? worker.access.version + 1,
        },
        requestId: command.requestId,
      });
      return true;
    });
  }

  private async lockAndValidate(
    context: ProvidersWorkforceTransactionContext,
    command: AcceptWorkerInvitationCommand,
    routing: { readonly invitationId: string; readonly invitationVersion: number; readonly expiresAt: Date },
    now: Date,
    routedWorker: WorkerSnapshot,
  ) {
    if (await context.workforce.lockProvider(routedWorker.providerId) === null) invalidInvitation();
    const worker = await context.workforce.lockWorker(routedWorker.providerId, routedWorker.id);
    if (worker === null) invalidInvitation();
    const invitation = await context.workforce.getInvitation(routing.invitationId);
    const latest = await context.workforce.getLatestInvitation(worker.id);
    if (invitation === null
      || latest === null
      || invitation.id !== latest.id
      || invitation.workerId !== worker.id
      || invitation.status !== "PENDING"
      || invitation.version !== command.expectedVersion
      || invitation.invitationVersion !== routing.invitationVersion
      || invitation.expiresAt.getTime() <= now.getTime()
      || invitation.expiresAt.getTime() !== routing.expiresAt.getTime()
      || worker.version !== command.expectedWorkerVersion
      || (worker.identityUserId !== null && worker.identityUserId !== command.principal.userId)
      || worker.endedAt !== null
      || worker.access?.status !== "INVITED"
      || worker.access.currentInvitationId !== invitation.id
      || worker.access.version !== command.expectedAccessVersion
      || !this.dependencies.invitationProof.verify(command.invitationProof, {
        invitationId: invitation.id,
        invitationVersion: invitation.invitationVersion,
        emailNormalized: invitation.emailNormalized,
        locale: invitation.locale,
        expiresAt: invitation.expiresAt,
      }, now)) invalidInvitation();
    return { worker, invitation };
  }

  private async appendEvidence(
    context: ProvidersWorkforceTransactionContext,
    command: AcceptWorkerInvitationCommand,
    before: WorkerSnapshot,
    beforeInvitationVersion: number,
    after: WorkerSnapshot,
    afterInvitationVersion: number,
    invitationId: string,
    predecessor: WorkerSnapshot | null,
  ) {
    const invitationHistory = await context.history.append({
      providerId: after.providerId,
      targetType: "INVITATION",
      targetId: invitationId,
      targetVersion: afterInvitationVersion,
      eventCode: "WORKER_INVITATION_ACCEPTED",
      actorUserId: command.principal.userId,
      safeBefore: { status: "PENDING", version: beforeInvitationVersion },
      safeAfter: { status: "ACCEPTED", version: afterInvitationVersion },
      requestId: command.requestId,
    });
    await context.history.append({
      providerId: after.providerId,
      targetType: "WORKER",
      targetId: after.id,
      targetVersion: after.version,
      eventCode: "WORKER_IDENTITY_LINKED",
      actorUserId: command.principal.userId,
      safeBefore: { status: before.status, version: before.version },
      safeAfter: {
        status: after.status,
        version: after.version,
        ...(after.acceptedInvitationLocale === null
          ? {}
          : { locale: after.acceptedInvitationLocale }),
      },
      requestId: command.requestId,
    });
    if (predecessor !== null) {
      await context.history.append({
        providerId: after.providerId,
        targetType: "WORKER",
        targetId: after.id,
        targetVersion: after.version,
        eventCode: "WORKER_REHIRED_LINKED",
        actorUserId: command.principal.userId,
        safeBefore: { predecessorWorkerId: null },
        safeAfter: { predecessorWorkerId: predecessor.id },
        requestId: command.requestId,
      });
    }
    await context.history.append({
      providerId: after.providerId,
      targetType: "WORKER_PROFILE",
      targetId: after.id,
      targetVersion: after.profile.version,
      eventCode: "WORKER_OPERATIONAL_PHONE_REVIEWED",
      actorUserId: command.principal.userId,
      safeBefore: { version: before.profile.version },
      safeAfter: { version: after.profile.version },
      requestId: command.requestId,
    });
    await context.history.append({
      providerId: after.providerId,
      targetType: "LOGIN_ACCESS",
      targetId: after.id,
      targetVersion: after.access?.version ?? 1,
      eventCode: "WORKER_LOGIN_ACCESS_ACTIVATED",
      actorUserId: command.principal.userId,
      safeBefore: { status: before.access?.status ?? "INVITED", version: before.access?.version ?? 1 },
      safeAfter: { status: after.access?.status ?? "ACTIVE", version: after.access?.version ?? 1 },
      requestId: command.requestId,
    });
    await context.audit.append({
      actorType: "USER",
      actorId: command.principal.userId,
      action: "providers.workforce.invitation.accept",
      targetType: "provider_worker_invitation",
      targetId: invitationId,
      context: {
        outcome: "SUCCEEDED",
        providerId: after.providerId,
        workerVersion: after.version,
        invitationVersion: afterInvitationVersion,
        accessVersion: after.access?.version ?? 1,
      },
      requestId: command.requestId,
    });
    return invitationHistory;
  }
}
