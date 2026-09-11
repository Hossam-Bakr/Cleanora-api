# Module boundary review — R1-P13

Date: 2026-09-10  
Verdict: **PASS** for static ownership and forbidden-import scans (Cursor). This is not a Codex re-review PASS.

## Checks

| Check | Result |
|---|---|
| Bookings command/application files do not import Prisma or `#database/prisma` | PASS (`module-boundaries.test.ts`) |
| Bookings infrastructure is the only Prisma consumer for booking tables | PASS (`prisma-bookings.repository.ts`) |
| Foreign module `infrastructure/` paths are not imported | PASS |
| Mutation uses `evaluateEligibility({ mode: "explicit" })`, never Browse `getStandardBrowseCandidates` | PASS (`bookings.command.service.ts`) |
| Configuration deposit percent, Customers address snapshot, Media attachments, Catalog definition, Providers snapshots via `*.public` | PASS |
| Runtime transition authority is `status_transition_rules`, not `bookings.matrix` | PASS (command service does not import the matrix) |
| HTTP remains thin; workflows live in `BookingsCommandService` | PASS |
| No `orders` table or Staff booking override HTTP | PASS |

Command:

```text
npx vitest run --config vitest.r1-p13.config.ts tests/unit/modules/bookings/module-boundaries.test.ts
```

Result: PASS (4 tests).

## Notes

`createPrismaBookingsCommandRepository` is composed in `src/composition.ts` with public readers (`createDepositPercentReader`, `createCustomerAddressSnapshotReader`, `createBookingAttachmentReader`). Bookings does not query `country_configs`, customer address tables, or media storage internals directly.

Browse continues to use `getStandardBrowseCandidates` only for discovery HTTP and still reports `sideEffects.bookingCreated: false`.
