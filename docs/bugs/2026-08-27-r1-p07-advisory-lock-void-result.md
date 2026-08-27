# Bug Report — R1-P07 advisory lock returned an unsupported PostgreSQL void column

## Observed behavior

`PrismaProviderWorkforceCommandRepository.begin()` selected
`pg_advisory_xact_lock(...)` directly through Prisma `$queryRaw`. PostgreSQL
reports that selected column as type OID 2278 (`void`). The installed
`@prisma/adapter-pg` 7.9.0 adapter classifies OID 2278 as an unsupported native
column type, so the command can fail with Prisma `P2010` before the repository
checks or creates the idempotency record.

## Expected behavior

The command must acquire the same transaction-scoped advisory lock, then
continue the idempotency lookup while exposing only a Prisma-supported result
column type.

## Reproduction

The failing SQL shape was:

```sql
SELECT pg_advisory_xact_lock(hashtextextended($1, 0))
```

The installed adapter maps PostgreSQL OID 2278 to `void` and throws
`UnsupportedNativeDataType` when converting an unrecognized result column.
The repository regression test now rejects this direct-selection shape.

No unknown repository `.env` database was contacted. A live database
reproduction was intentionally not attempted without an explicitly approved,
phase-named disposable PostgreSQL target.

## Environment

- Windows development checkout
- Node.js 24.16.0
- Prisma Client, CLI, and PostgreSQL adapter 7.9.0
- `pg` 8.16.x
- R1-P07 Provider workforce command repository

## Evidence and root cause

`pg_advisory_xact_lock` returns PostgreSQL `void`. Selecting the function as
the raw query's result asks the Prisma PostgreSQL driver adapter to deserialize
that unsupported type. The adapter's installed type table names OID 2278 as
`void`, while its supported column enum has no `void` entry.

The lock side effect itself is valid and must remain transaction-scoped. The
defect is limited to the selected result type, not the lock key, transaction
boundary, idempotency fingerprint, or replay rules.

## Fix

The query now invokes the advisory-lock function in `FROM` and selects a
supported integer column:

```sql
SELECT 1 AS locked
FROM pg_advisory_xact_lock(hashtextextended($1, 0))
```

This preserves the blocking transaction-scoped lock and prevents the `void`
column from entering Prisma's result metadata.

The regression mock now accepts tagged-template arguments with a TypeScript-
safe signature and inspects the actual template fragments. The migration
validation assertion discovered during the wider gate was also made portable
across LF and CRLF checkouts without changing the applied migration.

## Regression test

`tests/integration/providers/r1-p07-workforce-infrastructure.test.ts` asserts
that the command repository:

- acquires `pg_advisory_xact_lock`;
- selects `1 AS locked`;
- never returns to direct `SELECT pg_advisory_xact_lock(...)`;
- retains existing create, replay, conflict, and accept behavior.

`tests/unit/scripts/validate-clean-migration.test.ts` continues to protect the
R1-P07 trigger shape while accepting either LF or CRLF working-tree line
endings.

## Validation

- Focused workforce persistence test: 1 file / 6 tests passed.
- Focused workforce, migration, and OpenAPI rerun: 3 files / 13 tests passed.
- Full unit suite: 188 files / 911 tests passed.
- R1-P07 suite: 76 files passed and 3 skipped; 329 tests passed and 5 skipped.
- TypeScript typecheck: passed.
- ESLint: passed.
- Production build: passed.
- Prisma schema validation: passed.
- `git diff --check`: passed before this report was added and is rerun in the
  final working-tree check.

## Remaining risk

The corrected SQL was not executed against a newly approved disposable live
PostgreSQL database in this repair. The same supported-result advisory-lock
pattern is already used by the Provider authority and payout-reveal paths, and
all non-database regression gates above pass. A future approved CI or
phase-named proof database should exercise the exact Prisma-adapter query as an
additional environment-level check.
