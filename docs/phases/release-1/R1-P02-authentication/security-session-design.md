# R1-P02 Session and Cookie Security

## Approved strategy

- Access JWT TTL: 900 seconds by default.
- Refresh JWT TTL: 2,592,000 seconds by default.
- Access and refresh secrets are long, independent, and externally configured.
- Refresh JWT is held in an `HttpOnly` cookie.
- Refresh sessions are persisted and revocable.
- Refresh tokens rotate after every successful refresh.
- Reuse of an old rotated token revokes the affected session family.
- Logout revokes the current session; logout-all revokes every user session.

## Cookie defaults

| Setting | Development default |
|---|---|
| Name | `cleanora_refresh` |
| HttpOnly | `true` |
| Secure | `false` locally; `true` in production |
| SameSite | `lax` |
| Path | `/api/v1/auth` |
| Max age | Same as refresh-token TTL |

`SameSite=None` is invalid unless `Secure=true`. A cross-site production
deployment also requires an explicit CSRF design.

## JWT claims direction

Keep the payload minimal:

- `sub`: user ID
- `sid`: session ID
- `jti`: unique token ID
- `iat`
- `exp`
- token type/version

Do not treat client-visible role claims as the only authorization source.
Sensitive permissions, bans, suspensions, ownership, and resource state remain
server-authoritative.

## Storage rules

- Passwords use an approved modern password hash; never encryption or plain text.
- OTP and password-reset values are stored as one-way verifiers with expiry and
  attempt limits.
- Refresh credentials are stored as hashes/verifiers, not reusable plaintext.
- Auth events record safe metadata only.
- Logs never include authorization headers, cookies, tokens, passwords, OTPs,
  secrets, or provider payloads.
