# 🟢 Cleanora API Workspace

> **A professional API workspace for integrating Cleanora authentication,**
> **identity, secure sessions, health checks, Google OAuth, customer profiles,**
> **preferences, text addresses, protected media, and privacy requests.**

| 🟢 **API** | 🔵 **Documentation** | 🟠 **Testing** | 🟣 **Frontend** |
|---|---|---|---|
| Railway hosted backend | OpenAPI 3.1 + Swagger UI | Postman collections and environments | Browser-safe session integration |

Cleanora is a modular-monolith backend for a multi-actor cleaning marketplace.
This workspace documents and exercises the implemented foundation, country
configuration, authentication, secure sessions, and R1-P04 customer
self-service APIs.

| Workspace job | Outcome |
|---|---|
| 🔵 **Learn** | Read the Swagger contract before writing integration code |
| 🟠 **Prove** | Exercise saved Postman requests and examples |
| 🟣 **Integrate** | Build one shared, browser-safe authenticated API client |

> 🔴 **Security:** Never export real passwords, OTPs, access tokens, cookies,
> profile images, Cloudinary identifiers, signed media URLs, or private
> environment values.

### 🔗 Quick Links

| Target | API root | Swagger UI |
|---|---|---|
| 🟢 **Hosted** | `https://cleanora-production.up.railway.app/api/v1` | `https://cleanora-production.up.railway.app/api/v1/docs` |
| 🔵 **Local** | `http://localhost:8000/api/v1` | `http://localhost:8000/api/v1/docs` |

---

## 📦 Workspace Contents

| File | Purpose |
|---|---|
| `Cleanora-local.postman_environment.json` | Local API, local Swagger, and private local test variables |
| `Cleanora-railway.postman_environment.json` | Hosted API, hosted Swagger, and private hosted test variables |
| `R1-P00-foundation.postman_collection.json` | Product and database foundation checks |
| `R1-P01-foundation-country-configuration.postman_collection.json` | Health and country-configuration APIs |
| `R1-P02-authentication.postman_collection.json` | Signup, verification, login, sessions, password, and Google identity |
| `R1-P04-customer-self-service.postman_collection.json` | Profiles, media, contact state, preferences, addresses, overview, and privacy requests |
| `Cleanora-swagger-documentation.postman_collection.json` | Swagger UI and machine-readable OpenAPI entry points |

Every phase collection separates requests into `Hosted` and `Local` folders.
Use a folder only with its matching environment; captured tokens and resource
identifiers belong to that target.

---

## 🚀 Start Here

Follow this order when integrating or reviewing Cleanora:

1. 🔵 **Read Swagger** for the exact request, response, status, and error contract.
2. 🟠 **Import both environments** and all five collections.
3. 🟢 **Select the matching environment and folder** for the intended target.
4. 🩺 **Confirm liveness, readiness, and database health.**
5. 🟡 **Complete or reuse a verified R1-P02 identity** and log in.
6. 🔐 **Confirm `GET /auth/me`** before testing customer self-service.
7. 🏠 **Bootstrap R1-P04** with `GET /customers/me/overview`.
8. ✏️ **Use the separate resource endpoints** for R1-P04 writes.
9. 🧩 **Build one shared frontend API client** with one safe refresh path.

> ⚠️ **Already imported an older version?** Delete the old collections or use
> **Replace** during import. Duplicate collections can leave obsolete variables
> or request bodies in the workspace.

---

## 🌍 Available Environments

| Target | API root | Swagger UI | Postman environment |
|---|---|---|---|
| Hosted | `https://cleanora-production.up.railway.app/api/v1` | `https://cleanora-production.up.railway.app/api/v1/docs` | `Cleanora — Railway Hosted API` |
| Local | `http://localhost:8000/api/v1` | `http://localhost:8000/api/v1/docs` | `Cleanora — Local Development` |

Every request starts with a target-specific URL variable. The selected folder
and environment determine whether the request runs locally or against the
hosted API without editing the request path.

Machine-readable OpenAPI document:

```text
{{hostUrl}}/docs/openapi.json
```

---

## 🩺 First Backend Check

Run these requests before debugging authentication or R1-P04:

```http
GET /system/health/live
GET /system/health/ready
GET /system/health/database
```

| Endpoint | Meaning |
|---|---|
| `/system/health/live` | The HTTP process is running |
| `/system/health/ready` | Required startup dependencies are ready |
| `/system/health/database` | PostgreSQL is reachable |

If readiness or database health fails, fix that dependency before diagnosing a
higher-level authentication or customer API request.

---

## 🔐 Authentication and Session Foundation

R1-P04 uses the existing R1-P02 Bearer session contract. Under DEC-028, email
is the verification and password-recovery channel for all supported public
self-signup categories:

- `INDIVIDUAL`
- `COMPANY`
- `ENGINEER`
- `PROVIDER_OWNER`

Every signup supplies `phone`, `email`, and `password`. The phone is stored as
an unverified contact identifier; R1-P02 does not claim phone ownership. Worker
self-signup is forbidden. Real phone ownership verification is deferred to
R1-P26.

```text
POST /auth/signup
  -> email receives the verification code
POST /auth/otp/verify
  -> the selected category becomes verified
POST /auth/login
  -> accessToken + safe user + HttpOnly refresh cookie
GET /auth/me
  -> canonical authenticated user
```

The collection captures `challengeId` and `accessToken` after successful
responses. Passwords, OTPs, and reset codes remain manual private values.

> 🖼️ **IMAGE PLACEHOLDER — auth_01**
>
> `<----------- image auth_01: authentication and session flow ----------->`
>
> Asset: `postman/assets/cleanora-authentication-flow.png`

### 🌈 Google Browser Authentication

Google sign-in is available for Individual identities and must begin in the
same browser that completes the redirect:

```text
GET /auth/google/browser
  -> Google
  -> GET /auth/google/callback
  -> allowlisted frontend callback
  -> POST /auth/refresh with credentials included
  -> GET /auth/me
  -> authenticated application
```

A new Google identity requires a provider-verified email and becomes an active
`INDIVIDUAL` identity. R1-P02 has no Google phone-OTP endpoint and no
phone-verification modal.

Important boundaries:

- Use a browser for the real redirect journey.
- Do not start in Postman and continue in another browser context.
- Never send tokens, OAuth code, state, nonce, or PKCE values to the frontend URL.
- Never silently merge identities only because email strings match.
- Keep the access token in frontend memory.
- Let the browser manage the HttpOnly refresh cookie.

> 🖼️ **IMAGE PLACEHOLDER — auth_02**
>
> `<----------- image auth_02: Google browser authentication ----------->`
>
> Asset: `postman/assets/cleanora-google-authentication-flow.png`

---

## 🧩 Frontend Integration Contract

Use one shared API client for every feature:

- Parse successful `{ success, data, requestId }` envelopes.
- Use `error.code` for behavior and `error.message` for safe display.
- Render every item in `error.details.issues` after one submission.
- Send `Authorization: Bearer <accessToken>` for protected requests.
- Send `credentials: "include"` for refresh and logout cookie flows.
- On the first protected-request `401`, refresh once and retry once.
- If refresh fails, clear authentication state and render Login.
- Never create a recursive refresh loop.
- Never persist access or refresh credentials in `localStorage`.
- Never read the refresh cookie from frontend JavaScript.

Recommended startup:

```ts
const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
  method: "POST",
  credentials: "include",
});
```

After refresh succeeds, keep `data.accessToken` in memory, store `data.user` in
the authentication state, and load the customer screen with
`GET /customers/me/overview` when the identity is eligible for R1-P04.

> 🖼️ **IMAGE PLACEHOLDER — auth_03**
>
> `<----------- image auth_03: frontend integration workflow ----------->`
>
> Asset: `postman/assets/cleanora-frontend-integration-flow.png`

---

## 📄 Standard API Response Contract

Success:

```json
{
  "success": true,
  "data": {},
  "requestId": "<request-id>"
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "STABLE_ERROR_CODE",
    "statusCode": 400,
    "message": "A safe and descriptive message",
    "details": {}
  },
  "requestId": "<request-id>"
}
```

Validation can return multiple field issues together:

```json
{
  "success": false,
  "error": {
    "code": "REQUEST_VALIDATION_FAILED",
    "statusCode": 400,
    "message": "Request validation failed",
    "details": {
      "issues": [
        { "field": "city", "reason": "required" },
        { "field": "district", "reason": "required" }
      ]
    }
  },
  "requestId": "<request-id>"
}
```

Use `requestId` when reporting a problem to backend support. Swagger remains
the source of truth for each operation's exact response data and status codes.

---

## 🗺️ Canonical Endpoint Map

### 🟠 Public Verification and Password

```http
POST /auth/signup
POST /auth/otp/request
POST /auth/otp/verify
POST /auth/login
POST /auth/password/forgot
POST /auth/password/reset
```

### 🟢 Authenticated Account and Session

```http
POST /auth/refresh
GET  /auth/me
POST /auth/account-categories
POST /auth/password/change
POST /auth/logout
POST /auth/logout-all
```

### 🌈 Google Identity

```http
GET    /auth/google
GET    /auth/google/browser
GET    /auth/google/callback
GET    /auth/google/link
DELETE /auth/social/google
```

### 🟣 R1-P04 Customer Self-Service

```http
GET    /customers/me/overview
GET    /customers/profiles/individual
PUT    /customers/profiles/individual
GET    /customers/profiles/company
PUT    /customers/profiles/company
GET    /customers/profiles/engineer
PUT    /customers/profiles/engineer
GET    /customers/profile-image
PUT    /customers/profile-image
DELETE /customers/profile-image
GET    /customers/contact-state
GET    /customers/preferences
PUT    /customers/preferences
GET    /customers/addresses
POST   /customers/addresses
GET    /customers/addresses/{addressId}
PUT    /customers/addresses/{addressId}
DELETE /customers/addresses/{addressId}
GET    /customers/privacy-requests
POST   /customers/privacy-requests
GET    /customers/privacy-requests/{privacyRequestId}
POST   /customers/privacy-requests/{privacyRequestId}/cancel
```

---

## 🧪 Postman Environment Variables

| Variable | Purpose | Handling |
|---|---|---|
| `hostUrl` | Selected API root including `/api/v1` | Environment |
| `hostedUrl` | Fixed hosted API root used by `Hosted` folders | Environment |
| `localUrl` | Fixed localhost API root used by `Local` folders | Environment |
| `swaggerUrl` | Selected Swagger UI | Environment |
| `frontendUrl` | Allowlisted browser callback frontend | Environment |
| `origin` | Trusted cookie-mutation origin | Environment |
| `testEmail` | Test and verification email | Enter privately |
| `testPhone` | E.164 contact phone; unverified in R1-P02 | Enter privately |
| `testPassword` | Current password | Enter privately |
| `newPassword` | Replacement password | Enter privately |
| `emailOtp` | Six-digit account verification code | Enter from email |
| `challengeId` | Latest verification challenge | Captured automatically |
| `passwordResetCode` | Four-digit recovery code | Enter from email |
| `accessToken` | Short-lived Bearer access credential | Captured automatically |
| `profileImagePath` | Local JPEG, PNG, or WebP image | Enter privately |
| `profileImageAssociationVersion` | Current profile-image CAS version | Captured automatically |
| `countryCode` | Active ISO alpha-2 country code | Environment |
| `addressId` | Current owned address identifier | Captured automatically |
| `addressVersion` | Current address CAS version | Captured automatically |
| `preferencesVersion` | Current preference CAS version | Captured automatically |
| `privacyPurpose` | `DEACTIVATION`, `DELETION`, or `EXPORT` | Environment |
| `privacyRequestId` | Current owned privacy-request identifier | Captured automatically |

The refresh credential remains in Postman's cookie jar. It is intentionally not
an environment variable.

---

## 🛡️ Security Rules

- Use HTTPS in production.
- Keep access tokens short-lived and in memory.
- Rotate refresh credentials only through the refresh contract.
- Use Bearer authorization for protected business APIs.
- Expect `429` when a rate limit is exceeded.
- Treat wrong-owner resource failures as enumeration-safe.
- Never log passwords, OTPs, reset credentials, access tokens, cookies, signed
  media URLs, Cloudinary identifiers, or full private customer data.
- Never expose backend provider credentials to Postman or the browser.
- Never bypass active-identity, category-verification, ownership, or version
  checks.

---

## 🧯 Troubleshooting

| Problem | Check |
|---|---|
| `HTTP_ROUTE_NOT_FOUND` | Confirm the API root includes `/api/v1` |
| Unresolved `{{hostUrl}}` | Select and save the correct environment |
| `401` on a protected request | Log in again and confirm `accessToken` was captured |
| Refresh returns `401` | Check the matching Postman cookie jar and trusted `Origin` |
| `403` from R1-P04 | Confirm the identity is active and has a verified supported customer category |
| Category profile returns `403` | Confirm that exact category is verified |
| `404` on an owned resource | Confirm the captured ID belongs to the current identity and target environment |
| `409` on image, preferences, or address update | Refresh the resource and retry with its latest version once |
| `400` on preferences | Send the complete replacement matrix; omitted fields are rejected |
| Profile image rejected | Use one JPEG, PNG, or WebP file no larger than 5 MiB |
| Address rejected | Use an active country and text-only fields; remove maps and coordinates |
| Privacy cancel returns `409` | Only a `PENDING` request can be cancelled by the customer |
| `RATE_LIMIT_EXCEEDED` | Wait for the policy window; do not repeatedly resend |
| Browser CORS failure | Confirm the frontend origin is allowlisted |

---

## 🔧 Regenerate and Validate

Regenerate every canonical collection and both environments:

```bash
npm run postman:generate
```

Validate the exported workspace:

```bash
npm run postman:validate
```

Do not export private values after testing.

---

# 🟢 R1-P04 Documentation — Customer Profiles, Preferences & Text Addresses

R1-P04 is **Complete** as of **2026-08-08**. It ships customer-owned category
profiles, one protected identity-wide profile image, truthful contact-state
display, Arabic/English and notification preferences, peer text addresses, and
request-only privacy foundations.

Post-completion DEC-034 adds the read-only customer overview endpoint. This
addition does not create a primary category and does not merge the existing
write contracts.

> 🖼️ **IMAGE PLACEHOLDER — p4_01**
>
> `<----------- image p4_01: customer self-service overview ----------->`
>
> Asset: `postman/assets/cleanora-r1-p04-customer-self-service-overview.png`

## 🔐 R1-P04 Eligibility and Authorization

Every customer-facing R1-P04 operation requires:

1. A valid authenticated principal.
2. An `ACTIVE` identity.
3. At least one verified supported customer category: `INDIVIDUAL`, `COMPANY`,
   or `ENGINEER`.
4. `SELF` ownership for identity-wide and resource-specific operations.

Category-specific profile operations additionally require that exact category
to be verified. A pending category does not become eligible because another
category is verified. Client-supplied owner, category, permission, or role
claims never create authority.

If eligibility is later lost, existing R1-P04 data remains unchanged but is
inaccessible until eligibility is restored or a separately authorized privacy
processor acts on it.

## 🏠 Customer Overview Bootstrap

```http
GET /customers/me/overview
Authorization: Bearer <accessToken>
```

Use this as the preferred frontend bootstrap request for the customer profile
screen. It returns:

- identity status and supported category state;
- one profile projection for every verified supported category;
- the shared profile image or `null`;
- authoritative phone and email verification state;
- the complete preference state; and
- all owned peer text addresses.

The response never infers a primary category or default address and performs
no mutation. Use the separate resource endpoints for all writes.

Conceptual response shape:

```json
{
  "success": true,
  "data": {
    "identity": {
      "userId": "<user-id>",
      "status": "ACTIVE",
      "accountCategories": ["INDIVIDUAL"],
      "verifiedCategories": ["INDIVIDUAL"],
      "pendingCategories": []
    },
    "profiles": [
      {
        "category": "INDIVIDUAL",
        "created": true,
        "fullName": "Customer Name"
      }
    ],
    "profileImage": null,
    "contactState": {
      "phone": { "value": "+201000000000", "verified": false },
      "email": { "value": "customer@example.com", "verified": true }
    },
    "preferences": {},
    "addresses": []
  },
  "requestId": "<request-id>"
}
```

## 👤 Category Profiles

Profiles are private to their owner and isolated by verified category.
Authentication identifiers and verification evidence remain owned by the
identity system and cannot be changed through profile endpoints.

| Category | Read / write | Required profile fields |
|---|---|---|
| Individual | `GET`, `PUT /customers/profiles/individual` | `fullName` |
| Company | `GET`, `PUT /customers/profiles/company` | `companyName`, `representativeFullName` |
| Engineer | `GET`, `PUT /customers/profiles/engineer` | `fullName`, `professionalTitle` |

Individual:

```json
{
  "fullName": "Customer Name"
}
```

Company:

```json
{
  "companyName": "Clean Company",
  "representativeFullName": "Representative Name"
}
```

Engineer:

```json
{
  "fullName": "Engineer Name",
  "professionalTitle": "Mechanical Engineer"
}
```

Required text is trimmed and must remain non-blank. R1-P04 does not add
biographies, birth date, gender, trade names, registration identifiers, tax
identifiers, disciplines, license identifiers, or provider-onboarding data.

## 🖼️ Protected Profile Image

One optional profile image is shared across the identity's supported customer
categories.

```http
GET    /customers/profile-image
PUT    /customers/profile-image
DELETE /customers/profile-image
```

Upload requirements:

- `multipart/form-data` with one `file` and `expectedAssociationVersion`;
- JPEG, PNG, or WebP input;
- maximum size 5 MiB;
- protected Cloudinary storage and time-limited signed delivery URL;
- always-replace behavior; and
- compare-and-set version protection for replacement and removal.

Failed upload, validation, storage, association, audit, or stale-version work
preserves the previously accepted image. Responses never expose Cloudinary
credentials, storage keys, folders, or `public_id` values.

> 🖼️ **IMAGE PLACEHOLDER — p4_02**
>
> `<----------- image p4_02: profiles, protected media, and contact truth ----------->`
>
> Asset: `postman/assets/cleanora-r1-p04-profiles-media-contact.png`

## 📇 Contact State

```http
GET /customers/contact-state
```

Contact state is read-only and sourced from R1-P02 identity data. Email and
phone values are displayed only for the authenticated owner. A phone must be
shown as unverified unless authoritative phone-verification evidence exists;
the presence of a stored phone number is not proof of ownership.

R1-P04 cannot edit contact identifiers, change verification evidence, send a
verification challenge, or alter authentication sessions.

## 🌐 Preferences

```http
GET /customers/preferences
PUT /customers/preferences
```

The preference `PUT` is a complete atomic replacement. It is not a patch:

- `version` is required and increments after success;
- `language` is required and accepts `AR`, `EN`, or explicit `null`;
- every reminders and promotional channel boolean is required;
- mandatory security and active-service values must all remain `true`;
- omitted fields reject the whole request; and
- a stale version returns `409` without changing prior state.

```json
{
  "version": 1,
  "language": "AR",
  "reminders": {
    "sms": true,
    "push": true
  },
  "promotional": {
    "sms": false,
    "push": false
  },
  "mandatory": {
    "security": {
      "sms": true,
      "push": true
    },
    "activeService": {
      "sms": true,
      "push": true
    }
  }
}
```

Optional reminder and promotional categories default off. Authentication email
delivery remains governed by the authentication module.

## 🏘️ Customer-Owned Text Addresses

```http
GET    /customers/addresses
POST   /customers/addresses
GET    /customers/addresses/{addressId}
PUT    /customers/addresses/{addressId}
DELETE /customers/addresses/{addressId}
```

Create body:

```json
{
  "countryCode": "EG",
  "city": "Cairo",
  "district": "Nasr City",
  "addressText": "10 Example Street",
  "building": "B",
  "floor": "3",
  "notes": "Call on arrival"
}
```

`countryCode`, `city`, `district`, and `addressText` are required.
`building`, `floor`, and `notes` are optional or nullable. `PUT` sends the full
address plus its current `version`; `DELETE` sends the current `version`.

All saved addresses are peers. R1-P04 has no default or primary address, so a
later consumer must require explicit customer selection. Address data rejects
coordinates, map pins, zones, radii, serviceability, and other geospatial
properties.

Wrong-owner reads and mutations use enumeration-safe missing-resource behavior.
A removed address is no longer available for future selection and does not
rewrite an immutable snapshot that a later business operation may own.

> 🖼️ **IMAGE PLACEHOLDER — p4_03**
>
> `<----------- image p4_03: preferences and text-address workflow ----------->`
>
> Asset: `postman/assets/cleanora-r1-p04-preferences-addresses.png`

## 📋 Privacy-Request Foundation

Customers may submit and track three request purposes:

- `DEACTIVATION`
- `DELETION`
- `EXPORT`

```http
GET  /customers/privacy-requests
POST /customers/privacy-requests
GET  /customers/privacy-requests/{privacyRequestId}
POST /customers/privacy-requests/{privacyRequestId}/cancel
```

Submit example:

```json
{
  "purpose": "EXPORT"
}
```

R1-P04 records requests only. It does not deactivate an account, revoke
sessions, delete or anonymize data, create an export archive, or deliver an
export file.

Lifecycle:

```text
PENDING -> PROCESSING -> COMPLETED
                      -> REJECTED

PENDING -> CANCELLED
```

Rules:

- Only one active request per identity and purpose is allowed.
- Repeating an active purpose returns the existing request.
- Different purposes may coexist.
- A customer may cancel only a `PENDING` owned request.
- `PROCESSING`, `COMPLETED`, `REJECTED`, and `CANCELLED` cannot be customer-cancelled.
- Terminal states are immutable.
- Customer responses expose status, timestamps, and safe operational metadata,
  but no free-form rationale or export content.
- Later authorized processors perform claim and fulfillment through explicit
  contracts while R1-P04 retains request-record ownership.

> 🖼️ **IMAGE PLACEHOLDER — p4_04**
>
> `<----------- image p4_04: privacy-request lifecycle ----------->`
>
> Asset: `postman/assets/cleanora-r1-p04-privacy-requests.png`

## ⚖️ R1-P04 Concurrency and Error Rules

| Situation | Expected behavior |
|---|---|
| Missing or invalid body | `400` with safe validation details |
| Missing or expired access token | `401` |
| Inactive or category-ineligible identity | `403` |
| Missing or wrong-owner address/privacy request | Enumeration-safe `404` |
| Stale image, preference, or address version | `409`; prior state preserved |
| Cancel request that is not `PENDING` | `409` |
| Rate limit exceeded | `429` |

Do not blindly retry a `409`. Read the latest resource, reconcile the UI state,
and submit one intentional replacement using the latest version.

## 🚧 R1-P04 Scope Boundaries

R1-P04 intentionally does not provide:

- maps, coordinates, geocoding, zones, coverage geometry, or distance logic;
- phone/email editing or phone-ownership verification;
- provider profiles, provider onboarding, workers, teams, or provider documents;
- staff profile-management UI or privileged customer-data browsing;
- booking creation or booking address snapshots;
- notification delivery, templates, queues, or provider integrations;
- immediate privacy fulfillment; or
- public Cloudinary assets, local filesystem profile storage, video, PDF, or S3 runtime media.

## ✅ R1-P04 Completion and Quality Evidence

R1-P04 completed with owner approval on 2026-08-08 after independent final
implementation re-review `PASS`. The recorded completion evidence includes:

- all tasks T001-T120 complete;
- final specification analysis `CLEAN`;
- unit, integration, and coverage gates passing;
- 1,000-interaction SC-008 workload passing with 25 concurrent lanes and a
  0.974 within-two-seconds ratio;
- live protected Cloudinary smoke evidence passing; and
- typecheck, lint, build, documentation, OpenAPI, Prisma, and diff checks passing.

Phase completion documents shipped behavior; it does not by itself prove that a
specific environment was deployed or authorize a production migration.

---

**Swagger explains the contract. Postman proves the API. The shared frontend
client integrates it. The browser completes OAuth. The customer reaches a safe,
owner-private Cleanora experience.**
