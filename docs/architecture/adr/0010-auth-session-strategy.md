# ADR-0010 — Authentication token and session strategy

- Status: Accepted
- Date: 2026-07-24

## Context

R1-P02 requires short-lived authentication, revocation, logout-all, refresh
rotation, ban/suspension enforcement, and browser-first security.

## Decision

- Use a short-lived JWT access token. The client sends it in the
  `Authorization: Bearer` header.
- Use a JWT refresh token only in an `HttpOnly` cookie.
- Persist a server-side session for each refresh-token family.
- Store only a hash or non-reversible verifier for refresh credentials.
- Rotate the refresh token on every successful refresh.
- Detect refresh-token reuse and revoke the affected family.
- Support session revocation and logout-all.
- Use separate long random secrets for access and refresh tokens.
- Configure cookie `Secure`, `SameSite`, name, path, and expiry from validated
  environment and phase policy.
- Use credential-aware allowlisted CORS. CORS is not authorization.
- Do not store refresh tokens in browser local storage.

## Consequences

Access-token expiry may temporarily precede a new authorization change, so
protected endpoints must also enforce critical account status and ownership.
Cross-site deployments using `SameSite=None` require `Secure=true` and an
approved CSRF strategy.
