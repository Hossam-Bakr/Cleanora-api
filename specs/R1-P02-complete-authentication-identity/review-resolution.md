# Review Resolution — R1-P02 Complete Authentication & Identity

## Resolution summary

| Finding | Classification | Evidence and resolution | Focused validation |
|---|---|---|---|
| BLOCKER — public OTP category/enrollment bypass | `accepted` | Reproduced: public schema accepted `WORKER`, issuance checked only `userId`, and completion appended the supplied category. Added `verification-eligibility.policy.ts`; public OTP requests now exclude worker, issuance derives the actor channel/destination from stored pending state, verification binds user/category/purpose/channel/destination, and the transaction reloads the stored challenge/user before mutation. | `otp-category-integrity`, domain policy, and repository suites: 3 files / 20 tests passed. |
| BLOCKER — required acceptance evidence missing | `accepted` | Confirmed 115 unchecked tasks, including T108–T118 and the named real integration/E2E/concurrency/latency suites. No `CI_DATABASE_URL` exists in process or `.env`; the remote developer database is not an approved clean target. No PASS or checkbox was fabricated. | Blocked before Stage 4 acceptance execution; exact unchecked inventory captured. |
| MAJOR — OTP resend cooldown unused | `accepted` | `OtpRepository.create` now checks an unexpired open challenge's `resendAvailableAt` inside a serializable transaction. A cooling request returns the same accepted selector and the service performs no provider call. Expiry remains distinct from cooldown. | `otp-resend-cooldown.test.ts`: 3/3 focused tests passed before the concurrency addition. |
| MAJOR — Google `emailVerified` ignored | `accepted` | Sign-in/link now require a present, provider-verified email; matching email never auto-links; provider verification timestamp is written only after assurance; new Google individuals remain phone-restricted. | Google assurance + existing Google policy: 2 files / 7 tests passed. |
| MAJOR — password-reset counters unused | `accepted` | Added one atomic SQL increment/exhaust transition. Reset rejects expired, consumed, malformed, or exhausted proofs consistently; valid consume remains transactional and single-use. | `password-reset-attempts.test.ts`: isolated failing fixture fixed, then 6/6 passed. |
| MAJOR — OTP supersede/create non-atomic | `already-resolved` | The accepted cooldown fix moved cooldown check, supersession, and replacement creation into one serializable authentication-owned transaction with P2002/P2034 winner handling. | Concurrent replacement regression passed: 1/1; exactly one created challenge and one shared selector. |
| MAJOR — authentication boundary leaks | `accepted` | Removed every server/integration deep import. `#modules/authentication` now exports only safe composition ports/types and narrow policy/error factories; no Prisma, repository, service, or HTTP internal is exported. | `authentication-module-boundary.test.ts`: corrected one over-broad assertion, then 2/2 passed; source scan found zero deep imports. |
| MAJOR — in-memory Google OAuth state | `rejected-with-evidence` | `plan.md` and `research.md` explicitly approve bounded process-memory state for R1-P02 single-process composition and explicitly exclude shared OIDC state, Redis, and multi-process deployment design. Replacing it would expand scope. Existing state is random, 10-minute, consumed before provider callback, and user-bound for linking. | Google state tests: 4/4 passed, covering unpredictability, expiry, replay, tampering, and cross-user binding. |
| MINOR — production cookie Secure default | `accepted` | Production with authentication enabled now fails environment validation unless `AUTH_COOKIE_SECURE=true`. Existing cookie writer always sets `httpOnly`, configured SameSite, and approved path. | Focused production environment test: 1/1 passed. |
| MINOR — lockout read/modify/write race | `accepted` | Replaced repository read/update with one database-side conditional counter/window/lock update using configured thresholds. | Parallel lockout regression: 1/1 passed; five calls produced five increments and lock transition without a read. |
| MINOR — OpenAPI tooling timeout | `rejected-with-evidence` | Exact reviewer test was rerun unchanged. It passed in 562 ms overall; subprocess assertions took 362 ms, below the existing 5-second budget. No timeout inflation was made. | `openapi-validation.test.ts`: 1/1 passed. |
| NOTE — unavailable SMS/email adapters | `already-resolved` | Production composition remains intentionally fail-closed; successful deterministic inboxes remain under `tests/helpers` only. Egypt SMS/email credentials remain human-owned operational gates. | Provider stubs + deterministic inbox: 2 files / 2 tests passed. |
| NOTE — R1-P01 immutability / additive R1-P02 migration | `already-resolved` | P01 SHA-256 `BF84EEE3768ED0246B187B7EF1A1690B4CED5B07B7B2F9085FDCC72108E04EC8` and original P02 SHA-256 `98BF2BD75A0D0E9CA3BEE5E403BE9C4D881DE4397739A79CB38DB14F74A8529C` remained unchanged. The isolated clean proof applied P01, P02, and the narrow E.164 forward fix chronologically, verified 12 product tables, and double-seeded idempotently. | Strict static validator 8/8 plus `npm run db:ci-validate` PASS once. |
| NOTE — Argon2/HMAC/status/P2002 static posture | `already-resolved` | Existing implementation remains in place; this pass did not weaken hashing, verifier domains, refresh status checks, or signup P2002 mapping. Real concurrency evidence remains part of the blocked Stage 4 database suites. | Relevant focused security tests from prior implementation remain recorded in `implementation-summary.md`; no final gate run started. |
| NOTE — no future-phase scope | `already-resolved` | No roles, profiles, wallets, Docker, cloud, or future-phase persistence was introduced by remediation. | Reviewer scope scan remains valid; changed files are authentication/config/test/docs only. |

Allowed classifications: `accepted`, `rejected-with-evidence`, `already-resolved`, `owner-decision-required`.

## Review questions

| Question | Disposition |
|---|---|
| Public `/otp/request` access | The approved HTTP contract explicitly permits Public or verification-only access. The accepted blocker fix now requires a real server-side eligible enrollment and binds the exact target, so no new owner decision is required. |
| Production email transport | Human-owned operational gate. R1-P02 keeps the unavailable adapter fail-closed; no SMTP/provider credentials or fake-success production adapter were added. |
| Process-local Google state | Answered by approved plan/research: accepted for single-process R1-P02; shared state is excluded until a later approved infrastructure/deployment phase. |

## Files changed by remediation

- OTP integrity/cooldown: verification eligibility policy, authentication service, OTP repository, verification transaction, public schema, focused OTP tests.
- Google assurance/state: authentication service/transaction and focused assurance/state tests.
- Recovery/lockout: reset and credential repositories, service enforcement, focused parallel tests.
- Boundaries/providers: authentication public entrypoint, server/integration imports, test helpers, module-boundary and provider-stub tests.
- Configuration: production Secure-cookie validation and focused environment test.

## Focused commands and actual results

| Stage | Result |
|---|---|
| Stage 1 OTP integrity | 3 files / 20 tests passed |
| Stage 2A cooldown | 1 file / 3 tests passed |
| Stage 2B Google assurance | 2 files / 7 tests passed |
| Stage 2C reset attempts | initial focused run 5 passed / 1 fixture failure; failing test then passed; final file 6/6 passed |
| Stage 2D OTP concurrency | 1 focused test passed |
| Stage 2E module boundary | initial run exposed one over-broad test regex; corrected assertion passed; final file 2/2 passed |
| Stage 2F Google state | 1 file / 4 tests passed |
| Stage 3A Secure cookie | 1 focused test passed |
| Stage 3B lockout concurrency | 1 focused test passed |
| Stage 3C OpenAPI timeout reproduction | 1 test passed in 562 ms overall |
| Stage 3D provider stubs | 2 files / 2 tests passed |

## Blocker and handoff

Earlier remediation stages completed; Stage 4 acceptance suites and clean CI proof were later completed and are recorded in `implementation-summary.md`.

### T099 / T118 final-gate resume (human-owner authorized)

| Gate | Result |
|---|---|
| Previously passed final gates (typecheck, lint, unit, integration, E2E, prisma validate/generate, docs, OpenAPI, build, `db:ci-validate`) | Not rerun; remain documented PASS in `implementation-summary.md` |
| Prior transient E2E evidence | First coverage run: 179/180 with one transient signup 500; focused non-coverage status-enforcement rerun passed (1 passed, 5 skipped) — already recorded; not re-executed in this resume |
| `npm audit --omit=dev --audit-level=high` | **PASS** — 0 HIGH/CRITICAL production advisories |
| Full `npm audit --audit-level=high` | **FAIL** — 5 high + 3 moderate transitive **development-tool** advisories; npm remediation is forced breaking Prisma/ESLint changes; owner decision: do not force-upgrade / do not suppress; accept residual dev-tool risk for R1-P02; defer toolchain reassessment |
| Authorized second `npm run test:coverage` | **FAIL** — 64 files / 180 tests; **176 passed / 4 failed**; **no coverage percentages** |
| Coverage failure cases (second run) | E2E individual signup 500; individual-signup-otp wrong-code path signup 500; signup-concurrency email race `[500,500]`; worker-signup-rejection Prisma transaction start timeout |
| Determinism (second run) | Consistent with remote-DB contention under coverage instrumentation (standalone suites already passed); later fixed in harness/lifecycle |
| Authorized third `npm run test:coverage` (post harness fix; exactly one) | **FAIL** — tests **64/64 files**, **180/180 passed**; percentages emitted; `coverage/coverage-summary.json` present; **branches 72.9% < 75%** |
| Threshold results (third run) | Statements **89.56%** ≥ 80 PASS; Branches **72.9%** ≥ 75 **FAIL**; Functions **87.72%** ≥ 80 PASS; Lines **91.24%** ≥ 80 PASS |
| Failure class (third run) | Deterministic Vitest global branch-threshold miss — not DB contention / not flaky tests |
| Production-only audit | Remains **PASS** (0 HIGH/CRITICAL) |
| Full audit residual | Remains honestly **FAIL** for transitive **dev-tool** advisories; accepted risk; no force upgrade |
| T099 / T118 | Remain **unchecked** (branch threshold unmet) |
| Phase Complete / commit / push / deploy / production migrate / `npm run ci` / auto-converge | **Not performed** |

### Coverage contention fix (post–second coverage failure)

| Item | Record |
|---|---|
| Root cause | Process/test harness opened unbounded default pg pools (`PrismaPg({ connectionString })` → pool `max: 10` per lifecycle) while Vitest could use multiple workers; cold first interactive transaction hit Prisma maxWait → signup **500** / worker fixture transaction-start timeout. **Not** a uniqueness-conflict misclassification. |
| Owner | Prisma lifecycle pool ownership + Vitest worker config + test harness (with safe error cause capture) |
| Files changed | `prisma-lifecycle.ts`, `vitest.config.ts`, `error.middleware.ts`, `test-logger.ts`, `test-authentication-app.ts`, `worker-fixture.ts`, `prisma-lifecycle.test.ts` |
| Pre-fix combined nondeterminism | 1 fail / 2 pass across 3 combined four-file runs |
| Post-fix alone | All four files PASS |
| Post-fix combined stability bound | **5/5 PASS** (12 tests each) |
| Lifecycle unit regression | 5/5 PASS |
| Post-fix authorized coverage | Contention cleared (180/180); gate still **FAIL** on branches 72.9% < 75% |
| Coverage / T099 / T118 | Still unchecked; no further coverage without new human authorization; do not weaken thresholds |
| Assertions / DB safety | Unchanged; real PostgreSQL kept; no global table wipes; no forced audit upgrades |


## Deterministic branch-threshold gap — focused test resolution (2026-07-25)

| Finding | Classification | Evidence and resolution | Focused validation |
|---|---|---|---|
| Branch coverage 72.9% is below the 75% threshold (minimum mathematical gap: 14 covered branches) | `accepted` | Inspected exact uncovered conditions in the saved per-file HTML reports and existing tests before editing. Added behavioral tests for authentication input boundaries, verification eligibility rejection states, missing/malformed access credentials, missing refresh cookies, disabled Google routes, and callback-state mismatch. No production behavior, threshold, ignore directive, source exclusion, schema, or migration changed. Conservative estimate: **21** newly covered branches, above the requested 18-branch margin target. | Unit suite **PASS: 38 files / 116 tests**; typecheck **PASS**; changed-file ESLint **PASS**. No coverage or CI command run. |

### Files changed for this finding

- `tests/unit/modules/authentication/domain-policies.test.ts`
- `tests/unit/modules/authentication/otp-category-integrity.test.ts`
- `tests/unit/modules/authentication/verification-only-guard.test.ts`
- `tests/unit/modules/authentication/authentication-middleware.test.ts` (new)
- `tests/unit/modules/authentication/authentication-controller.test.ts` (new)

Coverage remains recorded as **FAIL** at branches **72.9% (487/668)** until a later explicitly authorized full run measures the new tree. T099/T118 remain unchecked; R1-P02 remains In Progress.


### Authorized measurement after focused branch tests (2026-07-25)

| Gate | Result |
|---|---|
| Pre-run integrity | Five intended test files/cases present; T099/T118 unchecked; thresholds unchanged at 80/75/80/80; no exclusion or instrumentation edit |
| Exactly one `npm run test:coverage` | **FAIL** (exit 1) — 66 files: 53 passed / 13 failed; 196 tests: 167 passed / 25 failed / 4 skipped |
| Failure class | Database connectivity failed at the Prisma lifecycle warm `SELECT 1` before database-backed suite execution; not a coverage-threshold failure |
| Percentages / summary | No percentages emitted; `coverage/coverage-summary.json` was not generated and the coverage directory is empty |
| Remaining branch gap | Not calculable from this run. Last measurable pre-change report was 487/668 (14-branch gap), which does not measure the focused-test tree |
| Automatic retry / other gates | Not performed; no `db:ci-validate`, CI, convergence, standalone gates, test edits, or threshold/exclusion changes |
| T099 / T118 / phase | Both remain unchecked; R1-P02 remains In Progress |

The deterministic branch-threshold finding remains unresolved because the new tree could not be measured. The one authorized run was consumed and was not retried.

## Test database URL separation — SELECT 1 init stability (2026-07-25)

| Item | Record |
|---|---|
| Trigger | Post–branch-gap coverage failed at Prisma warm `SELECT 1` (25 DB-backed failures; no percentages) while using the direct `CI_DATABASE_URL` path via old `register-env` overwrite |
| Separation | `TEST_DATABASE_URL` = pooled Neon test runtime; `CI_DATABASE_URL` = direct migration proof only (never mutated); ordinary `DATABASE_URL` = development only |
| Precedence | `TEST_DATABASE_URL` → legacy `CI_DATABASE_URL` fallback → hard fail; never select ordinary `DATABASE_URL` when an approved test URL exists |
| Files | `scripts/resolve-test-database-url.cjs`, `scripts/register-env.cjs`, `tests/helpers/resolve-test-database-url.ts`, `test-database-lifecycle.ts`, `test-authentication-app.ts`, Egypt/audit/configuration skip gates, `test-database-url.test.ts`, `.env.example`, `scripts/README.md` |
| Preflight | TEST present; differs from DATABASE; DB name `cleanora_r1_p02_ci_02`; pooled (`-pooler.`); `SELECT 1` **PASS**; pool ended; CI unchanged |
| Unit | Env-selection + lifecycle + runner-identity: **14/14 PASS** |
| Four-file combined | **12/12 PASS** |
| Focused composition ×3 | **3/3 PASS** (7 files / 16 tests); plus business-signup enrollment **4/4 PASS** |
| Unsupported pooled behavior | None observed; no silent fallback to `DATABASE_URL` |
| Preserved | `maxWorkers: 1`, `fileParallelism: false`, pool `max: 2`, dispose, warm SELECT 1, process-wide bind |
| Not run | `test:coverage`, `ci`, `db:ci-validate`, full suites, converge |
| T099 / T118 | Remain **unchecked** |
| Phase | Remains **In Progress**; no commit / push / deploy / production migration |

## Authorized coverage after pooled TEST_DATABASE_URL (2026-07-25)

| Gate | Result |
|---|---|
| Preflight | TEST present; differs from DATABASE; DB `cleanora_r1_p02_ci_02`; pooled; `SELECT 1` PASS; pool ended; CI unchanged |
| Typecheck / lint | **PASS** (one bracket-access fix in env-selection unit test before coverage) |
| Exactly one `npm run test:coverage` | **FAIL** (exit 1) — **threshold** only |
| Files / tests | **67/67** passed; **202/202** passed; ~224s |
| Statements / Functions / Lines | **90.73% / 88.44% / 91.71%** — all ≥ thresholds |
| Branches | **73.8%** (493/668) < **75%** — **FAIL** |
| Remaining branch gap | **8** (`ceil(0.75×668)=501` − 493) |
| Summary artifact | `coverage/coverage-summary.json` **exists** |
| Connectivity / signup 500 / tx-start | **None** |
| Runtime URL | pooled `TEST_DATABASE_URL` used (not printed); ordinary `DATABASE_URL` not used |
| Retry / threshold edits | **Not performed** |
| T099 / T118 | Remain **unchecked** |
| Phase | Remains **In Progress**; no converge / Complete / commit / push / deploy / production migration |

### Next smallest evidence-based remediation

~~Add focused unit tests targeting remaining uncovered branches…~~ **Superseded by owner decision (2026-07-25):** stop coverage-only remediation; accept 73.8% branches vs 75% as temporary technical debt; do not lower thresholds; do not claim coverage PASS; leave T099/T118 unchecked pending possible formal DoD exception after runtime acceptance; implement T139 only then proceed to manual runtime acceptance.

## Owner temporary coverage exception + T139 (2026-07-25)

| Item | Record |
|---|---|
| Coverage remediation | **Stopped** by human owner |
| Accepted evidence | 67/67 files, 202/202 tests; S/B/F/L = 90.73% / **73.8%** / 88.44% / 91.71%; production audit 0 vulns |
| Branch threshold | Still **FAIL** (not claimed PASS); thresholds **unchanged** |
| T138 | Not implemented; remains open with owner-stop note |
| T139 | **Done** — `isSessionActive` wired into access/refresh/change-password; focused session-policy tests **4/4 PASS** |
| T099 / T118 | Remain **unchecked** |
| Next focus | Manual runtime acceptance only |
| Phase | Remains **In Progress** |



## Remaining eight-branch gap — exact-marker focused tests (2026-07-25)

| Finding | Classification | Evidence and resolution | Focused validation |
|---|---|---|---|
| Saved V8 branch coverage is 493/668 (73.8%), eight branches below the 501 minimum | `accepted` | Selected **13 exact red HTML markers** rather than estimating from logical conditions: session default-time branch (1), safe error-cause alternatives (3), and controller principal/cookie/configured-Google/matching-state alternatives (9). Added 11 behavioral unit cases with no production change. | Final changed files **3/3, 19/19 PASS**; complete unit suite **41/41, 133/133 PASS**; typecheck PASS; changed-file ESLint PASS; no coverage/CI run. |

### Exact saved V8 targets

| File/line | Exact saved V8 target | Focused behavior |
|---|---|---|
| `session.policy.ts:6` | red `branch-0` default parameter | default current-time active-session evaluation |
| `error.middleware.ts:27` | red missing else of non-Error guard | Error cause receives safe description |
| `error.middleware.ts:32` | red missing else of string-code check | absent/numeric code does not create `causeCode` |
| `error.middleware.ts:37` | red missing if-path for transaction-start phrase | fixed safe timeout phrase is captured |
| `authentication.controller.ts:17` | red missing else of principal check | present principal reaches protected operation |
| `authentication.controller.ts:44` | red missing else of refresh-cookie check | present refresh cookie succeeds |
| `authentication.controller.ts:56` | red missing else of change-password cookie check | present cookie and principal succeed |
| `authentication.controller.ts:58` | red missing else of Google availability check | configured sign-in start succeeds |
| `authentication.controller.ts:60` | red missing else of Google availability check | configured sign-in callback is evaluated |
| `authentication.controller.ts:60` | red missing else of state mismatch | matching sign-in state succeeds |
| `authentication.controller.ts:64` | red missing else of Google-link availability check | configured linking starts for full principal |
| `authentication.controller.ts:66` | red missing else of link-callback availability check | configured link callback is evaluated |
| `authentication.controller.ts:66` | red missing else of link state mismatch | matching link state succeeds |

The additional session active/revoked/expired/exact-expiry assertions exercise supported state boundaries but are deliberately distinguished from the 13 visible red HTML markers above. Verification-eligibility and full-auth guard markers were not duplicated because direct behavioral cases for those states already exist despite the saved marker display.

Coverage status remains **FAIL: 73.8% (493/668)** pending a later authorized measurement. T099 and T118 remain unchecked; R1-P02 remains In Progress. No convergence, commit, push, deployment, or production migration occurred.

## DEC-017 runtime remediation (2026-07-26)

| Finding | Classification | Evidence and resolution | Validation |
|---|---|---|---|
| Real SMS unavailable for manual runtime acceptance | `owner-decision-required → accepted` | DEC-017 records a development-only SMS-to-email adapter behind the existing port. Production semantics remain SMS and fail closed; no phone-ownership claim or identifier mutation was introduced. | Environment rejection matrix, typecheck, changed-file lint, and build passed. |
| Email transport was composed as unavailable | `accepted` | Completed the existing Nodemailer adapter/factory, safe SMTP error mapping, non-sending check command, and server composition. | Static checks passed; live `email:check` is blocked by unavailable package installation and reports only `EMAIL_PROVIDER_UNAVAILABLE`. |
| Runtime database/manual acceptance evidence absent | `accepted, externally blocked` | Development target separation was proven without printing values. Prisma migration status then failed with `P1001`; no mutation followed. | Migration/seed/schema inspection and all manual endpoint journeys remain pending. |
| Secret disclosure risk during fallback | `already-resolved` | The secret appears only in the intended email body; logs, errors, events, audit context, API responses, and handoff records contain no raw OTP/reset/token/cookie/credential values. | Value-free command output and documentation review. |

T099 and T118 remain unchecked. No automated tests, coverage, CI, converge, commit, push, deployment, or production migration was run.

## DEC-018 focused logic review (2026-07-26)

| Finding | Classification | Resolution | Evidence |
|---|---|---|---|
| Google callback returned JSON to a top-level browser | `accepted` | Added browser start, backend callback completion, safe frontend redirect, and refresh-cookie exchange | Controller unit + integration + focused E2E PASS |
| Google link callback required a bearer token after cross-site navigation | `accepted` | Bound user/session to one-time LINK transaction and revalidated the active full session server-side | Google unit/integration PASS |
| Separate link callback conflicted with the one configured provider redirect URI | `accepted` | One common provider callback now derives intent from the consumed transaction; the unreleased duplicate route was removed | OpenAPI/docs/Postman aligned |
| Google phone OTP did not upgrade the current restricted session | `accepted` | Added authenticated request/verify endpoints and atomic challenge-consume/session-promotion transaction | Integration and focused E2E PASS |
| Google phone verification could accept any same-user OTP purpose | `accepted` | Bound the dedicated endpoint to the same user plus `INDIVIDUAL` / `CATEGORY_VERIFICATION` / `SMS` before mutation | Three negative unit cases + integration PASS |
| Google phone request lacked OTP rate policy | `accepted` | Applied the existing OTP send/verify rate-limit policies to canonical and compatibility routes | Route inspection + lint/typecheck PASS |
| Callback URL trusted request host/protocol | `accepted` | Provider callback URL is rebuilt from configured `GOOGLE_REDIRECT_URI` with only the received query | Controller unit PASS |

No new schema or migration was required. R1-P02 remains In Progress pending the
existing final-gate and manual-runtime tasks.

## Endpoint contract remediation (2026-07-26)

| Finding | Severity | Classification | Resolution |
|---|---|---|---|
| Development SMS-to-email and email templates labeled password-reset credentials as OTP / challenge ID pairs | MAJOR | `accepted` | Split verification and password-reset templates; reset uses password-reset subject/credential wording; OTP uses Verification code + Challenge ID |
| Signup/OTP responses returned only `{ accepted, challengeId }` and OTP resend required internal `userId` the frontend does not have after signup | MAJOR | `accepted` | Enriched challenge responses with `nextAction`, channel, purpose, masked destination, expiry, and resend timing; `/otp/request` accepts opaque `challengeId` |
| Public verify and password reset lacked explicit frontend next actions | MAJOR | `accepted` | Public verify and reset return `nextAction: LOGIN`; Google phone verify returns `CONTINUE` with `verificationOnly: false` |
| Forgot password must remain enumeration-safe and never return the composite reset credential | already-correct | `already-resolved` | Response stays `{ accepted: true }`; Postman documents manual OOB copy into `passwordResetToken` |
| Postman/OpenAPI/docs lagged the live frontend contract | MINOR | `accepted` | Updated collection bodies/descriptions, environment variable descriptions, OpenAPI schemas, and phase API docs |

No schema or migration change was required. T099/T118 remain unchecked.

## Authorized test-DB migration + validation resume (2026-07-28)

### Migration target validation (secrets not printed)

| Check | Result |
|---|---|
| `TEST_MIGRATION_DATABASE_URL` present | Yes |
| Valid PostgreSQL URL | Yes |
| Direct non-pooler Neon | Yes |
| Database name | `cleanora_r1_p02_ci_02` |
| Same DB as `TEST_DATABASE_URL` | Yes (pooled runtime URL remains separate) |
| Differs from development `DATABASE_URL` | Yes (`Cleanora`) |
| Differs from `CI_DATABASE_URL` | Yes (`cleanora_r1_p02_ci`) |
| `.env` keys for DATABASE/TEST/CI mutated | No |

### Migration SQL preconditions

`r1_p02_google_provider_profile_claims/migration.sql` is additive only:

- `ALTER TABLE "social_accounts" ADD COLUMN "provider_display_name" VARCHAR(200)`
- `ADD COLUMN "provider_avatar_url" VARCHAR(2048)`
- No DROP / DELETE / TRUNCATE / reset / destructive ALTER

### Migration status

| Moment | Result |
|---|---|
| Before | Pending: `r1_p02_google_provider_profile_claims` |
| Deploy | `prisma migrate deploy` with process-only `DATABASE_URL=$TEST_MIGRATION_DATABASE_URL` — applied successfully |
| After | Database schema is up to date (4 migrations) |
| Column proof | `provider_display_name` varchar(200) and `provider_avatar_url` varchar(2048) present; migration row finished |

### Suites after migrate

| Suite | Result |
|---|---|
| Integration (first post-migrate) | 82 passed / 3 failed — outdated safe-user assertions + incomplete worker Prisma mock |
| Focused test fixes (contract-accurate only) | `login-session`, `individual-optional-email`, `worker-login` — 3 files / 4 tests PASS |
| Integration (full rerun) | **29/29 files, 85/85 tests PASS** |
| E2E | **2/2 files, 7/7 tests PASS** |
| `npm run test:coverage` (exactly once) | **83/83 files, 294/294 tests PASS** |
| `git diff --check` | PASS |

### Coverage thresholds (unchanged 80/75/80/80)

| Metric | Before (prior measured) | After | Threshold | Result |
|---|---|---|---|---|
| Statements | 90.73% | **90.51%** (1212/1339) | 80% | PASS |
| Branches | 73.8% | **75.13%** (722/961) | 75% | **PASS** |
| Functions | 88.44% | **89.61%** (302/337) | 80% | PASS |
| Lines | 91.71% | **90.69%** (1179/1300) | 80% | PASS |

### Architectural follow-up (not implemented this pass)

| ID | Severity | Topic | Disposition |
|---|---|---|---|
| F2 | MAJOR | `writeAudit` before auth mutations / unclear UoW | Recorded follow-up |
| F3 | MAJOR | Prisma `User` shapes in application layer | Recorded follow-up |
| F4 | MAJOR | Verification workflow orchestration in transaction repository | Recorded follow-up |

### Contract freeze

Routes, methods, schemas, status codes, success/error envelopes, cookies, JWT rules, Google OAuth behavior, OpenAPI, and Postman contracts were not changed. Production code was not edited. Only tests were adjusted to assert the already-shipped safe-user `displayName`/`avatarUrl` fields and to mock `socialAccount.findUnique`.

### Still open

- Phase remains **In Progress**; not marked Complete
- No commit / push / deploy / development or production migration
- `npm run ci` not run
- Manual runtime / T192 development-DB apply / final task checkboxes remain human-owned
- T099/T118 still require human confirmation that the recorded gate set is accepted as the final once-pass evidence

## DEC-026 recovery-contract refinement — 2026-07-28

The earlier review evidence describing a single composite password-reset token
is historical and is superseded by the human-approved DEC-026 contract.

The implemented public flow now separates:

1. an opaque `challengeId`, returned by the enumeration-safe forgot-password
   endpoint for every valid request; and
2. a four-digit `code`, delivered only out of band for an eligible identity.

Reset confirmation requires both values plus the new password. The server
stores only the existing HMAC verifier and retains expiration, configured
attempt limits, single use, and all-session revocation. No raw code is returned,
persisted, or logged.

Contract and tooling alignment passed across the controller/schema, delivery
templates, runtime Swagger, static OpenAPI, Postman, unit tests, integration
tests, and focused E2E recovery journey. The Swagger default server is the
Railway hosted API; localhost remains available as the development server.

No migration, coverage run, full CI, commit, push, or deployment was performed.

## Hosted provider-unavailable remediation — 2026-07-28

The observed `503` responses were not route, database, or health failures.
Individual signup reached the unavailable SMS adapter; Company signup reached
unavailable or failing SMTP delivery.

DEC-027 resolves hosted preview acceptance without changing route, body, or
success-response contracts:

- direct email categories continue through Nodemailer;
- SMS intents may use the account-bound email only under two explicit hosted
  fallback flags;
- environment validation rejects missing acknowledgement, missing email
  capability, and simultaneous local/hosted fallback modes;
- startup and email presentation state that phone ownership is not verified;
  and
- the stable `503 AUTH_PROVIDER_UNAVAILABLE` response exposes only its safe
  retry message.

Unit, focused database-backed all-category signup, typecheck, lint, production
build, documentation, and diff checks pass. Operational SMTP acceptance on
Railway remains required after the human deploys the code and variables.
