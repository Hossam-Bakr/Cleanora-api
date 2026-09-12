# Review Resolution — R1-P14

Source: [Deep P14 diff review](22c807d5-3068-4163-9f25-1f34165a392a) (`CHANGES REQUIRED`).

## MAJOR — Journal-level BOOKING links on Prisma reads — RESOLVED

- Fix: `PrismaPaymentsRepository.bookingIdsByJournal` loads `ledger_entry_links` by
  `journal_id` + `kind=BOOKING`; `listEntriesByJournal` / `listEntriesByAccount`
  pass that map into `mapEntry` so journal-level links resolve when `entry.links`
  is empty.
- Tests: `tests/unit/modules/payments/prisma-repository.test.ts` asserts
  journal-level link resolution; adjustment path asserts reversing journal
  retains `bookingId` via `listEntries({ journalId })`.
- Gate: `npm run test:r1-p14` — 37 passed.

## MAJOR — `postedDeposit` multi-line undercount — RESOLVED

- Fix: `postedDeposit` sums DEBIT `DEPOSIT` amounts per journal (then across
  journals), instead of taking the max single line.
- Tests: `sums multi-line DEBIT DEPOSIT amounts when reconciling` (40+60 debit /
  100 credit → `BALANCED` / `postedDepositMinorUnits: "100"`).
- Gate: `npm run test:r1-p14` — 37 passed.

## MINOR — Snapshot subject / decimal places — RESOLVED (code)

- `createSnapshot` rejects both `bookingId` and `accountType` (and neither).
- Booking snapshots prefer booking-reader / seeded-account decimal places before
  falling back to `2`.
- Test: `both-subject` createSnapshot rejection added.

## Closeout

- T031 Codex adversarial review: **PASS** 2026-09-12
  (`gpt-5.6-sol` / `xhigh` / `priority`; thread
  `01a092ed-716e-7f30-b0ed-fb777e49affa`).
- Post-fix Cursor interim
  ([Post-fix P14 review](c6c87efd-6dec-4ede-9033-9e7721379104)): PASS.
- T032: `handoff-ready-for-owner-review.md` records **READY_FOR_OWNER_REVIEW**.
- Phase remains not Complete; no git publish from this workflow.
