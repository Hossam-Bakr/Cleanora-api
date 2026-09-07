# Implementation Quickstart: R1-P09

**Status**: Future implementation guide only. Following this document requires
separate human authorization; planning did not execute any step below.

## 1. Re-establish the guardrails

Before editing implementation files:

1. Confirm the current phase pointer still names R1-P09 and no later phase is
   active.
2. Confirm the chosen feature branch/base with the human; do not create or
   switch a branch implicitly.
3. Inspect `git status` and preserve all unrelated human changes.
4. Read `AGENTS.md`, `docs/ai/context-router.md`, this feature's `spec.md`,
   `plan.md`, `tasks.md`, DEC-047–DEC-051, and only the canonical rules routed
   for this phase.
5. Confirm database tests will use an explicitly approved disposable target;
   never infer authority from an environment variable alone.

## 2. Work in dependency and TDD order

Execute the unchecked tasks in `tasks.md`; do not jump directly to controllers.
The intended slices are:

```text
test/evidence scaffold
  -> public-contract and authorization tests
  -> Prisma/migration constraint tests
  -> Provider-service domain + repository foundation
  -> US1 create/list/detail/configuration
  -> US2 price proposal + lifecycle + histories
  -> US3 Staff approval/rejection
  -> US4 dynamic readiness + internal snapshot reader
  -> OpenAPI/Postman/docs + phase/full gates
```

For each behavior: add the focused failing test, implement only the required
Providers-owned behavior/public seam, run the focused test, and record evidence.

## 3. Preserve module ownership

- Add Provider-service behavior only under `src/modules/providers/`.
- Import Catalog only from `src/modules/catalog/catalog.public.ts`.
- Import Configuration only from
  `src/modules/configuration/configuration.public.ts`.
- Import Authentication only from
  `src/modules/authentication/authentication.public.ts`.
- Import Admin audit only from `src/modules/admin/audit.public.ts`.
- Put workflow order in services, persistence in Providers repositories/UoW,
  and HTTP translation in thin controllers/routes.
- Do not add a Pricing, Offerings, ProviderServices, Browse, Booking, workflow,
  approval, event, queue, worker, or cache module.

## 4. Implement data integrity locally

Create only:

```text
provider_services
provider_service_prices
provider_service_price_history
provider_service_status_history
```

Use exactly one new migration:
`r1_p09_provider_services_pricing_historical_snapshots`.

Do not edit an applied migration or seed Provider offerings/prices. Review the
generated SQL line by line against `migration-plan.md` before any approved
database execution. Money stays as boundary strings and exact whole minor units
in Prisma Decimal/PostgreSQL `numeric(65,0)` internally.

## 5. Implement the command safety order

```text
trusted authentication
  -> exact Provider/Staff authorization
  -> strict request + canonical fingerprint
  -> serializable Providers transaction
       -> transaction-bound public readers/authorizers/audit
       -> transactional authority + prior receipt replay/conflict
       -> Catalog/Configuration current validation
       -> expected-version recheck
       -> current state + retained price transition
       -> append-only history/receipt
       -> Admin public audit
  -> safe DTO/error mapping
```

Create uses expected version 0 and produces a disabled version-1 offering.
Every later accepted command increments the one aggregate version exactly once.

## 6. Verify the phase boundary

The final evidence must prove:

- exact OWNER/ADMIN and Staff authority with cross-Provider denial;
- current Catalog/config revalidation and no direct foreign-module persistence
  access;
- decimal, duration, note, maximum, unit, and client-total behavior;
- one effective/one pending maximum, retained immutable commercial rows, and
  append-only histories;
- version, two-writer, late replay, and atomic-audit behavior;
- dynamic `servicesReady` with only approved blocker codes and
  `eligibleForPublicBrowse=false`;
- a consistent internal result from one Providers-owned repeatable-read
  snapshot with transaction-bound Catalog/Configuration readers and no Booking
  persistence;
- clean-install and populated R1-P08 upgrade evidence;
- route/OpenAPI/Postman parity, phase coverage, and full repository gates.

Do not mark implementation complete, commit, push, merge, deploy, run a
production migration, or activate R1-P10 without the exact later human
authorization required by the repository workflow.

## 7. Future validation run

After all implementation tasks are complete—and only on an authorized local
environment—run the exact ordered commands in `test-strategy.md`. The first
focused checkpoint is:

```text
npm run test:r1-p09
npm run test:coverage:r1-p09
```

Expected outcome: zero failed R1-P09 tests and coverage at or above 80%
statements, 75% branches, 80% functions, and 80% lines for the phase include
set. Database validation then requires an explicitly approved disposable URL:

```text
npm run prisma:validate
npm run db:validate-clean-migration
npm run db:validate-r1-p09-upgrade
```

Expected outcome: one successful chronological R1-P09 migration, unchanged
populated R1-P08 digests, exactly four empty post-upgrade phase tables before
fixtures, passing live constraints/immutability/decimal probes, and a no-op
second deploy. Finally run the OpenAPI/Postman/docs and full repository commands
listed in `test-strategy.md`; expected outcome is deterministic generated
artifacts, exact 11-operation parity, zero forbidden surface, and no regression.
