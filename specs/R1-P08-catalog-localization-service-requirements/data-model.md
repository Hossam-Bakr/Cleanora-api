# R1-P08 Data Model

**Status:** Design complete; implementation belongs to `speckit-implement`
**Migration:** `r1_p08_catalog_localization_service_requirements`

## Ownership and aggregate boundaries

- Catalog owns every model in this document except `Country`, `MediaFile`,
  authentication authorization tables, and `AuditLog`.
- Category is one mutable aggregate with its own integer `version`.
- Service is one mutable aggregate. Its `version` covers its row,
  translations, price units, fields/options, country availability, and media
  presentation.
- Configuration owns `Country`; Catalog stores an FK only after resolving an
  active country through Configuration's public contract.
- Media owns `MediaFile`; Catalog stores an FK in its association table only
  after Media's public contract proves the asset is a READY Catalog service
  image.
- Authentication owns permission/reason truth. Admin owns audit persistence.

## Enumerations

### `CatalogLocale`

| Value | Meaning |
|---|---|
| `AR` | Arabic Catalog content |
| `EN` | English Catalog content |

No other R1-P08 locale exists and there is no fallback.

### `ServiceFieldKind`

`INFORMATION`, `TEXT`, `NUMBER`, `BOOLEAN`, `SINGLE_SELECT`, `MULTI_SELECT`

This is the closed DEC-042 set. It stores metadata only, never answers.

### `ServiceNumberMode`

| Value | Meaning |
|---|---|
| `INTEGER` | Later answers must be whole numbers |
| `DECIMAL` | Later answers may contain a decimal fraction |

### `CatalogCommandStatus`

| Value | Meaning |
|---|---|
| `PENDING` | A Media orchestration command reserved a stable receipt/media ID but has no accepted Catalog business effect yet |
| `COMPLETED` | The command's Catalog mutation, audit, and receipt committed |

Ordinary commands are inserted as `COMPLETED` inside their one transaction.
Only Media upload orchestration may temporarily be `PENDING`.

## Entities

### `ServiceCategory` → `service_categories`

| Field | Type | Rules |
|---|---|---|
| `id` | String | CUID primary key |
| `code` | String | Required uppercase stable code, 2–80 chars, global unique, immutable after create |
| `nameAr` | String? | Trimmed, 1–160 when present; required for activation |
| `nameEn` | String? | Trimmed, 1–160 when present; required for activation |
| `descriptionAr` | String? | Trimmed, 1–2000 when present; required for activation |
| `descriptionEn` | String? | Trimmed, 1–2000 when present; required for activation |
| `displayOrder` | Int | Non-negative, globally unique, contiguous after reorder |
| `isActive` | Boolean | Default `false`; inactive is the draft state |
| `version` | Int | Default `1`, positive, incremented once per accepted category command |
| `createdAt` | DateTime | Database default `now()` |
| `updatedAt` | DateTime | Prisma `@updatedAt` |

Relations: one category has many services. Delete uses `Restrict`; R1-P08
exposes no hard-delete command.

Indexes/constraints:

- unique `code`;
- unique `displayOrder`;
- check `displayOrder >= 0` and `version > 0`;
- check stable-code format `^[A-Z][A-Z0-9_]*$`.

### `Service` → `services`

| Field | Type | Rules |
|---|---|---|
| `id` | String | CUID primary key |
| `categoryId` | String | Required FK to `service_categories`, `Restrict` delete |
| `code` | String | Required uppercase stable code, 2–100 chars, global unique, immutable |
| `displayOrder` | Int | Non-negative and unique within category |
| `isActive` | Boolean | Default `false`; inactive is draft |
| `version` | Int | Default `1`, positive, aggregate revision |
| `createdAt` | DateTime | Database default `now()` |
| `updatedAt` | DateTime | Prisma `@updatedAt` |

Relations: exactly one category; zero-to-many translations, price units,
fields, country rows, and media associations.

Indexes/constraints:

- unique `code`;
- unique `(categoryId, displayOrder)`;
- index `(categoryId, isActive, displayOrder)`;
- check `displayOrder >= 0`, `version > 0`, and stable-code format.

### `ServiceTranslation` → `service_translations`

| Field | Type | Rules |
|---|---|---|
| `id` | String | CUID primary key |
| `serviceId` | String | FK to service, cascade only if a never-exposed pre-reference development row is removed; no R1-P08 delete API |
| `locale` | `CatalogLocale` | `AR` or `EN` |
| `name` | String? | Trimmed 1–160 when present; required for active service |
| `description` | String? | Trimmed 1–2000 when present; required for active service |
| `createdAt` | DateTime | Database default |
| `updatedAt` | DateTime | Prisma update timestamp |

Unique `(serviceId, locale)`. A missing locale row or nullable value is allowed
only while the service is inactive.

### `ServicePriceUnit` → `service_price_units`

| Field | Type | Rules |
|---|---|---|
| `id` | String | CUID primary key |
| `serviceId` | String | Required service FK |
| `code` | String | Stable uppercase code, 2–64 chars, immutable inside service |
| `labelAr` | String? | Trimmed 1–120 when present; required when active |
| `labelEn` | String? | Trimmed 1–120 when present; required when active |
| `displayOrder` | Int | Non-negative, unique within service |
| `isActive` | Boolean | Default `false` |
| `createdAt` | DateTime | Database default |
| `updatedAt` | DateTime | Prisma update timestamp |

Unique `(serviceId, code)` and `(serviceId, displayOrder)`. A price unit stores
no amount, currency, provider price, or history.

### `ServiceField` → `service_fields`

| Field | Type | Rules |
|---|---|---|
| `id` | String | CUID primary key |
| `serviceId` | String | Required service FK |
| `code` | String | Stable uppercase code, 2–80 chars, immutable inside service |
| `kind` | `ServiceFieldKind` | Required closed-kind value |
| `labelAr` | String? | Trimmed 1–300 when present; required when active |
| `labelEn` | String? | Trimmed 1–300 when present; required when active |
| `helpTextAr` | String? | Optional trimmed 1–1000; if one locale exists, both are required for activation |
| `helpTextEn` | String? | Same pairing rule as Arabic |
| `isRequired` | Boolean | Default `false`; always false for `INFORMATION` |
| `minLength` | Int? | `TEXT` only, non-negative |
| `maxLength` | Int? | `TEXT` only, non-negative, ≥ minimum |
| `numberMode` | `ServiceNumberMode`? | Required for `NUMBER`, null otherwise |
| `minValue` | Decimal(18,3)? | `NUMBER` only |
| `maxValue` | Decimal(18,3)? | `NUMBER` only, ≥ minimum |
| `minSelections` | Int? | `MULTI_SELECT` only, non-negative |
| `maxSelections` | Int? | `MULTI_SELECT` only, ≥ minimum and ≤ active option count |
| `displayOrder` | Int | Non-negative, unique within service |
| `isActive` | Boolean | Default `false` |
| `createdAt` | DateTime | Database default |
| `updatedAt` | DateTime | Prisma update timestamp |

Unique `(serviceId, code)` and `(serviceId, displayOrder)`.

Kind matrix:

| Kind | Required allowed | Length | Numeric mode/bounds | Options | Selection bounds |
|---|---:|---:|---:|---:|---:|
| `INFORMATION` | No | No | No | No | No |
| `TEXT` | Yes | Optional | No | No | No |
| `NUMBER` | Yes | No | Mode required, bounds optional | No | No |
| `BOOLEAN` | Yes | No | No | No | No |
| `SINGLE_SELECT` | Yes | No | No | At least 2 active | Exactly one when answered; no stored bounds |
| `MULTI_SELECT` | Yes | No | No | At least 2 active | Optional minimum/maximum |

Incompatible non-null constraint fields are rejected on every write, even for
an inactive draft. Incompleteness (for example a missing localized label) is
allowed only while inactive.

### `ServiceFieldOption` → `service_field_options`

| Field | Type | Rules |
|---|---|---|
| `id` | String | CUID primary key |
| `serviceFieldId` | String | Required FK to service field |
| `value` | String | Stable uppercase value, 1–80 chars, immutable inside field |
| `labelAr` | String? | Trimmed 1–200 when present; required when active |
| `labelEn` | String? | Trimmed 1–200 when present; required when active |
| `displayOrder` | Int | Non-negative, unique within field |
| `isActive` | Boolean | Default `false` |
| `createdAt` | DateTime | Database default |
| `updatedAt` | DateTime | Prisma update timestamp |

Unique `(serviceFieldId, value)` and `(serviceFieldId, displayOrder)`. Options
are valid only below `SINGLE_SELECT` or `MULTI_SELECT`.

### `ServiceCountryAvailability` → `service_country_availability`

| Field | Type | Rules |
|---|---|---|
| `id` | String | CUID primary key |
| `serviceId` | String | Required service FK |
| `countryId` | String | Required Configuration-owned country FK |
| `isAvailable` | Boolean | Default `false` |
| `createdAt` | DateTime | Database default |
| `updatedAt` | DateTime | Prisma update timestamp |

Unique `(serviceId, countryId)`; indexes on `(countryId, isAvailable,
serviceId)` and `(serviceId, isAvailable)`. An inactive/unknown country cannot
be configured as available through application behavior.

### `ServiceMediaAssociation` → `service_media_associations`

| Field | Type | Rules |
|---|---|---|
| `id` | String | CUID primary key |
| `serviceId` | String | Required service FK |
| `mediaFileId` | String | Required unique FK to Media-owned `media_files` |
| `displayOrder` | Int | Non-negative, unique within service |
| `createdAt` | DateTime | Database default |
| `updatedAt` | DateTime | Prisma update timestamp |

Only a READY `CATALOG_SERVICE_IMAGE` receipt may be associated. One Media file
belongs to at most one service association. Removing an association never
deletes or mutates Media state; Media cleanup is a separate explicit request.

### `CatalogCommandRequest` → `catalog_command_requests`

| Field | Type | Rules |
|---|---|---|
| `id` | String | CUID primary key |
| `actorUserId` | String | Trusted principal ID for scoping/audit reference; no Catalog-owned User relation |
| `scopeKey` | String | Normalized operation/target scope, max 200 |
| `idempotencyKey` | String | Client key, 1–200 |
| `requestHash` | String | SHA-256 hex of canonical validated command, 64 chars |
| `status` | `CatalogCommandStatus` | `PENDING` or `COMPLETED` |
| `targetType` | String | Safe Catalog target kind, max 80 |
| `targetId` | String? | Stable internal target reference after known |
| `acceptedVersion` | Int? | Resulting aggregate version after completion |
| `reservedMediaFileId` | String? | Stable Media ID for resumable upload; not a business association |
| `createdAt` | DateTime | Database default |
| `updatedAt` | DateTime | Prisma update timestamp |
| `completedAt` | DateTime? | Set only with `COMPLETED` |

Unique `(scopeKey, idempotencyKey)` and index `(actorUserId, createdAt)`.
Same key plus a different request hash returns an idempotency conflict. A
completed replay returns the stored command receipt and performs no write or
second audit. Pending Media reservations are never returned by selectable
Catalog reads.

## Modified existing model

### `MediaFile` → `media_files`

- Extend `MediaOwnerType` with `CATALOG_SERVICE_IMAGE`.
- Keep `ownerUserId` required. It records the trusted staff uploader for Media
  accountability; it is not service ownership or an authorization shortcut.
- Add the opposite optional relation for `ServiceMediaAssociation` only as
  needed by Prisma. Media remains the owner of every existing column and file
  lifecycle.
- Do not add `serviceId`, Catalog lifecycle, ordering, localized content, or
  Catalog version fields to `media_files`.

### `Country`

Add only the opposite Prisma relation to service-country availability if
required. Configuration remains the table owner.

## Aggregate invariants

### Category activation

A category may change `isActive: false → true` only when all four localized
fields are present after trimming and the expected version matches. Category
deactivation is always allowed for an authorized current-version command.
Every category content/lifecycle change increments the category and all current
child-service versions once.

### Service activation

A service may change `isActive: false → true` only when:

1. its category is active;
2. exactly one complete `AR` and one complete `EN` translation exist;
3. at least one active bilingual price unit exists;
4. every present active field and option satisfies the kind matrix and
   bilingual rules; zero active fields is a valid empty definition;
5. all positions in each active ordered collection are unique and contiguous.

Country availability is not required to activate a service; it is an explicit
selectability condition. This permits an active service definition to be
prepared before market enablement without creating another lifecycle state.

### Selectability

A service is selectable for `(countryCode, locale)` only when:

- the country is authoritative and active;
- the category and service are active;
- that service-country row has `isAvailable=true`;
- the requested exact locale is complete;
- all active price units/fields/options are complete and valid;
- any presented media association still resolves to an eligible READY receipt.

List queries omit non-selectable services. Exact detail returns safe
`CATALOG_SERVICE_NOT_FOUND` without locale fallback or draft leakage.

### Version propagation

- Category command: category `+1`; every child service `+1` when the category
  content/lifecycle/order fact appears in the service definition.
- Service identity/category/order/lifecycle command: service `+1`.
- Service configuration replacement: service `+1`, regardless of child row
  count.
- Service media add/reorder/remove: service `+1`.
- Replayed idempotent command: no version change.
- Rejected/stale/concurrent loser: no version change.

## Seed identities and values

### Category

- code `HOME_CLEANING`
- name `Home Cleaning` / `تنظيف المنازل`
- description `Home cleaning and housekeeping services.` /
  `خدمات تنظيف المنازل والتدبير المنزلي.`
- position 0, active

### Service

- code `STANDARD_HOME_CLEANING`
- category `HOME_CLEANING`
- name `Standard Home Cleaning` / `تنظيف منزلي قياسي`
- description `Routine cleaning for a home.` / `تنظيف دوري للمنزل.`
- position 0, active, available for `EG`

### Price units

1. `PER_VISIT`: `Per visit` / `لكل زيارة`
2. `PER_HOUR`: `Per hour` / `لكل ساعة`

Both are active and ordered as listed.

### Fields

1. `PREPARATION_INFORMATION` — `INFORMATION`, active, not required,
   `Review the service details before booking.` /
   `راجع تفاصيل الخدمة قبل الحجز.`
2. `BEDROOM_COUNT` — `NUMBER`, active, optional, `INTEGER`, min 0, no maximum,
   `Number of bedrooms` / `عدد غرف النوم`.
3. `BATHROOM_COUNT` — `NUMBER`, active, optional, `INTEGER`, min 0, no maximum,
   `Number of bathrooms` / `عدد الحمامات`.
4. `PETS_PRESENT` — `BOOLEAN`, active, optional,
   `Are pets present?` / `هل توجد حيوانات أليفة؟`.
5. `SPECIAL_INSTRUCTIONS` — `TEXT`, active, optional, max length 1000,
   `Special instructions` / `تعليمات خاصة`.

These labels are neutral on OQ-002. Select-kind support remains required in
policy/tests even though DEC-044 does not seed select fields.

## Deletion and history

- No R1-P08 API hard-deletes stable Catalog identities.
- Inactive records remain readable to protected management and invisible to
  consumers of the internal selectable-reader contract.
- Admin privileged audit is the mutation evidence. R1-P08 adds no duplicate
  Catalog history table.
- Live Catalog changes do not rewrite later Booking-owned snapshots; R1-P08
  itself stores no historical Booking snapshot.
