# Review Resolution — R1-P13 Booking Draft, Pricing Snapshot & Status Machine

## Resolution summary

| Finding | Decision | Evidence/fix | Validation |
|---|---|---|---|
| Optimistic version checks are not atomic with mutations | accepted | `claimOwnedBooking` `updateMany` on `id + customerUserId + version + status` (`prisma-bookings.repository.ts:122-153`); side effects only after `count === 1` | `prisma-bookings.repository.test.ts`; HTTP stale-submit 409 |
| Persisted transition matrix is not the command authority | accepted | `isExecutableTransition` reads `status_transition_rules.executable = true` (`prisma-bookings.repository.ts:412-422`); `requireTransition` uses that port (`bookings.command.service.ts:430-441`); command service has no `bookings.matrix` import | `module-boundaries.test.ts` |
| Catalog answer values are not validated against field definitions | accepted | `canonicalizeBookingAnswer` (`bookings.answers.ts:18-40`) mapped at persist (`bookings.command.service.ts:690`) | `booking-answers.test.ts`; `booking-command.test.ts` |
| Snapshot and price-breakdown immutability is not enforced by persistence | accepted | SQL functions/triggers raise `55000` (`migration.sql:304-322`); live rewrite proof PASS in clean/upgrade validators | `assertR1P13MigrationSql`; `probeR1P13Immutability`; `migration-evidence.md` |
| Deposit configuration seeded for every country | accepted | Egypt-only seed `WHERE c."code" = 'EG'` (`migration.sql:294-302`) | `validate-clean-migration.test.ts` |
| Booking media responses do not provide signed delivery URLs | accepted | `present()` calls Media `signOwnedReadyImage` and omits URL on failure (`bookings.command.service.ts:406-427`) | `booking-command.test.ts` signed/omit cases |
| Optional PATCH idempotency exceeds accepted MVB | accepted | PATCH ignores `Idempotency-Key`; unused `UPDATE_DRAFT` was removed from the unapplied schema, migration, command union, and data model | `booking-command-http.test.ts`; schema/migration validation |
| Failed idempotent mutations can commit `{reserved:true}` and replay it as success | accepted | LIMIT checked before reserve; lost claims throw to roll back the reservation; `replayCompletedCommand` rejects unfinished `{reserved:true}` rows; already-linked attachments at the media limit finalize without LIMIT | `prisma-bookings.repository.test.ts`; `booking-command.test.ts` |
| Create evaluates eligibility without the persisted district | accepted | `evaluateTeam` receives `address.districtId`; create persists the same resolved id | `booking-command.test.ts` omitted-`districtId` case |
| PATCH maps unexpected persistence errors to CONFLICT | accepted | `replaceDraftContents` no longer catch-all-returns `"CONFLICT"` | `prisma-bookings.repository.test.ts` unexpected DB throw |
| Deposit percent silently rounds extra decimals | accepted | `normalizePercent` validates the numeric canonical string; no `toFixed(2)` repair | `deposit-percent-reader.test.ts` `12.345` / exponent cases |
| GET omits frozen snapshot and breakdown objects | accepted | `toAggregate` maps `snapshot` and `priceBreakdown`; GET presents them; OpenAPI documents them | `booking-command.test.ts`; `booking-command-flow.test.ts`; `r1-p13-booking-draft.yaml` |
| HTTP contract error catalog drift | accepted | `contracts/http-api.md` uses `AUTHENTICATION_REQUIRED` and `DEPOSIT_PERCENT_UNAVAILABLE` | OpenAPI + controller |
| Codex re-review of post-repair diff | already-resolved | DEC-092 records the earlier owner substitution; the new owner-requested 2026-09-11 in-thread Codex review independently inspected the repaired tree and returned PASS without relabeling either historical FAIL | `review-report.md` fresh verdict `PASS` |

Allowed decisions: `accepted`, `rejected-with-evidence`, `already-resolved`, `owner-decision-required`.

## Files changed

Primary remediations after Codex call 4 FAIL:

- `src/modules/bookings/infrastructure/prisma-bookings.repository.ts`
- `src/modules/bookings/bookings.command.service.ts`
- `src/modules/bookings/bookings.answers.ts`
- `src/modules/bookings/bookings.matrix.ts`
- `prisma/migrations/r1_p13_booking_draft_pricing_snapshot_status_machine/migration.sql`
- `src/modules/media/infrastructure/prisma-booking-attachment.reader.ts`
- `src/composition.ts`
- `tests/unit/modules/bookings/*`
- `tests/integration/bookings/booking-command-flow.test.ts`

## Regression coverage

- Phase suite including HTTP integration, seed-matrix inspection, and module-boundary scan
- Clean-migration SQL unit assertions for Egypt-only deposit seed and immutability trigger names

## Remaining risks or decisions

- After the historical Codex FAIL repairs, the suite includes explicit SC-005 cancelled→draft, FR-002 submit-time eligibility, idempotency-reservation, district, PATCH error, deposit-precision, GET snapshot, and upgrade-guard regressions. Fresh result: 15 files / 118 tests.
- Live clean-install, populated upgrade, and trigger rewrite proofs **PASS** (2026-09-11) against disposable `cleanora_r1_p13_proof` via `CLEANORA_R1_P13_DATABASE_URL`, on the final migration bytes. See `migration-evidence.md`.
- The fresh 2026-09-11 Codex re-review is PASS with no unresolved finding. DEC-092 remains historical context. READY_FOR_OWNER_REVIEW is recorded. Phase is not Complete. Owner `commit and push` publishes the feature branch only.
- Companion `.spec-context.json` was not hand-edited; Python is missing on this host.

## Final checks

See `implementation-summary.md` and `work-on-next-phase-progress.md`. This resolution does not mark the phase Complete and does not authorize Git publication.
