# R1-P08 Disposable Migration Evidence

Evidence date: 2026-09-02  
Status: PASS — clean installation, populated R1-P07 upgrade, live constraints, and double-seed idempotency complete

## Isolation and safety

Proofs used the owner-approved `CLEANORA_R1_P08_DATABASE_URL` /
`TEST_MIGRATION_DATABASE_URL` connection for disposable database
`cleanora_r1_p08_test`. Each validator created and dropped its own isolated
proof schema. The stale shared R1-P04 `TEST_DATABASE_URL` target was not queried,
reset, migrated, seeded, or changed. The approved target's database name matched:

```text
^cleanora_r1_p08(?:_[a-z0-9]+)*_(?:test|proof|clean|ci)$
```

No URL, host credential, password, token, or external endpoint is recorded here.

## Clean chronological installation

```text
> npm run db:validate-clean-migration
exit 0
Applied all migrations in an isolated schema against disposable database
cleanora_r1_p08_test; verified exact 76 tables, 15-migration history,
double-seed idempotency, DEC-044 Catalog counts, and live R1-P05/R1-P06/R1-P07/R1-P08
constraint probes.
```

Verified facts:

- 15 chronological migrations applied, ending with
  `r1_p08_catalog_localization_service_requirements`;
- 76 exact public tables existed after migration;
- seed ran twice with identical row inventories (idempotent);
- DEC-044 counts after seed: 1 category, 1 service, 2 service translations,
  2 price units, 5 fields, 1 `EG` availability record;
- live R1-P08 constraint probes rejected lowercase codes, duplicate codes,
  zero versions, malformed command hashes, and invalid completed-command rows
  with exact SQLSTATE evidence.

## Populated R1-P07 upgrade

```text
> npm run db:validate-r1-p08-upgrade
exit 0
Upgraded populated R1-P07 fixture in an isolated schema against disposable
database cleanora_r1_p08_test; preserved all baseline table digests, workforce
truth, empty Catalog tables before seed, idempotent re-deploy, DEC-044 seed
counts, and live R1-P08 constraints.
```

The fixture was created at the exact R1-P07 migration boundary. The proof then
applied only the future R1-P08 migration, compared all pre-upgrade baseline
table digests, verified existing Provider/workforce meaning, confirmed empty
Catalog tables before seed, reran deploy idempotently, and exercised live R1-P08
constraints and DEC-044 counts.

The concurrent R1-P06 payout-reveal compatibility probe ran each participant in
its own transaction with the validator's bounded remote-safe transaction
options. This preserves the six-way concurrency assertion without relying on
Prisma's default five-second interactive-transaction timeout.

## Scope boundary

This proof authorizes no production migration, deployment, remote database
operation outside the approved disposable targets, destructive action, or Git
action.
