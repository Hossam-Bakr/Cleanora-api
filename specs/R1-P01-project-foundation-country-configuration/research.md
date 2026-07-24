# Research — R1-P01 Project Foundation & Country Configuration

**Date**: 2026-07-24  
**Phase**: R1-P01  
**Status**: Complete (all planning unknowns resolved)  
**Baseline inspected**: `package.json`, `src/`, `prisma/`, `tests/`, `.env.example`, `docs/standards/*`, ADRs, Postman, scripts

## Preconditions verified

| Check | Result |
|---|---|
| Feature pointer `.specify/feature.json` | `specs/R1-P01-project-foundation-country-configuration` |
| Requirements checklist | 16/16 complete |
| `[NEEDS CLARIFICATION]` in `spec.md` | None |
| Active phase | R1-P01 Not Started (`docs/product/current.md`) |
| R1-P00 | Complete / APPROVED architecture contract frozen |

---

## R1 — Existing foundation reuse versus gaps

**Decision**: Converge on the existing CommonJS Express 5 + Prisma 7 + Zod + Pino + Vitest baseline. Implement only R1-P01 gaps. Do not rewrite working HTTP, logging, health, env, or module-registration foundations. Preserve all R1-P02 authentication preparation artifacts untouched.

**Rationale**: Roadmap readiness review and repository inventory show a usable R1-P00 scaffolding. Rebuilding would risk regressions and violate “preserve unrelated existing work.”

**Alternatives considered**:
- Greenfield rewrite of `src/app.ts` / response envelopes — rejected (destabilizes tests and Postman).
- Defer all foundation hardening to later phases — rejected (R1-P01 owns these Done When items).

### Reuse (do not rebuild)

- `src/app.ts`, `src/server.ts`, module registrar, `#imports` maps
- API success/failure helpers + `docs/standards/api-response-and-errors.md`
- `requestIdMiddleware` (UUID accept-or-mint) + `x-request-id`
- Pino/`pino-http` with redaction paths
- Helmet, CORS, body limit
- System live/ready routes + Prisma lifecycle readiness probe
- Vitest suites, coverage thresholds, test helpers
- `scripts/check-database.ts`, seed entrypoints, Postman foundation collection
- Auth-related `.env` keys, `scripts/inspect-auth.ts`, R1-P02 docs/Postman (preserve only)

### Gaps (implement in R1-P01)

| Gap | Plan action |
|---|---|
| Product Prisma models + first migration | `r1_p01_foundation_country_configuration` |
| Idempotent Egypt seed | `prisma/seed.ts` + configuration seed helpers |
| `configuration` module public contract | countries/currencies/configs resolution |
| `admin` audit foundation public contract | append-only audit write/read helpers as needed |
| Distinct database-health HTTP signal | `GET /system/health/database` |
| Env: foundation-required vs auth-optional | Relax JWT/auth/Google requiredness for P01 startup |
| Shared Zod request validation helper | Boundary middleware for HTTP inputs |
| Rate-limit adapter | Memory adapter via `rate-limiter-flexible`; explicit fail-closed |
| ESLint + boundary lint | Add tooling + `npm run lint` |
| OpenAPI foundation | Static OpenAPI 3 doc + validate script |
| CI / local quality gate | `npm run ci` + GitHub Actions without Docker |
| Migrate npm scripts | `prisma:migrate*`, clean-apply validation script |
| R1-P01 API docs + Postman | Extend system docs; new P01 collection |
| Docs/lint/docs-check scripts | Wire into CI-equivalent gate |

---

## R2 — Environment validation and startup-failure semantics

**Decision**:
- **Required for R1-P01 startup**: `NODE_ENV`, `PORT` (default 8000), `API_PREFIX` (default `/api/v1`), `DATABASE_URL`, `CORS_ORIGINS`, `LOG_LEVEL` (default `info`), `SHUTDOWN_TIMEOUT_MS`, `REQUEST_BODY_LIMIT`.
- **Future / optional until R1-P02 activates them**: all `JWT_*`, `AUTH_*`, and `GOOGLE_*` variables. Keep them in `.env` / `.env.example` with safe placeholders. If present, still validate shape (secret length, access≠refresh, SameSite/Secure rules, Google triad consistency) so local auth prep remains safe; if absent, startup succeeds.
- Invalid/missing **required** values: fail before listen; print actionable Zod issue paths; never print secret values or full `DATABASE_URL` credentials.
- Preserve real values already in local `.env`; never overwrite `.env` during planning/implementation scripts that generate examples only.

**Rationale**: Owner requirement — R1-P01 must not require JWT/OTP/social config. Current `src/config/env.ts` incorrectly blocks foundation startup on JWT secrets.

**Alternatives considered**:
- Keep JWT required “for convenience” — rejected (blocks P01 Done When and contradicts owner instruction).
- Strip auth keys from `.env.example` — rejected (breaks R1-P02 prep continuity).

---

## R3 — API response / error envelope

**Decision**: Keep the existing envelope in `docs/standards/api-response-and-errors.md` and `src/core/http/api-response.ts` as the single public contract. No competing formats.

**Rationale**: Already implemented and tested; matches FR-007–FR-009.

**Alternatives considered**: Introduce RFC7807 Problem Details — rejected for this phase (migration cost, not required by spec).

---

## R4 — Request correlation-ID trust and normalization

**Decision**: Keep current middleware behavior:
- Accept `x-request-id` only when it matches UUID syntax; otherwise mint `randomUUID()`.
- Echo trusted/normalized ID on response `x-request-id` and in JSON `requestId`.
- Never treat client-supplied IDs as authentication or authorization evidence.

**Rationale**: Already matches FR-010 and US3 scenario 3.

**Alternatives considered**: Always ignore client header — rejected (hurts distributed tracing with trusted upstream proxies that can send UUIDs). Opaque non-UUID accept — rejected (harder log hygiene).

---

## R5 — Pino redaction and safe request logging

**Decision**: Keep Pino redaction paths; ensure request bodies are not logged; expand redaction list only if tests prove gaps (e.g. `*.refreshToken`, `*.accessToken`, `req.headers["set-cookie"]`). Structured logs must include `requestId`.

**Rationale**: ADR-0008 + existing adapter already satisfy FR-011–FR-012 with minor hardening allowed.

**Alternatives considered**: Log full bodies in development — rejected (secret leak risk).

---

## R6 — Liveness versus readiness versus database-health

**Decision**:
- **Liveness** `GET /api/v1/system/health/live` — process alive only (reuse).
- **Readiness** `GET /api/v1/system/health/ready` — all registered probes (including DB); `503 DEPENDENCY_NOT_READY` with safe probe names (reuse).
- **Database health** `GET /api/v1/system/health/database` — **new** dedicated probe that only checks PostgreSQL connectivity (`SELECT 1`), returning success or `503` with code `DATABASE_UNAVAILABLE` and **no** connection string / SQL / secrets.

**Rationale**: Spec requires distinguishable live / ready / database-unavailable signals. Ready alone cannot distinguish “DB down” from “other probe down” if more probes appear; a dedicated database route makes the three states explicit for operators.

**Alternatives considered**:
- Only use ready with `failed: ["database"]` — partial; rejected as insufficiently distinguishable for the required three-way operator story when additional probes exist.
- Put DB details in live — rejected (live must stay dependency-free).

---

## R7 — Rate-limit failure policy

**Decision**:
- Install `rate-limiter-flexible` and provide a **Memory** adapter implementing `RateLimiterPort` for local/test/single-instance (ADR-0009 allows tests with in-memory fake; Memory store is the first concrete adapter without Redis/Docker).
- Every mount site must pass explicit `limit` + `windowSeconds` (no global default).
- **Fail-closed** on adapter/storage errors for R1-P01 foundation mounts: do not silently allow traffic when the limiter throws; map to safe `503`/`500` with stable code `RATE_LIMITER_UNAVAILABLE` (prefer 503) without leaking internals.
- Do not introduce Redis/ioredis in R1-P01 (Docker/cloud deferred; Redis adapter remains a later phase when Redis is approved for local non-Docker use or R3).
- Mount at least one explicit foundation policy (e.g. generous limit on a documented system diagnostic route or future-facing placeholder path) to prove wiring; do not rate-limit liveness so aggressively that probes flap.

**Rationale**: Spec + ADR-0009 require explicit policy and failure semantics; Redis without Docker is out of R1 constraints.

**Alternatives considered**:
- Fail-open on limiter errors — rejected for foundation (masking outages).
- Skip adapter until Redis — rejected (P01 Done When includes rate-limiting foundation).

---

## R8 — Configuration value representation and runtime validation

**Decision**:
- Persist configuration values as Prisma `Json` plus a coarse `value_kind` enum (`STRING`, `NUMBER`, `BOOLEAN`, `OBJECT`, `ARRAY`) on `app_configs` (key registry) and matching kind on `country_configs` rows.
- Maintain a **code-owned key catalog** (Zod schemas per known key) inside the configuration module for runtime validation of writes and reads.
- Reject unknown keys at resolve/write boundaries (FR-022).
- Reject values that fail the key’s Zod schema.
- Prohibit secret storage: reject keys/values matching secret denylist patterns; document that credentials belong in environment/secret managers, never `app_configs`/`country_configs`.

**Rationale**: Json + typed kind + code schemas keep DB flexible without inventing a new policy table; matches clarification “no additional table.”

**Alternatives considered**:
- Opaque string-only values — rejected (weak typing).
- Separate `config_key_definitions` table — rejected by clarification.

---

## R9 — Per-key resolution policies (clarification Option C)

**Decision**: Store `resolution_policy` on `app_configs` only (canonical key registry):

| Policy | Behavior |
|---|---|
| `GLOBAL_ONLY` | Read global value only; reject country override rows / resolve attempts that supply country override |
| `COUNTRY_OVERRIDE_WITH_GLOBAL_FALLBACK` | Country value wins; else global; else fail |
| `COUNTRY_REQUIRED` | Country value required; missing → fail closed; never silent global substitute (global row may exist only to declare key/policy; its value must not silently fill) |

Public contract returns `{ key, value, source: "global" \| "country", countryCode?: string, resolutionPolicy }`.

**Rationale**: Owner-approved clarification Session 2026-07-24.

**Alternatives considered**: A/B from clarify options — rejected by owner.

---

## R10 — Audit-log append-oriented foundation and failure semantics

**Decision**:
- `audit_logs` owned by `admin` module; append-only; `created_at` only (no `updated_at`); no hard delete API.
- Fields: actor type/id (nullable), action, target type/id, reason/context (optional safe JSON), correlation/`request_id`, timestamp.
- Public `writeAudit(...)` : on persistence failure, **fail closed** (throw typed error / reject promise) — callers must not treat audit as best-effort fire-and-forget when they require evidence.
- R1-P01 does not implement privileged authorization workflows; may include a foundation write path used by tests/seed-safe system events only.

**Rationale**: FR-029–FR-032; conventions FR-052; R1-P03 extends later.

**Alternatives considered**: Best-effort audit swallow errors — rejected (silent evidence loss).

---

## R11 — Static versus generated OpenAPI foundation

**Decision**: Maintain a **static** OpenAPI 3.x document under `docs/apis/openapi/r1-p01-foundation.yaml` (or equivalent) describing implemented system health endpoints and documenting the standard envelopes by `$ref`. Add `npm run openapi:validate` (e.g. `@redocly/cli` or `swagger-parser`) in CI. Do **not** generate OpenAPI from Express decorators in R1-P01.

**Rationale**: Lowest risk, matches “maintainable foundation,” avoids decorator/ESM churn in CommonJS codebase.

**Alternatives considered**: `@asteasolutions/zod-to-openapi` full codegen — deferred (useful later, not required now). Runtime Swagger UI — optional later; not required for Done When.

---

## R12 — CI and lint / documentation checks

**Decision**:
- Add ESLint flat config compatible with TypeScript + Simple import boundary guards for `#modules/*` public entry only (where feasible).
- Scripts: `lint`, `docs:check` (existence/links for required P01 docs), `openapi:validate`, `prisma:migrate:status`, `ci` aggregating typecheck + lint + tests + coverage + prisma validate + openapi + docs check + migration clean-apply script when `DATABASE_URL` is available.
- GitHub Actions workflow without Docker/Testcontainers: jobs for lint/typecheck/unit; integration/migration jobs run only when a repository `DATABASE_URL` secret/variable is configured, otherwise document local-only DB gates in quickstart (Release 1 constraint).

**Rationale**: Constitution VII + roadmap CI Done When; no Docker.

**Alternatives considered**: Skip CI entirely — rejected. Embed Postgres service container — rejected (Docker deferred).

---

## R13 — Coverage thresholds

**Decision**: Keep existing Vitest thresholds: branches **75**, functions/lines/statements **80**. Expand `include` coverage to new module code; keep excluding `src/generated/**`, `src/server.ts`, raw DB integration adapters as today unless tests cover them deliberately.

**Rationale**: Already calibrated; raising now adds noise without product gain.

**Alternatives considered**: 90% global — rejected for foundation phase with excluded I/O paths.

---

## R14 — Seed idempotency and interrupted-seed recovery

**Decision**: Egypt seed uses upsert / natural-key idempotency:
- Country `EG`, currency `EGP`, locale capability keys, and required `app_configs` / `country_configs` rows.
- Re-running seed must not duplicate rows (unique constraints + upsert).
- Interrupted seed: re-run is safe because each step is idempotent; no multi-step non-transactional “half Egypt” left as conflicting duplicates (prefer a single transaction where Prisma interactive transaction fits, or ordered upserts with uniques).
- Seed must not hard-code Egypt business fee/rules — only reference/config enablement.

**Rationale**: FR-023, FR-026, SC-007.

**Alternatives considered**: Delete-all-then-insert — rejected (destructive, unsafe on shared DBs).

---

## R15 — Migration clean-apply validation without Docker

**Decision**:
- Migration directory name: `r1_p01_foundation_country_configuration`.
- Validate with: empty database URL → `prisma migrate deploy` (or `migrate diff` + deploy) → generate client → seed twice → assert counts.
- Script `scripts/validate-clean-migration.ts` (name flexible) uses `DATABASE_URL` pointing at an empty Postgres the developer/CI provides (local install, managed free tier, etc.) — **not** Testcontainers/Docker Compose.
- SQL review checklist recorded in implementation-summary / migration review note: no unexplained DROP/TRUNCATE/DELETE; indexes/constraints present; defaults safe.

**Rationale**: DEC-014, constitution X, standalone boundary, owner migration naming.

**Alternatives considered**: `db push` only — rejected (no migration history). Dockerized Postgres for tests — rejected until R3.

---

## R16 — Module ownership and public contracts

**Decision**:
- `src/modules/configuration` owns countries, currencies, app_configs, country_configs repositories and resolution service; exports public functions/types only via `index.ts`.
- `src/modules/admin` owns audit_logs repository and `writeAudit` / related public types via `index.ts`.
- Cross-module imports of another module’s `infrastructure/**` or Prisma models are forbidden.
- Map Prisma rows to DTO/contract types at the boundary.

**Rationale**: Constitution III; entity-ownership map.

---

## R17 — HTTP surface for configuration / audit

**Decision**: R1-P01 does **not** require public business HTTP CRUD for configs or audit. Configuration and audit are primarily **in-process public module APIs**. HTTP remains system health (+ rate-limit demonstration if mounted on a system route). Optional internal diagnostic HTTP is out of scope unless tasks explicitly add a read-only safe endpoint later.

**Rationale**: Spec actors are modules/maintainers/operators; avoids inventing unauthenticated config mutation APIs before R1-P03 authz.

**Alternatives considered**: Full admin HTTP config API — rejected (needs authz).

---

## R18 — Comment and handler documentation convention

**Decision**: Enforce Easy-English comments and the prescribed `@desc/@route/@access/@explanation` JSDoc on HTTP handlers; equivalent Easy-English comments on services/repositories/middleware.

**Rationale**: Owner coding convention for this phase.

---

## Deferred (explicitly not R1-P01)

- Authentication/JWT/OTP/Google/session cookies (R1-P02)
- Roles/permissions / privileged audit workflows (R1-P03)
- Redis-backed distributed rate limiter
- Docker/cloud/production migration
- Future-phase tables
- Stored-value wallets
