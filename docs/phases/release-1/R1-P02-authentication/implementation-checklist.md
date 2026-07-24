# R1-P02 Implementation Checklist

## Planning

- [ ] R1-P00 approved
- [ ] R1-P01 approved
- [ ] R1-P02 activated in `docs/product/current.md`
- [ ] OQ-014 resolved
- [ ] SMS provider approved
- [ ] Argon2id parameters benchmarked and approved
- [ ] Worker-login sequencing resolved
- [ ] Minimal actor/role sequencing resolved
- [ ] OTP notification/template ownership resolved

## Database

- [ ] Current Prisma schema and migrations inspected
- [ ] Auth models and ownership documented
- [ ] Unique normalized identity constraints documented
- [ ] Session-family and token-verifier strategy documented
- [ ] OTP/password-reset indexes and expiry cleanup documented
- [ ] Migration `r1_p02_complete_authentication` created
- [ ] Generated SQL reviewed
- [ ] Clean migration and compatibility tests pass

## Backend

- [ ] Validation and stable response/error codes complete
- [ ] Password, OTP, JWT, and session services complete
- [ ] Controllers remain thin
- [ ] Ban/suspension checks complete
- [ ] Explicit endpoint rate limits complete
- [ ] Provider adapters remain behind ports
- [ ] Auth events and safe logging complete
- [ ] API and Postman documentation updated to implemented status

## Quality

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E actor journeys pass
- [ ] Refresh concurrency/reuse tests pass
- [ ] Authorization and anti-enumeration tests pass
- [ ] Security review passes
- [ ] Implementation summary and review resolution complete
