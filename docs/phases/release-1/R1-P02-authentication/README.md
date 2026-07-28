# R1-P02 — Complete Authentication & Identity

| Field | Value |
|---|---|
| Release | Release 1 — Core Marketplace |
| Phase | R1-P02 |
| Status | In Progress |
| Current active phase | R1-P02 |
| Depends on | R1-P00 and R1-P01 |
| Canonical source | Vision section 4; roadmap R1-P02 |
| Approved decisions | DEC-011, DEC-012, DEC-014 |
| Architecture decisions | ADR-0010 |
| Blocking question | OQ-014 Google audience |

## Goal

Implement one shared identity system for customers, provider owners, workers,
and later marketers while enforcing the verification path required for each
Release 1 actor.

## Locked behavior

- Individual: required phone and blocking six-digit SMS OTP; email optional.
- Company/engineer: required email with blocking email OTP; phone required but
  not SMS-verified.
- Provider owner: required email with blocking email OTP; phone required but
  not SMS-verified.
- Worker: provider-created identity; login uses phone and password.
- Google sign-in does not bypass actor-specific verification.
- Banned or suspended accounts are denied at login and protected requests.
- Access JWT plus rotating refresh JWT cookie follows ADR-0010.

## Phase files

- [API contract](api-contract.md)
- [Session and cookie security](security-session-design.md)
- [Test plan](test-plan.md)
- [Implementation checklist](implementation-checklist.md)

## Remaining operations gate

Egypt SMS vendor selection and production credentials remain human-owned. The
phase uses only the approved delivery port and deterministic unavailable/test
adapters; no production SMS network integration is activated here.
