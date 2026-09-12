# Architecture & Data Checklist: R1-P15

**Purpose**: Module ownership and persistence completeness
**Created**: 2026-09-12
**Feature**: [plan.md](../plan.md)

- [x] CHK024 Payments extends existing module; owns six P15 tables + P14 ledger
- [x] CHK025 Bookings owns `confirmDepositPayment` only; no payments Prisma in bookings
- [x] CHK026 Payments reads booking financial facts via public reader / confirm seam only
- [x] CHK027 `PaymentGatewayPort` with Paymob + test fake; no InstaPay adapter
- [x] CHK028 Egypt seed enables Paymob CARD + WALLET only; other rails disabled config
- [x] CHK029 Transaction owner is Payments for initiate/webhook pipeline
- [x] CHK030 Deposit success uses existing `postJournal` (no second ledger writer)
- [x] CHK031 Applied migrations remain immutable; new phase migration named
- [x] CHK032 One deployable monolith; no Docker/cloud
- [x] CHK033 Refund foundation rows only; no gateway refund execution; no REFUND journal in P15
- [x] CHK034 No stored-value wallet tables or APIs
