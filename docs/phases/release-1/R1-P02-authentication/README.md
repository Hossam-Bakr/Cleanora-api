# R1-P02 — Complete Authentication & Identity

| Field | Value |
|---|---|
| Release | Release 1 — Core Marketplace |
| Phase | R1-P02 |
| Status | Complete |
| Current active phase | R1-P02A maintenance; R1-P03 inactive |
| Depends on | R1-P00 and R1-P01 |
| Canonical source | Vision section 4; roadmap R1-P02 |
| Approved decisions | DEC-011 through DEC-028, with later decisions superseding earlier temporary delivery rules |
| Architecture decisions | ADR-0010 |
| Blocking question | None |

## Goal

Implement one shared identity system for customers, provider owners, workers,
and later marketers while enforcing the verification path required for each
Release 1 actor.

## Final behavior

- Every supported self-signup category requires account-bound email
  verification.
- Phone values may be collected but are not ownership-verified in R1-P02.
- SMS and Google phone-verification endpoints are not part of R1-P02; phone
  ownership is deferred to R1-P26.
- Worker: provider-created identity; login uses phone and password.
- Google sign-in is Individual-only and requires a Google-verified email.
- Banned or suspended accounts are denied at login and protected requests.
- Access JWT plus rotating refresh JWT cookie follows ADR-0010.

## Phase files

- [API contract](api-contract.md)
- [Session and cookie security](security-session-design.md)
- [Test plan](test-plan.md)
- [Implementation checklist](implementation-checklist.md)

## Current contract

Use `docs/apis/authentication.md`, runtime Swagger, and the OpenAPI document.
The phase files below are navigation/evidence summaries and do not define a
second competing API contract.
