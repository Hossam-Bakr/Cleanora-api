# Implementation Prompt — R1-P07 Worker, Team & Crew Management

**Status:** Historical and fulfilled — T001–T156 and all evidence gates were
completed on 2026-08-24. Keep this prompt as the implementation handoff record;
do not rerun it as an active-phase instruction.

## Objective

Implement every task in `tasks.md` for R1-P07, in dependency order,
and nothing outside the active phase. Preserve DEC-038 and DEC-039 exactly.

## Required context

- `AGENTS.md`, `docs/ai/context-router.md`, `docs/product/current.md`
- `spec.md`, `plan.md`, `research.md`, `data-model.md`
- `authorization-matrix.md`, `migration-plan.md`, `test-strategy.md`
- `contracts/`, `quickstart.md`, and `tasks.md`
- Only the architecture/standards documents referenced by the active task

## Acceptance criteria

- FR-001–FR-088 and SC-001–SC-014 have implementation/test evidence.
- Worker, login-access, and Team lifecycles follow the final matrices.
- Owner/Admin/Supervisor/self/privacy behavior matches the authorization matrix.
- Escort, final-cleaner, readiness, version, idempotency, concurrency, reason,
  locale, history, audit, outbox, and media invariants pass focused tests.
- Design/runtime OpenAPI and Postman operations are in parity.
- Clean chronological migration and populated R1-P06 upgrade proofs pass.
- Phase coverage, full regression, docs, build, and module-boundary gates pass.

## In scope

- Providers-owned Worker engagements/profiles/skills/access/invitations/Teams/
  memberships/Supervisor/history/idempotency/outbox/readiness.
- Public-contract extensions in Authentication, Media, Admin, and Providers.
- Private Worker avatar flow using existing Media/Cloudinary settings.
- Provider/Worker/invitation HTTP routes documented by the design OpenAPI.
- Phase-owned schema/migration, runtime OpenAPI, Postman, tests, and validators.

## Out of scope

- Booking assignment/snapshot, R1-P08 catalog mapping, schedules/attendance,
  payroll, payout, public Worker profile/avatar/phone, customer Worker surface,
  frontend, Docker/cloud/deployment, production migration, and stored-value
  wallet behavior.
- New secret/env variable or real SMTP/Cloudinary operation in tests.

## Module ownership and public contracts

Providers owns the business transaction and persistence. Authentication owns
identity/password/session/roles/preferences/recent-auth. Media owns avatar bytes,
processing/storage/delivery. Admin owns audit. Use only the public contracts in
`contracts/module-public-contracts.md`; never import private repositories or raw
Prisma types across modules. Do not create a Workers module.

## Database and migration work

Create only `r1_p07_worker_team_crew_management`. Never edit an applied
migration. Review partial indexes, checks, deferred triggers, defaults,
backfills, FKs, locks, and constraint error mappings. Prove clean install and
populated R1-P06 upgrade against explicit disposable targets only.

## Authorization, audit, and security

Deny by default. Require exact Provider/Team/self scope, CAS/idempotency, and
10-minute recent auth for listed high-risk commands. Never persist/log/return
invitation proof, credentials, OTP, cookies, storage keys, or unauthorized full
phone. Accepted privileged writes include safe transactional audit/history;
notification intent is atomic but SMTP runs after commit.

## Tests and quality gates

Write tests before or with behavior as ordered in `tasks.md`. Use Vitest,
Supertest, isolated PostgreSQL, and provider fakes. No Docker/Testcontainers or
production credentials. Run all phase and regression gates in `quickstart.md`.

## Required handoff

Return changed files, completed tasks, schema/migration/SQL summary, exact test
and validation evidence, coverage, contract parity, module-boundary result, and
remaining risks. Do not stage, commit, push, merge, deploy, or touch production.
Do not invent unresolved product behavior.
