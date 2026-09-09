# R1-P10 Disposable Migration Evidence

Evidence date: 2026-09-09  
Status: **PASS** — live clean installation and populated R1-P09→R1-P10 upgrade both exited 0

Fresh reconfirmation after final adversarial repairs: **PASS** on 2026-09-09;
both validators exited 0 against the same approved disposable target.

## Isolation and safety

- Target: approved disposable Neon database matching
  `^cleanora_r1_p10(?:_[a-z0-9]+)*_(?:test|proof|clean|ci)$`
  (`cleanora_r1_p10_proof`, direct/non-pooler URL via `CLEANORA_R1_P10_DATABASE_URL`)
- Validators create isolated proof schemas; they do not mutate production `Cleanora`
- Repository `.env` secrets were not committed; URL file stayed outside the repo

## Live results

| Validator | Command | Result |
|---|---|---|
| Clean chronological install | `npm run db:validate-clean-migration` | **PASS** (exit 0) — 17 migrations, exact 93 product tables, double-seed idempotency, live R1-P05–P09 constraint probes |
| Populated upgrade | `npm run db:validate-r1-p10-upgrade` | **PASS** (exit 0) — P09 baseline digests preserved (`country_configs` version-stripped; `app_configs` policy asserted separately), empty R1-P10 availability tables before seed, Egypt `Africa/Cairo`, `country_configs.version`, `platform.default_timezone` → `COUNTRY_REQUIRED`, idempotent redeploy, post-deploy constraints |

Transcripts (local, not committed):

- `…/final-gates/clean-migration.log`
- `…/final-gates/upgrade-migration-attempt4.log`

## Static / unit evidence

| Check | Result |
|---|---|
| `tests/unit/scripts/r1-p10-migration-static.test.ts` | PASS (in phase suite) |
| `tests/unit/scripts/validate-r1-p10-upgrade.test.ts` | PASS — URL/SQL/digest/filter guards |

## Scope boundary

This record authorizes no production migration, deployment, remote non-disposable database operation, destructive action, or Git action. SC-008 is satisfied only for the disposable proof target above.
