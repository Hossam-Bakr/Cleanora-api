# R1-P02 Test Plan

## Unit

- Actor-specific signup validation
- Verification-gate decisions
- Password policy and hash verification
- OTP expiry, attempt limits, and one-time use
- Access/refresh claims and expiry
- Refresh rotation and reuse detection
- Ban/suspension decisions
- Safe error mapping and anti-enumeration responses

## Integration

- Auth migration applies to a clean PostgreSQL test database
- Unique normalized phone/email constraints
- Signup and credential persistence
- Session creation, rotation, revocation, and logout-all
- OTP request/verify with provider fakes
- Forgot/reset/change-password transaction behavior
- Google account linking with provider fakes
- Rate-limit policies and failure semantics
- Cookie flags and credential-aware CORS

## E2E

- Individual signup → SMS OTP → login → refresh → logout
- Company/engineer signup → email OTP → login
- Provider-owner signup → email OTP → login
- Worker login only after provider-controlled creation, according to the
  approved sequencing decision
- Forgot/reset password without account enumeration
- Google sign-in plus remaining verification gate for each approved audience
- Banned/suspended account denial
- Concurrent refresh/reuse attack

## Required negative tests

- Duplicate phone/email
- Invalid/expired/reused OTP
- Wrong password
- Expired, revoked, reused, or wrong-type token
- Missing/forged refresh cookie
- Disallowed CORS origin
- Google identity collision
- Public attempt to create staff or worker roles
