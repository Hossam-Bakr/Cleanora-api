# Review Report — R1-P02 Complete Authentication & Identity

## Scope and evidence

- Specification: `specs/R1-P02-complete-authentication-identity/spec.md`, `plan.md`, `tasks.md`, `contracts/`, `data-model.md`, `implementation-summary.md`
- Constitution: `.specify/memory/constitution.md`
- Diff: complete working tree vs `HEAD` / `origin/main` (modified tracked files + untracked auth module, migration, integrations, tests, OpenAPI)
- Phase pointer: `docs/product/current.md` — R1-P02 **In Progress** (not Complete)
- Checks run:
  - Static inspection of auth module, composition, Prisma schema/migration, adapters, helpers
  - SHA-256 of applied R1-P01 migration = `bf84eee3768ed0246b187b7ef1a1690b4ced5b07b7b2f9085fdcc72108e04ec8` (matches claimed checksum)
  - Destructive-SQL scan on `r1_p02_complete_authentication/migration.sql` — no `DROP`/`TRUNCATE`/`DELETE FROM`/`ON DELETE CASCADE`
  - Scope-creep scan — no roles/permissions/wallets/addresses/Docker in auth/schema
  - Inventory of `tests/integration/authentication/` and `tests/e2e/authentication/` (acceptance suites absent)
  - Focused `npm run test:unit` (full unit glob as wired by package script): **84 passed / 1 failed** (`tests/unit/tooling/openapi-validation.test.ts` timed out at 5s — tooling flake, not auth logic)
- Claim under review: “implementation workflow and Spec Kit convergence are complete” — **contradicted by evidence** (115 unchecked tasks; T108–T118 still open; summary Final gate results pending)

### Loaded context (≤5)

- Active phase is R1-P02 In Progress; Complete Authentication & Identity.
- Spec requires blocking verification by category, no worker self-signup, Google individual-only + phone gate, session rotation/reuse, ban/suspend, no secret persistence.
- Plan uses modular auth module, seven-table migration, ports + unavailable/fake SMS until human Egypt vendor gate.
- Tasks T108–T118 CRITICAL acceptance suites remain unchecked; T104–T107/T136–T137 marked done with code present.
- Constitution: standalone greenfield, one active phase, modular ownership, human-controlled ops, no invented SMS vendor.

## Findings

### BLOCKER Public OTP can enroll/verify unenrolled categories (including WORKER)

- Evidence:
  - `src/modules/authentication/http/authentication.schemas.ts:3,7` — `otpRequestSchema` accepts `categorySchema` including `WORKER`
  - `src/modules/authentication/http/authentication.routes.ts:90-98` — `POST /otp/request` is public
  - `src/modules/authentication/application/authentication.service.ts:109-112` — `requestVerification` loads user by `userId` only; **no** `accountCategories.includes(category)` check
  - `src/modules/authentication/application/authentication.service.ts:115-130` — issues OTP for any requested category
  - `src/modules/authentication/infrastructure/authentication-transaction.repository.ts:23-25` — `completeVerification` appends `input.category` to `verifiedCategories` without enrollment check
  - `src/modules/authentication/domain/verification.policy.ts:7-8` — `WORKER` uses SMS channel
- Criterion/rule: FR-003 (reject worker self-signup/enrollment); FR-001/FR-002 category integrity; SC-002; US5; Constitution VI (deny by default / server-side enforcement)
- Impact: Anyone who can obtain a `userId` (and deliver/intercept SMS for that identity’s phone) can `POST /otp/request` with `accountCategory: "WORKER"` (or another unenrolled category), verify, and write that category into `verifiedCategories` without signup/enrollment. This is a category-privilege / worker enrollment bypass.
- Remediation:
  1. Reject `WORKER` on public OTP request/verify schemas (and any public enrollment path).
  2. Require `category ∈ user.accountCategories` and not already verified (except optional individual email purpose) before issuing OTP.
  3. Re-assert the same enrollment invariant inside `completeVerification` transaction before mutating `verifiedCategories`.
- Regression test: integration test — signup INDIVIDUAL → attempt OTP for `WORKER` / `COMPANY` → expect failure and unchanged `verifiedCategories` / `accountCategories`.

### BLOCKER Required acceptance evidence missing while convergence claimed complete

- Evidence:
  - `specs/R1-P02-complete-authentication-identity/tasks.md:428-438` — T108–T118 still `- [ ]`
  - `specs/R1-P02-complete-authentication-identity/implementation-summary.md:57-59` — Final gate results pending; coverage not run; DB-backed acceptance not run
  - Missing files: `tests/integration/authentication/{individual-signup-otp,business-signup-enrollment,login-session,password-recovery-change,google-authentication,abuse-status-security,session-latency,signup-concurrency,individual-optional-email}.test.ts`
  - `tests/e2e/authentication/` contains only `README.md`
  - Task checkbox count: **22 checked / 115 unchecked / 137 total**
- Criterion/rule: SC-014, SC-016, FR-006, FR-011; tasks T100–T102 / T108–T118; Constitution II (traceable DoD evidence); Constitution VII (risk-proportional testing)
- Impact: Cannot honestly approve R1-P02. Concurrent uniqueness, optional-email non-blocking, session latency, and journey E2E/integration evidence required by Spec Kit analysis remediations are absent. Claiming convergence complete is misleading.
- Remediation: Implement and pass T108–T118 against a safe empty `CI_DATABASE_URL` (or record honest skips only where the phase already allows), then finalize T118/T135. Do not mark Complete until evidence exists.
- Regression test: the missing suites themselves are the required evidence.

### MAJOR OTP resend cooldown stored but never enforced

- Evidence: `authentication.service.ts:115-130` always creates a new challenge; `otp.repository.ts:5-7` writes `resendAvailableAt` and never reads it (no other `resendAvailableAt` reads under `src/`)
- Criterion/rule: FR-017; research OTP resend cooldown; data-model `resendAvailableAt`
- Impact: Resend bombing limited only by HTTP rate limits; deterministic 60s cooldown is bypassable.
- Remediation: Before create, load open challenge and reject/delay when `resendAvailableAt > now`.
- Regression test: request OTP twice within cooldown → second request fails safely without new ACTIVE challenge.

### MAJOR Google `emailVerified` ignored when binding provider email

- Evidence: `authentication.service.ts:282-289` accepts `emailVerified` but never gates on it; `authentication-transaction.repository.ts:35-36` sets `providerEmailVerifiedAt` whenever email string is present
- Criterion/rule: FR-042; US4 edge “unverified provider identity”
- Impact: Unverified Google emails can populate identity/social email verification timestamps.
- Remediation: Fail or omit email persistence when `emailVerified !== true`; set `providerEmailVerifiedAt` only for verified provider email.
- Regression test: Google callback with `email_verified=false` does not set verified email fields / fails safely.

### MAJOR Password-reset attempt counters unused

- Evidence: `authentication.service.ts:251-260` throws on bad token without incrementing attempts; `password-reset.repository.ts` has no fail-attempt API; schema defines `attemptCount`/`maxAttempts`
- Criterion/rule: FR-033; research recovery attempt limits
- Impact: Policy incomplete (mitigated by high-entropy token, but not fail-closed to documented limits).
- Remediation: Mirror OTP `failAttempt` / exhaust semantics on verifier mismatch.
- Regression test: N failed resets exhaust challenge; further attempts rejected without consume.

### MAJOR OTP supersede+create not transactional

- Evidence: `otp.repository.ts:5-7` — separate `updateMany` then `create`; migration partial unique `otp_codes_one_open_challenge_idx`
- Criterion/rule: FR-015/FR-017 race safety; plan transaction ownership
- Impact: Concurrent resends can race on the open-challenge unique index / leave inconsistent supersession.
- Remediation: Wrap supersede+create in one `$transaction`; map `P2002` to stable verification error.
- Regression test: concurrent OTP requests for same user/purpose leave exactly one open challenge.

### MAJOR Composition/integrations import authentication internals (boundary leak)

- Evidence:
  - `src/server.ts` imports `ConfigurationAuthenticationPolicyAdapter` from module infrastructure (not public `index`)
  - Multiple `src/integrations/**` adapters import `../../modules/authentication/domain/...` directly
- Criterion/rule: `.cursor/rules/30-module-boundaries.mdc`; FR-058; `contracts/authentication-module.md`
- Impact: Encapsulation broken; adapters/composition coupled to private paths; future refactors bypass the public contract.
- Remediation: Export required ports/errors/factories from `src/modules/authentication/index.ts` (or move adapters behind composition that only uses public ports).
- Regression test: boundary/lint or grep guard forbidding `modules/authentication/(domain|application|infrastructure|http)` imports outside the module.

### MAJOR In-memory Google OAuth transaction store in runtime composition

- Evidence: `src/server.ts:179-183` wires `MemoryGoogleTransactionStoreAdapter`
- Criterion/rule: FR-044 (time-bound, single-use, tamper-resistant correlation); research Google state
- Impact: Multi-instance / restart loses or weakens callback correlation.
- Remediation: Persist single-use Google transactions (DB/Redis) before multi-instance use; document single-process limitation until then.
- Regression test: consume state twice → second fails; restart simulation invalidates memory store (document expected durable behavior).

### MINOR `AUTH_COOKIE_SECURE` defaults to false without production force

- Evidence: `src/config/env.ts` cookie secure default `false`
- Criterion/rule: FR-029
- Impact: Misconfigured production may emit refresh cookie over HTTP.
- Remediation: Require `true` when `NODE_ENV=production` (or fail startup).
- Regression test: production env with secure=false fails validation.

### MINOR Credential lockout read-modify-write race

- Evidence: `credential.repository.ts` failure increment pattern (non-atomic under concurrency)
- Criterion/rule: FR-046
- Impact: Concurrent bad logins can under-count toward lockout.
- Remediation: Atomic SQL increment / conditional update.
- Regression test: concurrent failure bursts still reach lock threshold.

### MINOR OpenAPI validation unit test timeout

- Evidence: focused unit run — `tests/unit/tooling/openapi-validation.test.ts` timed out at 5000ms
- Criterion/rule: FR-061 / tooling reliability
- Impact: Noisy gate; may flake CI when R1-P02 OpenAPI grew.
- Remediation: Raise timeout or optimize malformed-YAML path.
- Regression test: same test under CI timeout budget.

### NOTE Unavailable SMS/email adapters in `server.ts` are intentional fail-closed ops stubs

- Evidence: `src/server.ts:174-175`; `implementation-summary.md` Human-owned operations gates; research Decision 11 / T103
- Criterion/rule: Constitution VIII; approved Egypt SMS ops gate — **do not invent vendor/credentials**
- Impact: Enabled auth delivery fails closed until human provisions providers. Not a secret-leak or fake-success provider (unavailable adapters throw).
- Remediation: Keep as-is until human selects Egypt SMS + email credentials; then env-gate real adapters. Do not treat as “successful production SMS”.

### NOTE R1-P01 migration immutability preserved; R1-P02 migration additive

- Evidence: checksum match; R1-P02 SQL seven tables; RESTRICT FKs; partial unique OTP/reset indexes; no destructive ops
- Criterion/rule: FR-056, FR-065, FR-066; Constitution IV/X

### NOTE Argon2id hashing, HMAC verifiers, ban/suspend on refresh, P2002 signup mapping look sound on static review

- Evidence: argon2 adapter params; crypto verifier domains; `loginCapability` used on login/`authenticateAccess`/`refresh` (T136); `createSignup` maps P2002 → null → `AUTH_SIGNUP_UNAVAILABLE`
- Criterion/rule: FR-007, FR-016/022/032, FR-028/050, FR-006
- Caveat: concurrency/latency/optional-email **tests still missing** (see BLOCKER).

### NOTE No future-phase roles/profiles/wallets/Docker in auth schema/module

- Evidence: scope scan clean; exclusions section in implementation-summary

## Questions

1. Is public `POST /otp/request` intentionally unauthenticated (userId in body), or should challenge issuance require a signup receipt / authenticated principal except for the post-signup flow?
2. When human provisions email SMTP, should `UnavailableEmailAdapter` be replaced by Nodemailer automatically via env flags in this phase, or remain an explicit follow-up ops task?
3. Is single-process in-memory Google state an accepted R1 local constraint, or must durable storage land before any multi-instance deploy?

## Tests and checks not run

- Full `test:integration` / `test:e2e` / `test:coverage` (forbidden by review request; also blocked by missing suites / no `CI_DATABASE_URL`)
- Live SMS, email, or Google network calls
- `npm run ci`, production migrate deploy
- Multi-instance OAuth/state durability
- Clean PostgreSQL double-seed / concurrency under real DB (summary correctly records skipped)

## Tasks checked without implementation evidence

- No checked task was found claiming a **named missing** acceptance file for T108–T118 (those remain unchecked — good).
- However, overall phase narrative (“convergence complete”) is **not** supported: T108–T118 and T135 remain open; 115 tasks unchecked.
- Earlier story tasks (T042, T049, T056, T069, T076, T084, T100–T102, etc.) remain unchecked and align with missing files.

## Verdict

`BLOCKED`

R1-P02 must not be treated as review-approved or Complete until:

1. The public OTP category/enrollment bypass (including WORKER) is fixed and regression-tested, and
2. CRITICAL acceptance suites T108–T118 (and final gate evidence) actually exist and pass or are honestly recorded per phase rules.
