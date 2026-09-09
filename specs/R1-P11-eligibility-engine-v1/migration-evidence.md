# R1-P11 Disposable Migration Evidence

Evidence date: 2026-09-09  
Status: **PASS** — live clean installation and populated R1-P10→R1-P11 upgrade both exited 0

## Isolation and safety

- Target: approved disposable Neon database matching
  `^cleanora_r1_p11(?:_[a-z0-9]+)*_(?:test|proof|clean|ci)$`
  (`cleanora_r1_p11_proof` via `CLEANORA_R1_P11_DATABASE_URL`)
- Validators create isolated proof schemas; they do not mutate production `Cleanora`
- Repository `.env` secrets were not committed

## Live results

| Validator | Command | Result |
|---|---|---|
| Clean chronological install | `npm run db:validate-clean-migration` | **PASS** (exit 0) — 18 migrations, exact 96 product tables, double-seed idempotency, empty R1-P09/R1-P10 phase tables, empty Eligibility evaluation trees with seeded rule versions, live R1-P05–P09 constraint probes |
| Populated upgrade | `npm run db:validate-r1-p11-upgrade` | **PASS** (exit 0) — first attempt failed with Neon `P1017` (server closed the connection) during `migrate deploy`; immediate retry **PASS**. Populated R1-P10 fixture preserved baseline digests; Eligibility tables empty before seed; rule versions seeded with empty evaluation trees; idempotent re-deploy; live post-deploy constraints |

Isolated schemas (ephemeral, not production):

- Clean: `cleanora_r1_p11_proof_<pid>_<ts>`
- Upgrade: `cleanora_r1_p11_upgrade_proof_<pid>_<ts>`

## Static / unit evidence

| Check | Result |
|---|---|
| `tests/unit/scripts/validate-r1-p11-upgrade.test.ts` | PASS (in phase suite) |
| `tests/unit/scripts/validate-clean-migration.test.ts` | PASS after T048 chronology pin included P10 and P11 |
| `tests/integration/database/r1-p11-schema-constraints.test.ts` | PASS on disposable P11 URL |
| `tests/integration/eligibility/r1-p11-rule-seed.test.ts` | PASS — identical reseed no-op; drift fails without overwrite |

## Scope boundary

This record authorizes no production migration, deployment, remote non-disposable database operation, destructive action, or Git action. SC-008 is satisfied only for the disposable proof target above.
