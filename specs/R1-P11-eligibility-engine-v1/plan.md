# Implementation Plan: R1-P11 — Eligibility Engine V1

**Branch**: `codex/r1-p11-eligibility-engine-v1` | **Date**: 2026-09-09 | **Spec**: [spec.md](spec.md)  
**Authority**: DEC-062–084 | **Repair**: DEC-084 Repairs A–D after PM-03 CHANGES_REQUIRED; Batch A still withheld

## Summary

Introduce the `eligibility` module that evaluates Provider/Team candidates for a
canonical request using Catalog, Providers, and Configuration public contracts
inside one `RepeatableRead` transaction. Persist immutable rule versions and
bounded evaluation history. Expose in-process `evaluateEligibility`,
`getStandardBrowseCandidates` (no `providerIds`), and `purgeExpiredEvaluations`
with **zero** new HTTP. Prove Browse-use integration; leave marketplace mounting
to P12.

## Technical Context

**Language/Version**: TypeScript 6 on Node.js 24.16  
**Primary Dependencies**: Express 5 (composition only; no new routes), Zod 4, Prisma 7/PostgreSQL, existing Temporal calendar via Providers/Configuration  
**Storage**: Additive migration `r1_p11_eligibility_engine_v1` adding three eligibility tables + deterministic rule seed  
**Testing**: `vitest.r1-p11.config.ts` (planned); unit, integration, boundary, migration, coverage gates  
**Target Platform**: Existing modular-monolith backend  
**Performance Goals**: Bounded discovery (500 Providers / 5,000 Team results); indexed lookups; no unbounded fan-out  
**Constraints**: DEC-062–083; no wallets; no Docker/cloud; no geo; no P12 HTTP; performance gate disabled by default  
**Scale/Scope**: Release 1 Egypt (`EG`) seed; textual coverage discovery reuse from P10

## Constitution Check

Pre-design verdict: PASS with DEC-062 phase override noted (Codex decides/completes P11; human retains exact `commit and push`).

- Standalone repository-local artifacts and code only.
- Traceability: FR-001–FR-034 and SC-001–SC-010 map into `tasks.md` (exact table).
- Ownership: `eligibility` owns three tables and policies; Providers/Catalog/Configuration retain fact ownership.
- Dependency direction: Eligibility → public contracts only; composition may construct adapters.
- Migration: one additive phase-owned migration; never edit applied migrations.
- Security: separated persistence / diagnostics / projection / log allowlists; Worker IDs prohibited.
- Testing: phase selection **and** repository regression gates (DEC-078).
- Locked boundaries: no wallets, Docker/cloud, geo, Browse HTTP.
- Module shape: compact convention (DEC-083) — no empty layer folders in Batch A.

## Architecture and Ownership

### Eligibility (new)

Owns:

- Rule-version selection and immutable bundles
- Evaluation orchestration and reason vocabulary / verdict algebra
- Persistence of evaluations/results and purge
- Public declarations in `src/modules/eligibility/eligibility.public.ts`
- Trusted performance evidence port (test-injected in P11)

Does **not** own: pricing, calendars, coverage truth, verification documents, HTTP marketplace.

### Providers / Catalog / Configuration

Extend public factories for opaque transaction-bound reads, locale-independent
eligibility pricing projection, lifecycle projection, and Team aggregate
gender/escort facts per [contracts/dependency-readers.md](contracts/dependency-readers.md).

### Composition

Wires Eligibility with concrete readers in `src/composition.ts`. Caller-controlled
role strings are not authorization.

## RepeatableRead transaction design (DEC-081)

1. Capture trusted `evaluatedAt` **once before** the retry loop.
2. Attempt ≤3 times:
   1. Open Eligibility-owned interactive transaction at `RepeatableRead`.
   2. Reselect immutable rule version effective at the **same** `evaluatedAt`.
   3. Discover candidates **or** accept explicit bounded Provider IDs via
      tx-bound Providers APIs (`factory(tx)` — no nested txs).
   4. For each candidate (bounded), invoke Catalog/Providers/Configuration
      bound readers.
   5. Apply pure rules (crew, capacity-after-filter, performance, verdict algebra).
   6. On success: insert evaluation + candidate rows atomically; commit.
   7. On recognised retryable conflict: abort, **discard** attempt evidence, retry.
      Concurrent source mutation may succeed on one consistent snapshot without
      retry (DEC-084); never return mixed-snapshot results.
3. On business exclusions: continue per-candidate; on hard errors: abort with
   typed error and no success payload.

Independent sequential reader calls that each open their own transaction are
**insufficient** (DEC-066/079).

## Bounds

| Bound | Value | Overflow |
|---|---|---|
| Discovered or explicit Providers | 500 | `EVALUATION_LIMIT_EXCEEDED` |
| Team result rows | 5,000 | `EVALUATION_LIMIT_EXCEEDED` |
| Required complete-Team units | 1–50 | validation error |
| Interval duration | (0, 24h] | validation error |
| Transaction attempts | 3 total | hard failure after exhaustion |
| Evaluation retention | 720 elapsed hours | purge eligible (`expiresAt < cutoff`) |
| Purge batch | integer 1–500; default 100 | reject invalid (do not clamp); no caller `asOf` |

## Concrete file map

```text
# Batch A (DEC-083) — declarations only
src/modules/eligibility/eligibility.public.ts

# Later batches — add when needed (compact convention; no speculative empty dirs)
src/modules/eligibility/eligibility.service.ts
src/modules/eligibility/eligibility.repository.ts
src/modules/eligibility/eligibility.schema.ts
src/modules/eligibility/eligibility.reasons.ts
src/modules/eligibility/eligibility.rules.ts
src/modules/eligibility/eligibility.hashes.ts
src/modules/eligibility/performance-evidence.port.ts

# Owning-module public extensions
src/modules/providers/providers.public.ts
src/modules/providers/eligibility-pricing.reader.ts          # or co-located service
src/modules/providers/eligibility-lifecycle.reader.ts
src/modules/providers/eligibility-availability.reader.ts
src/modules/catalog/catalog.public.ts
src/modules/configuration/configuration.public.ts
src/composition.ts

prisma/schema.prisma
prisma/migrations/r1_p11_eligibility_engine_v1/migration.sql
prisma/seed.ts

vitest.r1-p11.config.ts
tests/unit/scripts/r1-p11-test-selection.test.ts
tests/unit/modules/r1-p11-module-boundaries.test.ts
tests/helpers/r1-p11-eligibility-fixtures.ts
tests/unit/modules/eligibility/eligibility.reasons.test.ts
tests/unit/modules/eligibility/eligibility.rules.test.ts
tests/unit/modules/eligibility/crew-capacity.test.ts
tests/unit/modules/eligibility/performance-gate.test.ts
tests/unit/modules/eligibility/determinism.test.ts
tests/unit/modules/eligibility/browse-projection.test.ts
tests/unit/modules/eligibility/privacy-negatives.test.ts
tests/unit/modules/eligibility/retry-clock.test.ts
tests/integration/database/r1-p11-schema-constraints.test.ts
tests/integration/eligibility/r1-p11-rule-seed.test.ts
tests/integration/eligibility/r1-p11-evaluate.test.ts
tests/integration/eligibility/r1-p11-concurrent-snapshot.test.ts
tests/integration/eligibility/r1-p11-browse-facade.test.ts
tests/integration/eligibility/r1-p11-retention.test.ts
tests/integration/providers/r1-p11-eligibility-readers.test.ts
tests/unit/scripts/validate-r1-p11-upgrade.test.ts
scripts/validate-r1-p11-upgrade.ts

specs/R1-P11-eligibility-engine-v1/**
```

## Dependency extensions

See [contracts/dependency-readers.md](contracts/dependency-readers.md).

## Quality / gate plan

### Planned phase scripts (not yet in package.json)

```text
npm run test:r1-p11
npm run test:coverage:r1-p11
npm run db:validate-r1-p11-upgrade
```

Config: `vitest.r1-p11.config.ts` — exact allowlist of P11 suites plus
**explicitly named** changed-seam suites (DEC-083). Coverage floors: 80%
statements, 75% branches, 80% functions, 80% lines on P11 production + changed
seams. Coverage scripts may exist before substantial coverage; do not claim
coverage pass early.

### Existing repository gates (required under DEC-078)

```text
npm run typecheck
npm run lint
npm run build
npm run prisma:validate
npm run prisma:generate
npm run test:unit
npm run test:integration
npm run test:coverage
npm run openapi:validate
npm run postman:validate
npm run docs:check
npm run db:validate-clean-migration
git diff --check
```

### Migration proofs

- Clean: full chronological history on disposable DB → verify migration/table counts.
- Upgrade: populated P10 → P11 via `db:validate-r1-p11-upgrade`.

## HTTP / OpenAPI

Zero new eligibility operations. See [contracts/http-api.md](contracts/http-api.md).

## Complexity Tracking

| Choice | Why Needed | Simpler Alternative Rejected |
|---|---|---|
| Separate eligibility module | Ownership map + shared Browse/Recommended domain | Stuffing into Providers blurs truth vs policy |
| Opaque tx-bound factories | One consistent snapshot | Sequential independent txs / nested txs |
| Locale-independent pricing projection | ID-based Eligibility inputs | Inventing a locale for snapshot API |
| Disabled performance gate + port | Cold-start honesty | Fake ratings / missing=fail |
| Browse facade without HTTP | Honest P11 DoD | Deferring all Browse proof to P12 |
| No live Provider/Team FK | Nonexistent explicit Providers remain representable | Live FK that blocks historical rows |
| Declarations-only Batch A | Compact module convention | Empty domain/application folders |

