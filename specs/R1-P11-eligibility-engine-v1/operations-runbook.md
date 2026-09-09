# R1-P11 Operations Runbook

Authority: DEC-067, DEC-069, DEC-082, DEC-084.

## Rule seed verification

After migrate + seed on a disposable or approved local DB:

1. Confirm seeded row id `eligibility_rule_r1_v1_eg` for Egypt (`countryCode` /
   resolved country = `EG`).
2. Confirm `versionLabel = r1-v1` and
   `effectiveFrom = 2026-09-09T00:00:00.000Z`.
3. Verify **all** immutable fields match the canonical fixture (country,
   version, schema/engine, ruleOrder, parameters, effectiveFrom,
   `contentChecksum`) — not checksum alone.
4. Confirm `performanceGate.enabled === false` in stored parameters.
5. Re-run seed: identical content → success/no-op; any immutable-field drift →
   failure without overwrite.

## Evaluation failure diagnosis

| Symptom | Check |
|---|---|
| Whole evaluation error | Typed code: validation, rule version, dependency, limits, persistence |
| Empty eligible list | Inspect `evaluationOutcomes.catalog` and diagnostic reasons; confirm discovery scope counts |
| Unavailable service vs no supply | Catalog FAIL with zero Providers is success persist — not hard error |
| Unexpected performance exclusion | Confirm gate disabled → `NOT_APPLICABLE`; missing/stale when enabled must be informational `NOT_EVALUATED`, not FAIL |
| Flaky live results | Expect changes when schedules/prices/membership change; compare evidence hashes; confirm same `evaluatedAt` across retries |
| `CONFLICT` | Treat as technical pricing conflict, not “unavailable” |

Do not expose diagnostic dumps on public HTTP (none in P11).

## Retention purge

- Retention: **720 elapsed hours** from evaluation `completedAt`; stored
  `expiresAt` is exactly that instant (`interval '720 hours'`).
- Invoke Eligibility `purgeExpiredEvaluations`:
  - Capture fixed cutoff once per invocation via **composition clock**
  - **No** caller-supplied `asOf` on production options
  - Delete evaluations with `expiresAt < cutoff` ordered by `(expiresAt, id)`
  - `batchSize` omitted ⇒ 100; integer **1–500** only; **reject** invalid
    (do not clamp)
  - Return `deletedEvaluations`, `deletedCandidateResults`, `moreRemaining`, `cutoff`
- Idempotent and bounded; safe to re-run.
- Deletes expired evaluations and cascaded candidate results only.
- Does **not** delete rule versions or non-P11 user data.
- Runtime scheduler not required in P11; document cron-ready invocation for later ops.

## Disposable database rules

Allowed:

- Explicit phase-named local/test PostgreSQL URLs for clean and upgrade proofs
- Recording redacted connection host/db name without secrets

Forbidden:

- Using unknown `.env` DATABASE_URL for proofs
- Production or shared non-disposable data
- Assuming P10’s historical proof server still exists
- Destructive operations on inherited user data

## Gate commands (ops awareness)

Planned:

- `npm run test:r1-p11`
- `npm run test:coverage:r1-p11`
- `npm run db:validate-r1-p11-upgrade`

Existing clean migration validator must be inspected before use so P11 chronology is included.

## Incident note

If purge or seed fails mid-way, treat as failed maintenance: investigate disposable target first; never “fix” by editing applied migration SQL.
