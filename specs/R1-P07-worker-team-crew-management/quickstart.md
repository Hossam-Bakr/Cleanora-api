# R1-P07 Implementation Quickstart

This is the completed R1-P07 implementation verification and operator handoff.
It records the safe rerun order; it does not authorize production operations or
Git publication.

## 1. Read first

1. `AGENTS.md`, `docs/ai/context-router.md`, `docs/product/current.md`
2. `spec.md`, DEC-038, DEC-039
3. `plan.md`, `data-model.md`, `authorization-matrix.md`
4. `contracts/` and `tasks.md`
5. Applicable architecture/standards files only

Stop if canonical behavior conflicts or a genuinely new material product
decision appears. Do not reopen the five DEC-039 decisions.

## 2. Environment expectations

- Node.js 24+, repository npm dependencies, PostgreSQL disposable test target.
- Existing Authentication/JWT/verifier, SMTP, Provider outbox, and Cloudinary
  configuration only.
- No new R1-P07 secret/env variable. Never print `.env` values.
- Release 1 tests use fakes for SMTP/Cloudinary and no Docker/Testcontainers.

## 3. Implemented dependency order

1. Add phase-owned schema/migration and review SQL.
2. Add Authentication/Media/Admin public contracts and transaction-bound
   adapters before Providers consumes them.
3. Add Providers domain policies, repository, UoW, history/idempotency/outbox.
4. Implement Worker profile/invitation/access acceptance flows.
5. Implement Worker lifecycle/Admin authority/self-leave.
6. Implement Teams/memberships/Supervisor/Escort/final-cleaner behavior.
7. Implement derived readiness and safe Providers public reader.
8. Mount HTTP routes and runtime OpenAPI; generate Postman.
9. Run migration proofs, complete phase tests/coverage/boundary scans.

Tests precede or accompany each behavior task as ordered in `tasks.md`.

## 4. Representative journeys

### Invite and accept

1. Owner creates complete `DRAFT` Worker using Provider expected version and an
   idempotency key.
2. Owner supplies recent-auth proof and issues an `AR`/`EN` invitation.
3. Dispatcher regenerates signed link from invitation version and current
   external verifier secret; no token is stored.
4. New user chooses password and verifies fixed email, or existing user signs
   in without password change.
5. Acceptance reviews/corrects operational phone, atomically claims identity,
   activates access, reconciles Worker role, stores accepted locale, history,
   audit, command result, and intents.
6. Retry with same key replays; expired/superseded/competing proof changes zero.

### Final cleaner

1. Create active Team with one active `CLEANING_STAFF`, `cleans=true` member.
2. Primary Supervisor tries `cleans=false`: expect safe 409 and zero changes.
3. Owner/Admin requests same exact versions: response identifies impact.
4. Resubmit with explicit confirmation: membership becomes `cleans=false`, Team
   becomes `INACTIVE`, and separate history rows commit atomically.
5. Stale/competing/cancelled command leaves both unchanged.

### Escort

1. Add Escort with `cleans=false`: accepted, not readiness/cleaner count.
2. Request `cleans=true`: validation/state conflict and zero change.
3. For current Cleaner with `cleans=true`, request type `ESCORT`: conflict.
4. Explicitly correct membership first (with final-cleaner flow if relevant),
   then change type.

### Privacy

Read the same Worker as Owner, Admin, self, valid current primary Supervisor,
ordinary colleague, Customer, and cross-Provider actor. Only the first four
authorized projections contain the full phone; colleague/public surfaces do not
exist or omit it. Remove Supervisor assignment and prove access disappears.

## 5. Validation commands

Run sequentially where database-backed suites share a proof target:

```powershell
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run test:r1-p07
npm run test:coverage:r1-p07
npm run test:coverage
npm run openapi:validate
npm run postman:generate:r1-p07
npm run postman:validate
npm run docs:check
npm run build
git diff --check
```

Then, and only with `TEST_MIGRATION_DATABASE_URL` identifying an explicitly
approved disposable PostgreSQL target, run the two database proofs sequentially:

```powershell
npm run db:validate-clean-migration
npm run db:validate-r1-p07-upgrade
```

Both proof scripts must fail closed when the target is missing, malformed,
production-looking, or not isolated. Never echo or log the URL. Do not run
Prisma deploy/status/seed directly against an unknown target, and do not run the
two proof suites concurrently against one database.

Evidence order is: focused unit â†’ focused database/HTTP â†’ phase suite â†’ phase
coverage â†’ full unit/integration/coverage â†’ contract/docs/build/diff â†’ clean
migration â†’ populated upgrade. Record raw counts and percentages only after
the corresponding command exits successfully.

## 6. Completion evidence

Record exact commands/results, migration SQL review, clean/upgrade proof target
identifiers without URLs/secrets, task completion, coverage, runtime/OpenAPI/
Postman parity, privacy scans, module-boundary review, and unresolved findings.
Do not commit/push without the exact human message `commit and push`.
