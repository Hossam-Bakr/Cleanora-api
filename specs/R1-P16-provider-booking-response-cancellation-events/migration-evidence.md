# R1-P16 migration evidence

Migration: `prisma/migrations/r1_p16_provider_booking_response_cancellation_events/`

## SQL review

See `migration-review.md`. Additive SQL is unit-tested by
`tests/unit/scripts/validate-r1-p16-migration.test.ts` (**PASS** with the
phase suite on 2026-09-13).

## Live clean install + populated upgrade

**BLOCKED**

Exact missing input: environment variable `CLEANORA_R1_P16_DATABASE_URL`.

Required disposable database name pattern:
`cleanora_r1_p16_*_(test|proof|clean|ci)`.

Do not treat a P15-named proof URL as a P16 pass. Do not invent PASS.
