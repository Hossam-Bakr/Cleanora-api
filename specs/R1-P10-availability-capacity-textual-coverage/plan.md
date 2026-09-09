# Implementation Plan: R1-P10 — Availability, Capacity & Textual Coverage

**Branch**: `codex/r1-p10-availability-capacity-textual-coverage` | **Date**: 2026-09-07 | **Spec**: [spec.md](spec.md)

## Summary

Add Configuration-owned localized cities/districts and country IANA time zones, then add Providers-owned textual coverage, Provider/Worker schedules and exceptions, complete-Team capacity, temporary pause and read-only operational evaluation. Protected Staff and Provider HTTP surfaces manage configuration; later phases consume narrow public module contracts. The migration is additive and named `r1_p10_availability_capacity_textual_coverage`.

## Technical Context

**Language/Version**: TypeScript 6 on Node.js 24.16

**Primary Dependencies**: Express 5, Zod 4, Prisma 7/PostgreSQL, `@js-temporal/polyfill` for deterministic IANA/DST arithmetic

**Storage**: Existing PostgreSQL schema plus one forward Phase 10 migration; existing Configuration and Providers command/audit structures are reused where ownership fits

**Testing**: Vitest 4 with `vitest.r1-p10.config.ts`; unit, HTTP, repository, migration, authorization, concurrency and documentation parity tests selected only for Phase 10

**Target Platform**: Existing modular-monolith backend

**Performance Goals**: Candidate-by-area and single-Provider evaluation use indexed bounded queries; no unbounded schedule expansion or per-minute iteration

**Constraints**: DEC-053–DEC-060; half-open intervals; maximum 24-hour recurring period; one country zone; complete-Team units; no reservations, Booking, Eligibility/Browse HTTP, coordinates, Docker or cloud

**Scale/Scope**: MVP textual hierarchy and Provider operations; full replacement writes are bounded to 7 weekdays, 366 dated exceptions per submitted resource, and 1–50 Team capacity units

## Constitution Check

Pre-design and post-design verdict: PASS.

- Standalone: all code, contracts, schema, migration and evidence stay repository-local.
- Traceability: FR-001–FR-016 and SC-001–SC-008 map into tasks and evidence.
- Ownership: Configuration owns cities, districts and country time-zone resolution. Providers owns coverage, schedules, exceptions, capacity, pause, readiness and evaluation.
- Dependency direction: Providers may call `configuration.public.ts` and Authentication public authorization services; no private repository import crosses a module boundary.
- Migration: one additive, phase-owned forward migration; existing migrations remain immutable. Existing global time-zone data is preserved while Egypt receives a country value.
- Security/integrity: deny-by-default authorization, exact Provider scope, versioned/idempotent mutations, safe audit, database constraints and serializable writes.
- Testing: Phase 10 selection and real coverage include all new production files and changed integration seams. Full historical suites remain explicitly skipped under the owner's instruction.
- Human controls: decisions are DEC-053–DEC-060. No commit, push, merge, deployment or production migration is authorized.
- Locked boundaries: no stored-value wallet, Docker/cloud, maps/radius or later-phase behavior.
- Complexity: the Temporal polyfill is justified because local Node lacks `Temporal`; custom IANA/DST conversion would be riskier.

## Architecture and Ownership

### Configuration

Configuration owns `City`, `District`, locality Staff application services/routes/repository and `CountryTimeZoneReader`. `platform.default_timezone` changes from `GLOBAL_ONLY` to `COUNTRY_REQUIRED`; seed and migration establish `Africa/Cairo` for Egypt. HTTP schemas, the config-key catalog, the service and public reader validate recognition against the runtime IANA database, and the reader can bind to an opaque transaction.

Staff operations use new catalog-driven permissions `configuration.localities.read` and `configuration.localities.write`; writes require an approved `CONFIGURATION_LOCALITY_WRITE` reason, optimistic versions and audit. Localities are deactivated, never deleted through HTTP. Every write (city/district create/update, country time-zone PUT) reserves, mutates, audits and completes a UUID-idempotent `ConfigurationLocalityCommand` receipt inside the same Serializable transaction: a fingerprint over the full semantic payload binds the caller-supplied key to an exact input, so a reused key with different content raises a stable conflict instead of matching on natural-key content or version arithmetic (repair item 5).

### Providers

Providers owns coverage, schedules/exceptions, capacity, pause, readiness and evaluation. A single `ProviderAvailabilityConfiguration` version coordinates full-replacement Provider coverage/schedule/capacity writes; Worker schedule replacement validates the Worker version and increments the Provider aggregate `workforceStateVersion` used by public evaluation. Mutations execute at Serializable isolation with request fingerprint/idempotency receipt and safe audit/history. Reads/evaluation use RepeatableRead. Coverage-replace authorization uses a dedicated Phase 10 policy (`decideProviderAvailabilityManagementAuthorization`, DEC-058), not R1-P09's Provider Service policy: an active, exact-scope Owner is trusted **without** an enabled `provider_admin` capability, while an active, exact-scope Admin still requires it; every other membership level, an inactive identity/membership, or a wrong-Provider scope is denied the same non-enumerating way, and an unapproved Provider is denied as a state-invalid target. Every trusted fact (identity/capability, membership level, Provider approval, Provider profile country) comes only from Authentication's public contract and Providers' own Provider/Profile/Member rows inside the same transaction — never hardcoded (repair item 2) — and every coverage selection must match the Provider's own country exactly, rejecting when the Provider has none (repair item 3). Configuration's locality facts used for that country check are read through `createTransactionalLocalityReader`, bound to the exact same interactive transaction as the coverage mutation and supplied only via the per-unit-of-work `{ repository, localityReader }` context — never a separately opened, full-client reader (final repair item 2). The command fingerprint covers every semantically relevant input, including expected version and reason, so a reused idempotency key with different input is a stable conflict; the receipt row's `actorUserId` is also compared on every replay decision, so a different actor presenting the same key is the same stable conflict, never a replay of another actor's result (repair item 4, extended by final repair item 4). An in-progress/incomplete receipt never replays as a success, and reservation itself uses a transaction-safe `createMany({ skipDuplicates: true })` write (not a `create` + catch-`P2002` + `findUnique`, which is unsafe on PostgreSQL because a unique violation aborts the whole interactive transaction) (final repair item 3).

Provider evaluation resolves the Provider country and zone through Configuration's public transaction-bound reader. It rejects invalid input, then evaluates active ancestry, one-way city/district coverage, Provider interval, pause/suspension, complete Team schedules and configured limit. UTC intervals are split at civil midnights and IANA offset transitions so DST gaps and repeated wall-clock times cannot collapse or reverse a positive interval. It returns facts and stable blockers; it never reserves resources.

### Public contracts

`configuration.public.ts` exposes locality/time-zone identity only. `providers.public.ts` exposes `ProviderOperationalAvailabilityReader` with candidate lookup and one-Provider evaluation. No raw Prisma, HTTP type, private contact or mutable collection crosses these seams.

## Persistence Design

See [data-model.md](data-model.md). Add `cities`, `districts`, `configuration_locality_commands`, `provider_availability_configurations`, `provider_coverage_areas`, `provider_schedules`, `provider_schedule_exceptions`, `worker_schedules`, `worker_schedule_exceptions`, `provider_capacity_rules`, `provider_temporary_pauses`, `provider_availability_commands`, and `provider_availability_history`. All Phase 10 locality, configuration, Worker-schedule and pause commands use a UUID-idempotent command receipt (Configuration's own for localities, Providers' own for availability); current Worker/Team versions remain trusted concurrency inputs.

SQL constraints enforce locality ancestry FKs, city-or-district XOR coverage, valid weekdays/minutes, positive interval duration with explicit overnight flag, no duplicate weekly period, no duplicate dated exception period, at most one holiday row per date, capacity 1–50, pause end after start and one unresolved current pause per Provider. Application validation gives stable errors before constraints; concurrent locality unique/FK violations are mapped to stable domain errors. A bounded pause expires by time evaluation without a write; when a later pause needs the unique unresolved slot, the repository atomically materializes the expired row's `resumedAt=endsAt` before creating the new pause. The migration backfills every active Country's `platform.default_timezone` before switching its resolution policy to `COUNTRY_REQUIRED`, so a populated upgrade never loses a resolvable value; the backfilled row's id is a deterministic, PostgreSQL-core `md5`-based text expression, not `gen_random_uuid()`, so the migration never depends on an undeclared extension (final repair item 5).

Both command receipt tables (`configuration_locality_commands`, `provider_availability_commands`) reserve a row via a transaction-safe `createMany({ skipDuplicates: true })` write, not `create` + catch-unique-violation + `findUnique` (unsafe on PostgreSQL, since a unique violation aborts the whole interactive transaction); every replay decision compares both the stored request fingerprint and the stored `actorUserId` against the incoming command, so a different actor presenting the same `(scopeKey, idempotencyKey)` is the same stable conflict as a changed payload, never a replay of another actor's safe result (final repair items 3 and 4).

## HTTP and Documentation

Staff endpoints manage/list cities and districts and set a country's time zone. Provider endpoints read/replace coverage, Provider schedules/exceptions, Worker schedules/exceptions and capacity, plus start/resume/read pause. All writes require UUID idempotency key and expected version. Swagger source, runtime fragments and generated Phase 10 Postman collection share the same examples and error schemas.

## Quality Gates

Before running Phase 10 tests, list the resolved Vitest files and inspect them. Then run `npm run test:r1-p10` and `npm run test:coverage:r1-p10`. Coverage must include every Phase 10 production file plus changed Configuration/Authentication/Providers public seams, readiness policy, composition, routes and Swagger fragments, with minimum statements 80%, branches 75%, functions 80%, lines 80%.

Non-test gates: Prisma format/validate/generate, migration SQL review, TypeScript, ESLint, build, OpenAPI, Postman generation/validation, docs, module boundaries and `git diff --check`. Database gates use only an explicit phase-named disposable PostgreSQL target for clean chronological installation and populated R1-P09 upgrade. The repository `.env`, unknown databases and production are never used.

## Project Structure

```text
prisma/schema.prisma
prisma/migrations/r1_p10_availability_capacity_textual_coverage/migration.sql
src/modules/configuration/{configuration.public.ts,locality.*.ts,infrastructure/*}
src/modules/providers/{provider-availability*.ts,providers.public.ts,infrastructure/*}
src/modules/authentication/{authentication.public.ts,domain/authorization.*}
src/swagger/r1-p10-openapi.paths.ts
src/{composition.ts,routes/index.ts}
tests/{unit,integration}/...r1-p10...
vitest.r1-p10.config.ts
docs/apis/openapi/r1-p10-availability-capacity-textual-coverage.yaml
postman/Cleanora-R1-P10-Availability-Capacity-Textual-Coverage.postman_collection.json
```

**Structure Decision**: extend existing compact Configuration and Providers modules. No new business module or generic scheduling framework is introduced.

## Complexity Tracking

| Choice | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| `@js-temporal/polyfill` | Correct IANA/DST interval arithmetic on Node 24.16 | Local Node has no global Temporal; hand-written offset logic risks gaps/repeated-time errors |
| Separate Provider availability command/history tables | Provider-wide configuration and pause replay/audit are distinct from workforce membership commands | Reusing unrelated command results would blur ownership and couple schemas |
