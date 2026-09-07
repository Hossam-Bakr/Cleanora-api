# Planned Module-Public Contracts: R1-P09

**Status**: Design only — none of these TypeScript contracts or implementations
exists yet.

## Providers Public Contract

`src/modules/providers/providers.public.ts` will add only safe plain DTOs and
interfaces. It must not export repositories, Prisma types, HTTP controllers,
transaction clients, pending/rejected prices, or management histories.

### `ProviderServicesReadyFacts`

```ts
export type ProviderServicesReadyBlockerCode =
  | "NO_PROVIDER_SERVICES"
  | "NO_ENABLED_PROVIDER_SERVICE"
  | "CATALOG_SERVICE_UNAVAILABLE"
  | "PRICE_UNIT_UNAVAILABLE"
  | "NO_EFFECTIVE_PRICE"
  | "PRICE_APPROVAL_PENDING"
  | "OFFERING_CONFIGURATION_INVALID";

export interface ProviderServicesReadyFacts {
  readonly providerId: string;
  readonly servicesReady: boolean;
  readonly qualifyingOfferingCount: number;
  readonly blockerCodes: readonly ProviderServicesReadyBlockerCode[];
}
```

`ProviderPublicReader.getMarketplaceReadiness` consumes these facts to replace
the current R1-P09 deferred gate; `eligibleForPublicBrowse` remains the literal
type/value `false`.

### `ProviderServiceSnapshotReader`

```ts
export type ProviderServiceExactLocale = "AR" | "EN";

export interface ProviderServiceSnapshotReadyValue {
  readonly providerId: string;
  readonly providerServiceId: string;
  readonly providerServiceVersion: number;
  readonly catalogServiceId: string;
  readonly catalogServiceCode: string;
  readonly catalogServiceVersion: number;
  readonly estimatedDurationMinutes: number;
  readonly serviceNote: string | null;
  readonly providerServicePriceId: string;
  readonly price: string;
  readonly minimumCharge: string;
  readonly currencyCode: string;
  readonly effectiveAt: string;
  readonly priceUnit: {
    readonly id: string;
    readonly code: string;
    readonly label: string;
  };
  readonly catalogDefinition: SnapshotReadyCatalogServiceDefinition;
}

export type ProviderServiceSnapshotReadyResult =
  | {
      readonly status: "AVAILABLE";
      readonly value: ProviderServiceSnapshotReadyValue;
    }
  | { readonly status: "UNAVAILABLE" }
  | {
      readonly status: "CONFLICT";
      readonly code: "PROVIDER_SERVICE_SNAPSHOT_CONFLICT";
    };

export interface ProviderServiceSnapshotReader {
  getSnapshotReadyFacts(input: {
    readonly providerId: string;
    readonly catalogServiceCode: string;
    readonly countryCode: string;
    readonly locale: ProviderServiceExactLocale;
  }): Promise<ProviderServiceSnapshotReadyResult>;
}
```

The concrete factory returns a narrowed wrapper just as existing public
contracts do. Composition controls which later module receives it. R1-P09 does
not expose an HTTP adapter and never persists the returned value. Its concrete
implementation runs through a Providers-owned repeatable-read UoW whose Catalog
and Configuration participants share the same opaque transaction snapshot.

## Catalog Public Contract Extension

`CatalogDefinitionReader` remains the only Providers dependency. Add an
ID-based management/current lookup so an existing offering can be revalidated
without storing Catalog code/name/labels in mutable Provider state:

```ts
export interface ProviderOfferingCatalogReference {
  readonly serviceId: string;
  readonly serviceCode: string;
  readonly serviceVersion: number;
  readonly selectableForCountry: boolean;
  readonly activePriceUnits: readonly {
    readonly id: string;
    readonly code: string;
  }[];
}

export interface CatalogDefinitionReader {
  // existing listSelectable(...)
  // existing getSnapshotReadyDefinition({ serviceCode, countryCode, locale })

  resolveSelectableProviderOffering(input: {
    readonly serviceCode: string;
    readonly countryCode: string;
  }): Promise<ProviderOfferingCatalogReference | null>;

  getProviderOfferingReference(input: {
    readonly serviceId: string;
    readonly countryCode: string;
  }): Promise<ProviderOfferingCatalogReference | null>;

  getSnapshotReadyDefinitionById(input: {
    readonly serviceId: string;
    readonly countryCode: string;
    readonly locale: CatalogLocale;
  }): Promise<SnapshotReadyCatalogServiceDefinition | null>;
}

export type TransactionalCatalogDefinitionReaderFactory = (
  transactionContext: unknown,
) => CatalogDefinitionReader;
```

Catalog owns all methods' selectability, completeness, country, unit, exact-
locale, field/option, and media rules. `null` and `selectableForCountry=false`
must not leak draft details beyond the safe reference. Providers may compare
returned IDs/codes/versions but never import Catalog internals.

Creation uses the non-localized `resolveSelectableProviderOffering` method and
validates the selected unit against its active-unit list; it does not invent a
locale. Existing offering/readiness paths use the ID-based methods. The exact-
locale internal snapshot uses the existing `getSnapshotReadyDefinition`.

## Configuration Public Contract Extension

Configuration adds a dedicated resolved reader rather than exposing generic
repository/config-table access:

```ts
export interface ProviderServicePricingPolicy {
  readonly countryId: string;
  readonly countryCode: string;
  readonly currency: {
    readonly id: string;
    readonly code: string;
    readonly decimalPlaces: number;
  };
  readonly approvalRequired: boolean;
  readonly maximumPrice: string;
}

```

The implementation owns `providers.service_pricing_policy`, resolves the active
country and default currency, and validates `decimalPlaces` 0–30 plus a
canonical positive `maximumPrice` that converts to at most 65 minor-unit digits.
The read result is explicit rather than ambiguous:

```ts
export type ProviderServicePricingPolicyResult =
  | {
      readonly status: "AVAILABLE";
      readonly value: ProviderServicePricingPolicy;
    }
  | {
      readonly status: "UNAVAILABLE";
      readonly code:
        | "COUNTRY_UNAVAILABLE"
        | "CURRENCY_UNAVAILABLE"
        | "PROVIDER_SERVICE_PRICING_POLICY_UNAVAILABLE";
    };

export interface ProviderServicePricingPolicyReader {
  readForCountry(input: {
    readonly countryCode: string;
  }): Promise<ProviderServicePricingPolicyResult>;
}

export type TransactionalProviderServicePricingPolicyReaderFactory = (
  transactionContext: unknown,
) => ProviderServicePricingPolicyReader;
```

Providers never supplies currency and never receives a generic config
repository or raw transaction.

## Authentication Public Contract Extension

Add `providers.services.prices.approve` to the Staff permission union and expose
the existing transaction-bound authorization pattern for it:

```ts
export type ProviderServiceStaffPermissionCode =
  "providers.services.prices.approve";

export interface TransactionalProviderServiceStaffAuthorizer {
  authorize(
    actorUserId: string,
    permission: ProviderServiceStaffPermissionCode,
  ): Promise<boolean>;
}

export type TransactionalProviderServiceStaffAuthorizerFactory = (
  transaction: unknown,
) => TransactionalProviderServiceStaffAuthorizer;
```

The opaque transaction value is interpreted only by the Authentication-owned
factory created in composition. Providers never imports Authentication's
Prisma/grant internals. Existing Provider-admin identity facts and Providers-
owned membership checks cover OWNER/ADMIN management operations.

## Review-verified transaction participants

Provider management commands and private reads recheck the existing
`ProviderIdentityReader` inside their database transaction using Authentication's
`createTransactionalProviderIdentityReader(transaction: unknown)` public factory.
The outer identity check does not substitute for current transactional account
and global role facts. Exact Provider membership remains Providers-owned.

Configuration also exposes `ProviderServiceCountryIdentityReader` with
`getCountryCodeById(countryId: string): Promise<string | null>` and the public
`createTransactionalProviderServiceCountryIdentityReader(transaction: unknown)`
factory. It resolves only country identity, including an inactive country during
remediation. Current country, currency, scale and maximum validity remain the
pricing-policy reader's responsibility. Providers never joins Configuration's
tables directly. These factories keep raw transactions inside infrastructure.

## Admin Audit Contract Reuse

No new Admin contract is expected. Composition passes the existing
transaction-bound `GeneralTransactionalAuditWriter` into the Providers unit of
work. Provider-service code supplies only allowlisted actor/action/target/
reason/request/before/after facts. Admin remains the sole owner of `audit_logs`.

## Dependency Rules

```text
Providers service
  ├─> CatalogDefinitionReader + transactional factory
  │                                           (Catalog public only)
  ├─> ProviderServicePricingPolicyReader + transactional factory
  │                                           (Configuration public only)
  ├─> Authentication public authorizers    (Authentication public only)
  ├─> GeneralTransactionalAuditWriter       (Admin public only)
  └─> Providers-owned repository/UoW       (four R1-P09 tables only)

Later Booking owner
  └─> ProviderServiceSnapshotReader         (Providers public only)
```

Module-boundary tests must reject Providers imports from Catalog/
Configuration/Authentication/Admin repositories, services, domain policies,
controllers, generated Prisma models, or raw persistence types. They must also
reject Catalog imports of Provider pricing and any Booking import/storage in
R1-P09.

The Providers infrastructure UoW—not Provider domain/service code—receives the
public transaction-participant factories from composition, invokes them with
its opaque Prisma transaction, and passes only the resulting reader interfaces
to the service callback. Mutation transactions use serializable isolation;
readiness/current snapshot transactions use repeatable-read isolation with a
bounded whole-transaction retry.
