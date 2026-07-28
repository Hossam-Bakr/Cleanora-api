# 🟢 Cleanora API Workspace

> **A professional API workspace for integrating Cleanora authentication,
> identity, secure sessions, health checks, Google OAuth, OTP verification,
> and password recovery.**

| 🟢 API | 🔵 Documentation | 🟠 Testing | 🟣 Frontend |
| --- | --- | --- | --- |
| Railway hosted backend | OpenAPI 3.1 + Swagger UI | Postman collections and environments | Browser-safe session integration |

---

## 🚀 Start Here

Follow this order when you are integrating or reviewing Cleanora:

1. 🔵 Read the Swagger contract.
2. 🟠 Import the Postman environment and collections.
3. 🟢 Confirm that the backend health endpoints are available.
4. 🟡 Test signup, verification, login, refresh, and logout.
5. 🟣 Test Google authentication in Chrome.
6. 🧩 Build one shared frontend API client.
7. 🏠 Bootstrap the authenticated user and render the Home page.

> ⚠️ **Hey Bassam, you can visit Swagger docs here, my bro:**

```text
http://localhost:8000/api/v1/docs
```

Hosted Railway Swagger:

```text
https://cleanora-production.up.railway.app/api/v1/docs
```

Machine-readable OpenAPI document:

```text
https://cleanora-production.up.railway.app/api/v1/docs/openapi.json
```

---

## 🌍 Available Environments

### 🟢 Railway Hosted API

Use this environment when testing the deployed backend:

```text
https://cleanora-production.up.railway.app/api/v1
```

Postman environment:

```text
Cleanora — Railway Hosted API
```

### 🔵 Local Development API

Use this environment while the backend is running locally:

```text
http://localhost:8000/api/v1
```

Postman environment:

```text
Cleanora — Local Development
```

Every collection request starts with:

```text
{{hostUrl}}
```

Switching the active Postman environment changes the target API without
editing any request.

---

## 📥 Import the Workspace

1. Open your Postman workspace.
2. Select **Import**.
3. Import one or both environment files:

```text
Cleanora-local.postman_environment.json
Cleanora-railway.postman_environment.json
```

4. Import the collections:

```text
R1-P00-foundation.postman_collection.json
R1-P01-foundation-country-configuration.postman_collection.json
R1-P02-authentication.postman_collection.json
Cleanora-swagger-documentation.postman_collection.json
```

5. Select the intended environment from the environment selector.
6. Save your private test values in that environment.
7. Start with the Swagger collection or the liveness endpoint.

> 🟠 **Already imported an older version?** Delete the old collections or use
> **Replace** during import. Keeping two copies may cause Postman to continue
> showing old `{{baseUrl}}` requests.

---

## 🩺 First Backend Check

Before testing authentication, send these requests in order:

```http
GET {{hostUrl}}/system/health/live
GET {{hostUrl}}/system/health/ready
GET {{hostUrl}}/system/health/database
```

Expected meaning:

| Endpoint | Purpose |
| --- | --- |
| 🟢 `/system/health/live` | Confirms that the HTTP process is running |
| 🟡 `/system/health/ready` | Confirms that required startup dependencies are ready |
| 🔵 `/system/health/database` | Confirms that PostgreSQL is reachable |

Do not begin debugging authentication if readiness or database health is
already failing.

---

## 🔐 Standard Authentication Journey

A normal user journey follows this sequence:

```text
Signup
  → OTP delivery
  → OTP verification
  → Login
  → Refresh-backed session
  → Current user
  → Home page
```

### Main flow

1. `POST /auth/signup` creates the pending identity and returns a
   `challengeId`.
2. The required OTP is delivered through the approved channel.
3. `POST /auth/otp/verify` consumes the OTP and completes the verification
   gate.
4. `POST /auth/login` returns an access token and safe user data.
5. The backend writes the refresh credential as an HttpOnly cookie.
6. `GET /auth/me` returns the latest safe authenticated user.
7. The frontend renders the Home page.

### Verification channels

| Account category | Blocking verification |
| --- | --- |
| 🟢 Individual | Phone OTP |
| 🔵 Company | Email OTP |
| 🟣 Engineer | Email OTP |
| 🟠 Provider Owner | Email OTP |
| 🔴 Worker | Public self-signup is not allowed |

> 🟡 During development, a phone OTP may be delivered to email by the approved
> development fallback. Production requires a real SMS provider.

{-----------image 1----------}

---

## 🌈 Google Authentication Journey

Google authentication is available for **Individual accounts only**.

### Browser flow

1. The frontend performs top-level navigation:

```javascript
window.location.assign(`${API_BASE_URL}/auth/google/browser`);
```

2. The backend creates one-time OAuth state, nonce, and PKCE data.
3. The backend redirects the browser to Google.
4. Google returns to:

```text
GET /auth/google/callback
```

5. The backend validates the correlated OAuth transaction.
6. The backend sets the HttpOnly refresh cookie.
7. The backend redirects to the allowlisted frontend callback with safe
   markers only.
8. The frontend calls:

```http
POST /auth/refresh
credentials: include
```

9. If `verification=complete`, the frontend loads `/auth/me` and opens Home.
10. If `verification=phone-required`, the frontend opens the phone
    verification modal.

### Google phone-verification branch

```text
Enter phone
  → POST /auth/google/phone/request
  → Receive challengeId
  → Enter six-digit OTP
  → POST /auth/google/phone/verify
  → GET /auth/me
  → Home page
```

### Important OAuth boundaries

- 🔴 Do not start the OAuth journey in Postman and continue it in Chrome.
- 🔴 Do not send OAuth codes, state, provider errors, or tokens to the frontend.
- 🔴 Do not silently merge identities because email strings match.
- 🟢 Start the real journey through `/auth/google/browser`.
- 🟢 Keep the access token in frontend memory.
- 🟢 Let the browser manage the HttpOnly cookies.

{-----------image 2----------}

---

## 🧩 Frontend Integration Workflow

Use one shared API client for every frontend feature. Authentication behavior
should not be duplicated across pages and components.

### Recommended frontend order

```text
Swagger
  → Postman
  → Health checks
  → Authentication journeys
  → Shared API client
  → App session bootstrap
  → Protected screens
```

### Frontend configuration

```env
VITE_API_BASE_URL=https://cleanora-production.up.railway.app/api/v1
```

Example:

```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
```

### Session-storage contract

| Data | Correct location |
| --- | --- |
| 🟢 Access token | Frontend memory |
| 🟢 Refresh token | Backend-managed HttpOnly cookie |
| 🟢 Safe user | Auth state/store |
| 🔴 Password | Never persist |
| 🔴 OTP | Never persist |
| 🔴 Refresh token | Never read with frontend JavaScript |

Do not store access or refresh credentials in `localStorage`.

### App bootstrap

On application startup:

```typescript
const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
  method: "POST",
  credentials: "include",
});
```

If refresh succeeds:

1. Keep `data.accessToken` in memory.
2. Store `data.user` in the authentication state.
3. Optionally call `GET /auth/me` for the latest user state.
4. Route the user to Home or the required verification screen.

If refresh returns `401`, treat the visitor as logged out and render Login.

### Protected requests

```typescript
await fetch(`${API_BASE_URL}/auth/me`, {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
  credentials: "include",
});
```

### Safe refresh interceptor

When a protected request returns `401`:

1. Attempt `POST /auth/refresh` once.
2. Replace the in-memory access token.
3. Retry the original request once.
4. If refresh fails, clear frontend authentication state and show Login.

> 🔴 Never recursively refresh. Never retry the same failed request forever.

{-----------image 3----------}

---

## 📦 Standard API Response Contract

### Success response

```json
{
  "success": true,
  "data": {},
  "requestId": "request-correlation-id"
}
```

### Error response

```json
{
  "success": false,
  "error": {
    "code": "STABLE_ERROR_CODE",
    "statusCode": 400,
    "message": "A safe and descriptive message",
    "details": {}
  },
  "requestId": "request-correlation-id"
}
```

### Multiple validation issues

The frontend should render all items in `error.details.issues` after one
submission instead of forcing the user to fix one field at a time.

```json
{
  "success": false,
  "error": {
    "code": "REQUEST_VALIDATION_FAILED",
    "statusCode": 400,
    "message": "Request validation failed",
    "details": {
      "issues": [
        {
          "field": "phone",
          "reason": "invalid"
        },
        {
          "field": "email",
          "reason": "invalid"
        }
      ]
    }
  },
  "requestId": "request-correlation-id"
}
```

Frontend error handling should use `error.code` for behavior and `message` for
safe display. Use `requestId` when reporting a problem to backend support.

---

## 🗺️ Authentication Endpoint Map

### 🟢 Public account and password endpoints

```http
POST /auth/signup
POST /auth/otp/request
POST /auth/otp/verify
POST /auth/login
POST /auth/password/forgot
POST /auth/password/reset
```

### 🔵 Session and authenticated account endpoints

```http
POST /auth/refresh
GET  /auth/me
POST /auth/account-categories
POST /auth/password/change
POST /auth/logout
POST /auth/logout-all
```

### 🌈 Google endpoints

```http
GET    /auth/google
GET    /auth/google/browser
GET    /auth/google/callback
POST   /auth/google/phone/request
POST   /auth/google/phone/verify
GET    /auth/google/link
DELETE /auth/social/google
```

`GET /auth/google` returns an authorization URL for inspection.
`GET /auth/google/browser` is the correct real-browser entry point.

---

## 🔁 Password Recovery

```text
POST /auth/password/forgot
  → Enumeration-safe accepted response
  → Frontend stores the returned challengeId
  → User receives a four-digit reset code
  → POST /auth/password/reset
  → Existing sessions are revoked
  → User signs in with the new password
```

The user types only the four-digit code. The frontend sends it together with
the opaque `challengeId` returned by the forgot-password response:

```json
{
  "challengeId": "{{challengeId}}",
  "code": "{{passwordResetCode}}",
  "newPassword": "{{newPassword}}"
}
```

Never expose or log the reset code. The code is single-use, attempt-limited,
and valid only for its matching challenge.

---

## 🧪 Postman Environment Variables

| Variable | Usage | Source |
| --- | --- | --- |
| `hostUrl` | Active API root | Environment |
| `swaggerUrl` | Active Swagger UI | Environment |
| `frontendUrl` | Browser callback frontend | Environment |
| `origin` | Trusted cookie-mutation origin | Environment |
| `testEmail` | Test account email | Enter manually |
| `testPhone` | E.164 test phone | Enter manually |
| `testPassword` | Current password | Enter manually |
| `newPassword` | Replacement password | Enter manually |
| `emailOtp` | Signup/account OTP | Enter from delivery |
| `phoneOtp` | Google phone OTP | Enter from delivery |
| `challengeId` | Latest verification challenge | Captured automatically |
| `passwordResetCode` | Four-digit reset code | Enter from delivery |
| `accessToken` | Bearer access credential | Captured automatically |

The refresh cookie stays in Postman's cookie jar. It is intentionally not an
environment variable.

---

## 🛡️ Security Rules

- 🟢 Use HTTPS in production.
- 🟢 Keep access tokens short-lived and in memory.
- 🟢 Rotate the refresh token through `/auth/refresh`.
- 🟢 Use `credentials: "include"` for refresh and logout cookie flows.
- 🟢 Send the access token as `Authorization: Bearer <accessToken>`.
- 🟡 Expect `429` when authentication rate limits are exceeded.
- 🔴 Never log passwords, OTPs, reset tokens, access tokens, refresh tokens, or
  cookies.
- 🔴 Never expose backend provider secrets to the browser.
- 🔴 Never bypass a required phone or email verification gate.

---

## 🧯 Troubleshooting

| Problem | Check |
| --- | --- |
| `HTTP_ROUTE_NOT_FOUND` | Confirm `/api/v1` exists in `hostUrl` |
| Postman shows unresolved `{{hostUrl}}` | Select and save the correct environment |
| `RATE_LIMIT_EXCEEDED` | Wait for the policy window; do not repeatedly resend |
| Refresh returns `401` | Check the Postman cookie jar and trusted Origin |
| Browser CORS failure | Add the frontend origin to backend `CORS_ORIGINS` |
| Google redirects with `google=error` | Check Google credentials, callback URI, cookies, and correlation state |
| Google callback page is unavailable | Run the frontend and implement its configured callback route |
| OTP verification fails | Use the newest `challengeId` and newest unexpired OTP |
| Railway route is missing | Confirm the full URL starts with `/api/v1` |

---

## 🎨 Status Color Guide

| Color | Meaning |
| --- | --- |
| 🟢 Green | Ready, successful, or recommended |
| 🔵 Blue | Documentation or information |
| 🟠 Orange | Postman action or testing step |
| 🟡 Yellow | Development note or caution |
| 🟣 Purple | Frontend responsibility |
| 🔴 Red | Security prohibition or failure |

---

## 🔧 Repository Regeneration

Regenerate the canonical authentication collection and both environments:

```bash
npm run postman:generate:auth
```

Do not export real credentials or OTPs after using the workspace.

---

> 🟢 **Swagger explains the contract. Postman proves the API. The shared
> frontend client integrates it. The browser completes OAuth. The user reaches
> Home safely.**
