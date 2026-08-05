# R1-P02B Baseline

**Recorded:** 2026-08-02  
**Purpose:** Freeze the pre-refactor HTTP surface, middleware order, persistence/contracts, and quality-gate state before any R1-P02B runtime change.

## Baseline verdict

- Route inventory recorded: **22 operations**.
- Global middleware order recorded.
- Frozen Prisma, seed, dependency-version, authentication-contract, and response-envelope files have no working-tree diff.
- The baseline quality-gate set is **not green** because the complete remote-database integration command has not produced a stable full pass.
- The human owner explicitly directed readability implementation to proceed; a full green local gate set remains mandatory before phase completion.

### Owner resolution — 2026-08-03

The human owner removed repository automation at this stage. Obsolete
automation-only commands, scripts, fallbacks, and assertions were removed.
Local CommonJS/Prisma production-build checks and all local quality gates
remain required.

## Route inventory

The configured default prefix represented by the current contracts is `/api/v1`.

| # | Method | Path | Route group |
|---:|---|---|---|
| 1 | GET | `/api/v1/docs` | Documentation |
| 2 | GET | `/api/v1/docs/openapi.json` | Documentation |
| 3 | GET | `/api/v1/system/health/live` | System |
| 4 | GET | `/api/v1/system/health/ready` | System |
| 5 | GET | `/api/v1/system/health/database` | System |
| 6 | POST | `/api/v1/auth/signup` | Authentication |
| 7 | POST | `/api/v1/auth/account-categories` | Authentication |
| 8 | POST | `/api/v1/auth/otp/request` | Authentication |
| 9 | POST | `/api/v1/auth/otp/verify` | Authentication |
| 10 | POST | `/api/v1/auth/login` | Authentication |
| 11 | POST | `/api/v1/auth/refresh` | Authentication |
| 12 | POST | `/api/v1/auth/logout` | Authentication |
| 13 | POST | `/api/v1/auth/logout-all` | Authentication |
| 14 | GET | `/api/v1/auth/me` | Authentication |
| 15 | POST | `/api/v1/auth/password/forgot` | Authentication |
| 16 | POST | `/api/v1/auth/password/reset` | Authentication |
| 17 | POST | `/api/v1/auth/password/change` | Authentication |
| 18 | GET | `/api/v1/auth/google` | Authentication |
| 19 | GET | `/api/v1/auth/google/browser` | Authentication |
| 20 | GET | `/api/v1/auth/google/callback` | Authentication |
| 21 | GET | `/api/v1/auth/google/link` | Authentication |
| 22 | DELETE | `/api/v1/auth/social/google` | Authentication |

Sources: `src/routes/index.ts`, `src/routes/system.routes.ts`, `src/swagger/swagger.router.ts`, and `src/modules/authentication/auth.routes.ts`.

## Global middleware and route order

The exact registration order in `src/app.ts` and `src/routes/index.ts` is:

1. Disable the `x-powered-by` Express setting.
2. `requestIdMiddleware`.
3. Morgan-backed `createHttpLogger(...)`.
4. `helmet()`.
5. `cors(createCorsOptions(...))`.
6. `express.json({ limit: REQUEST_BODY_LIMIT })`.
7. `cookieParser()`.
8. `mountRoutes(...)`, which currently registers:
   1. Swagger/docs router at `${API_PREFIX}/docs`.
   2. Readiness-only rate limiter at `${API_PREFIX}/system/health/ready`.
   3. System router at `${API_PREFIX}/system`.
   4. Authentication router at `${API_PREFIX}/auth` when configured.
9. Optional test-only `mountTestRoutes` hook.
10. `notFoundMiddleware`.
11. `createErrorMiddleware(logger)`.

This order is frozen for R1-P02B unless a task explicitly relocates registration while preserving the same runtime order and behavior.

## Frozen-file evidence

`git diff --exit-code --` was run against every path listed below and exited **0** with no output. SHA-256 values provide a precise baseline for the final phase comparison.

| Frozen path | SHA-256 |
|---|---|
| `prisma/schema.prisma` | `F794CE66158C61F97BF41044A14E163DA68B8DEF0D6BFED5B522C7E3CB090B4B` |
| `prisma/seed.ts` | `072119619BD176590A812830A327972F10FD52C851692DFC3A4593F887C1A6F1` |
| `prisma/migrations/README.md` | `C8CDA749EF27138096D799518B7813FA6B1339C0B50F0743BC947D103191F670` |
| `prisma/migrations/r1_p01_foundation_country_configuration/migration.sql` | `BF84EEE3768ED0246B187B7EF1A1690B4CED5B07B7B2F9085FDCC72108E04EC8` |
| `prisma/migrations/r1_p02_complete_authentication/migration.sql` | `3BD939A8145DC512F4EB5C758A94E2A6467C26DEC4802FB836D7F14DD42DFC2B` |
| `prisma/migrations/r1_p02_email_verification_for_individuals/migration.sql` | `537E283BC0034C8449AFF9C61E3445A36AE231B7BD378CB83A56A97EB17331CB` |
| `prisma/migrations/r1_p02_fix_phone_e164_constraint/migration.sql` | `1FD8EDFCFAE97EE1F95B3A876B1C9E2236D001C2E39801B9E546CEB29C001A3B` |
| `prisma/migrations/r1_p02_google_provider_profile_claims/migration.sql` | `A17B08CDB1DB9CB3D09F202D399CB25CEFC8D3C40F59716FDD275B6835577450` |
| `package.json` | `C7B453710CA5B3E7860B17E0C5D6F71BFD6ED70C489F1920B9805AC11B5F9A38` |
| `package-lock.json` | `3755874F47C31B4D4F809430404A28A709E9D015C619D35E171E0D31201FABBC` |
| `docs/standards/api-response-and-errors.md` | `377CFCD05ADC8C9DCE14DCD00DFD8B88FAA3B69CA2D6E22FEECDE8C59DA9ADDE` |
| `docs/apis/authentication.md` | `F9E7F35967CD917D5AF5D5645026A8BACAAC687F6CCCB58A0164EB6948B5347E` |
| `specs/R1-P01-project-foundation-country-configuration/contracts/response-envelope.md` | `3266FBDE5D6FD2A8E495E4A4FAB175D12F20BD3920125B9B94D1187CBC28080A` |
| `specs/R1-P02-complete-authentication-identity/contracts/authentication-module.md` | `63EDE0E68D937C3AF6A0325085D9396F6399102D16AFCA0DFF7B8D93BEE48CE0` |
| `specs/R1-P02-complete-authentication-identity/contracts/authentication-api.md` | `07172E82F90894F1D33ACEA1151B71E6D5A0276C11FB746C3C6673B69D9B7CA1` |

These files are frozen throughout R1-P02B except for the owner-authorized
removal of automation-only `package.json` scripts. Dependency versions remain
unchanged. No Prisma schema, applied migration, seed, authentication-contract,
response-envelope, status-code, error-code, cookie, token, session, or
frontend-facing response change is authorized.

## Baseline quality gates — 2026-08-03

The two local production-build assertions remain in
`tests/unit/tooling/production-build.test.ts`.

| Command | Result | Evidence |
|---|---|---|
| `npm run prisma:validate` | **PASS** | Schema valid; exit 0. |
| `npm run typecheck` | **PASS** | Exit 0; no diagnostics. |
| `npm run lint` | **PASS** | Exit 0; no diagnostics. |
| `npm run test:unit` (parallel with integration) | **FAIL** | One OpenAPI tooling test exceeded its 5-second limit under resource contention. |
| `npm run test:unit` (sequential rerun) | **PASS** | 50 files and 202 tests passed. |
| `npm run test:integration` (first full run) | **FAIL** | 28/29 files and 81/83 tests passed; two failures occurred in `password-recovery-change.test.ts`. |
| Focused `password-recovery-change.test.ts` | **PASS** | 1 file and 2 tests passed unchanged. |
| `npm run test:integration` (second full run) | **FAIL** | 28/29 files and 81/83 tests passed; two different failures occurred in `business-signup-enrollment.test.ts`. |
| Focused `business-signup-enrollment.test.ts` | **PASS** | 1 file and 4 tests passed unchanged. |
| `npm run openapi:validate` | **PASS** | Both OpenAPI documents and the runtime document validated. |
| `npm run docs:check` | **PASS** | `{"ok":true,"checked":11}` |
| `git diff --check` | **PASS** | Exit 0 with non-blocking LF-to-CRLF warnings. |
| `npm run build` | **NOT RUN** | Stopped after the required full integration gate failed. |
| Startup smoke | **NOT RUN** | Stopped after the required full integration gate failed. |

The failures move between files and disappear in focused reruns. This is
evidence of remote test-database instability or connection pressure, not a
reproducible authentication defect. Nevertheless, the exact full integration
command is not green, so T002 remains incomplete and T004 remains locked.

## Baseline closure — 2026-08-03

After implementation was explicitly authorized, all required local baseline
and final commands completed successfully:

- Prisma validation, typecheck, lint, OpenAPI, documentation, build, and
  `git diff --check`: **PASS**.
- Unit suite: **54 files / 206 tests PASS**.
- Integration suite: **29 files / 83 tests PASS**.
- Production-shaped startup smoke: live **200/ok**, ready **200/ready**, and
  database disconnect exactly once.

T002 is closed by this complete green run. The earlier transient remote
database failures remain recorded above as non-blocking historical evidence.

## Task status decision

- T001: complete; the route and middleware baseline is recorded above.
- T002: complete; the complete local gate set is green.
- T003: complete; the frozen paths are named, hashed, and verified to have no working-tree diff.
- T004 onward: explicitly authorized by the human owner on `2026-08-03` and
  validated by the complete green local gate set.
