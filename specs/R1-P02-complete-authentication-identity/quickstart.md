# R1-P02 Implementation Quickstart

This is the implementation handoff sequence. It does not authorize dependency installation, database application, production migration, deployment, commit, or push by itself.

## 1. Confirm scope

- `docs/product/current.md` still names only R1-P02 In Progress.
- Use `spec.md`, `plan.md`, `research.md`, `data-model.md`, and `contracts/` here.
- Do not create `tasks.md` until the separate Spec Kit tasks workflow is requested.
- Preserve the R1-P01 migration and foundation tests.

## 2. Validation prerequisites

- Node.js and npm versions satisfy `package.json`.
- Dependencies are installed from the reviewed lockfile after the separate implementation workflow authorizes changes.
- Local/test capability values use synthetic secrets and deterministic provider adapters; no production credential is used.
- Database-backed checks use an explicit isolated PostgreSQL test target.
- Focused tests pass before the complete validation sequence runs once.

## 3. Migration workflow

Use an explicit isolated non-production database for create-only generation:

```text
npx prisma migrate dev --create-only --name r1_p02_complete_authentication
```

Review the generated SQL before any apply. Confirm exact tables/enums/FKs/unique/check/partial indexes and reject destructive or R1-P01-altering statements. Then validate and generate:

```text
npm run prisma:validate
npm run prisma:generate
```

Apply/prove the full history only when an explicit empty safe `CI_DATABASE_URL` is available:

```text
npm run db:ci-validate
```

Missing `CI_DATABASE_URL` is a skipped unavailable proof, never a fabricated pass. Never use normal developer `DATABASE_URL` for clean apply.

## 4. Focused evidence

- category/verification/login matrices;
- refresh compare-and-swap and reuse-family revocation;
- OTP/reset exact attempt, expiry, resend, consumption, and races;
- status enforcement at login and protected requests;
- Google state/nonce/PKCE/linking/phone-gate security;
- generic enumeration responses and bounded timing;
- nested secret redaction across response/log/error/event/audit;
- every auth repository uses the already-bound process-wide Prisma client.

Expected outcomes include one usable successor after normal refresh, full family revocation after replay, no usable session after reset, only the current rotated session after password change, and no protected access for an unverified Google phone or a suspended/banned identity.

## 5. Final validation

After focused tests and the explicit database gate where available:

```text
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:coverage
npm run prisma:validate
npm run openapi:validate
npm run docs:check
npm run build
npm audit --audit-level=high
```

Record actual suite/test counts, coverage, migration rows/table inventory, Argon2 benchmark, package compatibility, and unavailable external-provider proof.

## 6. Documentation

- Create and validate `docs/apis/openapi/r1-p02-authentication.yaml`.
- Reconcile `docs/apis/authentication.md` and `docs/apis/README.md`.
- Correct stale phase/OQ-014 text in `docs/phases/release-1/R1-P02-authentication/` during implementation documentation work.
- Expand `postman/R1-P02-authentication.postman_collection.json` with all routes and assertions.
- Keep APIs marked prepared until code and gates genuinely pass.
- Keep R1-P02 In Progress until independent review, evidence, and human approval.
