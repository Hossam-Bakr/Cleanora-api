# Implementation Plan: Project Foundation & Country Configuration

> Completed-phase implementation history. Pino, registrar, `src/core`, old
> Prisma-lifecycle paths, and E2E references are superseded by R1-P02A.

**Branch**: `R1-P01-project-foundation-country-configuration` | **Date**: 2026-07-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/R1-P01-project-foundation-country-configuration/spec.md`

**Note**: Planning only. Do not implement during `/speckit-plan`. Do not mark phase In Progress/Complete. Do not commit or push.

## Summary

R1-P01 delivers Cleanora’s first product persistence slice and hardens the existing CommonJS Express 5 foundation so later phases (especially R1-P02 authentication) can build safely.

**Approach**: Reuse the R1-P00 HTTP/logging/health/env/test baseline; close documented gaps (first Prisma migration `r1_p01_foundation_country_configuration`, Egypt idempotent seed, `configuration` + `admin` audit modules, distinguishable database health, optional auth env for startup, memory rate-limiter adapter with fail-closed errors, ESLint/CI/OpenAPI/docs/Postman). Country-sensitive behavior resolves through a per-key policy on `app_configs` (clarification Option C) via an explicit configuration public contract — never hard-coded Egypt branches or cross-module Prisma access.

## Technical Context

**Language/Version**: Node.js ≥ 24, TypeScript (strict); CommonJS (`"type": "commonjs"`) with `const`/`require` style preserved — no ESM migration

**Primary Dependencies**: Express 5, Prisma 7 (`@prisma/client` + `@prisma/adapter-pg`), PostgreSQL, Zod 4, Pino + pino-http, Helmet, CORS, Vitest + Supertest, `rate-limiter-flexible` (Memory adapter), ESLint (to add), OpenAPI validator (to add)

**Storage**: PostgreSQL via centralized `prisma/schema.prisma`; first product migration owned by this phase

**Testing**: Vitest unit / integration / e2e; coverage thresholds branches 75 / functions·lines·statements 80; no Docker/Testcontainers

**Target Platform**: Local and test Node.js API server (default port 8000); production deploy out of scope

**Project Type**: Modular-monolith web API (single backend deployable)

**Performance Goals**: Foundation correctness over load targets; health endpoints dependency-safe; rate limits explicit per mount

**Constraints**: Standalone DB boundary; no future-phase tables; no auth implementation; no wallets; no Docker/cloud; applied migrations immutable; raw Prisma must not cross module public APIs; preserve R1-P02 prep artifacts and existing `.env` secrets

**Scale/Scope**: Five persisted foundations (`countries`, `currencies`, `app_configs`, `country_configs`, `audit_logs`); system health HTTP; in-process configuration + audit public APIs; CI-equivalent quality gate

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Pre-research | Post-design | Evidence |
|---|---|---|---|---|
| I | Standalone greenfield | PASS | PASS | Migration/seed/docs live only in Cleanora; no external schema dependency ([research](./research.md) R15, [data-model](./data-model.md)) |
| II | One active phase + traceability | PASS | PASS | Pointer R1-P01; artifacts trace to roadmap/spec; status remains Not Started |
| III | Modular monolith ownership | PASS | PASS | `configuration` + `admin` public `index.ts` contracts; Prisma private ([contracts](./contracts/configuration-public-api.md), [audit](./contracts/audit-public-api.md)) |
| IV | Global design, local implement, incremental migration | PASS | PASS | Only P01 models; migration `r1_p01_foundation_country_configuration` |
| V | Canonical truth / no invention | PASS | PASS | Precedence from clarify Session 2026-07-24; OQs untouched |
| VI | Backend authority / security | PASS | PASS | Env fail-fast; redaction; health non-disclosure; config not secret store; audit fail-closed |
| VII | Risk-proportional testing | PASS | PASS | Unit/integration/e2e/migration/seed plans; no Docker ([quickstart](./quickstart.md)) |
| VIII | Human-controlled ops | PASS | PASS | No commit/push/prod migration/phase completion in this plan |
| IX | Locked release boundaries | PASS | PASS | No Docker/cloud; no wallets; auth deferred |
| X | Immutable migrations / phase-owned data | PASS | PASS | SQL review + clean apply; no future tables; forward-fix only |

**Gate result**: PASS (no unjustified violations). Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/R1-P01-project-foundation-country-configuration/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── health-api.md
│   ├── response-envelope.md
│   ├── configuration-public-api.md
│   ├── audit-public-api.md
│   └── openapi-foundation.md
├── checklists/requirements.md
├── spec.md
└── tasks.md                 # Created by /speckit-tasks (not this command)
```

### Source Code (repository root — converge, do not fork)

```text
src/
├── app.ts
├── server.ts
├── config/                  # env validation (relax auth requiredness)
├── core/
│   ├── http/                # envelope, errors, request-id, system routes (+ database health)
│   ├── security/            # RateLimiterPort + memory adapter wiring
│   ├── logging/
│   └── health/
├── integrations/
│   ├── database/            # prisma lifecycle (reuse)
│   └── logging/
├── modules/
│   ├── configuration/       # NEW — countries, currencies, configs, resolve API
│   │   └── index.ts         # public contract only
│   └── admin/               # NEW — audit_logs foundation
│       └── index.ts
├── routes/register-modules.ts
└── shared/

prisma/
├── schema.prisma            # add P01 models only
├── migrations/
│   └── r1_p01_foundation_country_configuration/
└── seed.ts                  # idempotent Egypt seed

tests/
├── unit/
├── integration/
├── e2e/
└── helpers/

docs/apis/
├── foundation-system.md     # extend database health
└── openapi/r1-p01-foundation.yaml

postman/
├── R1-P01-foundation-country-configuration.postman_collection.json
└── R1-P02-authentication.postman_collection.json   # PRESERVE

scripts/
├── check-database.ts        # reuse
├── validate-clean-migration.ts  # NEW
└── inspect-auth.ts          # PRESERVE
```

**Structure Decision**: Single modular-monolith backend at repository root. Extend existing `src/` layout; add `configuration` and `admin` modules; do not introduce apps/packages split or ESM.

## Phase 0 — Research

Complete: [research.md](./research.md) (R1–R18). All planning unknowns resolved; no remaining NEEDS CLARIFICATION.

## Phase 1 — Design

| Artifact | Path |
|---|---|
| Data model | [data-model.md](./data-model.md) |
| Health API contract | [contracts/health-api.md](./contracts/health-api.md) |
| Response envelope | [contracts/response-envelope.md](./contracts/response-envelope.md) |
| Configuration public API | [contracts/configuration-public-api.md](./contracts/configuration-public-api.md) |
| Audit public API | [contracts/audit-public-api.md](./contracts/audit-public-api.md) |
| OpenAPI foundation | [contracts/openapi-foundation.md](./contracts/openapi-foundation.md) |
| Quickstart | [quickstart.md](./quickstart.md) |

## Database plan (implementation-ready)

1. Inspect current empty product `schema.prisma` and empty migrations history.
2. Add enums + models only for: `countries`, `currencies`, `app_configs`, `country_configs`, `audit_logs`.
3. Create migration named **`r1_p01_foundation_country_configuration`**.
4. Review SQL — reject unexplained destructive ops; prefer `ON DELETE RESTRICT` for authoritative FKs; no cascade delete on audit.
5. Generate client; clean-apply on empty DB; seed Egypt (`EG`, `EGP`, ar/en locales) twice; prove no duplicates.
6. Never edit applied migration; corrections via forward migration.
7. Do not create R1-P02 or future tables.

Details: [data-model.md](./data-model.md).

## Environment plan

| Class | Variables | Startup |
|---|---|---|
| Required foundation | `NODE_ENV`, `PORT`, `API_PREFIX`, `DATABASE_URL`, `CORS_ORIGINS`, `LOG_LEVEL`, `SHUTDOWN_TIMEOUT_MS`, `REQUEST_BODY_LIMIT` | Required |
| Future auth (R1-P02) | `JWT_*`, `AUTH_*`, `GOOGLE_*` | Optional; validate if present |
| Secrets handling | Local `.env` real values | Preserve; never overwrite or log |

Update `.env.example` placeholders only.

## Testing plan

| Layer | Focus |
|---|---|
| Unit | Env parsing (auth optional), resolution matrix (3 policies), errors, redaction paths, correlation UUID rules, pure utils |
| Integration | Repositories, `#modules/configuration` + `#modules/admin` contracts, seed idempotency, health/ready/database, audit fail-closed, rate-limit middleware + memory adapter |
| E2E | Live server smoke for health trio + envelope/`requestId` |
| Migration | Clean empty DB apply + double seed |
| Authz | Only if an actual P01 access rule exists — **do not invent authentication** |
| Coverage | Enforce existing Vitest thresholds |
| Forbidden | Docker, Testcontainers, production credentials |

## Documentation / delivery plan

- Update `docs/apis/foundation-system.md` + OpenAPI YAML
- Add R1-P01 Postman collection + keep local environment
- Scripts: migrate helpers, clean-migration validator, seed
- Migration SQL review evidence in `implementation-summary.md` (created at implementation end — planned artifact, not written now)
- `npm run ci` local quality gate (+ GH Actions without Docker)

## Code conventions

- Easy-English comments above meaningful handlers, middleware, services, repositories, and complex logic
- HTTP handlers use:

```ts
/**
 * @desc    Short purpose
 * @route   METHOD /api/v1/path
 * @access  Public or internal foundation
 * @explanation Easy-English explanation
 */
```

## Explicit exclusions

- Auth/JWT/refresh/cookies/OTP/password reset/Google sign-in
- Roles/permissions
- Future business modules/tables
- Docker/cloud/deployment/production migration
- Stored-value wallets
- Commit/push; implementation during planning
- Marking phase In Progress or Complete

## Post-design Constitution Check

Re-evaluated after data-model + contracts: **PASS** (table above). No Complexity Tracking entries.

## Unresolved blockers

**None** for `/speckit-tasks`.

Operational note (not a product blocker): clean-migration and DB integration evidence require a reachable PostgreSQL via `DATABASE_URL` without Docker — document in quickstart/CI.

## Readiness

**Ready for `/speckit-tasks`.**

## Complexity Tracking

> No constitution violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
