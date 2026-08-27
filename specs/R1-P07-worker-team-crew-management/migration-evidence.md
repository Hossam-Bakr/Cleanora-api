# R1-P07 Disposable Migration Evidence

Evidence date: 2026-08-24
Status: PASS — clean installation, populated R1-P06 upgrade, live constraints, and database-backed regression evidence complete

## Isolation and safety

The repository `.env` database was not used, queried, reset, migrated, seeded,
or changed. Codex created a temporary PostgreSQL 18 cluster bound only to
localhost and fresh disposable databases named for R1-P07. The final proof
target was `cleanora_r1_p07_final_coverage_proof`; an earlier clean/upgrade
target was also phase-named and disposable. No URL, host credential, password,
token, or external endpoint is recorded here.

Every target passed the repository guard:

```text
^cleanora_r1_p07(?:_[a-z0-9]+)*_(?:test|proof|clean|ci)$
```

The cluster and its proof databases are stopped and deleted after the final
database-dependent gate; nothing is retained or recoverable by design.

## Clean chronological installation

```text
> npm run db:validate-clean-migration
exit 0
Applied all migrations in isolated schema
cleanora_r1_p07_proof_11220_1787588504631; verified exact tables, full
history, double-seed idempotency, and live R1-P05/R1-P06/R1-P07 constraint
probes.
```

Verified facts:

- 14 chronological migrations applied, ending with
  `r1_p07_worker_team_crew_management`;
- 67 exact public tables existed after migration;
- a second seed execution was idempotent;
- the R1-P07 deferred cross-row triggers, partial uniqueness, history
  immutability, version checks, and inherited live constraints rejected the
  intended invalid states with exact SQLSTATE evidence.

## Populated R1-P06 upgrade

```text
> npm run db:validate-r1-p07-upgrade
exit 0
Upgraded populated R1-P06 fixture in isolated schema
cleanora_r1_p07_upgrade_proof_18680_1787588963115; preserved all baseline
table digests, authority, preferences, Media, outbox, verification, payout
data, and verified R1-P07 defaults, empty workforce state, history,
idempotent re-deploy, and live constraints.
```

The fixture was created at the exact R1-P06 migration boundary. The proof then
applied only the future R1-P07 migration, compared all pre-upgrade baseline
table digests, verified existing Provider/member meaning and R1-P06
verification/payout data, confirmed the new positive version defaults and
empty workforce state, reran deploy idempotently, and exercised live R1-P07
constraints.

## Database-backed suites

```text
Previously guarded database files:
Test Files  3 passed (3)
Tests       5 passed (5)

> npm run test:r1-p07
Test Files  79 passed (79)
Tests       330 passed (330)

> npm run test:integration
Test Files  149 passed (149)
Tests       497 passed (497)

> npm run test:coverage
Test Files  336 passed (336)
Tests       1405 passed (1405)
Statements  83.50% (8487/10164)
Branches    75.31% (6134/8144)
Functions   86.00% (1795/2087)
Lines       85.80% (8192/9547)
```

The three formerly guarded files prove immutable Worker history retention,
single-winner current identity claims under concurrency, and the Provider-
created Worker enrollment boundary. All shared-target database suites ran
sequentially. No arbitrary retry or skipped test is counted as evidence.

## Scope boundary

This proof authorizes no production migration, deployment, remote database
operation, destructive action outside the temporary cluster, or Git action.
The installed PostgreSQL service was not modified.
