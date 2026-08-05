# Bug Report — Integration database connection transient

## Observed behavior

The first complete integration run passed 28 of 29 files and 82 of 83 tests.
The Google authentication file failed while its test helper executed Prisma's
startup `SELECT 1`, before the Google scenario or any assertion ran.

## Expected behavior

All 29 integration files and 83 tests should connect to the configured test
database and pass.

## Reproduction

Command: `npm run test:integration`

The failure occurred once during parallel file execution. The failing file was
then run directly and passed all three tests. The complete suite was rerun with
`--maxWorkers=1` and passed.

## Environment

- Windows development workspace
- Node.js 24
- Vitest 4
- Prisma 7 with the explicitly configured test database
- No production database, migration, seed, or destructive command involved

## Evidence and root cause

The failure stack ended in `PrismaLifecycle.connect()` at the connectivity
probe. The isolated Google file passed 1/1 files and 3/3 tests, and the full
serial run passed 29/29 files and 83/83 tests. A production-build startup smoke
also passed once executed with the network permission required by the local
sandbox.

This evidence identifies a transient/concurrency-sensitive test-database
connection failure, not a Google authentication or R1-P02B wiring regression.

## Fix

No source or test fix was made. No retry, disabled assertion, or permanent test
configuration change was added. Serial scheduling was used only for the final
validation run.

## Regression test

The existing Google integration file remains unchanged and passed 3/3 tests.
The complete existing integration suite passed 83/83 tests.

## Validation

- Focused Google integration: PASS — 1 file / 3 tests
- Complete serial integration: PASS — 29 files / 83 tests
- Production-build startup smoke: PASS — live 200, ready 200, graceful shutdown

## Remaining risk

The external test-database connection can be sensitive to concurrent workers.
The PostgreSQL driver also retains its previously recorded forward-looking SSL
mode warning. Neither behavior was changed in R1-P02B.
