# Work-on-next-phase progress — R1-P16

## Objective

**Complete** under DEC-097 (2026-09-14). Prior READY_FOR_OWNER_REVIEW
2026-09-14. Not Git-publication authorization.

## Codex budget

- calls_used: 7
- calls_ceiling: 4 (exceeded; owner authorized Codex after quota restore for T032)
- wall_minutes_used: 21.0
- wall_minutes_ceiling: 20
- model: gpt-5.6-sol
- effort: xhigh
- service_tier: priority
- speed: 1.5x
- dispatch: /codex-delegate
- usage_telemetry: unknown

## Consultations

| # | purpose | started | minutes | status | thread | outcome |
|---|---|---|---|---|---|---|
| 1 | preparation/decision acceptance | 2026-09-13 | ~4 | timeout then resumed | 01a09809-f752-7d12-b9b2-b74eb82a32ee | ACCEPT_WITH_EXCEPTIONS KEEP EX-01/02/03 |
| 2 | preparation resume delta | 2026-09-13 | ~1.5 | completed | 01a09809-f752-7d12-b9b2-b74eb82a32ee | T001–T033 authorized; booking_actor_commands required |
| 3 | final review | 2026-09-13T15:40Z | 0.2 | failed | 01a09b6d-1e0a-7bd2-b4e9-6f589ef8f9ec | usage limit; retry at 7:00 PM |
| 4 | final review retry | 2026-09-13T16:06Z | 5.0 | timeout | 01a09b84-f05e-75c0-82e8-54aad96d669c | 5m watchdog; no VERDICT captured |
| 5 | final review narrow | 2026-09-13T16:49Z | 0.1 | failed | 01a09bac-e632-70f1-b01e-c2e5f55791e0 | usage limit until 2026-09-14 00:06 |
| 6 | final review narrow | 2026-09-13T23:00Z | 7.6 | completed | 01a09cff-cf1a-71e1-bcfd-98f858e65011 | VERDICT: CHANGES REQUIRED (5 MAJOR) |
| 7 | re-review of 5 MAJOR repairs | 2026-09-13T23:17Z | 2.7 | completed | 01a09cff-cf1a-71e1-bcfd-98f858e65011 | VERDICT: PASS |

## Accepted decisions

- DEC-095 / source: R1-P15 Complete; P16 is next dependency-ready phase.
- DEC-096 / source: owner `/work-on-next-phase` + `/goal` activates R1-P16.
- DEC-097 / source: owner `mark complete` closes R1-P16; does not activate R1-P17.
- OQ-001 holding: cancellable states and audit events; do not calculate
  unapproved fees or invent deposit fate.
- DEC-003: no stored-value wallets.
- Codex PM: KEEP EX-01/02/03; `booking_actor_commands` required for provider/staff
  idempotency; T001–T033 authorized.

## Gate snapshot (2026-09-14 02:20)

- coverage: 98.16 / 85.61 / 96.29 / 98.51 (phase-owned); 108 tests
- Codex call 6 CHANGES REQUIRED; five MAJOR repairs applied; call 7 **PASS**
- typecheck PASS; live P16 migration proof **PASS** on `cleanora_r1_p16_proof`

## Acceptance evidence

| Criterion | Evidence |
|---|---|
| US1 inbox selected-provider only | `booking-response.service.test.ts` inbox + other-manager FORBIDDEN; routes unauthenticated |
| US2 dossier provider/customer/staff | serviceId + frozen catalog service; customer GET flatten; staff dossier |
| US3 accept + same-key replay | accept + identical idempotency replay; P2002 collision replay |
| US4 reject + no fee | reject seeded reason; JSON has no fee |
| US5 illegal second command | second accept/reject after ACCEPTED → TRANSITION_NOT_AVAILABLE |
| US6 lazy expiry | expire then deny accept; customer/staff cancel → RESPONSE_EXPIRED |
| US7 customer cancel CONFIRMED/ACCEPTED | service tests + command-service hook; command row in same tx |
| US8 provider cancel ACCEPTED only | CONFIRMED rejected; ACCEPTED succeeds; authz before replay |
| US9 staff cancel | staff_admin required; CONFIRMED/ACCEPTED recorded |
| US10 intents same transaction | accept/reject/cancel/expiry templates; intent insert failure keeps CONFIRMED |
| SC-009 coverage | 98.16 / 85.61 / 96.29 / 98.51 |
| SC-011 OpenAPI/Postman | validate PASS; P13 BookingData has response/cancellation; 20 Postman requests |
| SC-012 live migrate | **PASS** clean + P15→P16 upgrade on `cleanora_r1_p16_proof` |
| T032 Codex final review | **PASS** (call 7 re-review) |

## Status

**Complete** under DEC-097 after owner `mark complete`. Companion
`.spec-context.json` is `status=completed`. Nothing staged, committed, or
pushed. Does not activate R1-P17.

## Next owner actions

1. Publish the feature branch via exact `commit and push`.
2. To start R1-P17: send `/work-on-next-phase` (separate activation).


