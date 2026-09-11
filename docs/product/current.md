# Cleanora — Current Work

| Field | Value |
|---|---|
| Current Release | Release 1 — Core Marketplace |
| Current Phase | R1-P13 — Booking Draft, Pricing Snapshot & Status Machine |
| Status | **Active** — **READY_FOR_OWNER_REVIEW** (fresh Codex re-review PASS; DEC-092 retained as history); feature-branch publication via owner `commit and push`; not Complete |
| Backend Owner | Cursor (implementation); Codex PM ACCEPT_IMPLEMENTATION (DEC-091); fresh owner-requested Codex re-review PASS |
| Local Checkout | `codex/r1-p13-booking-draft-pricing-snapshot-status-machine` |
| Verified Main | `origin/main` remains the P12-merged baseline (`1d57714`); this workflow does not merge |
| Started At | 2026-09-10 |
| Completed At | — |
| Last Updated | 2026-09-11 — owner `commit and push` of the R1-P13 working tree to the feature branch; not Complete; no merge or production migration |

## Active phase — R1-P13

R1-P13 is the sole active phase and is at **READY_FOR_OWNER_REVIEW**. Cursor
implemented accepted tasks T001–T038. Codex PM accepted implementation
(DEC-091). The historical delegated Codex FAILs were repaired in tree; DEC-092
records the temporary owner substitution after the earlier usage-time limit.
The owner's new review request enabled a fresh Codex re-review on 2026-09-11,
which passed with no unresolved finding. Final-byte SC-010 proofs also passed
against disposable `cleanora_r1_p13_proof`. Owner `commit and push` publishes
the feature branch only. This workflow does not mark R1-P13 Complete, merge,
deploy, or run a production migration.

Canonical artifacts: `specs/R1-P13-booking-draft-pricing-snapshot-status-machine/`.

No payments capture, ledger, wallets, assignment execution, order fulfillment
HTTP, Recommended path, maps, Docker, or cloud.

## Most recently completed phase — R1-P12

R1-P12 is **Complete** under DEC-090: the owner instructed activation of R1-P13
after the combined P11-follow-up + P12 review **PASS** (DEC-089). Guest and
customer REST discovery of eligible providers via the P11 Browse facade remains
the shipped Browse HTTP under DEC-086. DEC-087 remains the historical Codex
substitution record. P12 is already on `origin/main` via PR #13. This
`commit and push` publishes the remaining P12 leftovers together with the
R1-P13 working tree to the phase feature branch only.

Canonical artifacts:
`specs/R1-P12-browse-marketplace-provider-details/` (see
`completion-report.md`, `review-report.md`).

## Previously completed phase — R1-P11

R1-P11 is **Complete** under DEC-062 delegated Codex completion authority,
recorded as DEC-085, after live evaluate/Browse proofs, phase coverage, and
disposable clean + upgrade migration validators passed.

Delivered scope is an in-process Eligibility Engine V1: discovery and explicit
`evaluateEligibility`, Browse-safe `getStandardBrowseCandidates` without HTTP,
720-hour `purgeExpiredEvaluations`, immutable Egypt rule-version seed, and
phase-owned migration `r1_p11_eligibility_engine_v1`. Catalog, Configuration,
and Providers remain fact owners. Zero new HTTP operations. Browse marketplace
HTTP remains P12 and is **not** activated from this phase.

Final evidence: 24 files / 131 phase tests; coverage 91.84 / 86.98 / 93.57 /
91.75; clean 18-migration / 96-table install; populated P10→P11 upgrade;
review verdict PASS. DEC-078 inherited `test:unit` and whole-tree lint
failures are reported, not relabeled. Closure:
`specs/R1-P11-eligibility-engine-v1/completion-report.md`.

Git publication of the feature branch does not authorize merge, deploy, or a
production migration.

## Previously completed phase — R1-P10

R1-P10 is **Complete** under DEC-061. The owner explicitly approved
`R1-P10 — Availability, Capacity & Textual Coverage as Complete` on 2026-09-09
after the final PASS handoff.

Delivered scope covers textual country/city/district coverage, Provider/Worker
schedules and exceptions, complete-Team capacity, temporary Provider pause,
configuration readiness and internal operational evaluation. Coordinates,
radius, customer/anonymous evaluation HTTP, Browse, Booking/reservations,
wallet behavior, Docker and cloud remain excluded. DEC-053 through DEC-060 are
the locked product decisions.

Final Codex adversarial review repaired recognized-IANA validation, one-way
city/district matching and Provider-country scoping, DST offset-transition
projection, expired-pause restart, aggregate workforce versioning, and stable
locality constraint errors. Fresh Phase 10 evidence passes 43 test files / 301
tests, all four coverage thresholds, clean and populated-upgrade migration
proofs, module boundaries, phase-scoped lint, typecheck, build, Prisma, OpenAPI,
Postman, documentation and whitespace checks. All 77 tasks are checked and
Companion records `implement/completed` through its canonical writer.

Closure: `specs/R1-P10-availability-capacity-textual-coverage/completion-report.md`.
Local-only files and inherited Phase 8/9 edits remain preserved. Completion did
not stage, commit, push, merge, deploy or run a production migration. Git
publication still requires a new human message exactly equal to
`commit and push`.

## Previously completed phase — R1-P09

R1-P09 is Complete under DEC-052: the owner's instruction to advance to Phase 10
follows the verified PASS review and merged publication. Commit 47fdf53 is
contained in origin/main at 19d4b00; merge and feature trees are identical.
The remote codex feature branch has been deleted.

All 84 tasks are checked; all eight findings resolved; Phase 9 tests (168), full
regression tests (1894), five supplemental tests, both coverage gates,
clean/upgrade migration proofs, build and artifact checks passed. Companion is
implement/completed. No separate Claude review is claimed.

Closure: specs/R1-P09-provider-services-pricing-historical-snapshots/completion-report.md.
Earlier implementation/review records retain their historical approval state;
the completion report and DEC-052 record the subsequent owner transition.

## Previously completed phase — R1-P08

R1-P08 (`Catalog, Localization & Service Requirements`) is **Complete** as of
`2026-09-03`, by explicit human-owner instruction:

```text
mark it as complete now
```

DEC-041–DEC-045 remain the canonical product and closeout decisions; DEC-046
records completion and the unchanged Git/production boundaries.

Delivered behavior includes staff-admin-only protected Catalog management for
localized categories and services, closed Release 1 field kinds, price units,
lifecycle/order/country availability, Media associations through the Media
public contract, actor-scoped command/idempotency/audit safety, DEC-044 Egypt
seed composition, and an internal selectable/snapshot `CatalogDefinitionReader`.
No anonymous Browse HTTP, Provider pricing, Booking mutation, wallet behavior,
frontend application, Docker, cloud, or production work was introduced.

Final evidence:

- FR-001–FR-052 and SC-001–SC-012 map to completed tasks T001–T156;
- clean chronological installation passed with 15 migrations and 76 exact
  public tables, including live constraint probes and double-seed idempotency;
- populated R1-P07 upgrade preserved baseline digests and workforce truth;
- R1-P08 tests passed: 54 files / 333 tests / 0 skipped, with phase coverage
  85.41% statements, 76.04% branches, 83.37% functions, and 85.21% lines;
- under DEC-045, full integration passed: 169 files passed / 3 skipped,
  601 tests passed / 5 skipped;
- full repository coverage passed at 83.69% statements, 75.03% branches,
  86.46% functions, and 85.61% lines;
- Prisma, typecheck, lint, build, OpenAPI, Postman, documentation, module
  boundaries, privacy/redaction, and both migration validators passed;
- independent review finding M-04 is resolved; no unresolved BLOCKER or MAJOR
  remains.

Canonical completion artifacts:

- `specs/R1-P08-catalog-localization-service-requirements/spec.md`
- `specs/R1-P08-catalog-localization-service-requirements/plan.md`
- `specs/R1-P08-catalog-localization-service-requirements/tasks.md`
- `specs/R1-P08-catalog-localization-service-requirements/contracts/`
- `specs/R1-P08-catalog-localization-service-requirements/migration-review.md`
- `specs/R1-P08-catalog-localization-service-requirements/migration-evidence.md`
- `specs/R1-P08-catalog-localization-service-requirements/module-boundary-review.md`
- `specs/R1-P08-catalog-localization-service-requirements/security-validation.md`
- `specs/R1-P08-catalog-localization-service-requirements/review-resolution.md`
- `specs/R1-P08-catalog-localization-service-requirements/implementation-summary.md`
- `specs/R1-P08-catalog-localization-service-requirements/implementation-review-report.md`
- `specs/R1-P08-catalog-localization-service-requirements/completion-report.md`
- DEC-041–DEC-046

R1-P08 was subsequently committed and merged into `origin/main` through PR #8
at merge commit `e3383fb` (feature commit `879f1ed`). That Git publication did
not authorize deployment or production migration. R1-P09 was separately
activated for specification preparation on `2026-09-04`.

## Previously completed phase — R1-P06

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

R1-P06 was merged into `origin/main` through PR #6 at `5d466f09`. No phase is
active after its closure. That merge and the later documentation-only
preparation record do not authorize deployment, production configuration or
migration, real external wallet or bank operations, destructive cleanup,
R1-P07 activation, or further Git actions.

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

## Previously completed phase — R1-P07

R1-P07 (`Worker, Team & Crew Management`) is **Complete** as of 2026-08-24.
The human owner explicitly instructed Codex to complete the phase, make it
ready for Git publication, and mark it completed after the implementation and
evidence review. DEC-038 and DEC-039 remain the canonical product decisions;
DEC-040 records completion and the unchanged Git/production boundaries.

Delivered behavior includes Provider-owned Worker profiles and engagements,
restricted localized invitations, identity/access/role reconciliation, private
avatars, Worker/Admin/access lifecycle commands, closed reason catalogs,
immutable safe history, notification intents, Teams and membership history,
primary-Supervisor scope, Escort and final-cleaner invariants, optimistic
versions/idempotency, and transaction-consistent `workersReady` facts. No
separate Workers module, Booking assignment, payroll, payout scheduling,
attendance, public Worker surface, frontend, Docker, cloud, or production work
was introduced. No new environment variable is required.

Final evidence:

- FR-001–FR-088 and SC-001–SC-014 map to completed tasks T001–T156;
- clean chronological installation passed with 14 migrations and 67 exact
  public tables, including live constraint probes and double-seed idempotency;
- populated R1-P06 upgrade preserved all baseline table digests and existing
  Provider/member/Media/outbox/verification/payout truth;
- R1-P07 tests passed: 79 files / 330 tests, with phase coverage 85.17%
  statements, 76.80% branches, 84.86% functions, and 88.16% lines;
- full integration passed: 149 files / 497 tests;
- full repository coverage passed: 336 files / 1,405 tests, with 83.50%
  statements, 75.31% branches, 86.00% functions, and 85.80% lines;
- Prisma, typecheck, lint, build, OpenAPI, Postman, documentation, diff,
  architecture, privacy, redaction, and concurrency gates passed;
- the accepted final read-only Claude review has no unresolved BLOCKER or
  MAJOR, and every applicable finding was independently remediated by Codex;
- Companion records the implementation and terminal completion state.

Canonical completion artifacts:

- `specs/R1-P07-worker-team-crew-management/spec.md`
- `specs/R1-P07-worker-team-crew-management/plan.md`
- `specs/R1-P07-worker-team-crew-management/tasks.md`
- `specs/R1-P07-worker-team-crew-management/contracts/`
- `specs/R1-P07-worker-team-crew-management/migration-review.md`
- `specs/R1-P07-worker-team-crew-management/migration-evidence.md`
- `specs/R1-P07-worker-team-crew-management/module-boundary-review.md`
- `specs/R1-P07-worker-team-crew-management/security-validation.md`
- `specs/R1-P07-worker-team-crew-management/review-resolution.md`
- `specs/R1-P07-worker-team-crew-management/implementation-summary.md`
- `specs/R1-P07-worker-team-crew-management/implementation-review-report.md`
- `specs/R1-P07-worker-team-crew-management/completion-report.md`
- DEC-038, DEC-039, and DEC-040

The disposable proof cluster is stopped and deleted after the final database
gate; the repository `.env` database and installed PostgreSQL service were not
modified. The feature branch preserves the dirty worktree and remains unstaged,
uncommitted, unpushed, unmerged, and undeployed. Completion is not Git
authorization: publication requires a new human message exactly equal to
`commit and push`. At the recorded R1-P07 closure, no subsequent phase was
active; R1-P08 was separately activated on 2026-08-30.

### 2026-08-27 frontend handoff addendum

The completed phase now also includes a consistent 19-image desktop-website UX
handoff under `docs/design/r1-p07/web-ux-v2/`, including complete Owner/Admin,
invited-person, Worker, and primary-Supervisor flows. Every functional screen
shows its used API surface, and the companion Arabic guide documents all 25
R1-P07 HTTP operations with request/response examples, authorization,
optimistic-version/idempotency rules, errors, and frontend usage.

The handoff review found and fixed stale generated Postman worker field names,
then expanded Postman validation so generated bodies execute against the
runtime Zod schemas. It also reconciled the worker list/default/full-replace,
Team command-response, pagination, and Provider aggregate-version contracts.
Four UX references were corrected to remove unsupported filters/export actions
and to use the executable state/event vocabulary.

Fresh non-database revalidation passed typecheck, lint, build, Prisma, OpenAPI,
Postman, docs, Git diff, all 911 unit tests, and 329 R1-P07 tests. The R1-P07
coverage rerun passed at 85.19% statements, 76.51% branches, 84.86% functions,
and 88.17% lines. `npm audit --audit-level=high` also passed with zero
vulnerabilities after compatible lockfile updates and scoped patched
Prisma-tooling overrides, without the proposed forced Prisma downgrade. A new
broad integration attempt was not accepted as fresh
evidence because legacy P04-P06 database suites timed out against the currently
configured, non-proof PostgreSQL target; it was stopped rather than treating an
unknown `.env` database as an approved disposable test database. The successful
2026-08-24 clean/upgrade migration, full integration, global coverage, review,
and owner-completion evidence above remains the canonical phase-completion
proof. The addendum does not reopen the phase or authorize any Git action.

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
