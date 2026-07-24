# R1-P02 — Complete Authentication & Identity

| Field | Value |
|---|---|
| Release | Release 1 — Core Marketplace |
| Phase | R1-P02 |
| Status | Prepared, not active |
| Current active phase | R1-P00 |
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

## Preparation files

- [API contract](api-contract.md)
- [Session and cookie security](security-session-design.md)
- [Test plan](test-plan.md)
- [Implementation checklist](implementation-checklist.md)

## Must resolve before activation

1. Complete and approve R1-P00 and R1-P01.
2. Resolve OQ-014: Google sign-in audiences.
3. Select the SMS OTP provider for Egypt.
4. Benchmark and approve the final Argon2id parameters from ADR-0013.
5. Decide how R1-P02 represents actor/account kind before R1-P03 creates the
   complete role/permission model.
6. Decide whether worker login completion moves to R1-P07 or whether the
   minimal worker identity relation moves into R1-P02.
7. Pull a minimal notification/template delivery foundation forward or define
   the approved R1-P02-owned OTP delivery tables before R1-P23.

No auth table, migration, or endpoint may be implemented until these affected
decisions are recorded in the active phase artifacts.
