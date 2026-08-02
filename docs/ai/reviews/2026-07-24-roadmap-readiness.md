# Cleanora Roadmap and Implementation Readiness Review

> Historical snapshot from 2026-07-24. Its Pino and E2E observations describe
> the repository at review time and were superseded by R1-P02A. Current
> architecture and testing rules live under `docs/architecture/` and
> `docs/standards/`.

| Field | Value |
|---|---|
| Date | 2026-07-24 |
| Review scope | Vision, decisions, open questions, Release 1 roadmap, foundation code, R1-P02 preparation |
| Current pointer | R1-P00 — Product & Database Architecture |
| Current status | Not Started |
| Decision | No-Go for R1-P02 implementation |
| Authorized next work | Complete and approve R1-P00 |

## Evidence reviewed

- Canonical product vision, decision log, open questions, roadmap, and pointer
- Release and modular-monolith architecture rules
- Current Prisma schema and migration state
- Root composition, environment, logging, API response, scripts, tests, and
  Postman preparation

## Foundation results

- Root `src/app.ts` and `src/server.ts` exist.
- Requested source folders exist with explicit ownership.
- Pino and pino-http are integrated with request IDs and secret redaction.
- API success and failure envelopes are implemented and documented.
- CORS, Helmet, cookie parsing, API prefix, JWT/cookie environment validation,
  and safe system health APIs are configured.
- Vitest/Supertest unit, integration, and e2e structure is active.
- Prisma CLI/client/adapter versions are aligned.
- npm dependency audit reports zero known vulnerabilities.
- Typecheck, build, Prisma generate/validate, tests, and coverage pass.

These results are foundation evidence only. They do not complete R1-P00 or R1-P01.

## Blocking project-state gaps

### P0 — R1-P00 is not complete

The live pointer still marks R1-P00 `Not Started`. Required artifacts are absent:

- Master ERD
- Database conventions
- Entity-to-release/phase ownership map
- Status-machine draft
- Approved P00 phase specification, plan, tasks, checklist, and handoff

No product table or migration should begin before this gate is approved.

### P0 — R1-P01 is not active or complete

The current scaffold covers part of R1-P01, but the roadmap also requires:

- Country/currency/config/audit foundation models
- Phase-owned migration and Egypt seed
- OpenAPI foundation
- Active Redis-backed rate limiter when approved by P01 tasks
- Static lint/boundary enforcement
- CI checks
- Isolated PostgreSQL integration database workflow
- P01 phase artifacts and Definition of Done

### P0 — Local and repository inputs are incomplete

- `.env` intentionally has blank database and JWT secrets awaiting the owner.
- Git metadata in this workspace is incomplete; `git status` reports that the
  directory is not a Git repository.
- SMS provider and production credentials are not approved.

## Confirmed roadmap sequencing conflicts

### 1. Worker login is scheduled before worker creation

R1-P02 requires complete worker login and says workers must be provider-created.
Provider-controlled worker creation and worker tables are owned by R1-P07.

Required owner decision:

- Move worker login completion/tests to R1-P07; or
- Pull the minimal worker identity/membership relation into R1-P02 and record
  the ownership change.

Recommended: implement shared credential verification in R1-P02 and complete
provider-created worker activation/login in R1-P07.

### 2. OTP authentication depends on a later notification phase

R1-P02 requires blocking SMS/email OTP, but notification templates, delivery
attempts, retry, and provider adapters are assigned to R1-P23.

Required plan correction:

- Pull a minimal notification delivery/template foundation into R1-P01; and
- Let R1-P02 own auth-specific OTP templates and delivery use cases; and
- Let R1-P23 extend the same tables/contracts into admin editing, inbox,
  preferences, and cross-domain operations.

Do not create a temporary second notification stack.

### 3. Actor-aware authentication precedes roles

R1-P02 has different verification rules for customers, provider owners, and
workers. The complete role/user-role model is owned by R1-P03.

Required plan correction:

- Define a minimal registration/account-kind contract in R1-P02 that does not
  duplicate authorization; and
- Create full roles, permissions, and user-role assignment in R1-P03; or
- Pull the minimal role and user-role foundation into R1-P02, with R1-P03
  extending permissions and audit.

Recommended: create minimal role assignment in R1-P02 and keep permission
matrices, privileged audit, provider scopes, and staff powers in R1-P03.

### 4. Panic references support before support exists

R1-P19 includes linking an emergency to a support ticket, but support tables
arrive in R1-P24.

Required plan rule: R1-P19 stores emergency records without a support foreign
key; R1-P24 adds the nullable audited relation through its own forward migration.

### 5. Release 1 media needs object storage while cloud is deferred

Customer/provider/catalog/verification phases require protected media, while
Docker and cloud deployment are deferred until Release 3.

Required clarification: external protected object storage used by Release 1 is
an approved provider dependency and is distinct from deploying the Cleanora
application to cloud infrastructure.

### 6. R1-P26 production launch versus deferred cloud deployment

R1-P26 is named Production Launch and requires deployment/rollback, while
repository constraints defer Docker and cloud deployment to Release 3.

Required owner decision:

- R1-P26 performs production readiness and a documented non-Docker/non-cloud
  deployment; or
- Actual production launch moves to the release that approves deployment.

The roadmap must state this explicitly before P26.

## Authentication-specific blockers

- OQ-014 must decide Google sign-in audiences.
- SMS provider must be selected for blocking individual verification.
- Argon2id parameters must be benchmarked when R1-P02 is active.
- Worker-login, actor-role, and OTP-notification sequencing decisions above must
  be recorded.
- Auth Prisma models, migration, endpoints, JWT implementation, and cookies are
  not implemented yet and must not be described as complete.

## Go / No-Go

- **Go:** complete R1-P00 architecture artifacts and owner approval.
- **Conditional Go afterward:** activate and finish R1-P01, including its
  country/config migration, seed, CI, OpenAPI, lint/boundary, rate-limit, and
  database-test requirements.
- **No-Go:** R1-P02 Authentication implementation until dependencies and the
  listed owner decisions are complete.
