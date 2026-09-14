# Migration Review — r1_p17_worker_team_assignment

**Date**: 2026-09-14
**Phase**: R1-P17 Worker & Team Assignment

## Summary

Additive migration: BookingStatus `ASSIGNED`, notification templates,
actor command types, three assignment tables, partial unique one ACTIVE
assignment per booking, and status_transition_rules for assign + cancel
from ASSIGNED.

## Risk

- Low: additive enums/tables/indexes only; no drops or rewrites.
- Partial unique index requires PostgreSQL (repo standard).
- Enum ADD VALUE is non-transactional in older Postgres; project already
  uses this pattern in P16.

## Backfill

None. No existing assignments.

## Forward-fix

Drop new FKs/tables/types only via a new forward migration if ever needed.
Never edit this applied migration.
