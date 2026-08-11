import type { AuthenticationPrincipal } from "../authentication/authentication.public.js";
import {
  canChangeProviderKind,
  evaluateProviderEligibility,
  requiredCategoryForProviderKind,
} from "./domain/provider-eligibility.policy.js";
import { assertExpectedVersion } from "./domain/provider-lifecycle.policy.js";
import {
  canReadProviderProjections,
  resolveActorRelationship,
  type ProviderActorRelationship,
} from "./domain/provider-authorization.policy.js";
import {
  assertCanSubmitApplication,
  evaluateSubmissionBlockers,
  nextReviewCycle,
} from "./domain/provider-submission.policy.js";
import { providersError } from "./domain/providers.errors.js";
import type {
  ProviderApplicantProfileReaderPort,
  ProviderDenialAuditPort,
  ProviderIdentityReaderPort,
  ProviderMediaReaderPort,
  ProviderRepositoryPort,
  ProvidersUnitOfWorkPort,
} from "./domain/providers.ports.js";
import type {
  ProviderKind,
  ProviderRecord,
} from "./domain/providers.types.js";
import {
  mapApplicantContext,
  mapEligibilityDenial,
  mapPrivateAggregate,
  mapProviderSummary,
  type ProviderPrivateAggregateDto,
  type ProviderSummaryDto,
} from "./provider.dto.js";
import { ProviderDenialAuditService } from "./provider-denial-audit.service.js";

function isPrismaUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

function submissionOutboxIdempotencyKey(
  providerId: string,
  reviewCycle: number,
): string {
  return `provider:${providerId}:APPLICATION_SUBMITTED:cycle:${reviewCycle}`;
}

export interface ProviderApplicationServiceDependencies {
  readonly unitOfWork: ProvidersUnitOfWorkPort;
  /** Non-transactional reads (listing/get outside write TX). */
  readonly providers: ProviderRepositoryPort;
  readonly identityReader: ProviderIdentityReaderPort;
  readonly applicantProfiles: ProviderApplicantProfileReaderPort;
  readonly denialAudit: ProviderDenialAuditPort;
  readonly mediaReader: ProviderMediaReaderPort;
  readonly projections: Pick<
    import("./provider-projection.service.js").ProviderProjectionService,
    "collectCompletionFacts" | "computeProjections"
  >;
}

export interface CreateProviderApplicationResult {
  readonly created: boolean;
  readonly aggregate: ProviderPrivateAggregateDto;
}

export interface SubmitProviderApplicationResult {
  readonly submitted: boolean;
  readonly aggregate: ProviderPrivateAggregateDto;
}

type CreateTransactionResult =
  | { readonly outcome: "created"; readonly provider: ProviderRecord }
  | { readonly outcome: "existing"; readonly provider: ProviderRecord };

const DEFAULT_PROVIDER_LIST_LIMIT = 20;
const MAX_PROVIDER_LIST_LIMIT = 100;

function encodeProviderListCursor(provider: ProviderRecord): string {
  return Buffer.from(
    JSON.stringify({ updatedAt: provider.updatedAt.toISOString(), id: provider.id }),
    "utf8",
  ).toString("base64url");
}

function decodeProviderListCursor(raw: string): {
  readonly updatedAt: Date;
  readonly id: string;
} {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as {
      readonly updatedAt?: unknown;
      readonly id?: unknown;
    };
    if (typeof parsed.updatedAt !== "string" || typeof parsed.id !== "string") {
      throw new Error("invalid");
    }
    const updatedAt = new Date(parsed.updatedAt);
    if (Number.isNaN(updatedAt.getTime()) || parsed.id.length === 0) {
      throw new Error("invalid");
    }
    return { updatedAt, id: parsed.id };
  } catch {
    throw providersError("VALIDATION_ERROR", { field: "cursor" });
  }
}

/**
 * Application Owner draft create/list/get, kind change, and submit/resubmit.
 */
export class ProviderApplicationService {
  private readonly denialAudit: ProviderDenialAuditService;

  public constructor(
    private readonly dependencies: ProviderApplicationServiceDependencies,
  ) {
    this.denialAudit = new ProviderDenialAuditService(
      this.dependencies.denialAudit,
    );
  }

  public async createApplication(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerKind: ProviderKind;
    readonly requestId?: string;
  }): Promise<CreateProviderApplicationResult> {
    const existing =
      await this.dependencies.providers.findByApplicationOwnerUserId(
        input.principal.userId,
      );
    if (existing !== null) {
      return this.resolveExistingCreate({
        existing,
        requestedKind: input.providerKind,
        principal: input.principal,
      });
    }

    await this.assertCurrentEligibility({
      userId: input.principal.userId,
      providerKind: input.providerKind,
      action: "providers.application.create",
      ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
    });

    try {
      const result = await this.dependencies.unitOfWork.run(
        async (context): Promise<CreateTransactionResult> => {
          const raced =
            await context.providers.findByApplicationOwnerUserId(
              input.principal.userId,
            );
          if (raced !== null) {
            return { outcome: "existing", provider: raced };
          }
          await this.assertTransactionalEligibility({
            userId: input.principal.userId,
            providerKind: input.providerKind,
            identityReader: context.identityReader,
            applicantProfiles: context.applicantProfiles,
          });

          const created = await context.providers.create({
            applicationOwnerUserId: input.principal.userId,
            kind: input.providerKind,
          });

          await context.providers.appendStatusHistory({
            providerId: created.id,
            domain: "APPLICATION",
            fromApplicationStatus: "DRAFT",
            toApplicationStatus: "DRAFT",
            actorUserId: input.principal.userId,
            reason: "APPLICATION_CREATED",
            requestId: input.requestId ?? null,
          });

          await context.generalAudit.append({
            actorType: "USER",
            actorId: input.principal.userId,
            action: "providers.application.create",
            targetType: "provider",
            targetId: created.id,
            context: {
              outcome: "SUCCEEDED",
              providerKind: input.providerKind,
            },
            ...(input.requestId === undefined
              ? {}
              : { requestId: input.requestId }),
          });

          const members = await context.providers.listMembers(created.id);
          if (members.length > 0 || created.ownerUserId !== null) {
            throw providersError("PROVIDER_STATE_CONFLICT", {
              reason: "UNEXPECTED_MEMBERSHIP_ON_CREATE",
            });
          }

          return { outcome: "created", provider: created };
        },
      );

      if (result.outcome === "existing") {
        return this.resolveExistingCreate({
          existing: result.provider,
          requestedKind: input.providerKind,
          principal: input.principal,
        });
      }

      return {
        created: true,
        aggregate: await this.buildAggregate({
          provider: result.provider,
          actorUserId: input.principal.userId,
        }),
      };
    } catch (error) {
      if (!isPrismaUniqueViolation(error)) {
        throw error;
      }
      const afterRace =
        await this.dependencies.providers.findByApplicationOwnerUserId(
          input.principal.userId,
        );
      if (afterRace === null) {
        throw providersError("PROVIDER_DEPENDENCY_UNAVAILABLE");
      }
      return this.resolveExistingCreate({
        existing: afterRace,
        requestedKind: input.providerKind,
        principal: input.principal,
      });
    }
  }

  public async listOwnProviders(input: {
    readonly principal: AuthenticationPrincipal;
    readonly cursor?: string;
    readonly limit?: number;
  }): Promise<{
    readonly items: readonly ProviderSummaryDto[];
    readonly nextCursor: string | null;
  }> {
    const limit = Math.min(
      Math.max(input.limit ?? DEFAULT_PROVIDER_LIST_LIMIT, 1),
      MAX_PROVIDER_LIST_LIMIT,
    );
    const cursor =
      input.cursor === undefined ? undefined : decodeProviderListCursor(input.cursor);
    const identity = await this.dependencies.identityReader.getEligibilityFacts(
      input.principal.userId,
    );
    const candidates =
      await this.dependencies.providers.listVisibleCandidatesForUser({
        userId: input.principal.userId,
        includeMemberships: identity?.providerAdminEnabled ?? false,
        limit: limit + 1,
        ...(cursor === undefined
          ? {}
          : { cursorUpdatedAt: cursor.updatedAt, cursorId: cursor.id }),
      });
    const page = candidates.slice(0, limit);
    const items: ProviderSummaryDto[] = [];
    for (const provider of page) {
      const access = await this.readAccess(provider, input.principal.userId);
      if (!access.allowed) continue;
      const aggregate = await this.buildAggregate({
        provider,
        actorUserId: provider.applicationOwnerUserId,
        actorRelationship: access.relationship,
      });
      items.push(aggregate.provider);
    }
    return {
      items,
      nextCursor:
        candidates.length > limit && page.length > 0
          ? encodeProviderListCursor(page.at(-1)!)
          : null,
    };
  }

  public async getProvider(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
  }): Promise<ProviderPrivateAggregateDto> {
    const provider = await this.dependencies.providers.findById(
      input.providerId,
    );
    if (provider === null) {
      return this.denialAudit.denyAsUnavailable({
        actorUserId: input.principal.userId,
        action: "providers.application.get",
        reason: "SCOPE_DENIED",
      });
    }
    const access = await this.readAccess(provider, input.principal.userId);
    if (!access.allowed) {
      return this.denialAudit.denyAsUnavailable({
        actorUserId: input.principal.userId,
        action: "providers.application.get",
        targetId: input.providerId,
        reason: "SCOPE_DENIED",
      });
    }
    return this.buildAggregate({
      provider,
      actorUserId: provider.applicationOwnerUserId,
      actorRelationship: access.relationship,
    });
  }

  private async readAccess(
    provider: ProviderRecord,
    actorUserId: string,
  ): Promise<
    | { readonly allowed: false }
    | {
        readonly allowed: true;
        readonly relationship: Extract<
          ProviderActorRelationship,
          "APPLICATION_OWNER" | "OWNER" | "ADMIN"
        >;
      }
  > {
    const [member, identity] = await Promise.all([
      this.dependencies.providers.findMember({
        providerId: provider.id,
        userId: actorUserId,
      }),
      this.dependencies.identityReader.getEligibilityFacts(actorUserId),
    ]);
    const facts = {
      actorUserId,
      actorActive: identity?.active === true,
      applicationOwnerUserId: provider.applicationOwnerUserId,
      membership:
        member === null ? null : { level: member.level, status: member.status },
      staffAdmin: false,
      providerAdminEnabled: identity?.providerAdminEnabled ?? false,
      applicationStatus: provider.applicationStatus,
      operationalStatus: provider.operationalStatus,
    } as const;
    if (!canReadProviderProjections(facts)) {
      return { allowed: false };
    }
    const relationship = resolveActorRelationship(facts);
    if (
      relationship !== "APPLICATION_OWNER" &&
      relationship !== "OWNER" &&
      relationship !== "ADMIN"
    ) {
      return { allowed: false };
    }
    return { allowed: true, relationship };
  }

  public async changeKind(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly providerKind: ProviderKind;
    readonly expectedVersion: number;
    readonly requestId?: string;
  }): Promise<ProviderPrivateAggregateDto> {
    assertExpectedVersion(input.expectedVersion);

    return this.dependencies.unitOfWork.run(async (context) => {
      const locked = await context.providers.lockById(input.providerId);
      if (locked?.applicationOwnerUserId !== input.principal.userId) {
        throw providersError("PROVIDER_NOT_FOUND");
      }

      const change = canChangeProviderKind({
        actorIsApplicationOwner: true,
        applicationStatus: locked.applicationStatus,
        firstSubmittedAt: locked.firstSubmittedAt,
        currentKind: locked.kind,
        requestedKind: input.providerKind,
      });

      if (!change.allowed) {
        throw providersError(
          change.denialCode === "PROVIDER_ACCESS_DENIED"
            ? "PROVIDER_ACCESS_DENIED"
            : "PROVIDER_STATE_CONFLICT",
          { reason: "KIND_CHANGE_NOT_ALLOWED" },
        );
      }

      if (change.unchanged === true) {
        return this.buildAggregate({
          provider: locked,
          actorUserId: input.principal.userId,
          providers: context.providers,
        });
      }

      await this.assertCurrentEligibility({
        userId: input.principal.userId,
        providerKind: input.providerKind,
        action: "providers.application.change_kind",
        ...(input.requestId === undefined
          ? {}
          : { requestId: input.requestId }),
      });

      const updated = await context.providers.updateLifecycle({
        providerId: locked.id,
        expectedVersion: input.expectedVersion,
        kind: input.providerKind,
      });

      await context.generalAudit.append({
        actorType: "USER",
        actorId: input.principal.userId,
        action: "providers.application.change_kind",
        targetType: "provider",
        targetId: updated.id,
        context: {
          outcome: "SUCCEEDED",
          fromKind: locked.kind,
          toKind: input.providerKind,
        },
        ...(input.requestId === undefined
          ? {}
          : { requestId: input.requestId }),
      });

      return this.buildAggregate({
        provider: updated,
        actorUserId: input.principal.userId,
        providers: context.providers,
      });
    });
  }

  public async submitApplication(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly expectedVersion: number;
    readonly requestId?: string;
  }): Promise<SubmitProviderApplicationResult> {
    assertExpectedVersion(input.expectedVersion);

    const existing = await this.dependencies.providers.findById(
      input.providerId,
    );
    if (existing?.applicationOwnerUserId !== input.principal.userId) {
      throw providersError("PROVIDER_NOT_FOUND");
    }

    if (existing.applicationStatus === "PENDING_REVIEW") {
      return {
        submitted: false,
        aggregate: await this.buildAggregate({
          provider: existing,
          actorUserId: input.principal.userId,
        }),
      };
    }

    assertCanSubmitApplication({
      actorIsApplicationOwner: true,
      applicationStatus: existing.applicationStatus,
    });

    if (existing.version !== input.expectedVersion) {
      throw providersError("PROVIDER_VERSION_CONFLICT");
    }

    const { facts } = await this.dependencies.projections.collectCompletionFacts(
      existing,
    );
    const blockers = evaluateSubmissionBlockers(facts);
    if (!blockers.ready) {
      throw providersError("PROVIDER_SUBMISSION_INCOMPLETE", {
        missingRequirementCodes: blockers.missingRequirementCodes,
      });
    }

    const submittedProvider = await this.dependencies.unitOfWork.run(
      async (context) => {
        const locked = await context.providers.lockById(input.providerId);
        if (locked?.applicationOwnerUserId !== input.principal.userId) {
          throw providersError("PROVIDER_NOT_FOUND");
        }

        if (locked.applicationStatus === "PENDING_REVIEW") {
          return { outcome: "existing" as const, provider: locked };
        }

        assertCanSubmitApplication({
          actorIsApplicationOwner: true,
          applicationStatus: locked.applicationStatus,
        });

        if (locked.version !== input.expectedVersion) {
          throw providersError("PROVIDER_VERSION_CONFLICT");
        }

        const { facts: currentFacts } =
          await this.dependencies.projections.collectCompletionFacts(
            locked,
            context.providers,
            {
              identityReader: context.identityReader,
              applicantProfiles: context.applicantProfiles,
              activeCountries: context.activeCountries,
              mediaReader: context.mediaReader,
            },
          );
        const currentBlockers = evaluateSubmissionBlockers(currentFacts);
        if (!currentBlockers.ready) {
          throw providersError("PROVIDER_SUBMISSION_INCOMPLETE", {
            missingRequirementCodes: currentBlockers.missingRequirementCodes,
          });
        }

        const now = new Date();
        const reviewCycle = nextReviewCycle(locked.reviewCycle);
        const updated = await context.providers.updateLifecycle({
          providerId: locked.id,
          expectedVersion: input.expectedVersion,
          applicationStatus: "PENDING_REVIEW",
          reviewCycle,
          firstSubmittedAt: locked.firstSubmittedAt ?? now,
          lastSubmittedAt: now,
          applicationChangedAt: now,
        });

        const history = await context.providers.appendStatusHistory({
          providerId: updated.id,
          domain: "APPLICATION",
          fromApplicationStatus: locked.applicationStatus,
          toApplicationStatus: "PENDING_REVIEW",
          reviewCycle,
          actorUserId: input.principal.userId,
          reason: "APPLICATION_SUBMITTED",
          requestId: input.requestId ?? null,
        });

        await context.emailOutbox.insertIntent({
          providerId: updated.id,
          template: "APPLICATION_SUBMITTED",
          recipientUserId: input.principal.userId,
          idempotencyKey: submissionOutboxIdempotencyKey(
            updated.id,
            reviewCycle,
          ),
          reviewCycle,
          statusHistoryId: history.id,
        });

        await context.generalAudit.append({
          actorType: "USER",
          actorId: input.principal.userId,
          action: "providers.application.submit",
          targetType: "provider",
          targetId: updated.id,
          context: {
            outcome: "SUCCEEDED",
            reviewCycle,
            fromApplicationStatus: locked.applicationStatus,
            toApplicationStatus: "PENDING_REVIEW",
          },
          ...(input.requestId === undefined
            ? {}
            : { requestId: input.requestId }),
        });

        return { outcome: "submitted" as const, provider: updated };
      },
    );

    return {
      submitted: submittedProvider.outcome === "submitted",
      aggregate: await this.buildAggregate({
        provider: submittedProvider.provider,
        actorUserId: input.principal.userId,
      }),
    };
  }

  private async resolveExistingCreate(input: {
    readonly existing: ProviderRecord;
    readonly requestedKind: ProviderKind;
    readonly principal: AuthenticationPrincipal;
  }): Promise<CreateProviderApplicationResult> {
    if (input.existing.kind !== input.requestedKind) {
      throw providersError("PROVIDER_ALREADY_EXISTS", {
        reason: "CONFLICTING_PROVIDER_KIND",
      });
    }
    const aggregate = await this.buildAggregate({
      provider: input.existing,
      actorUserId: input.principal.userId,
    });
    return { created: false, aggregate };
  }

  private async assertCurrentEligibility(input: {
    readonly userId: string;
    readonly providerKind: ProviderKind;
    readonly requestId?: string;
    readonly action: string;
  }): Promise<void> {
    const identity = await this.dependencies.identityReader.getEligibilityFacts(
      input.userId,
    );
    if (identity === null) {
      const denial = mapEligibilityDenial({
        denialCodes: ["IDENTITY_NOT_ELIGIBLE"],
        recoveryHints: ["ACTIVATE_IDENTITY"],
      });
      return this.denialAudit.denyEligibility({
        actorUserId: input.userId,
        action: input.action,
        denialCodes: denial.denialCodes,
        recoveryHints: denial.recoveryHints,
        ...(input.requestId === undefined
          ? {}
          : { requestId: input.requestId }),
      });
    }

    const applicant =
      await this.dependencies.applicantProfiles.getMatchingApplicantContext({
        userId: input.userId,
        providerKind: input.providerKind,
      });

    const eligibility = evaluateProviderEligibility({
      providerKind: input.providerKind,
      identityActive: identity.active,
      verificationOnly: identity.verificationOnly,
      verifiedCategories: identity.verifiedCategories,
      matchingProfileComplete: applicant?.profileComplete ?? false,
    });

    if (eligibility.eligible) {
      return;
    }

    const denial = mapEligibilityDenial({
      denialCodes: eligibility.denialCodes,
      recoveryHints: eligibility.recoveryHints,
    });

    return this.denialAudit.denyEligibility({
      actorUserId: input.userId,
      action: input.action,
      denialCodes: denial.denialCodes,
      recoveryHints: denial.recoveryHints,
      providerKind: input.providerKind,
      requiredCategory: requiredCategoryForProviderKind(input.providerKind),
      ...(input.requestId === undefined
        ? {}
        : { requestId: input.requestId }),
    });
  }

  private async assertTransactionalEligibility(input: {
    readonly userId: string;
    readonly providerKind: ProviderKind;
    readonly identityReader: ProviderIdentityReaderPort;
    readonly applicantProfiles: ProviderApplicantProfileReaderPort;
  }): Promise<void> {
    const [identity, applicant] = await Promise.all([
      input.identityReader.getEligibilityFacts(input.userId),
      input.applicantProfiles.getMatchingApplicantContext({
        userId: input.userId,
        providerKind: input.providerKind,
      }),
    ]);
    const eligibility = evaluateProviderEligibility({
      providerKind: input.providerKind,
      identityActive: identity?.active ?? false,
      verificationOnly: identity?.verificationOnly ?? true,
      verifiedCategories: identity?.verifiedCategories ?? [],
      matchingProfileComplete: applicant?.profileComplete ?? false,
    });
    if (!eligibility.eligible) {
      throw providersError("PROVIDER_ELIGIBILITY_DENIED", {
        denialCodes: eligibility.denialCodes,
      });
    }
  }

  private async buildAggregate(input: {
    readonly provider: ProviderRecord;
    readonly actorUserId: string;
    readonly providers?: ProviderRepositoryPort;
    readonly actorRelationship?: Extract<
      ProviderActorRelationship,
      "APPLICATION_OWNER" | "OWNER" | "ADMIN"
    >;
  }): Promise<ProviderPrivateAggregateDto> {
    const repository = input.providers ?? this.dependencies.providers;
    const profile = await repository.getProfile(input.provider.id);
    const applicant =
      await this.dependencies.applicantProfiles.getMatchingApplicantContext({
        userId: input.provider.applicationOwnerUserId,
        providerKind: input.provider.kind,
      });
    const required = requiredCategoryForProviderKind(input.provider.kind);
    const { completion, readiness } =
      await this.dependencies.projections.computeProjections(
        input.provider,
        repository,
      );

    const summary = mapProviderSummary({
      provider: input.provider,
      profile,
      actorRelationship: input.actorRelationship ?? "APPLICATION_OWNER",
      completionPercentage: completion.percentage,
    });

    return mapPrivateAggregate({
      summary,
      applicantContext: mapApplicantContext({
        category: applicant?.category ?? required,
        individualFullName: applicant?.individualFullName ?? null,
        companyName: applicant?.companyName ?? null,
        representativeFullName: applicant?.representativeFullName ?? null,
      }),
      completion,
      readiness,
    });
  }
}
