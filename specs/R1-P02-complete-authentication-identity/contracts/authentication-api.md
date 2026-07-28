# Authentication HTTP Contract

**Base path**: `/api/v1/auth`  
**Envelope**: `docs/standards/api-response-and-errors.md`  
**Trace**: response body `requestId` and header `x-request-id`

## Transport

- Access JWT is returned in JSON and later sent as `Authorization: Bearer`.
- Refresh JWT is a configured `HttpOnly` cookie only, never JSON or local storage.
- Token responses set `Cache-Control: no-store`.
- Cookie-state routes require a trusted `Origin`.
- Phone/email are normalized before lookup, uniqueness, limits, or hashing.
- Enumeration-sensitive accepted flows use equivalent public envelopes.
- Every JSON failure includes `error.code`, `error.statusCode`,
  `error.message`, optional safe field details, and `requestId`.

## Routes

| Method | Route | Access | Success | Purpose |
|---|---|---|---:|---|
| POST | `/signup` | Public | 202 | Individual/company/engineer/provider-owner signup; worker rejected before persistence |
| POST | `/account-categories` | Private full session | 202 | Add a supported category to the same user; never worker |
| POST | `/otp/request` | Public or verification-only | 202 | Create/supersede an allowed verification challenge |
| POST | `/otp/verify` | Public or verification-only | 200 | Consume the latest challenge and complete its gate |
| POST | `/login` | Public | 200 | Phone/password proof; issue full or restricted session |
| POST | `/refresh` | Refresh cookie | 200 | Rotate the family and access JWT |
| POST | `/logout` | Bearer or refresh cookie | 200 | Idempotently revoke current family and clear cookie |
| POST | `/logout-all` | Private | 200 | Revoke every family owned by the identity |
| GET | `/me` | Private full/restricted | 200 | Safe identity/category/status view |
| POST | `/password/forgot` | Public | 202 | Generic recovery acceptance on authoritative channel |
| POST | `/password/reset` | Public | 200 | Change password, revoke all, issue no session |
| POST | `/password/change` | Private + current refresh | 200 | Verify current password, revoke others, rotate current |
| GET | `/google` | Public | 200 | Start individual-only OIDC transaction and return its authorization URL |
| GET | `/google/browser` | Public | 303 | Start the same transaction and redirect a top-level browser to Google |
| GET | `/google/callback` | Correlation cookie | 303 | Consume the stored SIGN_IN/LINK transaction and redirect safely to the frontend |
| POST | `/google/phone/request` | Private Google-restricted | 202 | Bind unique phone and request blocking SMS verification |
| POST | `/google/phone/verify` | Private Google-restricted | 200 | Verify the exact Individual phone challenge and promote the same session |
| GET | `/google/link` | Private recent full individual | 200 | Start deliberate link bound to current user/session |
| DELETE | `/social/google` | Private recent full individual | 200 | Unlink only with another recoverable method |

## Request and response direction

`/signup` uses one discriminated `accountCategory` body. Individual requires phone/password and optional email. Company, engineer, and provider owner require phone/email/password. Worker is rejected before persistence. The 202 response returns opaque `challengeId`, `nextAction: VERIFY_ACCOUNT`, channel, purpose, masked destination, expiry, and resend availability. It never returns `userId`, passwords, OTPs, or a session.

`/account-categories` locks the authenticated user's row, collision-checks identifiers, adds only the new pending category, and creates its gate. It never creates a user, role, permission, or profile. The 202 response uses the same verification-challenge shape as signup.

`/otp/request` accepts either opaque `challengeId` (preferred after signup) or `userId` plus `accountCategory` (and optional purpose for optional individual email). The challenge selector owns category, purpose, channel, and destination; clients cannot retarget another identity. The 202 response matches the signup verification-challenge shape.

`/otp/verify` requires matching `challengeId` and a six-digit code. Public success returns `{ verified: true, nextAction: "LOGIN" }` and issues no session. Authenticated Google phone verification returns `{ verified: true, verificationOnly: false, nextAction: "CONTINUE" }` after promoting that session.

Chrome Google authentication starts only through `/google/browser`, preserving
the state cookie in the same browser. `/google` is an API-style inspection
endpoint and its Postman state cookie cannot be transferred to Chrome. The
backend callback writes the HttpOnly refresh cookie and redirects to the
allowlisted frontend callback. Bassam's frontend calls `/refresh` with
credentials included and receives the safe user. Failure redirects expose only
stable safe reasons, never raw Google errors.

`/login` accepts normalized phone/password only. Valid proof returns access
token, expiry, verification-only flag, canonical `user`, and the existing
backward-compatible `identity`; refresh is cookie-only. Refresh and password
change return the same safe user shape. Wrong password, unknown phone, missing
worker/credential, suspended, and banned use generic public login semantics.

`/me` returns `{ user, verificationOnly }`, where `user` contains only id,
approved safe identifier presentation, verification booleans,
enrolled/verified/pending categories, and status. It excludes credentials,
hashes, session internals, token material, challenge metadata, provider claims,
and status reasons. Clients never supply `userId` to rehydrate a session.

Forgot includes category plus its authoritative identifier and always returns `{ accepted: true }` for syntactically valid input. It never returns challenge ID, reset ID, reset token, destination, or account existence. Reset accepts the complete composite `<reset-id>.<random-secret>` as `token` plus `newPassword`, then returns `{ passwordReset: true, nextAction: "LOGIN" }` with no session. Change requires bearer, current refresh cookie, current password, and a distinct compliant new password.

## Cookie contract

| Attribute | Rule |
|---|---|
| Name | Validated environment value, default `cleanora_refresh_token` |
| `HttpOnly` | Always true |
| `Secure` | True in production; required with `SameSite=None` |
| `SameSite` | Default `Lax` |
| `Domain` | Omitted |
| `Path` | `/api/v1/auth` |
| `Max-Age` | No longer than family remaining absolute expiry |

Clear-cookie responses use identical attributes.

The safe authenticated-user object includes nullable `displayName` and
`avatarUrl` fields. They contain sanitized presentation claims from a linked
Google identity, or `null` for identities without those provider claims. These
fields are authentication-provider metadata and do not create an actor profile.

Google OAuth correlation uses `cleanora_google_oauth_state`. Under the
canonical configuration, the backend expires but never authenticates
`cleanora_refresh`, `fs_refreshtoken`, or `cleanora_google_state`.

## Stable errors

| Code | HTTP | Safe meaning |
|---|---:|---|
| `REQUEST_VALIDATION_FAILED` | 400 | Every independently detectable Zod field issue in one response |
| `AUTHENTICATION_REQUIRED` | 401 | Missing access proof |
| `AUTHENTICATION_FAILED` | 401 | Generic login/eligibility failure |
| `AUTH_ACCESS_TOKEN_INVALID` | 401 | Invalid/expired/mismatched access proof |
| `AUTH_REFRESH_TOKEN_INVALID` | 401 | Missing/invalid/expired/revoked refresh; reuse detail internal |
| `AUTH_VERIFICATION_REQUIRED` | 403 | Proven identity has restricted access |
| `AUTH_ACCOUNT_UNAVAILABLE` | 403 | Authenticated identity cannot continue; no reason detail |
| `AUTH_ACCOUNT_CATEGORY_NOT_ALLOWED` | 403 | Worker enrollment or disabled Google audience |
| `AUTH_CATEGORY_STATE_CONFLICT` | 409 | Authenticated category transition invalid |
| `AUTH_PHONE_FORMAT_INVALID` | 400 | Phone is not a valid normalizable E.164 value |
| `AUTH_EMAIL_FORMAT_INVALID` | 400 | Email is not syntactically valid |
| `AUTH_PHONE_ALREADY_REGISTERED` | 409 | Signup phone already belongs to an identity |
| `AUTH_EMAIL_ALREADY_REGISTERED` | 409 | Signup email already belongs to an identity |
| `AUTH_SIGNUP_IDENTIFIERS_ALREADY_REGISTERED` | 409 | Signup phone and email both conflict; both safe fields appear in `details.issues` |
| `AUTH_SIGNUP_UNAVAILABLE` | 409 | Non-field-specific signup conflict fallback |
| `AUTH_VERIFICATION_FAILED` | 400 | Wrong/expired/used/superseded/exhausted challenge |
| `AUTH_PASSWORD_RESET_FAILED` | 400 | Invalid/expired/used/exhausted reset proof |
| `AUTH_CURRENT_PASSWORD_INVALID` | 400 | Current-password proof failed |
| `AUTH_PASSWORD_POLICY_FAILED` | 400 | Safe password policy issues |
| `AUTH_SOCIAL_AUTHENTICATION_FAILED` | 401 | Generic Google proof/collision failure |
| `AUTH_SOCIAL_LINK_FAILED` | 409 | Deliberate link failed safely |
| `AUTH_SOCIAL_UNLINK_UNSAFE` | 409 | Another recoverable method is required |
| `AUTH_REQUEST_ORIGIN_REJECTED` | 403 | Cookie-state origin/CSRF check failed |
| `RATE_LIMIT_EXCEEDED` | 429 | Deterministic limit with `Retry-After` |
| `RATE_LIMITER_UNAVAILABLE` | 503 | Existing fail-closed limiter behavior |
| `AUTH_PROVIDER_UNAVAILABLE` | 503 | Enabled provider unavailable where generic acceptance is not required |
| `AUTH_EVENT_WRITE_FAILED` | 500 | Mandatory evidence could not be recorded |

Signup is the human-approved exception that exposes only whether the normalized
`phone` or `email` field conflicts. Never expose the owning identity, other
account data, missing worker, ban/suspension reason, Google subject linked
elsewhere, refresh reuse, or absent recovery identity. Login and
forgot-password remain enumeration-safe.

## Password policy

- Length: 7–128 characters and no more than 512 UTF-8 bytes.
- No uppercase/lowercase/symbol composition requirement.
- Numbers-only passwords are accepted when they are not predictable.
- Common values, repeated characters/patterns, and ascending or descending
  numeric sequences are rejected.
- The same policy applies to signup, reset, and authenticated change.
