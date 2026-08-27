# R1-P07 Migration and SQL Review

Review date: 2026-08-24
Migration: `prisma/migrations/r1_p07_worker_team_crew_management/migration.sql`
Status: PASS — manual/static review, clean chronological installation, populated R1-P06 upgrade, and live constraint probes complete

## Scope and chronology

- The only phase-owned migration is `r1_p07_worker_team_crew_management`.
- `git status --short -- prisma/migrations` reported only:

  ```text
  ?? prisma/migrations/r1_p07_worker_team_crew_management/
  ```

- `git diff --name-only -- prisma/migrations` returned no tracked migration path. No applied migration was edited.
- The migration is additive: it adds ten workforce tables, R1-P07 enums, two enum values on existing enums, and positive version anchors on `providers` and `provider_members`. It does not drop, rename, truncate, or rewrite an existing table or column.

## Line-by-line structural review

| SQL area | Lines | Review result |
|---|---:|---|
| R1-P07 enums and existing-enum additions | 4–23 | Values match the Prisma schema and phase vocabulary. `MediaOwnerType.WORKER_PROFILE_IMAGE` and `OtpPurpose.WORKER_INVITATION_EMAIL_VERIFICATION` extend existing owners without a new secret or service. |
| Existing-table version anchors | 25–35 | Positive default `1` and named positive checks are compatible with populated R1-P06 rows. No nullable transition or data-dependent backfill is required. |
| Worker engagement/profile/skills | 37–89 | Provider ownership, terminal shape, E.164 phone, positive version, non-self predecessor, normalized skill, and one profile per Worker are represented. |
| Invitation and login access | 91–138 | Invitation version/status/72-hour expiry and access shape are checked. Current invitation ownership is deferred and cross-checked. |
| Team and membership | 140–171 | Team name pair/version and membership version/time shape are checked. Cross-row Provider, Escort, primary-Supervisor, and active-cleaner rules are deferred. |
| History, command idempotency, outbox | 173–237 | Safe history facts, SHA-256 fingerprint shape, accepted-result shape, nonnegative attempts, and recipient shape are constrained. |
| Unique and lookup indexes | 239–267 | Partial uniqueness covers current identity, one pending invitation, non-archived normalized Team name, and one current Team membership. Command/outbox idempotency indexes are named and scoped. |
| Foreign keys | 269–314 | All owned references are named, use `ON DELETE RESTRICT`, and retain Worker/Team/history references. Updates cascade only identifier changes. |
| Deferred invariant functions/triggers | 318–527 | Predecessor, required profile, access/invitation ownership, same-Provider membership, Escort `cleans=false`, primary Supervisor, and active-Team cleaner invariants are enforced at commit so atomic repair remains possible. INSERT/UPDATE/DELETE affected-Team paths were reviewed. The affected-Team trigger now uses table-aware `IF/ELSIF` branches, so PostgreSQL never parses a missing `OLD.worker_id` field for `provider_workers`. |
| Immutable history trigger | 529–537 | Application UPDATE and DELETE are rejected by a named trigger. |

## Index and constraint findings

- `provider_workers_current_identity_unique` is partial on `identity_user_id IS NOT NULL AND ended_at IS NULL`, so historical engagements remain while only one current identity claim can win.
- `provider_worker_invitations_pending_unique` permits history but only one `PENDING` invitation per Worker.
- `provider_teams_non_archived_name_unique` applies to a non-null normalized name while status is not `ARCHIVED`, allowing archived names to be reused without weakening live Team uniqueness.
- `provider_team_memberships_current_worker_unique` permits membership history but only one current Team membership per Worker.
- Positive-version constraints exist on Provider, ProviderMember, Worker, profile, invitation, access, Team, membership, and history target version.
- Cross-row constraints are deferred intentionally, allowing an accepted command to update all affected rows atomically before the final invariant check.
- All constraint and trigger names are stable enough for safe diagnostics. Runtime and proof helpers handle Prisma 7 DriverAdapter SQLSTATEs from top-level `cause.originalCode`/`cause.code` as well as metadata for known PostgreSQL families `23503`, `23505`, `23514`, and `55000`; unknown database errors remain generic.

## Backfill, lock, and compatibility assessment

- The two populated-table additions are integer columns with constant positive default `1`; no application-derived backfill or row-by-row rewrite is present.
- The new workforce tables are empty on R1-P06 upgrade, so their indexes and constraints do not scan populated workforce data.
- `ALTER TYPE ... ADD VALUE` and `ALTER TABLE` require catalog/table locks during deployment. The migration should be run in the approved maintenance workflow; no production execution is authorized by this evidence.
- There is no destructive default, fake identity link, synthesized Worker, or reinterpretation of an R1-P06 Provider/member row.
- Constraint-to-domain mapping is fail-closed: contention and known constraint errors become a safe workforce state conflict; raw driver text is not exposed.

## Static commands actually run

```text
> npm run prisma:validate
Prisma schema loaded from prisma\schema.prisma.
The schema at prisma\schema.prisma is valid 🚀

> npm run prisma:generate
✔ Generated Prisma Client (7.9.0) to .\src\generated\prisma in 1.14s

> npx vitest run tests/unit/scripts/validate-clean-migration.test.ts
Included in the final full-unit run: 186 files passed, 867 tests passed.
```

The focused migration helper tests also verify exact expected SQLSTATE handling and reject a wrong or missing error result; the duplicate-identity fixture inserts a valid Worker profile so a different deferred constraint cannot create a false pass.

## Live proof result

Both proof commands passed on fresh phase-named databases inside a temporary,
localhost-only PostgreSQL 18 cluster. The clean proof applied all 14 migrations,
verified 67 exact public tables, double-seed idempotency, and live inherited plus
R1-P07 constraints. The populated-upgrade proof preserved every baseline R1-P06
table digest and Provider/member/Media/outbox/verification/payout truth, then
verified R1-P07 defaults, empty workforce state, idempotent re-deploy, and live
constraints. Database-backed history-retention, identity-race, and enrollment
tests also passed. See `migration-evidence.md` for redacted evidence.

No applied migration, repository `.env` database, installed PostgreSQL service,
remote database, or production target was changed.
