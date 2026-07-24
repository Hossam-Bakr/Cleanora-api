# Quickstart — R1-P01 Validation Guide

**Phase**: R1-P01 — Project Foundation & Country Configuration  
**Audience**: Implementer validating the phase locally  
**Constraints**: No Docker / Testcontainers; PostgreSQL must already be reachable via `DATABASE_URL`

## Prerequisites

1. Node.js ≥ 24
2. PostgreSQL reachable with an empty (or reset) database for clean-migration proof
3. Repository checkout with dependencies installed (`npm ci` / `npm install`)
4. Local `.env` present — **do not commit secrets**; preserve existing real values
5. Read:
   - [spec.md](./spec.md)
   - [plan.md](./plan.md)
   - [data-model.md](./data-model.md)
   - [contracts/](./contracts/)

## Environment

Required for R1-P01 startup (see research R2):

- `DATABASE_URL`
- `CORS_ORIGINS`
- Foundation defaults may supply `PORT=8000`, `API_PREFIX=/api/v1`, `LOG_LEVEL=info`

Optional until R1-P02 (may remain in `.env` / `.env.example` as placeholders):

- `JWT_*`, `AUTH_*`, `GOOGLE_*`

Update `.env.example` with safe placeholders only. Never overwrite local `.env` secrets during tooling runs.

## Baseline commands (after implementation)

```bash
npm run typecheck
npm run lint
npm run test
npm run test:coverage
npm run prisma:validate
npm run prisma:generate
npm run openapi:validate
npm run docs:check
npm run ci
```

## Database: clean migration + Egypt seed

Point `DATABASE_URL` at an **empty** database, then:

```bash
npx prisma migrate deploy
npm run prisma:generate
npm run seed
npm run seed
npm run db:check
```

**Expected**:

- Migration folder `prisma/migrations/r1_p01_foundation_country_configuration` applied
- First seed creates EG / EGP / config rows
- Second seed creates **zero duplicate** natural-key rows
- `db:check` succeeds without printing secrets

SQL review: confirm generated migration has no unexplained destructive statements (see plan / implementation-summary checklist).

## Runtime smoke

```bash
npm run dev
```

Then:

| Check | Request | Expect |
|---|---|---|
| Liveness | `GET http://localhost:8000/api/v1/system/health/live` | 200 `status: ok` |
| Readiness | `GET http://localhost:8000/api/v1/system/health/ready` | 200 `status: ready` when DB up |
| Database | `GET http://localhost:8000/api/v1/system/health/database` | 200 `status: up` when DB up |
| Correlation | Inspect `x-request-id` + body `requestId` | UUID present |
| Envelope | Any failure path | `success: false` + stable `error.code` |

Stop Postgres (or point at bad DSN in a throwaway env) and confirm ready/database fail distinctly while live still returns 200.

## Configuration public contract (in-process)

Run integration tests that import `#modules/configuration` only:

- Resolve seeded keys for policies `GLOBAL_ONLY`, `COUNTRY_OVERRIDE_WITH_GLOBAL_FALLBACK`, `COUNTRY_REQUIRED`
- Unknown key / inactive country / missing country-required value fail explicitly
- Response includes `source` + `resolutionPolicy`

## Audit foundation

Integration test: `writeAudit` persists a foundation row; simulated persistence failure fails closed.

## Postman

Import:

1. `postman/Cleanora-local.postman_environment.json`
2. `postman/R1-P01-foundation-country-configuration.postman_collection.json` (created during implementation)

Preserve `postman/R1-P02-authentication.postman_collection.json` untouched.

## Invalid startup check

Unset or mangle a **required** foundation variable and run `npm run dev`:

- Process exits before listen
- Diagnostics name the field path
- Secrets / full DB credentials are not printed

## Out of scope for this quickstart

- Authentication flows (R1-P02)
- Production migration / deployment
- Docker Compose
