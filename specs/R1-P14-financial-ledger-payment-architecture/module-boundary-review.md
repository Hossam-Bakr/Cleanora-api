# Module boundary review — R1-P14

Date: 2026-09-11  
Verdict: **PASS** for static ownership and forbidden-import scans (Cursor). This is not a Codex re-review PASS.

## Checks

| Check | Result |
|---|---|
| Payments application files do not import Prisma or `#database/prisma` | PASS (`module-boundaries.test.ts`) |
| Payments infrastructure is the only Prisma consumer for the six ledger tables | PASS (`prisma-payments.repository.ts`) |
| Payments does not import bookings or configuration persistence | PASS (only `bookings.public`) |
| Bookings financial reader stays in Bookings infrastructure | PASS (`prisma-booking-financial-snapshot.reader.ts`) |
| Composition wires the service and mounts no payments/ledger router | PASS (`src/composition.ts`, `src/routes/index.ts`) |
| No Express Router inside `src/modules/payments` | PASS |
| No invented `/api/v1/payments` or `/api/v1/ledger` path | PASS |
| No stored-value wallet API (`createAccount` always `WALLET_PROHIBITED`) | PASS |

Command:

```text
npx vitest run --config vitest.r1-p14.config.ts tests/unit/modules/payments/module-boundaries.test.ts
```

Result: recorded with the phase test run in `implementation-summary.md`.

## Notes

`createPaymentsApplicationService` is composed in `src/composition.ts` with
`PaymentsUnitOfWork` and `createPrismaBookingFinancialSnapshotReader`. Payments
does not post from Bookings command paths in this phase. Bookings remains the
commercial quote owner; Payments owns journals and derived totals.
