# Implementation Plan: R1-P05 Provider Onboarding, Profile & Lifecycle

**Branch**: `R1-P05-provider-onboarding-profile-lifecycle` | **Date**:
2026-08-10 | **Spec**: [spec.md](./spec.md)

**Input**: Clarified feature specification in
`specs/R1-P05-provider-onboarding-profile-lifecycle/spec.md`

**Planning status**: Phase 0 research and Phase 1 design in progress. Product
implementation, Prisma edits, migration creation/application, and tests remain
stopped until the human starts the separate implementation step.

## Summary

R1-P05 introduces a `providers` business module that lets a verified Individual
or Company create one Provider application, complete a private reviewed profile
and controlled media, pass Staff Admin review, gain Provider OWNER authority,
invite Provider ADMINs, and understand profile completion separately from
cross-phase marketplace readiness.

The module owns Provider business persistence and workflows. It consumes narrow
public contracts from Authentication, Customers, Configuration, Media, Admin,
and Email. `ProviderApprovalService` owns the atomic approval
transaction; Authentication remains the only mapper of identity categories and
global role grants, and Admin remains the only mapper of `audit_logs`.

R1-P05 provides authenticated provider and Staff Admin APIs plus token-body
invitation onboarding. It provides no anonymous Browse surface, no Company
document checklist, no workers/services/coverage, no generic settings store,
and no operational path to `LIVE`.

## Technical Context

**Language/Version**: Node.js 24+ with TypeScript 6

**Primary Dependencies**: Express 5, Zod 4, Prisma 7 with PostgreSQL,
Cloudinary SDK, Multer memory storage, Sharp, Nodemailer through `EmailPort`,
existing JWT/cookie authentication and rate limiting

**Storage**: PostgreSQL through one forward-only phase migration
`r1_p05_provider_onboarding_profile_lifecycle`; Cloudinary for Provider image
and video bytes; no local filesystem or second database

**Testing**: Vitest and Supertest; isolated PostgreSQL proof database; Cloudinary
and email contract fakes; no Docker or Testcontainers

**Target Platform**: Linux-hosted single backend process

**Project Type**: One deployable modular-monolith REST web service

**Performance Goals**: Deterministic cursor pages default 20/max 100; bounded
dashboard/settings queries; no unbounded fan-out; invariant-focused concurrent
acceptance workload; media/provider latency excluded from open DB transaction
time

**Constraints**: Exactly one active phase; no public Browse; no `LIVE`
transition; private direct contacts never leave authorized private views;
`PROVIDER_OWNER` is staff-granted only; one owned Provider per user; mandatory
review email intent is durable; implementation and Git operations are not part
of this planning run

**Scale/Scope**: 13 user stories, FR-001–FR-086, SC-001–SC-015, two provider
kinds, 10 profile-completion checks, 11 readiness gates, 12 images plus 2
videos per Provider, and a cursor-paginated Staff queue

## Constitution Check

### Pre-research gate

| Principle / gate | Status | Evidence |
|---|---|---|
| I. Standalone greenfield | PASS | Uses only repository schema/contracts and documented Cloudinary/email adapters |
| II. One active phase and traceability | PASS | `docs/product/current.md` points only to R1-P05; spec FR/SC and tasks remain phase-local |
| III. Modular monolith ownership | PASS | New `providers` owner; all cross-module access is through named public ports |
| IV. Global design/local implementation | PASS | Master ERD assigns Provider supply to `providers`; only R1-P05 rows are planned |
| V. Canonical product truth | PASS | DEC-036 plus five recorded human clarifications; OQ-007 remains R1-P06 |
| VI. Backend authority/security | PASS | Server-derived identity/scope/completion, strict transitions, CAS, audit, token hashing, private DTOs |
| VII. Risk-proportional tests | PASS | Unit, API/DB, migration, concurrency, idempotency, media, email, privacy, and regression proof planned |
| VIII. Human-controlled operations | PASS | Planning only; no implementation, Git, deployment, credentials, or production operation |
| IX. Locked release boundaries | PASS | No Docker/cloud platform work, wallet, payment, payout, or future-phase product model |
| X. Immutable migrations | PASS | One proposed additive migration; existing migrations remain untouched |

No exception requires Complexity Tracking.

## Architecture and Ownership

### Module map

```text
providers       -> Provider/application/profile/contact/member/invitation/
                   gallery/history/outbox persistence and all R1-P05 workflows
authentication  -> identity/category/role/OTP truth and transaction-bound
                   Provider authority writer
customers       -> authoritative Individual/Company applicant profile reader
configuration   -> active-country resolution
media           -> media_files, Sharp normalization, Cloudinary store/delivery,
                   provider video metadata/thumbnail and cleanup
admin           -> audit_logs writers
email           -> EmailPort transport only; providers owns templates/intents
composition     -> injects public ports and transaction-bound factories
```

Dependencies point from `providers` to named public contracts only. No provider
service imports another module's repository, controller, schema, Prisma model,
or infrastructure implementation. `composition.ts` is the only place that
wires infrastructure factories.

### Provider application services

| Service / policy | Ownership |
|---|---|
| `ProviderApplicationService` | create, retrieve, change never-submitted kind, submit/resubmit, application-owner policy |
| `ProviderProfileService` | bilingual profile/private contacts, active-country validation, post-approval edits |
| `ProviderMediaService` | slot/count/CAS rules and Media public contract orchestration |
| `ProviderReviewQueryService` | staff queue and private dossier reads |
| `ProviderReviewService` | staff request-changes/reject transactions |
| `ProviderApprovalService` | complete atomic approval transaction |
| `ProviderLifecycleService` | staff suspend/reinstate with `INACTIVE` restoration |
| `ProviderMembershipService` | exact-scope OWNER/ADMIN reads and soft-disable/reconciliation |
| `ProviderInvitationService` | invite/resend/revoke/inspect lifecycle |
| `ProviderInvitationAcceptanceService` | existing/new user atomic acceptance |
| `ProviderInvitationOnboardingService` | restricted fixed-email identity orchestration |
| `ProviderInvitationDeliveryService` | post-commit one-shot raw-token delivery |
| `ProviderCompletionPolicy` | fixed `r1-p05-v1` ten-check percentage and missing codes |
| `ProviderReadinessPolicy` | eleven structured gates and owning-phase blockers |
| `ProviderDashboardQuery` | bounded dashboard aggregate and next action |
| `ProviderSettingsQuery` | derived capability/settings aggregate; no settings table |
| `ProviderEmailOutboxDispatcher` | bounded post-commit mandatory email delivery |

### Public module contracts

1. `providers/providers.public.ts`: future phase-safe Provider identity/status,
   membership scope, readiness, and owner resolution reads. It exposes no
   repository or raw persistence model.
2. `authentication/authentication.public.ts`: existing principal types plus
   `ProviderIdentityReader`, invitation-only identity onboarding, and
   transaction-bound `ProviderIdentityAuthorityWriter`.
3. `customers/customers.public.ts`: matching verified Individual/Company
   profile context for provider eligibility/review.
4. `configuration/configuration.public.ts`: active country lookup.
5. `media/media.public.ts`: provider image/video processing, store, signed
   delivery/thumbnail, pending-delete, and cleanup.
6. `admin/audit.public.ts`: business-neutral general/denial audit ports; factory
   implementation remains wired only by composition.

See [contracts/module-public-contracts.md](./contracts/module-public-contracts.md).

### Transaction ownership

`providers` owns every Provider business transaction.

- Application creation uses a unique application-owner constraint plus a short
  transaction; identical retries return the existing Provider.
- Submission locks/rechecks Provider version, validates all ten checks plus
  READY media, increments the Provider review-cycle counter, records
  history/audit, and inserts an
  email intent atomically.
- Approval is one Provider-owned transaction with providers repositories,
  Authentication's transaction-bound authority writer, Admin's transaction-
  bound audit writer, and the email outbox.
- Invitation acceptance consumes the invitation, creates/reactivates ADMIN
  membership, reconciles `provider_admin`, and writes audit atomically. It
  creates no durable invitation-email intent.
- Media and email external calls always occur outside Prisma transactions and
  use reservation/finalization or outbox compensation.

See [contracts/transaction-boundaries.md](./contracts/transaction-boundaries.md).

## HTTP API Design

All paths are below `/api/v1`, use bearer/cookie access authentication where
shown, validate with Zod, and return Cleanora envelopes. Mutable commands require
`expectedVersion`; raw invitation tokens are request-body fields and are
redacted from logs.

### Applicant / Provider scope

| Method | Path | Actor / purpose |
|---|---|---|
| POST | `/providers` | verified Individual/Company creates or retrieves its single draft |
| GET | `/providers` | list Providers accessible as Application Owner, OWNER, or ADMIN |
| GET | `/providers/{providerId}` | private safe aggregate |
| PATCH | `/providers/{providerId}/kind` | Application Owner, never-submitted draft only |
| GET | `/providers/{providerId}/profile` | authorized profile read |
| PUT | `/providers/{providerId}/profile` | editable profile full replacement with CAS |
| GET | `/providers/{providerId}/contacts` | authorized private operational contacts |
| PUT | `/providers/{providerId}/contacts` | private operational contacts full replacement with CAS |
| GET | `/providers/{providerId}/media` | safe slot/gallery references and signed delivery |
| PUT | `/providers/{providerId}/media/logo` | replace logo reservation/upload/finalize |
| PUT | `/providers/{providerId}/media/cover` | replace cover reservation/upload/finalize |
| POST | `/providers/{providerId}/media/gallery-images` | add one gallery image |
| POST | `/providers/{providerId}/media/gallery-videos` | add one gallery video |
| PUT | `/providers/{providerId}/media/gallery-order` | reorder current gallery items |
| DELETE | `/providers/{providerId}/media/logo` | clear logo slot and schedule cleanup |
| DELETE | `/providers/{providerId}/media/cover` | clear cover slot and schedule cleanup |
| DELETE | `/providers/{providerId}/media/gallery/{galleryItemId}` | remove gallery item and schedule cleanup |
| GET | `/providers/{providerId}/completion` | policy version, percentage, checks, missing codes |
| GET | `/providers/{providerId}/readiness` | structured readiness gates |
| POST | `/providers/{providerId}/application/submit` | Application Owner submit/resubmit |
| GET | `/providers/{providerId}/history` | application/operational status history |
| GET | `/providers/{providerId}/dashboard` | bounded owner/admin summary and next action |
| GET | `/providers/{providerId}/settings` | derived settings/capability aggregate |
| GET | `/providers/{providerId}/preview` | protected contact-free preview |

### Members and invitations

| Method | Path | Actor / purpose |
|---|---|---|
| GET | `/providers/{providerId}/members` | OWNER lists OWNER/ADMIN memberships |
| DELETE | `/providers/{providerId}/members/{userId}` | OWNER soft-disables ADMIN only |
| GET | `/providers/{providerId}/admin-invitations` | OWNER lists safe invitation metadata |
| POST | `/providers/{providerId}/admin-invitations` | approved OWNER creates and sends one-time email invite |
| POST | `/providers/{providerId}/admin-invitations/{invitationId}/resend` | OWNER rotates token/expiry |
| POST | `/providers/{providerId}/admin-invitations/{invitationId}/revoke` | OWNER revokes pending invite |
| POST | `/provider-admin-invitations/inspect` | safe token inspection; no authority grant |
| POST | `/provider-admin-invitations/onboarding/start` | unknown email starts fixed-email identity onboarding |
| POST | `/provider-admin-invitations/onboarding/verify-email` | verifies invitation-bound email challenge |
| POST | `/provider-admin-invitations/accept` | authenticated matching verified user accepts exactly once |

### Staff Admin

| Method | Path | Permission / purpose |
|---|---|---|
| GET | `/staff/providers/applications` | `providers.applications.review`; cursor queue/filters |
| GET | `/staff/providers/applications/{providerId}` | private dossier/current cycle/history |
| POST | `/staff/providers/applications/{providerId}/approve` | atomic approval |
| POST | `/staff/providers/applications/{providerId}/request-changes` | reasoned return to editable state |
| POST | `/staff/providers/applications/{providerId}/reject` | reasoned terminal rejection |
| POST | `/staff/providers/{providerId}/suspend` | `providers.lifecycle.manage`; reasoned suspension |
| POST | `/staff/providers/{providerId}/reinstate` | reasoned restoration to `INACTIVE` only |

Exact request/response/error schemas are in
[contracts/provider-api.openapi.yaml](./contracts/provider-api.openapi.yaml) and
[contracts/provider-api.md](./contracts/provider-api.md).

## Persistence and Migration Strategy

The proposed forward-only migration is
`r1_p05_provider_onboarding_profile_lifecycle`.

Provider-owned tables:

- `providers`
- `provider_profiles`
- `provider_contacts`
- `provider_status_history`
- `provider_members`
- `provider_admin_invitations`
- `provider_gallery_items`
- `provider_email_outbox`

The migration creates exactly eight Provider tables. It also adds Provider
enums, additive Authentication permission seeds, the invitation OTP purpose,
nullable `otp_codes.account_category` with a strict purpose-shape CHECK, the
intentional removal of `users_categories_nonempty_check` for Authentication-
owned categoryless invitation identities, and Provider media owner/status
values.
Completion, readiness, dashboard, and settings remain derived.

The SQL review must verify:

- one application owner and one owner user across Providers;
- one active OWNER per Provider and one membership per Provider/user;
- one active invitation per Provider/normalized email;
- one logo and one cover slot, gallery type/count enforced by service plus
  concurrency locks;
- positive versions/cycle numbers/positions/byte sizes;
- status/domain consistency and reason requirements;
- token verifier uniqueness and no raw token column;
- outbox idempotency uniqueness and bounded retry indexes;
- all FKs use `RESTRICT` or phase-approved `SET NULL`, never cascading away
  history.

See [data-model.md](./data-model.md). No existing migration is edited and no
future-phase table or field is created.

## Media and External I/O

Provider images use the existing Cloudinary configuration plus a dedicated
Provider folder configuration. Accepted input is normalized to fixed WebP
presentation dimensions. Videos remain MP4/WebM, at most 40 MiB and 1080p;
Cloudinary metadata is authoritative after upload. The 60-second value is UX
guidance only.

Pending/PROCESSING reservations count toward limits. Only READY media counts toward
completion. Upload failure or failed post-upload validation preserves the prior
READY logo/cover, marks the new media FAILED/cleanup-eligible, and returns a safe error.
All delivery URLs are short-lived signed URLs produced after Provider
authorization. Storage keys never enter DTOs, audit context, or logs.

## Mandatory Email Delivery

Application submitted, changes requested, approved, rejected, suspended, and
reinstated intents are mandatory and cannot be disabled.
Providers inserts a unique outbox intent in the same transaction as the
business change. A bounded in-process dispatcher uses `EmailPort` after commit,
records safe outcomes, and retries after 1 minute, 5 minutes, 30 minutes,
2 hours, and 12 hours. The fifth failed attempt becomes terminal `FAILED` and
requires explicit operational repair; review responses do not wait for SMTP.

Admin-invitation raw tokens are never durable outbox payloads. The random token
is sent from memory immediately after the invitation transaction commits. A
failed delivery records safe resend-required state; OWNER resend rotates the
verifier/token/expiry before trying again.

This does not introduce R1-P23 notification preferences/history, push/SMS,
BullMQ, Redis, Docker, or a generic notification subsystem.

## Authorization, Audit, Privacy, and Failure Semantics

- Authentication middleware supplies the trusted principal; active state and
  non-verification-only capability are mandatory.
- Invitation email verification yields a restricted authenticated onboarding
  principal that may call only invitation acceptance/session cleanup. After
  acceptance, Authentication can grant full capability from its own enabled
  `provider_admin` role; exact active Provider membership remains a Providers-
  owned authorization check. Authentication never reads Provider tables.
- Application ownership, membership, provider kind/status, and Staff permission
  are server-read for each operation.
- Private contacts are present only in authorized private DTOs and Staff dossier.
  Preview and every future customer-facing DTO use a separate allowlisted type.
- Staff decisions and membership/invitation mutations append status/history and
  audit in the business transaction. Safe denials may append non-transactional
  denial evidence.
- Invitation verifiers are keyed/hashed, compared safely, rotated on resend,
  single-use, and never returned after creation/email handoff.
- Stable errors cover validation, authentication, eligibility, ownership/scope,
  private not-found, stale version, state transition, media, invitation,
  dependency, and unexpected failure without Prisma/Cloudinary/SMTP leakage.
- Rate limits apply to draft creation, submission, staff decisions, invitation
  send/resend/inspect/accept, onboarding OTP, and media upload.

## Testing Strategy

Tests are mandatory because the specification and owner require full proof.

- Unit: provider-kind eligibility, transition matrices, Application Owner and
  membership policies, 10-check completion, 11-gate readiness, reason rules,
  media limits, invitation token lifecycle, dashboard next-action logic, and
  safe DTO/redaction.
- Integration/API (including end-to-end Supertest journeys): every endpoint success plus validation/auth/state/scope
  failure, Staff queue filters/cursors, private contact omission, post-approval
  edit behavior, suspend/reinstate, and notification intent insertion.
- Transaction/concurrency: duplicate create, submit, approval, gallery limit,
  resend-vs-accept, accept-vs-revoke, repeated acceptance, membership role
  reconciliation, audit/outbox rollback, and stale version.
- External adapters: fake Cloudinary/image/video metadata and EmailPort; no live
  credentials in automated tests. A separately authorized manual smoke may use
  configured development credentials but is not required for planning.
- Migration: Prisma validate/generate, SQL review, isolated clean deploy,
  double-seed, constraints/index probes, and all earlier-phase compatibility
  suites.
- Documentation: OpenAPI, Postman generation/validation, docs check, typecheck,
  lint, build, unit, integration, coverage, and `git diff --check`. The
  repository has no separate `test:e2e` command; end-to-end journeys remain
  integration suites.

Runnable scenarios and expected results are in [quickstart.md](./quickstart.md).

## Project Structure

### Documentation

```text
specs/R1-P05-provider-onboarding-profile-lifecycle/
├── activation.md
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── implementation-prompt.md
├── checklists/requirements.md
├── contracts/
│   ├── README.md
│   ├── provider-api.md
│   ├── provider-api.openapi.yaml
│   ├── module-public-contracts.md
│   └── transaction-boundaries.md
└── tasks.md
```

### Expected implementation placement

```text
src/
├── composition.ts
├── routes/index.ts
├── config/env.ts
├── modules/
│   ├── providers/
│   │   ├── providers.routes.ts
│   │   ├── providers.controller.ts
│   │   ├── providers.schema.ts
│   │   ├── providers.public.ts
│   │   ├── provider-application.service.ts
│   │   ├── provider-profile.service.ts
│   │   ├── provider-media.service.ts
│   │   ├── provider-review-query.service.ts
│   │   ├── provider-review.service.ts
│   │   ├── provider-approval.service.ts
│   │   ├── provider-lifecycle.service.ts
│   │   ├── provider-membership.service.ts
│   │   ├── provider-invitation.service.ts
│   │   ├── provider-invitation-acceptance.service.ts
│   │   ├── provider-invitation-onboarding.service.ts
│   │   ├── provider-invitation-delivery.service.ts
│   │   ├── provider-projection.service.ts
│   │   ├── provider-email-dispatcher.ts
│   │   ├── domain/
│   │   └── infrastructure/
│   ├── authentication/       # additive public reader/writer/onboarding ports
│   ├── customers/            # additive applicant-profile public reader
│   ├── configuration/        # additive active-country public reader
│   ├── media/                # additive Provider media capabilities
│   └── admin/                # additive named audit public entry point
└── integrations/email/       # Provider template adapter only if required

prisma/
├── schema.prisma
└── migrations/<timestamp>_r1_p05_provider_onboarding_profile_lifecycle/migration.sql

scripts/seed.ts

tests/
├── unit/modules/providers/
├── integration/providers/
└── helpers/

docs/apis/openapi/r1-p05-provider-onboarding-profile-lifecycle.yaml
scripts/generate-r1-p05-postman.ts
```

**Structure Decision:** Extend the existing compact single-project modular
monolith. One new `providers` module owns the business slice; existing modules
receive only narrow additive public capabilities.

## Post-design Constitution Re-check

| Gate | Status | Design evidence |
|---|---|---|
| Canonical alignment | PASS | Five clarifications integrated; no OQ-007 invention |
| Module ownership | PASS | Provider transaction owner and participant ports named; no cross-repository access |
| Incremental data | PASS | Only R1-P05 tables/enums/outbox; future readiness remains derived |
| Security/integrity | PASS | CAS, locks, uniqueness, token hashing, private DTOs, audit, outbox |
| Tests/evidence | PASS | All introduced risk classes have planned deterministic proof |
| Human controls | PASS | Implementation, Git, migration application, external credentials, and deployment remain stopped |

No constitutional violation or undocumented complexity exception remains.

## Complexity Tracking

No constitution violation requires justification. The Provider email outbox is
phase-owned because mandatory durable notices cannot be guaranteed by a direct
post-commit SMTP call; a generic R1-P23 notification subsystem was explicitly
rejected as future scope.

## Phase Outputs

- Phase 0: [research.md](./research.md)
- Phase 1: [data-model.md](./data-model.md), [contracts/](./contracts/),
  [quickstart.md](./quickstart.md)
- Phase 2: [tasks.md](./tasks.md) from `speckit-tasks`
- Pre-implementation: read-only `speckit-analyze` rerun `CLEAN` after planning
  remediation, then [implementation-prompt.md](./implementation-prompt.md)

## Next Gate

Planning is complete and the remediated cross-artifact analysis is `CLEAN`.
`/speckit-implement` is the next command, but it has not run and must not run in
this planning session. Use [implementation-prompt.md](./implementation-prompt.md)
for the separately executed implementation handoff.
