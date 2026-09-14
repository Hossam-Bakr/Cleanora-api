# Architecture & Data Checklist: R1-P16

**Purpose**: Requirements-quality checks for ownership, persistence, and money
**Created**: 2026-09-13
**Feature**: [spec.md](../spec.md)

- [x] Owning module is named (`bookings`) and other modules cannot import its Prisma
- [x] Roadmap tables listed: booking_responses, booking_cancellations, cancellation_reasons
- [x] Extra intent table justified (notification events without P23)
- [x] Migration name is phase-owned and unique
- [x] Status extension ACCEPTED is explicit; ASSIGNED deferred to P17
- [x] OQ-001 forbids fee columns and refund/ledger writes
- [x] Unique one-response and one-cancellation per booking stated
- [x] confirmDepositPayment remains the confirm seam
- [x] Providers membership consumed via public contract only
- [x] No wallets, Docker, or cloud
