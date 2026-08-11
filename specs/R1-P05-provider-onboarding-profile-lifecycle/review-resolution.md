# Review Resolution — R1-P05 Provider Onboarding, Profile & Lifecycle

## Resolution summary

| Finding | Decision | Evidence/fix | Validation |
|---|---|---|---|
| R1P05-REV-001 | accepted | Implemented authenticated Cloudinary Provider-video upload, authoritative metadata finalization, READY/FAILED lifecycle, thumbnails, signed delivery, and cleanup in Media-owned adapters. | Cloudinary/Provider media unit tests; US4 integration; full unit, integration, and coverage suites pass. |
| R1P05-REV-002 | accepted | Provider list/get now resolves all Providers on which the actor has an enabled active OWNER or ADMIN membership and returns the actor's relationship without exposing unrelated Providers. | Provider application unit/integration tests include ADMIN list/get and disabled-access denials. |
| R1P05-REV-003 | accepted | Media access now reads Authentication-owned authority independently from Provider membership and denies disabled global role or disabled membership using safe-not-found semantics. | Media authorization tests cover active ADMIN, disabled role, disabled member, and cross-Provider denial. |
| R1P05-REV-004 | accepted | All aggregates use one authoritative `ProviderProjectionService`, compute applicant facts from `applicationOwnerUserId`, and remove hard-coded satisfied readiness/completion facts. | Projection, approval, review, lifecycle, profile, media, acceptance, and ADMIN-view regression tests pass. |
| R1P05-REV-005 | accepted | Provider create, submit, and approval re-read eligibility, Staff authorization, applicant profile, media, and mutable Provider state inside the owning transaction before effects. | Transaction rollback/concurrency tests and US5/US6 suites pass. |
| R1P05-REV-006 | accepted | Media owns Provider-media status reads through a public contract; composition no longer queries Media persistence directly. Provider authorization/version preflight occurs before external work and is rechecked transactionally. | Architecture tests, composition tests, media ordering tests, and full suites pass. |
| R1P05-REV-007 | accepted | Replaced both R1-P05 `it.todo` cases with executable compatibility tests. The acceptance journey now proves two-video limit rejection and invitation acceptance plus replay denial instead of relying on existing row counts. | Unit: 146 files/684 tests; integration: 84 files/207 tests; coverage: 229 files/889 tests; zero todo. |
| R1P05-REV-008 | accepted | Removed the raw invitation token from link URL and durable metadata; the secret exists only in the intended email body, while the link is generic. | Invitation delivery/redaction unit and integration tests pass. |
| R1P05-REV-009 | accepted | Added per-user PostgreSQL transaction advisory serialization before final-membership authority reconciliation. | Two-Provider final-membership barrier regression and all required triple-runs pass. |
| R1P05-REV-010 | accepted | Introduced/used named Authentication and Admin public contracts; Providers no longer imports their service/infrastructure internals. Tightened architecture tests to enforce public seams. | Module-boundary unit suite, typecheck, lint, and build pass. |
| R1P05-REV-011 | accepted | Added the Provider email delivery adapter and wired bounded dispatcher start/stop into production composition with batch/lease settings. | Dispatcher composition/startup and delivery tests pass. |
| R1P05-REV-012 | accepted | Clean-migration validation inventories all 12 migration folders, proves exact history, runs seed twice, and executes live R1-P05 invalid-write constraint probes in an isolated schema. | `db:validate-clean-migration` passed on `cleanora_r1_p05_proof_4544_1786436760606`. |
| R1P05-REV-013 | accepted | Postman validation now normalizes and compares the exact R1-P05 method/path set against runtime Swagger, detects duplicates, and uses canonical `{userId}`. | 41 R1-P05 requests; `runtimeParity:true`; OpenAPI and Postman validators pass. |

Allowed decisions: `accepted`, `rejected-with-evidence`, `already-resolved`, `owner-decision-required`.

## Files changed

- Media public contracts, Cloudinary/Provider adapters, repository/factory, and media tests.
- Provider application, projection, approval, review, lifecycle, profile, media, membership, invitation, dispatcher, repositories, unit of work, composition, routes, and tests.
- Authentication/Admin/Customers public transactional/read contracts needed by Provider ownership boundaries.
- Prisma schema and phase-owned migration plus clean-migration validation.
- Runtime Swagger, R1-P05 OpenAPI, generated Postman collection, and exact-parity validator.
- R1-P05 compatibility, acceptance, concurrency, privacy, architecture, and tooling regressions.

## Regression coverage

- Full unit gate: 146/146 files and 684/684 tests passed.
- Full integration gate: 84/84 files and 207/207 tests passed.
- Full coverage gate: 229/229 files and 889/889 tests passed; statements 85.01%, branches 76.19%, functions 88.50%, lines 85.87%.
- SC-008 performance gate: 1,000 interactions across 25 active lanes; 96.7% within two seconds; 39,178 ms measurement window.
- Provider approval, existing-user invitation, new-user invitation, and two-Provider final-membership concurrency suites passed three consecutive runs with cardinality assertions.

## Remaining risks or decisions

- Cursor Claude was unavailable in this environment; fresh read-only Codex reviewers are used for the required independent review, and that limitation remains explicit.
- `npm audit --omit=dev --audit-level=high` reports zero production vulnerabilities. The full development-tool audit reports four high and four moderate transitive advisories in ESLint/TypeScript, Swagger, Vitest/Vite, and Prisma CLI tooling. Automatic fixes would update locked toolchain versions, so they are recorded as non-runtime dependency-maintenance work rather than silently forced into R1-P05.
- SC-008 requires network access to the approved disposable proof database; sandboxed attempts fail closed with `EACCES`. The accepted result was produced outside the network-restricted sandbox.
- No deployment, production migration, merge, commit, or push is part of this resolution.

## Final checks

- Prisma schema validation and client generation passed.
- Isolated clean migration, full history, double seed, and live constraint probes passed.
- Typecheck, lint, build, docs, OpenAPI, Postman exact parity, and `git diff --check` passed.
- Production dependency audit passed with zero vulnerabilities.
- Final review delta: typecheck, lint, and build passed; the restricted
  invitation-onboarding regression passed 1 file / 7 tests after the earlier
  focused 8-file / 45-test remediation wave.
- Two fresh read-only reviewers returned PASS with no remaining blocker/major.
- Per the human owner's explicit time-saving direction, the full and long
  concurrency suites were not repeated after the last focused remediation.
