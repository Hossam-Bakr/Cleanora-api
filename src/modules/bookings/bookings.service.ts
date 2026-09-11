import type { AuthenticationPrincipal } from "#modules/authentication/authentication.public";
import { isCatalogError } from "#modules/catalog/catalog.public";
import { isEligibilityError } from "#modules/eligibility/eligibility.public";
import {
  mapBookingSafeTeamFactsToCrewSummary,
} from "#modules/providers/providers.public";

import {
  browseFilterDigest,
  decodeBrowseCursor,
  encodeBrowseCursor,
} from "./bookings.cursor.js";
import { bookingPrerequisitesFor } from "./bookings.customer.js";
import { browseError } from "./bookings.errors.js";
import {
  type BookingsBrowseDependencies,
  type BookingsBrowseReader,
  type BrowseProviderDetailResult,
  type BrowseProviderListResult,
} from "./bookings.public.js";
import type { BrowseProvidersQuery } from "./bookings.schema.js";
import {
  filterAndSortBrowseCandidates,
  pickDisplayName,
  type BrowseEnrichedCandidate,
} from "./bookings.sort-filter.js";

const BROWSE_SNAPSHOT_TTL_MS = 5 * 60 * 1000;
const BROWSE_SNAPSHOT_MAX_ENTRIES = 256;
const BROWSE_PREVIEW_CONCURRENCY = 16;

interface BrowsePageSnapshot {
  readonly expiresAtMs: number;
  readonly filterDigest: string;
  readonly candidates: readonly {
    readonly providerId: string;
    readonly teamId: string;
    readonly sortingFacts: BrowseEnrichedCandidate["sortingFacts"];
  }[];
  readonly metadata: BrowseProviderListResult["metadata"];
}

/**
 * Bookings-owned Browse orchestration: catalog/locality helpers plus eligible
 * list/detail over the Eligibility facade.
 */
export class BookingsBrowseService implements BookingsBrowseReader {
  private readonly pageSnapshots = new Map<string, BrowsePageSnapshot>();

  public constructor(private readonly deps: BookingsBrowseDependencies) {}

  public async listServices(input: {
    readonly countryCode: string;
    readonly locale: "AR" | "EN";
    readonly cursor?: string;
    readonly limit: number;
  }) {
    return this.callCatalog(() =>
      this.deps.catalog.listSelectable({
        countryCode: input.countryCode,
        locale: input.locale,
        ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
        limit: input.limit,
      }),
    );
  }

  public async getService(input: {
    readonly serviceId: string;
    readonly countryCode: string;
    readonly locale: "AR" | "EN";
  }) {
    const definition = await this.callCatalog(() =>
      this.deps.catalog.getSnapshotReadyDefinitionById({
        serviceId: input.serviceId,
        countryCode: input.countryCode,
        locale: input.locale,
      }),
    );
    if (definition === null) {
      throw browseError("BROWSE_SERVICE_NOT_FOUND");
    }
    return definition;
  }

  public async listCities(countryCode: string) {
    await this.assertActiveCountryCode(countryCode);
    return this.deps.locality.listActiveCitiesForCountry(countryCode);
  }

  public async listDistricts(input: {
    readonly countryCode: string;
    readonly cityId: string;
  }) {
    await this.assertActiveCountryCode(input.countryCode);
    return this.deps.locality.listActiveDistrictsForCity(input);
  }

  public getProviderPreview(providerId: string) {
    return this.deps.providers.getContactFreePreview(providerId);
  }

  public async getCrewSummary(input: {
    readonly providerId: string;
    readonly teamId: string;
  }) {
    const facts = await this.deps.providers.getBookingSafeTeamFacts(input);
    return facts === null
      ? null
      : mapBookingSafeTeamFactsToCrewSummary({
          teamId: facts.teamId,
          teamVersion: facts.teamVersion,
          active: facts.active,
          members: facts.members.map((member) => ({
            gender: member.gender,
            workerType: member.workerType,
            cleans: member.cleans,
          })),
        });
  }

  public async listEligibleProviders(
    query: BrowseProvidersQuery,
  ): Promise<BrowseProviderListResult> {
    const filterDigest = browseFilterDigest({
      serviceId: query.serviceId,
      countryId: query.countryId,
      cityId: query.cityId,
      ...(query.districtId === undefined ? {} : { districtId: query.districtId }),
      startsAt: query.startsAt,
      endsAt: query.endsAt,
      crewPreference: query.crewPreference,
      requiredTeamUnits: query.requiredTeamUnits,
      locale: query.locale,
      ...(query.maxPriceAmount === undefined
        ? {}
        : { maxPriceAmount: query.maxPriceAmount }),
      ...(query.q === undefined ? {} : { q: query.q }),
    });
    let offset = 0;
    let sorted: readonly {
      readonly providerId: string;
      readonly teamId: string;
      readonly sortingFacts: BrowseEnrichedCandidate["sortingFacts"];
    }[];
    let metadata: BrowseProviderListResult["metadata"];
    if (query.cursor !== undefined) {
      const decoded = decodeBrowseCursor(query.cursor, this.deps.cursorSecret);
      if (decoded.filterDigest !== filterDigest) {
        throw browseError("VALIDATION_FAILED", { field: "cursor" });
      }
      const snapshot = this.getPageSnapshot(decoded.resultHash, filterDigest);
      if (snapshot === null || decoded.offset >= snapshot.candidates.length) {
        throw browseError("VALIDATION_FAILED", { field: "cursor" });
      }
      sorted = snapshot.candidates;
      metadata = snapshot.metadata;
      offset = decoded.offset;
    } else {
      const projection = await this.evaluateBrowse(this.toEvaluationInput(query));
      const candidates =
        query.q === undefined
          ? projection.candidates.map((candidate) => ({
              ...candidate,
              displayName: null,
              thumb: null,
            }))
          : await this.enrichCandidates(
              projection.candidates,
              query.locale,
              false,
            );
      sorted = filterAndSortBrowseCandidates({
        candidates,
        ...(query.maxPriceAmount === undefined
          ? {}
          : { maxPriceAmount: query.maxPriceAmount }),
        ...(query.q === undefined ? {} : { q: query.q }),
      }).map((candidate) => ({
        providerId: candidate.providerId,
        teamId: candidate.teamId,
        sortingFacts: candidate.sortingFacts,
      }));
      metadata = {
        resultHash: projection.metadata.resultHash,
        ruleVersionId: projection.metadata.ruleVersionId,
        evaluatedAt: projection.metadata.evaluatedAt,
      };
    }
    const pageCandidates = sorted.slice(offset, offset + query.limit);
    const page = await this.enrichCandidates(pageCandidates, query.locale, true);
    const nextOffset = offset + pageCandidates.length;
    const nextCursor =
      nextOffset < sorted.length
        ? encodeBrowseCursor(
            {
              resultHash: metadata.resultHash,
              filterDigest,
              offset: nextOffset,
            },
            this.deps.cursorSecret,
          )
        : null;

    if (nextCursor !== null) {
      this.rememberPageSnapshot({
        resultHash: metadata.resultHash,
        filterDigest,
        candidates: sorted,
        metadata,
      });
    }

    return {
      items: page.map((item) => ({
        providerId: item.providerId,
        teamId: item.teamId,
        displayName: item.displayName,
        thumb: item.thumb,
        sortingFacts: item.sortingFacts,
      })),
      nextCursor,
      metadata,
      sideEffects: {
        bookingCreated: false,
        paymentInitiated: false,
      },
    };
  }

  public async getEligibleProviderDetail(input: {
    readonly providerId: string;
    readonly teamId: string;
    readonly query: BrowseProvidersQuery | Omit<
      BrowseProvidersQuery,
      "maxPriceAmount" | "q" | "limit" | "cursor"
    >;
    readonly principal?: AuthenticationPrincipal | null;
  }): Promise<BrowseProviderDetailResult> {
    const projection = await this.evaluateBrowse(
      this.toEvaluationInput(input.query),
    );
    const match = projection.candidates.find(
      (candidate) =>
        candidate.providerId === input.providerId &&
        candidate.teamId === input.teamId,
    );
    if (match === undefined) {
      throw browseError("BROWSE_PROVIDER_NOT_FOUND");
    }

    const [preview, crewSummary] = await Promise.all([
      this.deps.providers.getContactFreePreview(input.providerId),
      this.getCrewSummary({
        providerId: input.providerId,
        teamId: input.teamId,
      }),
    ]);
    if (preview === null || crewSummary === null) {
      throw browseError("BROWSE_PROVIDER_NOT_FOUND");
    }

    const servicePrice = await this.resolveServicePrice({
      providerId: input.providerId,
      serviceId: input.query.serviceId,
      countryId: input.query.countryId,
      locale: input.query.locale,
      fallback: match.sortingFacts,
    });

    return {
      providerId: input.providerId,
      teamId: input.teamId,
      profile: preview,
      crewSummary,
      servicePrice,
      ratingSummary: null,
      bookingPrerequisites: bookingPrerequisitesFor(input.principal ?? null),
      sideEffects: {
        bookingCreated: false,
        paymentInitiated: false,
      },
    };
  }

  private toEvaluationInput(query: {
    readonly serviceId: string;
    readonly countryId: string;
    readonly cityId: string;
    readonly districtId?: string | undefined;
    readonly startsAt: string;
    readonly endsAt: string;
    readonly crewPreference: "all_male" | "all_female" | "any";
    readonly requiredTeamUnits: number;
  }): {
    readonly serviceId: string;
    readonly countryId: string;
    readonly cityId: string;
    readonly districtId?: string;
    readonly startsAt: string;
    readonly endsAt: string;
    readonly crewPreference: "all_male" | "all_female" | "any";
    readonly requiredTeamUnits: number;
  } {
    return {
      serviceId: query.serviceId,
      countryId: query.countryId,
      cityId: query.cityId,
      startsAt: query.startsAt,
      endsAt: query.endsAt,
      crewPreference: query.crewPreference,
      requiredTeamUnits: query.requiredTeamUnits,
      ...(query.districtId === undefined ? {} : { districtId: query.districtId }),
    };
  }

  private async evaluateBrowse(
    query: {
      readonly serviceId: string;
      readonly countryId: string;
      readonly cityId: string;
      readonly districtId?: string;
      readonly startsAt: string;
      readonly endsAt: string;
      readonly crewPreference: "all_male" | "all_female" | "any";
      readonly requiredTeamUnits: number;
    },
  ) {
    try {
      return await this.deps.eligibility.getStandardBrowseCandidates({
        serviceId: query.serviceId,
        countryId: query.countryId,
        cityId: query.cityId,
        ...(query.districtId === undefined
          ? {}
          : { districtId: query.districtId }),
        startsAt: query.startsAt,
        endsAt: query.endsAt,
        crewPreference: query.crewPreference,
        requiredTeamUnits: query.requiredTeamUnits,
        mode: "discovery",
      });
    } catch (error) {
      if (isEligibilityError(error) && error.code === "VALIDATION_FAILED") {
        throw browseError("VALIDATION_FAILED", error.details);
      }
      if (isEligibilityError(error) && error.code === "UNSUPPORTED_GEO_INPUT") {
        throw browseError("VALIDATION_FAILED", { reason: error.code });
      }
      throw browseError("BROWSE_EVALUATION_FAILED", {
        reason: isEligibilityError(error) ? error.code : "UNKNOWN",
      });
    }
  }

  private async enrichCandidates(
    candidates: readonly {
      readonly providerId: string;
      readonly teamId: string;
      readonly sortingFacts: BrowseEnrichedCandidate["sortingFacts"];
    }[],
    locale: "AR" | "EN",
    includeMedia: boolean,
  ): Promise<BrowseEnrichedCandidate[]> {
    const uniqueProviderIds = [...new Set(candidates.map((c) => c.providerId))];
    const previewEntries: Array<
      readonly [
        string,
        Awaited<
          ReturnType<
            BookingsBrowseDependencies["providers"]["getContactFreePreview"]
          >
        >,
      ]
    > = [];
    for (
      let start = 0;
      start < uniqueProviderIds.length;
      start += BROWSE_PREVIEW_CONCURRENCY
    ) {
      const batch = uniqueProviderIds.slice(
        start,
        start + BROWSE_PREVIEW_CONCURRENCY,
      );
      previewEntries.push(
        ...(await Promise.all(
          batch.map(async (providerId) => {
            const preview =
              await this.deps.providers.getContactFreePreview(providerId, {
                includeMedia,
              });
            return [providerId, preview] as const;
          }),
        )),
      );
    }
    const previews = new Map(previewEntries);
    return candidates.map((candidate) => {
      const preview = previews.get(candidate.providerId) ?? null;
      return {
        providerId: candidate.providerId,
        teamId: candidate.teamId,
        sortingFacts: candidate.sortingFacts,
        displayName: pickDisplayName(preview, locale),
        thumb: preview?.logo ?? null,
      };
    });
  }

  private snapshotKey(resultHash: string, filterDigest: string): string {
    return `${resultHash}.${filterDigest}`;
  }

  private prunePageSnapshots(nowMs: number): void {
    for (const [key, snapshot] of this.pageSnapshots) {
      if (snapshot.expiresAtMs <= nowMs) {
        this.pageSnapshots.delete(key);
      }
    }
    while (this.pageSnapshots.size >= BROWSE_SNAPSHOT_MAX_ENTRIES) {
      const oldest = this.pageSnapshots.keys().next().value as string | undefined;
      if (oldest === undefined) {
        break;
      }
      this.pageSnapshots.delete(oldest);
    }
  }

  private rememberPageSnapshot(input: {
    readonly resultHash: string;
    readonly filterDigest: string;
    readonly candidates: BrowsePageSnapshot["candidates"];
    readonly metadata: BrowsePageSnapshot["metadata"];
  }): void {
    const nowMs = Date.now();
    this.prunePageSnapshots(nowMs);
    const key = this.snapshotKey(input.resultHash, input.filterDigest);
    this.pageSnapshots.delete(key);
    this.pageSnapshots.set(key, {
      expiresAtMs: nowMs + BROWSE_SNAPSHOT_TTL_MS,
      filterDigest: input.filterDigest,
      candidates: input.candidates,
      metadata: input.metadata,
    });
  }

  private getPageSnapshot(
    resultHash: string,
    filterDigest: string,
  ): BrowsePageSnapshot | null {
    const nowMs = Date.now();
    this.prunePageSnapshots(nowMs);
    const snapshot = this.pageSnapshots.get(
      this.snapshotKey(resultHash, filterDigest),
    );
    if (snapshot === undefined || snapshot.filterDigest !== filterDigest) {
      return null;
    }
    return snapshot;
  }

  private async assertActiveCountryCode(countryCode: string): Promise<void> {
    try {
      await this.deps.activeCountries.resolveActiveCountry(countryCode);
    } catch (error) {
      if (
        error !== null &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "COUNTRY_UNAVAILABLE"
      ) {
        throw browseError("COUNTRY_UNAVAILABLE");
      }
      throw error;
    }
  }

  private async callCatalog<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!isCatalogError(error)) {
        throw error;
      }
      if (error.code === "CATALOG_COUNTRY_UNAVAILABLE") {
        throw browseError("COUNTRY_UNAVAILABLE");
      }
      if (error.code === "CATALOG_VALIDATION_FAILED") {
        throw browseError("VALIDATION_FAILED", error.details);
      }
      if (error.code === "CATALOG_NOT_FOUND") {
        throw browseError("BROWSE_SERVICE_NOT_FOUND");
      }
      throw browseError("BROWSE_EVALUATION_FAILED", {
        dependency: "catalog",
        reason: error.code,
      });
    }
  }

  private async resolveServicePrice(input: {
    readonly providerId: string;
    readonly serviceId: string;
    readonly countryId: string;
    readonly locale: "AR" | "EN";
    readonly fallback: BrowseEnrichedCandidate["sortingFacts"];
  }): Promise<BrowseProviderDetailResult["servicePrice"]> {
    if (this.deps.serviceSnapshots === undefined) {
      return {
        status: "AVAILABLE",
        priceAmount: input.fallback.priceAmount,
        minimumChargeAmount: input.fallback.minimumChargeAmount,
        currencyCode: input.fallback.currencyCode,
        priceUnitId: input.fallback.priceUnitId,
        estimatedDurationMinutes: input.fallback.estimatedDurationMinutes,
      };
    }
    const country = await this.deps.activeCountries.getActiveCountryById(
      input.countryId,
    );
    if (country === null) {
      throw browseError("COUNTRY_UNAVAILABLE");
    }
    const definition = await this.callCatalog(() =>
      this.deps.catalog.getSnapshotReadyDefinitionById({
        serviceId: input.serviceId,
        countryCode: country.code,
        locale: input.locale,
      }),
    );
    if (definition === null) {
      return { status: "UNAVAILABLE" };
    }
    const snapshot = await this.deps.serviceSnapshots.getSnapshotReadyFacts({
      providerId: input.providerId,
      catalogServiceCode: definition.serviceCode,
      countryCode: country.code,
      locale: input.locale,
    });
    if (snapshot.status !== "AVAILABLE") {
      return { status: "UNAVAILABLE" };
    }
    return {
      status: "AVAILABLE",
      priceAmount: snapshot.value.price,
      minimumChargeAmount: snapshot.value.minimumCharge,
      currencyCode: snapshot.value.currencyCode,
      priceUnitId: snapshot.value.priceUnit.id,
      estimatedDurationMinutes: snapshot.value.estimatedDurationMinutes,
    };
  }
}
