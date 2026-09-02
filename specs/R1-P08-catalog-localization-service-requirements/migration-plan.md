# R1-P08 Migration and Seed Plan

**Status:** Planned; no schema, migration, seed, or database command has run as
part of planning

**Migration name:** `r1_p08_catalog_localization_service_requirements`

## Baseline

- The applied history currently ends with
  `r1_p07_worker_team_crew_management`.
- There are 14 existing chronological migrations. None may be edited,
  reordered, deleted, reset, or repurposed.
- `prisma/schema.prisma` currently has no Catalog models.
- `Country.code` and active state remain Configuration-owned.
- `media_files` is Media-owned, requires `owner_user_id`, and lacks a Catalog
  owner type/relation.
- `audit_logs` already supports safe actor/action/target/reason/context/request
  evidence and is not an idempotency store.

## Phase-owned schema changes

### Enums

- Create `CatalogLocale` (`AR`, `EN`).
- Create `ServiceFieldKind` with the six DEC-042 values.
- Create `ServiceNumberMode` (`INTEGER`, `DECIMAL`).
- Create `CatalogCommandStatus` (`PENDING`, `COMPLETED`).
- Add `CATALOG_SERVICE_IMAGE` to existing `MediaOwnerType`.

### New Catalog tables

1. `service_categories`
2. `services`
3. `service_translations`
4. `service_price_units`
5. `service_fields`
6. `service_field_options`
7. `service_country_availability`
8. `service_media_associations`
9. `catalog_command_requests`

The first seven are the canonical R1-P08 inventory. The last two are documented
active-phase additions required for Catalog-owned service-media ordering and
durable command idempotency. Update `docs/architecture/entity-ownership.md` in
the implementation so the architecture inventory is not silently stale.

### Existing-model relation changes

- `Country`: add only the Prisma opposite relation for availability rows.
- `MediaFile`: add the opposite optional relation for one service-media
  association. Keep all existing fields and lifecycle semantics unchanged.
- `User`: no Catalog relation is required for command actor IDs; Catalog stores
  the trusted ID as an audit/idempotency reference without claiming Identity
  ownership.

## Generated SQL review requirements

Review the generated migration before any application. It must contain:

- enum creation/addition only for the values above;
- nine new tables with snake_case mappings and explicit PK/FK constraints;
- `ON DELETE RESTRICT` for stable category/service/country/media references;
- the unique and supporting indexes listed in `data-model.md`;
- check constraints for positive versions, non-negative positions, stable-code
  formats, bound ordering, and field-kind compatible columns;
- no drop/rename/truncate/reset, no applied-migration edit, no future-phase
  table, and no provider price/booking/customer-answer column;
- no implicit default that activates an existing record;
- no destructive backfill or table rewrite of an existing high-volume model.

Prisma cannot express every PostgreSQL check/partial invariant. The phase-owned
generated migration may be reviewed and then extended before first application
with named R1-P08 constraints/indexes. Once applied to any accepted environment,
it is immutable and future corrections use a new forward migration.

## Required database constraints

At minimum, SQL/live probes must prove:

- uppercase stable-code/value formats;
- `version > 0`, `display_order >= 0`;
- category global position uniqueness;
- service position unique within category;
- translation locale unique within service;
- unit code/position unique within service;
- field code/position unique within service;
- option value/position unique within field;
- availability unique within service/country;
- media ID globally unique in service associations and position unique within
  service;
- idempotency key unique within scope;
- `COMPLETED` command has completion time/accepted result facts and pending
  reservation shape is internally valid;
- min/max ordering and non-negative length/selection bounds;
- columns incompatible with each field kind are null and `INFORMATION` is never
  required.

Cross-row activation completeness, option-count, active-country, and READY
Media rules are enforced by Catalog application policies inside locked
transactions and proven with integration/race tests; they are not hidden in
database triggers.

## Backfill and compatibility

- All Catalog tables are new, so no Catalog data backfill exists.
- Existing `media_files` rows keep their current enum value and every column
  unchanged. Adding one enum value and an optional opposite relation requires no
  row update.
- Existing countries gain no stored column and no value change.
- Existing users, roles, permissions, audit logs, Provider/Worker truth, and
  prior seed data remain byte-for-byte business compatible.
- Authorization seed additions use upsert/create-if-missing behavior for two
  permissions, one reason definition, two protected operations, and only the
  `staff_admin` role mapping. Existing roles/mappings remain intact.

## Egypt Catalog seed

Implement DEC-044 through a focused Catalog seed function composed by
`prisma/seed.ts`.

### Clean first run

After Configuration/Auth seed prerequisites exist, create:

- one `HOME_CLEANING` category;
- one `STANDARD_HOME_CLEANING` service with `AR` and `EN` translations;
- two units: `PER_VISIT`, `PER_HOUR`;
- five fields with exact codes/values from `data-model.md`;
- one available `EG` row;
- no Media record, provider offering, price, answer, or Booking row.

Use the same normalization and policy functions as management; do not duplicate
a weaker seed-only validator.

### Re-run ownership rule

- Locate records by stable unique codes.
- Create a missing record with initial values.
- Use an empty update branch for an existing record.
- Do not reactivate, reorder, move, relabel, rewrite descriptions, replace
  fields, or bump versions for existing owner-managed records.
- Do not duplicate relations or child records.

### Double-run evidence

Capture IDs, versions, lifecycle, localized values, positions, and counts after
run one. Run the seed again, then prove the captured digest is unchanged and the
exact seed-owned counts remain 1 category / 1 service / 2 units / 5 fields / 1
availability.

## Clean chronological installation proof

Use an explicitly approved isolated database whose name matches:

```text
^cleanora_r1_p08(?:_[a-z0-9]+)*_(?:test|proof|clean|ci)$
```

Required evidence:

1. target identity/safety guard passes and target is not the repository `.env`
   database;
2. all 15 migrations deploy chronologically from empty;
3. Prisma migration status is current;
4. seed run one succeeds and exact Catalog rows/selectability pass;
5. seed run two changes no digest/count;
6. live SQL constraints reject invalid codes, positions, kinds/bounds,
   duplicates, bad FKs, and malformed command state;
7. every prior expected public table remains present.

## Populated R1-P07 upgrade proof

Use a separate explicitly approved phase-named database. Prepare a populated
R1-P07 baseline with representative Authentication, Configuration, Customer,
Provider, verification, payout, Worker, Team, Media, audit, and seed truth.
Capture baseline table/schema digests, then apply only the R1-P08 migration and
seed.

Prove:

- the R1-P07 migration history is preserved and R1-P08 is appended once;
- all pre-existing baseline business digests remain equal;
- existing `media_files.owner_type` values/relations remain valid;
- authorization additions are additive and only `staff_admin` gains Catalog
  permissions;
- the new Catalog is selectable for `EG` and second seed run is a no-op;
- no earlier record is reactivated, rewritten, or deleted.

## Validation commands after implementation

Run against safe targets and report exact exits:

```powershell
npm.cmd run prisma:validate
npm.cmd run prisma:generate
npm.cmd run db:validate-clean-migration
npm.cmd run db:validate-r1-p08-upgrade
npm.cmd run seed
```

The implementation may add an R1-P08-specific clean/seed proof script or test
when needed, but must not weaken the repository target-name guards.

## Failure and forward-fix strategy

- Before first accepted application, fix the new R1-P08 migration and re-review
  its SQL.
- After accepted application anywhere, never edit it; add a clearly named
  forward migration.
- If Media upload succeeds but the final Catalog transaction fails, request
  Media cleanup and keep no service association. A retry of the same request
  resumes the reserved media ID when safe.
- If seed encounters an existing stable code, it preserves it rather than
  forcing a product overwrite. A management validation report may expose the
  existing record as inactive/incomplete; the seed does not repair it silently.
- No rollback plan may use reset, destructive cleanup, or production access.
