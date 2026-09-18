# DoD evidence matrix — R1-P18

**Date**: 2026-09-14  
**Branch**: `r1-p18-order-execution-completion-code`  
**Status**: All technical DoD items PASS including **SC-010** (Codex call 7 PASS). READY_FOR_OWNER_REVIEW recorded.

## Definition of Done

| # | Requirement | Evidence | Status |
|---|---|---|---|
| 1 | In-scope FR/US/SC implemented with tests | T001–T023 checked; `tests/unit/modules/orders/**` (26 tests) | PASS |
| 2 | Illegal jumps fail closed; valid path works | `orders.matrix.test.ts`; service transition tests | PASS |
| 3 | COMPLETED requires valid unexpired code under attempts; supervisor same proof | `orders.service.test.ts` complete/wrong/locked/expired; `requireFieldActor` for worker+mgr | PASS |
| 4 | Completion media visibility | customer listMedia pre/post COMPLETED in service tests | PASS |
| 5 | Timeline consistent / redacted | getTimeline dual-actor + `redactPayload` | PASS |
| 6 | Migration reviewed + live clean + upgrade | `migration-review.md`; `migration-evidence.md` Neon PASS | PASS |
| 7 | OpenAPI + Postman; phase + repo gates | openapi:validate / postman:validate (22 P18 reqs) / docs:check / typecheck / coverage PASS | PASS |
| 8 | Codex prep-accept + final review PASS **or owner substitution**; no unresolved BLOCKER/MAJOR | Prep-accept call 1; final review call 7 **PASS**; Cursor BLOCKER/MAJOR repaired | PASS |
| 9 | READY_FOR_OWNER_REVIEW recorded; no mark-complete / no git publish | `handoff-ready-for-owner-review.md`; current.md | PASS |

## Success criteria

| SC | Status | Proof |
|---|---|---|
| SC-001 | PASS | matrix negatives in `orders.matrix.test.ts` |
| SC-002 | PASS | complete without/invalid code rejected in service tests |
| SC-003 | PASS | field actor = member OR provider manager; same `complete()` path |
| SC-004 | PASS | media visibility test |
| SC-005 | PASS | timeline customer + staff |
| SC-006 | PASS | coverage 88.15 / 77.77 / 80.18 / 88.03 |
| SC-007 | PASS | openapi + postman validate include P18 |
| SC-008 | PASS | migration-evidence.md |
| SC-009 | PASS | `orders.boundaries.test.ts` |
| SC-010 | PASS | Codex call 7 VERDICT PASS (`briefs/codex-review-07-out/`) |

## EX holdings

| EX | Status |
|---|---|
| EX-01 no FAILED | PASS |
| EX-02 no PENDING_SCHEDULED | PASS |
| EX-03 staff read-only writes | PASS |
| EX-04 intents only | PASS |

## Gate log (post-repair)

| Command | Result |
|---|---|
| `npm run test:r1-p18` | PASS — 10 files / 26 tests |
| `npm run test:coverage:r1-p18` | PASS — 88.15 / 77.77 / 80.18 / 88.03 |
| `npm run typecheck` | PASS |
| `npm run openapi:validate` | PASS — includes `r1-p18-order-execution-completion-code.yaml` |
| `npm run postman:validate` | PASS — r1P18Requests 22 (11/env) |
| `npm run docs:check` | PASS — checked 22 |
| Live migration clean + upgrade | PASS — see migration-evidence.md |

## Unresolved for READY

None. READY_FOR_OWNER_REVIEW recorded 2026-09-14.
