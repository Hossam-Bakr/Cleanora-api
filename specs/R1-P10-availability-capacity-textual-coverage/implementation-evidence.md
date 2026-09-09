# R1-P10 Implementation Evidence — Batch A (T001–T032)

**Phase**: R1-P10 — Availability, Capacity & Textual Coverage

**Batch**: Batch A — test boundary, additive schema/migration, Egypt
`Africa/Cairo` country-required time-zone transition, Staff locality/time-zone
management (US1), Provider textual coverage foundation and matching (US1),
plus the "Cursor Batch A repair brief" and "Cursor Batch A final repair
brief" corrections described below.

**Scope note**: T001–T032 only. Provider/Worker calendars, exceptions, pause,
capacity, readiness, public evaluation, Swagger/Postman regeneration and final
phase evidence (T033–T077, later Cursor batches) are out of scope for this
record. (Earlier drafts of this file incorrectly referenced a `T033–T086`
range; the actual `tasks.md` for this phase ends at `T077`.)

**Status**: Not staged, not committed. Human phase completion has not been
approved. This file is self-contained: every command below was re-run at the
end of the final repair pass and its exact result is recorded here (not in a
separate chat reply).

## Repair passes applied after the initial Batch A implementation

Two repair passes were applied on top of the original T001–T032 delivery,
both **in place** (no task re-scoping, no T033+ work):

### Repair pass 1 ("Cursor Batch A repair brief")

1. Reconstructed `prisma/schema.prisma` as an additive, minimal diff (HEAD +
   exact R1-P10 additions only), avoiding `prisma format` churn.
2. Replaced hardcoded authority facts in
   `PrismaProviderAvailabilityRepository.resolveAuthorityFacts` with
   repository-backed Provider/member facts plus Authentication's
   transaction-bound `ProviderIdentityReader` for identity/capability.
3. Added `providerCountryId` to the trusted authorization facts and enforced
   that every coverage selection belongs to the Provider's own country
   (`PROVIDER_AVAILABILITY_COVERAGE_COUNTRY_MISMATCH`).
4. Fixed Provider availability idempotency: `requestFingerprint` covers every
   semantically relevant input (selections, `expectedVersion`, `reasonCode`);
   mismatch is a stable conflict; an incomplete row never replays.
5. Added `ConfigurationLocalityCommand`, a Configuration-owned durable
   UUID-idempotency receipt table, and rewired every Staff locality/time-zone
   write (city create/patch, district create/patch, country time-zone PUT)
   through it.
6. Reordered and extended the migration to backfill every active country's
   `platform.default_timezone` `CountryConfig` row (Egypt → `Africa/Cairo`)
   **before** switching `platform.default_timezone`'s resolution policy to
   `COUNTRY_REQUIRED`, with a `NOT EXISTS` no-overwrite guard.
7. Added unique constraints against exact-duplicate weekly schedule periods
   (`ProviderSchedule`/`WorkerSchedule`) and exact-duplicate/holiday-clash
   dated exceptions (`ProviderScheduleException`/`WorkerScheduleException`).
8. Reconciled task/evidence markers to the repaired behavior.

### Repair pass 2 ("Cursor Batch A final repair brief" — this pass)

1. **DEC-058 exact authorization policy.** Added
   `decideProviderAvailabilityManagementAuthorization` in
   `src/modules/providers/domain/provider-availability.policy.ts`: an active,
   exact-scope Owner is allowed **without** an enabled `provider_admin`
   capability; an active, exact-scope Admin requires it; every other
   membership level, inactive membership, or wrong-Provider scope denies
   non-enumeratingly (`NOT_FOUND`); an unapproved Provider denies with
   `PROVIDER_STATE_INVALID`. `ProviderAvailabilityService.assertManager` now
   calls this policy instead of R1-P09's
   `decideProviderServiceManagementAuthorization`; the Phase 9 import/cast is
   removed entirely.
2. **Transaction-bound locality reads.** `ProviderAvailabilityServiceDependencies`
   no longer carries an outer `authorizationReader`, `localityReader`, or
   `repository`. Every read/write unit of work now receives a
   `{ repository, localityReader }` context built inside the same interactive
   transaction: `withProviderAvailabilityWriteTransaction` /
   `...ReadTransaction` call `createTransactionalLocalityReader(tx)` from
   Configuration's public contract alongside the Providers repository.
   Coverage validation and `matchesDistrict` consume only that
   transaction-bound reader. Composition and the live harness were updated to
   match; a unit seam test proves the callback-provided reader is the one
   actually used.
3. **PostgreSQL-safe unique-race reservation.** Both
   `PrismaProviderAvailabilityRepository.reserveOrReplayCoverageCommand` and
   `PrismaLocalityRepository.reserveOrReplayCommand` now reserve with
   `createMany({ data: [...], skipDuplicates: true })` instead of `create` +
   catch-`P2002` + `findUnique` (which is unsafe: a PostgreSQL unique
   violation aborts the whole interactive transaction, so a follow-up query
   in the same transaction cannot recover). When `createMany` reports
   `count: 0`, the existing winner is read back and resolved through the same
   fingerprint/actor/status decision path used for a pre-existing row.
4. **Actor-bound command receipts.** Both repositories now compare the
   stored `actorUserId` against the incoming actor on every replay decision.
   A different actor presenting the same `(scopeKey, idempotencyKey)` raises
   the same stable idempotency-conflict error as a fingerprint mismatch; it
   is never treated as a valid replay of another actor's safe result.
5. **Removed the `pgcrypto` dependency.** The time-zone backfill `INSERT` no
   longer calls `gen_random_uuid()`. It now computes a deterministic
   PostgreSQL-core id: `'r1p10bf_' || md5(c."id" || ':platform.default_timezone')`.
   Statement order (`version` column → backfill `INSERT` → policy `UPDATE`),
   the `NOT EXISTS` guard, and the Egypt special-case are unchanged. A new
   static test (`tests/unit/scripts/r1-p10-migration-static.test.ts`) asserts
   the executable SQL never references `gen_random_uuid` or `CREATE
   EXTENSION`, uses the `md5`-based id, and preserves statement order.
6. **Live Worker schedule fixture fix.** `tests/integration/database/
   r1-p10-schema-constraints.test.ts`'s `ProviderWorker` fixture now uses the
   real R1-P07 fields (`providerId`, `status: "ACTIVE"`); the nonexistent
   `userId`/`isCleaner` fields were removed.
7. **Additional idempotency unit coverage** for cross-actor conflicts,
   `expectedVersion`/`reasonCode`-only differences, in-progress/incomplete
   receipts, one-history-event-per-replay, and Owner-without-admin-capability
   success — see the file-by-file list below.
8. **This file** rewritten to be self-contained and to correct the
   out-of-range task reference.

## T005 — Pre-implementation selection and preservation evidence

### Phase 10 test boundary selected (T001–T004)

- `vitest.r1-p10.config.ts` selects exactly **14** Phase-10-owned files under
  `tests/unit/**` and `tests/integration/**` (9 non-DB-gated + 5 DB-gated); no
  `R1-P0[1-9]` historical suite is referenced (enforced by
  `tests/unit/scripts/r1-p10-test-selection.test.ts`, T003). The repair pass
  added `tests/unit/scripts/r1-p10-migration-static.test.ts`,
  `tests/unit/configuration/locality-repository-reservation.test.ts` and
  `tests/unit/providers/provider-availability-repository-reservation.test.ts`
  to this list (all non-DB-gated, pure fake/mock-backed).
- Coverage `include` names only Phase-10-owned/touched `src/**` production
  files (Configuration locality vertical, Providers availability/coverage
  foundation, and the touched Authentication/Configuration/composition public
  seams). Thresholds remain statements 80 / branches 75 / functions 80 /
  lines 80 (unchanged project default). This record does not claim a final
  coverage percentage; see "Coverage scope" below.
- `npm run test:r1-p10` / `npm run test:coverage:r1-p10` scripts added to
  `package.json`; `@js-temporal/polyfill` added as a runtime dependency for
  the Provider availability calendar utility foundation (T016).
- Shared, secret-free Phase 10 fixtures live in
  `tests/helpers/r1-p10-availability-fixtures.ts` (synthetic IDs/content only,
  `hasExplicitR1P10TestDatabase()` / `requireR1P10ProofDatabaseUrl()` gates for
  later explicitly-controlled DB proof batches).

### Pre-existing Phase 9 preservation

- No file under `src/modules/authentication/authentication.public.ts`,
  `src/modules/configuration/configuration.public.ts`, or the Phase 9
  Providers files listed in the working tree at session start
  (`provider-service*.ts`, `prisma-provider-service*.ts`, etc.) was reverted.
  Batch A only **adds** exports/types to these files:
  - `authentication.public.ts` / `authorization.types.ts` /
    `authorization.catalog.ts`: additive `configuration.localities.read`,
    `configuration.localities.write` permissions and the
    `CONFIGURATION_LOCALITY_WRITE` privileged operation +
    `configuration_locality_change` reason. No existing permission, role
    mapping, or reason was removed or renamed.
  - `configuration.public.ts`: additive `CountryTimeZoneReader` and
    `LocalityReader` public interfaces/factories. No existing export
    (`ActiveCountryReader`, `ProviderServicePricingPolicyReader`, etc.) was
    changed.
  - `config-key.catalog.ts`: `platform.default_timezone` evolved in place
    (`resolutionPolicy` `GLOBAL_ONLY` → `COUNTRY_REQUIRED`; `valueSchema`
    narrowed to a validated IANA identifier string). No second time-zone key
    was added; this is the same key, evolved per DEC-053.
  - All Phase 9 Provider-service files remained untouched by Batch A; the
    only Providers changes are new files under
    `src/modules/providers/domain/provider-availability*`,
    `src/modules/providers/infrastructure/*provider-availability*`,
    `src/modules/providers/provider-availability.*`, plus additive wiring in
    `src/composition.ts` and `src/routes/index.ts` (new router
    registrations only; the repair pass **removed** the now-dead
    `authorizationReader`/`localityReader`/`repository` construction lines
    from the `ProviderAvailabilityService` wiring block in `composition.ts`,
    replacing them with the transaction-bound context factories — no
    existing Phase 9 line was touched).
- `git status` at session start showed the Phase 9 files above already
  modified/untracked from the preceding session; those pre-existing diffs
  were preserved as-is and not reformatted or reverted by this batch or its
  repair passes.

## Behavior implemented in Batch A (T001–T032)

1. **Test boundary** (T001–T004): Phase 10 Vitest config, selection-boundary
   test, and secret-free fixtures.
2. **Schema/migration** (T006–T008): additive Prisma models
   (`City`, `District`, `ProviderAvailabilityConfiguration`,
   `ProviderCoverageArea`, `ProviderSchedule`, `ProviderScheduleException`,
   `WorkerSchedule`, `WorkerScheduleException`, `ProviderCapacityRule`,
   `ProviderTemporaryPause`, `ProviderAvailabilityCommand`,
   `ProviderAvailabilityHistory`, `ConfigurationLocalityCommand`) and enums
   in `schema.prisma`; hand-written, reviewed, forward-only
   `prisma/migrations/r1_p10_availability_capacity_textual_coverage/migration.sql`
   (no destructive statement — see "Migration SQL safety review" below);
   Egypt seed transitioned to country-scoped `Africa/Cairo` under
   `COUNTRY_REQUIRED` resolution in `prisma/seed.ts`.
3. **Authorization** (T009–T011): `configuration.localities.read` (non
   -privileged, `staff_admin`), `configuration.localities.write` (privileged,
   `CONFIGURATION_LOCALITY_WRITE` + `configuration_locality_change` reason).
4. **Configuration locality vertical** (T012–T015, T021–T025): UUID-idempotent
   (via `ConfigurationLocalityCommand`), reason-bound, audited City/District
   create+patch and Country time-zone get/put service, repository, controller
   and routes, mounted at the Staff configuration paths from
   `contracts/http-api.md`; narrow transactional `LocalityReader` /
   `CountryTimeZoneReader` exposed through `configuration.public.ts`.
5. **Providers availability foundation** (T016–T018): shared Temporal-based
   IANA/civil-date calendar utility, domain types/errors/policy (including
   the DEC-058 `decideProviderAvailabilityManagementAuthorization` policy
   added in the repair pass), ports, Prisma error mapping, and a
   Serializable-isolation repository with actor/fingerprint-bound,
   PostgreSQL-safe command reservation.
6. **Provider textual coverage** (T026–T032): full-replacement coverage
   service (UUID-idempotent, versioned, exact-scope active-Owner/
   enabled-Admin-scoped per DEC-058, own-country-enforced, non-enumerating
   for cross-Provider access), schema/controller/routes at the Provider
   coverage path from `contracts/http-api.md`, wired through
   `composition.ts` / `routes/index.ts`, and matching semantics proven for
   exact active district, whole-city (including newly added districts), and
   inactive-ancestry non-match (DEC-056).
7. **Module boundaries** (T019, T020): schema-constraint DB-guarded tests and
   a Batch-A module-boundary suite confirming Configuration/Providers/
   Authentication only cross module lines through `*.public` contracts, with
   no Browse/Booking/Docker/cloud module introduced.

### Honest status of T019 / T022 / T027 / T028 / T032 (DB-gated tasks)

These five tasks' acceptance criteria include behavioral proof against a real
PostgreSQL database. Their test files exist, are correctly wired into
`vitest.r1-p10.config.ts`, compile, and are collected by Vitest, but their
`describe.skipIf(!hasExplicitR1P10TestDatabase())` guard means **every
assertion inside them is skipped, not executed,** because no disposable
Phase 10 database URL was supplied to this session:

| Task | File | Tests in file | Live-run status |
| --- | --- | --- | --- |
| T019 | `tests/integration/database/r1-p10-schema-constraints.test.ts` | 9 | Skipped (no DB URL) |
| T022 | `tests/integration/http/r1-p10-staff-localities.test.ts` | 6 | Skipped (no DB URL) |
| T027 | `tests/integration/providers/provider-availability-coverage.repository.test.ts` | 9 | Skipped (no DB URL) |
| T028 | `tests/integration/http/r1-p10-provider-coverage.test.ts` | 5 | Skipped (no DB URL) |
| T032 | `tests/integration/providers/provider-textual-coverage.test.ts` | 4 | Skipped (no DB URL) |

The checkboxes for these five tasks in `tasks.md` remain checked because the
task text is "add tests in `<file>`" and that deliverable exists and is
correctly formed; this section exists precisely so that checked state is
**not** misread as "proven against a live database." Wherever a repair item's
acceptance criterion could be independently proven without a live database
(pure fake/mock-backed unit tests), such tests were added and are counted in
the "passed" totals below, not the skipped totals. Live-database proof for
these five files remains a separate, explicitly unavailable-in-this-batch
gate.

## Exact commands, exit codes, and results (re-run at the end of this pass)

All commands were run from the repository root
(`D:\new_repos\Cleanora_R1`) on branch
`codex/r1-p10-availability-capacity-textual-coverage`.

### 1. Vitest selection (static + runtime)

```
npx vitest list --config vitest.r1-p10.config.ts
```
Exit code: `0`. Lists exactly the 135 individual test cases across the 14
files below; no `R1-P0[1-9]` historical-phase path appears anywhere in the
list.

### 2. `npm run test:r1-p10`

```
npm run test:r1-p10
```
Exit code: `0`.
```
 Test Files  9 passed | 5 skipped (14)
      Tests  102 passed | 33 skipped (135)
```

Per-file breakdown (from `--reporter=verbose`):

| File | Status | Passed | Skipped |
| --- | --- | --- | --- |
| `tests/unit/modules/r1-p10-module-boundaries.test.ts` | ✓ run | 7 | 0 |
| `tests/unit/providers/provider-availability-coverage.test.ts` | ✓ run | 43 | 0 |
| `tests/unit/configuration/locality.service.test.ts` | ✓ run | 21 | 0 |
| `tests/unit/providers/provider-availability-calendar.test.ts` | ✓ run | 4 | 0 |
| `tests/unit/configuration/locality-repository-reservation.test.ts` | ✓ run | 5 | 0 |
| `tests/unit/providers/provider-availability-repository-reservation.test.ts` | ✓ run | 5 | 0 |
| `tests/unit/modules/authentication/authorization-r1-p10.test.ts` | ✓ run | 6 | 0 |
| `tests/unit/scripts/r1-p10-test-selection.test.ts` | ✓ run | 4 | 0 |
| `tests/unit/scripts/r1-p10-migration-static.test.ts` | ✓ run | 7 | 0 |
| `tests/integration/database/r1-p10-schema-constraints.test.ts` | ↓ skipped (no DB URL) | 0 | 9 |
| `tests/integration/http/r1-p10-provider-coverage.test.ts` | ↓ skipped (no DB URL) | 0 | 5 |
| `tests/integration/http/r1-p10-staff-localities.test.ts` | ↓ skipped (no DB URL) | 0 | 6 |
| `tests/integration/providers/provider-availability-coverage.repository.test.ts` | ↓ skipped (no DB URL) | 0 | 9 |
| `tests/integration/providers/provider-textual-coverage.test.ts` | ↓ skipped (no DB URL) | 0 | 4 |
| **Total** | | **102** | **33** |

No `npm test`, `npm run test:unit`, `npm run test:integration`, or full
coverage command was run in this batch or its repair passes.

### 3. TypeScript typecheck

```
npm run typecheck
```
Exit code: `0`. (`tsc --noEmit` — no output.) One real type error was found
and fixed during this pass: `ExistingCommandRow.actorUserId` had to be
`string | null` (matching Prisma's nullable `actorUserId` column), not
`string`.

### 4. Build

```
npm run build
```
Exit code: `0`. Runs `prisma generate` (Prisma Client 7.9.0 regenerated
successfully) then `tsc -p tsconfig.build.json` with no errors.

### 5. Prisma schema validation

```
npx prisma validate
```
Exit code: `0`. Output: `The schema at prisma\schema.prisma is valid`.

### 6. ESLint (scoped to intended R1-P10 files touched in this repair pass)

```
npx eslint <every R1-P10 file touched in this pass — services, policy,
  repositories, composition.ts, vitest config, and every new/changed test
  file listed under "Files changed">
```
Exit code: `0`. No output (no findings).

### 7. Repository diff check

```
git diff --check
```
Exit code: `0`. Output is only pre-existing CRLF/LF line-ending advisory
warnings for files this batch did not touch
(`.specify/feature.json`, `docs/product/current.md`,
`docs/product/decision-log.md`,
`postman/Cleanora-R1-P08-Catalog-Management.postman_collection.json`,
`src/modules/configuration/config-key.catalog.ts`); no conflict markers or
trailing-whitespace errors were reported.

### 8. Prisma schema diff size (minimal, additive — repair item 1 from the
   first repair pass, reconfirmed unaffected by this pass)

```
git diff --stat -- prisma/schema.prisma
git diff -w --stat -- prisma/schema.prisma
```
Both report:
```
 prisma/schema.prisma | 284 +++++++++++++++++++++++++++++++++++++++++++++++++++
 1 file changed, 284 insertions(+)
```
Zero deletions, in both the ordinary and whitespace-ignored diff. This pass
made no further edits to `schema.prisma` (the `ConfigurationLocalityCommand`
model was added in the prior repair pass); no new churn was introduced.

## Migration SQL safety review (updated for this pass)

`prisma/migrations/r1_p10_availability_capacity_textual_coverage/migration.sql`
remains forward-only and additive: it adds columns/tables/indexes/enum values
and updates `app_configs`/backfills `country_configs` rows in place. No
`DROP`, no destructive `ALTER ... DROP COLUMN`, and no existing migration
file is edited. This pass's specific change:

- The time-zone backfill `INSERT` id expression changed from
  `gen_random_uuid()::text` to `'r1p10bf_' || md5(c."id" ||
  ':platform.default_timezone')`. `gen_random_uuid()` requires the
  `pgcrypto` extension, which no earlier migration in this repository
  declares; `md5()` is PostgreSQL-core and requires no extension. The
  expression is deterministic per `(country_id, key)` pair, so reruns are
  reproducible (idempotency itself is still enforced by the `NOT EXISTS`
  guard, not by the id's determinism).
- Statement order is unchanged and re-verified by a new static test
  (`tests/unit/scripts/r1-p10-migration-static.test.ts`): `country_configs`
  gains its `version` column, then the backfill `INSERT` runs (guarded by
  `NOT EXISTS` so an existing per-country override is never touched, and
  special-casing Egypt to `Africa/Cairo`), then and only then does
  `platform.default_timezone`'s `resolution_policy` switch to
  `COUNTRY_REQUIRED`.
- **Live proof that this migration applies cleanly against a real
  PostgreSQL target remains explicitly unavailable in this batch** — no
  disposable Phase 10 database URL was supplied. The static test proves the
  SQL text's structure and ordering; it does not prove successful execution.

## Coverage scope (not a final coverage claim)

`vitest.r1-p10.config.ts`'s coverage `include` list still names only
Phase-10-owned/touched `src/**` files (Configuration locality vertical,
Providers availability/coverage foundation, and the touched
Authentication/Configuration/composition public seams); thresholds are
unchanged (statements 80 / branches 75 / functions 80 / lines 80). This batch
does not run `test:coverage:r1-p10` as part of this evidence record and makes
no claim about the resulting percentage — DB-gated integration tests being
skipped means real coverage of repository/HTTP integration code paths is
necessarily lower than the configured thresholds would require for a final
phase sign-off. A coverage run remains a later, explicitly-scoped step.

## Files changed in this repair pass (final repair brief) beyond the first repair pass

- `src/modules/providers/domain/provider-availability.policy.ts` — added
  `decideProviderAvailabilityManagementAuthorization` (DEC-058) and its
  supporting types.
- `src/modules/providers/provider-availability.service.ts` — switched
  `assertManager` to the new DEC-058 policy; replaced the flat
  `authorizationReader`/`localityReader`/`repository` dependency shape with a
  per-transaction `{ repository, localityReader }` context; threaded the
  transaction-bound `localityReader` through `validateSelectionsAgainstLocalities`
  and `matchesDistrict`.
- `src/modules/providers/infrastructure/prisma-provider-availability.repository.ts`
  — added `createTransactionalLocalityReader` wiring in
  `withProviderAvailabilityWriteTransaction`/`...ReadTransaction`; rewrote
  `reserveOrReplayCoverageCommand`/`receiptFromExistingCommand` to use
  `createMany({ skipDuplicates: true })` and to bind replay decisions to
  `actorUserId`; removed the now-unused `isUniqueConstraintViolation` helper.
- `src/modules/configuration/infrastructure/prisma-locality.repository.ts` —
  mirrored the same `createMany`/actor-binding changes in
  `reserveOrReplayCommand`/`receiptFromExistingCommand`; removed the same
  now-unused helper.
- `src/composition.ts` — removed the outer
  `authorizationReader`/`localityReader`/`repository` construction for
  `ProviderAvailabilityService` (now unused imports removed too).
- `prisma/migrations/r1_p10_availability_capacity_textual_coverage/migration.sql`
  — replaced `gen_random_uuid()` with the deterministic `md5`-based id in the
  time-zone backfill `INSERT`.
- `tests/helpers/r1-p10-availability-live.ts` — updated to build
  `ProviderAvailabilityService` with only the two transaction callbacks.
- `tests/integration/database/r1-p10-schema-constraints.test.ts` — fixed the
  `ProviderWorker` fixture to use real R1-P07 fields.
- `tests/unit/providers/provider-availability-coverage.test.ts` — updated
  `buildService`/direct-construction call sites for the new context-object
  callback shape; added DEC-058 policy unit tests, cross-actor/expectedVersion/
  reasonCode conflict tests, one-history-event-on-replay test, and the
  transaction-seam tests for item 2.
- `tests/unit/configuration/locality.service.test.ts` — added actor binding
  to the in-memory fake receipt store; added the cross-actor conflict test
  and the missing patch-district conflict test.
- `tests/unit/providers/provider-availability-repository-reservation.test.ts`
  (new) — pure fake/mock-backed tests proving the `createMany`-based
  reservation and actor/fingerprint-bound replay decisions.
- `tests/unit/configuration/locality-repository-reservation.test.ts` (new) —
  same, for `PrismaLocalityRepository`.
- `tests/unit/scripts/r1-p10-migration-static.test.ts` (new) — static
  migration SQL checks (repair item 5).
- `tests/integration/providers/provider-availability-coverage.repository.test.ts`
  — added a DB-gated cross-actor conflict test (not run in this batch).
- `tests/integration/http/r1-p10-staff-localities.test.ts` — added a DB-gated
  cross-actor conflict test (not run in this batch).
- `vitest.r1-p10.config.ts` — added the three new pure unit test files to
  `include`.
- `specs/R1-P10-availability-capacity-textual-coverage/plan.md`,
  `data-model.md` — updated to describe DEC-058's exact-scope Owner/Admin
  split, transaction-bound locality reads, actor-bound command receipts, and
  the deterministic backfill id (see those files for the precise wording).
- This file.

### Repair pass 3 ("Codex Batch A mandatory acceptance repairs" — 2026-09-08)

This continuation pass repaired only the three owner-scoped mandatory Batch A
acceptance gaps confirmed by the prior read-only review:

1. **Active locality ancestry on coverage writes and matching.**
   `LocalityCityFact` now carries `countryActive`, and
   `LocalityDistrictFact` now carries `cityActive` and `countryActive` while
   preserving the existing `id` field names. Provider coverage writes reject
   inactive selected entities or inactive country/city ancestry with
   `PROVIDER_AVAILABILITY_COVERAGE_INVALID`; same-country violations still use
   `PROVIDER_AVAILABILITY_COVERAGE_COUNTRY_MISMATCH`. Matching now requires
   active country, city and district ancestry.
2. **Accepted replay before mutable locality validation.** Coverage
   replacement now authorizes first, computes the command fingerprint,
   reserves/replays the idempotency key, and immediately returns stored safe
   results for `REPLAYED` commands before any locality validation, mutation or
   history append. A regression test accepts a request, deactivates the fake
   locality, retries the identical command, and proves replay with no second
   mutation/history write.
3. **Bounded whole-transaction Serializable retry.** Providers and
   Configuration Serializable write wrappers retry the full `$transaction`
   callback up to `SERIALIZABLE_WRITE_MAX_ATTEMPTS = 3` only for recognized
   serialization/deadlock failures (`P2034`, serialization-indicated `P2028`,
   SQLSTATE `40001`/`40P01`, or already-mapped retryable domain conflicts).
   Exhaustion maps to the existing stable version-conflict errors with
   `{ reason: "SERIALIZATION_FAILURE", retryable: true }`. Validation,
   authorization, idempotency conflicts, ordinary version conflicts and
   arbitrary dependency errors are not retried.

Fresh continuation verification (non-DB; no live database proof claimed):

| Command | Exit | Result |
| --- | --- | --- |
| `node --require ./scripts/register-env.cjs ./node_modules/vitest/vitest.mjs list --config vitest.r1-p10.config.ts` | 0 | Listed 154 P10-selected test cases across 17 files |
| `npm run test:r1-p10` | 0 | 12 files passed / 5 skipped; 121 tests passed / 33 skipped |
| `npm run typecheck` | 0 | `tsc --noEmit` completed without diagnostics |
| `npm run build` | 0 | Prisma Client 7.9.0 generated; `tsc -p tsconfig.build.json` completed |
| `npx prisma validate` | 0 | `The schema at prisma\schema.prisma is valid` |
| `git diff --check` | 0 | Line-ending warnings only; no whitespace errors |
| Scoped `npx eslint` over touched P10/configuration/provider files | 0 | No findings |

No T033+ calendar, pause, capacity, public evaluation, OpenAPI/Postman,
database migration execution, Git staging/commit/push, merge or deployment work
was performed in this continuation pass.

## Batch B1 / T033 - DEC-054 calendar utility and unit tests

Scope: T033 only. This pass extended the pure Providers calendar utility in
`src/modules/providers/domain/provider-availability-calendar.ts` and the unit
tests in `tests/unit/providers/provider-availability-calendar.test.ts`.

Implemented pure/synchronous DEC-054 helpers:

- `validateSchedulePeriods`
- `validateDatedExceptions`
- `splitWeeklyPeriod`
- `availabilityIntervalsForCivilDate`
- `intersectHalfOpenIntervals`

Behavior covered: half-open adjacency and overlap rejection after overnight
split, 24-hour overnight periods, zero-length rejection without `endsNextDay`,
closed exceptions truncating weekly/carryover intervals, open exceptions
replacing weekly intervals for that civil date, exception carry-out only when
the next date has no exception, commutative interval intersection, adjacent
intersection emptiness, existing Cairo IANA primitives, and Europe/Berlin
spring-forward/fall-back UTC-to-local primitive behavior.

Fresh T033 verification (no live database, migration, HTTP, repository,
service schedule replacement, pause, capacity, public evaluation, Prisma
format, Git staging, commit, push, merge or deploy work performed):

| Command | Exit | Result |
| --- | --- | --- |
| `npm run test:r1-p10` | 0 | 12 files passed / 5 skipped; 137 tests passed / 33 skipped |
| `npm run typecheck` | 0 | `tsc --noEmit` completed without diagnostics |
| `npx eslint src/modules/providers/domain/provider-availability-calendar.ts tests/unit/providers/provider-availability-calendar.test.ts` | 0 | No findings |
| `git diff --check -- src/modules/providers/domain/provider-availability-calendar.ts tests/unit/providers/provider-availability-calendar.test.ts specs/R1-P10-availability-capacity-textual-coverage/tasks.md specs/R1-P10-availability-capacity-textual-coverage/implementation-evidence.md` | 0 | No output; these touched files are currently untracked, so ordinary Git diff produced no hunks |
| `git diff --no-index --check -- NUL <touched file>` for each touched file | 0 | No whitespace errors; Git emitted only LF-to-CRLF advisory warnings |

## Unresolved issues / decisions carried forward

- Live database proof for T019/T022/T027/T028/T032 and for the migration's
  actual execution against PostgreSQL remains outside this batch's scope; no
  disposable Phase 10 database URL was supplied to either repair pass.
- Coverage percentage against the configured thresholds has not been
  measured in this batch (see "Coverage scope" above).
- No further repair items were identified beyond the "Cursor Batch A final
  repair brief" list; T034 and later remain explicitly out of scope for this
  batch.

## Batch B1 / T038–T044 — Provider temporary pause (Cursor continuation)

Scope: DEC-057 Provider temporary pause only. Codex hit a usage limit; Cursor
implemented T038–T044 without Worker schedules/capacity/public evaluation/
OpenAPI, and without commit/push/migrate/prisma format.

Delivered:

- Pure policy `provider-temporary-pause.policy.ts` (half-open effectiveness,
  interval overlap, runtime unavailable for SUSPENDED/pause, endsAt validation)
- Types/errors/ports; repository pause command scopes
  `availability.pause.start` / `availability.pause.resume`, history
  `pause.started` / `pause.resumed`, unique unresolved conflict mapping
- Service `getPause` / `startPause` / `resumePause` / `evaluateRuntimeBlocker`
- HTTP GET|POST pause and POST pause/resume
- Unit + DB-gated skipIf integration stubs; vitest.r1-p10 registration
- Existing schedule/coverage unit fakes extended for new port methods

Verification commands and counts are recorded after the local quality gate run
in this continuation (see gate table appended when gates complete).

## Batch B2 / T045-T049 - Worker calendar slice

Scope: Worker weekly schedules/exceptions and Provider/Worker calendar
intersection only. No capacity, public evaluation, OpenAPI/Postman generation,
database migration execution, Prisma format, Git staging/commit/push, merge or
deployment work was performed.

Versioning decision: Worker calendars use the existing `ProviderWorker.version`
field as the optimistic concurrency version. Evidence: `ProviderWorker.version`
is present in `prisma/schema.prisma`, while `ProviderAvailabilityConfiguration`
is explicitly Provider-scoped and remains limited to Provider coverage/calendar
aggregate writes. No `worker_availability_configurations` table or migration
was introduced because the data model already planned Worker schedules as
Providers-owned rows scoped to an existing Provider Worker.

Implemented:

- Worker calendar types and DTOs for weekly periods and dated exceptions.
- `ProviderWorkerAvailabilityService` with DEC-058 manager authorization,
  exact Provider/Worker ownership checks, Worker-row version replacement,
  accepted replay before calendar validation, actor-bound UUID idempotency, and
  a pure Provider/Worker civil-date intersection helper.
- Prisma repository methods for Worker calendar read/replace, worker-scoped
  `provider_availability_commands` scope keys, `ProviderWorker.version`
  increments, and `WORKER_SCHEDULE` safe history.
- HTTP `GET|PUT /api/v1/providers/:providerId/availability/workers/:workerId/calendar`.
- Unit, DB-gated HTTP, and DB-gated repository tests registered in
  `vitest.r1-p10.config.ts`.

Fresh B2 verification:

| Command | Exit | Result |
| --- | --- | --- |
| `npm.cmd run test:r1-p10 -- --run tests/unit/providers/worker-availability-calendar.test.ts` | 0 | 1 file passed; 7 tests passed |
| `npm.cmd run test:r1-p10` | 0 | 15 files passed / 12 skipped; 163 tests passed / 58 skipped |
| `npm.cmd run typecheck` | 0 | `tsc --noEmit` completed without diagnostics |
| `npm.cmd run build` | 0 | Prisma Client 7.9.0 generated; `tsc -p tsconfig.build.json` completed |
| `npx eslint <B2 touched files>` | 0 | No findings |
| `git diff --check -- <B2 touched files>` | 0 | No whitespace errors; Git emitted only the existing LF-to-CRLF advisory for `src/composition.ts` |
| `git diff --no-index --check -- NUL <new B2 file>` | 0 | No whitespace errors in the new Worker service/unit/HTTP/repository files |

Skipped/limited evidence:

- DB-gated HTTP/repository Worker suites were registered but skipped in
  `npm.cmd run test:r1-p10` because no approved `CLEANORA_R1_P10_DATABASE_URL`
  proof target was supplied.
- `npm.cmd run lint -- <files>` was attempted but the repository script expands
  to `eslint .`, so it failed on unrelated pre-existing `.agents/skills/*`
  files and `tests/unit/providers/provider-temporary-pause.test.ts`; the true
  scoped `npx eslint <B2 touched files>` gate passed.

## Batch B2 / T050-T056 - complete-Team capacity slice

Scope: Provider capacity rule management and internal complete-Team capacity
evaluation only. No Batch C public operational availability contract,
customer/anonymous evaluation HTTP, OpenAPI/Postman generation, migration
execution, Prisma format, Git staging/commit/push, merge, deployment,
database destruction or other-agent work was performed.

Implemented:

- Pure DEC-055 capacity policy in
  `src/modules/providers/domain/provider-team-capacity.policy.ts`: one active
  complete Team equals one unit, at least one current `cleans=true` member is
  required, every current member must be active and available, Escorts and
  other non-cleaners add zero units but must still be available, incomplete
  Teams do not block complete Teams, unteamed Workers are ignored, and
  available units are capped by `maxSimultaneousTeams`.
- Provider capacity service in `src/modules/providers/provider-capacity.service.ts`
  with DEC-058 manager authorization for protected rule management,
  actor-bound UUID idempotency, replay-before-mutate, optimistic
  `ProviderCapacityRule.version`, `CAPACITY` history events, and read-only
  potential-supply evaluation with suspension/pause zero-capacity blockers.
- Providers-owned Prisma fact gathering in
  `src/modules/providers/infrastructure/prisma-provider-availability.repository.ts`
  for capacity rules, Provider weekly schedule/exceptions, current Team
  memberships, Worker active status, and Worker schedules/exceptions. The only
  cross-module evaluation fact is the transaction-bound Configuration public
  `CountryTimeZoneReader` for the Provider country IANA zone.
- Protected HTTP `GET|PUT /api/v1/providers/:providerId/availability/capacity`
  through existing schemas/controller/routes. GET reads the rule only; PUT
  replaces it. No public evaluation endpoint was added.
- Unit, DB-gated HTTP, DB-gated repository, and DB-gated evaluation tests
  registered in `vitest.r1-p10.config.ts`; the live harness now composes
  `ProviderCapacityService`.

Capacity evaluation algorithm:

- Validate a positive half-open UTC interval.
- Resolve Provider facts, capacity rule, Provider country, and the country IANA
  zone inside one repeatable-read availability transaction.
- If the Provider is suspended or the requested UTC interval overlaps an
  effective unresolved pause, return unavailable capacity facts with
  `availableUnits=0` and no Team counting.
- For each current Team member, enumerate every civil date touched by the UTC
  interval in the country zone; project the requested interval onto that date's
  local-minute segment; reuse
  `intersectProviderWorkerAvailabilityForCivilDate`; require the union of
  Provider/Worker intersections to cover the projected local segment for every
  date.
- Feed those member availability facts into the pure DEC-055 Team policy and
  compute `availableUnits = min(maxSimultaneousTeams,
  completeAvailableTeamCount)`.

Fresh B2 capacity verification:

| Command | Exit | Result |
| --- | --- | --- |
| `npm run typecheck` | 0 | `tsc --noEmit` completed without diagnostics |
| `npm run test:r1-p10` | 0 | 31 files selected; 16 passed / 15 skipped; 170 tests passed / 69 skipped |
| `npm run build` | 0 | Prisma Client 7.9.0 generated; `tsc -p tsconfig.build.json` completed |
| `npx eslint <T050-T056 touched TypeScript files>` | 0 | No findings |
| `git diff --check -- src/composition.ts specs/R1-P10-availability-capacity-textual-coverage/tasks.md specs/R1-P10-availability-capacity-textual-coverage/implementation-evidence.md` | 0 | No whitespace errors; Git emitted only the existing LF-to-CRLF advisory for `src/composition.ts` |

Skipped/limited evidence:

- DB-gated capacity HTTP/repository/evaluation suites were registered but
  skipped in `npm run test:r1-p10` because no approved
  `CLEANORA_R1_P10_DATABASE_URL` proof target was supplied.
- Phase 10 coverage, OpenAPI/Postman parity, migration execution evidence,
  final review, and phase completion remain later tasks; T057+ Batch C remains
  unchecked and out of scope for this slice.

### Batch C public/readiness (T057–T065) — continuation repair 2026-09-08

Codex write `01a08247-c17d-78e2-a1c9-0da656f608a9` landed most of the public reader/readiness wiring then hit usage limit. Cursor repaired typecheck failures (worker `version` select, exactOptionalPropertyTypes districtId, inline capacity evaluation without nested CapacityService auth deps, public test coverageMatch shape) and added T065 no-customer/anonymous evaluation route assertion.

Independent gates after repair: `npx tsc --noEmit` exit 0; `npm run test:r1-p10` 176 passed / 70 skipped. No live DB proof. No commit/push.

## Final closeout — T066–T077 (2026-09-08 continuation)

**Branch**: `codex/r1-p10-availability-capacity-textual-coverage` @ `47fdf535f0fa73642fdd3d2d4356fd223afd74c0`
**Local gate logs**: `C:/Users/ALYOSER/AppData/Local/Temp/cleanora-r1-p10-continuation-20260908-140657/final-gates/`
**Status**: Implementation + docs complete for T001–T072; **technical readiness blocked** on SC-006 (coverage thresholds) and SC-008 (live migration). No commit/push. No disposable `CLEANORA_R1_P10_DATABASE_URL`.

### Closeout supersession — 2026-09-09

**Status**: Technical readiness **PASS**. Disposable `CLEANORA_R1_P10_DATABASE_URL` → `cleanora_r1_p10_proof`. No commit/push yet (awaits exact `commit and push`).

| Gate | Result |
|---|---|
| `npm run test:coverage:r1-p10` | **43 files / 301 tests passed**; statements **86.85%**, branches **76.47%**, functions **93.38%**, lines **87.60%** (exit 0) |
| `npm run db:validate-clean-migration` | exit 0 |
| `npm run db:validate-r1-p10-upgrade` | exit 0 (`upgrade-migration-attempt4.log`) |
| typecheck / docs:check / openapi:validate / phase-scoped eslint | exit 0 |
| Whole-tree lint | exit 1 — unrelated `.agents` noise |

See `migration-evidence.md`, `implementation-review-report.md` (verdict PASS), and `implementation-summary.md` for the authoritative closeout record. Historical T073–T074 numbers above remain as the pre-DB blocked snapshot.
### Docs slice repair after T066–T072

1. Corrected Staff privileged `reasonCode` examples from `configuration_locality_write` to catalogued `configuration_locality_change` in OpenAPI YAML and Postman generator; regenerated collection; added parity assertions.
2. Added `tests/unit/modules/providers/provider-readiness.policy.test.ts` to the Phase 10 Vitest include and `provider-readiness.policy.ts` to coverage include (DEC-060 gate selection).
3. Fixed `prefer-const` in `tests/unit/providers/provider-temporary-pause.test.ts`.

### T073 — Prisma / typecheck / lint / build / OpenAPI / Postman / docs / diff

| Gate | Command | Exit | Result |
|---|---|---|---|
| Prisma validate | `npx prisma validate` | 0 | Schema valid |
| Typecheck | `npm run typecheck` | 0 | `tsc --noEmit` clean |
| Build | `npm run build` | 0 | Prisma Client 7.9.0 + `tsc -p tsconfig.build.json` |
| Docs check | `npm run docs:check` | 0 | `{"ok":true,"checked":14}` |
| OpenAPI validate | `npm run openapi:validate` | 0 | Includes `r1-p10-availability-capacity-textual-coverage.yaml` + runtime document |
| Postman generate | `npm run postman:generate:r1-p10` | 0 | Collection rewritten with `configuration_locality_change` |
| Postman validate | `npm run postman:validate` | 0 | Legacy P00–P07 validator still green; Phase 10 parity is unit-tested separately |
| Phase-scoped ESLint | `npx eslint` on touched P10 docs/test files after prefer-const fix | 0 | No findings |
| Whole-tree `npm run lint` | `npm run lint` | 1 | **FAIL** — 153 pre-existing errors dominated by unrelated `.agents/skills/*/scripts/relay.mjs` (URL/setTimeout/no-undef) plus other non-P10 noise; not introduced by this phase closeout |
| Diff whitespace | prior batch evidence + continuation edits | 0 | No new whitespace blockers recorded for P10 paths |

### T074 — Phase tests and coverage (four metrics)

```text
> npm run test:r1-p10
Test Files  22 passed | 16 skipped (38)
Tests       199 passed | 70 skipped (269)
exit 0
```

```text
> npm run test:coverage:r1-p10
Test Files  22 passed | 16 skipped (38)
Tests       199 passed | 70 skipped (269)
Statements   : 44.49% ( 961/2160 )
Branches     : 39.78% ( 637/1601 )
Functions    : 43.8%  ( 205/468 )
Lines        : 44.41% ( 926/2085 )
exit 1 — all four thresholds fail (need 80/75/80/80)
```

Selection: 38 include entries in `vitest.r1-p10.config.ts` (includes readiness policy unit tests). The 70 skips are DB-gated integration/HTTP suites that require an approved disposable `CLEANORA_R1_P10_DATABASE_URL`. Without those suites, repository/controller/route/composition surfaces remain largely uncovered and SC-006 cannot pass.

Coverage summary JSON retained at local `final-gates/phase-coverage-summary.json`.

### T075–T077 cross-reference

- Live clean/upgrade migration evidence: see `migration-evidence.md` (**PASS** — 2026-09-09 disposable proofs).
- Adversarial review: see `implementation-review-report.md` (**PASS**).
- Spec/task reconciliation: see `implementation-summary.md` (technical readiness PASS; not committed).

## Final adversarial repair and revalidation — 2026-09-09

Codex independently reviewed the entire uncommitted Phase 10 slice and resolved
seven actionable issues: recognized-IANA enforcement, district-to-city coverage
promotion, stale cross-country coverage matching, DST repeated-time interval
collapse, expired-pause restart conflict, non-monotonic workforce version facts,
and unmapped concurrent locality constraints. Detailed root causes and
regressions are recorded in `review-resolution.md`.

Fresh final evidence:

| Gate | Exit | Result |
|---|---:|---|
| Focused repaired regressions | 0 | 8 files / 77 tests, plus repository mapper suite 1 file / 6 tests |
| `npm run test:coverage:r1-p10` | 0 | 43 files / 301 tests; 86.85% statements, 76.47% branches, 93.38% functions, 87.60% lines |
| `npm run db:validate-clean-migration` | 0 | 17 migrations, exact 93 tables, double seed and live historical probes |
| `npm run db:validate-r1-p10-upgrade` | 0 | Populated Phase 9 baseline preserved; seed/policy/idempotent redeploy/live constraints verified |
| Typecheck and Phase 10-scoped ESLint | 0 | No diagnostics/findings |
| Independent module-boundary review | 0 | PASS; no ownership or dependency violation |

The database commands used only the explicitly approved disposable
`cleanora_r1_p10_proof` target through `CLEANORA_R1_P10_DATABASE_URL`; neither
`.env` nor any historical/production database was used. Full historical suites
remain outside the owner-approved Phase 10 validation scope. No staging, commit,
push, merge, deployment or production migration was performed.

Read-only dependency audit: `npm audit --json` reported 3 high and 6 moderate
advisories in versions already present at `HEAD`; Phase 10's added
`@js-temporal/polyfill` package was not named. No dependency upgrade was folded
into this phase-scoped repair.

## Owner completion — 2026-09-09

After the PASS handoff, the owner explicitly approved
`R1-P10 — Availability, Capacity & Textual Coverage as Complete`. DEC-061 and
`completion-report.md` record the phase transition. Companion's canonical
terminal writer records `currentStep=implement`, `status=completed`, and
`currentTask=T077`. No next phase or Git/deployment/production-migration action
was authorized by completion.

