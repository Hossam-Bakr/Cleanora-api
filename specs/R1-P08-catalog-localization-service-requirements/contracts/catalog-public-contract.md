# Catalog Public Contracts

**Implementation destination:** `src/modules/catalog/catalog.public.ts`

The file is the only Catalog entry point for another business module. It
contains stable DTOs/interfaces and optional composition factories; it exports
no Prisma model, repository, controller, route, internal policy, or raw
transaction client.

"Public" here means module-public inside the modular monolith; it does not mean
anonymous or customer-facing HTTP. R1-P08 exposes protected staff management
HTTP only. R1-P12 owns any later Catalog Browse route and its actor-facing
authorization, and must consume this contract rather than Catalog persistence.

## Locales and stable values

```ts
export type CatalogLocale = "AR" | "EN";

export type CatalogServiceFieldKind =
  | "INFORMATION"
  | "TEXT"
  | "NUMBER"
  | "BOOLEAN"
  | "SINGLE_SELECT"
  | "MULTI_SELECT";
```

These are contract illustrations, not implementation code to copy blindly.

## Selectable service summary

```ts
export interface SelectableCatalogServiceSummary {
  readonly serviceId: string;
  readonly serviceCode: string;
  readonly serviceVersion: number;
  readonly categoryId: string;
  readonly categoryCode: string;
  readonly name: string;
  readonly description: string;
  readonly categoryName: string;
  readonly displayOrder: number;
}
```

Only exact-locale, active, complete, country-available services appear. The DTO
does not expose inactive states, untranslated content, management receipt IDs,
audit facts, or persistence timestamps.

## Snapshot-ready current definition

```ts
export interface CatalogPriceUnitDefinition {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly displayOrder: number;
}

export interface CatalogFieldOptionDefinition {
  readonly id: string;
  readonly value: string;
  readonly label: string;
  readonly displayOrder: number;
}

export interface CatalogFieldDefinition {
  readonly id: string;
  readonly code: string;
  readonly kind: CatalogServiceFieldKind;
  readonly label: string;
  readonly helpText: string | null;
  readonly required: boolean;
  readonly textBounds: { readonly min: number | null; readonly max: number | null } | null;
  readonly numberRules: {
    readonly mode: "INTEGER" | "DECIMAL";
    readonly min: string | null;
    readonly max: string | null;
  } | null;
  readonly selectionBounds: {
    readonly min: number | null;
    readonly max: number | null;
  } | null;
  readonly options: readonly CatalogFieldOptionDefinition[];
  readonly displayOrder: number;
}

export interface CatalogMediaReference {
  readonly associationId: string;
  readonly mediaId: string;
  readonly contentType: "image/jpeg" | "image/png" | "image/webp";
  readonly width: number;
  readonly height: number;
  readonly displayOrder: number;
}

export interface SnapshotReadyCatalogServiceDefinition {
  readonly serviceId: string;
  readonly serviceCode: string;
  readonly serviceVersion: number;
  readonly category: {
    readonly id: string;
    readonly code: string;
    readonly name: string;
    readonly description: string;
  };
  readonly locale: CatalogLocale;
  readonly countryCode: string;
  readonly name: string;
  readonly description: string;
  readonly priceUnits: readonly CatalogPriceUnitDefinition[];
  readonly fields: readonly CatalogFieldDefinition[];
  readonly media: readonly CatalogMediaReference[];
}
```

Decimal bounds are strings to avoid binary floating-point ambiguity. This is
current copy-ready truth only; the later owning module chooses when/how to
persist a historical snapshot.

## Reader interface

```ts
export interface CatalogDefinitionReader {
  listSelectable(input: {
    readonly countryCode: string;
    readonly locale: CatalogLocale;
    readonly cursor?: string;
    readonly limit?: number;
  }): Promise<{
    readonly items: readonly SelectableCatalogServiceSummary[];
    readonly nextCursor: string | null;
  }>;

  getSnapshotReadyDefinition(input: {
    readonly serviceCode: string;
    readonly countryCode: string;
    readonly locale: CatalogLocale;
  }): Promise<SnapshotReadyCatalogServiceDefinition | null>;
}
```

- `null` means not selectable for the requested country/locale or not found;
  callers do not receive a draft-leaking distinction.
- Reads use one database snapshot and one service aggregate version.
- The internal contract returns stable Media references, not signed URLs.
  Protected staff management presentation may ask Media for short-lived
  delivery URLs separately; a later R1-P12 Browse surface requires its own
  specification and authorization.
- The interface does not authorize a caller to create Provider offerings,
  eligibility results, Booking records, answers, or snapshots in R1-P08.

## Media public additions consumed by Catalog

The owning file remains `src/modules/media/media.public.ts`.

```ts
export interface CatalogServiceImageReceipt {
  readonly mediaFileId: string;
  readonly ownerUserId: string;
  readonly state: "PROCESSING" | "READY" | "FAILED";
  readonly canonicalContentType: "image/jpeg" | "image/png" | "image/webp";
  readonly byteSize: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly safeReceiptId: string;
}

export interface CatalogServiceImagePort {
  ingest(input: {
    readonly mediaFileId: string;
    readonly ownerUserId: string;
    readonly declaredContentType: string;
    readonly bytes: Buffer;
  }): Promise<CatalogServiceImageReceipt>;
  readValidationReceipt(mediaFileId: string): Promise<CatalogServiceImageReceipt | null>;
  issueDelivery(input: {
    readonly mediaFileId: string;
    readonly purpose: "CATALOG_SERVICE_PRESENTATION";
  }): Promise<{ readonly url: string; readonly expiresAt: Date }>;
  requestCleanup(input: {
    readonly mediaFileId: string;
    readonly safeReasonCode: string;
  }): Promise<void>;
}

export interface TransactionalCatalogServiceImageAuthorizer {
  assertReadyCatalogServiceImage(input: {
    readonly mediaFileId: string;
    readonly uploaderUserId: string;
  }): Promise<boolean>;
}
```

Composition injects a transaction-bound authorizer factory. Catalog never
imports Media infrastructure.

## Authentication additions consumed by Catalog

- `ProtectedOperationAuthorizer` already exists and remains the only runtime
  authorization seam.
- Extend public reason-operation types with `CATALOG_MANAGEMENT_WRITE` and keep
  lookup behavior Authentication-owned.
- Catalog passes the trusted principal plus `scope: { kind: "GLOBAL" }`; it does
  not pass a body-supplied role, permission, or actor ID.

## Admin audit contract

Catalog uses the existing `PrivilegedAuditWriter` inside its transaction. No new
Catalog-specific audit interface/table is introduced. Composition may inject
the Admin infrastructure factory into the Catalog repository/unit-of-work, but
Catalog application/domain files import only `admin/audit.public.ts` types.
