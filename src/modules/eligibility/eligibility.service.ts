/**
 * Eligibility application orchestration (R1-P11 Batch E/F).
 *
 * evaluateEligibility: clock-before-retry, RepeatableRead UoW, persistence,
 * evaluationOutcomes (DEC-081 / DEC-084). Browse facade maps diagnostic success
 * to BrowseSafeProjection. Purge captures cutoff once via composition clock.
 */

import { randomUUID } from "node:crypto";

import type { CatalogDefinitionReader } from "#modules/catalog/catalog.public";
import type {
  ActiveCountryReader,
  CountryTimeZoneReader,
  LocalityReader,
} from "#modules/configuration/configuration.public";
import type {
  EligibilityAvailabilityReader,
  EligibilityPricingReader,
  EligibilityProviderLifecycleReader,
} from "#modules/providers/providers.public";

import { EligibilityError } from "./eligibility.errors.js";
import {
  computeEvidenceHash,
  computeRequestHash,
  computeResultHash,
  normalizeEligibilityRequest,
  sortSourceVersions,
  type EligibilityResultHashInput,
} from "./eligibility.hashes.js";
import {
  evaluateCatalogApplicability,
  evaluateProviderCandidate,
  type AvailabilityFacts,
  type CatalogApplicabilityFacts,
  type LifecycleFacts,
  type PricingFacts,
} from "./eligibility.rules.js";
import {
  fetchPerformanceEvidenceIfEnabled,
  type PerformanceGateParameters,
} from "./eligibility.performance.js";
import {
  validateSelectedRuleBundle,
  ELIGIBILITY_MAX_PROVIDERS as RULE_MAX_PROVIDERS,
  ELIGIBILITY_MAX_TEAMS as RULE_MAX_TEAMS,
} from "./eligibility.rule-bundle.js";
import {
  isRetryableConflictError,
  normalizeEligibilityPersistenceError,
  normalizeEligibilityTechnicalError,
} from "./eligibility.technical-errors.js";
import type {
  BrowseCandidatesRequest,
  BrowseSafeCandidate,
  BrowseSafeProjection,
  DiagnosticResult,
  DiscoveryRequest,
  EligibilityApplicationService,
  EligibilityEvidenceSnapshot,
  EvaluateEligibilityRequest,
  EvaluationMetadata,
  EvaluationOutcomes,
  ProviderSummary,
  PurgeOptions,
  PurgeResult,
  TeamResult,
} from "./eligibility.public.js";
import {
  computeEligibilityExpiresAt,
  ELIGIBILITY_ENGINE_COMPATIBILITY,
  resolvePurgeBatchSize,
  type EligibilityEvaluationInsert,
  type PrismaEligibilityRepository,
} from "./infrastructure/prisma-eligibility.repository.js";
import type { EligibilityUnitOfWork } from "./infrastructure/eligibility.unit-of-work.js";
import type { PerformanceEvidencePort } from "./performance-evidence.port.js";

export const ELIGIBILITY_CONTRACT_VERSION = "eligibility.public.v1" as const;
export const ELIGIBILITY_ENGINE_VERSION = "eligibility-engine.r1.v1" as const;
export const ELIGIBILITY_CALENDAR_RUNTIME_VERSION =
  "providers-availability-calendar.r1.v1" as const;
export const ELIGIBILITY_MAX_ATTEMPTS = 3 as const;
export const ELIGIBILITY_MAX_PROVIDERS = RULE_MAX_PROVIDERS;
export const ELIGIBILITY_MAX_TEAMS = RULE_MAX_TEAMS;

type Tx = unknown;

export type EligibilityClock = () => Date;

export interface EligibilityApplicationServiceDependencies {
  readonly unitOfWork: EligibilityUnitOfWork;
  readonly clock: EligibilityClock;
  readonly createCatalogReader: (tx: Tx) => CatalogDefinitionReader;
  readonly createActiveCountryReader: (tx: Tx) => ActiveCountryReader;
  readonly createLocalityReader: (tx: Tx) => LocalityReader;
  readonly createCountryTimeZoneReader: (tx: Tx) => CountryTimeZoneReader;
  readonly createPricingReader: (tx: Tx) => EligibilityPricingReader;
  readonly createLifecycleReader: (
    tx: Tx,
    context: { readonly evaluatedAt: Date },
  ) => EligibilityProviderLifecycleReader;
  readonly createAvailabilityReader: (tx: Tx) => EligibilityAvailabilityReader;
  readonly performanceEvidencePort?: PerformanceEvidencePort;
}

function isRetryableConflict(error: unknown): boolean {
  return isRetryableConflictError(error);
}

function parseUtcInstant(value: string, field: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new EligibilityError("VALIDATION_FAILED", {
      details: { field, reason: "INVALID_UTC_INSTANT" },
    });
  }
  return parsed;
}

/**
 * @desc Validate EvaluateEligibilityRequest bounds (Batch E / T028).
 * @access Application
 */
export function validateEvaluateEligibilityRequest(
  input: EvaluateEligibilityRequest,
): void {
  if ("geo" in input || "latitude" in input || "longitude" in input) {
    throw new EligibilityError("UNSUPPORTED_GEO_INPUT", {
      details: { reason: "GEO_COORDINATES_FORBIDDEN" },
    });
  }
  if (typeof input.serviceId !== "string" || input.serviceId.length === 0) {
    throw new EligibilityError("VALIDATION_FAILED", {
      details: { field: "serviceId" },
    });
  }
  if (typeof input.countryId !== "string" || input.countryId.length === 0) {
    throw new EligibilityError("VALIDATION_FAILED", {
      details: { field: "countryId" },
    });
  }
  if (typeof input.cityId !== "string" || input.cityId.length === 0) {
    throw new EligibilityError("VALIDATION_FAILED", {
      details: { field: "cityId" },
    });
  }
  if (
    input.districtId !== undefined &&
    (typeof input.districtId !== "string" || input.districtId.length === 0)
  ) {
    throw new EligibilityError("VALIDATION_FAILED", {
      details: { field: "districtId" },
    });
  }
  if (
    input.crewPreference !== "any" &&
    input.crewPreference !== "all_male" &&
    input.crewPreference !== "all_female"
  ) {
    throw new EligibilityError("VALIDATION_FAILED", {
      details: { field: "crewPreference" },
    });
  }
  if (
    !Number.isInteger(input.requiredTeamUnits) ||
    input.requiredTeamUnits < 1 ||
    input.requiredTeamUnits > 50
  ) {
    throw new EligibilityError("VALIDATION_FAILED", {
      details: { field: "requiredTeamUnits" },
    });
  }

  const startsAt = parseUtcInstant(input.startsAt, "startsAt");
  const endsAt = parseUtcInstant(input.endsAt, "endsAt");
  if (!(startsAt.getTime() < endsAt.getTime())) {
    throw new EligibilityError("VALIDATION_FAILED", {
      details: { field: "endsAt", reason: "MUST_BE_AFTER_STARTS_AT" },
    });
  }
  const durationMs = endsAt.getTime() - startsAt.getTime();
  const maxMs = 24 * 60 * 60 * 1000;
  if (durationMs > maxMs) {
    throw new EligibilityError("VALIDATION_FAILED", {
      details: { field: "interval", reason: "EXCEEDS_MAX_INTERVAL_HOURS" },
    });
  }

  if (input.mode === "explicit") {
    if (!Array.isArray(input.providerIds) || input.providerIds.length === 0) {
      throw new EligibilityError("VALIDATION_FAILED", {
        details: { field: "providerIds", reason: "EMPTY" },
      });
    }
    const unique = new Set(input.providerIds);
    if (unique.size > ELIGIBILITY_MAX_PROVIDERS) {
      throw new EligibilityError("EVALUATION_LIMIT_EXCEEDED", {
        details: { limit: "maxProviders", max: ELIGIBILITY_MAX_PROVIDERS },
      });
    }
    for (const id of input.providerIds) {
      if (typeof id !== "string" || id.length === 0) {
        throw new EligibilityError("VALIDATION_FAILED", {
          details: { field: "providerIds" },
        });
      }
    }
  }
}

/**
 * @desc Eligibility application service (evaluate + stubs for later batches).
 * @access Application
 */
export class EligibilityApplicationServiceImpl
  implements EligibilityApplicationService
{
  public constructor(
    private readonly deps: EligibilityApplicationServiceDependencies,
  ) {}

  public async evaluateEligibility(
    input: EvaluateEligibilityRequest,
  ): Promise<DiagnosticResult> {
    validateEvaluateEligibilityRequest(input);
    // Capture clock once before the retry loop (DEC-081).
    const evaluatedAt = this.deps.clock();
    const evaluatedAtIso = evaluatedAt.toISOString();

    let lastError: unknown;
    for (let attempt = 1; attempt <= ELIGIBILITY_MAX_ATTEMPTS; attempt += 1) {
      try {
        return await this.deps.unitOfWork.runRepeatableRead((context) =>
          this.evaluateOnce({
            input,
            evaluatedAt,
            evaluatedAtIso,
            repository: context.eligibility,
            tx: context.transaction,
          }),
        );
      } catch (error: unknown) {
        const normalized = isRetryableConflict(error)
          ? error instanceof EligibilityError
            ? error
            : normalizeEligibilityTechnicalError(error)
          : normalizeEligibilityTechnicalError(error);
        lastError = normalized;
        if (!isRetryableConflict(normalized) || attempt === ELIGIBILITY_MAX_ATTEMPTS) {
          if (
            isRetryableConflict(normalized) &&
            attempt === ELIGIBILITY_MAX_ATTEMPTS
          ) {
            throw new EligibilityError("TRANSACTION_CONFLICT_EXHAUSTED", {
              cause: normalized,
            });
          }
          throw normalized;
        }
      }
    }
    throw lastError;
  }

  public async getStandardBrowseCandidates(
    input: BrowseCandidatesRequest,
  ): Promise<BrowseSafeProjection> {
    validateBrowseCandidatesRequest(input);
    const discoveryInput: DiscoveryRequest = {
      mode: "discovery",
      serviceId: input.serviceId,
      countryId: input.countryId,
      cityId: input.cityId,
      ...(input.districtId === undefined ? {} : { districtId: input.districtId }),
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      crewPreference: input.crewPreference,
      requiredTeamUnits: input.requiredTeamUnits,
    };
    const diagnostic = await this.evaluateEligibility(discoveryInput);
    return mapDiagnosticToBrowseSafeProjection(diagnostic);
  }

  public async purgeExpiredEvaluations(
    options?: PurgeOptions,
  ): Promise<PurgeResult> {
    if (options !== undefined && "asOf" in options) {
      throw new EligibilityError("VALIDATION_FAILED", {
        details: { field: "asOf", reason: "CALLER_ASOF_FORBIDDEN" },
      });
    }
    const batchSize = resolvePurgeBatchSize(options?.batchSize);
    const cutoff = this.deps.clock();
    return this.deps.unitOfWork.runRepeatableRead((context) =>
      context.eligibility.purgeExpiredEvaluations({
        cutoff,
        batchSize,
      }),
    );
  }

  private async evaluateOnce(args: {
    readonly input: EvaluateEligibilityRequest;
    readonly evaluatedAt: Date;
    readonly evaluatedAtIso: string;
    readonly repository: PrismaEligibilityRepository;
    readonly tx: Tx;
  }): Promise<DiagnosticResult> {
    const countries = this.deps.createActiveCountryReader(args.tx);
    const localities = this.deps.createLocalityReader(args.tx);
    const timeZones = this.deps.createCountryTimeZoneReader(args.tx);
    const catalog = this.deps.createCatalogReader(args.tx);
    const pricing = this.deps.createPricingReader(args.tx);
    const lifecycle = this.deps.createLifecycleReader(args.tx, {
      evaluatedAt: args.evaluatedAt,
    });
    const availability = this.deps.createAvailabilityReader(args.tx);

    const country = await countries.getActiveCountryById(args.input.countryId);
    if (country === null) {
      throw new EligibilityError("VALIDATION_FAILED", {
        details: { field: "countryId", reason: "INACTIVE_OR_UNKNOWN" },
      });
    }

    const city = await localities.findCityById(args.input.cityId);
    if (
      city === null ||
      city.countryId !== args.input.countryId ||
      !city.isActive ||
      !city.countryActive
    ) {
      throw new EligibilityError("VALIDATION_FAILED", {
        details: { field: "cityId", reason: "INACTIVE_OR_UNKNOWN_ANCESTRY" },
      });
    }
    if (args.input.districtId !== undefined) {
      const district = await localities.findDistrictById(args.input.districtId);
      if (
        district === null ||
        district.cityId !== args.input.cityId ||
        district.countryId !== args.input.countryId ||
        !district.isActive ||
        !district.cityActive ||
        !district.countryActive
      ) {
        throw new EligibilityError("VALIDATION_FAILED", {
          details: {
            field: "districtId",
            reason: "INACTIVE_OR_UNKNOWN_ANCESTRY",
          },
        });
      }
    }

    const countryTimeZone = await timeZones.getTimeZoneForCountry(
      args.input.countryId,
    );
    if (countryTimeZone === null) {
      throw new EligibilityError("VALIDATION_FAILED", {
        details: { field: "countryId", reason: "TIME_ZONE_MISSING" },
      });
    }

    const ruleVersion = await args.repository.findEffectiveRuleVersion({
      countryId: args.input.countryId,
      engineCompatibility: ELIGIBILITY_ENGINE_COMPATIBILITY,
      evaluatedAt: args.evaluatedAt,
    });
    if (ruleVersion === null) {
      throw new EligibilityError("RULE_VERSION_UNAVAILABLE");
    }

    const parameters = validateSelectedRuleBundle({
      schemaVersion: ruleVersion.schemaVersion,
      engineCompatibility: ruleVersion.engineCompatibility,
      ruleOrder: ruleVersion.ruleOrder,
      parameters: ruleVersion.parameters,
      contentChecksum: ruleVersion.contentChecksum,
    });

    const catalogReference = await catalog.getProviderOfferingReference({
      serviceId: args.input.serviceId,
      countryCode: country.code,
    });
    const catalogFacts: CatalogApplicabilityFacts =
      catalogReference === null
        ? {
            status: "UNAVAILABLE",
            reason: "SERVICE_INACTIVE_OR_UNKNOWN",
          }
        : catalogReference.selectableForCountry
          ? {
              status: "AVAILABLE",
              serviceId: catalogReference.serviceId,
              serviceCode: catalogReference.serviceCode,
            }
          : {
              status: "UNAVAILABLE",
              reason: "SERVICE_NOT_AVAILABLE_IN_COUNTRY",
            };
    const catalogOutcome = evaluateCatalogApplicability(catalogFacts);
    const evaluationOutcomes: EvaluationOutcomes = { catalog: catalogOutcome };

    let providerIds: readonly string[] = [];
    let discoveredProviderCount = 0;
    if (args.input.mode === "discovery") {
      const discovery = await availability.discoverProviderIds({
        countryId: args.input.countryId,
        cityId: args.input.cityId,
        ...(args.input.districtId === undefined
          ? {}
          : { districtId: args.input.districtId }),
        limit: ELIGIBILITY_MAX_PROVIDERS,
      });
      if (discovery.status === "OVERFLOW") {
        throw new EligibilityError("EVALUATION_LIMIT_EXCEEDED", {
          details: { limit: "maxProviders" },
        });
      }
      providerIds = [...discovery.providerIds].sort((a, b) =>
        a.localeCompare(b),
      );
      discoveredProviderCount = providerIds.length;
    } else {
      providerIds = [...new Set(args.input.providerIds)].sort((a, b) =>
        a.localeCompare(b),
      );
      discoveredProviderCount = providerIds.length;
    }

    // Catalog FAIL still persists with zero Providers (DEC-084).
    if (catalogFacts.status === "UNAVAILABLE") {
      providerIds = [];
    }

    const eligibleProviders: ProviderSummary[] = [];
    const excludedProviders: ProviderSummary[] = [];
    const eligibleTeams: TeamResult[] = [];
    const excludedTeams: TeamResult[] = [];
    const evidenceProviders: Array<
      EligibilityEvidenceSnapshot["providers"][number]
    > = [];

    let remainingTeamBudget = ELIGIBILITY_MAX_TEAMS;
    let teamResultCount = 0;

    for (const providerId of providerIds) {
      const lifecycleFacts = await lifecycle.getLifecycleFacts(providerId);
      const pricingFacts = await pricing.getEligibilityPricingFacts({
        providerId,
        serviceId: args.input.serviceId,
        countryId: args.input.countryId,
      });
      const availabilityFacts = await availability.getAvailabilityFacts({
        providerId,
        startsAt: args.input.startsAt,
        endsAt: args.input.endsAt,
        countryId: args.input.countryId,
        cityId: args.input.cityId,
        ...(args.input.districtId === undefined
          ? {}
          : { districtId: args.input.districtId }),
        remainingTeamBudget,
      });

      if (availabilityFacts.status === "OVERFLOW") {
        throw new EligibilityError("EVALUATION_LIMIT_EXCEEDED", {
          details: { limit: "maxTeamResults", providerId },
        });
      }

      const teamsConsumed =
        availabilityFacts.status === "AVAILABLE_FACTS" ||
        availabilityFacts.status === "MISSING_CONFIGURATION"
          ? availabilityFacts.teams.length
          : 0;
      remainingTeamBudget -= teamsConsumed;
      if (remainingTeamBudget < 0) {
        throw new EligibilityError("EVALUATION_LIMIT_EXCEEDED", {
          details: { limit: "maxTeamResults" },
        });
      }

      const performancePortResult = await fetchPerformanceEvidenceIfEnabled({
        gate: parameters.performanceGate,
        port: this.deps.performanceEvidencePort,
        providerId,
        evaluatedAt: args.evaluatedAtIso,
        policyVersionId: ruleVersion.id,
      });

      const candidate = evaluateProviderCandidate({
        providerId,
        preference: args.input.crewPreference,
        requiredTeamUnits: args.input.requiredTeamUnits,
        startsAt: args.input.startsAt,
        endsAt: args.input.endsAt,
        lifecycle: mapLifecycle(lifecycleFacts),
        pricing: mapPricing(pricingFacts),
        availability: mapAvailability(availabilityFacts),
        performanceGate: parameters.performanceGate,
        policyVersionId: ruleVersion.id,
        evaluatedAt: args.evaluatedAtIso,
        performancePortResult,
      });

      teamResultCount += candidate.teams.length;
      if (teamResultCount > ELIGIBILITY_MAX_TEAMS) {
        throw new EligibilityError("EVALUATION_LIMIT_EXCEEDED", {
          details: { limit: "maxTeamResults" },
        });
      }

      if (candidate.provider.eligible) {
        eligibleProviders.push(candidate.provider);
      } else {
        excludedProviders.push(candidate.provider);
      }
      for (const team of candidate.teams) {
        if (team.eligible) {
          eligibleTeams.push(team);
        } else {
          excludedTeams.push(team);
        }
      }

      evidenceProviders.push(
        buildEvidenceProvider({
          providerId,
          lifecycle: lifecycleFacts,
          pricing: pricingFacts,
          availability: availabilityFacts,
          performancePortResult,
          performanceGate: parameters.performanceGate,
        }),
      );
    }

    const normalizedRequest = normalizeEligibilityRequest(
      args.input.mode === "explicit"
        ? { ...args.input, providerIds }
        : args.input,
    );
    const requestHash = computeRequestHash(normalizedRequest);

    const sourceVersions = sortSourceVersions(
      Object.fromEntries(
        evidenceProviders.flatMap((provider) => {
          const entries: Array<[string, string]> = [];
          const lifecycleVersion =
            provider.lifecycle.status === "PRESENT"
              ? provider.lifecycle.aggregateVersion
              : null;
          if (lifecycleVersion !== null && lifecycleVersion.length > 0) {
            entries.push([
              `lifecycle:${provider.providerId}`,
              lifecycleVersion,
            ]);
          }
          const pricingVersion =
            provider.pricing.status === "AVAILABLE" ||
            provider.pricing.status === "UNAVAILABLE"
              ? provider.pricing.sourceVersion
              : null;
          if (typeof pricingVersion === "string" && pricingVersion.length > 0) {
            entries.push([`pricing:${provider.providerId}`, pricingVersion]);
          }
          return entries;
        }),
      ),
    );

    const evidence: EligibilityEvidenceSnapshot = {
      normalizedRequest,
      evaluatedAt: args.evaluatedAtIso,
      pinnedRule: {
        ruleVersionId: ruleVersion.id,
        contentChecksum: ruleVersion.contentChecksum,
        schemaVersion: ruleVersion.schemaVersion,
        engineCompatibility: ruleVersion.engineCompatibility,
        versionLabel: ruleVersion.versionLabel,
      },
      countryLocality: {
        countryCode: country.code,
        countryTimeZone,
        cityId: args.input.cityId,
        districtId: args.input.districtId ?? null,
        ancestryVersion: null,
      },
      evaluationOutcomes,
      providers: [...evidenceProviders].sort((left, right) =>
        left.providerId.localeCompare(right.providerId),
      ),
      engineCalendar: {
        engineVersion: ELIGIBILITY_ENGINE_VERSION,
        calendarRuntimeVersion: ELIGIBILITY_CALENDAR_RUNTIME_VERSION,
        contractVersion: ELIGIBILITY_CONTRACT_VERSION,
      },
      sourceVersions,
    };
    const evidenceHash = computeEvidenceHash(evidence);

    const discovery = {
      mode: args.input.mode,
      countryId: args.input.countryId,
      cityId: args.input.cityId,
      districtId: args.input.districtId ?? null,
      discoveredProviderCount,
      evaluatedProviderCount: evidenceProviders.length,
      teamResultCount,
      complete: true,
    } as const;

    const hashMetadata: EligibilityResultHashInput["metadata"] = {
      contractVersion: ELIGIBILITY_CONTRACT_VERSION,
      engineVersion: ELIGIBILITY_ENGINE_VERSION,
      ruleVersionId: ruleVersion.id,
      ruleChecksum: ruleVersion.contentChecksum,
      evaluatedAt: args.evaluatedAtIso,
      countryTimeZone,
      calendarRuntimeVersion: ELIGIBILITY_CALENDAR_RUNTIME_VERSION,
      sourceVersions,
      discovery,
      limits: {
        maxProviders: ELIGIBILITY_MAX_PROVIDERS,
        maxTeamResults: ELIGIBILITY_MAX_TEAMS,
      },
    };

    const semanticResult = {
      evaluationOutcomes,
      eligibleProviders: [...eligibleProviders].sort((a, b) =>
        a.providerId.localeCompare(b.providerId),
      ),
      eligibleTeams: [...eligibleTeams].sort((a, b) => {
        const byProvider = a.providerId.localeCompare(b.providerId);
        return byProvider !== 0 ? byProvider : a.teamId.localeCompare(b.teamId);
      }),
      excludedProviders: [...excludedProviders].sort((a, b) =>
        a.providerId.localeCompare(b.providerId),
      ),
      excludedTeams: [...excludedTeams].sort((a, b) => {
        const byProvider = a.providerId.localeCompare(b.providerId);
        return byProvider !== 0 ? byProvider : a.teamId.localeCompare(b.teamId);
      }),
    };

    const resultHash = computeResultHash({
      ...semanticResult,
      metadata: hashMetadata,
    });

    const metadataBase: Omit<EvaluationMetadata, "resultHash"> = {
      ...hashMetadata,
      requestHash,
      evidenceHash,
    };

    const evaluationId = randomUUID();
    const completedAt = args.evaluatedAt;
    const expiresAt = computeEligibilityExpiresAt(completedAt);

    const insert: EligibilityEvaluationInsert = {
      id: evaluationId,
      ruleVersionId: ruleVersion.id,
      countryId: args.input.countryId,
      evaluatedAt: args.evaluatedAt,
      completedAt,
      expiresAt,
      requestNormalized: normalizedRequest as unknown as object,
      requestHash,
      evidenceSafe: evidence as unknown as object,
      evidenceHash,
      resultHash,
      metadata: { ...metadataBase, resultHash } as unknown as object,
      outcomeSummary: {
        evaluationOutcomes,
        eligibleProviderCount: semanticResult.eligibleProviders.length,
        excludedProviderCount: semanticResult.excludedProviders.length,
        eligibleTeamCount: semanticResult.eligibleTeams.length,
        excludedTeamCount: semanticResult.excludedTeams.length,
      } as unknown as object,
      engineVersion: ELIGIBILITY_ENGINE_VERSION,
      candidates: [
        ...semanticResult.eligibleProviders.map((provider) => ({
          id: randomUUID(),
          providerId: provider.providerId,
          teamId: null,
          rowKind: "PROVIDER_SUMMARY" as const,
          eligible: true,
          ruleOutcomes: provider.ruleOutcomes as unknown as object,
          reasons: provider.reasons as unknown as object,
          sortingFacts: provider.sortingFacts as unknown as object | null,
        })),
        ...semanticResult.excludedProviders.map((provider) => ({
          id: randomUUID(),
          providerId: provider.providerId,
          teamId: null,
          rowKind: "PROVIDER_SUMMARY" as const,
          eligible: false,
          ruleOutcomes: provider.ruleOutcomes as unknown as object,
          reasons: provider.reasons as unknown as object,
          sortingFacts: null,
        })),
        ...semanticResult.eligibleTeams.map((team) => ({
          id: randomUUID(),
          providerId: team.providerId,
          teamId: team.teamId,
          rowKind: "TEAM_RESULT" as const,
          eligible: true,
          ruleOutcomes: team.ruleOutcomes as unknown as object,
          reasons: team.reasons as unknown as object,
          sortingFacts: team.sortingFacts as unknown as object | null,
        })),
        ...semanticResult.excludedTeams.map((team) => ({
          id: randomUUID(),
          providerId: team.providerId,
          teamId: team.teamId,
          rowKind: "TEAM_RESULT" as const,
          eligible: false,
          ruleOutcomes: team.ruleOutcomes as unknown as object,
          reasons: team.reasons as unknown as object,
          sortingFacts: null,
        })),
      ],
    };

    try {
      await args.repository.insertEvaluationWithCandidates(insert);
    } catch (error: unknown) {
      throw normalizeEligibilityPersistenceError(error);
    }

    return {
      evaluationId,
      ...semanticResult,
      metadata: { ...metadataBase, resultHash },
    };
  }
}

function mapLifecycle(
  facts: Awaited<
    ReturnType<EligibilityProviderLifecycleReader["getLifecycleFacts"]>
  >,
): LifecycleFacts {
  if (facts.status === "MISSING") {
    return { status: "MISSING", providerId: facts.providerId };
  }
  return {
    status: "PRESENT",
    providerId: facts.providerId,
    approved: facts.approved,
    live: facts.live,
    suspended: facts.suspended,
    verificationSatisfiedOrNotRequired: facts.verificationSatisfiedOrNotRequired,
    aggregateVersion: facts.aggregateVersion,
  };
}

function mapPricing(
  facts: Awaited<
    ReturnType<EligibilityPricingReader["getEligibilityPricingFacts"]>
  >,
): PricingFacts {
  if (facts.status === "UNAVAILABLE") {
    return {
      status: "UNAVAILABLE",
      providerId: facts.providerId,
      serviceId: facts.serviceId,
      reason: "OFFERING_OR_PRICE_UNAVAILABLE",
      sourceVersion: facts.sourceVersion,
    };
  }
  return {
    status: "AVAILABLE",
    providerId: facts.providerId,
    serviceId: facts.serviceId,
    priceAmount: facts.priceAmount,
    minimumChargeAmount: facts.minimumChargeAmount,
    currencyCode: facts.currencyCode,
    priceUnitId: facts.priceUnitId,
    estimatedDurationMinutes: facts.estimatedDurationMinutes,
    sourceVersion: facts.sourceVersion,
  };
}

function mapAvailability(
  facts: Awaited<
    ReturnType<EligibilityAvailabilityReader["getAvailabilityFacts"]>
  >,
): AvailabilityFacts {
  if (facts.status === "OVERFLOW") {
    return {
      status: "OVERFLOW",
      providerId: facts.providerId,
      acceptedTeams: facts.acceptedTeams,
    };
  }
  if (facts.status === "MISSING_CONFIGURATION") {
    return {
      status: "MISSING_CONFIGURATION",
      providerId: facts.providerId,
      missingConfiguration: facts.missingConfiguration,
      coverageMatch: facts.coverageMatch,
      providerScheduleAvailable: facts.providerScheduleAvailable,
      paused: facts.paused,
      suspended: facts.suspended,
      simultaneousTeamLimit: facts.simultaneousTeamLimit,
      teams: facts.teams,
    };
  }
  return {
    status: "AVAILABLE_FACTS",
    providerId: facts.providerId,
    coverageMatch: facts.coverageMatch,
    providerScheduleAvailable: facts.providerScheduleAvailable,
    paused: facts.paused,
    suspended: facts.suspended,
    simultaneousTeamLimit: facts.simultaneousTeamLimit,
    teams: facts.teams,
  };
}

function buildEvidenceProvider(input: {
  readonly providerId: string;
  readonly lifecycle: Awaited<
    ReturnType<EligibilityProviderLifecycleReader["getLifecycleFacts"]>
  >;
  readonly pricing: Awaited<
    ReturnType<EligibilityPricingReader["getEligibilityPricingFacts"]>
  >;
  readonly availability: Awaited<
    ReturnType<EligibilityAvailabilityReader["getAvailabilityFacts"]>
  >;
  readonly performancePortResult: Awaited<
    ReturnType<typeof fetchPerformanceEvidenceIfEnabled>
  >;
  readonly performanceGate: PerformanceGateParameters;
}): EligibilityEvidenceSnapshot["providers"][number] {
  const lifecycle =
    input.lifecycle.status === "MISSING"
      ? ({ status: "MISSING" } as const)
      : ({
          status: "PRESENT" as const,
          approved: input.lifecycle.approved,
          live: input.lifecycle.live,
          suspended: input.lifecycle.suspended,
          verificationSatisfiedOrNotRequired:
            input.lifecycle.verificationSatisfiedOrNotRequired,
          aggregateVersion: input.lifecycle.aggregateVersion,
        } as const);

  const pricing =
    input.pricing.status === "AVAILABLE"
      ? ({
          status: "AVAILABLE" as const,
          priceAmount: input.pricing.priceAmount,
          minimumChargeAmount: input.pricing.minimumChargeAmount,
          currencyCode: input.pricing.currencyCode,
          priceUnitId: input.pricing.priceUnitId,
          estimatedDurationMinutes: input.pricing.estimatedDurationMinutes,
          sourceVersion: input.pricing.sourceVersion,
        } as const)
      : ({
          status: "UNAVAILABLE" as const,
          reason: input.pricing.reason,
          sourceVersion: input.pricing.sourceVersion,
        } as const);

  let availability: EligibilityEvidenceSnapshot["providers"][number]["availability"];
  if (input.availability.status === "OVERFLOW") {
    availability = {
      status: "OVERFLOW",
      acceptedTeams: input.availability.acceptedTeams,
    };
  } else if (input.availability.status === "MISSING_CONFIGURATION") {
    availability = {
      status: "MISSING_CONFIGURATION",
      missingConfiguration: input.availability.missingConfiguration,
      coverageMatch: input.availability.coverageMatch,
      providerScheduleAvailable: input.availability.providerScheduleAvailable,
      paused: input.availability.paused,
      suspended: input.availability.suspended,
      simultaneousTeamLimit: input.availability.simultaneousTeamLimit,
      teams: input.availability.teams,
    };
  } else {
    availability = {
      status: "AVAILABLE_FACTS",
      coverageMatch: input.availability.coverageMatch,
      providerScheduleAvailable: input.availability.providerScheduleAvailable,
      paused: input.availability.paused,
      suspended: input.availability.suspended,
      simultaneousTeamLimit: input.availability.simultaneousTeamLimit,
      teams: [...input.availability.teams].sort((a, b) =>
        a.teamId.localeCompare(b.teamId),
      ),
    };
  }

  const performance =
    !input.performanceGate.enabled || input.performancePortResult === null
      ? ({ status: "NOT_APPLICABLE" } as const)
      : input.performancePortResult.status === "MISSING"
        ? ({ status: "MISSING" } as const)
        : ({
            status: "OK" as const,
            metricKey: input.performancePortResult.evidence.metricKey,
            policyVersionId:
              input.performancePortResult.evidence.policyVersionId,
            value: input.performancePortResult.evidence.value,
            sampleCount: input.performancePortResult.evidence.sampleCount,
            observedAt: input.performancePortResult.evidence.observedAt,
          } as const);

  return {
    providerId: input.providerId,
    lifecycle,
    pricing,
    availability,
    performance,
  };
}

/**
 * @desc Validate Browse facade input (discovery-shaped; providerIds forbidden).
 * @access Application
 * @explanation Does not consult setup-readiness public-browse placeholder flags.
 */
export function validateBrowseCandidatesRequest(
  input: BrowseCandidatesRequest,
): void {
  if (
    Object.prototype.hasOwnProperty.call(input, "providerIds") &&
    (input as { readonly providerIds?: unknown }).providerIds !== undefined
  ) {
    throw new EligibilityError("VALIDATION_FAILED", {
      details: { field: "providerIds", reason: "FORBIDDEN_ON_BROWSE_FACADE" },
    });
  }
  if (input.mode !== undefined && input.mode !== "discovery") {
    throw new EligibilityError("VALIDATION_FAILED", {
      details: { field: "mode", reason: "BROWSE_REQUIRES_DISCOVERY" },
    });
  }
  validateEvaluateEligibilityRequest({
    mode: "discovery",
    serviceId: input.serviceId,
    countryId: input.countryId,
    cityId: input.cityId,
    ...(input.districtId === undefined ? {} : { districtId: input.districtId }),
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    crewPreference: input.crewPreference,
    requiredTeamUnits: input.requiredTeamUnits,
  });
}

/**
 * @desc Map a successful diagnostic result to the Browse-safe allowlist.
 * @access Application
 * @explanation Eligible Teams only; omits excluded diagnostics and Worker IDs.
 */
export function mapDiagnosticToBrowseSafeProjection(
  diagnostic: DiagnosticResult,
): BrowseSafeProjection {
  const candidates: BrowseSafeCandidate[] = [];
  for (const team of diagnostic.eligibleTeams) {
    if (team.sortingFacts === null) {
      continue;
    }
    candidates.push({
      providerId: team.providerId,
      teamId: team.teamId,
      sortingFacts: team.sortingFacts,
    });
  }
  candidates.sort((left, right) => {
    const byProvider = left.providerId.localeCompare(right.providerId);
    return byProvider !== 0
      ? byProvider
      : left.teamId.localeCompare(right.teamId);
  });
  return {
    candidates,
    metadata: {
      contractVersion: diagnostic.metadata.contractVersion,
      engineVersion: diagnostic.metadata.engineVersion,
      ruleVersionId: diagnostic.metadata.ruleVersionId,
      requestHash: diagnostic.metadata.requestHash,
      evidenceHash: diagnostic.metadata.evidenceHash,
      resultHash: diagnostic.metadata.resultHash,
      evaluatedAt: diagnostic.metadata.evaluatedAt,
      countryTimeZone: diagnostic.metadata.countryTimeZone,
      discovery: diagnostic.metadata.discovery,
    },
  };
}

/**
 * @desc Composition factory for the Eligibility application service.
 * @access Public / composition
 */
export function createEligibilityApplicationService(
  deps: EligibilityApplicationServiceDependencies,
): EligibilityApplicationService {
  return new EligibilityApplicationServiceImpl(deps);
}
