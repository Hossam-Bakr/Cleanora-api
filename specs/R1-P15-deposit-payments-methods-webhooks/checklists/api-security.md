# Security & Validation Checklist: R1-P15

**Purpose**: Acceptance, security, data, and API completeness for this phase
**Created**: 2026-09-12
**Feature**: [spec.md](../spec.md)

## Acceptance

- [x] CHK001 Initiate deposit is specified and testable without marking paid
- [x] CHK002 Browser return never-marks-paid is specified and testable
- [x] CHK003 Verified webhook success pipeline is specified and testable
- [x] CHK004 Duplicate webhook idempotency is specified and testable
- [x] CHK005 Retry + one SUCCEEDED deposit per booking is specified and testable
- [x] CHK006 Refund REQUESTED-only foundation is specified and testable

## Security

- [x] CHK007 Customer identity from auth middleware only (no body actor spoof)
- [x] CHK008 Webhook raw-body signature verification required before mutation
- [x] CHK009 Redirect/query success is not payment proof
- [x] CHK010 Secrets from environment; fail closed when initiating if misconfigured
- [x] CHK011 No logging of secrets, full PAN, or raw sensitive gateway payloads
- [x] CHK012 staff_admin required for method enable/disable; audited privileged write
- [x] CHK013 Receipt read limited to owner customer or staff_admin

## Data

- [x] CHK014 Decimal(65,0) minor units; currency explicit; no JS number money math
- [x] CHK015 Phase-owned migration name recorded
- [x] CHK016 Gateway event uniqueness + attempt idempotency + one SUCCEEDED deposit uniqueness recorded
- [x] CHK017 Booking ids cross-module via public contracts / logical refs
- [x] CHK018 No wallet / InstaPay invention tables or workflows

## API

- [x] CHK019 Required HTTP endpoints listed with auth and errors
- [x] CHK020 OpenAPI + Postman ownership assigned to this phase
- [x] CHK021 Error codes stable set documented
- [x] CHK022 Zod (or equivalent) at HTTP boundaries
- [x] CHK023 Webhook route does not JSON-parse before signature verify
