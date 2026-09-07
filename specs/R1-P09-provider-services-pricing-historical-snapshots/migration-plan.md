# Migration Plan: R1-P09 Provider Services and Pricing

**Status**: Planned only. No schema or migration file has been created or
executed.

## Migration Identity

- Planned directory:
  `prisma/migrations/r1_p09_provider_services_pricing_historical_snapshots/`
- Planned SQL file: `migration.sql`
- Predecessor:
  `r1_p08_catalog_localization_service_requirements`
- Owner: Providers
- Direction: additive and forward-only
- Production execution: explicitly outside R1-P09 planning and requires human
  authorization

Applied migrations must not be edited, reordered, removed, squashed, or reset.

## Planned Schema Delta

The migration creates exactly these four phase tables:

1. `provider_services`
2. `provider_service_prices`
3. `provider_service_price_history`
4. `provider_service_status_history`

It also creates the four Provider-service enums described in
[data-model.md](./data-model.md), the constraints/indexes/triggers required by
those tables, and one supporting composite unique index on the existing Catalog
`service_price_units(id, service_id)` identity so a price can prove unit/service
compatibility with a foreign key.

No Booking, Browse, payment, wallet, order, customer-answer, schedule,
availability, generic workflow, generic approval, command, outbox, cache, or
future-phase table is allowed.

## Planned Creation Order

1. Create Provider-service price/status/history enums.
2. Create `provider_services` with Provider and Catalog service foreign keys,
   uniqueness, duration/note/version checks, and read indexes.
3. Add the supporting Catalog price-unit `(id, service_id)` unique index.
4. Create `provider_service_prices` with composite Provider/offering/service/
   unit integrity, Configuration country/currency FKs, numeric/status checks,
   retained-proposal indexes, and partial unique pending/effective indexes.
5. Create `provider_service_price_history` with composite price/aggregate scope,
   receipt integrity, operation uniqueness, chronological indexes, and the
   append-only trigger.
6. Create `provider_service_status_history` with composite aggregate scope,
   event/value and receipt checks, chronological indexes, and the append-only
   trigger.
7. Create the Provider Service Price trigger that rejects deletes and
   commercial-column rewrites while allowing only legal lifecycle column
   updates.
8. Complete Prisma reverse relations on `Provider`, `Service`,
   `ServicePriceUnit`, `Country`, `Currency`, and `User` without transferring
   module ownership.

## Constraint Review Checklist

### `provider_services`

- `provider_services_provider_catalog_service_key` uniquely covers
  `(provider_id, catalog_service_id)`.
- Supporting unique keys cover `(id, provider_id)` and
  `(id, catalog_service_id)` for composite child FKs.
- Provider and Catalog service FKs use `ON DELETE RESTRICT`.
- `provider_services_duration_valid` enforces 1–1440.
- `provider_services_notes_pair_valid` enforces both-null or a fully trimmed,
  nonblank, 1–1000-character AR/EN pair.
- `provider_services_version_positive` enforces version ≥ 1.
- Indexes support `(provider_id, enabled, id)` and
  `(catalog_service_id, provider_id)`.

### `provider_service_prices`

- Composite offering/provider and offering/service FKs prevent cross-Provider
  or wrong-service children.
- Composite price-unit/service FK prevents a unit belonging to another Catalog
  service.
- Country, currency, proposer, and all parent FKs use `RESTRICT`.
- Exact `numeric(65,0)` minor-unit checks enforce positive price/minimum/maximum,
  minimum ≥ price, and both amounts ≤ accepted maximum. Canonical decimal scale
  is validated before conversion using the recorded currency scale.
- Snapshot-code checks enforce ISO/stable-code shape without treating those
  snapshots as current Catalog/Configuration authority.
- Status/timestamp checks reject impossible pending/effective/rejected/
  superseded combinations.
- Partial unique indexes allow no more than one pending and one effective price
  per offering.
- The price immutability trigger rejects delete and every commercial or
  identity rewrite.

### History tables

- Composite FKs prove Provider, offering, and price identity alignment.
- Operation keys are globally unique within each history table.
- Scoped idempotency keys are unique for primary receipt rows.
- Receipt fields satisfy all-or-none checks; SHA-256 hashes have exact shape.
- Aggregate versions are positive.
- Status history event/value checks prevent fake transitions.
- Chronological, actor, request, and target indexes support authorized reads and
  evidence lookup.
- Both append-only triggers reject every update/delete with a stable SQLSTATE.

## Decimal Review

- Prisma amount fields use exact whole minor units in
  `Decimal @db.Decimal(65,0)`.
- HTTP/module boundaries use strings only.
- The Configuration public reader rejects default-currency scale outside 0–30.
- Boundary parsing converts canonical strings to zero-padded minor-unit digit
  strings and rejects excess scale or more than 65 digits; PostgreSQL uses exact
  integer `numeric` comparisons. Neither migration nor runtime converts
  authoritative values through float/double.
- Canonical output inserts the decimal point using the recorded currency scale
  and appends required zeros; it never rounds excess input precision.
- Live probes include zero, negative, minimum below price, maximum overflow,
  exponent syntax rejection at the boundary, exact 30-place boundary-to-minor-
  unit conversion, whole-minor-unit persistence, and exact string round trips.

## Data and Backfill Policy

- No existing row requires backfill because all four tables are new.
- The migration inserts no Provider Service, Provider Service Price, price
  history, or status history row.
- `prisma/seed.ts` may register only the Configuration key metadata for
  `providers.service_pricing_policy` with a null global value and
  `COUNTRY_REQUIRED`; it must not insert a production country policy value,
  Provider offering, or Provider price.
- Tests may create deterministic Provider/Catalog/country-policy fixtures in
  disposable databases; those are not production seed data.

## Clean Chronological Installation Proof

Extend `scripts/validate-clean-migration.ts` and its unit/live tests to prove:

1. a fresh disposable schema applies every migration exactly once through
   R1-P09 in repository order;
2. `_prisma_migrations` contains one successful, non-rolled-back R1-P09 row;
3. the exact R1-P09 table set is present and no unauthorized phase table exists;
4. all named FKs, checks, indexes, partial indexes, and triggers exist;
5. no Provider offering/price/history row is created by migration/seed;
6. live constraints reject wrong Provider/service/unit relations, invalid
   decimals, duplicate offerings, duplicate pending/effective rows, invalid
   notes/duration/version/status/timestamps, and history mutations;
7. accepted decimal values and legal state transitions survive exact reads;
8. a second `prisma migrate deploy` is a no-op with unchanged table data and
   migration history.

The validator must require an explicitly approved disposable PostgreSQL URL and
must not infer approval for a shared or production target.

## Populated R1-P08 → R1-P09 Upgrade Proof

Create `scripts/validate-r1-p09-upgrade.ts` and matching unit/live tests. The
validator must:

1. apply migrations only through R1-P08 in an isolated disposable schema;
2. seed representative R1-P08 Configuration, Authentication, approved Provider,
   workforce, Catalog service, active price unit, fields/options/media, and
   audit truth;
3. record row counts and stable digests for every pre-existing R1-P08 table;
4. apply only the R1-P09 migration;
5. prove all baseline counts/digests and Catalog/Provider relationships remain
   unchanged;
6. prove all four R1-P09 tables are empty immediately after upgrade;
7. insert controlled R1-P09 fixtures and run the live uniqueness, FK, numeric,
   partial-unique, status/timestamp, receipt, and immutability probes;
8. rerun deploy and prove migration history and data are unchanged;
9. destroy only the validator-created isolated schema/temp directory after
   verifying their resolved paths.

## SQL Safety Scan

Unit tests must reject R1-P09 migration SQL containing or implying:

- `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, broad `DELETE`, destructive
  `ALTER TYPE`, or reset operations;
- changes to an applied migration;
- unguarded updates/backfills of R1-P08 Provider or Catalog rows;
- `ON DELETE CASCADE` on any R1-P09 financial/history relationship;
- a fifth R1-P09 table;
- Booking/Browse/future-phase table names;
- float/double money columns;
- production Provider offering or price inserts.

## Planned Validation Commands — Not Run During Planning

The future implementation handoff will use the repository's approved
disposable-database safety mechanism before running these commands:

```text
npm run prisma:validate
npm run db:validate-clean-migration
npm run db:validate-r1-p09-upgrade
npm run test:r1-p09
npm run test:coverage:r1-p09
```

These commands are evidence requirements, not authorization to run a database,
migration, test, or coverage command now or against production.
