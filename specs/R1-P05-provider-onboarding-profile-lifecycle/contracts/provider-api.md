# Provider HTTP API Contract

**Base**: `/api/v1`  
**Envelope authority**: `docs/standards/api-response-and-errors.md`  
**Public Browse**: absent in R1-P05

## Common rules

- Authenticated routes use the existing trusted access principal. Resource ids,
  actor ids, membership, Staff status, category, kind, lifecycle, completion,
  and readiness are server-authoritative.
- Success is `{ success: true, data, requestId, meta? }`.
- Failure is `{ success: false, error: { code, message, details? }, requestId }`.
- JSON objects are strict; unknown fields are rejected.
- Mutable commands carry integer `expectedVersion >= 1`. Stale writes return
  409 `PROVIDER_VERSION_CONFLICT` and no partial mutation.
- Raw invitation tokens appear only in TLS request bodies. They are redacted
  before logs/audit and never returned after invitation creation.
- Unauthorized cross-provider access uses the same safe not-found/forbidden
  contract and never reveals whether another Provider exists.
- Private contact DTOs and contact-free preview DTOs are separate types.

## Core DTOs

### `ProviderSummary`

```text
id, providerKind, applicationStatus, operationalStatus, version,
actorRelationship: APPLICATION_OWNER | OWNER | ADMIN,
displayNameAr?, displayNameEn?, completionPercentage,
createdAt, updatedAt
```

### `ProviderPrivateAggregate`

Contains `ProviderSummary`, authoritative private applicant context, editable
profile, private contact state/value for authorized actors, media usage, latest
review decision, membership capability flags, completion, readiness, and next
action. Staff dossier adds complete review cycles/history. It never contains
storage keys, raw tokens, password/OTP/session data, tax/document claims, or
future-phase data.

### `ProviderPreview`

Allowlisted fields only:

```text
providerId, providerKind, displayNameAr, displayNameEn,
descriptionAr, descriptionEn, countryCode,
logo?, cover?, gallery[]
```

It never contains email, phone, WhatsApp, social, website, external-booking,
applicant legal/private names, members, invitations, review reasons, audit, or
storage identifiers.

### `ProfileCompletion`

```text
policyVersion: "r1-p05-v1"
percentage: 0..100
checks: [{ code, satisfied }]
missingRequirementCodes: string[]
```

The ten stable codes are the ones locked in `spec.md`; each contributes 10.

### `MarketplaceReadiness`

```text
gates: [{
  key, applicable,
  status: SATISFIED | NOT_REQUIRED | NOT_STARTED | BLOCKED,
  satisfied, blockerCodes[], owningPhase
}]
eligibleForPublicBrowse: false
```

## Provider endpoints

### `POST /providers`

Creates the caller's one Provider/application or safely returns an identical
existing draft.

Body:

```json
{ "providerKind": "INDIVIDUAL_TEAM" }
```

`REGISTERED_COMPANY` is the other value. The server rechecks active identity,
matching verified category, and matching Customer profile. Success is 201 on
creation or 200 on identical retry. A different requested kind against an
existing Provider is 409.

### `GET /providers`

Lists bounded Providers accessible as Application Owner, active OWNER, or active
ADMIN. Cursor order is `updatedAt DESC, id ASC`; default limit 20, max 100.

### `GET /providers/{providerId}`

Returns the private aggregate after exact application-owner/membership/Staff
scope resolution.

### `PATCH /providers/{providerId}/kind`

Body: `{ providerKind, expectedVersion }`. Application Owner only, `DRAFT`, and
`firstSubmittedAt == null`. The matching current category/profile is rechecked.

### `PUT /providers/{providerId}/profile`

Full replacement body:

```json
{
  "displayNameAr": "...",
  "displayNameEn": null,
  "descriptionAr": "...",
  "descriptionEn": null,
  "countryCode": "EG",
  "expectedVersion": 3
}
```

Required fields may be temporarily blank only while a draft is editable, but
trimmed blank never satisfies completion/submission. Accepted country must be
active. Post-approval permitted edits keep application `APPROVED`.

`GET /providers/{providerId}/profile` returns the same authorized editable
profile shape without private contacts or applicant identity text.

### `GET /providers/{providerId}/contacts`

Authorized Application Owner, active OWNER/ADMIN, or Staff Admin only. Returns
operational email/phone and structured optional private channels. This DTO is
never embedded in preview.

### `PUT /providers/{providerId}/contacts`

Full replacement body:

```json
{
  "operationalEmail": "ops@example.com",
  "operationalPhone": "+201000000000",
  "channels": [
    { "type": "WHATSAPP", "value": "+201000000000" },
    { "type": "WEBSITE", "value": "https://example.com" }
  ],
  "expectedVersion": 4
}
```

Channel types are `WHATSAPP`, `SOCIAL`, `WEBSITE`, and `EXTERNAL_BOOKING`.
Values are type-validated and private.

### Media endpoints

`GET /providers/{providerId}/media` returns slot/gallery references, purpose, position,
processing status, safe metadata, and short-lived signed delivery/thumbnail
URLs for authorized actors.

Uploads use multipart `file` and `expectedVersion`:

- `PUT /providers/{providerId}/media/logo`
- `PUT /providers/{providerId}/media/cover`
- `POST /providers/{providerId}/media/gallery-images`
- `POST /providers/{providerId}/media/gallery-videos`

Images accept JPEG/PNG/WebP <=5 MiB and normalize to the locked dimensions.
Videos accept MP4/WebM <=40 MiB and <=1920x1080. Duration is not rejected.
Successful new gallery items return 201; slot replacement returns 200.

`PUT /providers/{providerId}/media/gallery-order` body:

```json
{ "orderedGalleryItemIds": ["..."], "expectedVersion": 8 }
```

The array must contain every current gallery item exactly once.

Deletion uses `DELETE /providers/{providerId}/media/logo`,
`DELETE /providers/{providerId}/media/cover`, or
`DELETE /providers/{providerId}/media/gallery/{galleryItemId}` with body
`{ expectedVersion }`. Required READY submission media may be removed in an
editable/post-approval management state; completion/readiness immediately
recalculate and approval remains `APPROVED`.

### Read projections

- `GET /providers/{providerId}/completion`
- `GET /providers/{providerId}/readiness`
- `GET /providers/{providerId}/history?cursor&limit`
- `GET /providers/{providerId}/dashboard`
- `GET /providers/{providerId}/settings`
- `GET /providers/{providerId}/preview`

Settings returns capability/status cards, not a generic mutable object:

```text
accountSecurity
profile { complete, canEdit, href }
privateContacts { configured, canView, canEdit, href }
media { usage, canEdit, href }
members { activeAdminCount, pendingInvitationCount, canManage, href }
statusHistory { applicationStatus, operationalStatus, href }
privacy { directContactVisibleToCustomers: false }
notifications { mandatoryReviewEmails: true,
                optionalPreferencesAvailable: false }
```

It does not repeat contact values; authorized actors use the contacts endpoint.

### `POST /providers/{providerId}/application/submit`

Body: `{ expectedVersion }`. Application Owner only. Valid from `DRAFT` or
`CHANGES_REQUESTED`; all blockers are returned together on 409
`PROVIDER_SUBMISSION_INCOMPLETE`. Success creates exactly one review cycle and
sets `PENDING_REVIEW`. A matching retry returns the existing cycle without
creating another.

## Members and invitation endpoints

### `GET /providers/{providerId}/members`

OWNER only. Returns OWNER and ADMIN safe membership metadata/status. No account
email/phone is exposed beyond what is needed for owner management; invitation
email is shown only in its separate OWNER-only list.

### `DELETE /providers/{providerId}/members/{userId}`

Body: `{ expectedVersion }`. OWNER may soft-disable ADMIN only. OWNER cannot
disable self/OWNER. Global `provider_admin` is disabled only if the target has
no other active Provider authority.

### Invitation management

- `GET /providers/{providerId}/admin-invitations?cursor&limit&status`
- `POST /providers/{providerId}/admin-invitations`
- `POST /providers/{providerId}/admin-invitations/{invitationId}/resend`
- `POST /providers/{providerId}/admin-invitations/{invitationId}/revoke`

Create body: `{ email, expectedVersion }`. Resend/revoke body:
`{ expectedVersion }`. OWNER and approved Provider required. Create/resend
returns 202 safe invitation metadata and immediate delivery state, never the
token. `DELIVERED` means the post-commit one-shot send succeeded;
`RESEND_REQUIRED` means only a safe failure marker was stored and the OWNER must
explicitly resend, which rotates the token and expiry. There is no durable retry
of the same raw invitation token. Expiry is exactly 72 hours from the latest
send attempt.

### Token-holder flow

`POST /provider-admin-invitations/inspect`

Body: `{ token }`. Returns safe Provider display, masked invited email, expiry,
status, and next action. Invalid/terminal tokens share one safe error.

`POST /provider-admin-invitations/onboarding/start`

Body: `{ token, phone, password }`. For an unknown invited email only. The
server fixes the email from the invitation and creates no customer category.
Returns an email-verification challenge; OTP is never returned.

`POST /provider-admin-invitations/onboarding/verify-email`

Body: `{ token, challengeId, code }`. Providers revalidates the invitation and
Authentication verifies the challenge bound to the fixed email. It returns a
restricted authenticated onboarding principal bound to this invite; that
principal may call only acceptance and session cleanup. No Provider authority
or full account capability is granted yet.

`POST /provider-admin-invitations/accept`

Authenticated body: `{ token }`. The user's verified normalized email must
match. Success atomically consumes the invitation, creates/reactivates ADMIN
membership, and enables `provider_admin` exactly once. Matching repeated calls
return the accepted result; expired/revoked/replaced/mismatched/replayed tokens
create no authority.

## Staff Admin endpoints

Staff endpoints require active identity and the named seeded permission.

### `GET /staff/providers/applications`

Query:

```text
status?, providerKind?, submittedFrom?, submittedTo?, cursor?, limit?
```

Default order is `lastSubmittedAt ASC, id ASC`; default limit 20/max 100. The
cursor encodes both sort fields. Results contain queue-safe summaries and no
direct contacts.

### `GET /staff/providers/applications/{providerId}`

Returns the private dossier: authoritative Individual/Company identity context,
private contacts, profile/media, completion/readiness, all review cycles and
status history, without storage keys or invitation secrets.

### Review commands

- `POST /staff/providers/applications/{providerId}/approve`
- `POST /staff/providers/applications/{providerId}/request-changes`
- `POST /staff/providers/applications/{providerId}/reject`

Approve body: `{ expectedVersion }`. Other bodies:
`{ reason, expectedVersion }`, with trimmed reason length 1–2000.

Approve atomically creates the complete ownership/category/role/member/history/
audit/outbox outcome and leaves operational status `INACTIVE`. Request changes
reopens only Application Owner editing. Reject is terminal and creates no
Provider authority.

### Operational commands

- `POST /staff/providers/{providerId}/suspend`
- `POST /staff/providers/{providerId}/reinstate`

Body: `{ reason, expectedVersion }`. Suspension blocks operating/public
eligibility while management/remediation remains available. Reinstatement in
R1-P05 always returns `INACTIVE`, never `LIVE`.

## Stable error catalog

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | strict Zod/multipart/input failure |
| 401 | `AUTHENTICATION_REQUIRED` | no usable authenticated principal |
| 403 | `PROVIDER_ELIGIBILITY_DENIED` | category/profile/account gate failed |
| 403/404 | `PROVIDER_ACCESS_DENIED` | ownership/scope-safe denial |
| 404 | `PROVIDER_NOT_FOUND` | safe absence in authorized context |
| 409 | `PROVIDER_ALREADY_EXISTS` | conflicting second Provider/kind |
| 409 | `PROVIDER_VERSION_CONFLICT` | stale expectedVersion |
| 409 | `PROVIDER_STATE_CONFLICT` | illegal application/operational transition |
| 409 | `PROVIDER_SUBMISSION_INCOMPLETE` | details contain all missing requirement codes |
| 400 | `PROVIDER_REASON_REQUIRED` | missing/blank required Staff reason |
| 400/409 | `PROVIDER_MEDIA_INVALID` | content/size/dimension/processing failure |
| 409 | `PROVIDER_MEDIA_LIMIT_EXCEEDED` | fixed slot/gallery limit exceeded |
| 409 | `PROVIDER_INVITATION_CONFLICT` | active duplicate/state race |
| 400/410 | `PROVIDER_INVITATION_INVALID` | invalid/expired/revoked/replaced/consumed token |
| 403 | `PROVIDER_INVITATION_EMAIL_MISMATCH` | authenticated email proof failed |
| 404 | `PROVIDER_MEMBER_NOT_FOUND` | safe target absence |
| 503 | `PROVIDER_DEPENDENCY_UNAVAILABLE` | safe media/email/config dependency failure |

Unexpected failures use the repository standard safe internal error. Error
details never include contact values, identity names, raw reasons when not
needed, storage ids, provider payloads, tokens, OTPs, credentials, SQL, or stack
traces.

## Negative surface contract

R1-P05 contains no:

- anonymous Provider collection/details route;
- customer-facing direct-contact field;
- Provider withdrawal/delete/rejected restart;
- `LIVE` command or `PAUSED` status;
- document/payout/worker/service/coverage/capacity/eligibility mutation;
- generic settings mutation;
- optional review-notification preference;
- Provider ownership transfer or second owned Provider.
