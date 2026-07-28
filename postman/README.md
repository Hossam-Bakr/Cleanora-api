# Postman

Import:

1. `Cleanora-local.postman_environment.json`
2. The collection for the phase being tested

Collections:

- `R1-P00-foundation.postman_collection.json`
- `R1-P01-foundation-country-configuration.postman_collection.json`
- `R1-P02-authentication.postman_collection.json`
- `Cleanora-swagger-documentation.postman_collection.json`

R1-P02 has one canonical Auth collection. Google appears once, in its
`Google Authentication` folder. Negative cases such as duplicate signup,
invalid login, weak password, and invalid OTP are Swagger response examples,
not separate Postman requests.

Regenerate the canonical Auth collection and local environment with:

```bash
npm run postman:generate:auth
```

## Local variables

Populate only:

- `testEmail`, `testPhone`, and `testPassword`
- `emailOtp` after standard signup delivery
- `phoneOtp` after Google phone delivery
- `passwordResetToken` from the reset email
- `newPassword` when changing or resetting a password

Requests automatically capture `challengeId` and `accessToken`. The HttpOnly
refresh cookie stays in Postman's cookie jar; it is never exported as an
environment value.

## Google browser flow

Chrome and Postman do not share HttpOnly cookies. Start the real journey by
navigating Chrome to:

`http://localhost:8000/api/v1/auth/google/browser`

Google returns to the backend callback. The backend writes the refresh cookie
and redirects to the configured frontend callback. Bassam's frontend then calls
`POST /api/v1/auth/refresh` with `credentials: "include"`.

The collection includes `/auth/google/callback` only as browser-owned contract
documentation. Do not manually replay it or copy a Postman authorization URL
into Chrome.

Never export real OTPs, passwords, access tokens, reset credentials, provider
credentials, database URLs, or refresh cookies.
