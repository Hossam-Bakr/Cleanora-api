# R1-P16 migration evidence

Migration: `prisma/migrations/r1_p16_provider_booking_response_cancellation_events/`

## SQL review

See `migration-review.md`. Additive SQL is unit-tested by
`tests/unit/scripts/validate-r1-p16-migration.test.ts`.

## Results (2026-09-14)

| Gate | Command | Result |
|---|---|---|
| Clean install | `npm run db:validate-clean-migration` | **PASS** (exit 0) — isolated schema `cleanora_r1_p16_proof_30060_1789366004622`; 123 tables; 22-migration history; `BookingStatus.ACCEPTED`; seeded `cancellation_reasons` including `PROVIDER_RESPONSE_EXPIRED`; Egypt `commercial.provider_response_hours = 24`; empty commercial response/cancellation/intent/actor-command tables; live constraint probes |
| Populated upgrade | `npm run db:validate-r1-p16-upgrade` | **PASS** (exit 0) — isolated schema `cleanora_r1_p16_upgrade_proof_12396_1789366361098`; baseline digests preserved (excluding intentional hours/transition/reason seeds); `ACCEPTED`; Egypt hours; empty commercial P16 response tables |

## Target

Gitignored `CLEANORA_R1_P16_DATABASE_URL` → database name `cleanora_r1_p16_proof`
on Neon project **Cleanora R1-P16 proof** (`mute-mode-84187765`).
Prior P15 / P14 proof databases were not reused.

## Remediation notes during proof

1. Egypt `commercial.provider_response_hours` SQL is a no-op until the country
   row exists; `prisma/seed.ts` now idempotently upserts the app and Egypt
   country config after country creation (same pattern as P15 payment methods).
2. Live enum checks must use `enum_range(NULL::"BookingStatus")` so they honor
   the isolated proof `search_path`; catalog `pg_type` without schema missed
   the proof-schema label.
