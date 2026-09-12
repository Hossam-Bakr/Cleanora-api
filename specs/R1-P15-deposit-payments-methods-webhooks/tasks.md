# Tasks: R1-P15 — Deposit Payments, Methods & Webhooks

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md)
**Status**: Implementation delivered on branch; Codex review pending; not Complete

## Phase 1 — Foundation (blocking)

- [x] T001 Add Prisma enums/models from data-model.md to `prisma/schema.prisma` without editing applied migrations — FR-001, FR-015 — evidence: schema Payment* models
- [x] T002 Create `prisma/migrations/r1_p15_deposit_payments_methods_webhooks/` SQL + `migration-review.md` — FR-015, SC-012 — evidence: migration.sql + migration-review.md (live DB BLOCKED)
- [x] T003 Seed Egypt payment methods: Paymob CARD + WALLET enabled; optional others disabled only — FR-003, SC-007 — evidence: migration seed inserts
- [x] T004 Add `vitest.r1-p15.config.ts` and `test:r1-p15` / `test:coverage:r1-p15` scripts (80/75/80/80) — SC-009
- [x] T005 Extend `payments.public.ts` with deposit/method/receipt/refund types and error codes — FR-002
- [x] T006 Define `PaymentGatewayPort` + `FakePaymentGateway` — FR-014

## Phase 2 — Bookings seam + adapters

- [x] T007 Implement Bookings public `confirmDepositPayment` — FR-017, SC-003
- [x] T008 Implement Paymob adapter — FR-014, SC-004
- [x] T009 Unit tests: gateway misconfig fail-closed; signature invalid → false — SC-004, FR-014
- [x] T010 Unit tests: confirmDepositPayment happy path + illegal status/amount — FR-017

## Phase 3 — Initiate, methods, return (US1–US3)

- [x] T011 Repository/UoW extensions — FR-001
- [x] T012 Implement list enabled methods + staff set enabled — FR-004, FR-011, SC-007
- [x] T013 Implement idempotent `initiateBookingDeposit` — FR-005, FR-013, SC-001
- [x] T014 Implement browser return status reader — FR-006, SC-002
- [x] T015 HTTP: GET methods, POST deposits, GET return + Zod schemas — FR-004–FR-006, FR-018
- [x] T016 Integration/unit: initiate does not mark paid/confirm; idempotent replay/conflict — SC-001
- [x] T017 Integration/unit: browser return success-looking params do not confirm — SC-002

## Phase 4 — Webhook success pipeline (US4–US5)

- [x] T018 Implement webhook processing pipeline — FR-007, FR-008, SC-003
- [x] T019 Enforce one SUCCEEDED payment per booking deposit; retry after FAILED — FR-010, SC-006
- [x] T020 HTTP POST `/api/v1/webhooks/paymob` with raw-body middleware — FR-007, FR-018
- [x] T021 Integration/unit: verified success pipeline — SC-003
- [x] T022 Integration/unit: invalid signature no side effects — SC-004
- [x] T023 Integration/unit: duplicate webhook harmless replay — SC-005
- [x] T024 Integration/unit: fail then retry then succeed → one SUCCEEDED — SC-006

## Phase 5 — Receipt, refund foundation, staff (US6–US7)

- [x] T025 GET payment/receipt for owner customer and staff_admin — FR-011
- [x] T026 Staff PATCH/PUT method enable/disable HTTP — FR-011
- [x] T027 `createRefundRequest` → REQUESTED only — FR-012, SC-008
- [x] T028 Integration/unit: receipt authz + staff toggle affects customer list — FR-011, SC-007
- [x] T029 Integration/unit: refund foundation negative proofs — SC-008

## Phase 6 — Composition, docs, gates

- [x] T030 Wire composition: adapters, services, route mount — FR-002
- [x] T031 OpenAPI `docs/apis/openapi/r1-p15-deposit-payments-methods-webhooks.yaml` — FR-018, SC-011
- [x] T032 Module-boundary review artifact + boundary tests — SC-010, FR-016
- [x] T033 Migration evidence BLOCKED (no disposable DB URL) — SC-012 — documented in migration-review.md
- [x] T034 Implementation summary + gate log — implementation-summary.md
- [ ] T035 Codex prep-accept (budget) then final review via `/codex-delegate`; repair BLOCKER/MAJOR — **PENDING (CLI missing)**
- [ ] T036 Record READY_FOR_OWNER_REVIEW (no mark-complete, no git publish unless owner phrase)

## Traceability

| AC / FR | Tasks |
|---|---|
| US1 / FR-003–004 / SC-007 | T003, T012, T015, T028 |
| US2 / FR-005 / SC-001 | T013, T015, T016 |
| US3 / FR-006 / SC-002 | T014, T015, T017 |
| US4 / FR-007–008 / SC-003–005 | T018–T023 |
| US5 / FR-010 / SC-006 | T019, T024 |
| US6 / FR-011 | T012, T025, T026, T028 |
| US7 / FR-012 / SC-008 | T027, T029 |
| FR-001 / FR-015 / SC-012 | T001–T003, T011, T033 |
| FR-002 / FR-017 / SC-010 | T005–T007, T030, T032 |
| FR-013–014 | T006, T008–T009, T013 |
| FR-016 | T032, T035 |
| FR-018 / SC-011 | T015, T020, T031 |
| SC-009 | T004 |
| Closeout | T034–T036 |
