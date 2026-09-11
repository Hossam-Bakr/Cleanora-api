# Security & Validation Checklist: R1-P13

**Purpose**: Acceptance, security, data, and API completeness for this phase
**Created**: 2026-09-10
**Feature**: [spec.md](../spec.md)

## Acceptance

- [x] CHK001 Verified-customer draft create is specified and testable — Evidence: US1; SC-001
- [x] CHK002 Awaiting-deposit freeze is specified and testable — Evidence: US2; SC-004
- [x] CHK003 Matrix freeze (OQ-010) is specified including emergency-as-flag — Evidence: Clarifications; FR-007–FR-009
- [x] CHK004 Cancel-without-fees is specified (OQ-001 contained) — Evidence: US4; SC-006
- [x] CHK005 Server-authoritative price/deposit is specified — Evidence: FR-004; SC-003

## Security

- [x] CHK006 Identity from trusted principal only — Evidence: FR-001; Bearer + `requireFullAuthentication`
- [x] CHK007 Self-only reads; non-enumerating foreign ids — Evidence: FR-012; US5
- [x] CHK008 Eligibility diagnostics not leaked — Evidence: US1.3; `NOT_ELIGIBLE`
- [x] CHK009 No Staff override HTTP this phase — Evidence: EX-03; HTTP table
- [x] CHK010 Rate-limit abuse-prone create/submit — Evidence: T030; command routes

## Data

- [x] CHK011 Snapshot/breakdown immutable (no updated_at) — Evidence: data-model; SQL triggers
- [x] CHK012 Minor-unit money; currency explicit — Evidence: FR-004; `bookings.money.ts`
- [x] CHK013 Phase-owned migration name recorded — Evidence: FR-018
- [x] CHK014 No ledger/payment/wallet tables — Evidence: EX-02; Out of Scope
- [x] CHK015 Cross-module ids via public contracts — Evidence: FR-014

## API

- [x] CHK016 Every new HTTP operation has OpenAPI + Postman — Evidence: FR-017; SC-007
- [x] CHK017 Idempotency-Key documented — Evidence: create/submit/cancel/media
- [x] CHK018 Error codes stable — Evidence: `bookings.errors.ts`; OpenAPI
- [x] CHK019 Browse still documents no booking create — Evidence: FR-016; `bookingCreated: false`
- [x] CHK020 Zod at boundary; no client totals — Evidence: FR-013; create schema
