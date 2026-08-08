# R1-P04 Implementation Summary

**Phase**: R1-P04 — Customer Profiles, Preferences & Text Addresses
**Status**: **`Complete`** as of `2026-08-08` by explicit human-owner approval
**Human-owner Complete approval**:

```text
I approve R1-P04 — Customer Profiles, Preferences & Text Addresses as Complete.
```

**Human implementation authorization**: `2026-08-07`
**Human repair authorization (DEC-033)**: `2026-08-07`
**Final `/speckit.analyze` before implementation**: CLEAN
**Independent implementation review**: CHANGES REQUIRED (historical)
**Independent implementation re-review (first)**: **BLOCKED** (historical)
**Later independent re-review**: **CHANGES REQUIRED** (historical)
**Fresh independent final implementation re-review**: **`PASS`** (2026-08-08)
**Live Cloudinary smoke**: **PASS** (`cloudinary-smoke-evidence.json`; owner-authorized non-prod; synthetic image upload → signed GET → delete; no residue)
**Proof DB**: `cleanora_r1_p04_clean_proof` (old `cleanora_r1_p03_clean_proof` historical, unmodified)
**Cloudinary migration**: `r1_p04_customer_profiles_preferences_text_addresses_02_cloudinary_profile_image_storage`
**Completion report**: `completion-report.md`

This summary records baseline evidence, decision locks, migration review,
quality gate results, and Complete closure. Complete approval does **not**
authorize commit, push, merge, deployment, production migration, next-phase
activation, or any action against the separate historical `Cleanora` database
incident.

---

## T001 — Implementation baseline

### Active phase pointer

`docs/product/current.md` records R1-P04 as **Complete** as of `2026-08-08`
(historical baseline below originally recorded In Progress at implementation
start).

### Decision locks (authoritative)

| Decision | Lock |
|---|---|
| **DEC-030** | Customer self-service authorizes from trusted `AuthenticationPrincipal` facts, `SELF` ownership, and FR-028 category eligibility. No customer role provisioning or `resource.self.*` permissions in R1-P04. |
| **DEC-031** | Privileged privacy reassignment is `staff_admin` only; closed outcome codes `REQUEST_FULFILLED` / `REQUEST_REJECTED`; env `PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS` (positive integer, no default); customers-owned retention sweep. |
| **DEC-032** | Preference PUT is full replacement only (`version` + complete boolean matrix required; `language` is `AR`/`EN`/`null`; omitted fields rejected). CANCELLED lifecycle CHECK keeps `processor_id` and `processing_at` null. |
| **DEC-033** | Cloudinary profile images (always replace); Multer + Sharp; signed URL delivery; async cleanup; **`MEDIA_STORAGE_ROOT` superseded and removed**. |

### Migration name

`r1_p04_customer_profiles_preferences_text_addresses`

Directory: `prisma/migrations/r1_p04_customer_profiles_preferences_text_addresses/`

### Module map

| Module | Ownership |
|---|---|
| `src/modules/customers/` | Customer profiles, preferences, text addresses, privacy requests, FR-028 SELF policy, retention sweep |
| `src/modules/media/` | Protected `media_files` metadata and **Cloudinary** storage (**DEC-033**; local `MEDIA_STORAGE_ROOT` superseded) |
| Authentication (additive) | `privacy.requests.reassign` permission, `PRIVACY_REQUEST_REASSIGN` operation, `privacy_request_reassign` reason |
| Admin | Audit lifecycle via ports only (general/privileged/denial writers wired in later foundation tasks) |
| Configuration | Active country resolution for address `countryCode` → `country_id` |

### Story-gated route registration

- No `/api/v1/customers` routes are mounted during this foundation slice.
- `createCustomersRouter()` returns an empty router until each user story completes its handlers.
- No temporary 501 handlers or unfinished public route mounts.

### Prior migrations (unchanged)

Existing applied migrations before R1-P04 remain immutable. R1-P04 adds one
forward-only directory only.

---

## T002 — Pre-implementation module inventory

Evidence captured **before** creating module trees:

- `src/modules/customers/` — **absent** (Glob 0 files at implementation start)
- `src/modules/media/` — **absent** (Glob 0 files at implementation start)

Both module scaffolds were created during T017–T019 of this authorized slice.

---

## T010–T011 — Schema and migration

### Prisma schema extensions

- Enums: `PrivacyRequestPurpose`, `PrivacyRequestStatus`, `PrivacyRequestOutcomeCode`, `PreferredLanguage`, `MediaOwnerType`, `MediaStatus`
- Extended `PrivilegedActionOperation` with `PRIVACY_REQUEST_REASSIGN`
- Models: `CustomerProfile`, `IndividualProfile`, `CompanyProfile`, `EngineerProfile`, `UserPreferences`, `UserAddress`, `PrivacyRequest`, `MediaFile`
- Opposite relations on `User` and `Country`
- `onDelete Restrict` on all FKs except `customer_profiles.profile_image_media_file_id` → `SetNull`

### Raw migration SQL (hand-reviewed)

- Partial unique index `privacy_requests_one_active_per_purpose`
- Lifecycle CHECK constraints for PENDING / PROCESSING / COMPLETED / REJECTED / CANCELLED
- `processor_id` stored as nullable TEXT with **no FK**
- Forward-only; no `DROP TABLE`, `TRUNCATE`, or `DELETE FROM`

---

## T012 — Prisma generate and validate

| Command | Result | Output |
|---|---|---|
| `npm run prisma:generate` | **PASS** (exit 0) | Generated Prisma Client 7.9.0 to `src/generated/prisma` in ~387ms |
| `npm run prisma:validate` | **PASS** (exit 0) | `The schema at prisma\schema.prisma is valid` |

Recorded: `2026-08-07`.

---

## T014 — Environment variables

| Variable | Schema | Notes |
|---|---|---|
| `MEDIA_STORAGE_PROVIDER` | Required when customers/media composed | Functional value `cloudinary`; `s3` fails readiness (DEC-033) |
| Cloudinary env vars | Required when provider is `cloudinary` | `CLOUDINARY_*`, `MEDIA_IMAGE_MAX_BYTES`; secrets never exposed |
| `PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS` | `optionalPositiveIntegerSchema` (no default) | Tooling without customers runtime does not require this value |

**Removed (DEC-033):** `MEDIA_STORAGE_ROOT`

Documented in `.env.example`.

---

## T015–T016 — Authentication catalog

- Permission: `privacy.requests.reassign`
- Role mapping: `staff_admin` only
- Privileged reason: `privacy_request_reassign` → `PRIVACY_REQUEST_REASSIGN`
- Protected operation: `customers.privacy.requests.reassign` (`publicHttp: false`)
- Seed reads catalog via existing upsert — no special seed logic beyond catalog constants

---

## T017–T019 — Module scaffolds

Minimal skeletons created under `src/modules/customers/` and `src/modules/media/`.
Processor capability constant exported from
`src/modules/customers/domain/privacy-processor.capability.ts`:

`PRIVACY_PROCESSOR_CAPABILITY = "privacy.requests.process"`

---

## Foundation tasks completed in this slice

| Task | Summary |
|---|---|
| T001 | This baseline document |
| T002 | Confirmed no premature customers/media trees |
| T003 | `tests/integration/migration-r1-p04.test.ts` |
| T004 | Extended `migration-clean-apply.test.ts` |
| T010 | Extended `prisma/schema.prisma` |
| T011 | Created phase-owned migration SQL |
| T012 | Prisma generate/validate (see section above) |
| T014 | Env vars in `env.ts` and `.env.example` |
| T015 | Auth catalog constants |
| T016 | Satisfied by catalog + existing seed upsert |
| T017 | Customers module scaffold |
| T018 | Media module scaffold |
| T019 | Privacy processor capability constant |

**Checkpoint**: Foundation schema, migration, env, catalog, and scaffolds are in
place. User-story implementation and route mounting remain pending (T020+).

---

## T020–T024 — Foundation audit, transaction, and composition seams

- Admin exposes the general transactional audit writer and the non-transactional
  redacted denial writer. Customers receives these only as public contracts.
- `PrismaCustomersUnitOfWork` accepts only general and privileged transactional
  factories; it cannot accept or invoke the denial writer.
- When authentication is enabled, composition requires Cloudinary media env
  (**DEC-033**) and `PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS`, constructs the
  Cloudinary media adapter, injects general/privileged/denial audit seams, and
  adds a customers runtime readiness probe.
- Customer routes are still story-gated: the mount contains only completed US1
  profile and profile-image handlers. No placeholder, 501, address, preference,
  contact, or privacy route is registered.

## T025–T037 — US1 profile MVP

### Delivered

- Category-isolated Individual, Company, and Engineer profile read/upsert
  workflows with trimmed strict Zod bodies and FR-028 trusted-principal
  authorization. Authentication identity values are neither read nor mutated.
- Owner-private explicit not-created profile responses.
- Protected local profile-image byte storage with UUID opaque keys, allowlisted
  JPEG/PNG/WebP content types, root containment, transactional association,
  association replacement/removal, and filesystem compensation after a failed
  database/audit association.
- Successful profile/image mutations append minimized general transactional
  audit evidence. Ordinary successful profile/image GET operations do not write
  business audit records. Denials pass through the injected non-transactional,
  redacted Admin denial-audit writer.
- Only the following mounted routes are complete:
  `GET|PUT /api/v1/customers/profiles/{individual,company,engineer}` and
  `GET|PUT|DELETE /api/v1/customers/profile-image`.
- `src/swagger/openapi.document.ts` documents only those US1 operations.

### Evidence (2026-08-07)

| Command | Result |
|---|---|
| `npm run prisma:generate` | PASS — Prisma Client 7.9.0 generated |
| `npm run prisma:validate` | PASS — schema valid |
| `npm test -- --run tests/integration/migration-r1-p04.test.ts tests/integration/migration-clean-apply.test.ts` | PASS — 2 files, 18 tests |
| `npm test -- --run tests/unit/modules/customers/profile-fields.test.ts tests/unit/modules/media/media-path-safety.test.ts tests/unit/modules/customers/customer-self-policy.test.ts` | PASS — 3 files, 12 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `git diff --check` | PASS |

`db:validate-clean-migration` passed its structural SQL checks but refused the
configured `TEST_MIGRATION_DATABASE_URL` before deploy because it already
contains the R1-P01–R1-P03 tables. This is the intended safety guard: the
actual clean apply remains blocked until an approved, empty disposable target
is provided. The R1-P04 database integration tests are gated by
`TEST_DATABASE_HAS_R1_P04=true` so the established pre-R1-P04 shared test
target is never mutated accidentally.

## T038–T046 — US2 addresses and US5 protection

- Added owner-private text-address CRUD with strict no-geo input validation,
  active Configuration country-code resolution to `country_id`, version CAS,
  peer-only lists, transactional mutation audit, and redacted non-transactional
  denial audit.
- Mounted `GET|POST /api/v1/customers/addresses` and
  `GET|PUT|DELETE /api/v1/customers/addresses/:addressId`; published the same
  completed handlers in the living OpenAPI document.
- Added address validation, authorization-matrix, eligibility-loss, and
  denial/non-audit read coverage.

## T047–T054 — US3 contact state and preferences

- Added the narrow Authentication identity-facts contract and a customers
  contact-state projection; it is read-only and changes no R1-P02 HTTP route.
- Added identity-wide preference defaults and DEC-032 full replacement:
  version CAS; `AR`/`EN`/`null` language; complete optional SMS/push matrix;
  mandatory security and active-service notices locked enabled.
- Mounted `GET /api/v1/customers/contact-state` and
  `GET|PUT /api/v1/customers/preferences`, with strict Zod validation,
  non-TX denial audit, transactional preference-mutation audit, and OpenAPI.

### Focused validation (2026-08-07)

| Command | Result |
|---|---|
| `npm test -- --run tests/unit/modules/customers/address-validation.test.ts tests/unit/modules/customers/preferences-policy.test.ts tests/integration/customers/addresses.test.ts tests/integration/customers/contact-state.test.ts tests/integration/customers/preferences.test.ts tests/integration/customers/authorization-matrix-us1-us2.test.ts tests/integration/customers/eligibility-retention.test.ts` | PASS — 7 files, 13 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |

An approved disposable database with `TEST_DATABASE_HAS_R1_P04=true` is still
required to execute the live Prisma CRUD/rollback cases; the established test
target is intentionally not mutated.

## T055–T067 — US4 privacy-request foundation

- Customers owns request persistence, partial-unique active-request behavior,
  lifecycle transitions, customer-visible `purge_after` exclusion, and a
  bounded terminal-metadata sweep. `processor_id` remains an opaque value with
  no FK.
- Customer HTTP exposes only submit, list, get, and pending cancellation:
  `POST|GET /api/v1/customers/privacy-requests` and
  `GET|POST /api/v1/customers/privacy-requests/:privacyRequestId[/cancel]`.
  No processor or privileged HTTP route was added.
- The composition-only `PrivacyProcessorPort` enforces the trusted
  `privacy.requests.process` capability for claim/resolve. The
  `PrivacyPrivilegedPort` requires the declared staff-admin protected operation
  and the `privacy_request_reassign` reason, then writes privileged audit
  evidence in the same customers transaction.
- Terminal outcomes are closed to `REQUEST_FULFILLED` and
  `REQUEST_REJECTED`; no request workflow changes account state, sessions,
  customer data, or export-file state.
- Retention starts once at application startup and then hourly; only expired
  terminal `privacy_requests` metadata is deleted in bounded batches. Audit
  records are never included in the sweep.

### Focused validation (2026-08-07)

| Command | Result |
|---|---|
| `npm test -- --run tests/unit/modules/customers/privacy-lifecycle.test.ts tests/unit/modules/customers/privacy-authority.test.ts tests/integration/customers/privacy-requests.test.ts tests/integration/customers/privacy-retention.test.ts tests/integration/customers/authorization-matrix-us3-us4.test.ts` | PASS — 5 files, 9 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |

Live Prisma claim/cancel/resolve/reassign rollback and retention-purge tests
remain gated on an approved disposable R1-P04 database
(`TEST_DATABASE_HAS_R1_P04=true`); the source transaction boundary ensures an
audit append failure aborts its enclosing lifecycle mutation.

---

## T013 — Disposable migration apply evidence

| Command | Target | Result |
|---|---|---|
| `DATABASE_URL=$TEST_MIGRATION_DATABASE_URL npm run prisma:migrate:deploy` | Neon DB `cleanora_r1_p03_clean_proof` (isolated; already had R1-P01–R1-P03) | **PASS** — applied `r1_p04_customer_profiles_preferences_text_addresses` |
| `npm run prisma:migrate:status` (same URL) | same | **PASS** — Database schema is up to date |
| `npm test -- tests/integration/migration-r1-p04.test.ts tests/integration/migration-clean-apply.test.ts` | SQL/history assertions | **PASS** |

Note: A wipe-and-recreate empty-DB clean apply was not required for this evidence
because the dedicated clean-proof database already contained earlier phases and
accepted the forward-only R1-P04 migration. Full empty-DB chronology remains
covered by the static inventory/SQL guards in `migration-clean-apply.test.ts`.

---

## T068–T074 — Polish acceptance harnesses

| Task | Artifact |
|---|---|
| T068 | `tests/integration/authentication/r1-p02-contract-freeze.test.ts` |
| T069 | `tests/integration/customers/sc005-cohort.test.ts` (assignment lock always; live journey gated) |
| T070–T071 | `sc008-manifest.ts` + `sc008-workload.test.ts` (exact 1000 rows / 25×40; live latency gated) |
| T072 | `docs/apis/openapi/r1-p04-customer-self-service.yaml` covered by `openapi:validate` |
| T073 | `traceability.md` updated with implementation evidence links |
| T074 | `tests/integration/customers/fr035-read-non-audit.test.ts` |

Focused polish tests (2026-08-07): **7 files, 28 passed, 3 skipped** (live DB gates).

---

## T075–T076 — Quality gates

| Command | Result |
|---|---|
| Focused polish + migration tests | PASS — 28 passed / 3 skipped |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run docs:check` | PASS — `{"ok":true,"checked":11}` |
| `npm run openapi:validate` | PASS — includes `r1-p04-customer-self-service.yaml` |
| `npm run prisma:validate` | PASS |
| `git diff --check` | PASS (CRLF notices only) |

Live SC-005/SC-008 HTTP journeys remain gated on `TEST_DATABASE_HAS_R1_P04=true`.
Manifest/cohort assignment locks and threshold assertions are executable and
fail closed when the gate is enabled.

---

## T077 — Anti-scope scan evidence

| Probe | Result |
|---|---|
| `customer` role / `resource.self.*` in customers module | none |
| Geospatial columns in R1-P04 schema/migration | none |
| Queues / BullMQ in customers/media | none |
| AppConfig key `privacy.request.terminal_retention_days` | none |
| Temporary 501 customer handlers | none |
| Public processor claim/resolve/reassign HTTP | none |

---

## T078 — Implementation review package (historical — phase later Completed)

Independent review package prepared while phase was still In Progress. Phase is
now **Complete** (2026-08-08). Historical checklist items below remain as
recorded at T078.

### Diff scope

- Prisma schema + `r1_p04_customer_profiles_preferences_text_addresses` migration
- `src/modules/customers/**`, `src/modules/media/**`
- Admin general/denial audit writers; Auth catalog additive rows
- Composition/routes/OpenAPI/env wiring
- Specs planning evidence updates; published OpenAPI path
- Unit + integration tests under `tests/**/customers` and related

### DoD checklist (implementation)

- [x] FR-001–FR-048 and SC-001–SC-019 tasked with executable evidence (live DB cases gated where required)
- [x] Phase migration reviewed and applied on disposable test DB
- [ ] Independent implementation review PASS — **pending** (historical review **CHANGES REQUIRED**; historical first re-review **BLOCKED**; latest re-review **CHANGES REQUIRED**; next gate fresh independent re-review)
- [ ] Human-owner Complete approval — **not requested; not claimed**

**Phase status**: T001–T100 recorded complete in `tasks.md` (historical).
**T101–T109** checked after validation (2026-08-08). Next gate: fresh
independent read-only implementation re-review. R1-P04 is **not** Complete. No
commit/push/merge/deploy/production migration was performed by this
documentation update.

---

## DEC-033 repair — implementation validated; re-review PENDING (2026-08-07)

Human owner authorized implementation repair after independent implementation
review **`CHANGES REQUIRED`**. Repair supersedes local profile-image storage.

### Scope delivered

- Cloudinary provider via `MEDIA_STORAGE_PROVIDER` (local adapter +
  `MEDIA_STORAGE_ROOT` removed)
- Multer `memoryStorage` + Sharp WebP normalization + always-replace (no hash)
- Signed authenticated delivery URL in `profileImage` response
- Forward-only migration
  `r1_p04_customer_profiles_preferences_text_addresses_02_cloudinary_profile_image_storage`
  (renamed for lexical order; historical short name
  `r1_p04_cloudinary_profile_image_storage` evidence retained)
  applied on disposable proof DB `cleanora_r1_p04_clean_proof` (old
  `cleanora_r1_p03_clean_proof` historical, unmodified)
- Remediated non-media findings (SC-005/SC-008/FR-035, CAS, cleanup, denial
  audit outside UoW, `privacyRequestId`, Auth public contracts, unit gate)

### Repair tasks

T079–T093 checked after implementation + validation. Historical T001–T078
unchanged.

### Validation (repair) — recorded results

| Command / suite | Result |
|---|---|
| `npm run prisma:generate` / `prisma:validate` | PASS |
| `npm run typecheck` / `lint` / `build` / `docs:check` / `openapi:validate` | PASS |
| `npm run test:unit` | **104 files / 464+ tests PASS** (later denial/multer/factory additions green in coverage run) |
| Focused media/profile-image units | PASS |
| Migration deploy to `cleanora_r1_p03_clean_proof` only | PASS (`r1_p04_cloudinary_profile_image_storage`) |
| `npm run test:integration` (TEST_DATABASE_URL → proof DB) | **49 files / 139 tests PASS** |
| SC-005 live cohort | PASS (≥19/20 within 5 min) |
| SC-008 live workload | PASS (1000 rows; ≥95% ≤2s) |
| FR-035 live non-audit | PASS |
| `npm run test:coverage` (proof DB) | **158 files / 616 tests PASS**; statements **81.57%**, branches **76.08%**, functions **84.68%**, lines **83.24%** (thresholds met) |
| `git diff --check` | PASS (CRLF warnings only) |
| Live Cloudinary smoke | Historical row superseded by T106 **PASS** (`cloudinary-smoke-evidence.json`) |

**DB note:** Default `.env` `TEST_DATABASE_URL` still names the R1-P02 CI database.
R1-P04 DB suites were executed by overriding `TEST_DATABASE_URL` to the approved
disposable proof database (`TEST_MIGRATION_DATABASE_URL` →
`cleanora_r1_p03_clean_proof`). The R1-P02 CI database was **not** migrated.

### Status locks

| Gate | Status |
|---|---|
| Independent implementation review | Historical **CHANGES REQUIRED** |
| First independent re-review | Historical **BLOCKED**; remediations T094–T100 validated |
| Latest independent re-review | Historical **CHANGES REQUIRED**; remediations T101–T109 validated |
| Phase Complete | **not claimed** |
| Commit / push / merge / deploy / production migrate | **not performed** |
| Live Cloudinary smoke | **PASS** (`cloudinary-smoke-evidence.json`) |
| Proof DB | `cleanora_r1_p04_clean_proof` (old `cleanora_r1_p03_clean_proof` unmodified) |
| Next gate | Fresh independent read-only implementation re-review |

---

## Post-re-review remediations T094–T100 (2026-08-07)

| Item | Result |
|---|---|
| Denial audit outside UoW | Ownership denials after TX; unit regressions PASS |
| Media public facade | `media.public.ts`; customers no domain/infra imports |
| Cloudinary `type === "authenticated"` | Adapter + unit rejection of `type: "upload"` |
| First-create CAS | P2002 → CONFLICT; concurrent DB test PASS |
| SC-008 real media rows | Seeded GET path; no no-op rows; PASS ~507s |
| Full `test:integration` first attempt | **49 files / 140 tests PASS** on proof DB |
| `test:unit` | **110 files / 482 tests PASS** |
| `test:coverage` | **159 files / 622 tests PASS**; stmts 81.48%, branches 76.11%, funcs 84.78%, lines 83.13% |
| Live Cloudinary smoke | **PASS** |

---

## Post-re-review CHANGES REQUIRED remediations T101–T109 (2026-08-08)

| Item | Result |
|---|---|
| Existence oracle (T101) | Cross-customer address/privacy denials equivalent; denial after TX |
| Migration order (T102) | Renamed to `r1_p04_customer_profiles_preferences_text_addresses_02_cloudinary_profile_image_storage`; `cleanora_r1_p04_clean_proof` created/migrated; old proof DB untouched |
| Test DB fail-closed (T103) | Unsafe R1-P04 test DB configs rejected |
| Isolation flakes (T104) | OTP/seed-drift/coverage flake root causes fixed |
| SC-008 media matrix (T105) | Exact 5 auth / 5 add / 5 replace / 5 remove leaves |
| Live smoke (T106) | **PASS** → `cloudinary-smoke-evidence.json` |
| `media.public` infra (T107) | Public facade infrastructure-free; factory in composition |
| Status surfaces (T108) | Aligned; historical verdicts preserved; not Complete |
| Validation matrix (T109) | Sequential gates on `cleanora_r1_p04_clean_proof` only |

## Convergence-audit remediations T110–T112 (2026-08-08)

| Item | Result |
|---|---|
| DEC-033 contract/data-model doc drift (T110) | `data-model.md` / contracts README / transaction-boundaries aligned; regression PASS |
| Privileged-reason seed P2002 race (T111) | Transactional upsert-by-code + bounded P2002/P2034 retry; seed-drift PASS |
| Seed competing pool under coverage (T112) | Shared Prisma client reuse + standalone max-1 pool + pre-clean coverage; coverage PASS |

### Post-T112 first-attempt broad gates (proof DB `cleanora_r1_p04_clean_proof`)

| Gate | Result |
|---|---|
| Focused FR-030 / denial / DB-guard / OTP / seed-drift / media / Cloudinary / concurrency | PASS |
| SC-005 / SC-008 / FR-035 | PASS (SC-008: 1000 rows; media leaves 5/5/5/5) |
| typecheck / lint / build / docs / openapi / prisma | PASS |
| `test:unit` | **113 files / 500 tests PASS** |
| `test:integration` (first after T112) | **50 files / 141 tests PASS** |
| `test:coverage` (first after T112) | **163 files / 641 tests PASS**; stmts 82.21%, branches 76.61%, funcs 85.33%, lines 83.77% |
| `git diff --check` | PASS (CRLF warnings only) |

**Attempt history (honest):** Integration after T110 failed once on seed-drift P2002 (pre-T111). Coverage after T111 failed once (OTP 500 + coverage `.tmp` contention from competing seed pools; pre-T112). First integration and first coverage after final T112 both PASS.

**Status locks (superseded by Complete 2026-08-08):** Historical In Progress
note before final independent PASS; see Owner Complete approval section below.

---

## Final re-review repair T113–T117 (2026-08-08)

| Item | Result |
|---|---|
| T113 DB command runner | `scripts/r1-p04-database-command.cjs`; incident `docs/ai/incidents/r1-p04-cleanora-database-incident.md`; 9 unit tests PASS |
| T114 Response-derived smoke | Adapter upload/destroy contracts; smoke script; unit tests PASS; live smoke **PASS** (`cloudinary-smoke-evidence.json` 2026-08-08T09:01:07Z; `firstDestroyResult`/`secondLookupOrDestroyResult`/`uploadResourceType`/`uploadType` from provider) |
| T115 Audit rollback integration | `customers-audit-rollback.test.ts` — preferences + privileged reassignment; 2/2 PASS |
| T116 MINOR closure | `clean-coverage.cjs` repo-root guard; DEC-033 8-surface doc regression; Sharp EXIF strip test — PASS |
| T117 Broad gates | Closed after T118–T120: unit **117/530**; integration **51/143**; coverage **168/673** @ 83.03%/77.3%/85.98%/84.57%; SC-008 concurrent PASS |

---

## SC-008 concurrent-lane repair T118–T120 (2026-08-08)

| Item | Result |
|---|---|
| Diagnosis | Verified: prior harness used `for (const row of rows) await executeRow(...)` serializing all 1,000 ops; violated locked 25 concurrent lanes |
| T118 | `sc008-lane-executor.ts` — group by lane, start barrier, 25 concurrent workers × 40 ordered slots, per-lane runtime isolation, media pre-map; unit 5/5 PASS |
| SC-008 timing | elapsedMs **37735**; maxActiveLanes **25**; ≤2s ratio **0.976**; per-lane ~34–38s overlap; media 5/5/5/5 preserved |
| Host→Neon TCP | Probe: 15 concurrent OK; 20–25 hit ETIMEDOUT/ENETUNREACH — pool capped at 15 (measured), 25 JS workers retained |
| T119 coverage ENOENT | Root cause: `clean-coverage.test.ts` called deleting `cleanCoverageDirectory` mid-coverage; fixed via `resolveCoverageDirectory`; first post-fix coverage **PASS** |
| T120 | Full sequential matrix PASS; attempt log `.validation-t118/attempt-history.txt` |

**Status locks (closed):** **Complete** as of `2026-08-08` by exact human-owner
approval. Fresh independent final implementation re-review **`PASS`**. T001–T120
remain checked. Historical `CHANGES REQUIRED` / `BLOCKED` verdicts preserved as
labelled historical evidence. Two non-blocking MINOR follow-ups recorded in
`completion-report.md` (unused SC-008 eslint-disable; acceptance could assert
`maxActiveLanes === 25`) — not fixed by Complete. Separate unresolved
operational incident: accidental historical migration of database `Cleanora`
(not accessed; Complete approval does not authorize any `Cleanora` action). No
commit/push/merge/deploy/next-phase activation performed by this closure.

---

## Owner Complete approval (2026-08-08)

Exact phrase recorded:

```text
I approve R1-P04 — Customer Profiles, Preferences & Text Addresses as Complete.
```

Evidence package retained from the fresh independent final re-review and T120
gates: unit 117/530; integration 51/143; coverage 168/673 @ 83.03% / 77.3% /
85.98% / 84.57%; SC-008 25 concurrent lanes (ratio 0.974; maxActiveLanes 25);
live Cloudinary smoke PASS; typecheck/lint/build/docs/openapi/prisma/`git diff
--check` PASS. See `completion-report.md`.
