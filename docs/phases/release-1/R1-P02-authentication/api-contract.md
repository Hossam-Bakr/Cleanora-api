# R1-P02 Authentication API Contract

Base path: `/api/v1/auth`

Status: implemented while R1-P02 remains In Progress pending final validation
and human approval.

| Method | Route | Access | Purpose |
|---|---|---|---|
| POST | `/signup` | Public | Create an individual, company, engineer, or provider-owner identity |
| POST | `/login` | Public | Authenticate with phone/email and password according to actor rules |
| POST | `/refresh` | Refresh cookie | Rotate the refresh token and issue a new access token |
| POST | `/logout` | Authenticated/session | Revoke the current session and clear the refresh cookie |
| POST | `/logout-all` | Authenticated | Revoke every session owned by the current user |
| GET | `/me` | Authenticated | Return the current safe identity contract |
| POST | `/otp/request` | Public/rate-limited | Request or resend an allowed verification OTP by `challengeId` or `userId`+`accountCategory` |
| POST | `/otp/verify` | Public/rate-limited | Verify an OTP; public success returns `nextAction: LOGIN` with no session |
| POST | `/password/forgot` | Public/rate-limited | Start password recovery without account enumeration or token disclosure |
| POST | `/password/reset` | Public/rate-limited | Reset with the complete composite token; returns `nextAction: LOGIN` and no session |
| POST | `/password/change` | Authenticated | Change the current password and apply session policy |
| GET | `/google` | Public/rate-limited | Create Google state and return an authorization URL to an API client |
| GET | `/google/browser` | Public/rate-limited | Create Google state and redirect a top-level browser to Google |
| GET | `/google/callback` | Correlated browser callback | Complete sign-in or linking from the server-held transaction intent and redirect to the frontend |
| GET | `/google/link` | Full authenticated individual | Start deliberate Google account linking |
| DELETE | `/social/google` | Full authenticated individual | Unlink Google only when another recoverable credential remains |

## Signup request direction

Use one discriminated request with `accountCategory`:

- `INDIVIDUAL`
- `COMPANY`
- `ENGINEER`
- `PROVIDER_OWNER`

Do not accept a privileged staff role or worker self-signup from public input.

The shared password policy accepts 7–128 characters and does not require a
mixture of uppercase letters, lowercase letters, numbers, or symbols.
Numbers-only passwords are valid when they are not predictable. Common values,
one-character repetition, repeated patterns, and ascending or descending
numeric sequences are rejected.

## Token transport

- Access token: response data and later `Authorization: Bearer <token>`.
- Refresh token: `HttpOnly` cookie only.
- Refresh token is never returned in JSON.
- Google callback redirects contain only safe outcome markers. They never
  contain an access token, refresh token, Google code, state, or provider error.
- Failure redirects may contain only the stable Cleanora reason markers
  `correlation-failed`, `provider-rejected`, or `authentication-failed`.
- After a successful Google browser callback, the frontend calls
  `POST /refresh` with credentials included to obtain the access token.
- Postman may retain the cookie in its cookie jar; environment files must not
  contain a real refresh token.

## Google browser flow

1. The frontend navigates the top-level browser to `GET /google/browser`.
2. The backend creates one-time state, nonce, and PKCE values, stores the
   transaction server-side, sets the state correlation cookie, and redirects to
   Google.
3. Google returns only to the configured backend `GOOGLE_REDIRECT_URI`.
4. The backend validates the cookie, consumes the one-time transaction, and
   completes either sign-in or linking from the stored transaction intent.
5. For sign-in, the backend sets the refresh cookie and redirects to
   `GOOGLE_FRONTEND_CALLBACK_URI?google=success&intent=sign-in`.
6. The frontend callback calls `POST /refresh` with
   `credentials: "include"` and initializes its session from `data.user`.
7. A new Google identity is active only when Google supplies a verified email.
   R1-P02 exposes no Google phone-verification endpoint and makes no phone
   ownership claim; that work is deferred to R1-P26.

Because Cleanora is greenfield, no duplicate legacy Google callback or phone
binding aliases are exposed. New integrations use only the canonical routes
above.

Real Chrome sign-in always starts at `/google/browser`. `/google` is retained
for API-client inspection only; copying its authorization URL from Postman into
Chrome fails correctly because the correlation cookie belongs to Postman.

Login, refresh, and authenticated password change return the same safe user:

```json
{
  "accessToken": "<access-token>",
  "accessExpiresAt": "2026-07-27T12:15:00.000Z",
  "verificationOnly": false,
  "user": {
    "id": "<user-id>",
    "email": "user@example.com",
    "phone": "+201234567890",
    "emailVerified": false,
    "phoneVerified": true,
    "status": "ACTIVE",
    "accountCategories": ["INDIVIDUAL"],
    "verifiedCategories": ["INDIVIDUAL"],
    "pendingCategories": []
  },
  "identity": {
    "userId": "<user-id>",
    "sessionId": "<session-id>"
  }
}
```

`identity` remains temporarily for backward compatibility. New frontend code
uses `user`. `GET /me` returns `{ "user": { ... }, "verificationOnly": false }`
with the identical safe-user representation.

## Response envelopes

All routes follow `docs/standards/api-response-and-errors.md`.

Every JSON failure contains a stable machine-readable `code`, numeric
`statusCode` matching the HTTP response, a safe human-readable `message`,
optional `details`, and `requestId`:

```json
{
  "success": false,
  "error": {
    "code": "AUTH_PHONE_ALREADY_REGISTERED",
    "statusCode": 409,
    "message": "This phone number is already registered.",
    "details": {
      "field": "phone",
      "reason": "already_registered"
    }
  },
  "requestId": "uuid"
}
```

The frontend should branch on `error.code`, associate input feedback through
`error.details.field`, and display `error.message`. It must not parse the
message to make decisions.

For `REQUEST_VALIDATION_FAILED`, `error.details.issues` contains every
independently detectable invalid field from the request. Each issue provides
`path`, `code`, and `message`, allowing the frontend to render all field
messages in one submission.

Public signup deliberately distinguishes
`AUTH_PHONE_ALREADY_REGISTERED` and `AUTH_EMAIL_ALREADY_REGISTERED`. This is a
human-approved usability tradeoff. Login and forgot-password remain
enumeration-safe and do not disclose whether an account exists.

When both normalized signup identifiers already exist, the API returns
`AUTH_SIGNUP_IDENTIFIERS_ALREADY_REGISTERED` and includes both `phone` and
`email` entries in `error.details.issues`. Passwords are not uniqueness fields,
are never compared with another account's password, and never appear in
conflict details.

Example signup / OTP-request success data:

```json
{
  "success": true,
  "data": {
    "accepted": true,
    "challengeId": "uuid",
    "nextAction": "VERIFY_ACCOUNT",
    "accountCategory": "INDIVIDUAL",
    "purpose": "CATEGORY_VERIFICATION",
    "channel": "SMS",
    "maskedDestination": "+20******5678",
    "expiresAt": "2026-07-26T12:10:00.000Z",
    "resendAvailableAt": "2026-07-26T12:01:00.000Z"
  },
  "requestId": "uuid"
}
```

Example login success data:

```json
{
  "success": true,
  "data": {
    "accessToken": "<redacted>",
    "accessExpiresAt": "2026-07-26T12:15:00.000Z",
    "verificationOnly": false,
    "identity": {
      "userId": "uuid",
      "accountCategories": ["INDIVIDUAL"],
      "verifiedCategories": ["INDIVIDUAL"],
      "pendingCategories": [],
      "status": "ACTIVE",
      "verificationOnly": false
    }
  },
  "requestId": "uuid"
}
```

Never return password hashes, credential records, refresh-token values, OTP
values, password-reset credentials, Google provider secrets, or raw session rows.
