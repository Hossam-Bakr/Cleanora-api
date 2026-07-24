# ADR-0013 — Authentication cryptography libraries

- Status: Accepted for R1-P02 preparation
- Date: 2026-07-24

## Context

R1-P02 needs CommonJS-compatible JWT signing/verification, modern password
hashing, secure one-time values, and Google OpenID Connect.

## Decision

- Use `jsonwebtoken` behind an internal token service for access and refresh
  JWTs. Verification must pin the approved algorithm, issuer, audience, token
  type, expiry, `sid`, and `jti`.
- Use `argon2` with Argon2id behind a password-hasher port. Parameters must be
  benchmarked and recorded when R1-P02 becomes active.
- Use Node `crypto` for cryptographically random OTP/reset values and one-way
  verifiers. Do not use `Math.random`.
- Use `openid-client` behind a Google identity adapter for OpenID Connect.
- Install these packages only when R1-P02 becomes active and after OQ-014 is
  resolved.

## Consequences

Business services depend on token, password, OTP, and social-identity ports;
package APIs and provider payloads stay inside authentication integrations.
