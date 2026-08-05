# R1-P02B — Tasks

## Phase 1: Baseline and safety

- [x] T001 Record the current method/path inventory and middleware order in `specs/R1-P02B-backend-readability-simplification/baseline.md`.
- [x] T002 Remove obsolete automation-only assertions per the 2026-08-03 owner decision, then run and record baseline Prisma validation, typecheck, lint, unit, integration, OpenAPI, docs, build, startup smoke, and `git diff --check` in `specs/R1-P02B-backend-readability-simplification/baseline.md`.
- [x] T003 Confirm `prisma/schema.prisma`, `prisma/migrations/`, authentication public contracts, and response envelopes are frozen in `specs/R1-P02B-backend-readability-simplification/baseline.md`.

## Phase 2: Startup readability (US1)

- [x] T004 [US1] Add focused runtime dependency composition in `src/composition.ts` using only existing adapters and module factories.
- [x] T005 [US1] Refactor `src/server.ts` into the visible environment → composition → database → app/routes → listen → shutdown sequence while preserving all test overrides.
- [x] T006 [P] [US1] Move only pure listen/shutdown helpers to `src/server-lifecycle.ts` if required by the approved size/readability target.
- [x] T007 [US1] Update focused startup, listen, failure, signal, timeout, and shutdown tests under `tests/unit/server/`.

## Phase 3: App and route readability (US2)

- [x] T008 [US2] Refactor `src/app.ts` to own the frozen global middleware order and invoke an injected explicit route-mount callback before terminal handlers.
- [x] T009 [US2] Move readiness-only rate-limit registration into `src/routes/system.routes.ts` without changing its path, subject, limit, window, or error behavior.
- [x] T010 [US2] Reduce `src/routes/index.ts` to direct docs, system, and authentication route-group registrations with the same prefixes.
- [x] T011 [P] [US2] Update route-map, middleware-order, system rate-limit, and focused integration tests in `tests/unit/` and `tests/integration/`.

## Phase 4: Contract preservation (US3)

- [x] T012 [US3] Run the complete authentication unit and integration suites and fix only refactor-induced wiring regressions.
- [x] T013 [US3] Compare the final method/path inventory with T001 and prove zero contract changes in `specs/R1-P02B-backend-readability-simplification/implementation-summary.md`.
- [x] T014 [P] [US3] Update `docs/architecture/modular-monolith.md`, `docs/architecture/source-layout.md`, and relevant navigation docs to show the final startup/route path.
- [x] T015 [US3] Prove `prisma/schema.prisma`, applied migrations, seeds, dependency versions, and public authentication contracts were not changed; document the owner-authorized automation-only package-script removal.

## Phase 5: Final validation and handoff

- [x] T016 Run Prisma validation, typecheck, lint, unit, integration, OpenAPI, docs, build, startup smoke, boundary checks, and `git diff --check`.
- [x] T017 Complete `specs/R1-P02B-backend-readability-simplification/checklists/requirements.md` with evidence for every item.
- [x] T018 Write `specs/R1-P02B-backend-readability-simplification/implementation-summary.md` covering structure, unchanged contracts, evidence, and remaining risks.
- [x] T019 Obtain independent review against the complete diff and resolve every BLOCKER/MAJOR finding before human completion approval.

## Phase 6: Junior-readable refinement

- [x] T020 [US1] Remove `StartApplicationDependencies`, production factory fallbacks, conditional override construction, and the route-mount callback from `src/server.ts`.
- [x] T021 [US1] Make `src/server.ts` show direct environment, composition, database, app, listener, and signal steps with short explanatory comments.
- [x] T022 [US2] Simplify `createRuntimeDependencies` and `createApp` to concrete direct production calls while retaining focused test-only app options outside `server.ts`.
- [x] T023 [P] Replace factory-injection startup tests with lifecycle behavior tests and a source-order/readability guard that rejects the removed complexity patterns.
- [x] T024 Rerun route comparison, frozen-contract checks, unit, integration, Prisma, typecheck, lint, OpenAPI, docs, build, startup smoke, boundary, and whitespace gates; update the implementation summary.

## Dependencies

- T001–T003 blocked implementation until the baseline and frozen-surface proof
  were recorded. All three are complete. The owner then requested the Phase 6
  junior-readable refinement; no phase-completion claim is permitted until
  T024, independent review, and human approval are complete.
- T004 blocks T005; T005 and T008 must be coordinated around the route-mount contract.
- T009 blocks T010; T008–T010 block T011–T015.
- T012–T015 block final validation and review.

## Independent test criteria

- **US1**: `server.ts` exposes the approved startup sequence and all lifecycle tests pass.
- **US2**: `routes/index.ts` visibly lists route groups and readiness limiting remains endpoint-specific.
- **US3**: Baseline/final contracts match and all existing behavior suites pass.
