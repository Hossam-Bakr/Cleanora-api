# Implementation summary — R1-P13 Booking Draft, Pricing Snapshot & Status Machine

Date: 2026-09-11  
Branch: `codex/r1-p13-booking-draft-pricing-snapshot-status-machine`  
Status: **Complete** under DEC-093 — owner activated R1-P14 after PASS review

## Delivered

- Extended the existing `bookings` module (DEC-086) with verified-customer
  command HTTP under `/api/v1/bookings`.
- Server-authoritative quote: `max(price, minimumCharge)` then 25% deposit
  using digit-string minor units (`DECIMAL(65,0)`). Client totals are rejected.
- Explicit Eligibility `mode: "explicit"`; selected `teamId` must be eligible.
- Configuration-owned `commercial.deposit_percent` (Egypt-only seed 25, fail closed).
- Customers owned-address snapshot; Media `BOOKING_ATTACHMENT` ready images
  (max 5 on DRAFT) with best-effort signed delivery URLs on GET/list.
- Status matrix: runtime authority is `status_transition_rules`. Executable
  customer rows: `NONE→DRAFT`, `DRAFT→AWAITING_DEPOSIT`,
  `DRAFT|AWAITING_DEPOSIT→CANCELLED`. `emergencySignaled` is a boolean.
- Submit freezes snapshots and price breakdowns; SQL triggers reject rewrite.
- Cancel writes history with closed reasons and no fee fields.
- Idempotency-Key on create/submit/cancel/media (not PATCH); optimistic
  `version` claimed atomically with `updateMany`.
- Catalog answers canonicalized against field kind/rules before persist/submit.
- Rate-limit create and submit only (T030 / DEC-091).
- Browse `bookingPrerequisites.bookingAvailable` is true only for verified
  customers; Browse still creates no booking.
- OpenAPI, Swagger merge, Postman Local/Hosted parity.

## Gates (Codex-rerun after the historical FAIL repairs)

| Gate | Command | Result |
|---|---|---|
| Phase tests | `npm run test:r1-p13` | PASS 15 files / 118 tests |
| Phase coverage | `npm run test:coverage:r1-p13` | PASS 91.64 / 82.76 / 97.15 / 91.6 |
| Typecheck | `npm run typecheck` | PASS |
| Build | `npm run build` | PASS |
| Repository lint | `npm run lint` | PASS; installed `.agents/**` skill-vendor code excluded explicitly |
| Prisma validate | `npm run prisma:validate` | PASS |
| OpenAPI | `npm run openapi:validate` | PASS |
| Postman | `npm run postman:validate` | PASS (`r1P13RequestsPerEnvironment`: 9) |
| Docs | `npm run docs:check` | PASS |
| Live clean install | `npm run db:validate-clean-migration` | **PASS** (2026-09-11) — final migration bytes in `cleanora_r1_p13_proof_8024_1789086681527` |
| Live populated upgrade | `npm run db:validate-r1-p13-upgrade` | **PASS** (2026-09-11) — final migration bytes in `cleanora_r1_p13_upgrade_proof_6544_1789086926786` |
| Codex final re-review | current owner-requested in-thread review | **PASS** — 0 unresolved BLOCKER / MAJOR / MINOR; historical delegated FAILs retained |

The optional repository-wide `npm test` run is not a Phase 13 gate and is not
recorded as PASS: the separately configured historical `cleanora_r1_p11_proof`
target currently times out in three to four older R1-P11 live tests, including
with a 30-second allowance. Phase 13's scoped suite and its guarded disposable
database proofs are green.

## Scope retained

No payment capture, ledger, wallets, `CONFIRMED` execution, assignment, orders
table, Staff override HTTP, Recommended path, maps, Docker, or cloud.

## Git publication boundary

Owner `commit and push` publishes the feature branch only. This does not mark
the phase Complete and does not authorize merge or a production migration.
Do not run `speckit-companion-mark-complete`.
