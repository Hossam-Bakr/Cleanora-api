# R1-P02 Technical Research

> Historical R1-P02 research. Pino and implementation-time folder references
> were superseded by R1-P02A; use current architecture documents for new work.

**Phase**: `R1-P02 — Complete Authentication & Identity`  
**Date**: 2026-07-24  
**Authority**: approved `spec.md`, DEC-011, DEC-012, DEC-014, DEC-015,
DEC-028, ADR-0010, and ADR-0013. DEC-028 supersedes the earlier R1-P02
SMS/phone-gate research conclusions below wherever they differed.

## Repository Evidence

- The repository is a Node.js 24+, TypeScript 6, Express 5, PostgreSQL/Prisma 7
  CommonJS application. Runtime packages are loaded with `const`/`require`
  where needed; TypeScript type-only imports and exports remain allowed.
- R1-P01 owns the only applied migration,
  `r1_p01_foundation_country_configuration`. Its SQL creates five foundation
  tables and has SHA-256
  `BF84EEE3768ED0246B187B7EF1A1690B4CED5B07B7B2F9085FDCC72108E04EC8`.
- The process already creates, connects, binds, probes, and disconnects one
  `PrismaLifecycle`. R1-P02 repositories must use that bound client.
- The existing Pino adapter recursively redacts secret-like keys and does not
  log request bodies. R1-P02 must add authentication-specific regression
  fixtures without weakening this behavior.
- The existing rate-limiter port and memory adapter are deterministic for one
  process and tests. They are not a distributed production limiter.
- The prepared R1-P02 documents predate activation and DEC-015. Their route
  direction is useful, but their status metadata and unresolved-question list
  are stale. The approved specification is authoritative.

## Decision 1 — Identity and Category State

**Decision**: Keep one `users` row per identity. Store enrolled and verified
account categories as two PostgreSQL enum arrays. A category is pending when it
is enrolled but absent from the verified array.

This is the smallest design that supports the approved multi-category behavior
without adding a forbidden eighth authentication model. Global identity status
is separate from category verification, so a newly pending category cannot
disable an existing verified category.

**Rejected alternatives**:

- A separate category-membership table: clearer normalization, but outside the
  seven-model persistence boundary.
- One global `PENDING` user status: incorrectly blocks verified categories.
- Roles as category state: belongs to R1-P03 and would grant future behavior
  early.

## Decision 2 — Password Protection

**Decision**: Use `argon2` Argon2id behind `PasswordHasherPort`. Start the
implementation benchmark at 64 MiB memory, three iterations, one lane, and a
32-byte result. The implementation may raise the cost after measuring the
target runtime, but must not lower this baseline without an approved security
decision. Store the self-describing PHC string and a hash-policy version.

The password policy is 7–128 characters, with a bounded encoded-byte length
and no arbitrary character-class composition rule. Numbers-only passwords are
accepted when they are not common, repeated, repeated-pattern, or ascending or
descending sequences. A new password equal to the current password is also
rejected. Unknown-phone login performs one fixed dummy Argon2id verify to
reduce timing disclosure. Successful verification may rehash an older
approved hash.

**Rejected alternatives**:

- Reversible encryption: passwords must not be recoverable.
- Plain SHA/PBKDF2/bcrypt as the new default: ADR-0013 approves Argon2id.
- Unbounded input: creates avoidable hashing denial-of-service risk.

## Decision 3 — One-Time and Refresh Verifiers

**Decision**: Use Node `crypto` only. Generate six-digit verification OTPs and
four-digit password-reset codes with `crypto.randomInt`; generate refresh JWT
identifiers with cryptographic randomness. Store domain-separated
HMAC-SHA-256 verifiers under a dedicated `AUTH_VERIFIER_SECRET`, never raw
values.

Domains include the record selector and purpose:

```text
otp:<challenge-id>:<purpose>:<code>
reset:<challenge-id>:<code>
refresh:<session-id>:<raw-refresh-jwt>
destination:<channel>:<normalized-destination>
```

Comparisons use `timingSafeEqual`. Persist a verifier-key version on sessions,
OTPs, and reset tokens so a later controlled key transition has an explicit
forward-fix path.

**Rejected alternatives**:

- Plain SHA-256 for six-digit OTPs: cheaply brute-forced if the database leaks.
- Reusing access or refresh signing secrets: increases compromise impact.
- Persisting provider payloads or raw delivery values: violates FR-016,
  FR-022, FR-032, and FR-054.

## Decision 4 — JWT and Protected-Request Validation

**Decision**: Put `jsonwebtoken` behind `TokenServicePort`; pin HS256, issuer,
audience, `typ`, version, expiry, `sub`, `sid`, and UUID `jti`. Access JWTs
default to 900 seconds and are returned only in JSON with `Cache-Control:
no-store`.

Every authenticated request also loads the stable session family and current
user. It rejects an expired or revoked session, a credential-version mismatch,
and `SUSPENDED` or `BANNED` status. It derives usable categories from the
current user row rather than trusting client-visible claims.

**Rejected alternatives**:

- Stateless access-only enforcement: cannot immediately enforce logout,
  logout-all, status changes, or password changes.
- Role or permission claims: R1-P03 owns authorization.
- Refresh credentials in JSON or local storage: conflicts with ADR-0010.

## Decision 5 — Stable Session Families and Rotation

**Decision**: One `user_sessions` row is one stable refresh-token family. The
row stores only the current refresh verifier, rotation counter, fixed absolute
expiry, authentication method, verification capability, credential version,
and revocation evidence.

Refresh is a compare-and-swap transaction:

1. Verify the refresh JWT and cookie-origin policy.
2. Lock/load the row by `sid`.
3. Compare the current HMAC verifier, subject, versions, active state, and
   absolute expiry.
4. Replace the verifier, increment the rotation counter, update safe use
   evidence, and append the mandatory auth event.
5. Issue the successor JWT without extending the absolute family expiry.

A valid signed refresh JWT for the same `sid` whose verifier is no longer
current is reuse. Revoke that family and append `REFRESH_REUSE_DETECTED` in one
transaction. Concurrent use has no grace period: at most one request rotates;
the loser causes family compromise and revocation.

**Rejected alternatives**:

- A new row per rotation: unbounded history and more complex access-session
  identity.
- Overwriting a hash without a signed stable `sid`: cannot safely distinguish
  reuse from a random invalid token.
- Retry/grace windows: hide reuse and make behavior nondeterministic.

## Decision 6 — Session Transport and Origin Protection

**Decision**: Refresh JWTs use the configured `HttpOnly` cookie only. Defaults:
`Secure=true` in production, `SameSite=Lax`, no `Domain`,
`Path=/api/v1/auth`, and `Max-Age` bounded by the family's remaining absolute
expiry. Clearing uses identical attributes.

Refresh, logout, password change, and other cookie-state routes require a
trusted `Origin` from the validated CORS allowlist. `SameSite=None` remains
invalid unless `Secure=true` and an explicit CSRF strategy is configured.

Logout revokes the current family and clears the cookie. Logout-all revokes all
families for the identity. Password reset revokes all families and issues
nothing. Password change requires the current password and current refresh
cookie, revokes every other family, rotates the current family, and returns a
new access JWT and refresh cookie.

## Decision 7 — OTP and Recovery Lifecycle

### Verification codes

- TTL: 10 minutes.
- Maximum verification attempts: 5.
- Resend cooldown: 60 seconds.
- Send limits: 3 per 15 minutes and 5 per 24 hours for the same
  identity/category/purpose, plus endpoint IP limits.
- Only the latest challenge in `PENDING_DELIVERY` or `ACTIVE` may be open for
  the same identity/category/purpose.
- Resend supersedes the earlier challenge in the same transaction.
- The fifth wrong attempt marks the challenge `EXHAUSTED`.
- Successful verification consumes once and performs the category transition
  atomically.

The create/supersede transaction writes `PENDING_DELIVERY` and a mandatory
event. Delivery happens after commit with an idempotency key. A second
transaction marks `ACTIVE` only after provider success, or
`DELIVERY_FAILED` after failure. A late delivery cannot reactivate a
superseded row.

### Password recovery

- TTL: 30 minutes.
- Maximum attempts: 5.
- Proof: opaque public challenge selector plus a four-digit random code.
- Every eligible category uses its verified normalized email.
- No alternate channel is selected.
- Syntactically valid forgot requests always return the same accepted envelope,
  whether the identity exists, lacks a valid destination, or provider delivery
  fails.

Reset atomically consumes the token, replaces the password hash, increments the
credential version, revokes every session, and appends a security event. It
does not create a session.

## Decision 8 — Login Eligibility and Lockout

| Identity evidence | Outcome |
|---|---|
| `ACTIVE` and at least one verified category | Full session; only verified categories are usable |
| `ACTIVE`, one verified plus another pending | Full session; pending category stays unavailable |
| `ACTIVE` and no verified category | Verification-only session |
| Pre-provisioned verified worker + valid phone/password | Full normal session |
| Missing worker, identity, or password credential | Generic authentication failure |
| `SUSPENDED` or `BANNED` | Generic login denial; existing sessions fail at request authentication |
| Linked/new Google individual + provider-verified email | Full Google session |
| Google identity without provider-verified email | Fail closed; no identity/session |
| Non-individual Google audience | Reject before creating/linking/session issuance |

Credential lockout uses normalized phone. Five consecutive failures in a
15-minute window produce a 15-minute lock. A successful password login resets
the counters; an expired window starts again. Public behavior remains aligned
with the identifier rate limit so existing and absent identities receive the
same generic failure or rate-limit semantics.

## Decision 9 — Deterministic Endpoint Limits

Every applicable request consumes both a server-observed IP key and, when
available, a domain-separated HMAC of the normalized trusted subject.

| Action | IP policy | Subject policy |
|---|---:|---:|
| Signup | 5 / 15 min | 3 / 60 min per normalized identifier |
| Login | 20 / 15 min | 5 / 15 min per normalized phone |
| OTP send | 10 / 15 min | 3 / 15 min and 5 / 24 h per identity/category/purpose |
| OTP verify | 20 / 15 min | 5 database attempts per challenge |
| Forgot password | 5 / 15 min | 3 / 60 min per normalized identifier |
| Reset password | 5 / 15 min | 5 database attempts per challenge |
| Refresh | 60 / 5 min | 30 / 5 min per family |
| Google start/callback | 10 / 15 min | one atomic callback consumption |

Policy values are explicit typed objects. Non-secret, country-sensitive
verification/recovery policies use the configuration module public contract.
Global login/session/endpoint policies use safe catalog keys such as
`auth.signin_policy`, `auth.verification_policy`, `auth.recovery_policy`, and
`auth.endpoint_limits`; key and field names must continue passing the
configuration secret-store guard.

The existing memory limiter is accepted only for single-process local/test
composition. Production multi-instance enablement requires the already-planned
shared limiter adapter; it is a recorded operational risk, not permission to
add Redis or future infrastructure in R1-P02.

## Decision 10 — Google OIDC and Safe Linking

**Decision**: Use authorization-code OIDC with PKCE S256, random state, nonce,
issuer/audience/signature/expiry validation, and provider subject as the
external identity key.

`GoogleTransactionStorePort` owns a 10-minute, one-time transaction containing
the state verifier, nonce, PKCE verifier, intent, and optional authenticated
user binding. R1-P02 supplies a bounded process-memory adapter because the
current deployment is one process. Callback atomically consumes it and also
requires the matching short-lived `HttpOnly`, `SameSite=Lax` correlation
cookie. Restart or missing state fails closed.

- New Google identity: create only an `INDIVIDUAL`, require a
  provider-verified email, and issue a full session without claiming phone
  ownership.
- Existing provider subject: sign in only the already-linked individual.
- Matching email alone: never merge or link; return a generic social-auth
  failure or require deliberate authenticated linking.
- Link: require a recent full individual session and bind state to that user.
- Unlink: require recent authentication and another recoverable method,
  revoke Google-origin families, write audit/event evidence.
- Company, engineer, provider-owner, worker, and all other audiences are
  rejected before provider interaction.

`openid-client` remains behind `GoogleIdentityPort`. Implementation must prove
the selected package version works in this CommonJS build before locking it;
the project is not converted to ESM.

**Rejected alternatives**:

- Email-string auto-linking: enables account takeover.
- Provider email as primary key: provider subject is authoritative.
- Stateless signed callback state: cannot prove single consumption.
- A new OIDC transaction table: outside the approved persistence scope.

## Decision 11 — Ports, Providers, and Deterministic Tests

Module-owned ports:

- `PasswordHasherPort`
- `TokenServicePort`
- `OneTimeVerifierPort`
- `ClockPort`
- `AuthenticationTransactionPort`
- `EmailAuthenticationDeliveryPort`
- `GoogleIdentityPort`
- `GoogleTransactionStorePort`
- repository ports for each approved table

The module also consumes existing `RateLimiterPort`, `Logger`, configuration
public API, and admin audit public API. Production adapters stay under
`src/integrations`; deterministic fakes stay under
`tests/helpers/authentication`.

Fakes use injected clocks/randomness, retain delivery values only in a
test-only inbox, expose programmable failures/delays, and reset per test. They
never become production fallbacks.

Nodemailer remains the approved R1-P02 delivery transport. SMS and phone
ownership verification are deferred to R1-P26; no SMS adapter or fallback is
composed in R1-P02. Missing enabled email-provider configuration fails startup;
tests and planning do not invent production credentials.

## Decision 12 — Events, Audit, and Logging

`auth_events` is append-only, safe, and transactionally mandatory for critical
state changes. If its write fails, the state mutation aborts. Store only
request ID, optional user/session IDs, event type, outcome, safe reason code,
category/provider when safe, and keyed hashes of IP/user agent. Never store
identifiers, destinations, token verifiers, provider claims, or raw errors.

Use the admin audit public contract for deliberate high-impact identity
mutations such as category enrollment, password change/reset, and social
link/unlink. Write a safe `*_ATTEMPTED` audit record after proof checks and
before the auth transaction; if audit fails, do not begin the mutation.
Automatic defensive actions such as refresh-reuse revocation use the mandatory
transactional auth event and must never be delayed by a cross-module call.

Application logs contain only stable event names, request IDs, safe IDs,
category, outcome, and safe reason code. Do not pass raw request bodies,
provider errors, Zod issues containing values, or secret-bearing `Error`
objects to the logger.

## Environment and Capability Gates

- `AUTH_ENABLED=false` preserves R1-P01 startup compatibility.
- When `AUTH_ENABLED=true`, access/refresh signing secrets, verifier secret,
  privacy-hash secret, and all required non-secret policy values are mandatory.
- `GOOGLE_AUTH_ENABLED=true` additionally requires the complete Google client
  ID/secret/redirect set and the Google adapter.
- Email authentication requires its complete approved provider configuration
  and adapter. No R1-P02 SMS capability flag exists.
- Validation completes before database connection or listening.
- Access/refresh secrets remain independent; verifier and privacy keys are not
  reused as JWT secrets.

## Remaining Risks and Implementation Gates

1. Phone verification, an Egypt-appropriate SMS provider, credentials,
   migration/backfill, and launch acceptance are explicit R1-P26 work.
2. Argon2id benchmark results can only be recorded on the implementation
   runtime. The baseline above is mandatory until measured evidence supports a
   stronger setting.
3. The selected `openid-client` release must pass a CommonJS compatibility
   spike before the lockfile is finalized.
4. Memory rate limits and Google transaction state are process-local. Enabling
   multiple API processes requires an approved shared adapter; R1-P02 does not
   introduce Redis, Docker, or cloud work.
