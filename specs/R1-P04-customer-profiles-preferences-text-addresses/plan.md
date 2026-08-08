# Implementation Plan: R1-P04 Customer Profiles, Preferences & Text Addresses

**Branch**: `R1-P04-customer-profiles-preferences-text-addresses` | **Date**: 2026-08-07 | **Spec**: [spec.md](./spec.md)

**Input**: Approved feature specification in `specs/R1-P04-customer-profiles-preferences-text-addresses/spec.md`

**Planning status**: Phase 0/1 design complete (`PASS`). Final independent
post-tasks `/speckit.analyze` verdict **`CLEAN`** (2026-08-07). T001–T100
historical (checked). Historical implementation review **`CHANGES REQUIRED`**.
Historical first re-review **`BLOCKED`**. Latest independent re-review
**`CHANGES REQUIRED`**. Remediations **T101–T109** validated (2026-08-08) on
`cleanora_r1_p04_clean_proof`; smoke **PASS**. Next gate: fresh independent
read-only implementation re-review. Phase **In Progress** — **not** Complete.
Historical post-tasks analyze `CHANGES REQUIRED` results and historical
technical-planning `CHANGES REQUIRED` remain historical evidence only.

> **DEC-033 (2026-08-07):** Customer profile images use Cloudinary (provider
> selector `MEDIA_STORAGE_PROVIDER=cloudinary`). **`MEDIA_STORAGE_ROOT` and
> local filesystem storage are superseded and removed.** Multer `memoryStorage`
> + Sharp normalization + always-replace + signed URL delivery + async cleanup.

> **Historical note:** An earlier 2026-08-06 / 2026-08-07 pre-research gate
> record paused planning until R1-P03A Complete. That sequencing gate is
> satisfied. The pause narrative is superseded by this plan.

## Summary

R1-P04 adds a junior-readable `customers` module for owner-private profiles,
preferences, text addresses, and privacy-request foundations, plus a thin
`media` module for protected Cloudinary profile-image storage under
**DEC-033** (`MEDIA_STORAGE_PROVIDER=cloudinary`; **`MEDIA_STORAGE_ROOT`
removed**).

Customer self-service authorizes from trusted `AuthenticationPrincipal` facts,
`SELF` ownership, and FR-028 category eligibility under **DEC-030** — without a
`customer` role grant or role-derived customer permissions.

Under **DEC-031**:

- Privileged reassignment is `staff_admin` only via
  `privacy.requests.reassign` / `privacy_request_reassign` /
  `PRIVACY_REQUEST_REASSIGN` / operation `customers.privacy.requests.reassign`
- Processor capability is composition-only `privacy.requests.process`
- Outcomes are only `REQUEST_FULFILLED` / `REQUEST_REJECTED`
- Retention uses env `PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS` with a bounded
  hourly customers sweep (no queues)
- Preference PUT is full replacement under **DEC-032** (`version` + complete
  matrix; `language` AR/EN/null; omitted fields rejected)

R1-P02 authentication HTTP contracts stay frozen. Maps, coordinates, Docker,
cloud object storage, and generic job engines stay out of scope.

## Technical Context

**Language/Version**: Node.js 24+ with TypeScript 6

**Primary Dependencies**: Express 5, Zod 4, Prisma 7 with PostgreSQL

**Storage**: PostgreSQL via migration
`r1_p04_customer_profiles_preferences_text_addresses` (applied). Profile
image bytes via Cloudinary (**DEC-033**); forward-only repair migration
`r1_p04_customer_profiles_preferences_text_addresses_02_cloudinary_profile_image_storage`
(renamed for lexical order; applied on `cleanora_r1_p04_clean_proof`).
**`MEDIA_STORAGE_ROOT` superseded.**

**Testing**: Vitest and Supertest; Release 1 must not depend on Docker or
Testcontainers

**Target Platform**: Linux-hosted backend service

**Project Type**: Single deployable modular-monolith web service

**Performance Goals**: SC-008 acceptance workload when implementation is
authorized

**Constraints**: No customer-role provisioning; no geospatial fields; no R1-P02
contract changes; no cloud/Docker/queue work; implementation unauthorized until
separate owner authorization after tasks

**Scale/Scope**: FR-001–FR-048, SC-001–SC-019

## Constitution Check

| Check | Status | Notes |
|---|---|---|
| Specification review | PASS | Historical independent PASS retained |
| Authorization model | PASS | DEC-030 + DEC-031 |
| Phase sequencing | PASS | R1-P03A Complete; R1-P04 sole planning phase |
| R1-P02 contract freeze | PASS | Contact-state projection only |
| Automatic role grants | PASS | Prohibited |
| Incremental migration | PASS | Proposed name only; applied migrations untouched |
| Modular ownership | PASS | customers + media; Admin audit; Auth catalog additive |
| Security / audit | PASS | Deny-by-default; transactional Admin writers |
| Retention | PASS | Env + bounded in-process sweep |
| Testing strategy | PASS | [quickstart.md](./quickstart.md) repaired |
| Human-controlled ops | PASS | No silent retention default |

## Architecture and Ownership

### Junior-readable module map

```text
customers  -> profiles, preferences, addresses, privacy_requests, SELF policy,
              retention readiness + hourly sweep, privacy processor/privileged ports
media      -> media_files + Cloudinary adapter (DEC-033) + signed URL delivery +
              bounded async cleanup
authentication -> trusted principal facts; additive staff_admin reassignment catalog
admin      -> audit_logs lifecycle (general + privileged transactional writers)
configuration -> countries resolution for address countryCode
composition -> wires ports only
```

### Public module contracts

1. **Customer HTTPS API** — self-service profiles, protected profile-image
   signed URLs, contact-state, preferences, addresses, privacy submit/track/cancel.
2. **PrivacyProcessorPort** — claim/resolve requiring capability
   `privacy.requests.process`.
3. **PrivacyPrivilegedPort** — PROCESSING reassignment for `staff_admin` only.
4. **MediaPort** — store/authorizeDelivery/markPendingDelete/cleanup under
   Cloudinary provider abstraction (DEC-033).
5. **Admin audit ports** — general transactional writer (ordinary FR-033) and
   privileged transactional writer (reassignment); denial may use non-TX writer.
6. **Identity contact read** — Authentication facts only.

### Customer SELF authorization policies

| Operation family | Policy |
|---|---|
| Category profile CRUD/read | ACTIVE + matching verified category + SELF |
| Shared image + addresses | ACTIVE + ≥1 verified supported category + SELF |
| Contact-state, preferences, privacy submit/track/pending-cancel | ACTIVE + enrolled supported category + SELF (pending-only allowed) |
| Non-ACTIVE | Deny all customer ops |
| Eligibility loss | Access suspended; data retained unchanged |

### Processor / privileged boundaries (DEC-031)

| Path | Authority |
|---|---|
| Processor claim/resolve | Trusted processor id + capability `privacy.requests.process` |
| Privileged reassign | Authenticated `staff_admin` with `privacy.requests.reassign` + reason `privacy_request_reassign` |
| Customer SELF | Never authorizes processor/privileged paths |
| Missing/forged mapping or capability | Fail closed |

### Transaction ownership

Customers owns all R1-P04 business transactions. Admin audit writers participate
through composition ports inside the customers transaction. Cloudinary upload/delete
occurs **outside** the DB transaction with compensating media cleanup. Audit append
failure rolls back every required FR-033 business mutation.

### Deterministic safe errors

Stable codes for validation, unauthenticated, forbidden/ineligible,
ownership-safe denial, conflict (active request / competing claim / stale
version / capability), illegal lifecycle/outcome combinations. No credentials,
full addresses, image bytes, storage keys, or export payloads in errors/logs.

## Persistence and migration strategy

See [data-model.md](./data-model.md) for schema-ready FKs, opposite Prisma
relation fields, partial unique index SQL, lifecycle CHECKs, CAS versions, and
DEC-031 catalogs.

- Proposed migration name:
  `r1_p04_customer_profiles_preferences_text_addresses`
- Forward-only additive migration after implementation authorization
- Review migration SQL before disposable apply
- Never edit applied migrations

## Profile-image storage boundary (DEC-033)

- Provider env: `MEDIA_STORAGE_PROVIDER=cloudinary` (required when media composed)
- Cloudinary credentials/folder/TTL via env; **`MEDIA_STORAGE_ROOT` removed**
- Multer `memoryStorage` + Sharp WebP normalization before upload
- Opaque server-generated Cloudinary `public_id` stored in `storage_key`; never
  exposed via HTTP
- `GET /api/v1/customers/profile-image` returns authorized signed URL + metadata
  or explicit safe absence; never raw storage key or API credentials
- `PUT` multipart (`file` + `expectedAssociationVersion`) always replaces;
  returns canonical profile aggregate including `profileImage { mediaId, url,
  urlExpiresAt, associationVersion, ... }`
- `DELETE` clears association with CAS; prior asset becomes async cleanup
- Previous Cloudinary asset deletion is durable, bounded, and asynchronous

## Privacy-request lifecycle foundations

Five states; one active request per identity+purpose; customer cancel PENDING
only; processor claim/resolve via capability; privileged reassignment from
PROCESSING by `staff_admin` only; terminal immutability; DEC-031 outcomes;
retention env + visibility exclusion + bounded hourly sweep. No account-status
change, session revoke, delete/anonymize of customer data, or export file
generation in R1-P04.

## In scope / out of scope

**In scope:** FR-001–FR-048 foundations, media association, processor/privileged
contracts, phase migration design, tests in quickstart.

**Out of scope:** maps/geocoding/zones; provider onboarding; customer role
grants; R1-P02 contract changes; staff privacy UI; privacy fulfillment;
Docker/cloud/queues; implementation until separately authorized after tasks.

## Project Structure

```text
specs/R1-P04-customer-profiles-preferences-text-addresses/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── traceability.md
├── spec.md
├── activation.md
├── checklists/requirements.md
├── review-report.md          # historical specification PASS
├── review-resolution.md      # includes technical-planning repair table
└── contracts/
```

Expected implementation placement (when authorized): `src/modules/customers/`,
`src/modules/media/`, composition wiring, tests, additive Prisma migration.

## Phase outputs

- Phase 0: [research.md](./research.md) — complete
- Phase 1: [data-model.md](./data-model.md), [contracts/](./contracts/),
  [quickstart.md](./quickstart.md), [traceability.md](./traceability.md) —
  complete; independent technical-planning re-review `PASS`
  ([review-report.md](./review-report.md))
- Phase 2: [tasks.md](./tasks.md) — T001–T100 historical; T101–T109 checked
  after validation (2026-08-08); final post-tasks `/speckit.analyze` **`CLEAN`**;
  historical implementation review **`CHANGES REQUIRED`**; historical first
  re-review **`BLOCKED`**; latest independent re-review **`CHANGES REQUIRED`**

## Next gate

Fresh independent read-only implementation re-review. Phase is **In Progress**
— **not** Complete. Historical technical-planning `PASS` and final
`/speckit.analyze` **`CLEAN`** remain authoritative planning evidence.
Historical analyze, implementation-review, and re-review `CHANGES REQUIRED` /
`BLOCKED` verdicts remain historical evidence only.
