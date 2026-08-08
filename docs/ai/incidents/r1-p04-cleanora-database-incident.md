# R1-P04 — Accidental `Cleanora` database migration incident

**Recorded:** 2026-08-08 (fresh independent final re-review)

## Cause

During the independent final re-review, a Windows `/tmp` environment override file write failed. Subsequent `prisma migrate deploy` and `npm run seed` fell back to the repository `.env` default `DATABASE_URL` instead of the intended disposable R1-P04 proof target.

## Unexpected target

- Database name: `Cleanora`

## Observed state (reviewer-recorded)

- Ten migrations reported applied (`r1_p01` through `r1_p04_02`).
- Seed did **not** succeed on that target.
- Recorded role count: **0**.
- No further writes occurred after detection.

## Actions taken during review

- No rollback attempted.
- No migration-history rows deleted.
- No reset, drop, rename, or additional seed against `Cleanora`.
- Review continued only on authorized disposable proof databases.

## Owner decision required

Recovery or acceptance of the `Cleanora` database state is deferred to a
separate human-owner decision. This artifact records facts only; it does not
prescribe remediation.

## Complete-approval boundary (2026-08-08)

R1-P04 was approved Complete with an explicit owner acknowledgment that this
historical incident remains separate. Complete approval does **not** authorize
connecting to, inspecting, accepting, rolling back, resetting, seeding,
migrating, deleting, or recovering database `Cleanora`. Administrative closure
did **not** access or modify `Cleanora`.
