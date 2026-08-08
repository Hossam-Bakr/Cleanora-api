# Data Model — R1-P04 Customer Profiles, Preferences & Text Addresses

**Status**: Phase 1 design repaired under **DEC-031** and **DEC-033**. Original
migration applied; forward-only Cloudinary repair migration
`r1_p04_customer_profiles_preferences_text_addresses_02_cloudinary_profile_image_storage`
extends `media_files`. **`MEDIA_STORAGE_ROOT` superseded and removed.**

**Migrations (lexical order)**:
1. `r1_p04_customer_profiles_preferences_text_addresses`
2. `r1_p04_customer_profiles_preferences_text_addresses_02_cloudinary_profile_image_storage`

**Owners**: `customers` (business tables), `media` (`media_files`), Authentication
(additive catalog rows), Admin (`audit_logs` lifecycle), Configuration (country
resolution). Retention uses env `PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS`
(DEC-031), not AppConfig.

## Persisted model inventory

| Table / model | Owner | Purpose |
|---|---|---|
| `customer_profiles` | customers | Identity-wide anchor; optional profile-image association |
| `individual_profiles` | customers | Verified Individual required full name |
| `company_profiles` | customers | Verified Company required names |
| `engineer_profiles` | customers | Verified Engineer required name + title |
| `user_preferences` | customers | Language + boolean notification preference matrix |
| `user_addresses` | customers | Peer text addresses; no default/primary |
| `privacy_requests` | customers | Deactivation / deletion / export request lifecycle |
| `media_files` | media | Protected media metadata + provider storage key (Cloudinary `public_id`) |
| `permissions` / `role_permissions` / `privileged_action_reasons` | Authentication | Additive privileged reassignment catalog only |
| `users` / `countries` / `audit_logs` | Reuse | Identity facts, country FK target, audit lifecycle |

## Enums (customers / media)

```text
PrivacyRequestPurpose: DEACTIVATION | DELETION | EXPORT
PrivacyRequestStatus: PENDING | PROCESSING | COMPLETED | REJECTED | CANCELLED
PrivacyRequestOutcomeCode: REQUEST_FULFILLED | REQUEST_REJECTED
PreferredLanguage: AR | EN          # stored only when explicitly set
MediaOwnerType: CUSTOMER_PROFILE_IMAGE   # R1-P04 single value only
MediaStorageProvider: CLOUDINARY         # S3 reserved for future persisted rows only; no R1-P04 runtime
MediaStatus: PENDING_UPLOAD | READY | PENDING_DELETE | DELETED
PrivilegedActionOperation: ... | PRIVACY_REQUEST_REASSIGN   # Authentication enum extension
```

**Removed (YAGNI):** `NotificationChannel`, `OptionalNotificationCategory`.
Preferences use simple boolean columns only. No normalized preference table.

Mandatory notification categories remain **policy constants**, not stored flags.

Closed outcome legality (DEC-031):

| Status | Legal outcome_code |
|---|---|
| `COMPLETED` | `REQUEST_FULFILLED` only |
| `REJECTED` | `REQUEST_REJECTED` only |
| Other statuses | `outcome_code` must be null |

Every other status/code combination is rejected atomically.

## Models (design intent)

### `customer_profiles`

| Column | Type | Rules |
|---|---|---|
| `id` | cuid PK | Opaque |
| `user_id` | string unique | FK → `users.id` `ON DELETE RESTRICT` |
| `profile_image_media_file_id` | string? unique | Nullable unique FK → `media_files.id` `ON DELETE SET NULL` |
| `image_association_version` | int default 1 | CAS for concurrent image replace |
| `created_at` / `updated_at` | timestamps | Mutable authoritative |

PostgreSQL allows multiple NULL values in a unique nullable column, so multiple
identities without an image remain valid.

### `individual_profiles` / `company_profiles` / `engineer_profiles`

Each: `user_id` unique FK → `users.id` `ON DELETE RESTRICT`, required trimmed
non-blank text fields per FR-005, timestamps. No unapproved columns.

### `user_preferences`

| Column | Type | Rules |
|---|---|---|
| `user_id` | string unique | FK → `users.id` `ON DELETE RESTRICT` |
| `language` | `AR`/`EN` null | Null = explicit unset; API PUT requires `language` present as `AR`, `EN`, or `null` (DEC-032) |
| `reminders_sms` / `reminders_push` | boolean default false | API PUT requires both booleans every time (DEC-032) |
| `promotional_sms` / `promotional_push` | boolean default false | API PUT requires both booleans every time (DEC-032) |
| `version` | int default 1 | Starts at 1; update requires current version; success increments by 1 |
| timestamps | | |

### `user_addresses`

| Column | Type | Rules |
|---|---|---|
| `id` | cuid PK | |
| `user_id` | string | FK → `users.id` `ON DELETE RESTRICT`; indexed |
| `country_id` | string | FK → `countries.id` `ON DELETE RESTRICT` |
| `city` / `district` / `address_text` | trimmed non-blank | Required |
| `building` / `floor` / `notes` | nullable trimmed | Whitespace-only → null |
| `version` | int default 1 | Same optimistic concurrency as preferences |
| timestamps | | |

**API mapping:** request body uses `countryCode`; customers resolves it through
Configuration to one active supported Country and persists only `country_id`.
Unknown/inactive codes return the stable validation error. No duplicate ISO-code
column is stored.

**Forbidden columns:** any geospatial attribute; no `is_default` / `is_primary`.

### `privacy_requests`

| Column | Type | Rules |
|---|---|---|
| `id` | cuid PK | |
| `user_id` | string | FK → `users.id` `ON DELETE RESTRICT` |
| `purpose` | enum | DEACTIVATION / DELETION / EXPORT |
| `status` | enum | Five-state lifecycle |
| `processor_id` | string? | Opaque trusted future processor id; **no R1-P04 DB FK** (processor registry does not exist yet; FK would invent future ownership) |
| `outcome_code` | enum? | Closed DEC-031 catalog only |
| `requested_at` | timestamp | = created |
| `updated_at` | timestamp | |
| `cancelled_at` / `processing_at` / `terminal_at` | timestamp? | |
| `purge_after` | timestamp? | Set atomically on COMPLETED/REJECTED/CANCELLED as `terminal_at + PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS` |

### `media_files`

| Column | Type | Rules |
|---|---|---|
| `id` | cuid PK | |
| `owner_user_id` | string | FK → `users.id` `ON DELETE RESTRICT` |
| `owner_type` | enum | `CUSTOMER_PROFILE_IMAGE` only in R1-P04 |
| `storage_provider` | enum | `CLOUDINARY` in R1-P04; `S3` reserved, no runtime |
| `storage_key` | string | Server-generated opaque provider key; for Cloudinary this is the `public_id` — **never exposed via HTTP** |
| `content_type` | string | Normalized output MIME (WebP after Sharp) |
| `byte_size` | int | Post-normalization size; enforce `MEDIA_IMAGE_MAX_BYTES` (5 MiB) |
| `width` | int? | Normalized pixel width from Sharp |
| `height` | int? | Normalized pixel height from Sharp |
| `status` | enum | `PENDING_UPLOAD` / `READY` / `PENDING_DELETE` / `DELETED` |
| `cleanup_eligible_at` | timestamp? | Optional grace for stale `PENDING_UPLOAD` bounded sweep |
| timestamps | | |

**Explicitly absent:** `content_hash` — DEC-033 prohibits hash/duplicate logic.
Signed delivery URLs are **not** persisted; regenerated per authorized GET.

**Removed env:** `MEDIA_STORAGE_ROOT` — superseded by DEC-033 /
`MEDIA_STORAGE_PROVIDER`.

## Prisma relation strategy (centralized schema)

Business modules own persistence access. Centralized `schema.prisma` still
requires opposite relation fields on `User`, `Country`, and `MediaFile` for
typed Prisma relations. Those opposite fields do **not** transfer ownership to
Authentication/Configuration; customers/media remain authoritative writers.

| Owning field | Referenced | Prisma | onDelete | Opposite field (schema only) |
|---|---|---|---|---|
| `customer_profiles.user_id` | `users.id` | required relation | Restrict | `User.customerProfile?` |
| `individual_profiles.user_id` | `users.id` | required | Restrict | `User.individualProfile?` |
| `company_profiles.user_id` | `users.id` | required | Restrict | `User.companyProfile?` |
| `engineer_profiles.user_id` | `users.id` | required | Restrict | `User.engineerProfile?` |
| `user_preferences.user_id` | `users.id` | required | Restrict | `User.userPreferences?` |
| `user_addresses.user_id` | `users.id` | required | Restrict | `User.userAddresses[]` |
| `privacy_requests.user_id` | `users.id` | required | Restrict | `User.privacyRequests[]` |
| `media_files.owner_user_id` | `users.id` | required | Restrict | `User.ownedMediaFiles[]` |
| `user_addresses.country_id` | `countries.id` | required | Restrict | `Country.userAddresses[]` |
| `customer_profiles.profile_image_media_file_id` | `media_files.id` | optional unique | SetNull | `MediaFile.customerProfileImage?` |

Media soft-delete changes `media_files.status` only. Cloudinary asset deletion
occurs only after association is cleared and row is `PENDING_DELETE`, via bounded
async cleanup (outside DB TX). `ON DELETE SET NULL` on the association FK supports
media-row removal after association clear without cascading identity history.

## Raw migration SQL requirements (review before disposable apply)

Prisma cannot fully express all lifecycle rules. Migration SQL must include:

1. **Partial unique index** — one active request per identity+purpose:

```sql
CREATE UNIQUE INDEX privacy_requests_one_active_per_purpose
  ON privacy_requests (user_id, purpose)
  WHERE status IN ('PENDING', 'PROCESSING');
```

2. **Lifecycle CHECK constraints** (practical DB enforcement):

- `PENDING` ⇒ `processor_id` IS NULL, `processing_at` IS NULL, `terminal_at` IS NULL, `outcome_code` IS NULL, `purge_after` IS NULL, `cancelled_at` IS NULL
- `PROCESSING` ⇒ `processor_id` IS NOT NULL, `processing_at` IS NOT NULL, `terminal_at` IS NULL, `outcome_code` IS NULL, `purge_after` IS NULL
- `COMPLETED` ⇒ `outcome_code = 'REQUEST_FULFILLED'`, `terminal_at`/`purge_after`/`processor_id` NOT NULL
- `REJECTED` ⇒ `outcome_code = 'REQUEST_REJECTED'`, `terminal_at`/`purge_after`/`processor_id` NOT NULL
- `CANCELLED` ⇒ `cancelled_at` IS NOT NULL, `terminal_at` IS NOT NULL,
  `purge_after` IS NOT NULL, `outcome_code` IS NULL, `processor_id` IS NULL,
  `processing_at` IS NULL
  (consistent with customer cancel allowed only from `PENDING`, before any
  processor claim)

3. **Terminal immutability** — primarily an application transaction rule
   (UPDATE … WHERE status = expected). DB CHECKs above prevent illegal metadata
   shapes; do not invent triggers unless a later review proves need.

4. Review generated + hand-written SQL before any disposable-database apply.
   Never edit applied migrations.

## Authentication catalog additions (same phase migration; Auth ownership)

| Kind | Exact value |
|---|---|
| Permission | `privacy.requests.reassign` |
| Role mapping | `staff_admin` **only** (DEC-031) |
| Protected operation ID | `customers.privacy.requests.reassign` |
| PrivilegedActionOperation | `PRIVACY_REQUEST_REASSIGN` |
| Reason | `privacy_request_reassign` (bound 1:1 to that operation) |
| Ownership / Scope | `NONE` / `GLOBAL` |
| Privileged / Public HTTP | `true` / `false` |

Missing role mapping, permission, operation declaration, or active reason fails
closed. No other staff/provider/customer role receives the permission.

## Processor capability (composition-only; not a DB seed)

Trusted capability constant/type: `privacy.requests.process`

- Server-created; never a client field
- Not seeded into customer or staff roles in R1-P04
- No production processor adapter or public processor HTTP endpoint
- Tests construct trusted vs forged contexts through composition
- Claim/resolve rejects missing or forged capability

## Retention runtime (DEC-031)

| Item | Exact design |
|---|---|
| Env var | `PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS` |
| Validation | Positive integer only; no default |
| Readiness | R1-P04/customers readiness probe fails when missing/invalid |
| Tooling | Unrelated tooling that does not compose customers runtime must not require this value |
| `purge_after` | Computed atomically when status becomes COMPLETED, REJECTED, or CANCELLED |
| Customer reads | Exclude rows where `purge_after <= now` |
| Physical purge | Customers-owned idempotent bounded delete sweep at startup and every hour; documented small batch size per iteration; concurrent sweeps safe |
| Scope | Deletes expired terminal `privacy_requests` rows only |
| Never deleted by sweep | Active requests; Admin `audit_logs` |

No AppConfig key `privacy.request.terminal_retention_days`. No queue/broker/cron
platform/generic job engine.

## Transaction ownership

| Operation family | Transaction owner | Audit | Notes |
|---|---|---|---|
| Category profile upsert | customers | Admin general transactional writer | Audit failure rolls back |
| Image association | customers | Admin general transactional writer | Cloudinary I/O outside TX; compensating media cleanup |
| Preferences / addresses | customers | Admin general transactional writer | Version CAS; audit failure rolls back |
| Privacy submit/cancel | customers | Admin general transactional writer | Audit failure rolls back |
| Processor claim/resolve | customers | Admin general transactional writer | Capability `privacy.requests.process` |
| Privileged reassign | customers | Admin **privileged** transactional writer + reason | Audit failure rolls back |

## Indexes summary

- Unique `user_id` on each profile/preferences/anchor table
- Unique nullable `profile_image_media_file_id`
- Index `user_addresses(user_id)`
- Index `privacy_requests(user_id, purpose, status)`
- Partial unique active privacy request
- Index `privacy_requests(purge_after)`
- Index `media_files(owner_user_id, owner_type)`
- Index `media_files(status)` for pending-delete / stale-upload cleanup
- Index `media_files(cleanup_eligible_at)` when grace column used

## Out of schema scope

- `cities` / `districts` (R1-P10)
- Provider gallery models (R1-P05+)
- `UserStatus.DEACTIVATED` (identity/privacy processor later)
- Booking address snapshots
- Processor registry table / FK for `processor_id`
