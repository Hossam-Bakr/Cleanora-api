# Cleanora R1-P05 — Provider Onboarding, Profile & Lifecycle

> **Phase:** R1-P05
> **Status:** Complete
> **API version:** `/api/v1`
> **Implemented operations:** 41 operations across 35 paths
> **Collection layout:** identical `Hosted (Not hosted yet)` and `Local` folders

R1-P05 provides the private backend workflow that turns an eligible Cleanora
customer account into a reviewed Provider. It covers application creation,
profile and private contact management, media, completion and readiness
projections, Provider administrators, invitation onboarding, Staff review, and
the approved Provider lifecycle.

The phase does **not** provide anonymous Provider browsing. It also does not
publish the Provider's operational email or phone in the protected preview.

<------------image 1 [Complete R1-P05 provider application and review flow]---------------->

---

## 1. Collection Structure

The collection contains two top-level folders with exactly the same 41
requests:

```text
Cleanora R1-P05 Provider Onboarding, Profile & Lifecycle
├── Hosted (Not hosted yet)
│   ├── 01 — Application
│   ├── 02 — Profile and Private Contacts
│   ├── 03 — Media
│   ├── 04 — Completion, Readiness and Provider Workspace
│   ├── 05 — Members and Admin Invitations
│   ├── 06 — Invitation Token Onboarding
│   └── 07 — Staff Review and Lifecycle
└── Local
    ├── 01 — Application
    ├── 02 — Profile and Private Contacts
    ├── 03 — Media
    ├── 04 — Completion, Readiness and Provider Workspace
    ├── 05 — Members and Admin Invitations
    ├── 06 — Invitation Token Onboarding
    └── 07 — Staff Review and Lifecycle
```

The request prefix is explicit in each environment tree, and a folder-level
pre-request script selects the correct configured value before the request is
sent:

```text
Hosted request prefix = {{hostUrl}}
Local request prefix  = {{baseUrl}}
```

The selected values are:

```text
Local
  hostUrl = http://localhost:8000
  baseUrl = http://localhost:8000/api/v1

Hosted (Not hosted yet)
  hostUrl = {{hostedHostUrl}}
  baseUrl = {{hostedBaseUrl}}
```

The hosted values are placeholders until a deployment exists. Configure them
in your private Postman environment before running the hosted folder.

---

## 2. Quick Start

### Local API

1. Start the backend:

```bash
npm run dev
```

2. Select the `Cleanora — Local Development` environment.
3. Confirm the API is running:

```http
GET http://localhost:8000/api/v1/system/health/live
```

4. Open Swagger:

```text
http://localhost:8000/api/v1/docs
```

5. Authenticate through the R1-P02 collection and ensure `accessToken` contains
   the token for the actor required by the request.
6. Run requests from the `Local` folder.

### Hosted API — not deployed yet

Set these values only after a hosted deployment exists:

```text
hostedHostUrl = https://api.your-cleanora-domain.example
hostedBaseUrl = https://api.your-cleanora-domain.example/api/v1
```

Then select the hosted environment and run the requests from
`Hosted (Not hosted yet)`. The folder intentionally fails early with a clear
message while the placeholder host is still configured.

---

## 3. Actors and Authentication

Most R1-P05 requests require a Bearer access token:

```http
Authorization: Bearer {{accessToken}}
```

The token in `accessToken` must belong to the correct actor for the current
part of the flow:

| Actor | Used for |
|---|---|
| Application Owner | Create and edit the Provider application, submit it, manage media, and invite Provider administrators |
| Provider Admin | Read and operate the Provider after accepting an invitation, subject to capabilities |
| Staff Admin | Review, approve, request changes, reject, suspend, and reinstate Providers |
| Anonymous invitee | Inspect an invitation and start/verify invitation onboarding |

These three invitation requests intentionally use `No Auth`:

```http
POST /provider-admin-invitations/inspect
POST /provider-admin-invitations/onboarding/start
POST /provider-admin-invitations/onboarding/verify-email
```

Accepting the invitation is authenticated:

```http
POST /provider-admin-invitations/accept
Authorization: Bearer {{accessToken}}
```

Before running Staff requests, replace `accessToken` with a valid Staff Admin
token. Never store or export a real token in the collection JSON.

---

## 4. Provider Eligibility

Creating a Provider application is not public registration. The caller must
already be a valid Cleanora customer account.

### Individual team

```json
{
  "providerKind": "INDIVIDUAL_TEAM"
}
```

The account must have a verified `INDIVIDUAL` category and a complete matching
Individual customer profile.

### Registered company

```json
{
  "providerKind": "REGISTERED_COMPANY"
}
```

The account must have a verified `COMPANY` category and a complete matching
Company customer profile. Company document verification is deferred to its
separate phase; R1-P05 still records the Provider kind and applies the
kind-specific completion policy.

`PROVIDER_OWNER` is not a public signup category and cannot be used to satisfy
Provider application eligibility.

<------------image 2 [Step 1 — choose Provider kind]---------------->

---

## 5. Application Owner Flow

### Step 1 — Create or recover the draft

```http
POST {{baseUrl}}/providers
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

```json
{
  "providerKind": "{{providerKind}}"
}
```

Expected result:

- `201 Created` when a new draft is created.
- `200 OK` when the account already owns a Provider and the existing aggregate
  is returned.
- The collection captures `data.id` into `providerId`.
- The collection captures the current aggregate version into
  `providerVersion`.

List or reload the Provider:

```http
GET {{baseUrl}}/providers
GET {{baseUrl}}/providers/{{providerId}}
```

The Provider kind may be changed only before the application has ever been
submitted:

```http
PATCH {{baseUrl}}/providers/{{providerId}}/kind
```

```json
{
  "providerKind": "REGISTERED_COMPANY",
  "expectedVersion": {{providerVersion}}
}
```

### Step 2 — Complete the profile

```http
PUT {{baseUrl}}/providers/{{providerId}}/profile
Content-Type: application/json
```

```json
{
  "displayNameAr": "{{providerDisplayNameAr}}",
  "displayNameEn": "{{providerDisplayNameEn}}",
  "descriptionAr": "{{providerDescriptionAr}}",
  "descriptionEn": "{{providerDescriptionEn}}",
  "countryCode": "{{countryCode}}",
  "expectedVersion": {{providerVersion}}
}
```

`displayNameEn` and `descriptionEn` may be sent as `null`. The country must be
an active configured country. Updating this profile does not change the
Customer profile that supplied the owner identity.

<------------image 3 [Step 2 — Provider profile form]---------------->

### Step 3 — Save private operational contacts

```http
PUT {{baseUrl}}/providers/{{providerId}}/contacts
Content-Type: application/json
```

```json
{
  "operationalEmail": "{{providerOperationalEmail}}",
  "operationalPhone": "{{providerOperationalPhone}}",
  "channels": [
    {
      "type": "WHATSAPP",
      "value": "{{providerWhatsApp}}"
    },
    {
      "type": "WEBSITE",
      "value": "{{providerWebsite}}"
    }
  ],
  "expectedVersion": {{providerVersion}}
}
```

Supported channel types:

```text
WHATSAPP
SOCIAL
WEBSITE
EXTERNAL_BOOKING
```

Operational contacts are private. They are available only through authorized
private and Staff workflows and are excluded from the Provider preview.

<------------image 4 [Step 3 — private operational contacts form]---------------->

### Step 4 — Upload media

Media uploads use `multipart/form-data`, not JSON. Each prepared Postman request
contains both required fields:

| Key | Type | Value |
|---|---|---|
| `file` | File | Environment-specific local path |
| `expectedVersion` | Text | `{{providerVersion}}` |

Endpoints:

```http
PUT  {{baseUrl}}/providers/{{providerId}}/media/logo
PUT  {{baseUrl}}/providers/{{providerId}}/media/cover
POST {{baseUrl}}/providers/{{providerId}}/media/gallery-images
POST {{baseUrl}}/providers/{{providerId}}/media/gallery-videos
```

Configure these private file-path variables before sending uploads:

```text
providerLogoPath
providerCoverPath
providerGalleryImagePath
providerGalleryVideoPath
```

Media limits:

- One logo and one cover.
- Up to 12 gallery images.
- Up to 2 gallery videos.
- Images: JPEG, PNG, or WebP, maximum 5 MiB.
- Videos: MP4 or WebM, maximum 40 MiB.
- Submission requires at least 3 gallery images in `READY` status.

Reorder the gallery:

```http
PUT {{baseUrl}}/providers/{{providerId}}/media/gallery-order
```

```json
{
  "orderedGalleryItemIds": [
    "{{galleryItemId}}"
  ],
  "expectedVersion": {{providerVersion}}
}
```

<------------image 5 [Step 4 — logo, cover, gallery images and videos]---------------->

### Step 5 — Check completion and submit

Before submission, inspect all three projections:

```http
GET {{baseUrl}}/providers/{{providerId}}/completion
GET {{baseUrl}}/providers/{{providerId}}/readiness
GET {{baseUrl}}/providers/{{providerId}}/preview
```

The application can be submitted only when the submission blockers reported by
the API are clear:

```http
POST {{baseUrl}}/providers/{{providerId}}/application/submit
Content-Type: application/json
```

```json
{
  "expectedVersion": {{providerVersion}}
}
```

Successful submission transitions the application to `PENDING_REVIEW`. The
editable content is locked while the application is under review.

<------------image 6 [Step 5 — completion review, protected preview and submit action]---------------->

---

## 6. Completion and Readiness Are Different

Completion explains whether the Provider supplied the required application
content. Readiness explains whether an approved Provider can participate in
marketplace operations.

Typical readiness facts include:

```json
{
  "profileComplete": true,
  "applicationApproved": true,
  "documentsVerified": false,
  "payoutDestinationReady": false,
  "workersReady": false,
  "servicesReady": false,
  "coverageReady": false,
  "operationalLive": false,
  "eligibleForPublicBrowse": false
}
```

R1-P05 owns profile completion and application approval. Documents, payout
destination, workers, services, coverage, and public marketplace activation
belong to later phases. Approval therefore does not automatically make the
Provider `LIVE` or publicly browseable.

Workspace projections:

```http
GET {{baseUrl}}/providers/{{providerId}}/history
GET {{baseUrl}}/providers/{{providerId}}/dashboard
GET {{baseUrl}}/providers/{{providerId}}/settings
```

---

## 7. Provider Members and Admin Invitations

R1-P05 Provider membership is intentionally limited to:

```text
OWNER
ADMIN
```

These members operate the Provider account. They are not cleaning workers.
Worker/team-member management belongs to a later phase.

Create an Admin invitation:

```http
POST {{baseUrl}}/providers/{{providerId}}/admin-invitations
```

```json
{
  "email": "{{providerAdminInviteEmail}}",
  "expectedVersion": {{providerVersion}}
}
```

Expected status: `202 Accepted`.

Invitation management:

```http
GET  {{baseUrl}}/providers/{{providerId}}/admin-invitations
POST {{baseUrl}}/providers/{{providerId}}/admin-invitations/{{invitationId}}/resend
POST {{baseUrl}}/providers/{{providerId}}/admin-invitations/{{invitationId}}/revoke
```

Resend and revoke bodies:

```json
{
  "expectedVersion": {{providerVersion}}
}
```

Disable an existing Admin membership:

```http
DELETE {{baseUrl}}/providers/{{providerId}}/members/{{userId}}
```

```json
{
  "expectedVersion": {{providerVersion}}
}
```

The final enabled Provider Admin cannot be disabled when that would violate the
Provider administration invariant.

---

## 8. New Admin Invitation Onboarding

The raw invitation token is delivered out of band and must be copied privately
into `providerAdminInvitationToken`. It is never committed to the repository or
exported with a value.

### Inspect

```http
POST {{baseUrl}}/provider-admin-invitations/inspect
```

```json
{
  "token": "{{providerAdminInvitationToken}}"
}
```

### Start onboarding for a user who has no Cleanora account

```http
POST {{baseUrl}}/provider-admin-invitations/onboarding/start
```

```json
{
  "token": "{{providerAdminInvitationToken}}",
  "phone": "{{invitedAdminPhone}}",
  "password": "{{testPassword}}"
}
```

Expected status: `202 Accepted`. The collection captures the returned
`challengeId` when present.

### Verify the fixed invitation email

```http
POST {{baseUrl}}/provider-admin-invitations/onboarding/verify-email
```

```json
{
  "token": "{{providerAdminInvitationToken}}",
  "challengeId": "{{challengeId}}",
  "code": "{{emailOtp}}"
}
```

### Log in, then accept

After verification, log in using the R1-P02 collection, place the invitee's
Bearer token in `accessToken`, and send:

```http
POST {{baseUrl}}/provider-admin-invitations/accept
```

```json
{
  "token": "{{providerAdminInvitationToken}}"
}
```

Acceptance is single-use and creates the Provider `ADMIN` membership
atomically.

---

## 9. Staff Review and Provider Lifecycle

Staff endpoints require a Staff Admin Bearer token.

List and filter the review queue:

```http
GET {{baseUrl}}/staff/providers/applications
```

Supported query filters include `status`, `providerKind`, `submittedFrom`,
`submittedTo`, `cursor`, and `limit`.

Read the private dossier:

```http
GET {{baseUrl}}/staff/providers/applications/{{providerId}}
```

Approve:

```http
POST {{baseUrl}}/staff/providers/applications/{{providerId}}/approve
```

```json
{
  "expectedVersion": {{providerVersion}}
}
```

Approval sets the application to `APPROVED` but leaves the operational status
`INACTIVE`. Later readiness phases must be completed before the Provider may
become `LIVE`.

Request changes:

```http
POST {{baseUrl}}/staff/providers/applications/{{providerId}}/request-changes
```

```json
{
  "reason": "{{staffReviewReason}}",
  "expectedVersion": {{providerVersion}}
}
```

The owner may edit and resubmit after `CHANGES_REQUESTED`.

Reject:

```http
POST {{baseUrl}}/staff/providers/applications/{{providerId}}/reject
```

```json
{
  "reason": "{{staffRejectionReason}}",
  "expectedVersion": {{providerVersion}}
}
```

Suspend or reinstate an approved Provider:

```http
POST {{baseUrl}}/staff/providers/{{providerId}}/suspend
POST {{baseUrl}}/staff/providers/{{providerId}}/reinstate
```

```json
{
  "reason": "{{staffLifecycleReason}}",
  "expectedVersion": {{providerVersion}}
}
```

Reinstatement returns the Provider to `INACTIVE`; it never bypasses the
remaining readiness gates by setting the Provider directly to `LIVE`.

---

## 10. Optimistic Concurrency

Every mutation after creation uses `expectedVersion`:

```json
{
  "expectedVersion": {{providerVersion}}
}
```

The collection updates `providerVersion` after successful responses whenever a
current version is available. If a mutation returns `409
PROVIDER_VERSION_CONFLICT`:

1. Send `GET /providers/{{providerId}}`.
2. Confirm that `providerVersion` was refreshed.
3. Review the latest state.
4. Retry the mutation only if it is still valid.

Do not solve version conflicts by permanently hard-coding a higher number.

---

## 11. Prepared Environment Variables

| Variable | Example/default | Purpose |
|---|---|---|
| `localHostUrl` | `http://localhost:8000` | Local scheme and host |
| `localBaseUrl` | `http://localhost:8000/api/v1` | Local API root |
| `hostedHostUrl` | placeholder | Future hosted scheme and host |
| `hostedBaseUrl` | placeholder + `/api/v1` | Future hosted API root |
| `hostUrl` | selected by folder | Active scheme and host |
| `baseUrl` | selected by folder | Active API root used by requests |
| `accessToken` | empty secret | Current actor Bearer token |
| `providerKind` | `INDIVIDUAL_TEAM` | Draft kind |
| `providerId` | empty | Captured Provider ID |
| `providerVersion` | `1` | Captured optimistic-lock version |
| `countryCode` | `EG` | Active country |
| `providerDisplayNameAr` | sample value | Arabic public display name |
| `providerDisplayNameEn` | sample value | English public display name |
| `providerDescriptionAr` | sample value | Arabic public description |
| `providerDescriptionEn` | sample value | English public description |
| `providerOperationalEmail` | safe example | Private operational email |
| `providerOperationalPhone` | safe example | Private E.164 phone |
| `providerWhatsApp` | safe example | Optional WhatsApp channel |
| `providerWebsite` | safe example | Optional website channel |
| `providerLogoPath` | empty | Private local image path |
| `providerCoverPath` | empty | Private local image path |
| `providerGalleryImagePath` | empty | Private local image path |
| `providerGalleryVideoPath` | empty | Private local video path |
| `galleryItemId` | empty | Captured gallery item ID |
| `providerAdminInviteEmail` | safe example | Admin invite target |
| `providerAdminInvitationToken` | empty secret | Raw one-time invite token |
| `invitationId` | empty | Captured invitation ID |
| `invitedAdminPhone` | safe example | Invitation onboarding phone |
| `challengeId` | empty secret | Captured email challenge |
| `emailOtp` | empty secret | Email verification code |
| `userId` | empty | Admin membership target |
| `staffReviewReason` | sample value | Request-changes reason |
| `staffRejectionReason` | sample value | Rejection reason |
| `staffLifecycleReason` | sample value | Suspend/reinstate reason |

Passwords, OTPs, access tokens, invitation tokens, and real operational
contacts must remain private and must not be committed or exported.

---

## 12. Standard Response Envelopes

Every request in both the `Local` and `Hosted (Not hosted yet)` trees contains
a Postman Saved Example named:

```text
Success
```

Expand a request in the collection sidebar to open this example. It contains:

- the HTTP success status expected from that operation;
- the exact request URL and method;
- the prepared required request body, when the endpoint has a body;
- a representative success response body using the Cleanora envelope;
- representative IDs, statuses, versions, timestamps, pagination metadata,
  completion checks, readiness gates, or media data appropriate to that
  operation.

For `GET` requests, the saved example has no request body because HTTP GET
operations in R1-P05 do not require one. Their saved example still provides the
complete representative success response body.

Success:

```json
{
  "success": true,
  "data": {},
  "requestId": "<request-id>"
}
```

Paginated list:

```json
{
  "success": true,
  "data": [],
  "requestId": "<request-id>",
  "meta": {
    "nextCursor": null
  }
}
```

Safe error:

```json
{
  "success": false,
  "error": {
    "code": "PROVIDER_VERSION_CONFLICT",
    "message": "The Provider was modified by another request.",
    "statusCode": 409,
    "details": {}
  },
  "requestId": "<request-id>"
}
```

Every collection request tests the HTTP status, `success` flag, `requestId`,
and `error.statusCode` for error responses.

---

## 13. Important Error Codes

| Code | HTTP status | Meaning |
|---|---:|---|
| `VALIDATION_ERROR` | 400 | Request body, path, query, or upload is invalid |
| `PROVIDER_MEDIA_INVALID` | 400 | Unsupported or invalid media |
| `PROVIDER_REASON_REQUIRED` | 400 | Staff reason is missing or invalid |
| `AUTHENTICATION_REQUIRED` | 401 | Bearer authentication is missing or invalid |
| `PROVIDER_ELIGIBILITY_DENIED` | 403 | The customer identity is not eligible for this Provider kind |
| `PROVIDER_ACCESS_DENIED` | 403 | The actor lacks the required Provider capability |
| `PROVIDER_INVITATION_EMAIL_MISMATCH` | 403 | Authenticated email does not match the invitation |
| `PROVIDER_NOT_FOUND` | 404 | Provider is absent or safely hidden from the actor |
| `PROVIDER_MEMBER_NOT_FOUND` | 404 | Target membership is absent or hidden |
| `PROVIDER_ALREADY_EXISTS` | 409 | The account already owns a Provider when a new one cannot be created |
| `PROVIDER_VERSION_CONFLICT` | 409 | `expectedVersion` is stale |
| `PROVIDER_STATE_CONFLICT` | 409 | The requested transition is invalid in the current state |
| `PROVIDER_SUBMISSION_INCOMPLETE` | 409 | Submission blockers remain |
| `PROVIDER_MEDIA_LIMIT_EXCEEDED` | 409 | Logo, cover, image, or video limit would be exceeded |
| `PROVIDER_INVITATION_CONFLICT` | 409 | Invitation or membership invariant prevents the action |
| `PROVIDER_INVITATION_INVALID` | 410 | Invitation is expired, revoked, consumed, or otherwise unusable |
| `PROVIDER_DEPENDENCY_UNAVAILABLE` | 503 | A required owner module or external dependency is unavailable |

Error details must never contain raw invitation tokens, passwords, OTPs,
private contacts, storage identifiers, signed media URLs, or stack traces.

---

## 14. Recommended Executable Order

```text
1. Authenticate eligible Individual or Company customer
2. Create Provider Application
3. Replace Profile
4. Replace Private Contacts
5. Replace Logo
6. Replace Cover
7. Add Gallery Image (repeat until at least 3 READY images)
8. Get Completion
9. Get Readiness
10. Protected Preview
11. Submit Application
12. Authenticate as Staff Admin
13. List Applications Queue
14. Get Application Dossier
15. Approve, Request Changes, or Reject
16. If approved, inspect readiness; later phases complete remaining gates
```

Admin invitation onboarding is an independent branch and may be tested before
or after submission while the Provider policy permits the action.

---

## 15. Regeneration and Validation

The JSON collection is generated from repository tooling. Do not make a manual
JSON-only edit that will be lost on regeneration.

```bash
npm run postman:generate:r1-p05
npm run postman:validate
```

Swagger remains the source of truth for exact runtime schemas and response
contracts:

```text
Local Swagger: {{localBaseUrl}}/docs
Hosted Swagger: {{hostedBaseUrl}}/docs
```

The generated collection must contain two environment folders, each with the
same 41 operations and the same method/path parity as the R1-P05 OpenAPI
document.
