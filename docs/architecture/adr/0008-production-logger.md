# ADR-0008 — Production logger

- Status: Amended by R1-P02A
- Date: 2026-07-23
- Amended: 2026-07-30

## Decision

- Use Morgan as the only HTTP access logger.
- Use a small JSON application logger for lifecycle and provider failures.
- Reuse request correlation IDs.
- Exclude query strings, bodies, authorization, cookies, credentials, tokens,
  OTPs, secrets, signatures, and payment payloads.
- Silence HTTP access logs in automated tests.

Business modules do not depend on Morgan.
