import type { AuthenticationPrincipal } from "../authentication/authentication.public.js";
import type { ProtectedOperationAuthorizer } from "../authentication/authentication.public.js";
import { PROVIDER_LIFECYCLE_MANAGE_OPERATION } from "./domain/provider-authorization.policy.js";
import {
  assertApprovedForOperationalLifecycle,
  assertExpectedVersion,
  assertOperationalDecisionReason,
  assertOperationalTransition,
  reinstateOperationalTarget,
} from "./domain/provider-lifecycle.policy.js";
import { providersError } from "./domain/providers.errors.js";
import type {
  ProviderApplicantProfileReaderPort,
  ProviderDenialAuditPort,
  ProviderIdentityReaderPort,
  ProviderRepositoryPort,
  ProvidersUnitOfWorkPort,
} from "./domain/providers.ports.js";
import type { ProviderRecord } from "./domain/providers.types.js";
import {
  mapApplicantContext,
  mapPrivateAggregate,
  mapProviderSummary,
  type ProviderPrivateAggregateDto,
} from "./provider.dto.js";
import type { ProviderProjectionService } from "./provider-projection.service.js";

function suspendedOutboxKey(providerId: string, version: number): string {
  return `provider:${providerId}:SUSPENDED:v${version}`;
}

function reinstatedOutboxKey(providerId: string, version: number): string {
  return `provider:${providerId}:REINSTATED:v${version}`;
}

export interface ProviderLifecycleServiceDependencies {
  readonly unitOfWork: ProvidersUnitOfWorkPort;
  readonly providers: ProviderRepositoryPort;
  readonly authorization: ProtectedOperationAuthorizer;
  readonly identityReader: ProviderIdentityReaderPort;
  readonly applicantProfiles: ProviderApplicantProfileReaderPort;
  readonly denialAudit: ProviderDenialAuditPort;
  readonly projections: Pick<ProviderProjectionService, "computeProjections">;
}

/**
 * Staff-only reasoned operational suspend/reinstate (FR-019, FR-021, FR-028–FR-030).
 * Reinstatement always targets INACTIVE and never LIVE (SC-009).
 */
export class ProviderLifecycleService {
  public constructor(
    private readonly dependencies: ProviderLifecycleServiceDependencies,
  ) {}

  /**
   * Suspend an approved INACTIVE Provider: history, audit, SUSPENDED outbox.
   * OWNER/ADMIN management/remediation remains available while SUSPENDED.
   */
  public async suspendProvider(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly reason: string;
    readonly expectedVersion: number;
    readonly requestId?: string;
  }): Promise<{ readonly aggregate: ProviderPrivateAggregateDto }> {
    assertExpectedVersion(input.expectedVersion);
    const reason = assertOperationalDecisionReason(input.reason);
    await this.assertLifecyclePermission(
      input.principal,
      "providers.lifecycle.suspend",
      input.requestId,
    );

    const updated = await this.dependencies.unitOfWork.run(async (context) => {
      const locked = await context.providers.lockById(input.providerId);
      if (locked === null) {
        throw providersError("PROVIDER_NOT_FOUND");
      }
      assertApprovedForOperationalLifecycle(locked.applicationStatus);
      assertOperationalTransition(locked.operationalStatus, "SUSPENDED");
      if (locked.version !== input.expectedVersion) {
        throw providersError("PROVIDER_VERSION_CONFLICT");
      }

      const now = new Date();
      const provider = await context.providers.updateLifecycle({
        providerId: locked.id,
        expectedVersion: input.expectedVersion,
        operationalStatus: "SUSPENDED",
        operationalChangedAt: now,
        suspendedAt: now,
      });

      const history = await context.providers.appendStatusHistory({
        providerId: provider.id,
        domain: "OPERATIONAL",
        fromOperationalStatus: locked.operationalStatus,
        toOperationalStatus: "SUSPENDED",
        reviewCycle: locked.reviewCycle,
        actorUserId: input.principal.userId,
        reason,
        requestId: input.requestId ?? null,
      });

      await context.privilegedAudit.append({
        actorType: "USER",
        actorId: input.principal.userId,
        action: "providers.lifecycle.suspend",
        targetType: "provider",
        targetId: provider.id,
        reason: "PROVIDER_SUSPENDED",
        context: {
          outcome: "SUCCEEDED",
          fromOperationalStatus: locked.operationalStatus,
          toOperationalStatus: "SUSPENDED",
          applicationStatus: provider.applicationStatus,
        },
        ...(input.requestId === undefined
          ? {}
          : { requestId: input.requestId }),
      });

      await context.emailOutbox.insertIntent({
        providerId: provider.id,
        template: "SUSPENDED",
        recipientUserId: locked.applicationOwnerUserId,
        idempotencyKey: suspendedOutboxKey(provider.id, locked.version),
        reviewCycle: locked.reviewCycle,
        statusHistoryId: history.id,
      });

      return provider;
    });

    return { aggregate: await this.buildAggregate(updated) };
  }

  /**
   * Reinstate a SUSPENDED Provider to INACTIVE only — never LIVE (SC-009).
   */
  public async reinstateProvider(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly reason: string;
    readonly expectedVersion: number;
    readonly requestId?: string;
  }): Promise<{ readonly aggregate: ProviderPrivateAggregateDto }> {
    assertExpectedVersion(input.expectedVersion);
    const reason = assertOperationalDecisionReason(input.reason);
    await this.assertLifecyclePermission(
      input.principal,
      "providers.lifecycle.reinstate",
      input.requestId,
    );

    const target = reinstateOperationalTarget();
    const updated = await this.dependencies.unitOfWork.run(async (context) => {
      const locked = await context.providers.lockById(input.providerId);
      if (locked === null) {
        throw providersError("PROVIDER_NOT_FOUND");
      }
      assertApprovedForOperationalLifecycle(locked.applicationStatus);
      assertOperationalTransition(locked.operationalStatus, target);
      if (locked.version !== input.expectedVersion) {
        throw providersError("PROVIDER_VERSION_CONFLICT");
      }

      const now = new Date();
      const provider = await context.providers.updateLifecycle({
        providerId: locked.id,
        expectedVersion: input.expectedVersion,
        operationalStatus: target,
        operationalChangedAt: now,
        suspendedAt: null,
      });

      if (provider.operationalStatus === "LIVE") {
        throw providersError("PROVIDER_STATE_CONFLICT", {
          domain: "OPERATIONAL",
          reason: "REINSTATE_MUST_NOT_SET_LIVE",
        });
      }

      const history = await context.providers.appendStatusHistory({
        providerId: provider.id,
        domain: "OPERATIONAL",
        fromOperationalStatus: locked.operationalStatus,
        toOperationalStatus: target,
        reviewCycle: locked.reviewCycle,
        actorUserId: input.principal.userId,
        reason,
        requestId: input.requestId ?? null,
      });

      await context.privilegedAudit.append({
        actorType: "USER",
        actorId: input.principal.userId,
        action: "providers.lifecycle.reinstate",
        targetType: "provider",
        targetId: provider.id,
        reason: "PROVIDER_REINSTATED",
        context: {
          outcome: "SUCCEEDED",
          fromOperationalStatus: locked.operationalStatus,
          toOperationalStatus: target,
          applicationStatus: provider.applicationStatus,
        },
        ...(input.requestId === undefined
          ? {}
          : { requestId: input.requestId }),
      });

      await context.emailOutbox.insertIntent({
        providerId: provider.id,
        template: "REINSTATED",
        recipientUserId: locked.applicationOwnerUserId,
        idempotencyKey: reinstatedOutboxKey(provider.id, locked.version),
        reviewCycle: locked.reviewCycle,
        statusHistoryId: history.id,
      });

      return provider;
    });

    return { aggregate: await this.buildAggregate(updated) };
  }

  private async assertLifecyclePermission(
    principal: AuthenticationPrincipal,
    action: string,
    requestId?: string,
  ): Promise<void> {
    const decision =
      await this.dependencies.authorization.authorizeProtectedOperation({
        principal,
        operationId: PROVIDER_LIFECYCLE_MANAGE_OPERATION,
        scope: { kind: "GLOBAL" },
      });
    if (decision.allowed) {
      return;
    }
    await this.dependencies.denialAudit.append({
      actorType: "USER",
      actorId: principal.userId,
      action,
      targetType: "provider",
      outcome: "DENIED",
      reason: decision.denialCode ?? "PERMISSION_DENIED",
      ...(requestId === undefined ? {} : { requestId }),
    });
    throw providersError("PROVIDER_ACCESS_DENIED");
  }

  private async buildAggregate(
    provider: ProviderRecord,
  ): Promise<ProviderPrivateAggregateDto> {
    const [profile, applicant] = await Promise.all([
      this.dependencies.providers.getProfile(provider.id),
      this.dependencies.applicantProfiles.getMatchingApplicantContext({
        userId: provider.applicationOwnerUserId,
        providerKind: provider.kind,
      }),
    ]);
    const { completion, readiness } =
      await this.dependencies.projections.computeProjections(provider);

    return mapPrivateAggregate({
      summary: mapProviderSummary({
        provider,
        profile,
        actorRelationship: "OWNER",
        completionPercentage: completion.percentage,
      }),
      applicantContext: mapApplicantContext({
        category:
          applicant?.category ??
          (provider.kind === "INDIVIDUAL_TEAM" ? "INDIVIDUAL" : "COMPANY"),
        individualFullName: applicant?.individualFullName ?? null,
        companyName: applicant?.companyName ?? null,
        representativeFullName: applicant?.representativeFullName ?? null,
      }),
      completion,
      readiness,
    });
  }
}
