# Tasks: R1-P16 — Provider Booking Response & Cancellation Events

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md)
**Status**: Implemented; READY_FOR_OWNER_REVIEW; not Complete

## Phase 1 — Foundation (blocking)

- [x] T001 Add Prisma enums/models from data-model.md to `prisma/schema.prisma` without editing applied migrations — FR-001, FR-002, FR-013
- [x] T002 Create `prisma/migrations/r1_p16_provider_booking_response_cancellation_events/` SQL + `migration-review.md` — FR-013, SC-012
- [x] T003 Seed cancellation_reasons, `commercial.provider_response_hours` Egypt 24, and new status_transition_rules rows — FR-002, FR-003
- [x] T004 Add `vitest.r1-p16.config.ts` and `test:r1-p16` / `test:coverage:r1-p16` scripts (80/75/80/80) — SC-009
- [x] T005 Extend `bookings.public.ts` and `bookings.matrix.ts` with ACCEPTED, PROVIDER actor, response/cancellation types — FR-002

## Phase 2 — Confirm seam + expiry helper

- [x] T006 Extend `confirmDepositPayment` to create PENDING response + provider confirmed intent; fail closed without hours — FR-003, US6
- [x] T007 Implement lazy expiry helper (PENDING past expiresAt → EXPIRED + CANCELLED + SYSTEM cancellation + intent) — FR-007, SC-004
- [x] T008 Unit tests: confirm creates one response; replay does not duplicate; missing hours fail-closed — FR-003
- [x] T009 Unit tests: lazy expiry denies accept and writes PROVIDER_RESPONSE_EXPIRED — SC-004

## Phase 3 — Inbox, dossier, accept, reject (US1–US5)

- [x] T010 Providers membership assertion injected at composition (no providers Prisma from bookings) — FR-004, FR-016
- [x] T011 Implement inbox list + provider/staff/customer dossier projections — FR-004, US1, US2
- [x] T012 Implement idempotent accept CONFIRMED → ACCEPTED — FR-005, SC-002
- [x] T013 Implement idempotent reject with seeded reason, no fee fields — FR-006, SC-003
- [x] T014 HTTP: provider inbox/dossier/accept/reject + Zod schemas — FR-014
- [x] T015 Integration/unit: selected provider only; other provider denied — SC-001
- [x] T016 Integration/unit: accept idempotent; illegal second accept; stale version — SC-002, SC-006
- [x] T017 Integration/unit: reject writes cancellation without fee — SC-003, SC-007

## Phase 4 — Cancellations + reasons (US7–US9)

- [x] T018 GET cancellation-reasons — FR-008
- [x] T019 Extend customer cancel to CONFIRMED/ACCEPTED with cancellation row — FR-008, SC-005
- [x] T020 Provider cancel from ACCEPTED only — FR-008, US8
- [x] T021 Staff cancel hook CONFIRMED/ACCEPTED with audit — FR-008, US9
- [x] T022 HTTP: customer extend, provider cancel, staff cancel + staff GET dossier — FR-014
- [x] T023 Integration/unit: customer/provider/staff cancel authz and recording — SC-005
- [x] T024 Integration/unit: provider cancel from CONFIRMED rejected — US8

## Phase 5 — Notification intents + boundaries (US10)

- [x] T025 Insert intents in the same transaction as accept/reject/expiry/cancel/confirm — FR-012, SC-008
- [x] T026 Unit: replay does not duplicate intents; no delivery adapter — SC-008
- [x] T027 Module-boundary tests: no payments Prisma, no fee columns, no wallets — FR-010, FR-015, SC-007, SC-010

## Phase 6 — Composition, docs, gates

- [x] T028 Wire composition: clock, config hours reader, membership, route mounts — FR-016
- [x] T029 OpenAPI `docs/apis/openapi/r1-p16-provider-booking-response-cancellation-events.yaml` + Postman — FR-014, SC-011
- [x] T030 Migration evidence on disposable URL or BLOCKED with exact missing env — SC-012
- [x] T031 Implementation summary + gate log — implementation-summary.md
- [x] T032 Codex prep-accept then final review via `/codex-delegate`; repair BLOCKER/MAJOR
- [x] T033 Record READY_FOR_OWNER_REVIEW (no mark-complete, no git publish)

## Traceability

| AC / FR | Tasks |
|---|---|
| US1 / FR-004 / SC-001 | T010, T011, T014, T015 |
| US2 / FR-004 | T011, T014, T015, T022 |
| US3 / FR-005 / SC-002 | T012, T014, T016 |
| US4 / FR-006 / SC-003 | T013, T017 |
| US5 / FR-009 / SC-006 | T016, T024 |
| US6 / FR-003, FR-007 / SC-004 | T006–T009 |
| US7–US9 / FR-008 / SC-005 | T018–T023 |
| US10 / FR-012 / SC-008 | T025, T026 |
| FR-001 / FR-013 / SC-012 | T001–T003, T030 |
| FR-010 / FR-011 / SC-007 | T013, T017, T027 |
| FR-014 / SC-011 | T014, T022, T029 |
| FR-015 / SC-010 | T027 |
| SC-009 | T004 |
| Closeout | T031–T033 |
