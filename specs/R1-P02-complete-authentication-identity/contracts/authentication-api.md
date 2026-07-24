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
| GET | `/google` | Public | 200/302 | Start individual-only OIDC transaction |
| GET | `/google/callback` | Correlation cookie | 200 | Consume OIDC transaction and issue full/restricted session |
| POST | `/google/phone` | Private Google-restricted | 202 | Bind unique phone and request blocking SMS verification |
| GET | `/google/link` | Private recent full individual | 200/302 | Start deliberate link bound to current user |
| GET | `/google/link/callback` | Private correlation | 200 | Complete linking after both proofs |
| DELETE | `/social/google` | Private recent full individual | 200 | Unlink only with another recoverable method |

## Request and response direction

`/signup` uses one discriminated `accountCategory` body. Individual requires phone/password and optional email. Company, engineer, and provider owner require phone/email/password. Worker is rejected before persistence. The 202 response has the same safe accepted shape and opaque challenge-selector shape even when no real challenge is created.

`/account-categories` locks the authenticated user's row, collision-checks identifiers, adds only the new pending category, and creates its gate. It never creates a user, role, permission, or profile.

`/otp/request` and `/otp/verify` identify category, purpose, channel, destination, and opaque challenge selector as applicable. Optional individual email verification uses the same endpoints but never controls protected access.

`/login` accepts normalized phone/password only. Valid proof returns access token, expiry, verification-only flag, and safe identity/category state; refresh is cookie-only. Wrong password, unknown phone, missing worker/credential, suspended, and banned use generic public login semantics.

`/me` returns only user ID, approved safe identifier presentation, enrolled/verified/pending categories, status, and restricted flag. It excludes credentials, hashes, session internals, token material, challenge metadata, provider claims, and status reasons.

Forgot includes category plus its authoritative identifier and always returns the same 202 envelope for syntactically valid input. Reset accepts `<challenge-id>.<random-secret>` and a new password, then returns no session. Change requires bearer, current refresh cookie, current password, and a distinct compliant new password.

## Cookie contract

| Attribute | Rule |
|---|---|
| Name | Validated environment value, default `cleanora_refresh` |
| `HttpOnly` | Always true |
| `Secure` | True in production; required with `SameSite=None` |
| `SameSite` | Default `Lax` |
| `Domain` | Omitted |
| `Path` | `/api/v1/auth` |
| `Max-Age` | No longer than family remaining absolute expiry |

Clear-cookie responses use identical attributes.

## Stable errors

| Code | HTTP | Safe meaning |
|---|---:|---|
| `REQUEST_VALIDATION_FAILED` | 400 | Existing Zod field contract |
| `AUTHENTICATION_REQUIRED` | 401 | Missing access proof |
| `AUTHENTICATION_FAILED` | 401 | Generic login/eligibility failure |
| `AUTH_ACCESS_TOKEN_INVALID` | 401 | Invalid/expired/mismatched access proof |
| `AUTH_REFRESH_TOKEN_INVALID` | 401 | Missing/invalid/expired/revoked refresh; reuse detail internal |
| `AUTH_VERIFICATION_REQUIRED` | 403 | Proven identity has restricted access |
| `AUTH_ACCOUNT_UNAVAILABLE` | 403 | Authenticated identity cannot continue; no reason detail |
| `AUTH_ACCOUNT_CATEGORY_NOT_ALLOWED` | 403 | Worker enrollment or disabled Google audience |
| `AUTH_CATEGORY_STATE_CONFLICT` | 409 | Authenticated category transition invalid |
| `AUTH_SIGNUP_UNAVAILABLE` | 409 | Generic authenticated collision/state failure |
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

Never expose separate codes for an existing email/phone, missing worker, ban/suspension reason, Google subject linked elsewhere, refresh reuse, or absent recovery identity.

