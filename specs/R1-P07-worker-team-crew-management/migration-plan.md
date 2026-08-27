# R1-P07 Migration Plan

**Planned migration:** `r1_p07_worker_team_crew_management`
**Status:** Plan only; no schema edit, migration generation, application, status
check, seed, or other database operation is authorized in this preparation run.

## Baseline inspected

- Central Prisma schema currently includes R1-P01 through R1-P06 models.
- Migration history contains 13 applied, immutable directories ending in
  `r1_p06_provider_verification_external_payout_destinations`.
- Existing `Provider`, `ProviderMember`, `ProviderEmailOutbox`, `User`,
  `UserPreferences`, and `MediaFile` shapes were inspected.
- `ProviderMember` currently has no optimistic `version`; `MediaOwnerType` has no
  Worker avatar purpose; pre-account Provider email outbox rows require a
  recipient User, so workforce invitations need their own intent table.

## Future Prisma changes

Add the exact enums/models documented in `data-model.md`:

- `ProviderWorker`, `ProviderWorkerProfile`, `ProviderWorkerSkill`
- `ProviderWorkerLoginAccess`, `ProviderWorkerInvitation`
- `ProviderTeam`, `ProviderTeamMembership`
- `ProviderWorkforceHistory`, `ProviderWorkforceCommand`
- `ProviderWorkforceNotificationIntent`

Add opposite relations to `Provider`, `User`, and `MediaFile`; add
`WORKER_PROFILE_IMAGE` to `MediaOwnerType`; add
`ProviderMember.version Int @default(1)` and
`Provider.workforceStateVersion Int @default(1)`.

## SQL requiring explicit review

Prisma cannot fully express these PostgreSQL constraints; the generated SQL
must be reviewed and then augmented only in the new, unapplied phase migration:

1. Partial unique current engagement:
   `identity_user_id` where non-null and `ended_at IS NULL`.
2. Partial unique current Team membership:
   `worker_id` where `ended_at IS NULL`.
3. Partial unique normalized Team name:
   `(provider_id, normalized_name)` where Team is not `ARCHIVED` and name is
   non-null.
4. Partial unique pending invitation per Worker.
5. Check constraints for positive versions, E.164 phone, bounded strings,
   terminal timestamps, and recipient-route validity.
6. Deferred constraint triggers validating same-Provider Team membership,
   Escort `cleans=false`, valid primary Supervisor, active-Team cleaner count,
   and same-identity/same-Provider predecessor links.
7. Immutability triggers or repository denial for history rows; the SQL choice
   must not block migrations/administrative repair and must be documented.

Every constraint must have a stable database name and a safe domain-error
mapping. Raw database constraint names never cross the HTTP boundary.

## Backfill/default strategy

- New workforce tables start empty. Do not infer or create Workers from current
  Provider Owners/Admins, Customers, profile contacts, or prior invitations.
- Add `provider_members.version` with default 1 and non-null in one safe additive
  step. Existing rows retain level/status/timestamps unchanged.
- Add `providers.workforce_state_version` with default 1 and non-null as a
  create-command CAS anchor. It does not encode readiness or operational state.
- New nullable opposite relation columns require no data rewrite.
- Adding `WORKER_PROFILE_IMAGE` enum value is additive; existing Media rows are
  unchanged.
- No existing Provider email outbox row is migrated into the new workforce
  intent table.
- No seed data is required unless implementation discovers a technical catalog
  that is already approved; reason/template code is application-controlled.

## Lock and compatibility risk review

| Change | Risk | Mitigation/evidence |
|---|---|---|
| ProviderMember version column | Table rewrite/lock depends on PostgreSQL default behavior | Review generated SQL; use additive default/non-null compatible with supported PostgreSQL; test populated copy |
| New enum value | Enum DDL lock | Add before table/column references; test clean and upgrade |
| Partial unique indexes | Existing duplicates could block | New workforce tables empty, so no duplicate risk; ProviderMember not indexed by new uniqueness |
| Deferred triggers | Incorrect ordering/false rejection | Integration tests for every valid multi-row transition and rollback |
| User/Media FKs | Accidental cascade | All business/history relations use `ON DELETE RESTRICT` or approved nullable association behavior |
| Notification recipient email | PII exposure | Column is necessary for pre-account delivery; exclude from generic logs/history/audit and test redaction |

## Migration construction workflow (future implementation)

1. Snapshot `git status`, current schema, and migration list; confirm no applied
   migration is edited.
2. Patch `prisma/schema.prisma` incrementally with R1-P07 models only.
3. Run `npm run prisma:validate` and generate the named migration using the
   repository's safe Prisma workflow against an explicitly approved disposable
   development database/schema.
4. Review the complete generated SQL before applying; add required partial
   indexes/deferred triggers in this new migration only.
5. Run Prisma Client generation and typecheck.
6. Prove clean chronological application through R1-P07 in an isolated schema.
7. Prove populated R1-P06 upgrade in a separate isolated schema.
8. Run double-seed only if seed changes exist; otherwise record N/A.
9. Run migration/constraint/concurrency integration tests and report exact
   commands/results.

No production or historical `Cleanora` database is an acceptable proof target.

## Clean-install proof

The future validator must:

- require an explicitly acknowledged disposable target;
- create/use an isolated schema/database unique to the proof;
- deploy all 14 migrations in chronological order;
- compare Prisma migration history and expected R1-P07 tables/enums/indexes;
- exercise database constraints with rollback-isolated fixtures;
- run seed zero/one/two times as applicable;
- leave an evidence summary without printing connection secrets.

## Populated R1-P06 upgrade proof

Build representative R1-P06 data before applying R1-P07: Provider Owner/Admin
memberships, User preferences, Media records, Provider email outbox, verification
documents, payout destinations/history, and readiness-related Provider state.
After deploy, prove:

- every existing row/value/relation remains intact;
- every ProviderMember has `version=1` and unchanged authority;
- workforce tables are empty until explicitly used;
- old email dispatcher queries still work;
- R1-P06 constraints and payout encryption/key references remain intact;
- the new migration applies once and remains visible in `_prisma_migrations`.

## Rollback and forward-fix

Production rollback is not implemented by editing/deleting the migration. If a
defect is found after application, stop rollout and create a separately approved
forward migration. Destructive cleanup, data conversion, or manual production
SQL requires explicit human authorization.

## Evidence checklist

- [ ] Schema diff limited to approved R1-P07 facts
- [ ] New SQL reviewed line by line
- [ ] Existing 13 migration hashes unchanged
- [ ] Prisma validate/generate pass
- [ ] Clean chronological proof pass
- [ ] Populated R1-P06 upgrade proof pass
- [ ] Partial uniqueness and deferred invariant tests pass
- [ ] No database URL/secret printed
- [ ] No production database touched
