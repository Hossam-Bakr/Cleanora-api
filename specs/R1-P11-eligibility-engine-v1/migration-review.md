# R1-P11 Migration Review

**Migration**: `prisma/migrations/r1_p11_eligibility_engine_v1/migration.sql`  
**Authority**: DEC-082, DEC-084, `data-model.md`, `migration-plan.md`  
**Status**: Forward-only SQL authored and reviewed for first application; live
apply remains gated on an approved disposable Phase 11 database.

## Statements

1. Create enum `EligibilityCandidateRowKind` (`PROVIDER_SUMMARY` | `TEAM_RESULT`).
2. Create `eligibility_rule_versions` with Restrictive FK to `countries`,
   unique `(id, country_id)`, `(country_id, version_label)`,
   `(country_id, effective_from)`, and selection index on
   `(country_id, effective_from)`.
3. Create `eligibility_evaluations` with Restrictive composite FK
   `(rule_version_id, country_id)` → `eligibility_rule_versions(id, country_id)`;
   required `created_at`, `completed_at`, `expires_at` (no DB interval default);
   **no** unique on `request_hash`; retention index `(expires_at, id)`.
4. Create `eligibility_candidate_results` with CASCADE delete from evaluations;
   XOR CHECK on `row_kind` / `team_id`; partial unique indexes for Provider
   summaries and Team results; **no** live FK on `provider_id` / `team_id`.

## SQL review checklist

| Check | Result |
|---|---|
| Tables match `data-model.md` physical types (TEXT/JSONB/BOOLEAN/TIMESTAMP) | Pass — project `TIMESTAMP(3)` convention retained |
| Immutable version uniqueness including `(id, countryId)` | Pass |
| Evaluations composite FK RESTRICT | Pass |
| Candidate XOR CHECK + both partial unique indexes | Pass |
| FK delete: results CASCADE; evaluations→rule RESTRICT; rule→country RESTRICT | Pass |
| No live FK for providerId/teamId | Pass (documented) |
| `createdAt` on evaluations and results | Pass |
| `expiresAt` column without create-time interval DEFAULT | Pass — app sets `completedAt + 720h` |
| Retention index on `expiresAt` | Pass |
| JSON columns unconstrained beyond NOT NULL where required | Pass |
| Seed verifies immutable fields (application layer; not SQL) | Owned by `prisma/seed.ts` |

## Risks

- Additive only; no DROP/TRUNCATE of existing product tables.
- Composite FK depends on unique `(id, country_id)` on rule versions.
- Partial uniques and XOR CHECK are migration-owned (Prisma cannot express them).
- Live constraint and seed proofs stay gated on
  `CLEANORA_R1_P11_DATABASE_URL` (approved `cleanora_r1_p11_*_(test|proof|clean|ci)`).

## Out of scope in this migration

- Deterministic V1 seed row (application seed, not SQL INSERT).
- Evaluation/rules/Browse runtime.
- Geo tables or Provider/Catalog production truth changes.
