# R1-P11 Data Model

**Owner**: `eligibility`  
**Migration**: `prisma/migrations/r1_p11_eligibility_engine_v1/`  
**Authority**: DEC-067, DEC-069, DEC-076, DEC-082, DEC-084

All physical choices below are **frozen**. No “UUID or cuid” alternatives remain.

## Tables

### `eligibility_rule_versions`

Immutable country-scoped rule bundles.

| Field | Physical type | Null | Notes |
|---|---|---|---|
| `id` | `TEXT` PK | NO | Seed uses fixed deterministic id `eligibility_rule_r1_v1_eg` |
| `countryId` | `TEXT` | NO | **Restrictive FK** → countries.id |
| `versionLabel` | `TEXT` | NO | e.g. `r1-v1` |
| `schemaVersion` | `TEXT` | NO | e.g. `eligibility.rules.v1` |
| `engineCompatibility` | `TEXT` | NO | e.g. `eligibility-engine.r1.v1` |
| `ruleOrder` | `JSONB` | NO | Ordered rule id array |
| `parameters` | `JSONB` | NO | Typed parameters |
| `effectiveFrom` | `TIMESTAMPTZ` | NO | Inclusive selectable instant |
| `contentChecksum` | `TEXT` | NO | SHA-256 hex of canonical content |
| `createdAt` | `TIMESTAMPTZ` | NO | `@default(now())` |
| `createdByProvenance` | `TEXT` | NO | Controlled system operation identity |

**Uniqueness**

- Unique `(countryId, versionLabel)`
- Unique `(countryId, effectiveFrom)`
- Unique `(id, countryId)` — required so evaluations can reference
  `(ruleVersionId, countryId)` via composite FK (DEC-084)

**Selection**: latest compatible bundle where `effectiveFrom <= evaluatedAt` and
engine compatibility matches; missing/invalid → hard evaluation error.

**Retention**: retained indefinitely relative to evaluation purge; seed must not
overwrite divergent immutable fields.

### `eligibility_evaluations`

One row per successful completed application evaluation.

| Field | Physical type | Null | Notes |
|---|---|---|---|
| `id` | `TEXT` PK | NO | UUID string (operational) |
| `ruleVersionId` | `TEXT` | NO | Part of composite FK with `countryId` |
| `countryId` | `TEXT` | NO | Must agree with selected rule’s country |
| `evaluatedAt` | `TIMESTAMPTZ` | NO | Captured trusted clock (semantic) |
| `completedAt` | `TIMESTAMPTZ` | NO | Persistence completion |
| `createdAt` | `TIMESTAMPTZ` | NO | Required repository timestamp |
| `expiresAt` | `TIMESTAMPTZ` | NO | Exactly `completedAt + 720 elapsed hours` |
| `requestNormalized` | `JSONB` | NO | Allowlisted non-contact inputs |
| `requestHash` | `TEXT` | NO | Canonical hash; **not** unique |
| `evidenceSafe` | `JSONB` | NO | Typed `EligibilityEvidenceSnapshot`; **no Worker IDs** |
| `evidenceHash` | `TEXT` | NO | |
| `resultHash` | `TEXT` | NO | |
| `metadata` | `JSONB` | NO | Contract/engine versions, zone, discovery, source versions |
| `outcomeSummary` | `JSONB` | NO | Includes evaluation-level Catalog outcome summary |
| `traceId` | `TEXT` | YES | Operational |
| `engineVersion` | `TEXT` | NO | Runtime engine identity |

**Country agreement (DEC-084)**

- Application validation is an earlier error boundary.
- Schema enforces: **restrictive composite FK**
  `(ruleVersionId, countryId)` → `eligibility_rule_versions(id, countryId)`.

**Uniqueness**: none on `requestHash`. Fresh row per live invocation.

**Immutability**: no updates to semantic columns after insert.

**Delete**: purge by `expiresAt`; cascading delete to candidate results.

### `eligibility_candidate_results`

| Field | Physical type | Null | Notes |
|---|---|---|---|
| `id` | `TEXT` PK | NO | UUID string |
| `evaluationId` | `TEXT` | NO | FK → evaluations **ON DELETE CASCADE** |
| `providerId` | `TEXT` | NO | Historical logical reference — **no live FK** |
| `teamId` | `TEXT` | YES | Null iff `rowKind = PROVIDER_SUMMARY` |
| `rowKind` | enum `EligibilityCandidateRowKind` | NO | `PROVIDER_SUMMARY` \| `TEAM_RESULT` |
| `eligible` | `BOOLEAN` | NO | Final eligibility for this row |
| `ruleOutcomes` | `JSONB` | NO | Ordered outcomes |
| `reasons` | `JSONB` | NO | Deduplicated exclusion reasons |
| `sortingFacts` | `JSONB` | YES | Null when not applicable |
| `diagnosticsSafe` | `JSONB` | YES | Allowlisted diagnostics; never Worker IDs |
| `createdAt` | `TIMESTAMPTZ` | NO | Required |

## XOR and uniqueness (DEC-082)

Enforce in SQL (CHECK + partial uniques):

1. **XOR**:
   - `PROVIDER_SUMMARY` ⇒ `teamId IS NULL`
   - `TEAM_RESULT` ⇒ `teamId IS NOT NULL`
2. Unique `(evaluationId, providerId)` where `rowKind = PROVIDER_SUMMARY`
3. Unique `(evaluationId, providerId, teamId)` where `rowKind = TEAM_RESULT`

## Cardinality (required)

- Exactly **one** Provider summary per evaluated Provider, including excluded
  and **nonexistent explicit** Providers.
- Team rows **only** for actual evaluated Teams (within 5,000 bound).
- Evaluation country agrees with selected rule country (composite FK + app).

## FK / delete semantics

| Relationship | On delete | Rationale |
|---|---|---|
| `eligibility_rule_versions.countryId` → countries | **RESTRICT** | Country-scoped immutable bundles |
| `eligibility_evaluations (ruleVersionId, countryId)` → rule versions `(id, countryId)` | **RESTRICT** | Preserve pinned history; enforce country agreement |
| `eligibility_candidate_results.evaluationId` → evaluations | **CASCADE** | Purge tree |
| `providerId` / `teamId` → Providers/Teams tables | **No live FK** | Explicit nonexistent Providers and retained historical evaluations must remain representable |

## Retention (DEC-069 exception refined by DEC-084)

- Window: **720 elapsed hours** from `completedAt`; store `expiresAt` exactly
  (`interval '720 hours'` when expressed in SQL).
- Classification: specific DEC-069 exception for expiring eligibility diagnostic
  history; does not change retention of other audit or commercial records.
- Purge: Eligibility-owned; fixed cutoff per invocation via composition clock
  (**no caller `asOf`**); order `(expiresAt, id)`; `batchSize` integer **1–500**
  only (default 100 when omitted); **reject** invalid sizes (do not clamp);
  return deleted counts + `moreRemaining`.
- Does **not** authorize deleting inherited/existing user data or rule versions.

## Seed (DEC-082)

| Field | Value |
|---|---|
| `id` | `eligibility_rule_r1_v1_eg` |
| `versionLabel` | `r1-v1` |
| Country | Egypt via code `EG` |
| `effectiveFrom` | `2026-09-09T00:00:00.000Z` |
| Performance gate | `enabled: false` |
| Bounds | 500 / 5000; crew prefs closed set |

Seed verification compares **all** immutable fields (country, version label,
effective time, schema/engine, ruleOrder, parameters, checksum) — not checksum
alone. Identical → no-op; drift → fail without overwrite.

## Invariants

- Evaluations immutable while retained.
- Persistence of application evaluation is atomic with its candidate rows.
- Empty eligible set still persists on successful completion (Catalog outcome
  recorded at evaluation scope).
- No raw addresses, customer ids as identity, Worker IDs, Worker contacts,
  verification documents, or payout identifiers in JSON columns.
