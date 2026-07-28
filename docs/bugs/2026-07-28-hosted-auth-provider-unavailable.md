# Bug Report — Hosted authentication provider unavailable

## Observed behavior

Railway returned HTTP `503 AUTH_PROVIDER_UNAVAILABLE` for both Individual and
Company signup while the liveness endpoint returned HTTP `200`.

## Expected behavior

Every supported self-signup category should create and deliver its required
verification challenge in the hosted preview without exposing OTPs or provider
credentials.

## Reproduction

1. Call `GET /api/v1/system/health/live`; observe HTTP `200`.
2. Call `POST /api/v1/auth/signup` with an Individual; observe HTTP `503`.
3. Call the same endpoint with a Company; observe HTTP `503`.

## Environment

- Railway-hosted Node.js service
- Production process environment
- SMTP/Nodemailer email delivery
- No real SMS provider connected

## Evidence and root cause

Liveness proves only that the HTTP process is running. Individual verification
selects the SMS channel, but the production composition root used
`UnavailableSmsAdapter`. Company verification selects email, but disabled,
incomplete, rejected, or unreachable SMTP is mapped to the same stable
`AUTH_PROVIDER_UNAVAILABLE` response.

`SMS_AUTH_ENABLED` did not instantiate a real provider and therefore could not
make Individual delivery operational.

## Fix

Add an explicit hosted-preview SMS-to-email fallback through the existing SMS
port. It requires a second acknowledgement flag, complete SMTP capability, an
account-bound server-resolved recipient, and a safe startup warning. The email
clearly states that phone ownership was not proven.

## Regression tests

- Environment validation accepts the complete acknowledged hosted mode.
- Environment validation rejects an unacknowledged or contradictory mode.
- Delivery templates distinguish local development from hosted preview.
- Incomplete fallback delivery payloads remain rejected.

## Remaining risk

The hosted fallback verifies access to account email, not ownership of the
submitted phone. It is suitable only for preview acceptance and must be replaced
with a real SMS provider before production readiness. SMTP provider
authentication and outbound connectivity remain operational dependencies.
The local SMTP verification attempt timed out in the restricted execution
environment; hosted SMTP acceptance remains unproven until `npm run
email:check` passes inside the Railway container.
