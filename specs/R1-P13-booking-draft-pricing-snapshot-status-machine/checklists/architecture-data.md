# Architecture & Data Checklist: R1-P13

**Purpose**: Module ownership and persistence completeness
**Created**: 2026-09-10
**Feature**: [plan.md](../plan.md)

- [x] CHK021 Bookings owns booking tables and `/api/v1/bookings` — Evidence: `spec.md` FR-001/FR-018; `plan.md` Architecture; `src/modules/bookings/`
- [x] CHK022 Configuration owns deposit percent — Evidence: FR-015; `createDepositPercentReader`
- [x] CHK023 Customers owns address snapshot reader — Evidence: FR-003/FR-014; `createCustomerAddressSnapshotReader`
- [x] CHK024 Media owns BOOKING_ATTACHMENT files — Evidence: FR-003; Media public signer
- [x] CHK025 Eligibility evaluateEligibility explicit only for mutation — Evidence: spec Clarifications; command service `mode: "explicit"`
- [x] CHK026 No orders module/tables — Evidence: spec Out of Scope; EX-01 documented rows only
- [x] CHK027 status_transition_rules seeded with executable vs documented rows — Evidence: migration SQL; `status-transition-seed.test.ts`
- [x] CHK028 Transaction owner is Bookings for create/submit/cancel — Evidence: plan Persistence; repository UoW
- [x] CHK029 Applied migrations remain immutable — Evidence: new `r1_p13_booking_draft_pricing_snapshot_status_machine` only
- [x] CHK030 One deployable monolith; no Docker/cloud — Evidence: spec Out of Scope; constitution
