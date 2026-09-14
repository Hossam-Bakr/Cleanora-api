# R1-P17 Implementation Summary — Worker & Team Assignment

**Date**: 2026-09-14  
**Branch**: `r1-p17-worker-team-assignment`  
**Status**: **Complete** — DEC-099 (owner `mark complete`)

## What landed

- **Providers public**: `getAssignmentWorkerFacts` + `coversWorkerBookingWindow` on
  `ProviderWorkforcePublicReader`, implemented on `ProviderWorkforceReadinessService`
  with availability calendar coverage helper (ad-hoc `cleans` from workerType).
- **Bookings assignment**: policy (composition, escort, crew, EX-01, units, overlap
  helper) + service (assign/replace team|workers, idempotency, ACCEPTED→ASSIGNED,
  SUPERSEDE, intents BOOKING_ASSIGNED / BOOKING_ASSIGNMENT_REPLACED).
- **HTTP**: provider assignment routes + `GET /api/v1/workers/me/assignments`.
- **Cancel-from-ASSIGNED**: response + command paths allow ASSIGNED without fees.
- **Dossier**: optional `assignment` summary via composition-injected reader.
- **Docs/tests**: OpenAPI YAML, Postman collection, `vitest.r1-p17.config.ts`,
  `test:r1-p17` / `test:coverage:r1-p17`, policy/service/boundary/migration/openapi
  unit tests.

## Named exceptions kept

- **EX-01** teamId must equal `booking.teamId`
- **EX-02** notification intents only
- **EX-03** no staff assignment write

## Not in this pass

- Migration evidence on disposable DB (T025) — PASS (`cleanora_r1_p17_proof`; see migration-evidence.md)
- Codex final review PASS; owner Complete (DEC-099); git publish still pending exact `commit and push`
