# Cleanora — Current Work

| Field | Value |
|---|---|
| Current Release | `Release 1 — Core Marketplace` |
| Current Phase | `R1-P02 — Complete Authentication & Identity` |
| Status | `In Progress` |
| Backend Branch | `TBD` |
| Frontend Branch | `TBD` |
| Backend Owner | `TBD` |
| Frontend Owner | `TBD` |
| Started At | `2026-07-24` |
| Completed At | `—` |
| Last Updated | `2026-07-26` |

## Active phase — R1-P02

R1-P02 (`Complete Authentication & Identity`) is **In Progress** as of
`2026-07-24`, activated by human-owner authorization after all transition gates
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

R1-P02 implementation is underway. Authentication code, its additive migration,
and focused tests exist. Coverage-only remediation is paused under DEC-016
(branches 73.8% vs 75% accepted as temporary debt; thresholds unchanged;
T099/T118 unchecked). DEC-017 authorizes a development-only SMS-to-email
delivery redirect without changing production verification rules. Development
migration/seed, SMTP delivery, health, signup, and representative auth error
paths have since been exercised successfully.

DEC-018 corrects Google for browser use: one provider-registered backend
callback handles sign-in/link intent, redirects safely to the allowlisted
frontend without tokens in the URL, and uses authenticated phone OTP request
and verification to promote the exact restricted session. Focused unit,
database integration, E2E, typecheck, lint, build, OpenAPI, docs, and Postman
contract checks pass. Full real-provider Chrome acceptance, remaining manual
auth journeys, T099/T118, and final review remain open. No coverage, full CI,
converge, commit, push, deployment, or production migration was performed for
DEC-018.

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
claims to that safe contract and a local `frontend/` integration demonstration.
Static validation passes; applying the additive development migration and one
real-provider Chrome journey remain open as T192.

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
