# Migration Evidence — R1-P15 Deposit Payments, Methods & Webhooks

Live clean-install and populated P14→P15 upgrade proofs require an approved
disposable target named `CLEANORA_R1_P15_DATABASE_URL` matching
`cleanora_r1_p15_*_(test|proof|clean|ci)`.

## Results (2026-09-12)

| Gate | Command | Result |
|---|---|---|
| Clean install | `npm run db:validate-clean-migration` | **PASS** (exit 0) — isolated schema `cleanora_r1_p15_proof_27944_1789220456918`; 118 tables; 21-migration history; Egypt Paymob CARD+WALLET enabled; empty commercial payment tables; live constraint probes |
| Populated upgrade | `npm run db:validate-r1-p15-upgrade` | **PASS** (exit 0) — isolated schema `cleanora_r1_p15_upgrade_proof_24464_1789221285075`; baseline digests preserved (excluding intentional `status_transition_rules` flip); SYSTEM `AWAITING_DEPOSIT`→`CONFIRMED` executable; Egypt methods; six payment tables |

## Target

Gitignored `CLEANORA_R1_P15_DATABASE_URL` → database name `cleanora_r1_p15_proof`
on Neon project **Cleanora R1-P15 proof** (`patient-scene-93804378`).
Prior P14 / P13 proof databases were not reused.

## Remediation notes during proof

1. Migration SQL initially set `status_transition_rules.updated_at` (column does
   not exist) — removed before successful clean apply.
2. Egypt payment-method seed in SQL is a no-op until the country row exists;
   `prisma/seed.ts` now idempotently upserts CARD/WALLET/OTHER_DISABLED after
   country creation (same pattern as P14 ledger accounts).
