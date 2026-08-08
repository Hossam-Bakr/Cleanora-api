# Customer Self-Service Contract — R1-P04

## Actor

Authenticated customer principal from trusted `AuthenticationPrincipal`.
Authorization uses FR-028 families only. No customer role grant and no
role-derived customer permission is required or checked.

## Base path

`/api/v1/customers`

All routes require authentication. Controllers are thin; Zod validates input;
`customers` services own workflows.

## Endpoint families

### Profiles

| Method | Path | Family | Behavior |
|---|---|---|---|
| GET | `/profiles/individual` | Category profile | Return profile or explicit not-created |
| PUT | `/profiles/individual` | Category profile | Upsert `{ fullName }` |
| GET | `/profiles/company` | Category profile | Return or not-created |
| PUT | `/profiles/company` | Category profile | Upsert `{ companyName, representativeFullName }` |
| GET | `/profiles/engineer` | Category profile | Return or not-created |
| PUT | `/profiles/engineer` | Category profile | Upsert `{ fullName, professionalTitle }` |

Rejected unapproved fields fail validation without partial writes.

### Profile image (identity-wide; DEC-033 Cloudinary)

| Method | Path | Family | Behavior |
|---|---|---|---|
| GET | `/profile-image` | Shared image | Authorized **signed Cloudinary URL** + safe metadata (`profileImage { mediaId, url, urlExpiresAt, associationVersion, contentType?, width?, height? }`), or one explicit safe absence response. Never returns storage key, `public_id`, or credentials. Successful GET emits no personal-content business audit (FR-035). |
| PUT | `/profile-image` | Shared image | **Multipart** upload: required fields `file` (single image ≤5 MiB) and `expectedAssociationVersion`. Multer `memoryStorage` + Sharp WebP normalization + Cloudinary always-replace. Returns canonical customer profile aggregate including new `profileImage` signed URL. CAS on `image_association_version`; stale → conflict. |
| DELETE | `/profile-image` | Shared image | Requires `expectedAssociationVersion`. Clear association first; prior media → `PENDING_DELETE` + async cleanup. Prior association preserved on failure. |

### Contact state (read-only projection)

| Method | Path | Family | Behavior |
|---|---|---|---|
| GET | `/contact-state` | Contact/preferences/privacy | Safe phone/email presence + verified/unverified/absent labels from identity facts |

Must not accept body fields that mutate phone/email/verification.

### Preferences

| Method | Path | Family | Behavior |
|---|---|---|---|
| GET | `/preferences` | Contact/preferences/privacy | Language unset/AR/EN + optional SMS/push booleans; mandatory notices described as non-disableable policy |
| PUT | `/preferences` | Contact/preferences/privacy | DEC-032 full replacement: require current `version`, `language` (`AR`/`EN`/`null` where null = explicit unset), and all four `reminders`/`promotional` SMS/push booleans. Omitted fields rejected. No partial merge or silent defaults. Success increments version; stale version conflicts and preserves prior state. |

### Addresses

| Method | Path | Family | Behavior |
|---|---|---|---|
| GET | `/addresses` | Shared addresses | Peer list; no default/primary flag |
| POST | `/addresses` | Shared addresses | Body uses `countryCode`; resolve to active Country; persist `country_id` only; `version` starts at 1 |
| GET | `/addresses/{id}` | Shared addresses | Owned read |
| PUT | `/addresses/{id}` | Shared addresses | Requires current `version`; success increments by 1 |
| DELETE | `/addresses/{id}` | Shared addresses | Requires current `version`; stale → conflict |

Geo attributes rejected by schema. Unknown/inactive `countryCode` → stable
validation error.

### Privacy requests

| Method | Path | Family | Behavior |
|---|---|---|---|
| POST | `/privacy-requests` | Contact/preferences/privacy | Submit purpose; return existing active request if present |
| GET | `/privacy-requests` | Contact/preferences/privacy | Owned list excluding `purge_after <= now` |
| GET | `/privacy-requests/{privacyRequestId}` | Contact/preferences/privacy | Owned track; expired terminal rows absent |
| POST | `/privacy-requests/{privacyRequestId}/cancel` | Contact/preferences/privacy | Cancel only PENDING (before processor claim); sets terminal timestamps + `purge_after`; `processor_id`/`processing_at` remain null |

Responses expose FR-047 metadata only. Outcome codes are never customer-supplied
free text.

## Ownership and denial rules

- Resource owner is always `principal.userId`.
- Client-supplied owner IDs are ignored or rejected.
- Cross-customer access → ownership-safe denial without protected payload.
- Ineligible category/status → deterministic forbidden/ineligible denial.
- Unauthenticated → unauthenticated denial.

## Success envelope

Follow `docs/standards/api-response-and-errors.md`. Mutations return resulting
safe state or stable acknowledgement (FR-044).

## Audit

Successful FR-033 mutations emit Admin transactional general-audit evidence
inside the customers transaction (audit failure rolls back). Ordinary successful
GETs do not require personal-data business audit rows. Security-relevant denials
may use the safe non-transactional Admin writer.
