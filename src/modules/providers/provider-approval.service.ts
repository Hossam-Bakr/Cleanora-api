import type { AuthenticationPrincipal } from "../authentication/authentication.public.js";
import type { ProtectedOperationAuthorizer } from "../authentication/authentication.public.js";
import {
  assertApprovalLeavesInactive,
  assertCompleteApprovalOutcomeOrIntegrity,
  isCompleteApprovalOutcome,
} from "./domain/provider-approval.policy.js";
import { PROVIDER_APPLICATIONS_REVIEW_OPERATION } from "./domain/provider-authorization.policy.js";
import { requiredCategoryForProviderKind } from "./domain/provider-eligibility.policy.js";
import {
  assertApplicationTransition,
  assertExpectedVersion,
} from "./domain/provider-lifecycle.policy.js";
import { providersError } from "./domain/providers.errors.js";
import type {
  ProviderApplicantProfileReaderPort,
  ProviderDenialAuditPort,
  ProviderEmailOutboxRepositoryPort,
  ProviderIdentityReaderPort,
  ProviderRepositoryPort,
  ProvidersUnitOfWorkPort,
} from "./domain/providers.ports.js";
import type { ProviderRecord } from "./domain/providers.types.js";
import type { ProviderProjectionService } from "./provider-projection.service.js";
import {
  mapApplicantContext,
  mapPrivateAggregate,
  mapProviderSummary,
  type ProviderPrivateAggregateDto,
} from "./provider.dto.js";

function approvalOutboxIdempotencyKey(
  providerId: string,
  reviewCycle: number,
): string {
  return `provider:${providerId}:APPROVED:cycle:${reviewCycle}`;
}

export interface ProviderApprovalServiceDependencies {
  readonly unitOfWork: ProvidersUnitOfWorkPort;
  readonly providers: ProviderRepositoryPort;
  readonly emailOutbox: ProviderEmailOutboxRepositoryPort;
  readonly authorization: ProtectedOperationAuthorizer;
  readonly identityReader: ProviderIdentityReaderPort;
  readonly applicantProfiles: ProviderApplicantProfileReaderPort;
  readonly denialAudit: ProviderDenialAuditPort;
  readonly projections: Pick<ProviderProjectionService, "computeProjections">;
}

export interface ApproveProviderApplicationResult {
  readonly approved: boolean;
  readonly aggregate: ProviderPrivateAggregateDto;
}

/**
 * Atomic Staff approval: APPROVED + OWNER authority + membership + history +
 * privileged audit + APPROVED outbox, leaving operationalStatus INACTIVE.
 */
export class ProviderApprovalService {
  public constructor(
    private readonly dependencies: ProviderApprovalServiceDependencies,
  ) {}

  public async approveApplication(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly expectedVersion: number;
    readonly requestId?: string;
  }): Promise<ApproveProviderApplicationResult> {
    assertExpectedVersion(input.expectedVersion);
    await this.assertStaffReviewPermission(input.principal, input.requestId);

    const existing = await this.dependencies.providers.findById(
      input.providerId,
    );
    if (existing === null) {
      throw providersError("PROVIDER_NOT_FOUND");
    }

    if (existing.applicationStatus === "APPROVED") {
      const matching = await this.readCompleteOutcome(existing);
      assertCompleteApprovalOutcomeOrIntegrity(matching.facts);
      return {
        approved: false,
        aggregate: matching.aggregate,
      };
    }

    if (existing.version !== input.expectedVersion) {
      throw providersError("PROVIDER_VERSION_CONFLICT");
    }

    const identity = await this.dependencies.identityReader.getEligibilityFacts(
      existing.applicationOwnerUserId,
    );
    if (identity === null || !identity.active) {
      throw providersError("PROVIDER_ELIGIBILITY_DENIED", {
        reason: "OWNER_IDENTITY_UNAVAILABLE",
      });
    }
    const required = requiredCategoryForProviderKind(existing.kind);
    if (!identity.verifiedCategories.includes(required)) {
      throw providersError("PROVIDER_ELIGIBILITY_DENIED", {
        reason: "OWNER_CATEGORY_MISMATCH",
      });
    }
    const applicant =
      await this.dependencies.applicantProfiles.getMatchingApplicantContext({
        userId: existing.applicationOwnerUserId,
        providerKind: existing.kind,
      });
    if (!applicant?.profileComplete) {
      throw providersError("PROVIDER_ELIGIBILITY_DENIED", {
        reason: "OWNER_PROFILE_INCOMPLETE",
      });
    }

    const approved = await this.dependencies.unitOfWork.run(async (context) => {
      const locked = await context.providers.lockById(input.providerId);
      if (locked === null) {
        throw providersError("PROVIDER_NOT_FOUND");
      }

      if (locked.applicationStatus === "APPROVED") {
        // Completeness is verified after commit on a non-TX connection so the
        // pool-max=2 interactive transaction never opens nested clients.
        return { outcome: "existing" as const, provider: locked };
      }

      if (locked.version !== input.expectedVersion) {
        throw providersError("PROVIDER_VERSION_CONFLICT");
      }

      const staffDecision =
        await context.authorization.authorizeProtectedOperation({
          principal: input.principal,
          operationId: PROVIDER_APPLICATIONS_REVIEW_OPERATION,
          scope: { kind: "GLOBAL" },
        });
      if (!staffDecision.allowed) {
        throw providersError("PROVIDER_ACCESS_DENIED");
      }
      const currentIdentity =
        await context.identityReader.getEligibilityFacts(
          locked.applicationOwnerUserId,
        );
      const currentRequired = requiredCategoryForProviderKind(locked.kind);
      const currentApplicant =
        await context.applicantProfiles.getMatchingApplicantContext({
          userId: locked.applicationOwnerUserId,
          providerKind: locked.kind,
        });
      if (
        currentIdentity === null ||
        !currentIdentity.active ||
        !currentIdentity.verifiedCategories.includes(currentRequired) ||
        currentApplicant?.profileComplete !== true
      ) {
        throw providersError("PROVIDER_ELIGIBILITY_DENIED", {
          reason: "OWNER_ELIGIBILITY_CHANGED",
        });
      }

      assertApplicationTransition(locked.applicationStatus, "APPROVED");

      assertApprovalLeavesInactive(locked.operationalStatus);
      const now = new Date();
      const updated = await context.providers.updateLifecycle({
        providerId: locked.id,
        expectedVersion: input.expectedVersion,
        applicationStatus: "APPROVED",
        operationalStatus: "INACTIVE",
        ownerUserId: locked.applicationOwnerUserId,
        applicationChangedAt: now,
        approvedAt: now,
      });
      assertApprovalLeavesInactive(updated.operationalStatus);

      const history = await context.providers.appendStatusHistory({
        providerId: updated.id,
        domain: "APPLICATION",
        fromApplicationStatus: locked.applicationStatus,
        toApplicationStatus: "APPROVED",
        reviewCycle: locked.reviewCycle,
        actorUserId: input.principal.userId,
        reason: "APPLICATION_APPROVED",
        requestId: input.requestId ?? null,
      });

      await context.providers.lockAuthorityReconciliationForUser(
        locked.applicationOwnerUserId,
      );

      await context.identityAuthority.grantOwnerAuthority(
        locked.applicationOwnerUserId,
      );

      await context.providers.upsertMember({
        providerId: updated.id,
        userId: locked.applicationOwnerUserId,
        level: "OWNER",
        status: "ACTIVE",
        invitedByUserId: null,
        enabledAt: now,
        disabledAt: null,
      });

      await context.privilegedAudit.append({
        actorType: "USER",
        actorId: input.principal.userId,
        action: "providers.applications.approve",
        targetType: "provider",
        targetId: updated.id,
        reason: "APPLICATION_APPROVED",
        context: {
          outcome: "SUCCEEDED",
          reviewCycle: locked.reviewCycle,
          fromApplicationStatus: locked.applicationStatus,
          toApplicationStatus: "APPROVED",
          operationalStatus: updated.operationalStatus,
        },
        ...(input.requestId === undefined
          ? {}
          : { requestId: input.requestId }),
      });

      await context.emailOutbox.insertIntent({
        providerId: updated.id,
        template: "APPROVED",
        recipientUserId: locked.applicationOwnerUserId,
        idempotencyKey: approvalOutboxIdempotencyKey(
          updated.id,
          locked.reviewCycle,
        ),
        reviewCycle: locked.reviewCycle,
        statusHistoryId: history.id,
      });

      return { outcome: "approved" as const, provider: updated };
    });

    if (approved.outcome === "existing") {
      const matching = await this.readCompleteOutcome(approved.provider);
      assertCompleteApprovalOutcomeOrIntegrity(matching.facts);
      return {
        approved: false,
        aggregate: matching.aggregate,
      };
    }

    const aggregate = await this.buildAggregate(approved.provider);
    return {
      approved: true,
      aggregate,
    };
  }

  private async assertStaffReviewPermission(
    principal: AuthenticationPrincipal,
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
      action: "providers.applications.approve",
      targetType: "provider_application",
      outcome: "DENIED",
      reason: decision.denialCode ?? "PERMISSION_DENIED",
      ...(requestId === undefined ? {} : { requestId }),
    });
    throw providersError("PROVIDER_ACCESS_DENIED");
  }

  private async readCompleteOutcome(provider: ProviderRecord): Promise<{
    readonly facts: Parameters<typeof isCompleteApprovalOutcome>[0];
    readonly aggregate: ProviderPrivateAggregateDto;
  }> {
    const [identity, member, history, outboxIntent] = await Promise.all([
      this.dependencies.identityReader.getEligibilityFacts(
        provider.applicationOwnerUserId,
      ),
      this.dependencies.providers.findMember({
        providerId: provider.id,
        userId: provider.applicationOwnerUserId,
      }),
      this.dependencies.providers.listStatusHistory({
        providerId: provider.id,
        limit: 50,
      }),
      this.dependencies.emailOutbox.findByIdempotencyKey(
        approvalOutboxIdempotencyKey(provider.id, provider.reviewCycle),
      ),
    ]);

    const facts = {
      applicationStatus: provider.applicationStatus,
      operationalStatus: provider.operationalStatus,
      ownerUserId: provider.ownerUserId,
      hasProviderOwnerCategory:
        identity?.verifiedCategories.includes("PROVIDER_OWNER") ?? false,
      providerAdminEnabled: identity?.providerAdminEnabled ?? false,
      hasActiveOwnerMembership:
        member !== null &&
        member.level === "OWNER" &&
        member.status === "ACTIVE",
      hasApprovedHistoryForCycle: history.some(
        (row) =>
          row.reviewCycle === provider.reviewCycle &&
          row.toApplicationStatus === "APPROVED",
      ),
      hasApprovedOutboxIntent: outboxIntent !== null,
    };

    return {
      facts,
      aggregate: await this.buildAggregate(provider),
    };
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
