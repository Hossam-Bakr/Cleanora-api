# Tasks: Complete Authentication & Identity

**Input**: Design documents from `/specs/R1-P02-complete-authentication-identity/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`, `.specify/memory/constitution.md`

**Phase type**: Implementation of R1-P02 only. Reuse R1-P01 foundations. Preserve applied `r1_p01_foundation_country_configuration` byte-for-byte. No Docker/cloud, production migration, Git actions, roles, permissions, profiles, wallets, worker creation/management, or automatic phase completion.

**Tests**: Included and ordered **before** corresponding implementation (plan Test Strategy; FR-016 risk-proportional evidence; SC-016). Write tests first; confirm they fail; then implement.

**Organization**: Phases follow the approved recommended vertical-slice order, mapped to US1–US6 from `spec.md`.

## Format: `- [ ] [ID] [P?] [Story?] Description with file path`

- **[P]**: Parallelizable (different files; no unfinished dependency; no same-file collision)
- **[USn]**: User-story tasks only
- Setup / Foundational / Polish: no story label

## Path Conventions

- App: `src/`, `tests/`, `prisma/`, `scripts/`, `docs/`, `postman/`
- Spec Kit: `specs/R1-P02-complete-authentication-identity/`
- Phase pointer: `docs/product/current.md`

## FR / SC coverage map (normative)

| IDs | Primary phases / tasks |
|---|---|
| FR-001–FR-009, SC-001–SC-002, SC-017–SC-018 | Setup, Foundational domain, US1 signup/enrollment; **T101** owns concurrent uniqueness / `P2002` evidence for FR-006 |
| FR-010–FR-018, SC-001, SC-004 | US1 verification OTP; **T102** owns FR-011 optional individual email non-blocking evidence |
| FR-019–FR-030, SC-005–SC-008, SC-014 | Foundational session/JWT + US2 login/session; **T100** owns explicit SC-014 latency evidence |
| FR-031–FR-036, SC-003, SC-019–SC-020, SC-022 | US3 recovery/change |
| FR-037–FR-044, SC-009–SC-010 | US4 Google |
| FR-004, FR-019, SC-002 | US5 worker login |
| FR-045–FR-055, SC-011–SC-013, SC-012 | US6 abuse/status/events |
| FR-056–FR-066, SC-015–SC-017 | Foundational Prisma/migration + Polish gates |
| SC-016 | Every story’s unit/integration/E2E evidence + Polish E2E suite |
| SC-021 | US1 multi-category + US2 verified/pending login |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Activate delivery scaffolding, inventory reuse, and authorize phase-only dependencies without rewriting working R1-P01 foundations.

- [ ] T001 Create stub `specs/R1-P02-complete-authentication-identity/implementation-summary.md` with sections for baseline reuse, files changed, dependency/Argon2 evidence, migration SQL review, seed/fixture evidence, exclusions, human-owned operations gates, gate results, and open risks (roadmap DoD; constitution II/VIII)
- [ ] T002 Record baseline reuse inventory (inspect `src/app.ts`, `src/server.ts`, `src/config/env.ts`, `src/core/http/*`, `src/core/security/*`, `src/integrations/logging/pino-logger.ts`, `#modules/configuration`, `#modules/admin`, `tests/**`, R1-P01 migration checksum) into `specs/R1-P02-complete-authentication-identity/implementation-summary.md` — note preserve-untouched R1-P01 migration SQL (FR-063–FR-066)
- [ ] T003 Add phase-only dependencies (`argon2`, `jsonwebtoken`, CommonJS-compatible `openid-client`, and any approved type packages) in `package.json` / `package-lock.json` without removing existing deps (ADR-0013; research Decisions 2/4/7; plan Technical Context)
- [ ] T004 [P] Create authentication module folder skeleton with empty private layers in `src/modules/authentication/{domain,application,http,infrastructure}/` and public stub `src/modules/authentication/index.ts` (FR-058; plan Project Structure)
- [ ] T005 [P] Create authentication test helper and suite directories in `tests/helpers/authentication/`, `tests/unit/modules/authentication/`, `tests/unit/integrations/authentication/`, `tests/integration/authentication/`, and `tests/e2e/authentication/` (plan Test Strategy)
- [ ] T006 [P] Extend docs-check expected paths for R1-P02 OpenAPI and Postman in `scripts/docs-check.ts` without removing R1-P01 checks (FR-061; quickstart §6)

**Checkpoint**: Delivery stubs exist; module skeleton present; no product schema yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Capability-aware env validation, pure domain policies/ports, crypto/session adapters, seven-table Prisma migration, repositories, and composition wiring that ALL user stories need.

**⚠️ CRITICAL**: No user-story HTTP journeys until this phase completes.

### 2A — Environment, policy config, and security ports

- [ ] T007 Add failing unit tests for capability-gated auth env validation (missing/mismatched secrets when `AUTH_ENABLED=true`; `AUTH_ENABLED=false` preserves R1-P01 startup) in `tests/unit/config/env.test.ts` (FR-062; SC-013 secret non-leak)
- [ ] T008 Extend `src/config/env.ts` and exports in `src/config/index.ts` for `AUTH_ENABLED`, independent JWT/verifier/privacy-hash secrets, cookie knobs, and capability flags; fail before listen when enabled config is invalid (FR-062; research Decision 6)
- [ ] T009 [P] Add typed non-secret authentication policy keys/values through configuration catalog and seed placeholders in `src/modules/configuration/domain/config-key-catalog.ts` and `prisma/seed.ts` without storing secrets (FR-059; plan Security/Events)
- [ ] T010 [P] Define domain ports in `src/modules/authentication/domain/ports/` for password hasher, token service, crypto verifier, SMS delivery, email delivery, and Google OIDC transaction store (plan Layer Responsibilities; FR-058)
- [ ] T011 [P] Implement pure identifier normalization and password policy in `src/modules/authentication/domain/password.policy.ts` (FR-005, FR-007–FR-008)
- [ ] T012 [P] Implement account-category, verification, login-eligibility, session, rate-limit, and recovery-channel policies plus stable errors in `src/modules/authentication/domain/{account-category.policy.ts,verification.policy.ts,login-eligibility.policy.ts,session.policy.ts,rate-limit.policy.ts,authentication.errors.ts,authentication.types.ts}` (FR-001–FR-006, FR-010–FR-015, FR-019–FR-028, FR-031, FR-037–FR-038, FR-045–FR-051)
- [ ] T013 Add unit matrix tests for domain policies (category transitions, worker prohibition, recovery channels, login eligibility, session transitions) in `tests/unit/modules/authentication/` covering FR/SC rows for policies (SC-001–SC-002, SC-019, SC-021)

### 2B — Crypto / JWT / verifier adapters

- [ ] T014 [P] Add failing unit tests for Argon2id hasher and dummy-verify timing posture in `tests/unit/integrations/authentication/argon2-password-hasher.test.ts` (FR-007; research Decision 2)
- [ ] T015 [P] Add failing unit tests for HS256 JWT claim pinning and crypto HMAC verifiers in `tests/unit/integrations/authentication/{jwt-token-service.test.ts,crypto-verifier.test.ts}` (FR-021–FR-025, FR-016, FR-032; research Decisions 3–4)
- [ ] T016 Implement `src/integrations/authentication/argon2-password-hasher.adapter.ts` and record benchmark evidence in `specs/R1-P02-complete-authentication-identity/implementation-summary.md` without lowering the approved baseline (FR-007; plan Password policies)
- [ ] T017 [P] Implement `src/integrations/authentication/jwt-token-service.adapter.ts` (FR-021, FR-025, FR-029)
- [ ] T018 [P] Implement `src/integrations/authentication/crypto-verifier.adapter.ts` for OTP/reset/refresh/destination HMAC domains (FR-016, FR-022, FR-032, FR-054)
- [ ] T019 [P] Implement deterministic SMS unavailable adapter and authentication email wrapper in `src/integrations/sms/unavailable-sms.adapter.ts` and `src/integrations/email/authentication-email.adapter.ts` for composition and automated tests via the approved SMS/email delivery ports only — no live Egypt SMS vendor, no production credentials, and no SMS network calls (FR-010–FR-013, FR-031; plan Integrations; research Decision 11)
- [ ] T020 [P] Implement in-memory Google transaction store in `src/integrations/authentication/memory-google-transaction-store.adapter.ts` (FR-044; plan Google Sign-In)

### 2C — Prisma schema, migration, SQL review, generate, clean-apply

- [ ] T021 Add failing migration inventory assertions for exact R1-P02 tables/enums and R1-P01 checksum preservation in `tests/integration/migration-r1-p02.test.ts` (FR-056–FR-057, FR-065; SC-015)
- [ ] T022 Extend `prisma/schema.prisma` with only approved R1-P02 enums and models `User`, `UserCredential`, `UserSession`, `OtpCode`, `PasswordResetToken`, `SocialAccount`, `AuthEvent` per `data-model.md` (FR-056–FR-057, FR-064)
- [ ] T023 Create phase migration `prisma/migrations/r1_p02_complete_authentication/migration.sql` via Prisma migrate create-only named **`r1_p02_complete_authentication`** against an isolated non-production database (FR-065; SC-015)
- [ ] T024 Review generated SQL in `prisma/migrations/r1_p02_complete_authentication/migration.sql`; add/confirm checks and partial unique indexes Prisma cannot express; reject destructive SQL, cascade deletes, R1-P01 mutation, and unapproved tables; record review in `specs/R1-P02-complete-authentication-identity/implementation-summary.md` (FR-065; plan Prisma and Migration Plan)
- [ ] T025 Run `npm run prisma:validate` and `npm run prisma:generate` updating `src/generated/prisma/**` only after SQL review (FR-065)
- [ ] T026 Extend clean-migration / CI DB validators in `scripts/validate-clean-migration.ts` and `scripts/ci-db-validate.ts` to expect both migrations and exactly twelve product tables plus `_prisma_migrations`, preserving empty-target and `CI_DATABASE_URL` safety (FR-065; SC-015)
- [ ] T027 Apply and prove clean history when `CI_DATABASE_URL` is available (or record skipped-unavailable) including both migration rows, exact inventory, R1-P01 checksum compatibility, and double-seed idempotence; evidence in `specs/R1-P02-complete-authentication-identity/implementation-summary.md` (SC-015)

### 2D — Repositories, mapper, composition

- [ ] T028 [P] Add failing unit/integration tests for bound Prisma client identity and repository conditional mutations in `tests/unit/modules/authentication/` and `tests/integration/authentication/repositories.test.ts` (FR-058, FR-063)
- [ ] T029 Implement authentication mapper in `src/modules/authentication/infrastructure/authentication.mapper.ts` (FR-058)
- [ ] T030 [P] Implement `src/modules/authentication/infrastructure/user.repository.ts` (FR-001, FR-005–FR-006, FR-056)
- [ ] T031 [P] Implement `src/modules/authentication/infrastructure/credential.repository.ts` (FR-007, FR-046, FR-056)
- [ ] T032 [P] Implement `src/modules/authentication/infrastructure/session.repository.ts` with compare-and-swap rotation and family revocation (FR-022–FR-026, FR-056)
- [ ] T033 [P] Implement `src/modules/authentication/infrastructure/otp.repository.ts` (FR-015–FR-017, FR-056, FR-064)
- [ ] T034 [P] Implement `src/modules/authentication/infrastructure/password-reset.repository.ts` (FR-032–FR-033, FR-056, FR-064)
- [ ] T035 [P] Implement `src/modules/authentication/infrastructure/social-account.repository.ts` (FR-037–FR-043, FR-056)
- [ ] T036 [P] Implement append-only `src/modules/authentication/infrastructure/auth-event.repository.ts` with fail-closed write semantics (FR-053–FR-055, FR-056)
- [ ] T037 Implement HTTP Zod schemas, cookies, origin guard, and access middleware stubs in `src/modules/authentication/http/{authentication.schemas.ts,authentication.cookies.ts,authentication-origin.ts,authentication.middleware.ts}` (FR-029–FR-030, FR-061; contracts/authentication-api.md)
- [ ] T038 Implement `createAuthenticationModule` public exports only in `src/modules/authentication/index.ts` per `contracts/authentication-module.md` (FR-058)
- [ ] T039 Wire capability-gated authentication composition through `src/server.ts`, `src/app.ts`, and `src/routes/register-modules.ts` using the shared `PrismaLifecycle` bind order and process-wide rate limiter (FR-063; plan Module Boundary)
- [ ] T040 Extend nested secret redaction fixtures for auth secrets in `tests/integration/logging.test.ts` and harden `src/integrations/logging/pino-logger.ts` only if gaps appear (FR-054; SC-013)

**Checkpoint**: Schema + migration ready; domain/adapters/repos/composition ready; user-story journeys may proceed.

---

## Phase 3: User Story 1 Slice A — Individual Signup & SMS Verification (Priority: P1) 🎯 MVP core

**Goal**: Individual self-signup with blocking SMS phone OTP; optional non-blocking email; no roles/profiles (US1; FR-001–FR-003, FR-009–FR-011, FR-015–FR-018).

**Independent Test**: Signup with phone/password → SMS verify → pending→verified; worker rejected; enumeration-safe collisions (SC-001, SC-003, SC-004, SC-018).

### Tests

- [ ] T041 [P] [US1] Add unit tests for individual signup/OTP domain flows in `tests/unit/modules/authentication/signup-individual.test.ts` (FR-010–FR-011, FR-015–FR-017; SC-001, SC-004)
- [ ] T042 [P] [US1] Add integration tests for individual signup, OTP request/verify, resend supersession, and attempt exhaustion in `tests/integration/authentication/individual-signup-otp.test.ts` (FR-010, FR-015–FR-018; SC-001, SC-004)
- [ ] T043 [US1] Add E2E smoke for individual signup → SMS verify in `tests/e2e/authentication/individual-signup-verify.test.ts` (SC-016)
- [ ] T102 [US1] Add focused FR-011 acceptance coverage in `tests/integration/authentication/individual-optional-email.test.ts`: signup an individual with optional email; complete required phone OTP only; assert the identity can authenticate and reach permitted authenticated behavior (for example `POST /login` then `GET /me`) while email remains unverified; then complete email OTP and assert email verification state updates correctly; assert phone verification remains mandatory (unverified phone cannot unlock that access) and do not treat email OTP as a gate for individual activation (FR-011; SC-001; depends on T044–T046, T058, T061)

### Implementation

- [ ] T044 [US1] Implement `src/modules/authentication/application/signup.ts` for individual category only first (FR-001–FR-003, FR-005–FR-010, FR-052)
- [ ] T045 [US1] Implement `src/modules/authentication/application/request-verification.ts` and `src/modules/authentication/application/verify-code.ts` for blocking SMS phone OTP (FR-010, FR-015–FR-018)
- [ ] T046 [US1] Implement HTTP routes/controllers for `POST /signup`, `POST /otp/request`, `POST /otp/verify` in `src/modules/authentication/http/{authentication.routes.ts,authentication.controller.ts}` with Easy-English JSDoc (FR-061; contracts/authentication-api.md)
- [ ] T047 [US1] Confirm worker self-signup is rejected before persistence in `src/modules/authentication/application/signup.ts` and `src/modules/authentication/http/authentication.schemas.ts` (FR-003; SC-002)

**Checkpoint**: Individual SMS verification journey independently demonstrable; optional email non-blocking proven (T102).

---

## Phase 4: User Story 1 Slice B — Company / Engineer / Provider-Owner Signup & Email Activation + Category Enrollment (Priority: P1)

**Goal**: Blocking email OTP for company/engineer/provider-owner; authenticated multi-category enrollment without duplicate identity/roles/profiles (US1; FR-012–FR-013, FR-002, FR-006, FR-009; SC-001, SC-018, SC-021).

**Independent Test**: Each non-individual signup → email verify → active category; authenticated enrollment adds pending category only (SC-001, SC-018, SC-021).

### Tests

- [ ] T048 [P] [US1] Add unit tests for company/engineer/provider-owner signup and enrollment policies in `tests/unit/modules/authentication/signup-business-categories.test.ts` (FR-012–FR-013, FR-002; SC-001)
- [ ] T049 [P] [US1] Add integration tests for email OTP activation and authenticated category enrollment in `tests/integration/authentication/business-signup-enrollment.test.ts` (FR-012–FR-013, FR-006, FR-009; SC-018, SC-021)
- [ ] T050 [US1] Extend E2E coverage for company/engineer/provider-owner signup → email verify and multi-category enrollment in `tests/e2e/authentication/business-signup-enrollment.test.ts` (SC-016, SC-018, SC-021)

### Implementation

- [ ] T051 [US1] Extend `src/modules/authentication/application/signup.ts` for company/engineer/provider-owner discriminated signup (FR-012–FR-013, FR-002, FR-009)
- [ ] T052 [US1] Implement `src/modules/authentication/application/enroll-category.ts` for authenticated non-worker enrollment (FR-002, FR-006, FR-009, FR-048–FR-049; SC-018, SC-021)
- [ ] T053 [US1] Add `POST /account-categories` to `src/modules/authentication/http/{authentication.routes.ts,authentication.controller.ts,authentication.schemas.ts}` (contracts/authentication-api.md; FR-061)
- [ ] T054 [US1] Ensure email verification path uses email OTP purpose/channel without requiring SMS for these categories in `src/modules/authentication/application/{request-verification.ts,verify-code.ts}` (FR-012–FR-013, FR-011 optional individual email remains non-blocking)
- [ ] T101 [US1] Add concurrent normalized-identity uniqueness integration coverage in `tests/integration/authentication/signup-concurrency.test.ts`: fire concurrent `POST /signup` attempts with equivalent normalized phone values and, separately, equivalent normalized email values; assert exactly one database write succeeds per race, the loser maps Prisma `P2002` to the approved stable API conflict error (`AUTH_SIGNUP_UNAVAILABLE`), and no duplicate `users` or `user_credentials` rows remain (FR-006; depends on T011, T023–T025, T030, T044, T051, and Prisma `P2002`→conflict mapping in T044/T046)

**Checkpoint**: All supported self-signup verification gates independently proven; worker enrollment still impossible; concurrent uniqueness races covered.

---

## Phase 5: User Story 2 — Sign In & Safe Session Lifecycle (Priority: P1)

**Goal**: Phone/password login, access JWT + refresh cookie rotation, current-user, logout, logout-all, reuse detection (US2; FR-019–FR-030; SC-005–SC-008, SC-014, SC-021).

**Independent Test**: Login → `/me` → refresh rotation → replay revoke → logout/logout-all (SC-005–SC-008).

### Tests

- [ ] T055 [P] [US2] Add unit tests for login eligibility, refresh rotation/reuse, and cookie/origin helpers in `tests/unit/modules/authentication/{login-session.test.ts,cookies-origin.test.ts}` (FR-019–FR-026, FR-029–FR-030; SC-005–SC-006)
- [ ] T056 [P] [US2] Add integration tests for login, refresh compare-and-swap, reuse family revocation, logout, logout-all, and `/me` shape in `tests/integration/authentication/login-session.test.ts` (FR-019–FR-028; SC-005–SC-008, SC-014)
- [ ] T057 [US2] Add E2E journey login → refresh → logout in `tests/e2e/authentication/login-session.test.ts` (SC-016, SC-014)

### Implementation

- [ ] T058 [US2] Implement `src/modules/authentication/application/login.ts` for phone/password including verification-only sessions (FR-019–FR-021, FR-048–FR-049; SC-021)
- [ ] T059 [US2] Implement `src/modules/authentication/application/refresh-session.ts` with mandatory auth-event write and family reuse revocation (FR-023–FR-025, FR-053–FR-055; SC-005–SC-006)
- [ ] T060 [US2] Implement `src/modules/authentication/application/{logout.ts,logout-all.ts,current-user.ts}` (FR-026–FR-028; SC-007–SC-008)
- [ ] T061 [US2] Complete HTTP routes for `POST /login`, `POST /refresh`, `POST /logout`, `POST /logout-all`, `GET /me` in `src/modules/authentication/http/{authentication.routes.ts,authentication.controller.ts}` with cookie/origin/`Cache-Control: no-store` behavior (FR-029–FR-030, FR-061; contracts/authentication-api.md)
- [ ] T062 [US2] Finalize `authenticateAccess` middleware enforcement of session/user status/credential version in `src/modules/authentication/http/authentication.middleware.ts` (FR-025, FR-028, FR-050–FR-051)
- [ ] T100 [US2] Add deterministic local latency evidence for SC-014 in `tests/integration/authentication/session-latency.test.ts`: using an in-process verified-user fixture and fakes (no external SMS, email, Google, or network services), measure wall-clock durations for `POST /login`, `POST /refresh`, `POST /logout`, and `GET /me` across a fixed sample of **25 iterations per operation (100 samples total)**; assert that **at least 95%** of measured samples complete within **2000ms**; do not assert a single-request SLA; record the sample size, percentile/pass counts, and machine context in `specs/R1-P02-complete-authentication-identity/implementation-summary.md` (SC-014; depends on T061–T062)

**Checkpoint**: Session lifecycle independently demonstrable without Google/recovery; SC-014 latency evidence recorded.

---

## Phase 6: User Story 5 — Worker Login Without Self-Signup (Priority: P2)

**Goal**: Pre-provisioned worker phone/password login only; every public signup/enrollment path rejects worker (US5; FR-003–FR-004; SC-002).

**Independent Test**: Fixture worker logs in; missing worker generic failure; signup worker rejected (SC-002).

### Tests

- [ ] T063 [P] [US5] Add unit tests for worker prohibition and login eligibility in `tests/unit/modules/authentication/worker-login.test.ts` (FR-003–FR-004; SC-002)
- [ ] T064 [US5] Add integration tests using controlled worker fixtures (no public creation API) in `tests/integration/authentication/worker-login.test.ts` (FR-004; SC-002, SC-016)

### Implementation

- [ ] T065 [US5] Add controlled worker fixture helper in `tests/helpers/authentication/worker-fixture.ts` for pre-provisioned verified worker rows only (FR-004; plan Assumptions)
- [ ] T066 [US5] Confirm login path supports eligible workers via `src/modules/authentication/application/login.ts` without any worker signup/enrollment route (FR-004, FR-019; SC-002)
- [ ] T067 [US5] Add negative assertions that every public signup/enrollment path rejects worker before persistence in `tests/integration/authentication/worker-signup-rejection.test.ts` (FR-003; SC-002)

**Checkpoint**: Worker login-only boundary proven.

---

## Phase 7: User Story 3 — Password Recovery & Change (Priority: P1)

**Goal**: Category-specific forgot/reset without enumeration; authenticated change-password with session consequences (US3; FR-031–FR-036; SC-003, SC-019–SC-020, SC-022).

**Independent Test**: Forgot parity; SMS vs email channel; reset revokes all/no auto-login; change rotates current and revokes others (SC-019–SC-020, SC-022).

### Tests

- [ ] T068 [P] [US3] Add unit tests for recovery-channel selection and reset/change session policies in `tests/unit/modules/authentication/password-recovery-change.test.ts` (FR-031–FR-036; SC-019–SC-020, SC-022)
- [ ] T069 [P] [US3] Add integration tests for forgot/reset/change atomicity, attempt limits, and enumeration parity in `tests/integration/authentication/password-recovery-change.test.ts` (FR-031–FR-036, FR-052; SC-003, SC-004, SC-019–SC-020, SC-022)
- [ ] T070 [US3] Add E2E recovery and change-password journeys in `tests/e2e/authentication/password-recovery-change.test.ts` (SC-016)

### Implementation

- [ ] T071 [US3] Implement `src/modules/authentication/application/forgot-password.ts` with authoritative channel selection and generic 202 responses (FR-031, FR-052; SC-003, SC-019)
- [ ] T072 [US3] Implement `src/modules/authentication/application/reset-password.ts` with atomic consume/password replace/revoke-all/no-session/event (FR-032–FR-034, FR-055; SC-022)
- [ ] T073 [US3] Implement `src/modules/authentication/application/change-password.ts` with current-password proof, revoke-others, rotate-current, event (FR-035–FR-036; SC-020)
- [ ] T074 [US3] Add HTTP routes `POST /password/forgot`, `POST /password/reset`, `POST /password/change` in `src/modules/authentication/http/{authentication.routes.ts,authentication.controller.ts,authentication.schemas.ts}` (contracts/authentication-api.md; FR-061)

**Checkpoint**: Recovery and change-password independently proven.

---

## Phase 8: User Story 4 — Google Sign-In / Linking for Individuals Only (Priority: P1)

**Goal**: Individual-only Google auth/link/unlink with blocking phone gate; no silent email merge (US4; FR-014, FR-037–FR-044; SC-009–SC-010).

**Independent Test**: New Google individual restricted until phone OTP; link/unlink safety; non-individual rejected (SC-009–SC-010).

### Tests

- [ ] T075 [P] [US4] Add unit tests for Google audience gating, state/nonce/PKCE transaction rules, and unlink safety in `tests/unit/modules/authentication/google-authentication.test.ts` (FR-037–FR-044; SC-009–SC-010)
- [ ] T076 [P] [US4] Add integration tests with deterministic Google adapter for start/callback/link/unlink/phone bind in `tests/integration/authentication/google-authentication.test.ts` (FR-014, FR-037–FR-044; SC-009–SC-010)
- [ ] T077 [US4] Add E2E Google verification-gate journey in `tests/e2e/authentication/google-phone-gate.test.ts` (SC-016, SC-010)

### Implementation

- [ ] T078 [US4] Implement Google OIDC adapter in `src/integrations/google/openid-client-google.adapter.ts` behind module ports (FR-037–FR-044; ADR-0013)
- [ ] T079 [US4] Implement `src/modules/authentication/application/google-authentication.ts` for start/callback/new-individual verification-only session (FR-014, FR-037–FR-039, FR-044; SC-009–SC-010)
- [ ] T080 [US4] Implement `src/modules/authentication/application/social-linking.ts` for link/unlink and remaining recoverable-method rules (FR-040–FR-043; SC-009)
- [ ] T081 [US4] Add HTTP routes `GET /google`, `GET /google/callback`, `POST /google/phone`, `GET /google/link`, `GET /google/link/callback`, `DELETE /social/google` in `src/modules/authentication/http/{authentication.routes.ts,authentication.controller.ts,authentication.schemas.ts}` (contracts/authentication-api.md; FR-061)
- [ ] T082 [US4] Ensure Google never bypasses individual phone verification via `src/modules/authentication/application/{verify-code.ts,login-eligibility}` paths (FR-014; SC-010)

**Checkpoint**: Individual-only Google journeys independently proven.

---

## Phase 9: User Story 6 — Abuse Controls, Ban/Suspension Enforcement & Auth Events (Priority: P1)

**Goal**: Deterministic rate limits/lockouts; suspended/banned denial at login and authenticated requests; mandatory safe auth events; no privileged reinstatement (US6; FR-045–FR-055; SC-011–SC-013, SC-012).

**Independent Test**: Rate-limit/lockout determinism; status denial; redaction/event fail-closed (SC-011–SC-013, SC-012).

### Tests

- [ ] T083 [P] [US6] Add unit tests for rate-limit keys/lockout policy and status denial matrices in `tests/unit/modules/authentication/abuse-status.test.ts` (FR-045–FR-051; SC-011–SC-012)
- [ ] T084 [P] [US6] Add integration/security tests for endpoint rate limits, lockout cooldown, suspended/banned enforcement, and nested secret scans across logs/errors/events/audit in `tests/integration/authentication/abuse-status-security.test.ts` (FR-045–FR-055; SC-011–SC-013)
- [ ] T085 [US6] Add E2E status-enforcement cases (suspended/banned login and protected request denial) in `tests/e2e/authentication/status-enforcement.test.ts` (SC-011, SC-016)

### Implementation

- [ ] T086 [US6] Apply documented auth rate-limit policies on auth routes via `src/modules/authentication/http/authentication.routes.ts` and domain `rate-limit.policy.ts` using the process-wide limiter (FR-045–FR-047; SC-012)
- [ ] T087 [US6] Enforce credential lockout counters/cooldown in `src/modules/authentication/application/login.ts` and `credential.repository.ts` (FR-046–FR-047; SC-012)
- [ ] T088 [US6] Enforce `SUSPENDED`/`BANNED` at login and `authenticateAccess` in `src/modules/authentication/application/login.ts` and `src/modules/authentication/http/authentication.middleware.ts` without implementing reinstatement endpoints (FR-050–FR-051; SC-011)
- [ ] T089 [US6] Complete mandatory `auth_events` writes for security-relevant successes/failures with fail-closed semantics in `src/modules/authentication/application/*.ts` and `src/modules/authentication/infrastructure/auth-event.repository.ts`; use `#modules/admin` `writeAudit` only for selected high-impact mutations (FR-053–FR-055, FR-060; SC-013)
- [ ] T090 [US6] Confirm public responses never disclose account existence, matched identifier, status reasons, or refresh-reuse detail in `src/modules/authentication/http/authentication.controller.ts` (FR-052; SC-003)

**Checkpoint**: Abuse/status/evidence independently proven.

---

## Phase 10: Polish — Documentation, Postman, Scripts & Final Gates

**Purpose**: API docs, Postman, scripts, scope-negative checks, implementation summary, and **one** final validation pass (no duplicate `test:coverage` via also running `npm run ci`).

- [ ] T091 [P] Author OpenAPI for all R1-P02 auth routes/errors/cookies in `docs/apis/openapi/r1-p02-authentication.yaml` and ensure `npm run openapi:validate` covers it (FR-061; SC-016 docs)
- [ ] T092 [P] Reconcile `docs/apis/authentication.md` and index `docs/apis/README.md`; correct stale prepared text under `docs/phases/release-1/R1-P02-authentication/` without activating future phases (FR-061; DEC-015)
- [ ] T093 [P] Expand `postman/R1-P02-authentication.postman_collection.json` and `postman/README.md` for every route plus negative cases; refresh stays cookie-jar only; assert status/envelope/`requestId`/cookies (FR-061; contracts/authentication-api.md)
- [ ] T094 [P] Update `scripts/README.md` for any new auth/migration/validation script usage; keep `CI_DATABASE_URL` empty-target rules (FR-065; quickstart §3)
- [ ] T095 Scope-negative check: confirm no roles/permissions/profiles/worker-management/addresses/wallets/Docker/cloud/deployment/production-migration code under `src/modules/**` and no extra tables in `prisma/schema.prisma`; record in `specs/R1-P02-complete-authentication-identity/implementation-summary.md` (FR-057, FR-066; SC-017)
- [ ] T096 Scope-negative check: foreign modules/tests import only `#modules/authentication` public contract; record in `specs/R1-P02-complete-authentication-identity/implementation-summary.md` (FR-058)
- [ ] T097 Finalize `specs/R1-P02-complete-authentication-identity/implementation-summary.md` with files changed, Argon2 benchmark, migration SQL review, clean-DB evidence or skipped-unavailable note, **T100 SC-014 latency sample evidence**, **T103 Egypt SMS human-owned operations gate**, gate counts, SC mapping, exclusions, and “not Complete / no commit” note (constitution VIII; depends on T100, T103)
- [ ] T098 Verify `docs/product/current.md` remains R1-P02 `In Progress` (not Complete) after implementation tasks (constitution II/VIII)
- [ ] T099 Run final validation **once** per `quickstart.md` §5 (`typecheck`, `lint`, `test:unit`, `test:integration`, `test:e2e`, `test:coverage`, `prisma:validate`, `openapi:validate`, `docs:check`, `build`, `npm audit --audit-level=high`) and record actual results in `specs/R1-P02-complete-authentication-identity/implementation-summary.md` — **do not** also run `npm run ci` in the same pass because it would duplicate `test:coverage` (SC-014–SC-017; quickstart §5)
- [ ] T103 [P] Document in `specs/R1-P02-complete-authentication-identity/implementation-summary.md` that Egypt SMS vendor selection and production credentials are a human-owned operations gate left unresolved in this phase; state that implementation and automated tests use only the approved SMS delivery port with the deterministic unavailable/fake adapter (T019); do not select a vendor, add credentials, or perform SMS network calls (plan Constitution Check; research Decision 11; depends on T019)

**Checkpoint**: R1-P02 delivery evidence complete; human approval still required for Complete/commit/push.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup** → no dependencies
- **Phase 2 Foundational** → depends on Setup; **blocks all user-story slices**
- **Phase 3 US1 Slice A (individual SMS)** → after Foundational (MVP); **T102** after T044–T046 and US2 login/`/me` (T058, T061)
- **Phase 4 US1 Slice B (business email + enrollment)** → after Slice A OTP/signup HTTP baseline (same module files sequential); **T101** after T044, T046, T051 (and T011, T023–T025, T030)
- **Phase 5 US2 sessions** → after Foundational; ideally after at least one verified fixture path from US1; **T100** after T061–T062
- **Phase 6 US5 worker login** → after US2 login path exists
- **Phase 7 US3 recovery/change** → after US2 session revocation primitives exist
- **Phase 8 US4 Google** → after US1 phone OTP + US2 session issuance
- **Phase 9 US6 abuse/status/events** → after login/middleware routes exist; hardens cross-cutting controls
- **Phase 10 Polish** → after desired stories complete (including **T100** SC-014 evidence and **T103** Egypt SMS ops-gate note); **T099 once**

### User Story Dependencies

| Story | Depends on | Notes |
|---|---|---|
| US1 Slice A | Foundational | MVP individual SMS; **T102** FR-011 optional email after T044–T046, T058, T061 |
| US1 Slice B | Slice A signup/OTP HTTP | Same route/controller files — not `[P]` vs Slice A impl; **T101** concurrent uniqueness after T044/T046/T051 |
| US2 | Foundational (+ verified fixture) | Session lifecycle; T100 SC-014 latency after T061–T062 |
| US5 | US2 login | Worker fixture login only |
| US3 | US2 session revoke/rotate | Recovery/change |
| US4 | US1 phone OTP + US2 sessions | Individual Google |
| US6 | US2 middleware/routes | Abuse/status/events |

### Within Each Story

1. Tests first (must fail)
2. Application services
3. HTTP wiring (sequential on shared route/controller/schema files)
4. Easy-English comments/JSDoc where required
5. Checkpoint validation

### Parallel Opportunities

- Setup: T004–T006 after T003
- Foundational: T011–T012 policies parallel after ports; T014–T015 tests parallel; T016–T020 adapters parallel after ports; T030–T036 repositories parallel after mapper/schema; avoid `[P]` on shared `authentication.routes.ts` / `authentication.controller.ts` / `authentication.schemas.ts`
- US1 Slice A tests T041–T042 `[P]`; implementation HTTP tasks sequential on shared files
- US2 tests T055–T056 `[P]`; HTTP completion T061 after application services
- US3/US4/US6 test pairs marked `[P]` only across different files
- Polish docs/Postman tasks T091–T094 `[P]`

---

## Parallel Example: Foundational adapters

```text
T014 argon2 unit tests
T015 jwt + crypto unit tests
# then
T016 argon2 adapter
T017 jwt adapter
T018 crypto verifier adapter
T019 sms/email adapters
T020 google transaction store
```

## Parallel Example: After Foundational — US1 Slice A tests

```text
T041 unit signup-individual.test.ts
T042 integration individual-signup-otp.test.ts
# then sequential implementation T044 → T047
```

---

## Implementation Strategy

### MVP First (US1 Slice A + Foundational)

1. Phase 1 Setup  
2. Phase 2 Foundational (env, domain, adapters, Prisma migration, repos, composition)  
3. Phase 3 Individual SMS signup/verify  
4. **STOP and validate** independent SMS journey  

### Incremental Delivery

1. US1 Slice B business email + enrollment  
2. US2 login/session lifecycle (+ US5 worker login)  
3. US3 recovery/change  
4. US4 Google individual-only  
5. US6 abuse/status/events hardening  
6. Polish docs/Postman/scripts + **one** final gate pass (T099)

### Suggested MVP Scope

**Foundational + US1 Slice A (individual SMS)** — proves identity creation and blocking verification before session/Google depth.

---

## Traceability (story → FR/SC)

| Story / slice | Primary FR | Primary SC |
|---|---|---|
| Foundational | FR-005–FR-008, FR-016, FR-022, FR-029–FR-030, FR-056–FR-066 | SC-013, SC-015, SC-017 |
| US1 Slice A | FR-001–FR-003, FR-009–FR-011 (via **T102**), FR-015–FR-018 | SC-001–SC-004, SC-016 |
| US1 Slice B | FR-002, FR-006 (via **T101**), FR-009, FR-012–FR-013 | SC-001, SC-018, SC-021 |
| US2 | FR-019–FR-030 | SC-005–SC-008, SC-014 (via **T100**), SC-021 |
| US5 | FR-003–FR-004, FR-019 | SC-002 |
| US3 | FR-031–FR-036 | SC-003, SC-019–SC-020, SC-022 |
| US4 | FR-014, FR-037–FR-044 | SC-009–SC-010 |
| US6 | FR-045–FR-055 | SC-011–SC-013, SC-012 |
| Polish T099 | FR-061, FR-065–FR-066 | SC-015–SC-017 (SC-014 evidence owned by T100; Egypt SMS ops gate owned by T103) |

---

## Notes

- Inspect existing R1-P01 files before replacement; prefer converge-over-rewrite for `src/app.ts`, `src/server.ts`, envelopes, logging, rate-limit, and Prisma lifecycle.
- Preserve applied R1-P01 migration immutability; forward-only fixes if needed.
- Same-file tasks are sequential (no `[P]`).
- Do not commit, push, deploy, run production migration, or mark phase Complete in these tasks.
- Do not implement roles, permissions, profiles, wallets, Docker, cloud, or future-phase tables.
- Final validation (T099) runs coverage once via `npm run test:coverage` and must not also invoke `npm run ci` in the same pass.
- Format validation: every task uses `- [ ] T### ...` with file paths; story tasks include `[USn]`; IDs `T001`–`T103` unique (T100 = SC-014 latency; T101 = FR-006 concurrent uniqueness; T102 = FR-011 optional individual email; T103 = Egypt SMS human-owned ops gate).
