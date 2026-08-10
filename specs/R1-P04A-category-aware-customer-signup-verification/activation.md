# R1-P04A Activation — Category-Aware Customer Signup & Verification

**Status:** In Progress — specification complete; technical planning and
implementation authorized by the human owner on 2026-08-09.

## Authorization

The human owner explicitly authorized understanding, planning, implementation,
schema changes, migration creation, documentation, and all required tests for
the described signup/verification change. The owner separately authorized the
guarded commit-and-push workflow with the exact trigger on 2026-08-10. Merge,
deployment, and production migration remain unauthorized.

## Boundaries

- One active phase: R1-P04A.
- R1-P04 remains Complete and its applied migrations remain immutable.
- DEC-034 supersedes DEC-028 only for the verification behavior named there.
- No Orders module, deployment, production database access/migration, merge, or
  destructive action outside the approved isolated proof database is authorized.
- The historical `Cleanora` database incident remains untouched.

## Next gate

Complete Spec Kit planning and tasks, implement in dependency order, run the
phase and repository quality gates, and present evidence for owner review.
