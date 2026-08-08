# Phase 0 Research — R1-P04 Customer Profiles, Preferences & Text Addresses

**Date**: 2026-08-07

**Status**: Complete and repaired under approved `spec.md`, **DEC-030**,
**DEC-031**, and **DEC-033**. T001–T078 historical; DEC-033 repair in progress.

**Authority**: [spec.md](./spec.md), DEC-030, DEC-031, DEC-004, DEC-028,
architecture entity ownership for `customers` / `media`.

## Research questions and decisions

### RQ-1 — Which module owns R1-P04 behavior and persistence?

**Decision:** Introduce a junior-readable `customers` module as the sole owner
of customer self-service workflows and of these tables:

- `customer_profiles` (identity-wide anchor + shared profile-image association)
- `individual_profiles`
- `company_profiles`
- `engineer_profiles`
- `user_preferences`
- `user_addresses`
- `privacy_requests` (covers roadmap `account_deletion_requests` plus
  deactivation and export purposes)

Introduce a thin `media` module as the sole owner of `media_files` storage
metadata and protected byte access. `customers` owns image **association** and
authorization meaning; `media` owns file bytes and safe media retrieval.

**Rationale:** Matches `docs/architecture/entity-ownership.md`.

**Alternatives rejected:** Profiles inside Authentication; media rows inside
`customers` (blocks later provider gallery reuse without transferring
association authorization).

### RQ-2 — How does customer SELF authorization work without a customer role?

**Decision:** Authorize only from trusted `AuthenticationPrincipal` facts,
server-held `SELF` ownership, and FR-028 families. No `customer` role grant, no
`resource.self.read` / `resource.self.write`, and no other role-derived R1-P04
customer permission. Historical `customer` grants are ignored.

**Rationale:** DEC-030 and FR-028 / FR-045 / SC-017.

### RQ-3 — How are the three FR-028 eligibility families implemented?

**Decision:** One `customers` authorization policy helper:

| Family | Identity | Category rule | Ownership |
|---|---|---|---|
| Category profile | `status === ACTIVE` | Matching verified supported category | `SELF` |
| Shared image / addresses | `status === ACTIVE` | ≥1 verified supported category | `SELF` |
| Contact / preferences / privacy | `status === ACTIVE` | Enrolled supported category (pending-only allowed) | `SELF` |

Every non-`ACTIVE` status is denied. R1-P04 does not add `DEACTIVATED` to
`UserStatus`.

### RQ-4 — How should profile tables map to the roadmap and FR-005?

**Decision:** Identity-wide `customer_profiles` anchor (image + CAS version) plus
separate `individual_profiles` / `company_profiles` / `engineer_profiles` text
tables. See [data-model.md](./data-model.md).

### RQ-5 — How are city and district modeled without R1-P10?

**Decision:** Text columns on `user_addresses`. API accepts `countryCode`;
customers resolves through Configuration to active `countries.id` and stores
only `country_id` with `ON DELETE RESTRICT`. No city/district catalogs.

### RQ-6 — One privacy-request table or three?

**Decision:** One `privacy_requests` table with purpose enum, five statuses,
partial unique active index, and DEC-031 closed outcome codes.

### RQ-7 — Processor capability and privileged reassignment?

**Decision (DEC-031):**

- Processor capability constant/type: `privacy.requests.process` —
  composition-only, not seeded into roles, no public processor HTTP, tests
  build trusted/forged contexts through composition.
- Privileged reassignment: permission `privacy.requests.reassign` mapped to
  **`staff_admin` only**; operation `customers.privacy.requests.reassign`;
  reason `privacy_request_reassign` bound to `PRIVACY_REQUEST_REASSIGN`;
  publicHttp false. Deny by default when mapping/permission/reason absent.

**Alternatives rejected:** Broader staff_support/operations/finance mapping
(no privacy staff UI in R1-P04); client-asserted capability fields.

### RQ-8 — How is profile-image storage done without cloud work?

**Decision (superseded by DEC-033):** Local filesystem under env
`MEDIA_STORAGE_ROOT`. **Historical planning evidence only.** DEC-033 replaces
this with Cloudinary; see RQ-17 below.

### RQ-17 — Cloudinary profile-image storage (DEC-033)

**Decision (DEC-033):** Customer profile images use Cloudinary via
`MEDIA_STORAGE_PROVIDER=cloudinary`. **`MEDIA_STORAGE_ROOT` removed.**

| Topic | Lock |
|---|---|
| Upload path | Multer `memoryStorage`; exactly one `file`; max 5 MiB |
| Processing | Sharp validates/decodes, auto-orients, resizes (1200×1200 inside),
  strips metadata, outputs WebP before Cloudinary upload |
| Replace semantics | Every accepted upload **always replaces**; no content hash or
  duplicate comparison; new opaque Cloudinary `public_id` each time |
| Transactions | Cloudinary upload/delete **never** inside Prisma TX; existing image
  retained until new upload + association commit succeed |
| Delivery | Authenticated/signed Cloudinary URL after SELF/category auth; TTL via
  env; never expose `public_id`/storage key or credentials |
| Cleanup | Prior asset → `PENDING_DELETE`; bounded async media sweep; response does
  not await deletion |
| CAS | `expectedAssociationVersion` required on PUT/DELETE |
| Out of scope | Video, PDF, provider gallery, S3 runtime (reserved enum only) |

### RQ-9 — How is terminal retention configured?

**Decision (DEC-031):** Env `PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS` (positive
integer, no default). R1-P04 readiness probe fails when missing/invalid.
Unrelated tooling that does not compose customers runtime must not require it.
`purge_after = terminal_at + configured days` set atomically on terminal
transition. Customer reads exclude `purge_after <= now`. Physical purge is a
customers-owned bounded idempotent sweep at startup and every hour. No queue,
broker, cron platform, generic job engine, or AppConfig retention key.

**Supersedes:** earlier ambiguous “purge job or on-read expiry” and AppConfig
key `privacy.request.terminal_retention_days`.

### RQ-10 — Migration name and ownership?

**Decision:** `r1_p04_customer_profiles_preferences_text_addresses`. Forward-only
additive migration when implementation is authorized. Authentication owns
catalog rows; customers/media own business/media tables. Never edit applied
migrations.

### RQ-11 — Contact-state and frozen auth contracts?

**Decision:** Read-only projection over Authentication identity facts. No
identity mutation; `/auth/*` contracts unchanged.

### RQ-12 — Safe errors?

**Decision:** Stable API envelope codes for validation, unauthenticated,
forbidden/ineligible, ownership-safe denial, conflict, stale version, and
illegal lifecycle/outcome combinations. No sensitive leakage.

### RQ-13 — Audit ownership?

**Decision:** Admin remains sole `audit_logs` lifecycle owner.

- Ordinary FR-033 mutations use an Admin-owned **transaction-scoped general**
  audit writer suitable for non-privileged mutations (not the privileged
  reason-bound writer reused unchanged).
- Privileged reassignment uses the Admin **privileged** transactional writer
  with approved reason.
- Customers owns the Prisma transaction and receives writers via composition;
  never imports Admin Prisma infrastructure.
- Audit append failure rolls back every required business mutation.
- Cloudinary I/O stays outside the DB transaction with compensating media
  cleanup.
- Security-relevant denial audit may use the safe non-transactional Admin
  writer because no business mutation is committed.

### RQ-14 — Closed outcome catalog?

**Decision (DEC-031):** `COMPLETED` ↔ `REQUEST_FULFILLED` only;
`REJECTED` ↔ `REQUEST_REJECTED` only. No free-form rationale. No other codes in
R1-P04.

### RQ-15 — Preference storage shape and PUT semantics?

**Decision:** Keep simple boolean columns. Do **not** introduce
`NotificationChannel` / `OptionalNotificationCategory` enums or a normalized
preference table.

**PUT semantics (DEC-032):** Full replacement only. Request must include
`version`, `language` (`AR` | `EN` | `null` where `null` = explicit unset), and
all four booleans `reminders.sms` / `reminders.push` /
`promotional.sms` / `promotional.push`. Omitted fields are rejected. No partial
merge and no silent defaults on omitted fields.

### RQ-16 — Optimistic concurrency?

**Decision:** Preferences and addresses start `version = 1`. Update/delete
requires the currently accepted version; success increments by one; stale
returns stable conflict and preserves prior state. Image association uses
equivalent CAS on `image_association_version`.

## Constitution Check (post-repair)

| Gate | Status | Notes |
|---|---|---|
| Specification review | PASS | Historical independent PASS retained |
| Authorization model | PASS | DEC-030 + DEC-031 catalogs |
| Phase sequencing | PASS | R1-P03A Complete; R1-P04 sole planning phase |
| R1-P02 contract freeze | PASS | Contact-state projection only |
| No customer role grants | PASS | Explicit non-requirement |
| Incremental migration | PASS | Proposed name only; no schema edit |
| Retention / media safety | PASS | DEC-031 env + DEC-033 Cloudinary |
| No maps/Docker/queues | PASS | Cloudinary provider; hourly in-process sweep |

## Unresolved material product decisions

None after DEC-031, DEC-032, and the CANCELLED CHECK tightening. Safe technical
limits (string max lengths, exact MIME allowlist, exact byte cap, sweep batch
size) remain implementation-chosen non-product safety constraints documented in
tasks when authorized.
