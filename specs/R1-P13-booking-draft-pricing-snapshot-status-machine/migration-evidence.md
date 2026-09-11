# R1-P13 migration evidence

Live clean-install and populated-upgrade proofs require an approved disposable
target named `CLEANORA_R1_P13_DATABASE_URL` (or the repository's documented
`cleanora_r1_p13_*_(test|proof|clean|ci)` pattern).

| Proof | Command | Result |
|---|---|---|
| SQL review | `migration-review.md` | PASS |
| `prisma validate` | `npm run prisma:validate` | PASS (2026-09-11) |
| Clean install | `npm run db:validate-clean-migration` against P13 disposable URL | **PASS** (exit 0, 2026-09-11) — final migration bytes in isolated schema `cleanora_r1_p13_proof_8024_1789086681527`; 106 tables; 19-migration history; double-seed idempotency; empty booking commercial tables with seeded `status_transition_rules`; live snapshot/price-breakdown immutability (`55000`); live R1-P05–P09 constraint probes |
| Populated upgrade | `npm run db:validate-r1-p13-upgrade` | **PASS** (exit 0, 2026-09-11) — final migration bytes in isolated schema `cleanora_r1_p13_upgrade_proof_6544_1789086926786`; preserved non-config R1-P11 baseline digests, seeded Egypt `commercial.deposit_percent` and `status_transition_rules`, left booking commercial tables empty, re-deployed idempotently, and re-ran live immutability plus post-deploy constraints |
| Trigger rewrite | included in both live proofs via `probeR1P13Immutability` | **PASS** — UPDATE/DELETE on `booking_snapshots` and `booking_price_breakdowns` raise `55000` and roll back |

Target: gitignored `CLEANORA_R1_P13_DATABASE_URL` → database name `cleanora_r1_p13_proof` on a **new empty** Neon project (`Cleanora R1-P13 proof`). The existing `Full Service` Neon project was not used (branch logical size already at the 512 MiB limit; earlier `create_postgres_database` there returned HTTP 412). Existing `Cleanora` / P11 / P04 / P10 databases were not used.

The clean-migration inventory includes
`r1_p13_booking_draft_pricing_snapshot_status_machine` (10 booking tables) and
`requireR1P13ProofDatabaseUrl`. Historical P10/P11 upgrade validators allow the
P13 folder without applying it. Offline `assertR1P13MigrationSql` PASS, including
Egypt-only `commercial.deposit_percent` seed and snapshot/price-breakdown
immutability triggers.

Do not treat skipped live proofs as PASS. These live proofs are recorded **PASS**,
not skipped.
