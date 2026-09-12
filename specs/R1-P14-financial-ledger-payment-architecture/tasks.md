# Tasks: R1-P14 — Financial Ledger & Payment Architecture

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md)
**Status**: Implementation complete; T031 Codex PASS; **READY_FOR_OWNER_REVIEW**; not Complete

## Phase 1 — Foundation (blocking)

- [x] T001 Add Prisma enums/models from data-model.md to `prisma/schema.prisma` without editing applied migrations — FR-001, FR-014
- [x] T002 Add Bookings public `BookingFinancialSnapshotReader` — FR-011
- [x] T003 Create `prisma/migrations/r1_p14_financial_ledger_payment_architecture/` SQL and `migration-review.md` — FR-014
- [x] T004 Seed Egypt system accounts for every `LedgerAccountType` (idempotent) — FR-003
- [x] T005 Add SQL rewrite/delete guards on entries, links, snapshots — FR-008, SC-005
- [x] T006 Add `vitest.r1-p14.config.ts` and `test:r1-p14` / `test:coverage:r1-p14` scripts — SC-008
- [x] T007 Add `src/modules/payments/payments.public.ts` closed types and error codes (no HTTP) — FR-002, FR-012

## Phase 2 — Domain (US1, US5)

- [x] T008 Implement payments money helpers (digit-string minor units, no JS number) — FR-004, SC-001
- [x] T009 Implement journal balance + type/link/account validators (reject wallet, ORDER, MARKETER_COMMISSION) — FR-003, FR-005, FR-006, SC-006
- [x] T010 Implement payments unit of work / repository for journals, links, keys — FR-001, FR-007
- [x] T011 Implement `postJournal` with idempotency — FR-004, FR-007, US1
- [x] T012 Unit tests: unbalanced write-nothing; wallet/ORDER/marketer rejected — SC-001, SC-006
- [x] T013 Unit tests: money validation (mixed currency, non-digit) — FR-004

## Phase 3 — Reconciliation and reads (US2)

- [x] T014 Implement `getDerivedBalance` as signed sum of entries — FR-009, SC-003
- [x] T015 Implement `listEntries` by journalId or bookingId — FR-009
- [x] T016 Implement `reconcileBooking` via Bookings reader; never change booking status — FR-010, SC-004
- [x] T017 Integration: balanced DEPOSIT + booking link — SC-001, US1
- [x] T018 Integration: idempotent replay and conflicting payload — SC-002
- [x] T019 Integration: reconcile balanced vs missing vs DRAFT not-ready — SC-004

## Phase 4 — Adjustments and snapshots (US3, US4)

- [x] T020 Implement `postAdjustment` requiring STAFF_FINANCE + reason — FR-008, FR-015, US3
- [x] T021 Implement `createSnapshot` with entry-id hash fail-closed — FR-009, US4
- [x] T022 Integration: adjustment compensates; original bytes unchanged; SQL rewrite rejected — SC-005
- [x] T023 Integration: later extra post does not mutate an existing snapshot — US4
- [x] T024 Integration: PROVIDER_SHARE / COD_REMAINING / PAYOUT / REFUND types persist without wallet/gateway — US4

## Phase 5 — Composition, boundaries, artifacts

- [x] T025 Wire payments service in `src/composition.ts` with no router mount — FR-012, SC-007
- [x] T026 Prove no `/api/v1/payments` or `/api/v1/ledger` route is registered — SC-007
- [x] T027 Keep OpenAPI + Postman validation green (no invented P14 HTTP file) — FR-012
- [x] T028 Module-boundary review artifact + boundary tests — SC-009, FR-002
- [x] T029 Migration evidence (clean + P13→P14 upgrade) or BLOCKED with exact missing URL — SC-010 — Evidence: live PASS 2026-09-11 on disposable `cleanora_r1_p14_proof` via `CLEANORA_R1_P14_DATABASE_URL`; `migration-evidence.md`
- [x] T030 Implementation summary + gate log
- [x] T031 Codex final review via `/codex-delegate`; repair BLOCKER/MAJOR — PASS 2026-09-12 (`gpt-5.6-sol` / `xhigh` / `priority`; thread `01a092ed-716e-7f30-b0ed-fb777e49affa`)
- [x] T032 Record READY_FOR_OWNER_REVIEW (no mark-complete, no git publish)

## Traceability

| AC / FR | Tasks |
|---|---|
| US1 / FR-004 / SC-001 | T008, T011, T012, T017 |
| US2 / FR-009–010 / SC-003–004 | T014–T016, T019 |
| US3 / FR-008, FR-015 / SC-005 | T005, T020, T022 |
| US4 / FR-005–006, FR-009 | T021, T023, T024 |
| US5 / FR-003 / SC-006 | T009, T012 |
| FR-001 / FR-014 / SC-010 | T001, T003, T004, T029 |
| FR-002 / FR-011 / SC-009 | T002, T007, T028 |
| FR-007 / SC-002 | T010, T011, T018 |
| FR-012 / SC-007 | T025–T027 |
| SC-008 | T006 |
| Closeout | T030–T032 |
