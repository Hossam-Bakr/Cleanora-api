# Implementation Plan: Complete Authentication & Identity

**Branch**: `R1-P02-complete-authentication-identity`  
**Date**: 2026-07-24  
**Spec**: [spec.md](spec.md)  
**Status**: Planning complete; implementation not started

## Summary

R1-P02 adds one authentication module to the existing Cleanora modular monolith. It supports the approved signup, verification, phone/password login, Google individual-only authentication, recovery, session, abuse-control, and status-enforcement journeys while preserving the R1-P01 composition and database lifecycle.

The design uses one user identity with independently enrolled and verified account-category arrays; Argon2id passwords; short-lived HS256 access JWTs; one stable server-side row per rotating refresh-token family; HMAC-only OTP, reset, and refresh verifiers; mandatory append-only auth events; and provider ports with deterministic test adapters. R1-P02 owns one additive migration, `r1_p02_complete_authentication`, containing exactly seven authentication tables.

## Technical Context

**Language/Version**: Node.js 24+, TypeScript `^6.0.3`, CommonJS package runtime  
**Primary Dependencies**: Express 5, Zod 4, Prisma 7/PostgreSQL, Pino, rate-limiter-flexible; planned phase-only additions are ADR-0013's `argon2`, `jsonwebtoken`, and a CommonJS-compatible `openid-client`, plus ADR-0007's `nodemailer` transport behind the existing email port  
**Storage**: One PostgreSQL database and one centralized Prisma schema/client  
**Testing**: Vitest 4, Supertest 7, deterministic provider fakes, and an explicit isolated PostgreSQL test database; no Docker or Testcontainers  
**Target Platform**: Linux-compatible Node.js API process with the repository's current local/CI support  
**Project Type**: Single deployable backend modular monolith  
**Performance Goals**: At least 95% of valid login, refresh, logout, and current-user requests finish within two seconds, excluding external delivery  
**Constraints**: No raw passwords/OTPs/reset/refresh values in persistence, events, errors, or logs; immediate status/session enforcement; no enumeration; no roles/profiles/worker creation; one Prisma lifecycle; no production migration or deployment  
**Scale/Scope**: One authentication module, seven new tables, approved self-service actor journeys, worker login only, and one enabled social audience (`INDIVIDUAL`)

## Canonical Decisions

- Login is phone/password only. The older preparation note mentioning email login is superseded by the approved specification.
- Google authentication is enabled only for `INDIVIDUAL` in Release 1 and never satisfies phone verification.
- One authenticated identity may enroll another approved self-signup category; worker enrollment remains prohibited.
- Existing verified categories remain usable when another category is pending.
- Individual/worker recovery is SMS; company/engineer/provider-owner recovery is verified email, with no silent fallback.
- Password reset revokes all sessions and creates no session.
- Password change revokes other sessions and rotates the current family.

## Constitution Check

### Pre-design gate

| Principle | Result | Evidence |
|---|---|---|
| I. Standalone greenfield | PASS | All dependencies, providers, schema, migration history, and docs are repository-local or explicit external ports. |
| II. One active phase/traceability | PASS | `docs/product/current.md` names only R1-P02 In Progress; this plan derives from its approved spec. |
| III. Modular-monolith ownership | PASS | Authentication owns workflows/repositories; only a narrow `index.ts` is public; Prisma never crosses it. |
| IV. Global design/local migration | PASS | Only the seven R1-P02 models are planned. |
| V. Canonical product truth | PASS | DEC-015 and all five clarification answers are preserved; stale preparation metadata is not authority. |
| VI. Backend integrity/security | PASS | Server-side state checks, atomic transitions, token rotation/reuse, redaction, and mandatory evidence are designed. |
| VII. Risk-proportional testing | PASS | Unit, integration, E2E, database, security, replay, and concurrency evidence are specified. |
| VIII. Human-controlled operations | PASS | No install, migration, apply, commit, push, deployment, credential, or production action occurs in planning. |
| IX. Locked boundaries | PASS | No Docker/cloud/wallet/payment/future product behavior is planned. |
| X. Immutable migrations | PASS | R1-P01 remains byte-unchanged; R1-P02 owns one reviewed additive migration and later corrections are forward-only. |

### Post-design gate

PASS with no constitutional exception. The unresolved Egypt SMS vendor/credentials, Argon2 benchmark result, and final CommonJS-compatible `openid-client` version are explicit implementation/operations gates; none is silently invented.

## Project Structure

### Documentation

```text
specs/R1-P02-complete-authentication-identity/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── authentication-api.md
│   └── authentication-module.md
└── checklists/
    └── requirements.md
```

`tasks.md` is intentionally not created by this planning workflow.

### Source Code

```text
src/modules/authentication/
├── domain/
│   ├── authentication.types.ts
│   ├── account-category.policy.ts
│   ├── verification.policy.ts
│   ├── login-eligibility.policy.ts
│   ├── password.policy.ts
│   ├── session.policy.ts
│   ├── rate-limit.policy.ts
│   ├── authentication.errors.ts
│   └── ports/
├── application/
│   ├── signup.ts
│   ├── enroll-category.ts
│   ├── request-verification.ts
│   ├── verify-code.ts
│   ├── login.ts
│   ├── refresh-session.ts
│   ├── logout.ts
│   ├── logout-all.ts
│   ├── current-user.ts
│   ├── forgot-password.ts
│   ├── reset-password.ts
│   ├── change-password.ts
│   ├── google-authentication.ts
│   └── social-linking.ts
├── http/
│   ├── authentication.routes.ts
│   ├── authentication.controller.ts
│   ├── authentication.schemas.ts
│   ├── authentication.middleware.ts
│   ├── authentication.cookies.ts
│   └── authentication-origin.ts
├── infrastructure/
│   ├── user.repository.ts
│   ├── credential.repository.ts
│   ├── session.repository.ts
│   ├── otp.repository.ts
│   ├── password-reset.repository.ts
│   ├── social-account.repository.ts
│   ├── auth-event.repository.ts
│   └── authentication.mapper.ts
└── index.ts

src/integrations/
├── authentication/
│   ├── argon2-password-hasher.adapter.ts
│   ├── jwt-token-service.adapter.ts
│   ├── crypto-verifier.adapter.ts
│   └── memory-google-transaction-store.adapter.ts
├── google/openid-client-google.adapter.ts
├── sms/unavailable-sms.adapter.ts
└── email/authentication-email.adapter.ts

prisma/migrations/
├── r1_p01_foundation_country_configuration/
└── r1_p02_complete_authentication/

tests/
├── helpers/authentication/
├── unit/modules/authentication/
├── unit/integrations/authentication/
├── integration/authentication/
├── integration/migration-r1-p02.test.ts
└── e2e/authentication/
```

**Structure decision**: Authentication uses the approved deeper module layout because it owns several security-critical workflows and repositories. External package/provider details remain in integrations. Business-neutral HTTP, logging, rate-limit, request-ID, configuration, audit, and database foundations are reused, not copied.

## Module Boundary and Public API

`src/modules/authentication/index.ts` exports only:

- `createAuthenticationModule(dependencies)`;
- the returned `moduleRegistrar`;
- access-authentication middleware/guard;
- safe `AuthenticationPrincipal`, `AuthenticatedIdentity`, `AccountCategory`, `UserStatus`, and category-verification contracts.

It must not export controllers, repositories, Prisma/generated types, provider claims, raw sessions, credentials, token services, or internal schemas.

The composition root validates capability-dependent environment values, connects and binds one `PrismaLifecycle`, constructs one process-wide rate limiter and approved adapters, creates authentication after binding, passes its registrar to `createApp`, and uses that same lifecycle for probes and shutdown. Repositories call the controlled accessor and fail explicitly before binding. Tests bind an explicit test lifecycle and reset it only under `NODE_ENV=test`.

## Layer Responsibilities

### Domain

Pure policies define normalization, account-category transitions, verification eligibility, login capability, password rules, session transitions, recovery-channel selection, rate-limit keys, and stable errors. They have no Express, Prisma, Pino, provider, or environment imports.

### Application

Use cases orchestrate proof checks, transactions, repositories, providers, events, audit, and safe outcomes. The application service owns transaction and lock order. It never calls an external provider inside an open transaction.

### HTTP

Zod schemas validate and normalize external input. Controllers translate only validated input, request ID, trusted origin/IP context, cookies, and application results into existing envelopes. Cookie helpers set and clear identical attributes. Middleware attaches only the safe principal.

Every route handler uses:

```ts
/**
 * @desc         ...
 * @route        POST /api/v1/auth/...
 * @access       Public or Private
 * @explanation  Easy-English explanation
 */
```

Meaningful code sections receive short Easy-English comments. Runtime package loading follows the current CommonJS `const`/`require` style; the repository is not converted to ESM.

### Persistence

Seven repositories map domain records to the seven approved tables. Prisma and interactive transaction clients remain module-private. Repositories expose conditional mutation operations, not generic CRUD, for challenge consumption, session compare-and-swap, family revocation, and category transitions.

### Integrations

Adapters isolate Argon2id, jsonwebtoken, Node crypto, Google OIDC, Nodemailer, SMS delivery, and Google transaction state. Provider payloads/errors map to safe internal categories and never escape module contracts.

## State Machines

### Account category

```text
NOT_ENROLLED
  └─ approved signup or authenticated enrollment ─> PENDING_VERIFICATION
       ├─ correct unexpired latest code ─> VERIFIED
       ├─ resend ─> PENDING_VERIFICATION (old challenge superseded)
       └─ failed/expired challenge ─> PENDING_VERIFICATION
```

`WORKER` cannot enter through signup/enrollment. A controlled provider-owned precondition supplies a verified worker fixture; worker creation stays out of scope.

### Actor verification

| Category | Required at creation | Blocking gate | Optional/non-blocking |
|---|---|---|---|
| Individual | Phone, password | Six-digit SMS phone OTP | Email verification |
| Company | Phone, email, password | Email OTP | None |
| Engineer | Phone, email, password | Email OTP | None |
| Provider owner | Phone, email, password | Email OTP | None |
| Worker | Pre-provisioned phone/password | Precondition outside public R1-P02 APIs | None |
| Google individual | Verified Google subject; phone may initially be absent | Bind unique phone and complete SMS OTP | Provider email does not replace phone gate |

### Login eligibility

| State | Result |
|---|---|
| `ACTIVE` with one or more verified categories | Full session; only verified categories usable |
| `ACTIVE` with verified and pending categories | Full session; pending categories remain unavailable |
| `ACTIVE` with no verified category | Verification-only session |
| Pre-provisioned verified worker | Full phone/password session |
| Missing identity/worker/credential or wrong password | Generic login failure |
| `SUSPENDED` or `BANNED` | Generic login denial; reject/revoke sessions at request authentication |
| Linked Google individual with verified phone | Full Google session |
| New/linked Google individual with unverified phone | Verification-only Google session |
| Non-individual Google audience | Reject before provider interaction |

R1-P02 implements no status-changing endpoint. It only reads and enforces `SUSPENDED` and `BANNED` at login and every authenticated request.

### OTP/reset challenge

```text
PENDING_DELIVERY ─delivery success─> ACTIVE ─correct proof─> CONSUMED
       │                                  ├wrong max attempt─> EXHAUSTED
       ├delivery failure─> DELIVERY_FAILED├resend─> SUPERSEDED
       └resend───────────> SUPERSEDED     └expiry─> unusable (derived)
```

### Session family

```text
ACTIVE generation N
  ├─ valid refresh compare-and-swap ─> ACTIVE generation N+1
  ├─ old valid signed refresh ─> REVOKED/COMPROMISED family
  ├─ logout/logout-all/reset/status ─> REVOKED
  └─ absolute expiry ─> unusable (derived)
```

## Google Sign-In and Linking

- Use authorization-code OIDC with PKCE S256, state, nonce, issuer/audience/signature/expiry checks, and one-time correlation.
- Provider subject is authoritative; verified email never auto-links.
- Start/link creates a 10-minute one-time transaction and correlation cookie; callback atomically consumes both.
- A new Google individual receives a verification-only session and uses `POST /google/phone` once to bind a unique phone before SMS verification.
- Linking requires a recent full individual session and state bound to that user.
- Unlinking requires recent authentication and a remaining password/recovery method; revoke Google-origin families.
- Non-individual audiences fail before provider interaction.

## Password, Session, OTP, and Rate Policies

- Argon2id baseline: 64 MiB, three iterations, one lane, 32-byte output; benchmark and record target latency before finalizing.
- Password length: 12–128 characters with bounded encoded bytes.
- Access JWT: HS256, 900-second default, pinned issuer/audience/type/version/`sub`/`sid`/UUID `jti`.
- Refresh family: 30-day default fixed absolute expiry; rotate on every refresh; no grace window.
- OTP: six digits, 10-minute TTL, five attempts, 60-second resend cooldown, three sends/15 minutes and five/24 hours per scope.
- Reset: 256-bit secret, 30-minute TTL, five attempts, single-use.
- Login lockout: five failures in 15 minutes, then 15-minute lock; success resets.
- Endpoint limits and HMAC-normalized subject rules are fixed in `research.md` and injected as typed policy values.

## Security, Events, and Redaction

- Add `AUTH_ENABLED` and capability flags to environment validation.
- Require independent access, refresh, verifier, and privacy-hash secrets only when authentication is enabled; require Google/provider fields only for enabled capabilities.
- Validate before database connection or listening; `AUTH_ENABLED=false` preserves R1-P01 startup.
- Refresh cookies are `HttpOnly`, production `Secure`, default `SameSite=Lax`, no `Domain`, path `/api/v1/auth`, and fixed-family bounded max age. Cookie-state routes enforce trusted Origin.
- Extend Pino tests for nested passwords, OTPs, JWTs, refresh/reset values, cookies, provider credentials, emails, and phones.
- Write mandatory `auth_events` in the same transaction as critical state. Event failure aborts the mutation.
- Use the existing audit public API for deliberate high-impact identity mutation attempts; never expose Prisma for cross-module atomicity.

## API, Errors, and Documentation

The exact route/transport/error matrix is in [contracts/authentication-api.md](contracts/authentication-api.md). The public module boundary is in [contracts/authentication-module.md](contracts/authentication-module.md).

All responses reuse the stable envelope and request ID. Refresh values never appear in JSON. Public flows do not expose account existence, matched identifier, ban/suspension reason, provider collision, or refresh-reuse detail.

Implementation documentation must create and validate `docs/apis/openapi/r1-p02-authentication.yaml`; reconcile `docs/apis/authentication.md` and stale prepared R1-P02 docs; expand the Postman collection for every route and negative case; assert status/envelope/request-ID/cookies; keep access/OTP/reset values secret; and leave refresh tokens solely in Postman's cookie jar.

## Prisma and Migration Plan

The exact schema is in [data-model.md](data-model.md).

1. Record and preserve the R1-P01 migration checksum byte-for-byte.
2. Add only the approved enums/models to `prisma/schema.prisma`.
3. Generate `r1_p02_complete_authentication` with `migrate dev --create-only` against an explicit isolated non-production development database.
4. Review SQL before apply; add/review checks and partial unique indexes Prisma cannot express.
5. Reject destructive SQL, cascade deletes, P01-table mutation, and unapproved tables.
6. Validate schema and regenerate Prisma Client only after SQL review.
7. Extend clean validation to expect both migrations and exactly twelve product tables total.
8. Apply the complete history only to an empty safe `CI_DATABASE_URL`.
9. Prove both history rows, exact inventory, constraints, concurrency, seed idempotence, and R1-P01 compatibility.

R1-P02 may seed typed non-secret policy values through the existing configuration foundation; it does not change R1-P01 configuration table structure or store secrets there. Applied migrations remain immutable; fixes use a new forward migration.

## Test Strategy

### Unit

- normalization and discriminated signup schemas;
- every category transition/login matrix row and worker prohibition;
- password policy, dummy verification, Argon2 adapter;
- JWT claims/algorithm/type/expiry validation;
- OTP/reset boundary, expiry, supersession, and consumption;
- session rotation/reuse/revocation;
- recovery channel/no fallback;
- Google audience/link/unlink/state;
- rate limits/lockout/cookies/origin and safe errors;
- log/event/audit redaction.

### Integration

- all seven repositories and shared Prisma client identity;
- concurrent normalized phone/email uniqueness;
- atomic signup/category/challenge workflows;
- provider delivery state and late delivery;
- exactly one refresh successor and family replay revocation;
- logout/logout-all/status-flip enforcement;
- reset/change atomicity and session results;
- deterministic Google adapter contract;
- mandatory event failure rollback;
- envelope/request-ID/no-store/cookie/origin/enumeration parity.

### E2E

- individual signup → SMS verify → login → refresh → logout;
- company, engineer, provider-owner signup → email verify → login;
- multi-category enrollment preserving verified access;
- pre-provisioned worker login and every worker-creation rejection;
- category-specific forgot/reset with no auto-login;
- password change rotating current and revoking others;
- Google new/link/unlink with blocking phone gate;
- suspended/banned denial at login and protected requests.

### Security and database

- JWT confusion, wrong type, forged/expired/mismatched claims;
- refresh double-submit, replay, fixed expiry;
- OTP/reset replay, exact exhaustion, resend, races;
- Google state/nonce/PKCE tampering, replay, substitution, email collision;
- enumeration parity and bounded timing;
- nested secret scans across logs/errors/responses/events/audit;
- clean R1-P01 → R1-P02 migration, exact schema, double seed, P01 checksum, and forward-fix discipline.

Coverage keeps the current thresholds (80% statements/lines/functions, 75% branches), but acceptance/security evidence is mandatory independently of coverage.

## Implementation Sequence

1. Extend safe environment/capability validation and typed non-secret policy configuration.
2. Run dependency compatibility spikes and lock only approved auth libraries; benchmark Argon2id.
3. Implement pure policies/ports with focused unit tests.
4. Add and review Prisma schema/migration before apply.
5. Implement repositories/transactions with database tests.
6. Implement crypto/provider adapters and deterministic fakes.
7. Implement signup/verification/category enrollment.
8. Implement login/access/refresh/logout/logout-all.
9. Implement recovery/change-password and session consequences.
10. Implement Google individual-only start/callback/link/unlink/phone gate.
11. Register through composition with the shared lifecycle and process-wide limiter.
12. Complete OpenAPI, Postman, docs, security tests, clean migration proof, and full gates once.

## Complexity Tracking

No constitutional violation requires an exception. The deeper module layout is the approved pattern for multiple workflows/repositories. Process-memory limiter and Google-state adapters are explicit single-process boundaries, not hidden distributed guarantees.

## Out of Scope

- Roles, permissions, profiles, provider/team/worker management, worker signup, addresses, wallets, payments, Docker, cloud, deployment, production migration, or later-phase models.
- Ban/suspension administration or reinstatement.
- Redis, a distributed limiter, shared OIDC state, or multi-process deployment design.
- Selecting/provisioning production SMS credentials without human approval.
- Commit, push, merge, or phase completion.
