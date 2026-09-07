/**
 * Persistence-only Provider Service ports and transaction participants.
 * Domain/services never receive raw Prisma clients; the UoW constructs public
 * Catalog/Configuration/Authentication/Admin readers from composition factories.
 */

import type { GeneralTransactionalAuditWriter } from "#modules/admin/audit.public";
import type { TransactionalProviderServiceStaffAuthorizer } from "#modules/authentication/authentication.public";
import type { CatalogDefinitionReader } from "#modules/catalog/catalog.public";
import type { ProviderServicePricingPolicyReader } from "#modules/configuration/configuration.public";

import type {
  MinorUnitsDigitString,
  ProviderServiceCommandMeta,
  ProviderServiceNotePair,
  ProviderServicePriceHistoryInput,
  ProviderServicePriceHistorySnapshot,
  ProviderServicePriceSnapshot,
  ProviderServicePriceStatus,
  ProviderServiceReceiptLookup,
  ProviderServiceReadinessProjection,
  ProviderServiceSnapshot,
  ProviderServiceStatusHistoryInput,
  ProviderServiceStatusHistorySnapshot,
  VersionedProviderServiceCommand,
} from "./provider-service.types.js";

/** Catalog public reader (includes R1-P09 offering reference lookups). */
export type ProviderServiceCatalogDefinitionReader = CatalogDefinitionReader;

/** Configuration public country pricing-policy reader. */
export type ProviderServicePricingPolicyReaderPort =
  ProviderServicePricingPolicyReader;

/** Authentication public transaction-bound Staff price-approval authorizer. */
export type ProviderServiceStaffAuthorizer =
  TransactionalProviderServiceStaffAuthorizer;

export interface CreateProviderServiceOfferingInput {
  readonly providerId: string;
  readonly providerServiceId: string;
  readonly catalogServiceId: string;
  readonly estimatedDurationMinutes: number;
  readonly notes: ProviderServiceNotePair;
  readonly expectedCreateVersion: 0;
}

export interface UpdateProviderServiceConfigurationInput
  extends VersionedProviderServiceCommand {
  readonly providerServiceId: string;
  readonly estimatedDurationMinutes: number;
  readonly notes: ProviderServiceNotePair;
}

export interface SetProviderServiceEnabledInput
  extends VersionedProviderServiceCommand {
  readonly providerServiceId: string;
  readonly enabled: boolean;
}

export interface CreateProviderServicePriceInput {
  readonly id: string;
  readonly providerId: string;
  readonly providerServiceId: string;
  readonly catalogServiceId: string;
  readonly catalogPriceUnitId: string;
  readonly priceUnitCodeAtProposal: string;
  readonly countryIdAtProposal: string;
  readonly countryCodeAtProposal: string;
  readonly currencyId: string;
  readonly currencyCode: string;
  readonly currencyDecimalPlaces: number;
  readonly providerPriceMinorUnits: MinorUnitsDigitString;
  readonly minimumChargeMinorUnits: MinorUnitsDigitString;
  readonly maximumPriceMinorUnitsAtProposal: MinorUnitsDigitString;
  readonly approvalRequiredAtProposal: boolean;
  readonly status: Extract<ProviderServicePriceStatus, "PENDING" | "EFFECTIVE">;
  readonly proposedByUserId: string;
  readonly effectiveAt: Date | null;
  readonly createdAt: Date;
}

export interface TransitionProviderServicePriceInput {
  readonly providerId: string;
  readonly providerServiceId: string;
  readonly providerServicePriceId: string;
  readonly fromStatus: ProviderServicePriceStatus;
  readonly toStatus: Extract<
    ProviderServicePriceStatus,
    "EFFECTIVE" | "REJECTED" | "SUPERSEDED"
  >;
  readonly transitionedAt: Date;
}

export interface ProviderServiceCursorPage {
  readonly limit: number;
  readonly cursorCreatedAt?: Date;
  readonly cursorId?: string;
}

/** Persistence row for Staff pending-price queue enrichment. */
export interface StaffPendingPricePersistenceRow {
  readonly price: ProviderServicePriceSnapshot;
  readonly offeringVersion: number;
  readonly providerDisplayNameAr: string | null;
  readonly providerDisplayNameEn: string | null;
}

/**
 * Persistence-only operations for the four R1-P09 Provider Service tables.
 * No Catalog/Configuration/business orchestration belongs here.
 */
export interface ProviderServiceRepository {
  lockProviderScope(providerId: string): Promise<{
    readonly id: string;
    readonly applicationStatus: string;
    readonly operationalStatus: string;
    readonly countryId: string | null;
    readonly countryCode: string | null;
  } | null>;

  /**
   * Safe Provider display names for Staff queue/dossier enrichment.
   * Never returns contacts or other private profile fields.
   */
  findProviderDisplayIdentity(providerId: string): Promise<{
    readonly displayNameAr: string | null;
    readonly displayNameEn: string | null;
  } | null>;

  /**
   * Exact Provider membership for authorization. Mutations should call the
   * locking variant; management reads may use the non-locking finder.
   */
  findActorMembership(
    providerId: string,
    actorUserId: string,
  ): Promise<{
    readonly level: "OWNER" | "ADMIN";
    readonly active: boolean;
  } | null>;

  lockActorMembership(
    providerId: string,
    actorUserId: string,
  ): Promise<{
    readonly level: "OWNER" | "ADMIN";
    readonly active: boolean;
  } | null>;

  findOffering(
    providerId: string,
    providerServiceId: string,
  ): Promise<ProviderServiceSnapshot | null>;

  lockOffering(
    providerId: string,
    providerServiceId: string,
  ): Promise<ProviderServiceSnapshot | null>;

  findOfferingByCatalogService(
    providerId: string,
    catalogServiceId: string,
  ): Promise<ProviderServiceSnapshot | null>;

  listOfferings(
    providerId: string,
    page: ProviderServiceCursorPage,
  ): Promise<readonly ProviderServiceSnapshot[]>;

  createOffering(
    input: CreateProviderServiceOfferingInput,
  ): Promise<ProviderServiceSnapshot>;

  updateConfiguration(
    input: UpdateProviderServiceConfigurationInput,
  ): Promise<ProviderServiceSnapshot>;

  setEnabled(
    input: SetProviderServiceEnabledInput,
  ): Promise<ProviderServiceSnapshot>;

  /**
   * Compare-and-increment `(id, provider_id, version)`. Zero rows maps to
   * version conflict at the service layer.
   */
  bumpAggregateVersion(input: {
    readonly providerId: string;
    readonly providerServiceId: string;
    readonly expectedVersion: number;
  }): Promise<ProviderServiceSnapshot | null>;

  findPrice(
    providerId: string,
    providerServiceId: string,
    providerServicePriceId: string,
  ): Promise<ProviderServicePriceSnapshot | null>;

  findCurrentEffectivePrice(
    providerId: string,
    providerServiceId: string,
  ): Promise<ProviderServicePriceSnapshot | null>;

  findCurrentPendingPrice(
    providerId: string,
    providerServiceId: string,
  ): Promise<ProviderServicePriceSnapshot | null>;

  createPrice(
    input: CreateProviderServicePriceInput,
  ): Promise<ProviderServicePriceSnapshot>;

  transitionPriceStatus(
    input: TransitionProviderServicePriceInput,
  ): Promise<ProviderServicePriceSnapshot>;

  listPricesForOffering(
    providerId: string,
    providerServiceId: string,
    page: ProviderServiceCursorPage,
  ): Promise<readonly ProviderServicePriceSnapshot[]>;

  listPendingPricesForStaff(
    page: ProviderServiceCursorPage & {
      readonly providerId?: string;
      readonly countryCode?: string;
    },
  ): Promise<readonly StaffPendingPricePersistenceRow[]>;

  findReceipt(input: {
    readonly scopeKey: string;
    readonly idempotencyKey: string;
  }): Promise<ProviderServiceReceiptLookup | null>;

  appendPriceHistory(
    input: ProviderServicePriceHistoryInput,
  ): Promise<ProviderServicePriceHistorySnapshot>;

  appendStatusHistory(
    input: ProviderServiceStatusHistoryInput,
  ): Promise<ProviderServiceStatusHistorySnapshot>;

  listPriceHistory(input: {
    readonly providerId: string;
    readonly providerServiceId: string;
    readonly page: ProviderServiceCursorPage;
  }): Promise<readonly ProviderServicePriceHistorySnapshot[]>;

  listManagementStatusHistory(input: {
    readonly providerId: string;
    readonly providerServiceId: string;
    readonly page: ProviderServiceCursorPage;
  }): Promise<readonly ProviderServiceStatusHistorySnapshot[]>;

  /** Bounded enabled/current-effective projections for readiness evaluation. */
  listReadinessProjections(
    providerId: string,
  ): Promise<readonly ProviderServiceReadinessProjection[]>;

  findEnabledOfferingWithEffectivePrice(input: {
    readonly providerId: string;
    readonly catalogServiceId: string;
  }): Promise<{
    readonly offering: ProviderServiceSnapshot;
    readonly effectivePrice: ProviderServicePriceSnapshot;
  } | null>;
}

export interface ProviderServiceTransactionContext {
  readonly identityReader: import("#modules/authentication/authentication.public").ProviderIdentityReader;
  readonly providerServices: ProviderServiceRepository;
  readonly catalog: ProviderServiceCatalogDefinitionReader;
  readonly pricingPolicy: ProviderServicePricingPolicyReaderPort;
  readonly staffAuthorizer: ProviderServiceStaffAuthorizer;
  readonly audit: GeneralTransactionalAuditWriter;
}

/**
 * Providers-owned UoW. Mutations use serializable isolation; readiness and
 * snapshot reads use repeatable-read isolation with bounded whole-tx retry
 * owned by the calling service.
 */
export interface ProviderServiceUnitOfWork {
  runMutation<T>(
    work: (context: ProviderServiceTransactionContext) => Promise<T>,
  ): Promise<T>;

  runReadSnapshot<T>(
    work: (context: ProviderServiceTransactionContext) => Promise<T>,
  ): Promise<T>;
}

export type { ProviderServiceCommandMeta };
