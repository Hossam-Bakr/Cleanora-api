# Cleanora — Current Work

| Field | Value |
|---|---|
| Current Release | `Release 1 — Core Marketplace` |
| Current Phase | `None — R1-P06 is Complete; R1-P07 is not activated` |
| Status | `No active phase — awaiting separate human authorization for any next-phase preparation or activation` |
| Backend Branch | `codex/r1-p06-provider-verification-payout-destinations` — created from current `origin/main` for the explicitly authorized R1-P06 commit-and-push handoff; merge and deployment remain unauthorized |
| Frontend Branch | `Not created — R1-P06 supplied a backend UX contract only` |
| Backend Owner | `Unassigned — R1-P06 implementation and closure are complete` |
| Frontend Owner | `Not assigned — no frontend application exists` |
| Started At | `Not started for a next phase` |
| Completed At | `2026-08-14` (R1-P06) |
| Last Updated | `2026-08-22` (R1-P06 remains Complete; the owner explicitly authorized its guarded commit-and-push handoff, and the dedicated backend feature branch was created from current `origin/main`; merge, deployment, production migration, payout execution, destructive cleanup, and R1-P07 action remain unauthorized) |

## Most recently completed phase — R1-P06

R1-P06 (`Provider Verification & External Payout Destinations`) is **Complete**
as of `2026-08-14`, by explicit human-owner approval:

```text
I approve R1-P06 — Provider Verification & External Payout Destinations as Complete.
```

Clarification, planning, checklists, continuous tasks T001–T137, analysis and
remediation, implementation, focused tests, phase-scoped coverage, API/runtime
artifacts, final review, and every evidence gate passed before approval. The
explicitly approved disposable local PostgreSQL target proved chronological
clean installation and populated R1-P05 upgrade compatibility in separate
isolated schemas, including exact tables and migration history, preserved
Provider relations, double-seed idempotency, live constraints, five-destination
enforcement, and six-request reveal serialization. The temporary proof server
is stopped and the installed PostgreSQL service was not modified.

No phase is active after this closure. The completion decision does not
authorize Git actions, deployment, production configuration or migration, real
external wallet or bank operations, destructive cleanup, next-phase
preparation, or R1-P07 activation.

The phase verifies Registered Company provider documents and collects approved
external Mobile Wallet or Bank Account payout destinations without creating an
internal Cleanora wallet, stored balance, settlement schedule, or payout
execution behavior. `INDIVIDUAL_TEAM` requires no verification documents.
The Mobile Wallet decision now requires an Owner-entered country-scoped E.164
destination, manual Staff holder-name verification outside Cleanora, masked
ordinary views, and an active approved version for readiness; it expressly
requires no uploaded ownership-evidence file and no automated transfer.
The Bank Account decision now requires an Owner-entered IBAN-first destination
using the authoritative country, configured payout currency, and active country-
scoped bank, followed by manual Staff beneficiary-name verification outside
Cleanora. It likewise requires no ownership-evidence upload or automated
transfer, and ordinary views expose only a masked IBAN.
All recoverable payout identifiers and holder legal names use the approved
AES-256-GCM-at-rest contract and a separate HMAC-SHA-256 lookup key ring.
Provider identifiers are write-only and exactly masked after write; full values
are available only to a capable active Staff Admin for one exact pending-version
verification purpose after a five-minute step-up, reason, audit-before-return,
and per-actor rate-limit check. Release 1 key rings are externally supplied and
fail closed; rotation is resumable and key retirement requires verified zero
references plus explicit human approval. Private document files remain Media-
owned.

Canonical artifacts for this completed phase:

- `specs/R1-P06-provider-verification-external-payout-destinations/activation.md`
- `specs/R1-P06-provider-verification-external-payout-destinations/spec.md`
- `specs/R1-P06-provider-verification-external-payout-destinations/plan.md`
- `specs/R1-P06-provider-verification-external-payout-destinations/research.md`
- `specs/R1-P06-provider-verification-external-payout-destinations/data-model.md`
- `specs/R1-P06-provider-verification-external-payout-destinations/contracts/`
- `specs/R1-P06-provider-verification-external-payout-destinations/security-design.md`
- `specs/R1-P06-provider-verification-external-payout-destinations/ux-design.md`
- `specs/R1-P06-provider-verification-external-payout-destinations/migration-plan.md`
- `specs/R1-P06-provider-verification-external-payout-destinations/test-strategy.md`
- `specs/R1-P06-provider-verification-external-payout-destinations/operations-runbook.md`
- `specs/R1-P06-provider-verification-external-payout-destinations/checklists/`
- `specs/R1-P06-provider-verification-external-payout-destinations/tasks.md`
- `specs/R1-P06-provider-verification-external-payout-destinations/implementation-prompt.md`
- `specs/R1-P06-provider-verification-external-payout-destinations/implementation-summary.md`
- `specs/R1-P06-provider-verification-external-payout-destinations/implementation-review-report.md`
- `specs/R1-P06-provider-verification-external-payout-destinations/completion-report.md`
- DEC-037

## Completed phase — R1-P05

R1-P05 (`Provider Onboarding, Profile & Lifecycle`) is **Complete**.
R1-P03, its roadmap dependency, is Complete, and R1-P04A was completed before
this activation.

**Historical completion status:** Spec Kit planning (`clarify` / `plan` / `tasks` /
`analyze`) completed earlier. Implementation and closure tasks T001–T159 are
checked with recorded evidence in the feature directory. Independent review
returned **PASS**, and human completion authorization is recorded. R1-P06 was
initially activated for specification preparation on `2026-08-13`; its
documentation-only workflow was subsequently expanded through clarification,
planning, tasks, analysis, and handoff. No deployment or production migration
was authorized by the R1-P05 completion run.

Canonical artifacts:

- `specs/R1-P05-provider-onboarding-profile-lifecycle/activation.md`
- `specs/R1-P05-provider-onboarding-profile-lifecycle/spec.md`
- `specs/R1-P05-provider-onboarding-profile-lifecycle/plan.md`
- `specs/R1-P05-provider-onboarding-profile-lifecycle/tasks.md`
- `specs/R1-P05-provider-onboarding-profile-lifecycle/implementation-summary.md`
- `specs/R1-P05-provider-onboarding-profile-lifecycle/completion-report.md`
- `specs/R1-P05-provider-onboarding-profile-lifecycle/implementation-prompt.md`
- DEC-036

Contract evidence: OpenAPI 35 paths / 41 operations; Postman 41 operations;
`npm run openapi:validate` and `npm run postman:validate` exit 0.

## Completed phase — R1-P04A

R1-P04A (`Category-Aware Customer Signup & Verification`) is **Complete** as of
`2026-08-10`, by explicit human-owner approval:

```text
I approve R1-P04A — Category-Aware Customer Signup & Verification as Complete.
```

Specification, planning, implementation, schema/migration changes,
documentation, and required tests were authorized on `2026-08-09`. All tasks
T001–T024 are complete, the implementation and module-boundary review verdict
is `PASS`, configured coverage passed, and the clean migration proof passed.

Authoritative artifacts:

- `specs/R1-P04A-category-aware-customer-signup-verification/spec.md`
- `specs/R1-P04A-category-aware-customer-signup-verification/activation.md`
- DEC-034 and DEC-035

Locked phase behavior: matching customer profile data is required during signup.
Every supported category—including Individual—activates by email OTP, which
proves email only; phone stays unverified. `SMS_AUTH_ENABLED` must remain false,
and no SMS provider, phone-verification endpoint, 15-day deadline, or order
restriction is implemented in this phase. The owner-approved future phone/email
sequence is documented in DEC-035 for a later explicit phase. Company regulatory
identifiers remain nullable post-signup profile fields.

The owner authorized and completed the implementation Git handoff on `main` at
`a29c239`. The clean-apply proof subsequently passed against the isolated
`cleanora_r1_p04_clean_proof` database. At the time of that closure, no phase
was active; R1-P05 was later activated under the separate owner authorization
recorded above. Merge, deployment, production migration, and access to the
historical `Cleanora` database incident remain unauthorized.

## Completed phase — R1-P04

R1-P04 (`Customer Profiles, Preferences & Text Addresses`) is **Complete** as
of `2026-08-08`, by explicit human-owner approval:

```text
I approve R1-P04 — Customer Profiles, Preferences & Text Addresses as Complete.
```

Fresh independent final implementation re-review verdict was **`PASS`** with no
unresolved BLOCKER or MAJOR. Tasks **T001–T120** remain checked. Technical-
planning review **`PASS`**. Final `/speckit.analyze` **`CLEAN`**. Completion
evidence: `specs/R1-P04-customer-profiles-preferences-text-addresses/completion-report.md`.

DEC-030–033 locks remain authoritative for the shipped customers/media slice:
trusted-principal + `SELF` customer authorization; staff_admin-only privileged
privacy reassignment; closed privacy outcomes; full-replacement preference PUT;
Cloudinary profile images with **`MEDIA_STORAGE_ROOT` superseded**.

Historical implementation review **`CHANGES REQUIRED`**, historical first
re-review **`BLOCKED`**, and historical later re-review **`CHANGES REQUIRED`**
remain labelled historical evidence only. Two non-blocking MINOR follow-ups are
recorded in the completion report (unused SC-008 eslint-disable; acceptance
could assert `maxActiveLanes === 25`).

The historical accidental migration of database **`Cleanora`** remains a
**separate unresolved operational incident**. Complete approval does **not**
authorize connecting to, inspecting, accepting, rolling back, resetting,
seeding, migrating, deleting, or recovering `Cleanora`. That database was not
accessed during this administrative closure.

This Complete approval does **not** authorize commit, push, merge, deployment,
production migration, or activation/implementation of the next roadmap phase.

## Completed phase — R1-P03A

R1-P03A (`Production Role Provisioning`) is **Complete** as of `2026-08-07`, by
explicit human-owner approval:

```text
I approve R1-P03A — Production Role Provisioning as Complete.
```

Implementation, sequential validation, and focused post-repair independent
re-review `PASS` preceded this approval
(`specs/R1-P03A-production-role-provisioning/implementation-review-report.md`,
`completion-report.md`). Tasks T001–T029 are complete.

Authentication remains the sole owner of roles, permissions, user-role grants,
privileged reasons, provisioning behavior, and transaction control. Under
DEC-030, R1-P03A delivered:

- a temporarily enabled owner-secret internal API
  (`POST /api/v1/internal/owner/staff-admins`, header `X-Owner-Admin-Secret`,
  env `OWNER_ADMIN_API_ENABLED` default `false` and `OWNER_ADMIN_SECRET`) for
  `staff_admin` assign/re-enable only, with timing-safe compare, rate limiting,
  idempotent atomic audit (`owner_staff_admin_provision`), and no Admin UI; and
- the existing authenticated staff-admin role-management HTTPS API for ordinary
  non-`customer` assign, revoke, enable, and disable through the completed
  R1-P03 `RoleManagementService`.

Release 1 does **not** require customer role provisioning. R1-P04 customer
self-service uses trusted `AuthenticationPrincipal` facts plus `SELF`
ownership and category eligibility under DEC-030; no `customer` role grant,
`resource.self.read`/`resource.self.write`, or other role-derived R1-P04
customer permission is required.

R1-P03A Complete approval does **not** authorize commit, push, merge,
deployment, production migration, real owner secret configuration, or live
staff_admin provisioning beyond separately controlled operations.

## Completed phase — R1-P03

R1-P03 (`Roles, Permissions & Privileged Audit`) is **Complete** as of
`2026-08-05`, by explicit human-owner approval:

```text
I approve R1-P03 — Roles, Permissions & Privileged Audit as Complete.
```

It was activated as of `2026-08-03` after R1-P02B completed with fresh coverage
and independent review `PASS`. Specify, clarify, plan, tasks, planning
remediation, and `/speckit.analyze` (`CLEAN`) completed first. Human
implementation authorization was approved. Implementation and convergence
finished against the frozen specification, plan, contracts, data model,
quickstart, and tasks T001–T086. Independent review verdict was `PASS` with no
blocker or major findings; both documentation minors were resolved
(`review-resolution.md`). Final completion audit outcome was
`READY_FOR_OWNER_APPROVAL` (`completion-report.md`).

Identity owns roles, permissions, grants, and privileged-reason tables.
Admin retains the `audit_logs` lifecycle through the approved composition
seam. No public R1-P03 endpoints were introduced. Migration
`r1_p03_roles_permissions_privileged_audit` is forward-only. Applied
migrations remain immutable.

R1-P04 (`Customer Profiles, Preferences & Text Addresses`) was subsequently
activated on `2026-08-05` for specification preparation only, then paused while
R1-P03A ran, then reactivated on `2026-08-07` for technical planning only. The
R1-P03 completion itself did not authorize commit, push, merge, deployment, or
production migration.

## Completed phase — R1-P02B

R1-P02B (`Backend Readability Simplification`) is **Complete** as of
`2026-08-03`, by explicit human-owner approval. It was a behavior-preserving
maintenance phase focused only on making the startup and routing path easy to
follow from `server.ts` through `app.ts`, `routes/index.ts`, and module routes.
The supplied `ecommerce-api.rar` is a readability reference only and is not a
Cleanora dependency or source of product behavior.

Every endpoint, method, request, response, status code, cookie, token, OTP,
Google flow, security rule, Prisma schema, applied migration, and frontend
contract remains frozen.

On `2026-08-03`, the human owner removed repository automation and then refined
the readability target to a junior-readable production entry point. The
refinement is implemented and validated: `server.ts` now uses direct
calls without factory override bags, conditional dependency selection,
injected route callbacks, or test-only startup switches. Fresh coverage passed
all configured thresholds, the independent final review returned `PASS` with
no unresolved finding, and the human owner approved completion on
`2026-08-03`. That closure satisfied the one-active-phase gate before R1-P03
was activated for specification work.

## Completed phase — R1-P02A

R1-P02A (`Backend Structure Simplification`) is **Complete** as of
`2026-08-01`, by explicit human-owner completion approval. It was a
behavior-preserving maintenance phase authorized on `2026-07-30`. It simplified
the backend structure, replaced Pino HTTP logging with Morgan, removed
confirmed placeholders and E2E duplication, and kept R1-P02 contracts frozen.
Final completion gates passed after a trailing-whitespace fix in `src/app.ts`.
This approval does not authorize commit, push, merge, deployment, or production
migration. At that completion point, R1-P03 had not been activated.

## Completed phase — R1-P02

R1-P02 (`Complete Authentication & Identity`) is **Complete** as of
`2026-07-29`, by human-owner authorization in the phase completion prompt.
At that completion point, the one-active-phase rule kept R1-P03 inactive.

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
and independent review evidence are recorded in the phase artifacts.
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
approval are recorded. R1-P03 was inactive at that recorded completion point.

## Completed phase — R1-P01

R1-P01 (`Project Foundation & Country Configuration`) is **Complete** as of `2026-07-24` by human-owner approval. Evidence:

- All 96 tasks complete (`specs/R1-P01-project-foundation-country-configuration/tasks.md`)
- Final independent review verdict `APPROVED` (`specs/R1-P01-project-foundation-country-configuration/review-report.md`)
- All prior BLOCKER and MAJOR findings resolved (`specs/R1-P01-project-foundation-country-configuration/review-resolution.md`)
- All required non-database quality gates passed (typecheck, lint, unit/integration/e2e tests, coverage, prisma validate, docs check, OpenAPI validate, build)
- Coverage passed above configured thresholds
- Historical isolated clean-database migration and double-seed proof remains valid
- The historical clean-database proof remained conditional on an explicit safe
  test target
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
