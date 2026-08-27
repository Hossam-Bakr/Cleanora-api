# Implementation Plan: Worker, Team & Crew Management

**Branch**: `r1-p07-worker-team-crew-management` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

**Input**: R1-P07 specification, DEC-038, DEC-039, canonical product rules, and
the owner's authorization to prepare through analysis and stop before
`speckit-implement`.

## Summary

Extend the existing Providers module with Provider-owned Worker engagements,
operational profiles, invitations/access projections, skills, Teams,
memberships, primary-Supervisor assignment, history, idempotency records,
localized notification intents, and a derived `workersReady` projection.
Authentication keeps identity, credential, session, global-role, preference,
and recent-authentication ownership; Media keeps private avatar processing and
delivery; Admin exposes transaction-bound safe audit writers. Cross-module work
uses explicit public contracts injected at composition, with Providers owning
each business transaction. The future implementation will add one forward-only
migration named `r1_p07_worker_team_crew_management`; this planning run does not
change Prisma or execute any database command.

## Technical Context

**Language/Version**: Node.js 24+, TypeScript 6.0, CommonJS package with ESM-style `.js` imports

**Primary Dependencies**: Express 5.2, Zod 4.4, Prisma 7.9 with PostgreSQL adapter, Sharp 0.35, Cloudinary 2.10, Nodemailer 9

**Storage**: Existing PostgreSQL database through centralized `prisma/schema.prisma`; Cloudinary authenticated/private media through Media

**Testing**: Vitest 4, Supertest 7, isolated PostgreSQL integration suites, repository OpenAPI/Postman validators

**Target Platform**: Existing Cleanora modular-monolith HTTP backend

**Project Type**: Single deployable backend modular monolith; no frontend implementation in R1-P07

**Performance Goals**: Preserve bounded cursor-based reads and deterministic indexed command lookups; SC-001 and SC-002 define product journey times, with no invented transport-latency SLO

**Constraints**: Deny by default; exact-Provider scope; full Worker phone never in generic output; no external I/O inside transactions; exact-version CAS; idempotent outcomes; no Docker/Testcontainers in Release 1; no new secret or credential setting

**Scale/Scope**: Eight user stories, FR-001–FR-088 and SC-001–SC-014; Provider-scoped workforce administration and Worker self-service only

## Constitution Check

### Pre-research gate

| Principle | Result | Evidence |
|---|---|---|
| I. Standalone greenfield | PASS | Only repository-owned modules, current schema/migrations, PostgreSQL, SMTP, and Cloudinary are used. |
| II. One active phase and traceability | PASS | `docs/product/current.md` names only R1-P07; all FRs and SCs will map to tasks/evidence. |
| III. Modular-monolith ownership | PASS | Providers owns workforce behavior/persistence; other modules are reached only through public contracts. |
| IV. Global design/local implementation | PASS | Only R1-P07 data is planned; the migration is incremental and phase-owned. |
| V. Canonical truth/no invention | PASS | DEC-038 and DEC-039 are locked; no unresolved question is defaulted. |
| VI. Authority/integrity/security | PASS | Exact scope, CAS, idempotency, safe evidence, token/phone redaction, and atomic outbox writes are explicit. |
| VII. Risk-proportional evidence | PASS | Authorization, lifecycle, concurrency, migration, media, outbox, and privacy tests are planned. |
| VIII. Human controls | PASS | This run stops before implementation and performs no database or further Git operation. |
| IX. Release boundaries | PASS | No Docker/cloud build-out, Cleanora wallet, payout, booking, payroll, or public Worker surface. |
| X. Immutable migrations | PASS | Existing 13 migrations remain untouched; the future migration is additive/forward-only. |

### Post-design gate

PASS. `research.md`, `data-model.md`, the three contract documents,
`authorization-matrix.md`, `migration-plan.md`, `test-strategy.md`, and
`quickstart.md` preserve all ten principles. No exception or complexity waiver
is required. The design documents transaction ownership, lock order, partial
uniqueness, deferred cross-row invariants, notification failure semantics,
private-media sequencing, clean-install proof, and populated R1-P06 upgrade
proof.

## Architecture and Ownership

### Providers owns

- Worker engagement/profile lifecycle, operational phone, type, gender, title,
  Supervisor capability, private avatar association, skills, access projection,
  invitation versions, Teams, memberships, `cleans`, and Supervisor assignment.
- Exact-Provider authorization built from Provider membership plus workforce
  facts; derived `workersReady`; command idempotency; safe history; notification
  intents.
- `ProviderWorkforceService` as application coordinator and
  `PrismaProvidersWorkforceUnitOfWork` as transaction owner. No Workers module
  or shared workforce repository is introduced.

### Authentication owns

- Users, credentials, passwords, sessions, global Worker and
  Provider-Supervisor roles, account activity, `UserPreferences.language`,
  restricted invitation onboarding, and recent-authentication proofs.
- Public additions to `authentication.public.ts`: identity/preference reads,
  restricted onboarding, transaction-bound role reconciliation, and
  transaction-bound consumed-proof recheck. Providers never imports
  Authentication infrastructure or repositories.

### Media owns

- JPEG/PNG/WebP validation, 5 MiB limit, orientation/metadata safety, processed
  WebP up to 1200px, Cloudinary authenticated storage, cleanup, and signed
  private delivery.
- Public additions to `media.public.ts` for Worker-avatar ingest/status,
  delivery, cleanup, and transaction-bound READY ownership validation. Media I/O
  happens outside a transaction; Providers binds the READY media ID with Worker
  profile CAS inside its transaction.

### Admin and Notifications

- Admin owns generic audit storage and exposes safe transaction-bound writers
  from `audit.public.ts`; Providers passes allowlisted before/after facts.
- Providers writes workforce notification intents atomically with accepted
  truth. Its dispatcher calls the existing SMTP adapter outside the transaction
  with leases/retries. Email failure never reverses truth.

## Public HTTP Contract Direction

The design-only OpenAPI contract is
`contracts/provider-workforce-api.openapi.yaml`. It groups Provider management
under `/api/v1/providers/{providerId}/workers` and `/teams`, Worker self-service
under `/api/v1/workers/me`, and token-sensitive onboarding under
`/api/v1/worker-invitations/*`.

Mutations carry `expectedVersion` and `idempotencyKey` in validated bodies.
Stale/competing commands use HTTP 409 and stable safe codes. Owner, Admin, self,
and primary-Supervisor projections are distinct; no raw Prisma record, storage
key, invitation token, audit payload, or unauthorized full phone crosses HTTP.

## Transaction and Lock Strategy

The fixed lock order for multi-row commands is:

1. idempotency identity/advisory key;
2. Provider and exact actor membership;
3. Worker engagement, profile/access/invitation rows by ID;
4. Teams by ascending ID;
5. Team memberships by ascending ID;
6. Provider membership role-reconciliation target;
7. readiness inputs;
8. history, audit, and notification-intent inserts.

Every transaction rechecks versions and authorization after locks. An accepted
command writes business rows, history, audit, idempotent result, role
projection, readiness-visible facts, and notification intent together. A stale,
competing, cancelled, invalid, or denied command commits none of those accepted
effects. External email and Cloudinary I/O never occurs in the transaction.

## Data and Migration Direction

The future migration `r1_p07_worker_team_crew_management` adds only the
enums/models in `data-model.md`, Worker-avatar Media ownership/relations,
required User/Provider opposite relations, and optimistic versioning on
`provider_members`. `providers.workforce_state_version` is the create-command CAS
anchor and is not readiness. SQL includes partial unique indexes for one current identity
engagement, one current Team membership per Worker, and normalized non-archived
Team names, plus deferred constraints for primary-Supervisor and Escort rules.

It must prove chronological clean installation and populated upgrade from the
exact R1-P06 schema. No backfill creates Worker engagements.
`provider_members.version` receives default 1 and non-null enforcement without
changing existing membership meaning. Applied migrations remain immutable.

## Security and Privacy

- Store operational phone as E.164 Provider data. Only Owner/Admin/self/current
  primary Supervisor gets it; other DTOs omit it.
- Invitation links contain invitation ID/version/expiry plus an HMAC signature
  derived with existing `AUTH_VERIFIER_SECRET`, domain separation, and immutable
  invitation fields. The server regenerates and constant-time verifies it.
  Plain tokens never enter persistence/logs; no new env secret is added.
- Resend creates a new version and supersedes prior versions. Locale is
  immutable per version; post-acceptance locale resolves preference → accepted
  invitation locale → `AR`.
- High-risk commands require purpose-bound recent authentication no older than
  10 minutes and transaction-bound proof recheck.
- Avatar delivery is signed/private and exposes no storage key.

## Test and Evidence Strategy

`test-strategy.md` defines unit, PostgreSQL integration, and Supertest coverage
for transitions, actor/phone matrices, token redaction, Escort/final-cleaner
rules, races, idempotency, outbox failure, locale/version behavior,
Authentication/Media contract fakes, OpenAPI/Postman parity, migration proofs,
phase coverage, and module-boundary scans. No Docker/Testcontainers or
production credentials are used.

## Project Structure

### Documentation (this feature)

```text
specs/R1-P07-worker-team-crew-management/
├── activation.md
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── authorization-matrix.md
├── migration-plan.md
├── test-strategy.md
├── quickstart.md
├── implementation-prompt.md
├── contracts/
│   ├── provider-workforce-api.openapi.yaml
│   ├── module-public-contracts.md
│   └── transaction-boundaries.md
├── checklists/
└── tasks.md
```

### Expected implementation paths (future `speckit-implement` only)

```text
prisma/schema.prisma
prisma/migrations/r1_p07_worker_team_crew_management/migration.sql
src/modules/providers/provider-workforce.*.ts
src/modules/providers/domain/provider-workforce.*.ts
src/modules/providers/infrastructure/prisma-provider-workforce*.ts
src/modules/authentication/authentication.public.ts
src/modules/authentication/infrastructure/prisma-worker-*.ts
src/modules/media/media.public.ts
src/modules/media/infrastructure/*worker-avatar*.ts
src/modules/admin/audit.public.ts
src/composition.ts
src/routes/index.ts
src/swagger/openapi.document.ts
scripts/generate-r1-p07-postman.ts
scripts/validate-r1-p07-upgrade.ts
tests/unit/providers/
tests/integration/providers/
tests/integration/authentication/
tests/integration/media/
tests/integration/http/
```

**Structure Decision**: Extend existing module seams. Do not add a Workers
module, business code under `shared`, or a cross-module repository.

## Implementation Phases

1. Schema/migration and transaction-bound public-contract foundations.
2. Worker profile/invitation/access flows and private avatar binding.
3. Worker lifecycle, authority, reasons, history, notifications, and self-leave.
4. Teams, memberships, Supervisor scope, Escort/final-cleaner invariants.
5. Derived readiness and booking-safe Providers public projection.
6. HTTP/OpenAPI/Postman parity, migration proofs, coverage, and boundary review.

Detailed dependency-ordered work belongs to `tasks.md`. This plan performs none
of the implementation work.

## Complexity Tracking

No constitutional violation or approved exception exists. Generic workforce
history/idempotency/outbox remain cohesive Providers-owned infrastructure and do
not create a shared God service.
