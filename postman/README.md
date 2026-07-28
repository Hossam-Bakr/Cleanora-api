# Cleanora API Workspace

> 🟢 **Hosted API:** `https://cleanora-production.up.railway.app/api/v1`
>
> 📘 **Hosted Swagger:** `https://cleanora-production.up.railway.app/api/v1/docs`
>
> 🧪 **Local Swagger:** `http://localhost:8000/api/v1/docs`

Cleanora is a modular-monolith backend for a multi-actor cleaning marketplace.
This workspace documents and exercises the R1-P01 foundation and R1-P02
authentication contracts without exporting credentials, OTPs, or tokens.

---

## Quick Start

1. Import the appropriate environment from `postman/environments/`.
2. Import the generated R1-P02 authentication collection.
3. Select the environment before sending any request.
4. Confirm `GET {{hostUrl}}/system/health/live`.
5. Read Swagger for request/response and error contracts.
6. Enter private test identifiers and credentials only in your local Postman
   environment.

```text
Hosted API
https://cleanora-production.up.railway.app/api/v1
```

```text
Hosted Swagger
https://cleanora-production.up.railway.app/api/v1/docs
```

```text
Local API
http://localhost:8000/api/v1
```

```text
Local Swagger
http://localhost:8000/api/v1/docs
```

{-----------image 1: authentication flow----------}

---

## Email-Only R1-P02 Authentication

Under DEC-028, email is the only verification and password-recovery delivery
channel for every supported self-signup category:

- `INDIVIDUAL`
- `COMPANY`
- `ENGINEER`
- `PROVIDER_OWNER`

Every signup requires `phone`, `email`, and `password`. The phone is stored as
an unverified contact identifier; R1-P02 does not claim phone ownership.
Worker self-signup remains forbidden. Real SMS and phone verification are
deferred to R1-P26.

```text
POST /auth/signup
  -> email receives six-digit code
POST /auth/otp/verify
  -> category becomes verified
POST /auth/login
  -> access token + HttpOnly refresh cookie
GET /auth/me
  -> canonical safe user
```

The collection captures `challengeId` and `accessToken` automatically when
their responses are successful. OTP values and passwords remain manual,
private environment values.

---

## Google Browser Authentication

Google sign-in must start in the same browser that completes it:

```text
GET /auth/google/browser
  -> Google
  -> GET /auth/google/callback
  -> frontend callback
  -> POST /auth/refresh with credentials included
  -> GET /auth/me
  -> Home
```

A new Google identity is accepted only when Google supplies a verified email.
It becomes an active `INDIVIDUAL` identity immediately. R1-P02 has no Google
phone OTP endpoint and no phone-verification modal.

{-----------image 2: Google authentication flow----------}

Important boundaries:

- Use Chrome for the real redirect flow.
- Do not start in Postman and continue in Chrome.
- Never put tokens, Google code, state, nonce, or PKCE values in frontend URLs.
- Keep the access token in memory.
- Let the browser manage the HttpOnly refresh cookie.
- Do not silently merge accounts only because email strings match.

---

## Frontend Integration Contract

Use one shared API client:

- Parse `{ success, data, requestId }`.
- Render every validation item from `error.details.issues`.
- Send `Authorization: Bearer <accessToken>` for protected requests.
- Send `credentials: "include"` for refresh/logout cookie flows.
- On the first access `401`, refresh once and retry once.
- Never create a recursive refresh loop.
- Never store the access token in `localStorage`.
- Never try to read the refresh cookie.

{-----------image 3: frontend integration workflow----------}

---

## Canonical Endpoint Map

### Public verification and password

```http
POST /auth/signup
POST /auth/otp/request
POST /auth/otp/verify
POST /auth/login
POST /auth/password/forgot
POST /auth/password/reset
```

### Authenticated account and session

```http
POST /auth/refresh
GET  /auth/me
POST /auth/account-categories
POST /auth/password/change
POST /auth/logout
POST /auth/logout-all
```

### Google identity

```http
GET    /auth/google
GET    /auth/google/browser
GET    /auth/google/callback
GET    /auth/google/link
DELETE /auth/social/google
```

---

## Environment Variables

| Variable | Purpose | Handling |
|---|---|---|
| `hostUrl` | Selected API root including `/api/v1` | Environment |
| `swaggerUrl` | Selected Swagger UI | Environment |
| `frontendUrl` | Allowlisted browser callback frontend | Environment |
| `origin` | Trusted cookie-mutation origin | Environment |
| `testEmail` | Test account and verification email | Enter privately |
| `testPhone` | E.164 contact phone; not verified in R1-P02 | Enter privately |
| `testPassword` | Current password | Enter privately |
| `newPassword` | Replacement password | Enter privately |
| `emailOtp` | Six-digit account verification code | Enter from email |
| `challengeId` | Latest verification challenge | Captured automatically |
| `passwordResetCode` | Four-digit recovery code | Enter from email |
| `accessToken` | Short-lived Bearer token | Captured automatically |

Do not export a workspace containing real passwords, OTPs, access tokens, or
provider credentials.

---

## Standard Responses

Success:

```json
{
  "success": true,
  "data": {},
  "requestId": "<request-id>"
}
```

Validation failure:

```json
{
  "success": false,
  "error": {
    "code": "REQUEST_VALIDATION_FAILED",
    "statusCode": 400,
    "message": "Request validation failed",
    "details": {
      "issues": []
    }
  },
  "requestId": "<request-id>"
}
```

Swagger is the source of truth for each operation’s exact status codes,
request body, response data, and safe error examples.
