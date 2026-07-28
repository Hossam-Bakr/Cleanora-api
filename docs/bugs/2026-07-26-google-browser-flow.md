# Bug Report — Google browser flow redirected to a missing frontend

## Observed behavior

Google authentication ended at
`http://localhost:5173/auth/google/callback?google=error&intent=sign-in`, where
the browser reported `ERR_CONNECTION_REFUSED`.

## Expected behavior

The same browser owns the correlation cookie, Google returns to the backend
callback, the backend validates and consumes the transaction, and the
configured result surface exchanges the HttpOnly refresh cookie. A new Google
Individual then completes mandatory phone verification.

## Reproduction

1. Start the Google transaction from `/auth/google` in an API client or use the
   configured browser flow.
2. Complete or return from Google.
3. Observe the generic error redirect to port 5173.
4. Confirm no process or frontend route is listening on port 5173.

## Environment

- R1-P02 development
- Backend on `http://localhost:8000`
- No frontend application in this repository
- No listener on port 5173

## Evidence and root cause

The live authorization URL has the exact backend redirect URI, state, nonce,
PKCE challenge, and matching HttpOnly state cookie. The OIDC start logic is
correct.

The destination failed because no frontend exists on port 5173. A second
common cause is starting `/auth/google` in Postman and opening its URL in
Chrome: Postman owns the state cookie, so Chrome correctly fails correlation.
The prior callback also collapsed every failure into one generic marker.

## Fix

DEC-019 adds a development-only API-hosted `/auth/google/result` page and
points the local callback handoff to it. Real Chrome flow starts at
`/auth/google/browser`. Safe failure reasons distinguish correlation failure,
provider rejection, and generic authentication failure without forwarding raw
provider data. The page can exchange the refresh cookie and complete phone OTP.

## Regression test

Focused tests verify development-only route registration, no-store/CSP
headers, non-registration outside development, safe correlation/provider
reasons, no raw provider error forwarding, existing Google behavior, and the
complete OpenAPI document.

## Validation

Eight focused files and 43 tests pass, along with typecheck, changed-file
ESLint, OpenAPI validation, documentation checks, build, Postman JSON parsing,
and local value-free configuration proof.

## Remaining risk

The elevated stale server PID 9372 must be restarted by the owner before live
Chrome acceptance. Production must replace the development result URI with the
real frontend callback.
