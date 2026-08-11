# Bug Report — SC-008 coverage instrumentation distorts the latency gate

## Observed behavior

`npm.cmd run test:coverage` failed the SC-008 acceptance workload even though the same workload passed in the uninstrumented full integration gate. V8 coverage instrumentation increased request-path latency enough for fewer than 95% of the 1,000 interactions to complete within two seconds.

## Expected behavior

The SC-008 performance gate must measure the application without coverage instrumentation, while the coverage gate must still enforce the approved source thresholds. Neither gate may weaken the other's acceptance criteria.

## Reproduction

- Instrumented: `npm.cmd run test:coverage`
- Uninstrumented: `npm.cmd run test:integration`
- Focused performance gate: `npm.cmd run test:performance:sc008`

## Environment

Windows, Node.js 24, Vitest 4.1.10, V8 coverage, and the approved disposable PostgreSQL proof database.

## Evidence and root cause

The instrumented run failed `tests/integration/customers/sc008-workload.test.ts` after approximately 176 seconds in the latency assertion. The immediately preceding uninstrumented full integration run passed all 84 files and 207 tests, including SC-008. The test exercises 25 concurrent lanes and 1,000 instrumented service interactions; therefore the instrumentation overhead invalidates the real latency measurement.

## Fix

The coverage command excludes only the timing-sensitive SC-008 file. The unchanged full integration suite still runs it, and a dedicated `test:performance:sc008` command makes the uninstrumented gate explicit.

## Regression test

The tooling unit test asserts that the coverage command retains the exact SC-008 exclusion and that the dedicated performance command directly runs the unchanged workload file.

## Validation

- `npm.cmd run test:coverage`: 229/229 files and 889/889 tests passed; statements 85.01%, branches 76.19%, functions 88.50%, and lines 85.87%.
- `npm.cmd run test:performance:sc008`: 1/1 file and 2/2 tests passed outside the network-restricted sandbox.
- SC-008 timing evidence: 1,000 interactions, 25 active lanes, 39,178 ms measurement window, and 96.7% of interactions within two seconds.
- Attempts made inside the restricted sandbox failed before the workload with redacted code `EACCES`; they were environment denials, not database or application failures.

## Remaining risk

SC-008 remains dependent on network latency to the disposable proof database. A genuine uninstrumented failure remains blocking and is not retried or hidden by this separation.
