import type { AuthenticationPrincipal } from "../authentication/authentication.public.js";
import type { ProtectedOperationAuthorizer } from "../authentication/authentication.public.js";
import { PROVIDER_APPLICATIONS_REVIEW_OPERATION } from "./domain/provider-authorization.policy.js";
import {
  assertExpectedVersion,
} from "./domain/provider-lifecycle.policy.js";
import {
  assertRequestChangesReason,
  assertRequestChangesTransition,
} from "./domain/provider-request-changes.policy.js";
import {
  assertRejectionLeavesNoAuthorityEffects,
  assertRejectionReason,
  assertRejectionTransition,
} from "./domain/provider-rejection.policy.js";
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

function changesRequestedOutboxKey(
  providerId: string,
  reviewCycle: number,
): string {
  return `provider:${providerId}:CHANGES_REQUESTED:cycle:${reviewCycle}`;
}

function rejectedOutboxKey(providerId: string, reviewCycle: number): string {
  return `provider:${providerId}:REJECTED:cycle:${reviewCycle}`;
}

export interface ProviderReviewServiceDependencies {
  readonly unitOfWork: ProvidersUnitOfWorkPort;
  readonly providers: ProviderRepositoryPort;
  readonly authorization: ProtectedOperationAuthorizer;
  readonly identityReader: ProviderIdentityReaderPort;
  readonly applicantProfiles: ProviderApplicantProfileReaderPort;
  readonly denialAudit: ProviderDenialAuditPort;
  readonly projections: Pick<ProviderProjectionService, "computeProjections">;
}

/**
 * Staff request-changes and terminal rejection workflows (US7 / US8).
 */
export class ProviderReviewService {
  public constructor(
    private readonly dependencies: ProviderReviewServiceDependencies,
  ) {}

  public async requestChanges(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly reason: string;
    readonly expectedVersion: number;
    readonly requestId?: string;
  }): Promise<{ readonly aggregate: ProviderPrivateAggregateDto }> {
    assertExpectedVersion(input.expectedVersion);
    const reason = assertRequestChangesReason(input.reason);
    await this.assertStaffReviewPermission(
      input.principal,
      "providers.applications.request_changes",
      input.requestId,
    );

    const updated = await this.dependencies.unitOfWork.run(async (context) => {
      const locked = await context.providers.lockById(input.providerId);
      if (locked === null) {
        throw providersError("PROVIDER_NOT_FOUND");
      }
      assertRequestChangesTransition(
        locked.applicationStatus,
        "CHANGES_REQUESTED",
      );
      if (locked.version !== input.expectedVersion) {
        throw providersError("PROVIDER_VERSION_CONFLICT");
      }

      const now = new Date();
      const provider = await context.providers.updateLifecycle({
        providerId: locked.id,
        expectedVersion: input.expectedVersion,
        applicationStatus: "CHANGES_REQUESTED",
        applicationChangedAt: now,
      });

      const history = await context.providers.appendStatusHistory({
        providerId: provider.id,
        domain: "APPLICATION",
        fromApplicationStatus: locked.applicationStatus,
        toApplicationStatus: "CHANGES_REQUESTED",
        reviewCycle: locked.reviewCycle,
        actorUserId: input.principal.userId,
        reason,
        requestId: input.requestId ?? null,
      });

      await context.privilegedAudit.append({
        actorType: "USER",
        actorId: input.principal.userId,
        action: "providers.applications.request_changes",
        targetType: "provider",
        targetId: provider.id,
        reason: "CHANGES_REQUESTED",
        context: {
          outcome: "SUCCEEDED",
          reviewCycle: locked.reviewCycle,
          fromApplicationStatus: locked.applicationStatus,
          toApplicationStatus: "CHANGES_REQUESTED",
        },
        ...(input.requestId === undefined
          ? {}
          : { requestId: input.requestId }),
      });

      await context.emailOutbox.insertIntent({
        providerId: provider.id,
        template: "CHANGES_REQUESTED",
        recipientUserId: locked.applicationOwnerUserId,
        idempotencyKey: changesRequestedOutboxKey(
          provider.id,
          locked.reviewCycle,
        ),
        reviewCycle: locked.reviewCycle,
        statusHistoryId: history.id,
      });

      return provider;
    });

    return { aggregate: await this.buildAggregate(updated) };
  }

  public async rejectApplication(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly reason: string;
    readonly expectedVersion: number;
    readonly requestId?: string;
  }): Promise<{ readonly aggregate: ProviderPrivateAggregateDto }> {
    assertExpectedVersion(input.expectedVersion);
    const reason = assertRejectionReason(input.reason);
    await this.assertStaffReviewPermission(
      input.principal,
      "providers.applications.reject",
      input.requestId,
    );

    const updated = await this.dependencies.unitOfWork.run(async (context) => {
      const locked = await context.providers.lockById(input.providerId);
      if (locked === null) {
        throw providersError("PROVIDER_NOT_FOUND");
      }
      assertRejectionTransition(locked.applicationStatus, "REJECTED");
      if (locked.version !== input.expectedVersion) {
        throw providersError("PROVIDER_VERSION_CONFLICT");
      }

      const now = new Date();
      const provider = await context.providers.updateLifecycle({
        providerId: locked.id,
        expectedVersion: input.expectedVersion,
        applicationStatus: "REJECTED",
        applicationChangedAt: now,
        rejectedAt: now,
      });

      const history = await context.providers.appendStatusHistory({
        providerId: provider.id,
        domain: "APPLICATION",
        fromApplicationStatus: locked.applicationStatus,
        toApplicationStatus: "REJECTED",
        reviewCycle: locked.reviewCycle,
        actorUserId: input.principal.userId,
        reason,
        requestId: input.requestId ?? null,
      });

      await context.privilegedAudit.append({
        actorType: "USER",
        actorId: input.principal.userId,
        action: "providers.applications.reject",
        targetType: "provider",
        targetId: provider.id,
        reason: "APPLICATION_REJECTED",
        context: {
          outcome: "SUCCEEDED",
          reviewCycle: locked.reviewCycle,
          fromApplicationStatus: locked.applicationStatus,
          toApplicationStatus: "REJECTED",
        },
        ...(input.requestId === undefined
          ? {}
          : { requestId: input.requestId }),
      });

      await context.emailOutbox.insertIntent({
        providerId: provider.id,
        template: "REJECTED",
        recipientUserId: locked.applicationOwnerUserId,
        idempotencyKey: rejectedOutboxKey(provider.id, locked.reviewCycle),
        reviewCycle: locked.reviewCycle,
        statusHistoryId: history.id,
      });

      const members = await context.providers.listMembers(provider.id);
      if (members.length !== 0) {
        throw providersError("PROVIDER_STATE_CONFLICT", {
          domain: "APPLICATION",
          reason: "REJECTION_MUST_NOT_CREATE_AUTHORITY",
        });
      }

      return provider;
    });

    const identity = await this.dependencies.identityReader.getEligibilityFacts(
      updated.applicationOwnerUserId,
    );
    assertRejectionLeavesNoAuthorityEffects({
      memberCount: 0,
      invitationCount: 0,
      hasProviderOwnerCategory:
        identity?.verifiedCategories.includes("PROVIDER_OWNER") ?? false,
      providerAdminEnabled: identity?.providerAdminEnabled ?? false,
    });

    return { aggregate: await this.buildAggregate(updated) };
  }

  private async assertStaffReviewPermission(
    principal: AuthenticationPrincipal,
    action: string,
    requestId?: string,
  ): Promise<void> {
    const decision =
      await this.dependencies.authorization.authorizeProtectedOperation({
        principal,
        operationId: PROVIDER_APPLICATIONS_REVIEW_OPERATION,
        scope: { kind: "GLOBAL" },
      });
    if (decision.allowed) {
      return;
    }
    await this.dependencies.denialAudit.append({
      actorType: "USER",
      actorId: principal.userId,
      action,
      targetType: "provider_application",
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
        actorRelationship: "APPLICATION_OWNER",
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
