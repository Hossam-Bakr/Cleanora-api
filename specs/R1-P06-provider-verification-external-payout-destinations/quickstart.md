# Implementation Quickstart — R1-P06

**Implementation was separately authorized on 2026-08-13.** This guide remains
bounded to R1-P06 and does not authorize Git, deployment, production database,
real payout-channel, or future-phase actions.

## Read in This Order

1. `AGENTS.md`, `docs/ai/context-router.md`, `docs/product/current.md`.
2. [spec.md](./spec.md) and DEC-037.
3. [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md).
4. [security-design.md](./security-design.md), [migration-plan.md](./migration-plan.md), [test-strategy.md](./test-strategy.md), [operations-runbook.md](./operations-runbook.md), [ux-design.md](./ux-design.md).
5. All files in [contracts](./contracts/).
6. `tasks.md` after it is generated and analyzed clean.

## Non-Negotiable Boundaries

- Providers owns R1-P06 transactions/persistence; foreign modules are public-contract-only.
- Provider application must already be APPROVED; suspension permits remediation.
- Documents: Owner/Admin submit; Staff decides; Individual Team has no requirement.
- Payout: Owner mutates; Admin masked-read only; Staff manually verifies/decides.
- No wallet/bank ownership-evidence upload and no payout/transfer/settlement execution.
- Only Mobile Wallet and IBAN-first Bank Account.
- Exact versions, idempotent matching retries, safe conflicts, immutable history.
- Identifiers write-only and masked after write; Staff reveal is one pending version after durable accepted audit.
- No internal wallet, Provider LIVE/public/final eligibility, Docker/cloud, or future phase.

## Recommended Implementation Sequence

1. Add safe reason codes, domain enums/value objects, normalizers/maskers, crypto/key-ring ports and unit tests.
2. Add Authentication/Customers/Configuration/Media/Admin public contracts and contract tests.
3. Implement/review phase migration and clean/upgrade validation on disposable databases.
4. Implement document policy/evidence/lifecycle/review/readiness services and repositories.
5. Implement payout registries/chains/claims/encryption/lifecycle/primary/conflict services and repositories.
6. Implement audited reveal/rate gate and rotation runner.
7. Extend safe Provider outbox templates/worker.
8. Add Provider/Staff controllers/routes/DTOs/OpenAPI/Postman.
9. Run focused R1-P06 validation and phase-scoped coverage in the order below.

Never perform Cloudinary/scanner/email/external channel I/O inside a database transaction.

## Required Test Fixtures

- approved Individual Team and Registered Company Providers with exact Owner/Admin memberships;
- active/inactive/cross-Provider users and capable/incapable Staff;
- effective/future/changed EG document policies;
- safe synthetic operator/bank records and EG/EGP payout policy (test only unless manifest approved);
- READY/PENDING/FAILED PDF/JPEG/PNG Media receipts;
- old/new independent key rings and mixed-key encrypted rows;
- collisions, stale versions, parallel successors/decisions/primary commands/reveals;
- sentinel secret values for leakage scans.

## Minimum Acceptance Journeys

1. Individual Team sees NOT_REQUIRED and no document upload.
2. Registered Company submits valid one-PDF and image-set documents; Staff decisions and replacement continuity update derived truth/badge.
3. Owner submits wallet and IBAN drafts without evidence; Admin sees reduced masked status; Staff reveals/decides manually.
4. Duplicate wallet/IBAN claims conflict safely under concurrency and require Staff resolution.
5. First approval initializes primary; explicit change/removal/successor/challenge follow the matrix and readiness.
6. Six concurrent reveals yield exactly five accepted responses/audits and no leak.
7. Rotation resumes through mixed keys and blocks retirement until zero references plus human approval.
8. No accepted R1-P06 state makes Provider LIVE/public/payable.

## Validation

Run and record the following order. Database commands require an explicitly
named and verified disposable R1-P06 target; skip and record the exact blocker
when that precondition is absent.

1. Focused red test for the next R1-P06 behavior, then its focused green test.
2. `npm run prisma:validate` and `npm run prisma:generate`.
3. Static migration-contract and SQL-safety tests.
4. `npm run db:validate-clean-migration` only with the safe disposable target.
5. `npm run db:validate-r1-p06-upgrade` against that same approved disposable
   target; it uses a separate isolated schema and a populated R1-P05 fixture.
6. Focused R1-P06 unit and integration suites only.
7. `npm run test:coverage:r1-p06`; statements, branches, functions, and lines
   must each be strictly above 75 percent, with 80 percent targeted.
8. `npm run typecheck`, `npm run lint`, and `npm run build`.
9. `npm run openapi:validate`, R1-P06 Postman generation/validation, and
   `npm run docs:check`.
10. Forbidden-sentinel privacy scan, configuration readiness probes, complete
   diff review, FR/SC traceability, and the mandatory after-implement hook.

Record exact commands, exit codes, test counts, coverage percentages, and
environment limitations; never claim unrun or visually unverified evidence.
