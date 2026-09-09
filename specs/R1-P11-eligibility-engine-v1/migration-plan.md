# R1-P11 Migration Plan

Authority: DEC-076, DEC-069, DEC-067, DEC-082, DEC-084.

## Migration name

```text
prisma/migrations/r1_p11_eligibility_engine_v1/migration.sql
```

Additive only. Never edit applied migrations.

## Scope

1. Create `eligibility_rule_versions` with restrictive FK to countries;
   unique `(countryId, versionLabel)`, `(countryId, effectiveFrom)`, and
   **`(id, countryId)`**
2. Create `eligibility_evaluations` with **restrictive composite FK**
   `(ruleVersionId, countryId)` → `eligibility_rule_versions(id, countryId)`;
   required `createdAt`, `completedAt`, `expiresAt`
3. Create `eligibility_candidate_results` with CASCADE to evaluations;
   enum `EligibilityCandidateRowKind` (`PROVIDER_SUMMARY` | `TEAM_RESULT`);
   **no** live FK on `providerId` / `teamId`
4. CHECK constraint enforcing `rowKind` / `teamId` XOR
5. Partial unique indexes for Provider-summary and Team-result identities
6. Indexes for rule selection (`countryId`, `effectiveFrom`), retention
   (`expiresAt`), and FK lookups
7. Deterministic V1 seed: id `eligibility_rule_r1_v1_eg`, label `r1-v1`,
   country EG, effective `2026-09-09T00:00:00.000Z`, performance gate disabled

No geo tables. No destructive backfills. No changes to Provider/Catalog/
Configuration production truth tables except approved Prisma opposite-side
relation metadata without behavioral change.

## SQL review checklist

- [ ] Tables match [data-model.md](data-model.md) physical types
- [ ] Immutable version uniqueness `(countryId, versionLabel)`,
  `(countryId, effectiveFrom)`, and `(id, countryId)`
- [ ] Evaluations composite FK `(ruleVersionId, countryId)` RESTRICT
- [ ] Candidate XOR CHECK + both partial unique indexes
- [ ] FK delete: evaluations → results CASCADE; evaluations → rule versions
  RESTRICT; rule → country RESTRICT
- [ ] No live FK for providerId/teamId (documented historical-integrity rationale)
- [ ] Timestamps `TIMESTAMPTZ`; `createdAt` present on evaluations and results
- [ ] `expiresAt` populated as `completedAt + interval '720 hours'`
- [ ] Retention index on `expiresAt`
- [ ] JSON columns unconstrained at DB beyond NOT NULL where required; app validates schemas
- [ ] Seed verifies all immutable fields; no overwrite path for divergent content
- [ ] Prefer existing project text/UUID patterns already present in prior migrations

## Proof design

### Clean chronological installation

- Target: explicit disposable database URL (phase-named), never `.env` production/unknown.
- Apply full migration history including P11.
- Verify migration count/table count under the same convention as P10 (~18 migrations / ~96 tables — **verify, do not assume**).
- Probe constraints: version uniques including `(id, countryId)`, composite FK
  country agreement, XOR, candidate partial uniques, cascade purge on disposable
  rows, insert Provider summary for nonexistent providerId succeeds.
- Double-seed: identical content succeeds; divergent content fails safely.

### Populated P10 upgrade

- Start from disposable DB with populated P10 schema/data digests.
- Apply only P11 forward migration.
- Preserve earlier-table digests and migration history.
- Validator script (planned): `scripts/validate-r1-p11-upgrade.ts` + `npm run db:validate-r1-p11-upgrade`.

### Existing clean validator

Inspect `npm run db:validate-clean-migration` and extend/compose so P11 is included in chronological proof without weakening guards.

## Out of scope for preparation / repair batches

No schema or SQL files are written in documentation repair. Implementation
Batch B owns the migration.
