# Review Resolution — R1-P01 Project Foundation & Country Configuration

## Resolution summary

| Finding | Decision | Evidence/fix | Validation |
|---|---|---|---|
| BLOCKER — unit test runner collapse | `accepted` | The independent reviewer proved that test-file imports of `vitest` could resolve to a runner API with a different module identity from the worker collector. A controlled duplicate-runner import reproduced the exact `reading 'config'` stack. `vitest.config.ts` now enables worker-owned globals and deduplicates the Vitest packages; test files no longer import a runtime Vitest API. | Fresh `npm ci`; focused identity guard 1/3; final `test:unit` 20/62, `test:integration` 9/27, `test:e2e` 1/1, `test:coverage` 30/90. |
| MAJOR — startup diagnostics not actionable | `accepted` | `src/config/env.ts:31-42,176-191` validates PostgreSQL URLs and maps Zod failures to field/code/message only. `src/server.ts:119-138,179-197` validates before database/listen and logs structured diagnostics. | `tests/unit/config/env.test.ts:75-175`; focused 10/10; complete unit/coverage pass. |
| MAJOR — two process Prisma clients | `accepted` | `src/integrations/database/prisma-client-accessor.ts:10-47` requires explicit binding and has no fallback. `src/server.ts:132-150` connects once, binds before app/module composition, and shares probes/shutdown. `src/integrations/database/prisma-lifecycle.ts:12-44` makes connect/disconnect idempotent. | `tests/unit/integrations/prisma-lifecycle.test.ts:24-104`; focused 5/5; database-backed integration 9 suites/27 tests. |
| MAJOR — GLOBAL_ONLY corrupt overrides ignored | `accepted` | `src/modules/configuration/infrastructure/country-config.repository.ts:9-17` owns `existsByKey`; `resolve-effective-config.ts:48-64` rejects any row for the key before returning global data. | Resolution suites 14/14, including no-country and country-context rejection plus missing-global failure. |
| MINOR — session SQL files | `accepted` | `.gitignore:9` adds `*.session.sql`. Existing files remain untouched for human Git cleanup. | Existing files reported: `Cleanora Database.session.sql`, `cleanora_db.session.sql`; no index operation performed. |
| MINOR — ESLint module import restrictions | `owner-decision-required` | ADR-0005 remains Proposed, so no ESLint rule was silently approved. Existing module-boundary regression tests remain active. | Non-blocking follow-up after the owner decides ADR-0005. |
| Review question — clean database CI | `accepted` | `package.json:30-31` keeps `npm run ci` database-independent. `.github/workflows/ci.yml:33-46` and `scripts/ci-db-validate.ts:30-47` use only `CI_DATABASE_URL`; `validate-clean-migration.ts:31-68,196-218` rejects production-looking and non-empty targets. | Tooling/database safety tests 6/6. Current explicit database proof skipped as unavailable because `CI_DATABASE_URL` is absent. |
| Review question — TypeScript pin | `accepted` | Installed `typescript-eslint@8.65.0` declares TypeScript `>=4.8.4 <6.1.0`; `typescript@6.0.3` is within the peer range. No unrelated dependency was changed. | `npm ls`, typecheck, lint, build, and all Vitest gates pass with the final lockfile. |

Allowed decisions: `accepted`, `rejected-with-evidence`, `already-resolved`, `owner-decision-required`.

## Root causes and exact fixes

### Unit runner

Observed independent re-review behavior: all 19 unit suites and all 29 coverage suites failed during collection with zero tests:

```text
TypeError: Cannot read properties of undefined (reading 'config')
    at describe(...) in tests/unit/core/api-response.test.ts:8
```

The project script passed in the remediation process, while the same installed versions failed in the independent reviewer. Pool selection, the environment wrapper, TypeScript, path casing, `NODE_OPTIONS`, and npm `devdir` variants did not account for the split. A one-file control imported a second URL identity of `@vitest/runner` and reproduced the reviewer error exactly at top-level suite registration with zero tests. Vitest's collector state is module-local, so the second API instance had no worker-initialized runner and attempted to read `runner.config`.

Fix:

- `vitest.config.ts` sets `globals: true` so suite/test APIs come from the worker-owned instance.
- Vite resolution deduplicates `vitest`, `@vitest/runner`, `@vitest/expect`, and `@vitest/utils` at the project root.
- `tsconfig.json` includes `vitest/globals` types.
- All 29 test files stopped importing the runtime `vitest` entry point; no suite or assertion changed.
- `tests/unit/tooling/vitest-runner-identity.test.ts` proves the globals execute, rejects runtime `vitest` imports, and locks the dedupe configuration.

The final graph remains Node 24.16.0, npm 11.16.0, TypeScript 6.0.3, Vitest 4.1.10, and Vite 8.1.5. No dependency version or lock metadata changed.

### Safe startup diagnostics

Root cause: startup caught raw Zod failures at the outer process boundary but logged only `errorName`, discarding actionable paths. Fix: map only safe Zod fields, issue codes, and schema-authored messages; never attach raw issues or input values. Startup validates before constructing the database or application and before `listen`.

Regression proof covers missing `DATABASE_URL`, invalid `CORS_ORIGINS`, deliberately short JWT secret redaction, database URL redaction, raw-issue omission, optional R1-P02 auth values, and no database/listen path after validation failure.

### One Prisma lifecycle

Root cause: repositories lazily created a second `PrismaLifecycle` while server health/shutdown owned another. Fix: remove lazy construction, bind the connected server lifecycle client before app/module registration, fail access before binding, reject different rebinds, and limit reset to explicit test composition. Health probes close over the lifecycle client, repositories return that exact bound identity, repeated calls reuse it, and graceful shutdown shares one memoized disconnect.

### GLOBAL_ONLY corruption

Root cause: the application service queried `country_configs` only when `countryCode` resolved to a country ID. Fix: the configuration-owned repository can now query existence by key, and GLOBAL_ONLY resolution performs that check regardless of country context. Any row fails `CONFIG_COUNTRY_OVERRIDE_REJECTED`; absent overrides return the global value; a null global value fails `CONFIG_VALUE_MISSING`. The other policies retain their existing paths and pass their regressions.

## Files changed

- Runtime/configuration: `src/config/env.ts`, `src/config/index.ts`, `src/server.ts`.
- Database composition: `src/integrations/database/index.ts`, `prisma-client-accessor.ts`, `prisma-lifecycle.ts`.
- Configuration module: domain repository contract, `country-config.repository.ts`, `resolve-effective-config.ts`.
- Tests: environment, Prisma lifecycle, configuration resolution, database-backed integration composition, clean-migration safety, CI wiring, and the Vitest runner-identity guard; test API imports now use worker globals.
- Test tooling: `vitest.config.ts` deduplication/globals and `tsconfig.json` Vitest global types.
- CI/tooling: `package.json`, `prisma.config.ts`, `.github/workflows/ci.yml`, `.env.example`, `.gitignore`, `scripts/ci-db-validate.ts`, `scripts/validate-clean-migration.ts`, `scripts/README.md`.
- Phase evidence: `docs/product/current.md`, this resolution, and `implementation-summary.md`.

## Commands and actual results

| Command | Actual result |
|---|---|
| Duplicate-runner control | Reproduced the reviewer error exactly: 1 failed suite / 0 tests |
| Focused runner-identity guard | 1 suite / 3 tests passed |
| Direct / threads / forks / no-isolate matrix | 1 suite / 3 tests passed in every variant |
| `npm ci` | Clean lockfile install; 442 packages installed, 0 vulnerabilities |
| Environment focused test | 1 suite / 10 tests passed |
| Prisma focused test | 1 suite / 5 tests passed |
| GLOBAL_ONLY focused tests | 2 suites / 14 tests passed |
| CI database safety focused tests | 2 suites / 6 tests passed |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run test:unit` | 20 suites / 62 tests passed |
| `npm run test:integration` | 9 suites / 27 tests passed |
| `npm run test:e2e` | 1 suite / 1 test passed |
| `npm run test:coverage` | 30 suites / 90 tests passed; 94.71% statements, 84.71% branches, 96.73% functions, 94.66% lines |
| `npm run prisma:validate` | Pass; schema valid |
| `npm run openapi:validate` | Pass |
| `npm run docs:check` | Pass; checked 6 |
| `npm run build` | Pass |
| `npm audit --audit-level=high` | Pass; 0 vulnerabilities |
| `npm run db:ci-validate` | Skipped unavailable: `CI_DATABASE_URL` not configured; normal `DATABASE_URL` was not used |

## Review-owner verification after the latest `BLOCKED` report

The latest independent report was treated as authoritative input and was not
edited. The review-fix owner re-ran each unresolved finding against the current
worktree. The report's Vitest collection failure is no longer reproducible, and
the three MAJOR regression suites now execute real assertions.

| Finding | Focused command | Current result | Classification |
|---|---|---|---|
| BLOCKER — Vitest suite collection | `npm run test -- tests/unit/tooling/vitest-runner-identity.test.ts` | 1 suite / 3 tests passed | `accepted`; fixed and reproducible |
| MAJOR — startup diagnostics | `npm run test -- tests/unit/config/env.test.ts` | 1 suite / 10 tests passed | `accepted`; fixed and reproducible |
| MAJOR — shared Prisma lifecycle | `npm run test -- tests/unit/integrations/prisma-lifecycle.test.ts` | 1 suite / 5 tests passed | `accepted`; fixed and reproducible |
| MAJOR — GLOBAL_ONLY corrupt overrides | `npm run test -- tests/unit/modules/configuration/resolve-effective-config.test.ts tests/unit/modules/configuration/resolve-effective-config-errors.test.ts` | 2 suites / 14 tests passed | `accepted`; fixed and reproducible |

One final non-duplicative validation pass then produced:

| Gate | Current result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run test:unit` | 20 suites / 62 tests passed |
| `npm run test:integration` | 9 suites / 27 tests passed |
| `npm run test:e2e` | 1 suite / 1 test passed |
| `npm run test:coverage` | 30 suites / 90 tests passed; 94.71% statements, 84.71% branches, 96.73% functions, 94.66% lines |
| `npm run prisma:validate` | Pass |
| `npm run openapi:validate` | Pass |
| `npm run docs:check` | Pass; checked 6 |
| `npm run build` | Pass |
| `npm audit --audit-level=high` | Pass; 0 vulnerabilities |
| `npm run db:ci-validate` | Skipped unavailable because `CI_DATABASE_URL` is not configured; no database PASS claimed |

`npm run ci` was intentionally not run because its component gates were
executed individually and it would repeat `test:coverage`. Runtime evidence was
captured with Node 24.16.0, npm 11.16.0, TypeScript 6.0.3, Vitest 4.1.10,
`@vitest/runner` 4.1.10, and Vite 8.1.5.

## Remaining risks or decisions

- A fresh clean-database migration/double-seed proof was unavailable in this run because `CI_DATABASE_URL` is not configured. The previous isolated clean-database evidence is preserved, but this run does not claim a new database PASS.
- Independent re-review is still required; this remediation does not alter the review report's `BLOCKED` verdict itself.
- The PostgreSQL test connection emitted the upstream notice that `sslmode=require` semantics will change in future pg versions; no current test failed. Track when upgrading pg/pg-connection-string.
- ADR-0005 and automated ESLint import restrictions remain an owner decision and non-blocking follow-up.
- R1-P01 remains In Progress pending independent re-review and human approval.

## Final checks

- No R1-P02 implementation or activation.
- No commit, push, deployment, production migration, destructive database/user-data operation, or Git index change.
- No existing session SQL file deleted.
