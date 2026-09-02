# R1-P08 Migration Review

**Migration**: `r1_p08_catalog_localization_service_requirements`  
**Status**: Forward-only SQL reviewed for first application; live apply blocked
until an approved disposable target exists.

## Statements

1. Create enums `CatalogLocale`, `ServiceFieldKind`, `ServiceNumberMode`,
   `CatalogCommandStatus`.
2. Extend `MediaOwnerType` with `CATALOG_SERVICE_IMAGE`.
3. Create nine Catalog tables in dependency order with uniques, indexes, CHECKs,
   and `ON DELETE RESTRICT` foreign keys to Catalog parents, `countries`, and
   `media_files`.

## Risks

- Additive only; no DROP/TRUNCATE/backfill of existing product rows.
- Enum value append is PostgreSQL-compatible after R1-P07.
- Kind-column CHECKs reject incompatible non-null constraint columns even for
  inactive drafts.
- Live constraint proof remains gated on an approved
  `cleanora_r1_p08_*_(test|proof|clean|ci)` database.

## US2 policy ↔ SQL reconciliation (T069)

Static contract tests in `tests/integration/database/r1-p08-migration-contract.test.ts`
and unit policy tests in `tests/unit/catalog/service-field.policy.test.ts` now
cover the same DEC-042 matrix enforced in migration SQL:

| Policy rule | SQL constraint |
|---|---|
| `INFORMATION` never required | `service_fields_information_required_check` |
| Length bounds only on `TEXT` | `service_fields_text_bounds_check` |
| Non-negative / ordered text lengths | `service_fields_text_length_nonneg_check`, `service_fields_text_length_order_check` |
| `NUMBER` requires mode; other kinds null numeric columns | `service_fields_number_mode_check` |
| Ordered numeric bounds | `service_fields_number_bounds_order_check` |
| Selection bounds only on `MULTI_SELECT` | `service_fields_selection_bounds_kind_check` |
| Non-negative / ordered selection bounds | `service_fields_selection_bounds_nonneg_check`, `service_fields_selection_bounds_order_check` |
| Uppercase stable codes for units/fields/options | `service_price_units_code_format_check`, `service_fields_code_format_check`, `service_field_options_value_format_check` |
| Per-service / per-field unique code and display order | unique indexes on `(service_id, code)` and `(service_id, display_order)` plus option equivalents |

No migration SQL was edited; reconciliation is documentation plus passing static
and policy tests only. Live INSERT/UPDATE constraint probes remain blocked until
an approved disposable database exists.

## Prisma validate/generate (T140)

| Command | Exit | Notes |
|---|---|---|
| `npm.cmd run prisma:validate` | 0 | Schema valid after R1-P08 |
| `npm.cmd run prisma:generate` | 0 | Client regenerated to `src/generated/prisma` |

## Migration SQL re-review (T141)

Re-reviewed `r1_p08_catalog_localization_service_requirements/migration.sql` against
`migration-plan.md` and static contract tests. Additive only: four Catalog enums,
`CATALOG_SERVICE_IMAGE` + `CATALOG_MANAGEMENT_WRITE` enum extensions, nine
Catalog tables, named CHECK/unique/index inventory, `ON DELETE RESTRICT` FKs.
No applied migration edited. Live constraint probes passed in clean-install proof.

## Clean/upgrade validation scripts (T142–T143)

| Script | Exit | Notes |
|---|---|---|
| `db:validate-clean-migration` | 0 | 15 migrations, 76 tables, double-seed, DEC-044 counts, R1-P08 probes |
| `db:validate-r1-p08-upgrade` | 0 | Populated R1-P07 fixture preserved; empty Catalog pre-seed; idempotent re-deploy |

See `migration-evidence.md` for disposable target names and isolation notes.
