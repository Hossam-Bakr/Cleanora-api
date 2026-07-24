# R1-P02 Proposed API Contract

Base path: `/api/v1/auth`

This is a preparation contract. Final request schemas and actor rules must be
approved when R1-P02 becomes active.

| Method | Route | Access | Purpose |
|---|---|---|---|
| POST | `/signup` | Public | Create an individual, company, engineer, or provider-owner identity |
| POST | `/login` | Public | Authenticate with phone/email and password according to actor rules |
| POST | `/refresh` | Refresh cookie | Rotate the refresh token and issue a new access token |
| POST | `/logout` | Authenticated/session | Revoke the current session and clear the refresh cookie |
| POST | `/logout-all` | Authenticated | Revoke every session owned by the current user |
| GET | `/me` | Authenticated | Return the current safe identity contract |
| POST | `/otp/request` | Public/rate-limited | Request an allowed verification OTP |
| POST | `/otp/verify` | Public/rate-limited | Verify an OTP and advance the approved verification state |
| POST | `/password/forgot` | Public/rate-limited | Start password recovery without account enumeration |
| POST | `/password/reset` | Public/rate-limited | Reset a password with a valid one-time token |
| POST | `/password/change` | Authenticated | Change the current password and apply session policy |
| GET | `/google` | Public | Start Google OAuth for approved audiences |
| GET | `/google/callback` | Public | Link/sign in and enforce remaining verification gates |

## Signup request direction

Use one discriminated request with `accountType`:

- `individual`
- `company`
- `engineer`
- `provider_owner`

Do not accept a privileged staff role or worker self-signup from public input.

## Token transport

- Access token: response data and later `Authorization: Bearer <token>`.
- Refresh token: `HttpOnly` cookie only.
- Refresh token is never returned in JSON.
- Postman may retain the cookie in its cookie jar; environment files must not
  contain a real refresh token.

## Response envelopes

All routes follow `docs/standards/api-response-and-errors.md`.

Example login success data:

```json
{
  "success": true,
  "data": {
    "accessToken": "<redacted>",
    "expiresIn": 900,
    "user": {
      "id": "uuid",
      "verificationState": "pending"
    }
  },
  "requestId": "uuid"
}
```

Never return password hashes, credential records, refresh-token values, OTP
values, Google provider secrets, or raw session rows.
