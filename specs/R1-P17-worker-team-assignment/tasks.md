# Tasks: R1-P17 — Worker & Team Assignment

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md)
**Status**: Complete — DEC-099 (owner `mark complete`)

## Phase 1 — Foundation (blocking)

- [x] T001 Add Prisma enums/models from data-model.md to `prisma/schema.prisma` without editing applied migrations — FR-001, FR-002
- [x] T002 Create `prisma/migrations/r1_p17_worker_team_assignment/` SQL + `migration-review.md` (partial unique ACTIVE per booking) — FR-015, SC-007
- [x] T003 Seed status_transition_rules for ACCEPTED→ASSIGNED and ASSIGNED→CANCELLED rows — FR-002
- [x] T004 Add `vitest.r1-p17.config.ts` and `test:r1-p17` / `test:coverage:r1-p17` scripts (80/75/80/80) — SC-005
- [x] T005 Extend `bookings.public.ts` and `bookings.matrix.ts` with ASSIGNED + assignment types — FR-001, FR-002
- [x] T006 Extend Providers public reader(s) for worker facts-by-ids + calendar coverage; compose in `composition.ts` — FR-016

## Phase 2 — Domain policy

- [x] T007 Implement assignment policy: composition, escort/cleans, crew preference, requiredTeamUnits — FR-006, FR-007, SC-002
- [x] T008 Implement overlap conflict helper against ACTIVE assignments — FR-008, SC-002
- [x] T009 Unit tests for policy + overlap — SC-002

## Phase 3 — Assign team / workers (US1–US4, US8)

- [x] T010 Implement idempotent assign-team (EX-01 booking.teamId) ACCEPTED→ASSIGNED — FR-003, FR-004, FR-012
- [x] T011 Implement idempotent assign-workers — FR-005, FR-012
- [x] T012 Persist members + history CREATED + BOOKING_ASSIGNED intents — FR-009, FR-013
- [x] T013 HTTP routes/controllers/Zod for assign-team and assign-workers — FR-014
- [x] T014 Tests: authz selected provider only; crew/escort/schedule/overlap rejects; idempotency — SC-001, SC-002, US8

## Phase 4 — Replace + cancel-from-ASSIGNED (US5)

- [x] T015 Implement replace-team and replace-workers (supersede + history) — FR-009, SC-003
- [x] T016 HTTP for replace endpoints — FR-014
- [x] T017 Extend P16 cancel paths to allow ASSIGNED→CANCELLED without fees — FR-017
- [x] T018 Tests: replace history; deny cancel/assign illegal states — US5, SC-003

## Phase 5 — Reads + worker visibility (US6–US7)

- [x] T019 GET current assignment + history (provider); include summary on dossiers — FR-010, FR-011
- [x] T020 GET `/api/v1/workers/me/assignments` — FR-010, SC-004
- [x] T021 Tests: worker isolation; dossier includes assignment — US6, US7, SC-004

## Phase 6 — Composition, docs, gates

- [x] T022 Wire composition: readers, clock, route mounts; notification templates — FR-013, FR-016
- [x] T023 OpenAPI `docs/apis/openapi/r1-p17-worker-team-assignment.yaml` + Postman — FR-014, SC-006
- [x] T024 Module-boundary tests: no providers/payments Prisma from bookings assign paths — FR-016, FR-017, SC-009
- [x] T025 Migration evidence on disposable `CLEANORA_R1_P17_DATABASE_URL` — SC-007 (live clean + upgrade PASS — see migration-evidence.md)
- [x] T026 Implementation summary + gate log — implementation-summary.md
- [x] T027 Codex prep-accept then final review via `/codex-delegate`; repair BLOCKER/MAJOR — SC-008 (call 2 ACCEPT; call 4 PASS)
- [x] T028 Record READY_FOR_OWNER_REVIEW (no mark-complete, no git publish)

## Traceability

| AC / FR | Tasks |
|---|---|
| US1 / FR-004 | T010, T012–T014 |
| US2 / FR-005 | T011–T014 |
| US3 / FR-007 | T007, T009, T014 |
| US4 / FR-008 | T008, T009, T014 |
| US5 / FR-009 | T015–T018 |
| US6 / FR-010 | T020, T021 |
| US7 / FR-011 | T019, T021 |
| US8 / FR-012 | T010, T011, T014 |
| US9 / FR-013 | T012, T015, T022 |
| FR-001 / FR-002 / FR-015 | T001–T005, T025 |
| FR-003 / SC-001 | T010, T014 |
| FR-006 | T007, T009 |
| FR-014 / SC-006 | T013, T016, T023 |
| FR-016 / FR-017 / SC-009 | T006, T024 |
| SC-005 | T004 |
| Closeout | T026–T028 |
