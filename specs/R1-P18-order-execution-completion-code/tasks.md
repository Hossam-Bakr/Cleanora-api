# Tasks: R1-P18 — Order Execution & Client Completion Code



**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md)

**Status**: Implementation complete — Codex final review PASS (call 7); READY_FOR_OWNER_REVIEW recorded



## Phase 1 — Foundation (blocking)



- [x] T001 Scaffold `src/modules/orders/` minimum module surface (errors,

  schema stubs, public.ts, routes mount point) — FR-001

- [x] T002 Add Prisma enums/models from data-model.md to `prisma/schema.prisma`

  without editing applied migrations — FR-002, FR-003

- [x] T003 Create `prisma/migrations/r1_p18_order_execution_completion_code/`

  SQL + `migration-review.md` (unique bookingId; partial unique ACTIVE code)

  — FR-015, SC-008

- [x] T004 Add `vitest.r1-p18.config.ts` and `test:r1-p18` /

  `test:coverage:r1-p18` scripts (80/75/80/80) — SC-006

- [x] T005 Extend Bookings public readers for ASSIGNED + ACTIVE assignment

  facts needed by Orders; add Orders public cancel hook wiring from booking

  cancel — FR-012, FR-016



## Phase 2 — Ensure-order + matrix (US1–US2)



- [x] T006 Implement ensure-order idempotent create ASSIGNED — FR-003, US1

- [x] T007 Implement `orders.matrix` + transition service for

  ON_THE_WAY / IN_PROGRESS / READY_TO_COMPLETE with history + events —

  FR-004, FR-005, US2

- [x] T008 Unit tests: ensure-order guards; legal/illegal transitions; authz

  member vs OWNER/ADMIN vs deny — SC-001, SC-009 prep



## Phase 3 — Completion code (US3–US5, US9)



- [x] T009 Implement code issue (hash-only), verify, attempt recording, TTL,

  maxAttempts, resend supersede — FR-006, FR-007, FR-008, US3–US5

- [x] T010 Implement complete transition + ORDER_* notification intents

  (no delivery) — FR-009, US3, US4

- [x] T011 Idempotent actor commands for transitions/complete/resend —

  FR-013, US9

- [x] T012 Tests: wrong/expired/locked codes; supervisor same proof; resend

  invalidates old; idempotent complete — SC-002, SC-003



## Phase 4 — Media, notes, timeline (US6–US7)



- [x] T013 Implement media attach + visibility filtering — FR-010, US6,

  SC-004

- [x] T014 Implement notes + timeline projection — FR-011, US7, SC-005

- [x] T015 Tests: customer media pre/post COMPLETED; timeline consistency



## Phase 5 — HTTP + cancel coordination (US8)



- [x] T016 HTTP routes/controllers/Zod per contracts/http-api.md — FR-014

- [x] T017 Booking cancel → order CANCELLED for non-terminal — FR-012, US8

- [x] T018 HTTP/integration tests for authz + cancel coordination



## Phase 6 — Composition, docs, gates



- [x] T019 Wire composition: readers, clock, hasher, route mounts,

  notification template keys — FR-009, FR-016

- [x] T020 OpenAPI `docs/apis/openapi/r1-p18-order-execution-completion-code.yaml`

  + Postman — FR-014, SC-007

- [x] T021 Module-boundary tests: no bookings/providers/payments Prisma from

  orders — FR-016, SC-009

- [x] T022 Migration evidence on disposable `CLEANORA_R1_P18_DATABASE_URL`

  — SC-008

- [x] T023 Implementation summary + gate log — implementation-summary.md

- [x] T024 Codex prep-accept then final review via `/codex-delegate`; repair

  BLOCKER/MAJOR — SC-010

- [x] T025 Record READY_FOR_OWNER_REVIEW (no mark-complete, no git publish)



## Traceability



| AC / FR | Tasks |

|---|---|

| US1 / FR-003 | T006, T008 |

| US2 / FR-004 / FR-005 | T007, T008, T016, T018 |

| US3 / FR-006 / FR-009 | T009, T010, T012 |

| US4 / FR-007 / FR-008 | T009, T010, T012 |

| US5 | T009, T012 |

| US6 / FR-010 | T013, T015 |

| US7 / FR-011 | T014, T015 |

| US8 / FR-012 | T005, T017, T018 |

| US9 / FR-013 | T011, T012 |

| FR-001 / FR-002 / FR-015 | T001–T004, T022 |

| FR-014 / SC-007 | T016, T020 |

| FR-016 / FR-017 / SC-009 | T005, T019, T021 |

| SC-006 | T004 |

| Closeout | T023–T025 |


