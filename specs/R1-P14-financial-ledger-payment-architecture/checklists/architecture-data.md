# Architecture & Data Checklist: R1-P14

**Purpose**: Module ownership and persistence completeness
**Created**: 2026-09-11
**Feature**: [plan.md](../plan.md)

- [x] CHK021 Payments owns the six roadmap tables and `payments.public.ts`
- [x] CHK022 Bookings owns the financial snapshot reader only; no ledger Prisma in bookings
- [x] CHK023 Configuration remains country/currency fact owner
- [x] CHK024 No orders module/tables; ORDER link reserved unused
- [x] CHK025 System accounts only; no user/provider wallet table
- [x] CHK026 Transaction owner is Payments for post/adjust/snapshot
- [x] CHK027 Entries/links/snapshots immutable (no updated_at; SQL reject rewrite)
- [x] CHK028 Applied migrations remain immutable
- [x] CHK029 One deployable monolith; no Docker/cloud
- [x] CHK030 Seed Egypt system accounts idempotently
