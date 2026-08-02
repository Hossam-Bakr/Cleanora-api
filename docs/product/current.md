# Cleanora — Current Work

| Field | Value |
|---|---|
| Current Release | `Release 1 — Core Marketplace` |
| Current Phase | `R1-P02A — Backend Structure Simplification` |
| Status | `Complete` |
| Backend Branch | `TBD` |
| Frontend Branch | `TBD` |
| Backend Owner | `TBD` |
| Frontend Owner | `TBD` |
| Started At | `2026-07-30` |
| Completed At | `2026-08-01` |
| Last Updated | `2026-08-01` |

No phase is currently In Progress. **R1-P03 is not activated.**

## Completed phase — R1-P02A

R1-P02A (`Backend Structure Simplification`) is **Complete** as of
`2026-08-01`, by explicit human-owner completion approval. It was a
behavior-preserving maintenance phase authorized on `2026-07-30`. It simplified
the backend structure, replaced Pino HTTP logging with Morgan, removed
confirmed placeholders and E2E duplication, and kept R1-P02 contracts frozen.
Final completion gates passed after a trailing-whitespace fix in `src/app.ts`.
This approval does not authorize commit, push, merge, deployment, or production
migration. **R1-P03 is not activated.**

## Completed phase — R1-P02

R1-P02 (`Complete Authentication & Identity`) is **Complete** as of
`2026-07-29`, by human-owner authorization in the phase completion prompt.
The one-active-phase rule remains: **R1-P03 is not activated**.

Completed with DEC-028 email-only verification/recovery, Google
provider-email Individual activation, isolated test-database migration
`r1_p02_email_verification_for_individuals` applied, final validation
evidence recorded, and independent review verdict `APPROVED`.

Historical activation context (preserved):

R1-P02 was activated as of `2026-07-24` after all transition gates
passed:

- R1-P01 is Complete by human-owner approval
- R1-P01 final independent review verdict is `APPROVED`
- Required quality gates and isolated clean-migration/double-seed evidence passed
- No other phase was In Progress at activation
- Goal: implement the complete Release 1 identity journey defined by the R1-P02 roadmap section
- DEC-011 includes Google sign-in without bypassing actor-specific verification
- DEC-012 keeps all implementation standalone and repository-local
- DEC-014 requires R1-P02 to own any later schema/migration changes incrementally
- DEC-015 resolves OQ-014: Release 1 Google sign-in is enabled for individual accounts only and never bypasses required verification

R1-P02 implementation is complete under DEC-028. Authentication code, additive
migrations, focused and full test suites, coverage thresholds, runtime smoke,
and independent review evidence are recorded in the active phase artifacts.
Historical interim notes below are retained for traceability and do not reopen
the phase.

DEC-018 corrects Google for browser use: one provider-registered backend
callback handles sign-in/link intent, redirects safely to the allowlisted
frontend without tokens in the URL, and historically used authenticated phone
OTP before DEC-028 removed that gate. Focused unit, database integration, E2E,
typecheck, lint, build, OpenAPI, docs, and Postman contract checks pass.

Professional runtime API documentation is now available at `/api/v1/docs`,
with the machine-readable OpenAPI 3.1 document at
`/api/v1/docs/openapi.json`. It covers every currently implemented system
health and authentication operation and includes a separate Postman
documentation collection. This documentation addition does not change the
phase status or close any remaining runtime or validation work.

DEC-024 removes the API-hosted Google result page and fixed development OTP
recipient. Google now hands off only to the configured frontend callback, which
bootstraps through `/auth/refresh` with credentials included. Until real SMS is
integrated, standard signup phone OTPs go to that account's normalized email
and Google phone OTPs go to the linked verified Google email. Login, refresh,
password change, and `/auth/me` share one safe frontend user contract.

DEC-025 adds nullable, provider-asserted Google display-name and HTTPS avatar
claims to that safe contract and a local `frontend/` integration
demonstration. The DEC-028 flow has no phone-restricted Google state.
Development-target migration presence and Google browser redirect evidence are
recorded under T192.

DEC-027 permits an explicitly enabled and separately acknowledged hosted-preview
SMS-to-email fallback while the real SMS provider remains unavailable. It uses
the account-bound email only, emits a startup warning, and states that the
delivery does not prove phone ownership. Direct email categories and the
fallback both require a valid SMTP configuration. This preview exception must
be replaced by real SMS before production readiness.

DEC-028 supersedes the temporary SMS and phone-gate decisions. R1-P02 now uses
email as the only verification and recovery delivery channel for every
supported self-signup category in both local and hosted environments. Phone
values remain unverified, Google verified-email sign-in creates a fully active
Individual identity, and real phone ownership verification is deferred to
R1-P26. Obsolete SMS adapters and flags are no longer part of startup.

Final convergence has reconciled the active specification, plan, research,
data model, quickstart, OpenAPI, and Postman direction with DEC-028. The
isolated pooled test target received
`r1_p02_email_verification_for_individuals` through matching direct
`TEST_MIGRATION_DATABASE_URL`. Final validation, coverage thresholds,
runtime acceptance, independent review `APPROVED`, and human-owner completion
approval are recorded. **R1-P03 is not activated.**

## Completed phase — R1-P01

R1-P01 (`Project Foundation & Country Configuration`) is **Complete** as of `2026-07-24` by human-owner approval. Evidence:

- All 96 tasks complete (`specs/R1-P01-project-foundation-country-configuration/tasks.md`)
- Final independent review verdict `APPROVED` (`specs/R1-P01-project-foundation-country-configuration/review-report.md`)
- All prior BLOCKER and MAJOR findings resolved (`specs/R1-P01-project-foundation-country-configuration/review-resolution.md`)
- All required non-database quality gates passed (typecheck, lint, unit/integration/e2e tests, coverage, prisma validate, docs check, OpenAPI validate, build)
- Coverage passed above configured thresholds
- Historical isolated clean-database migration and double-seed proof remains valid
- The explicit CI database gate remains conditional on `CI_DATABASE_URL`
- Implementation summary: `specs/R1-P01-project-foundation-country-configuration/implementation-summary.md`
- Phase-owned migration: `prisma/migrations/r1_p01_foundation_country_configuration/`

### Non-blocking follow-up notes (MINOR)

- Ignored session SQL files (`*.session.sql`); clean up on disk before the first commit if desired
- ADR-0005 automated cross-module import enforcement remains an owner decision
- Optional `vitest/globals` TypeScript hygiene (narrow globals types to tests later)

## Prior foundation — R1-P00

R1-P00 (`Product & Database Architecture`) is **Complete** as of `2026-07-24`. Evidence:

- All 85 tasks complete (`specs/R1-P00-product-database-architecture/tasks.md`)
- Final Spec Kit convergence reported zero actionable gaps
- Review findings resolved (`review-resolution.md`); final review verdict `APPROVED` (`review-report.md`)
- FR-001–FR-066 and SC-001–SC-014 satisfied
- Implementation summary: `specs/R1-P00-product-database-architecture/implementation-summary.md`
- Architecture deliverables remain frozen under `docs/architecture/`
