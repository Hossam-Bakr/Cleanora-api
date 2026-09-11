# Tasks: R1-P13 — Booking Draft, Pricing Snapshot & Status Machine

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md)
**Status**: **READY_FOR_OWNER_REVIEW** (fresh Codex re-review PASS; DEC-092 retained as historical context); not Complete

## Phase 1 — Foundation (blocking)

- [x] T001 Add Prisma enums/models from data-model.md to `prisma/schema.prisma` without editing applied migrations — FR-018
- [x] T002 Add `MediaOwnerType.BOOKING_ATTACHMENT` and Media public attach/list/sign helpers — FR-003, FR-014
- [x] T003 Add Configuration public deposit-percent reader + Egypt seed 25 `commercial.deposit_percent` — FR-015
- [x] T004 Add Customers public owned-address snapshot reader — FR-003, FR-014
- [x] T005 Create `prisma/migrations/r1_p13_booking_draft_pricing_snapshot_status_machine/` SQL, review in `migration-review.md` — FR-018
- [x] T006 Seed `status_transition_rules` executable + documented rows — FR-007, FR-008, FR-009
- [x] T007 Add `vitest.r1-p13.config.ts` and `test:r1-p13` / `test:coverage:r1-p13` scripts — SC-008
- [x] T008 Extend Bookings errors/schemas for booking commands (Zod, no client totals) — FR-013

## Phase 2 — Domain (US1–US3)

- [x] T009 Implement decimal-safe quote/deposit policy reusing P09 minor-unit helpers — FR-004, SC-003
- [x] T010 Implement matrix enforcement service (executable vs EX-01) — FR-007, FR-008, US3
- [x] T011 Implement Bookings unit of work / repository for booking aggregates (no snapshot updates) — FR-005, FR-018
- [x] T012 Implement idempotent command store `(customerUserId, type, key)` — FR-011
- [x] T013 Implement create-draft application service: verified customer, explicit eligibility, address copy, first quote — FR-001–FR-003, US1
- [x] T014 Unit tests: quote math, missing deposit config fail-closed — SC-003
- [x] T015 Unit tests: illegal transitions unchanged — SC-005

## Phase 3 — HTTP create/list/get (US1, US5)

- [x] T016 `POST /api/v1/bookings` with required auth + Idempotency-Key — FR-001, FR-011, US1
- [x] T017 `GET /api/v1/bookings` and `GET /:id` self-only non-enumerating — FR-012, US5
- [x] T018 Wire router in composition + `routes/index.ts` — FR-001
- [x] T019 Integration: guest/unverified rejected; no row — SC-001
- [x] T020 Integration: ineligible team rejected — SC-002
- [x] T021 Integration: idempotent replay same id — FR-011

## Phase 4 — Draft mutate, media, submit (US2, US5)

- [x] T022 PATCH draft answers/notes/address only — FR-003, FR-006
- [x] T023 POST media attach (max 5 images, draft only) — FR-003, US5
- [x] T024 Submit-for-deposit re-eval + required answers + freeze snapshot/breakdown — FR-002, FR-005, FR-006, US2
- [x] T025 Integration: live price change does not rewrite snapshot — SC-004
- [x] T026 Integration: missing required answer stays DRAFT — US2

## Phase 5 — Cancel and matrix HTTP behavior (US3, US4)

- [x] T027 Cancel from DRAFT and AWAITING_DEPOSIT with closed reasons, history, no fee fields — FR-010, US4, SC-006
- [x] T028 Reject CONFIRMED and other EX-01 transitions — FR-008, SC-005
- [x] T029 Stale version conflict — FR-006, SC-005
- [x] T030 Rate-limit create/submit — security checklist

## Phase 6 — Browse hint and artifacts

- [x] T031 Update Browse `bookingPrerequisites` for verified customers; Browse still creates no booking — FR-016
- [x] T032 OpenAPI `docs/apis/openapi/r1-p13-booking-draft.yaml` + swagger merge + `docs:check` list — FR-017, SC-007
- [x] T033 Postman collection + generate/validate scripts — FR-017, SC-007
- [x] T034 Module-boundary review artifact — SC-009, FR-014
- [x] T035 Migration evidence (clean + upgrade) or BLOCKED with exact missing URL — SC-010 — Evidence: final-byte live PASS 2026-09-11 on disposable `cleanora_r1_p13_proof` via `CLEANORA_R1_P13_DATABASE_URL`; `migration-evidence.md`
- [x] T036 Implementation summary + gate log
- [x] T037 Codex final review via `/codex-delegate`; repair BLOCKER/MAJOR
- [x] T038 Record READY_FOR_OWNER_REVIEW (no mark-complete, no git publish)

## Traceability

| AC / FR | Tasks |
|---|---|
| US1 / FR-001–003 / SC-001–002 | T013, T016–T021 |
| US2 / FR-004–006 / SC-003–004 | T009, T024–T026 |
| US3 / FR-007–009 / SC-005 | T006, T010, T015, T028–T029 |
| US4 / FR-010 / SC-006 | T027 |
| US5 / FR-012 | T017, T023 |
| FR-011 | T012, T016, T021 |
| FR-014–015 | T002–T004 |
| FR-016 | T031 |
| FR-017 / SC-007 | T032–T033 |
| FR-018 / SC-010 | T001, T005, T035 |
| SC-008–009 | T007, T034 |
