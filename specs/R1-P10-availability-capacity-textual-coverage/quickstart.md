# R1-P10 Validation Quickstart

Use an explicit database named like `cleanora_r1_p10_*_test` or `*_proof`; never rely on repository `.env` or an unknown target.

1. Inspect resolved Phase 10 test files with Vitest list mode and verify no historical suite is selected.
2. Run `npm run test:r1-p10`, then `npm run test:coverage:r1-p10`; require 80/75/80/80 and inspect `coverage/r1-p10/coverage-summary.json` plus include patterns.
3. Run Prisma validation/generation, typecheck, lint and build.
4. Generate Phase 10 Postman, then run OpenAPI, Postman and docs validators.
5. On an authorized disposable target, prove clean chronological migration and populated R1-P09 upgrade, seed twice, inspect exact tables/constraints and preservation digests.
6. Run `git diff --check` and module-boundary tests. Full repository regression and coverage are intentionally not run under this task.

Acceptance scenarios must cover active/inactive locality ancestry, whole-city inclusion, DST transitions, overnight/exception splitting, adjacency/overlap, Worker/Provider intersection, complete-Team capacity, pause/resume/expiry, suspension, cross-Provider denial, stale/idempotent/concurrent writes and readiness/evaluation separation.
