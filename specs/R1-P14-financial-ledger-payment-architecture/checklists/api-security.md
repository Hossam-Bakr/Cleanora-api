# Security & Validation Checklist: R1-P14

**Purpose**: Acceptance, security, data, and API completeness for this phase
**Created**: 2026-09-11
**Feature**: [spec.md](../spec.md)

## Acceptance

- [x] CHK001 Balanced deposit journal is specified and testable
- [x] CHK002 Derived balance and reconcileBooking are specified and testable
- [x] CHK003 Adjustment-without-rewrite is specified and testable
- [x] CHK004 Wallet prohibition is specified and testable
- [x] CHK005 Idempotency is specified and testable

## Security

- [x] CHK006 Trusted actor kinds only; no customer HTTP identity spoof
- [x] CHK007 Adjustments require STAFF_FINANCE + reason
- [x] CHK008 No Staff finance HTTP this phase
- [x] CHK009 Booking facts via public reader only
- [x] CHK010 No secrets or payment-gateway payloads (none exist)

## Data

- [x] CHK011 Decimal(65,0) minor units; currency explicit
- [x] CHK012 Phase-owned migration name recorded
- [x] CHK013 No payment_methods / payments / dues tables
- [x] CHK014 Double-entry balance enforced before commit
- [x] CHK015 Cross-module ids via public contracts

## API

- [x] CHK016 Zero new HTTP operations; existing OpenAPI/Postman still validate
- [x] CHK017 Internal contract documents methods, types, errors
- [x] CHK018 Error codes stable
- [x] CHK019 No `/api/v1/payments` or `/api/v1/ledger` route
- [x] CHK020 Zod (or equivalent) at the public command boundary
