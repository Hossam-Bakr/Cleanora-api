# Work-on-next-phase progress — R1-P13

## Objective

READY_FOR_OWNER_REVIEW without mark-complete or Git publication.

## Phase

- id: R1-P13 — Booking Draft, Pricing Snapshot & Status Machine
- dir: `specs/R1-P13-booking-draft-pricing-snapshot-status-machine`
- branch: `codex/r1-p13-booking-draft-pricing-snapshot-status-machine`
- activated: 2026-09-10 via `/work-on-next-phase` + owner goal to complete P13
- prior: R1-P12 Complete (DEC-090)
- status: **READY_FOR_OWNER_REVIEW** (fresh Codex re-review PASS; DEC-092 retained as historical context); not Complete
- Codex account: Windows user `hossa` (`CODEX_HOME=C:\Users\hossa\.codex`); not `alyoser`
- Codex CLI: `C:\Users\hossa\AppData\Local\OpenAI\Codex\bin\7ac07f4ce733f89a\codex.exe` (`codex-cli 0.153.4`, ChatGPT login)

## Codex budget

- calls_used: 4
- calls_ceiling: 4
- wall_minutes_used: 16
- wall_minutes_ceiling: 20
- model: gpt-5.6-sol
- effort: xhigh
- service_tier: priority
- speed: 1.5x
- dispatch: /codex-delegate
- usage_telemetry: unknown (owner reported Codex usage-time limit)
- config_evidence: `C:\Users\hossa\.codex\config.toml` has `model = "gpt-5.6-sol"`, `model_reasoning_effort = "xhigh"`, `service_tier = "priority"`

## Consultations

| # | purpose | started | minutes | status | thread | outcome |
|---|---|---|---|---|---|---|
| 1 | PM preparation acceptance | 2026-09-10T13:36:53Z | 3 | completed | 01a08b89-20e3-79c3-ba81-8998b18f980b | ACCEPT_IMPLEMENTATION → DEC-091 |
| 2 | Final review | 2026-09-10T14:00:17Z | 5 | timeout | 01a08b9e-89cd-76c1-95fb-f76120de6425 | no `finalMessage` |
| 3 | Review resume (delta) | 2026-09-10T14:05:52Z | 5 | timeout | 01a08b9e-89cd-76c1-95fb-f76120de6425 | no `finalMessage` |
| 4 | Review resume (write report) | 2026-09-10T14:18:12Z | 3 | completed | 01a08b9e-89cd-76c1-95fb-f76120de6425 | FAIL, 6 MAJOR, 0 BLOCKER |
| — | Re-review | not dispatched | — | owner-substituted | — | DEC-092 |
| — | Fresh owner-requested in-thread re-review | 2026-09-11 | — | completed | current Codex task | PASS, 0 unresolved findings |

## Accepted decisions

- DEC-090: P12 Complete; P13 sole active; no Git publication
- DEC-091: OQ-010 freeze; EX-01/02/03 KEEP; T001–T038 authorized
- DEC-092: owner substitutes Codex re-review after usage-time limit; READY_FOR_OWNER_REVIEW
- DEC-003: no stored-value wallets
- DEC-086 inherited: `bookings` module already owns Browse HTTP
- OQ-001 temporary rule: cancellable states + audit; do not calculate fees

## Gates

| Gate | Command | Result |
|---|---|---|
| Phase tests | `npm run test:r1-p13` | PASS 15 files / 118 tests (2026-09-11) |
| Phase coverage | `npm run test:coverage:r1-p13` | PASS statements 91.64, branches 82.76, functions 97.15, lines 91.6 |
| Typecheck | `npm run typecheck` | PASS |
| Build | `npm run build` | PASS |
| Repository lint | `npm run lint` | PASS; `.agents/**` installed skill-vendor code explicitly excluded |
| Prisma validate | `npm run prisma:validate` | PASS |
| OpenAPI | `npm run openapi:validate` | PASS |
| Postman | `npm run postman:validate` | PASS (`r1P13RequestsPerEnvironment`: 9) |
| Docs | `npm run docs:check` | PASS |
| Git whitespace | `git diff --check` on P13-owned paths | PASS |
| Clean-migration SQL unit | `npx vitest run tests/unit/scripts/validate-clean-migration.test.ts` | PASS 5 tests |
| Live migration proofs | disposable `CLEANORA_R1_P13_DATABASE_URL` → `cleanora_r1_p13_proof` | **PASS** (2026-09-11) — clean install and populated upgrade both passed on final migration bytes; live immutability included. Existing `Full Service` / `Cleanora` / P11 / P04 databases were not used. |
| Codex final review | current owner-requested in-thread review | **PASS** — all historical findings repaired; 0 unresolved BLOCKER / MAJOR / MINOR. Earlier delegated FAIL and DEC-092 substitution remain historical evidence. |
| Module-boundary review | `tests/unit/modules/bookings/module-boundaries.test.ts` | PASS 4 tests; `module-boundary-review.md` |

## Handoff

R1-P13 is **READY_FOR_OWNER_REVIEW**.

Delivered: verified-customer browse-path booking drafts under `/api/v1/bookings`, server quote/deposit, snapshot freeze, status matrix, cancel without fees, OpenAPI, Postman, phase-owned migration SQL.

Decisions: DEC-090, DEC-091, DEC-092.

Tests: 15 files / 118 tests. Coverage: 91.64 / 82.76 / 97.15 / 91.6.

API: `docs/apis/openapi/r1-p13-booking-draft.yaml`, `postman/Cleanora-R1-P13-Booking-Draft.postman_collection.json`.

Migration: SQL reviewed; live clean/upgrade **PASS** on disposable `cleanora_r1_p13_proof`.

Findings: call-4 six MAJOR items plus later five MAJOR items (idempotency reservation, resolved district, PATCH errors, deposit precision, GET snapshot/breakdown) repaired in tree. Fresh Codex re-review PASS; no unresolved BLOCKER, MAJOR, or MINOR.

Owner `commit and push` publishes the feature branch only. Phase remains Active / not Complete. Do not run `speckit-companion-mark-complete` until the owner sends `mark complete`.

## Next unblocked work

- Wait for owner `mark complete`
- Do not merge, deploy, or run a production migration from this workflow
