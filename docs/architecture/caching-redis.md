# Caching and Redis

Redis is an infrastructure optimization, never business truth.

- Keys use `cleanora:<namespace>:<segments>`.
- The owning module defines cache content, TTL, invalidation, and stale behavior.
- Sensitive payloads require explicit review.
- Reads must have a safe PostgreSQL-backed fallback where correctness requires it.
- Connection failure must not fabricate eligibility, payment, balance, or order state.
- Rate limiting may fail closed for security-sensitive operations and needs explicit policy.

The Redis client/adapter choice is pending dependency approval.
`rate-limiter-flexible` is approved behind `RateLimiterPort`, but endpoint
limits and fail-open/fail-closed behavior remain explicit phase decisions.
