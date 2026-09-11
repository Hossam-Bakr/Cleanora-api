# Review Report — R1-P13 Booking Draft, Pricing Snapshot & Status Machine

## Scope and evidence

- Specification: `specs/R1-P13-booking-draft-pricing-snapshot-status-machine/spec.md`
- Diff: working tree on `codex/r1-p13-booking-draft-pricing-snapshot-status-machine` (unpublished)
- Historical delegated Codex review: `/codex-delegate` read-only, `gpt-5.6-sol` / `xhigh` / `service_tier=priority`, thread `01a08b9e-89cd-76c1-95fb-f76120de6425`; final verdict FAIL after call 4.
- Later authoritative five-MAJOR review: `C:\Users\hossa\AppData\Local\Temp\delegate-relay\p13-final-review-3\result.json`; verdict FAIL, 0 BLOCKER / 5 MAJOR / 1 MINOR.
- Fresh owner-requested Codex in-thread re-review: 2026-09-11, current working tree after all repairs; verdict PASS, 0 unresolved BLOCKER / MAJOR / MINOR.
- Checks rerun by Codex on the repaired working tree (2026-09-11):

| Check | Command | Result |
|---|---|---|
| Phase tests | `npm run test:r1-p13` | PASS 15 files / 118 tests |
| Phase coverage | `npm run test:coverage:r1-p13` | PASS 91.64 / 82.76 / 97.15 / 91.6 |
| Typecheck | `npm run typecheck` | PASS |
| Build | `npm run build` | PASS |
| Repository lint | `npm run lint` | PASS; installed `.agents/**` skill-vendor code is explicitly outside the Cleanora lint boundary |
| Prisma validate | `npm run prisma:validate` | PASS |
| OpenAPI | `npm run openapi:validate` | PASS (includes `r1-p13-booking-draft.yaml`) |
| Postman | `npm run postman:validate` | PASS (`r1P13RequestsPerEnvironment`: 9) |
| Docs | `npm run docs:check` | PASS |
| Live clean install | `npm run db:validate-clean-migration` | **PASS** — final migration bytes, isolated schema `cleanora_r1_p13_proof_8024_1789086681527` |
| Live populated upgrade | `npm run db:validate-r1-p13-upgrade` | **PASS** — final migration bytes, isolated schema `cleanora_r1_p13_upgrade_proof_6544_1789086926786` |

## Findings

The historical delegated Codex final review verdict was **FAIL** with no BLOCKER and six MAJOR findings.
A later Codex file review found five more MAJORs (idempotency reservation,
resolved district, PATCH error mapping, deposit precision, GET snapshot
payload). They were repaired in the working tree. The historical delegated
call budget was exhausted (4/4), and DEC-092 therefore allowed an owner
substitution at that time. The owner's new Phase 13 review request enabled
this fresh in-thread Codex re-review; the repaired code, tests, contracts,
migration, and evidence were inspected and the relevant gates rerun.

### MAJOR Optimistic version checks are not atomic with mutations — repaired

- Evidence (review): `src/modules/bookings/infrastructure/prisma-bookings.repository.ts` mutations previously checked version in application code then updated by id.
- Criterion/rule: spec FR-006 / concurrency — stale writes leave state unchanged.
- Impact: concurrent same-version writes could both pass the read-time check.
- Remediation applied: `updateMany` claims `id + owner + expected version + expected status` inside the transaction; a zero-count claim classifies NOT_FOUND / NOT_DRAFT / CONFLICT / NOT_CANCELLABLE without writing side effects. History, snapshot, media, and answer writes run only after a successful claim.

### MAJOR Persisted transition matrix is not the command authority — repaired

- Evidence (review): `bookings.matrix.ts` `EXECUTABLE_TRANSITIONS` was enforced in the command service; `status_transition_rules` was unused at runtime.
- Criterion/rule: spec FR-007 — persist and enforce the actor × from × to matrix.
- Impact: database rows could disagree with executable behavior.
- Remediation applied: `BookingsCommandRepository.isExecutableTransition` reads `status_transition_rules` (`executable = true`). Create, submit, and cancel re-check the same row inside the mutation transaction and throw `BookingTransitionUnavailable` if missing. The TypeScript array remains seed documentation only.

### MAJOR Catalog answer values are not validated against field definitions — repaired

- Evidence (review): answers accepted any JSON-shaped value if the field id existed.
- Criterion/rule: spec — required answers must be present **and valid** before `AWAITING_DEPOSIT`.
- Impact: invalid NUMBER/TEXT/selection values could freeze into the booking.
- Remediation applied: `bookings.answers.ts` canonicalizes TEXT, INTEGER/DECIMAL NUMBER, BOOLEAN, SINGLE_SELECT, and MULTI_SELECT against catalog field rules, including duplicates, bounds, and option membership. Create, patch, and submit remap through that path.

### MAJOR Snapshot and price-breakdown immutability is not enforced by persistence — repaired in SQL; live rewrite proof PASS

- Evidence (review): tables omitted `updated_at` but had no UPDATE/DELETE rejection.
- Criterion/rule: spec — fail closed on rewrite attempts (FR-005).
- Impact: a later write could rewrite frozen commercial history.
- Remediation applied: migration functions/triggers `r1_p13_reject_booking_snapshot_mutation` and `r1_p13_reject_booking_price_breakdown_mutation` raise `55000` on UPDATE OR DELETE. `assertR1P13MigrationSql` requires those objects. Live rewrite/delete probes now **PASS** inside `probeR1P13Immutability` during clean install and populated upgrade (2026-09-10).

### MAJOR Deposit configuration seeded for every country — repaired

- Evidence (review): `INSERT INTO country_configs ... FROM countries c` without an Egypt filter.
- Criterion/rule: DEC-091 / FR-015 — Egypt seed 25; other countries fail closed.
- Impact: non-Egypt countries would receive an invented 25%.
- Remediation applied: seed only `countries.code = 'EG'`. SQL validator rejects an unfiltered `FROM "countries" c WHERE NOT EXISTS` seed.

### MAJOR Booking media responses do not provide signed delivery URLs — repaired

- Evidence (review): GET/list returned only `mediaId` and `displayOrder`.
- Criterion/rule: spec US5 — signed delivery URLs on GET; omit one URL if that sign fails.
- Impact: customers could attach images but not retrieve them as specified.
- Remediation applied: Media-owned `BookingAttachmentReader.signOwnedReadyImage` uses `MediaStoragePort.createAuthorizedDeliveryUrl`. Command `present()` attaches `deliveryUrl` / `urlExpiresAt` per item and omits the URL on individual signing failure. Composition wires storage when `createMediaStoragePort` succeeds.

### MAJOR Failed idempotent reservations can replay as success — repaired

- Evidence (later Codex review): `reserveCommand` wrote `{reserved:true}` then LIMIT/lost-claim returned normally and committed the row; `withIdempotency` replayed it.
- Remediation applied: LIMIT returns before reserve; lost claims throw `BookingDraftMutationRejected` so Prisma rolls back; replay requires a completed `bookingId` plus matching response id. Already-linked media at the five-file limit finalizes the existing aggregate instead of LIMIT.

### MAJOR Create eligibility omitted the resolved district — repaired

- Evidence: `evaluateTeam` forwarded `body.districtId` only; create persisted `prepared.address.districtId`.
- Remediation applied: eligibility and persistence both use the address-resolved district.

### MAJOR PATCH relabeled unexpected DB errors as CONFLICT — repaired

- Evidence: `replaceDraftContents` catch-all returned `"CONFLICT"`.
- Remediation applied: unexpected persistence errors propagate.

### MAJOR Deposit percent silently rounded extra decimals — repaired

- Evidence: numeric JSON used `toFixed(2)`.
- Remediation applied: canonical string must match at most two decimals; `12.345` fails closed.

### MAJOR GET omitted frozen snapshot and breakdown objects — repaired

- Evidence: `toAggregate` reduced snapshot to a boolean.
- Remediation applied: GET/list return `snapshot` and `priceBreakdown` with canonical decimal strings; OpenAPI documents them.

### MINOR Optional PATCH idempotency exceeds the accepted MVB — repaired

- Evidence (review): optional `Idempotency-Key` on PATCH and `UPDATE_DRAFT` command ledger.
- Criterion/rule: DEC-091 — idempotency for create, submit, cancel, and media.
- Impact: undocumented extra command protocol.
- Remediation applied: PATCH no longer reads `Idempotency-Key`. The unused `UPDATE_DRAFT` enum value was removed from the unapplied Phase 13 Prisma schema, migration, TypeScript command union, and data model.

### MINOR HTTP error catalog drift — repaired

- Evidence (later Codex review): the phase contract used `UNAUTHENTICATED` and omitted `DEPOSIT_PERCENT_UNAVAILABLE`, while runtime and OpenAPI used repository-standard names.
- Remediation applied: the HTTP contract now uses `AUTHENTICATION_REQUIRED` and includes `DEPOSIT_PERCENT_UNAVAILABLE`, matching runtime and OpenAPI.

## Questions

No product or technical owner question is open for this handoff. DEC-092
remains the historical record of the earlier review substitution; the current
owner-requested Codex review is a separate, fresh technical review.

## Additional test context

- A repository-wide `npm test` attempt reached four historical R1-P11
  live-proof tests that time out against the separately configured
  `cleanora_r1_p11_proof` database. A focused rerun reproduced 4 timeouts / 12
  passes at the default 5-second limit; a 30-second rerun produced 3 timeouts /
  13 passes. Those tests do not exercise Phase 13 and that older database was
  not used for Phase 13 migration validation. Their external target/harness
  condition is not counted as a Phase 13 finding.

Live clean-install, populated-upgrade, and trigger rewrite proofs were rerun on
2026-09-11 against disposable `cleanora_r1_p13_proof` and passed on the final
migration bytes. See `migration-evidence.md`.

## Verdict

`PASS` — fresh Codex re-review; **0 BLOCKER, 0 MAJOR, 0 MINOR unresolved**.

The delegated call-4 review and later five-MAJOR review remain historical
**FAIL** evidence; this verdict does not relabel either result. It records the
new owner-requested Codex review of the subsequently repaired working tree.
All eleven MAJOR findings and the HTTP contract MINOR are resolved, and live
migration proofs are PASS per SC-010 (`migration-evidence.md`).
Phase is **READY_FOR_OWNER_REVIEW**. Not Complete. Owner `commit and push`
publishes the feature branch only; no merge or production migration.
