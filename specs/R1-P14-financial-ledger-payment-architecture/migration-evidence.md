# R1-P14 Migration Evidence

Live clean-install and populated P13→P14 upgrade proofs require an approved
disposable target named `CLEANORA_R1_P14_DATABASE_URL` matching
`cleanora_r1_p14_*_(test|proof|clean|ci)`.

## Status

| Proof | Command | Result |
|---|---|---|
| Clean install | `npm run db:validate-clean-migration` | **PASS** (exit 0, 2026-09-11) — isolated schema `cleanora_r1_p14_proof_30112_1789169264552`; 112 tables; 20-migration history; eight Egypt system ledger accounts; empty commercial journals; live ledger + booking immutability; live R1-P05–P09 constraint probes |
| Populated upgrade | `npm run db:validate-r1-p14-upgrade` | **PASS** (exit 0, 2026-09-11) — isolated schema `cleanora_r1_p14_upgrade_proof_9380_1789169695856`; baseline digests preserved; eight Egypt accounts; empty journals; live ledger immutability; idempotent re-deploy |

## Target

Gitignored `CLEANORA_R1_P14_DATABASE_URL` → database name `cleanora_r1_p14_proof`
on a **new empty** Neon project (`Cleanora R1-P14 proof`, id
`late-waterfall-33586410`). Existing `Full Service` / `Cleanora` /
`cleanora_r1_p13_proof` / P11 / P04 databases were not used.

## Commands

```text
npm run db:validate-clean-migration
npm run db:validate-r1-p14-upgrade
```
