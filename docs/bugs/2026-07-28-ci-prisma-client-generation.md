# Bug Report — Clean-build Prisma Client generation

## Observed behavior

Both the GitHub `quality` checks and the Railway production build failed before
Prisma Client existed. GitHub failed during `npm run typecheck`; Railway failed
during `npm run build`. TypeScript could not resolve the generated Prisma
Client, which also caused secondary implicit-`any` and unknown-error
diagnostics in Prisma-dependent files.

## Expected behavior

Every clean checkout or deployment must generate Prisma Client before running
typecheck, lint, tests, or build commands that import generated Prisma types.

## Reproduction

Run `npm run typecheck` from a clean checkout where `src/generated/` is absent.

## Environment

- GitHub Actions Ubuntu runner
- Node.js 24
- Prisma 7.9
- Generated client output: `src/generated/prisma`

## Evidence and root cause

`src/generated/` is intentionally excluded from Git. The quality workflow ran
`npm ci` and then immediately ran `npm run typecheck`; it did not run
`npm run prisma:generate`. Therefore all imports from the generated client
failed. The additional typing errors were downstream effects of the missing
generated declarations.

The full coverage suite also contains database-backed authentication journeys.
The workflow did not explicitly bind the isolated `TEST_DATABASE_URL`, so that
prerequisite would have failed after the typecheck issue was resolved.

## Fix

- Generate Prisma Client immediately after dependency installation.
- Add the npm `prebuild` lifecycle so any `npm run build`, including Railway,
  generates Prisma Client before TypeScript compilation.
- Explicitly bind `TEST_DATABASE_URL` from the matching GitHub Actions secret
  or variable.
- Fail with a clear preflight message if the isolated test database is absent.
- Keep generated Prisma output excluded from version control.

## Regression test

`tests/unit/tooling/ci-database-gate.test.ts` verifies that:

- Prisma generation appears before typecheck in the quality job.
- The production build has a `prebuild` Prisma-generation lifecycle.
- The quality job binds `TEST_DATABASE_URL`.
- A clear missing-test-database diagnostic is present.

## Validation

- `npm run prisma:generate` — PASS
- `npm run typecheck` — PASS
- `npm run build` — PASS and automatically ran `prisma:generate` first
- Unit suite — 52 files and 204 tests PASS
- Changed-file ESLint — PASS
- `git diff --check` — PASS, with existing line-ending warnings only

## Remaining risk

The GitHub repository must define `TEST_DATABASE_URL` as an Actions secret or
variable. Its database must contain all reviewed R1-P02 migrations before the
database-backed coverage suite can pass. No database migration was performed
as part of this fix.
