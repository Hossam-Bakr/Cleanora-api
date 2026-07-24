# ADR-0009 — Rate limiter package

- Status: Accepted
- Date: 2026-07-23
- Accepted: 2026-07-24

## Context

The foundation needs an adapter that can enforce atomic distributed limits
without embedding endpoint policy inside infrastructure code.

## Decision

- Use `rate-limiter-flexible` behind `RateLimiterPort` when an active phase
  introduces the Redis adapter.
- Require namespaced keys, atomic consumption, remaining/retry metadata, and
  explicit fail-open/fail-closed behavior.
- Every endpoint or policy object must pass an explicit limit and time window.
- No global default rate is allowed.
- Tests may use an in-memory fake; production multi-instance behavior requires
  the approved Redis adapter.

## Consequences

The package is approved but should not be installed until the phase that owns
the first active rate-limit adapter. Endpoint values remain phase-owned.
