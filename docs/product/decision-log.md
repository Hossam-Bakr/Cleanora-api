# Cleanora â€” Decision Log

> This file records approved project decisions that clarify delivery timing or terminology.
> It does not silently rewrite locked product behavior in `vision.md`.

---

## DEC-001 â€” Three-release delivery model

**Date:** 2026-07-23
**Status:** Approved

The product will be delivered through three releases:

1. Release 1 â€” Core Marketplace
2. Release 2 â€” Marketers & Growth
3. Release 3 â€” Smart Marketplace

Bassam's P0â€“P5 labels remain useful as historical product prioritization, but the implementation roadmap uses these three releases.

---

## DEC-002 â€” Release 1 is a large end-to-end marketplace

**Date:** 2026-07-23
**Status:** Approved

Release 1 contains the complete normal marketplace journey:

- Identity
- Provider and worker management
- Catalog
- Standard Browse
- Booking
- Deposit
- Order execution
- Completion code
- Basic panic/emergency
- Money closure
- Ratings/reviews
- Notifications
- Support
- Admin/operations controls

A real user must be able to complete the journey without manual database edits.

---

## DEC-003 â€” No internal Cleanora wallets

**Date:** 2026-07-23
**Status:** Approved

Cleanora will not hold reusable customer, provider, or marketer balances.

Allowed:

- External mobile-wallet number
- Bank/card payout destination
- Gateway payout account
- Provider or marketer due
- Settlement and payout records

Not allowed:

- Stored-value user wallet
- Reusable in-platform balance
- Wallet top-up or wallet transfer feature

Any source-document reference to a provider or marketer â€œwalletâ€‌ must be interpreted as an external payout method unless product explicitly changes this decision.

---

## DEC-004 â€” Maps and WebSockets are deferred to Release 3

**Date:** 2026-07-23
**Status:** Approved

Release 1 uses normal REST APIs and textual/configured coverage areas.

Release 1 excludes:

- Map pin
- Latitude/longitude
- Radius matching
- WebSockets
- Live offers
- Live team tracking
- Admin live map

These remain part of the product vision and are delivered in Release 3.

---

## DEC-005 â€” Eligibility engine is built in two versions

**Date:** 2026-07-23
**Status:** Approved

Release 1 implements Eligibility Engine V1 using:

- Service
- Provider status
- Textual coverage
- Availability
- Crew gender
- Capacity and team rules

Release 3 extends the same domain into V2 using:

- Coordinates
- Zone geometry
- Radius
- Distance
- Real-time candidate distribution
- Smart ranking inputs

The engine must not be duplicated.

---

## DEC-006 â€” Money closure moves into Release 1

**Date:** 2026-07-23
**Status:** Approved

Although Bassam's phased delivery separates P0 trust and P1 money closure, the approved Release 1 includes:

- Deposit
- Immutable financial records
- COD cash confirmation
- Online provider dues
- Provider settlements
- Refund/adjustment foundation
- Reconciliation

This is required for an end-to-end production release.

---

## DEC-007 â€” Marketers and Premium are Release 2

**Date:** 2026-07-23
**Status:** Approved

Release 2 includes:

- Marketer accounts and activation fee
- Referral links and attribution
- Commission engine
- Marketer reporting
- Marketer settlement
- Fraud/admin controls
- Premium provider listing and rank boost

Coupons are excluded until their stacking and accounting rules are approved.

---

## DEC-008 â€” Basic ratings and reviews are Release 1

**Date:** 2026-07-23
**Status:** Approved

Release 1 supports:

- Provider rating
- Assigned-team rating
- Written review
- One review per completed order
- Aggregate score

Advanced dimensions, edit windows, publication rules, and richer moderation remain open or later.

---

## DEC-009 â€” Panic core is Release 1; live location is Release 3

**Date:** 2026-07-23
**Status:** Approved

Release 1 provides emergency state, alerts, dossier, audit, and controlled clearing.

Release 3 adds:

- Consent-based live location
- Realtime emergency updates
- Live map visualization

---

## DEC-010 â€” Admin control is split by dependency

**Date:** 2026-07-23
**Status:** Approved

Release 1 includes all admin actions that do not require maps or marketer modules.

Release 2 adds marketer and premium administration.

Release 3 adds live map and realtime operations.

---

## DEC-011 â€” Google sign-in is part of complete authentication

**Date:** 2026-07-23
**Status:** Approved product addition

Google sign-in is included in Release 1 authentication.

It does not replace the actor-specific verification rules. Required phone or email verification still applies based on account type.

---

## DEC-012 â€” Cleanora is a standalone greenfield project

**Date:** 2026-07-23
**Status:** Approved

Cleanora is implemented as a completely standalone project.

It has its own:

- Repository
- Application architecture
- Master ERD
- Prisma schema
- Migration history
- Seed data
- Modules
- APIs
- Tests
- Documentation
- Deployment configuration

There is no external application, repository, schema, migration history, or production dataset that Cleanora must read, preserve, import, migrate, or remain compatible with.

Rules:

- Design every domain from the approved Cleanora vision and roadmap.
- Create the Cleanora Prisma schema incrementally, phase by phase.
- Create Cleanora migrations from the first project migration onward.
- Do not add compatibility tables, compatibility fields, adapters, imports, or migration scripts for an unavailable system.
- Do not refer to unavailable repositories or undocumented external code.
- All implementation instructions must be executable using the Cleanora repository alone.
- Every dependency on an external service must be explicitly documented and configured.

The rule is:

> Cleanora must be understandable, buildable, testable, and deployable from its own repository and documentation only.


---

## DEC-013 â€” Product sources remain traceable

**Date:** 2026-07-23
**Status:** Approved

Bassam's four documents remain unchanged source references.

`vision.md` is the consolidated canonical implementation vision.

`decision-log.md` records approved timing and terminology decisions.

`roadmap.md` controls delivery order.

`open-questions.md` blocks invention.

---

## DEC-014 â€” Prisma schema and migrations evolve phase by phase

**Date:** 2026-07-23
**Status:** Approved

R1-P00 creates the Master ERD and database conventions, but does not fully create every release table.

Every later phase owns its required Prisma work:

- Inspect the current schema and migrations.
- Update `prisma/schema.prisma`.
- Create a clearly named phase migration.
- Review generated SQL.
- Add required constraints, indexes, seeds, and data backfills.
- Regenerate Prisma Client.
- Run database and compatibility tests.
- Document all new and changed models.

Applied production migrations must not be edited or deleted. Corrections use forward migrations.

Future-release models must not be created early without a documented dependency.

---

## DEC-015 â€” Release 1 Google sign-in is individual-only

**Date:** 2026-07-24
**Status:** Approved

Google sign-in is enabled only for `INDIVIDUAL` accounts in Release 1.

The identity architecture remains extensible for other account types, but
company, engineer, provider-owner, worker, and other audiences are not enabled
for Google authentication in R1-P02.

Google authentication and account linking never bypass required phone
verification or any actor-specific verification gate. A new or linked
individual account remains restricted until its required phone verification is
complete.

This decision resolves OQ-014.

---

## DEC-016 â€” R1-P02 temporary branch-coverage debt (not a DoD exception)

**Date:** 2026-07-25
**Status:** Approved (temporary)

For R1-P02 final quality gates, the human owner accepted the latest measured
coverage evidence without further coverage-only remediation:

- 67/67 test files and 202/202 tests passed
- Statements 90.73%, functions 88.44%, lines 91.71%
- Branches **73.8%** versus the planned **75%** threshold (8-branch gap)
- Production dependency audit: 0 vulnerabilities

This is **documented technical debt**, not a claim that the coverage gate
passed, and **not** yet a formal Definition-of-Done exception. Configured
thresholds must not be lowered or bypassed. Tasks **T099** and **T118** remain
unchecked until the owner decides whether to grant a formal DoD exception after
runtime acceptance. Coverage-only percentage-chasing tests are stopped for now.

---

## DEC-017 â€” Development-only SMS delivery redirect

**Date:** 2026-07-26
**Status:** Approved (temporary development operations)

Production verification rules remain unchanged: individual verification and
individual/worker recovery are normally delivered by SMS, while company,
engineer, and provider-owner verification and recovery use email.

While real SMS transport is unavailable, local development may redirect an SMS
delivery intent to one configured developer-owned email inbox. This redirect:

- is allowed only when `NODE_ENV=development`;
- is forbidden in test and production;
- does not prove ownership of the authoritative phone number;
- exists only for manual endpoint/runtime acceptance until a real SMS provider is connected;
- keeps email as the only temporary secret-delivery surface; and
- must be removed before production readiness.

Raw OTPs and password-reset credentials must never be written to application
logs, errors, auth events, audit context, or API responses. Production must
continue to use a real SMS delivery adapter or fail closed; it must never
silently substitute ordinary email.

---

## DEC-018 â€” Browser-safe Google callback and phone verification

**Date:** 2026-07-26
**Status:** Approved for R1-P02 implementation

Google sign-in and deliberate Google linking use one provider-registered
backend callback URI. The server-held one-time transaction records the intent;
link callbacks do not depend on a bearer token surviving cross-site browser
navigation.

The backend callback validates the correlation cookie, state, nonce, PKCE, and
one-time transaction, then redirects to an allowlisted frontend callback URI.
The frontend redirect contains only safe outcome markers. Access tokens,
refresh tokens, authorization codes, state values, and raw provider errors are
forbidden in its URL.

After a successful sign-in callback, the frontend exchanges the HttpOnly
refresh cookie through the normal refresh endpoint. A new Google individual
uses authenticated phone request and verification endpoints. Successful OTP
verification atomically verifies the identity and promotes the exact
verification-only session to full access.

---

## DEC-019 â€” Development-only Google browser result page

**Date:** 2026-07-26
**Status:** Approved (temporary development integration)

Until the Cleanora frontend exists and serves its Google callback route, local
development may redirect the completed backend callback to
`/api/v1/auth/google/result` on the API origin.

This result page:

- is registered only when `NODE_ENV=development`;
- keeps state, nonce, PKCE, provider errors, access tokens, and refresh tokens
  out of the URL and rendered output;
- exchanges the HttpOnly refresh cookie through the normal refresh endpoint;
- keeps the access token only in page memory;
- supports the mandatory Google Individual phone-verification journey; and
- must be replaced by the real frontend callback before production readiness.

Production behavior remains the DEC-018 frontend handoff. The provider still
returns only to the configured backend `GOOGLE_REDIRECT_URI`.

---

## DEC-020 â€” Descriptive API failures and practical password policy

**Date:** 2026-07-26
**Status:** Approved by human owner

Every JSON failure repeats the actual HTTP status as `error.statusCode` and
provides a stable code plus a safe descriptive message. Optional details may
name an input field and safe reason, but never include submitted values,
credentials, provider payloads, persistence details, or account records.

Public signup returns distinct `AUTH_PHONE_ALREADY_REGISTERED` and
`AUTH_EMAIL_ALREADY_REGISTERED` conflicts. This is a deliberate, limited
signup-only existence disclosure accepted for clearer frontend validation.
Login continues to use one generic phone/password failure, and
forgot-password remains indistinguishable for existing and absent accounts.

The shared password policy for signup, reset, and authenticated change is now:

- 7â€“128 characters and no more than 512 UTF-8 bytes;
- no character-class composition requirement;
- numbers-only values are permitted; and
- common values, one/repeated patterns, and ascending or descending numeric
  sequences are rejected.

---

## DEC-021 â€” Aggregate validation and explicit cookie names

**Date:** 2026-07-27
**Status:** Approved by human owner

Request validation returns every independently detectable body, parameter, and
query issue in one `REQUEST_VALIDATION_FAILED` response. Independent format and
policy checks must run at the HTTP boundary instead of failing sequentially in
the application service. Persistence conflicts and other state-dependent
business failures remain separate errors.

Authentication uses these explicit cookie names:

- `cleanora_refresh_token` for the rotating HttpOnly refresh credential; and
- `cleanora_google_oauth_state` for short-lived Google OAuth correlation.

The repository does not create `fs_refreshtoken`. Authentication responses
expire that known stale localhost name together with the earlier
`cleanora_refresh` and `cleanora_google_state` names. Legacy refresh cookies
are not treated as credentials under the canonical configuration.

---

## DEC-022 â€” Aggregate safe signup identifier conflicts

**Date:** 2026-07-27
**Status:** Approved by human owner

When a valid public signup contains both an already-registered phone and an
already-registered email, Cleanora returns one
`409 AUTH_SIGNUP_IDENTIFIERS_ALREADY_REGISTERED` response with `phone` and
`email` entries in `error.details.issues`. Single-field conflicts retain their
existing stable codes.

This extends the human-approved signup-only disclosure from DEC-020. It returns
only field names, stable reasons, and safe messagesâ€”never submitted values,
account records, ownership relationships, or identity details. Passwords are
not unique identifiers, are never compared across accounts, and must never be
reported as duplicate.

---

## DEC-023 â€” Google phone OTP temporary email delivery

**Date:** 2026-07-27
**Status:** Approved for R1-P02 development integration

While a real SMS provider is unavailable, Google Individual phone-verification
OTPs are delivered by email to the authenticated user's linked, provider-verified
Google email stored on `SocialAccount`. This amends DEC-017 for the Google phone
path only:

- the OTP challenge remains an SMS phone challenge bound to the submitted E.164
  phone number;
- the recipient is resolved exclusively server-side from the verified Google
  identity and is never accepted from the request body;
- a fixed `AUTH_DEV_OTP_RECIPIENT` inbox is not used for this path;
- receiving the email does not prove phone ownership;
- ordinary non-Google SMS development delivery may continue to use DEC-017; and
- replacing the temporary email send with a real SMS adapter must not require
  controller or frontend contract changes.

---

## DEC-024 â€” Account-bound OTP delivery and frontend-only Google handoff

**Date:** 2026-07-27
**Status:** Approved by human owner; supersedes DEC-019 and the fixed-inbox part of DEC-017

The backend no longer renders `/api/v1/auth/google/result`. Google completes at
the backend callback, writes the secure refresh cookie, and redirects only to
the allowlisted frontend callback. The frontend bootstraps with `POST
/api/v1/auth/refresh` and `credentials: "include"`.

During local development without SMS:

- standard Individual signup phone challenges are emailed only to that user's
  normalized signup email;
- Google phone challenges are emailed only to the linked provider-verified
  Google email;
- neither recipient is accepted from client input or a fixed environment
  variable; and
- the challenge remains bound to its user, phone destination, purpose, expiry,
  attempt limit, resend policy, and single-use state.

Login, refresh, password change, Google session bootstrap, and `/auth/me` share
one frontend-safe user representation. Existing `identity` session metadata is
retained temporarily for backward compatibility.

---

## DEC-025 â€” Google presentation claims for frontend authentication

**Date:** 2026-07-28
**Status:** Approved by human owner for the R1-P02 browser integration

The authentication-owned Google social link may store the provider-asserted
display name and HTTPS avatar URL as nullable presentation claims. The safe
authenticated-user contract returns both fields, using `null` when unavailable.

These values are not access proof, are never accepted from Cleanora clients,
and do not satisfy phone verification or create an actor profile. They are
updated only from a successfully verified Google OIDC response. A local
frontend demonstration keeps the access token in memory, relies on the
HttpOnly refresh cookie, and shows only this safe user contract.

---

## DEC-026 â€” Four-digit password-reset code with opaque correlation

**Date:** 2026-07-28
**Status:** Approved by human owner

Password recovery uses a four-digit numeric code that a user can type into one
simple input. The code never acts as a global credential by itself:

- every syntactically valid forgot-password request returns a fresh opaque
  `challengeId`, whether or not the account exists;
- eligible accounts receive only the four-digit code through their
  authoritative recovery channel;
- reset requires the matching `challengeId`, `code`, and `newPassword`;
- the raw code is never persisted or logged and remains expiring, single-use,
  and attempt-limited; and
- successful reset revokes every session and requires a fresh login.

This replaces the user-facing composite `<reset-id>.<random-secret>` contract
without adding a table or migration. Swagger defaults to the Railway hosted API
and retains local development as an explicit secondary server.

---

## DEC-027 â€” Explicit hosted-preview SMS-to-email fallback

**Date:** 2026-07-28
**Status:** Approved by human owner for hosted authentication acceptance

Until a real SMS provider is connected, the Railway-hosted preview may redirect
SMS authentication intents to the server-resolved account email. This mode:

- requires `AUTH_SMS_TO_EMAIL_FALLBACK_ENABLED=true`;
- separately requires
  `AUTH_SMS_TO_EMAIL_FALLBACK_ACKNOWLEDGED=true`;
- requires authentication, email authentication, and a complete valid SMTP
  configuration;
- never accepts the fallback recipient from the OTP request body;
- displays and logs safe warnings that phone ownership is not proven;
- preserves challenge binding, HMAC-only code storage, expiry, resend,
  attempt-limit, and single-use behavior; and
- must be disabled and replaced by a real SMS provider before production
  readiness.

The local-only `AUTH_DEV_SMS_FALLBACK_TO_EMAIL` mode remains available for
development and cannot be enabled together with the hosted-preview mode.

---

## DEC-028 â€” Email-only R1-P02 authentication; phone verification deferred

**Date:** 2026-07-28
**Status:** Approved by human owner; supersedes DEC-017, DEC-023, DEC-024 phone-gate rules, and DEC-027

R1-P02 uses email as its only account-verification and password-recovery
delivery channel in local development and hosted environments:

- every supported self-signup category requires a normalized email address;
- every signup verification code and password-reset code is delivered to that
  account-bound email through the configured SMTP provider;
- phone numbers may still be collected as contact identifiers, but R1-P02 does
  not set `phoneVerifiedAt` or claim phone ownership;
- SMS adapters, SMS-to-email preview adapters, their environment flags, and the
  Google phone-verification endpoints are removed from the R1-P02 runtime;
- a new Google identity whose provider email is verified receives an active
  Individual category immediately and does not enter a phone-restricted
  session; and
- a real SMS provider, phone challenge endpoints, phone ownership verification,
  migration/backfill strategy, and launch acceptance are deferred to R1-P26.

This is a product-scope change, not a claim that email proves ownership of a
phone number. R1-P26 must define how existing unverified phone values are
verified without silently marking historical data as verified.

---

## DEC-029 â€” R1-P03A production role-provisioning boundaries

> **Supersession note (2026-08-07):** DEC-030 supersedes this entry's
> first-administrator bootstrap and customer-role provisioning clauses. Historical
> text is retained for traceability.

**Date:** 2026-08-06
**Status:** Superseded by DEC-030 for bootstrap and customer-provisioning clauses; resolves OQ-015 through OQ-018

R1-P03A uses the following approved production role-provisioning rules:

- Any historical `staff_admin` grant in `ENABLED`, `DISABLED`, or `REVOKED`
  state permanently closes first-administrator bootstrap.
- Bootstrap provides no administrator-recovery path after total administrator
  loss. Any future recovery capability requires a separate owner-approved
  phase.
- The selected first-`staff_admin` target must be an existing `ACTIVE` identity,
  must not be verification-only, must have a verified email, and must have at
  least one server-confirmed verified enrolled category. No specific category
  grants staff authority.
- Authentication must reload and revalidate every first-admin target fact inside
  the same bootstrap transaction immediately before grant, permanent closure,
  and audit. Any missing or changed fact fails without grant or closure.
- Ordinary role management uses a minimal public HTTPS admin API in the
  existing backend, with no R1-P03A user interface. Trusted authentication,
  the matching R1-P03 permission and approved reason, safe errors, throttling,
  and audit protection remain mandatory.
- Assigning or enabling the `customer` role requires an `ACTIVE` target with at
  least one server-confirmed verified `Individual`, `Company`, or `Engineer`
  category.
- An authorized disable or revoke operation remains available for an existing
  `customer` grant when the target is currently ineligible, subject to the
  ordinary R1-P03 actor, reason, and transition rules.

Category and account facts are eligibility evidence only. They never derive,
select, or automatically grant a role.

---

## DEC-030 â€” Junior-friendly MVP staff-admin and customer authorization

**Date:** 2026-08-07
**Status:** Approved by human owner; supersedes DEC-029 bootstrap and customer-provisioning parts

Cleanora is a small junior-friendly MVP. Release 1 role provisioning and
customer self-service authorization are simplified accordingly.

### Staff-admin provisioning

The first and subsequent `staff_admin` grants use a temporarily enabled
owner-secret internal API:

- `POST /api/v1/internal/owner/staff-admins`
- Header: `X-Owner-Admin-Secret`
- Environment: `OWNER_ADMIN_API_ENABLED` (default `false`) and `OWNER_ADMIN_SECRET`

Rules:

- Timing-safe secret comparison; never log the secret.
- Rate limit the endpoint.
- Target must be an `ACTIVE` identity with verified email.
- Assign or re-enable `staff_admin` only; no other role through this path.
- Idempotent; atomic audit with fixed reason `owner_staff_admin_provision`.
- No Admin UI for this path.

Ordinary authenticated staff-admin role management continues through the
existing R1-P03 HTTPS API for non-`customer` roles.

### Customer self-service (R1-P04)

R1-P04 customer profile and preference self-service authorizes callers through
the trusted `AuthenticationPrincipal` plus `SELF` ownership. **No `customer` role
grant is required** for Release 1 customer self-service. Customer self-service
MUST NOT require `resource.self.read`, `resource.self.write`, or any other
R1-P04 customer permission derived from role grants.

R1-P04 access rules:

- Category profile data requires an ACTIVE identity, a matching verified
  enrolled category, and `SELF` ownership.
- Shared image and address data require an ACTIVE identity, at least one
  verified enrolled category, and `SELF` ownership.
- Contact, preference, and privacy data require an ACTIVE identity enrolled in
  a supported customer category and `SELF` ownership; pending-only enrolled
  categories remain allowed for this family.
- Suspended, banned, and deactivated identities are denied.
- Losing eligibility suspends access without deleting stored data.
- Historical presence or absence of a `customer` role grant is irrelevant.

### Superseded complexity

The earlier signed-envelope bootstrap (Ed25519 envelopes, permanent closure,
authorization-use tracking, six-class observed-attempt matrix) and explicit
customer-role provisioning decisions in DEC-029 are superseded for Release 1.

The applied R1-P03 role catalog may retain a historical `customer` role entry.
Release 1 must not require granting that role for customer self-service or
ordinary marketplace participation.

---

## DEC-031 â€” R1-P04 planning authority, outcomes, and retention

**Date:** 2026-08-07
**Status:** Approved by human owner during R1-P04 technical-planning repair

Closes the material planning questions left open by the independent R1-P04
technical-planning review (`CHANGES REQUIRED`).

### Privileged privacy reassignment authority

Only the existing role `staff_admin` receives permission
`privacy.requests.reassign`.

- `staff_support`, `staff_operations`, `staff_finance`, provider roles, workers,
  and customers receive no reassignment authority.
- Minimum-authority rationale: R1-P04 has no privacy staff workflow or UI;
  broader delegation requires a future explicit requirement.
- Deny by default when the permission mapping is absent or disabled.

Authentication catalog design (additive in the future R1-P04 migration only):

| Field | Value |
|---|---|
| Permission | `privacy.requests.reassign` |
| Role mapping | `staff_admin` only |
| Protected operation ID | `customers.privacy.requests.reassign` |
| PrivilegedActionOperation | `PRIVACY_REQUEST_REASSIGN` |
| Reason code | `privacy_request_reassign` (valid only for that operation) |
| Ownership | `NONE` |
| Scope | `GLOBAL` |
| Privileged | `true` |
| Public HTTP | `false` |

### Closed privacy outcome catalog

| Terminal status | Required outcome code |
|---|---|
| `COMPLETED` | `REQUEST_FULFILLED` |
| `REJECTED` | `REQUEST_REJECTED` |

No free-form rationale. No other outcome code is accepted in R1-P04. More
detailed codes require a future explicit product decision.

### Retention configuration

- Exact environment variable: `PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS`
- Positive integer only; no built-in or silent default
- Missing or invalid value fails R1-P04 readiness only (customers runtime probe)
- Expired terminal requests disappear from customer reads immediately
  (`purge_after <= now`)
- Physical purge: simple bounded customers-owned sweep at startup and every hour
- No queue, broker, cron platform, generic job engine, or workflow framework
- Admin audit rows remain separately governed and are never purged by this sweep

---

## DEC-032 â€” R1-P04 preference PUT full-replacement semantics

**Date:** 2026-08-07
**Status:** Approved by human owner during R1-P04 technical-planning re-review repair

Closes the preference PUT completeness question raised by independent
technical-planning re-review.

`PUT /api/v1/customers/preferences` is a full replacement of the accepted
preference matrix:

- `version` is required (current accepted version; success increments by 1).
- `language` is required and must be `AR`, `EN`, or `null`; `null` means
  explicit unset.
- `reminders.sms`, `reminders.push`, `promotional.sms`, and
  `promotional.push` are all required booleans.
- Omitted fields are rejected as validation failures.
- No partial merge and no silent defaults on omitted fields.
- FR-018 still applies: the update either commits as one complete accepted set
  or leaves the prior set unchanged (including stale-version conflict).

---

## DEC-033 â€” R1-P04 Cloudinary profile-image storage (always replace)

**Date:** 2026-08-07
**Status:** Approved by human owner during R1-P04 implementation-repair authorization

Supersedes R1-P04 local-filesystem profile-image storage (`MEDIA_STORAGE_ROOT`)
and any earlier duplicate-image / content-hash directions for customer profile
images.

### Scope

- Customer profile images only in R1-P04.
- No videos, PDFs, service-provider gallery, or AWS S3 runtime in R1-P04.
- Keep a small provider abstraction so S3 can be added later.

### Storage and processing

1. Cloudinary replaces local filesystem storage for R1-P04 customer profile images.
2. Multer `memoryStorage` accepts exactly one profile image, maximum 5 MiB.
3. Sharp validates, auto-orients, resizes, strips metadata, and compresses before
   Cloudinary upload.
4. Normalized Cloudinary input format is WebP.
5. Cloudinary stores already-optimized Sharp output; no additional lossy incoming
   transformation.
6. Every accepted upload always replaces the current image.
7. No content hash, duplicate comparison, or Cloudinary duplicate lookup.
8. Each replacement uses a new opaque Cloudinary `public_id`.
9. Cloudinary upload/delete never occurs inside a Prisma transaction.
10. The existing image is never removed before the new upload and atomic
    association succeed.
11. The API returns the updated customer-profile representation including the new
    authorized image URL and association version.
12. Profile images remain protected. Return an authenticated/signed Cloudinary URL
    only after SELF/category authorization succeeds.
13. Do not expose Cloudinary `public_id`/storage key or API credentials.
14. Previous asset deletion is durable and asynchronous; it must not delay the
    successful API response.
15. `MEDIA_STORAGE_PROVIDER` is the single provider selector.
16. Current implemented provider is `cloudinary`.
17. A future `s3` value remains unsupported in R1-P04 and fails readiness clearly.
18. `MEDIA_STORAGE_ROOT` and local filesystem storage are removed.
19. Video/PDF/provider media remain outside R1-P04.

---

## DEC-034 â€” Category-aware customer signup and contact verification

**Date:** 2026-08-09
**Status:** Approved by human owner; supersedes DEC-028 for the behavior below

R1-P04A restores actor-specific verification while preserving one identity and
the completed R1-P04 profile ownership model.

### Signup and category profile invariant

- Individual signup requires `fullName`.
- Company signup requires `companyName` and `representativeFullName`.
- Engineer signup requires `fullName` and `professionalTitle`.
- Phone, email, password, and category remain required for these password-based
  customer signups.
- Identity, credential, matching customer profile, and initial challenge have
  all-or-nothing observable creation semantics.
- Category enrollment for these customer categories collects the same matching
  profile fields before activation.
- Provider Owner remains an email-verified non-customer signup and creates no
  customer profile in R1-P04A.

### Contact verification

- Individual category activation is blocked by a six-digit SMS OTP to the
  authoritative phone. Success sets phone assurance only.
- Company and Engineer category activation remain blocked by a six-digit email
  OTP. Success sets email assurance only.
- A verified Individual completes email verification from the authenticated
  account.
- A verified Company or Engineer completes phone verification by SMS from the
  authenticated account.
- Contact-verification targets are server-resolved from the authenticated
  identity; callers do not submit a user ID or destination.
- Twilio Programmable Messaging is the first runtime SMS adapter behind a
  replaceable Authentication delivery port. Tests use deterministic fakes.

### Individual email grace and order restriction

- Successful Individual phone activation records one deadline exactly 15
  consecutive 24-hour periods after verification.
- Before the deadline, unverified email does not block order creation.
- At the deadline instant and after it, unverified email denies order creation
  with `INDIVIDUAL_EMAIL_VERIFICATION_OVERDUE`.
- This is an order-only restriction. The identity stays ACTIVE; login, account
  access, and email verification remain available.
- Successful email verification removes the restriction immediately.
- The backend derives eligibility from authoritative timestamps and server time;
  no background suspension job or client-calculated decision is authoritative.

### Company regulatory profile completion

- `commercialRegistrationNumber` and `taxRegistrationNumber` are nullable,
  owner-private Company profile fields.
- They are omitted from signup and completed or updated from the authenticated
  Company account.
- Existing Company profiles remain null; no regulatory value is invented or
  backfilled.

### Preserved boundaries

- Existing applied migrations remain immutable; R1-P04A owns a forward-only
  migration.
- R1-P04 profile authorization/audit rules continue to apply.
- No Company document upload, government validation, provider onboarding,
  Orders module implementation, deployment, production migration, or Git action
  is authorized by this decision.

---

## DEC-035 â€” Email-only R1-P04A activation; SMS deferred

**Date:** 2026-08-10
**Status:** Approved by human owner; temporarily supersedes DEC-034 contact-verification and grace behavior

R1-P04A remains email-only during the current development phase. The future SMS
provider has not been selected, so no provider-specific or generic SMS delivery
implementation is part of the active phase.

- Individual, Company, Engineer, and Provider Owner category activation all use
  a six-digit OTP delivered to the authoritative email.
- Successful category verification sets email assurance and the verified
  category only. Phone assurance remains unset for password-based signup.
- `SMS_AUTH_ENABLED` defaults to and must remain `false`. Setting it to `true`
  fails startup with a safe configuration diagnostic.
- No Twilio variables, SMS adapter, phone-verification endpoint, phone CTA,
  Individual email deadline, or order-creation grace restriction is active now.
- Category-specific signup names and Company post-signup regulatory identifiers
  remain in R1-P04A scope.

The intended future behavior is retained as product direction, not current
implementation: Individual will eventually activate by phone then receive a
15-day email-verification grace; Company and Engineer will continue to activate
by email and may verify phone from the profile. Provider selection, persistence,
API contracts, migration, assurance transitions, and rollout belong to a later
explicitly approved phase.

Commit, push, deployment, production migration, and external provider actions
remain separately controlled actions.

---

## DEC-036 â€” Application-based provider ownership and kind-specific readiness

**Date:** 2026-08-10
**Status:** Approved and Complete â€” implementation, independent review PASS
(T158), and human completion authorization (T159) recorded 2026-08-11; R1-P06
subsequently activated for specification preparation only on 2026-08-13; no
deployment or production migration

This decision activates R1-P05 for specification preparation and supersedes
the direct Provider Owner signup and self-enrollment direction in DEC-034 and
DEC-035. It does not alter R1-P04A's historical delivered behavior; the runtime
change belongs to the separately authorized R1-P05 implementation workflow.

**Completion note (2026-08-11):** R1-P05 tasks T001â€“T159 are checked with
evidence in
`specs/R1-P05-provider-onboarding-profile-lifecycle/completion-report.md`.
Independent review returned PASS and the human owner approved completion.

### Provider identity and kinds

- A Provider is the marketplace supply entity. `COMPANY` remains a customer
  identity category and is not itself the Provider record.
- Only a verified `INDIVIDUAL` with its matching profile or a verified
  `COMPANY` with its matching profile may apply in R1-P05. `ENGINEER` is not
  eligible.
- A verified Individual applies as `INDIVIDUAL_TEAM`; a verified Company
  applies as `REGISTERED_COMPANY`. A user holding both eligible categories
  chooses one kind for the initial draft.
- Provider kind may change only in the never-submitted initial `DRAFT`; it is
  immutable after first submission.
- One user may own at most one Provider. Provider-admin membership never grants
  ownership.
- `PROVIDER_OWNER` is removed from public self-signup and ordinary category
  self-enrollment. It remains an internal verified category granted only by
  staff approval.
- A legacy user holding only `PROVIDER_OWNER` must first enroll and verify an
  eligible Individual or Company category and complete its matching profile.

### Application review and operational lifecycle

- Application status is separate from operational and document-verification
  status. The application states are `DRAFT`, `PENDING_REVIEW`,
  `CHANGES_REQUESTED`, `APPROVED`, and terminal `REJECTED`.
- `CHANGES_REQUESTED` returns to editable draft and may be resubmitted without
  erasing prior review cycles. There is no withdrawal, hard deletion, or
  rejected-application resubmission in R1-P05.
- The application creator acts as the draft-scoped `Application Owner` before
  approval. This grants only application, profile, private-contact, media,
  submission, and resubmission rights while the application is editable; it is
  not Provider membership, ownership authority, or global provider-admin
  authority.
- Application, profile, private-contact, and media changes are locked while
  `PENDING_REVIEW`. Provider memberships and admin invitations are unavailable
  before approval.
- Only an active `staff_admin` may list/review applications, approve, request
  changes, reject, suspend, or reinstate. Every negative or operational
  decision requires a non-empty reason, actor, and timestamp.
- Approval is an all-or-nothing business outcome: application `APPROVED`,
  verified `PROVIDER_OWNER` category, enabled global `provider_admin` role,
  active provider `OWNER` membership, status history, and privileged audit.
- Approval does not verify documents or make payout, workers, services,
  coverage, availability, capacity, operational live status, or public Browse
  ready. The approved Provider remains `INACTIVE`.
- Permitted OWNER or ADMIN profile, private-contact, and media changes after
  approval do not reset the application from `APPROVED` in R1-P05. They
  recalculate completion/readiness and preserve version and audit evidence.
  Public eligibility remains false; R1-P12 must define any moderation policy
  required after marketplace visibility begins.
- Operational states are only `INACTIVE`, `LIVE`, and `SUSPENDED`; R1-P05 has
  no `PAUSED` state and no way to bypass later-phase readiness into `LIVE`.
- Suspension blocks operational and public eligibility but preserves authorized
  OWNER/ADMIN profile, media, membership, dashboard, and remediation access.
  Staff Admin reinstatement in R1-P05 always returns the Provider to `INACTIVE`
  and never automatically restores or grants `LIVE`.

### Profile, privacy, and media

- Required common profile fields are Arabic display name and description plus
  an active configured `countryCode`; English display name and description are
  optional.
- Individual name or Company name and representative name are server-resolved
  from the matching verified customer profile for private review context, not
  trusted as caller-supplied identity facts.
- Operational email and phone are required or securely prefilled. Any WhatsApp,
  social, website, or external-booking reference is private operational/review
  data.
- No anonymous, customer-facing, or protected-preview representation exposes
  direct email, phone, WhatsApp, social, website, or external-booking data.
  R1-P05 provides a protected contact-free preview but no public Browse API;
  public Browse and Provider Details belong to R1-P12.
- Provider media allows one logo, one cover, at most 12 gallery images, and at
  most 2 gallery videos. Submission requires logo, cover, and at least 3 READY
  gallery images; videos do not satisfy that minimum.
- Each image is at most 5 MiB and accepts JPEG, PNG, or WebP. Safe normalized
  presentation sizes are 600x600 logo, 1600x600 cover, and 1200x900 gallery,
  with orientation normalization and unsafe metadata removal.
- Each video is at most 40 MiB, MP4 or WebM, and no more than 1080p. Sixty
  seconds is UX guidance, not a hard duration limit. Videos require thumbnail
  and processing state, and only READY media contributes to completeness.

### Provider membership and invitations

- R1-P05 membership levels are `OWNER` and `ADMIN` only. Workers, supervisors,
  teams, crews, and worker assignment remain R1-P07.
- Before approval, only the `Application Owner` submits/resubmits and no
  Provider OWNER or ADMIN membership exists. Approval converts the accepted
  applicant into the actual Provider OWNER through the atomic approval outcome.
- After approval, OWNER manages admins and may edit Provider content when
  permitted. ADMIN may edit profile, private contacts, and media when permitted
  and may view dashboard/readiness, but cannot submit, change kind, manage
  membership, transfer ownership, or review applications.
- Authorization requires an active identity, enabled global capability, active
  membership for the exact requested Provider, and the required membership
  level. Caller-supplied scope is never authoritative and cross-provider access
  fails closed.
- An approved Provider's OWNER may invite any valid email. Invitations do not
  exist before application approval, are single-use, expire after 72 hours, may
  be revoked, and resend invalidates prior active tokens. Only a secure token
  verifier is retained; acceptance is idempotent and concurrency safe.
- An existing user accepts after authentication and invited-email proof where
  required. A new user uses invitation-only onboarding with fixed email,
  required phone/password, and email OTP, receives no customer category
  automatically, and gains enabled `provider_admin` plus active ADMIN
  membership after acceptance.
- Terminal rejection creates no Provider membership, global provider authority,
  or admin invitation and preserves audit/history.

### Completion, readiness, dashboard, and settings

- `profileCompletion` is separate from `marketplaceReadiness`, is calculated
  server-side, and is kind-specific. Policy version 1 gives equal weight only
  to applicable required checks, floors the whole-number percentage, excludes
  optional/`NOT_REQUIRED` checks, and returns 100 only when all applicable
  checks are complete. Missing requirement codes are returned.
- R1-P05 policy version 1 has exactly ten checks worth 10 percentage points
  each: eligible verified category, complete matching customer profile, Arabic
  display name, Arabic description, operational email, operational phone,
  active country, READY logo, READY cover, and at least three READY gallery
  images. The first two are evaluated for the selected provider kind; their
  stable codes and the other eight codes are defined in the R1-P05 spec.
- Structured readiness gates expose applicability, status, satisfaction,
  blockers, and owning phase. Status concepts are `SATISFIED`, `NOT_REQUIRED`,
  `NOT_STARTED`, and `BLOCKED`.
- Gates are `profileComplete`, `applicationApproved`, `documentsVerified`,
  `payoutDestinationReady`, `workersReady`, `servicesReady`, `coverageReady`,
  `availabilityReady`, `capacityReady`, `operationalLive`, and
  `eligibleForPublicBrowse`.
- `INDIVIDUAL_TEAM` documents are `NOT_REQUIRED`, treated as satisfied, and
  excluded from denominators. `REGISTERED_COMPANY` documents remain not ready
  until R1-P06. OQ-007 controls the later configurable Company checklist and
  does not block R1-P05.
- Documents and every other later-phase readiness gate are excluded from
  `profileCompletion`. A Registered Company may complete its R1-P05 profile
  while its separate document-readiness gate remains blocked on R1-P06.
- Later-phase gates remain explicitly blocked or not started with their owning
  phase. `eligibleForPublicBrowse` remains false throughout R1-P05.
- Dashboard summary includes kind, statuses, completion, blockers, latest
  decision, media usage, admin/invitation counts, and next owner action.
- Provider settings aggregate account/security, profile, private contacts,
  media, members, status/history, privacy, and notification status. No generic
  `provider_settings` table or unstructured settings object is approved.
- Mandatory application-review email notices cannot be disabled. Optional
  provider notification preferences are deferred.

### Integrity and phase boundary

- Application/status history, privileged decisions, invitations, and
  membership mutations are auditable. Editable resources use version checks;
  duplicate application creation, approval, and invitation acceptance must be
  safe under retry and concurrency. Secrets, raw tokens, private contacts, and
  storage keys are excluded from logs.
- R1-P06 owns documents and external payout destinations; R1-P07 owns workers
  and teams; R1-P09 owns services/pricing; R1-P10 owns coverage, availability,
  and capacity; R1-P11 owns eligibility; R1-P12 owns anonymous Browse.
- The original activation run authorized canonical reconciliation,
  `activation.md`, `spec.md`, the specification checklist, feature pointer, and
  the mandatory `after_specify` hook only. The human owner subsequently
  authorized `clarify`, `plan`, `tasks`, and `analyze` with a mandatory stop
  before implementation. No product code, Prisma/schema/migration execution,
  implementation tests, Git actions, deployment, or production operations are
  authorized by that planning continuation.

---

## DEC-037 â€” Provider verification and external payout-destination baseline

**Date:** 2026-08-13
**Status:** Approved baseline; R1-P06 clarification and the authorized
documentation workflow completed analyze-clean on 2026-08-13 with an
implementation handoff prepared. Implementation, Prisma changes, migrations,
tests, database operations, Git actions, deployment, and production operations
remain separately controlled

This decision activates R1-P06 for specification preparation and resolves the
approved product baseline for Provider verification and external payout
destinations. R1-P06 collects and verifies external settlement destinations; it
does not move money, execute payouts, or create a Cleanora-held balance.

### Provider identity and applicability

- There is no `PROVIDER_OWNER` account category or global role in the approved
  product model. Provider-domain `OWNER` and `ADMIN` membership represent
  Provider ownership and administration. This supersedes DEC-036 only where
  DEC-036 described granting or depending on `PROVIDER_OWNER`; R1-P05's
  historical implementation evidence remains unchanged.
- An ordinary Individual account may apply as `INDIVIDUAL_TEAM`. This kind does
  not require registered-company documents.
- A legal Company signs up as a Company and separately applies as
  `REGISTERED_COMPANY`. Company account identity and Provider-domain identity
  remain separate.
- R1-P06 must not introduce a separate Service Provider account type or make a
  legal Company sign up as an Individual.

### Document-verification baseline

- `INDIVIDUAL_TEAM` has no provider-document requirement. Its
  `documentsVerified` gate is `NOT_REQUIRED`, is treated as satisfied, and does
  not reduce `profileCompletion`.
- The initial `REGISTERED_COMPANY` checklist contains exactly two required,
  configurable document types:
  - Commercial Registration â€” stable code `COMMERCIAL_REGISTRATION`.
  - Tax Registration, Tax Card, or Tax Certificate â€” stable code
    `TAX_REGISTRATION`.
- Document types remain configurable rather than hard-coded entirely into
  business behavior. The configuration authority, country-and-kind policy
  versioning, effects on existing Providers, metadata fields, upload policy,
  expiry rules, and review transitions are resolved below and must be applied
  exactly as recorded.
- R1-P06 owns Provider-document associations, review workflow, verification
  state, verification history, and verification-badge truth. Media continues to
  own file/storage lifecycle and must be used through an explicit public
  contract.

### External payout-destination baseline

- R1-P06 supports exactly two external destination types:
  - Mobile Wallet â€” stable code `MOBILE_WALLET`.
  - Bank Account â€” stable code `BANK_ACCOUNT`.
- Card payout destinations and InstaPay integration are excluded from R1-P06.
- Cleanora stored-value wallets, reusable balances, wallet top-ups, internal
  account balances, and ledger balances are prohibited. A Mobile Wallet is an
  external settlement destination, never a Cleanora-held balance.
- The Mobile Wallet and IBAN-first Bank Account field schemas, manual Staff
  verification without uploaded ownership evidence, duplicate identities,
  masking boundaries, and readiness prerequisites are resolved in the
  clarification decisions below. The destination lifecycle, primary policy,
  re-authentication, notifications, and complete sensitive-data contract are
  also resolved below; no material R1-P06 clarification decision remains open.
- OQ-011 is partially resolved: supported R1-P06 destination types are fixed,
  while the exact payout and settlement schedule remains open for the later
  payout-execution phase.

### Clarification decisions â€” 2026-08-13

- An active Provider `OWNER` or `ADMIN` with active exact-Provider membership
  may create document drafts, enter metadata, upload, submit, replace, and view
  that Provider's documents and history.
- Only an active `STAFF_ADMIN` may approve, reject, request replacement,
  invalidate, or otherwise decide Provider-document verification. Provider
  `OWNER` and `ADMIN` members cannot review their own evidence.
- Every privileged Staff document decision requires a meaningful non-empty
  reason and immutable evidence of the actor, timestamp, target document
  version, outcome, and safe audit/history meaning.
- Only an active exact-Provider `OWNER` may create, update, replace, remove, or
  select the primary payout destination. An active exact-Provider `ADMIN` may
  view masked destination status but cannot mutate sensitive destination details
  or primary truth.
- Only an active `STAFF_ADMIN` may verify, reject, or invalidate a payout
  destination. Every such decision requires a meaningful non-empty reason and
  immutable evidence of actor, timestamp, target destination version, outcome,
  and safe audit/history meaning.
- Provider-specific R1-P06 document and payout-destination records cannot be
  created, submitted, reviewed, or mutated while the Provider application is
  `DRAFT`, `PENDING_REVIEW`, `CHANGES_REQUESTED`, or terminal `REJECTED`.
- After application `APPROVED`, authorized document and payout-destination work
  may progress independently; neither R1-P06 readiness gate is a prerequisite
  for beginning work on the other.
- If the approved Provider later becomes operationally `SUSPENDED`, authorized
  remediation and Staff review remain available. R1-P06 readiness still cannot
  grant operational or public eligibility.
- The launch Egypt (`EG`) policy for `REGISTERED_COMPANY` contains exactly
  `COMMERCIAL_REGISTRATION` and `TAX_REGISTRATION`, both active and required.
  Country validity remains Configuration-owned and business behavior must not
  hard-code Egypt.
- Only an active `STAFF_ADMIN` may create or edit a draft document-policy
  version and publish it with a meaningful non-empty reason. A published version
  is immutable, effective-dated, and preserves its actor, timestamp, exact
  version, and safe before/after audit meaning.
- Once a published policy version becomes effective, every approved Provider in
  its country-and-kind scope is re-evaluated against it. Eligible evidence for
  an unchanged stable type may continue to satisfy it; a newly required type may
  make readiness incomplete, and a retired requirement stops blocking current
  readiness. Historical policy versions, evidence, decisions, and prior
  readiness meaning remain preserved.
- Both launch document types require `countryCode`, `documentNumber`,
  `legalName`, `issuerName`, and `issueDate`; `expiresAt` is optional. The
  country must equal the Provider's authoritative active country, issue date
  cannot be in the future, and an entered expiry must be later than issue date.
  Omitted expiry means no automatic expiration.
- Evidence must represent the complete document. Ordered additional private
  JPEG/PNG pages are allowed within the approved 10-page, 5-MiB-per-page, and
  20-MiB-aggregate image limits. Every submission snapshots the policy-version
  metadata rules under which it was validated so later changes do not rewrite
  historical meaning.
- One document version uses exactly one format: either one validated PDF of at
  most 15 MiB and 10 pages, or 1â€“10 ordered validated JPEG/PNG images, each at
  most 5 MiB and at most 20 MiB in aggregate. `image/jpeg` explicitly includes
  `.jpg` and `.jpeg`; `image/png` includes `.png`. PDF and image evidence cannot
  be mixed.
- Media verifies signatures and decoded content rather than trusting filenames
  or declared MIME. Malformed, encrypted/password-protected, active-content,
  executable, mismatched, unsafe, or over-limit content is rejected; malware
  scanning, image-orientation normalization, and unsafe metadata removal occur
  before `READY`.
- Drafts may reference `PENDING_UPLOAD` or `PROCESSING` evidence, but submission,
  review, and verification credit require every ordered item to be `READY`.
  Failed, missing, deleted, or reordered evidence creates no partial Provider
  truth. The R1-P06 Media public contract and its Cloudinary adapter must later
  support validated `image/jpeg` for both `.jpg` and `.jpeg` as documentation-
  planned implementation work; no adapter code is changed in this run.
- Document versions use only `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`,
  `REPLACEMENT_REQUESTED`, `EXPIRED`, `INVALIDATED`, and `SUPERSEDED`. Submitted
  metadata and evidence are immutable; every correction, resubmission, renewal,
  or replacement creates a linked successor, and ordinary hard deletion is
  prohibited.
- A voluntary successor leaves a still-valid, unchallenged approved predecessor
  effective during review. Successor approval atomically makes it effective and
  supersedes that predecessor. Rejection of a voluntary successor leaves the
  valid predecessor effective.
- Staff replacement request or invalidation and authoritative expiry immediately
  remove the predecessor's verification credit. A challenged, expired, or
  invalidated version stays non-effective while any successor is reviewed.
- Every lifecycle command targets the exact expected version. Matching retries
  are idempotent, stale or competing commands conflict safely, and immutable
  review/domain history preserves every transition and reason.
- Protected badge truth uses `NOT_ELIGIBLE`, `NOT_EARNED`, and `EARNED`.
  `INDIVIDUAL_TEAM` is always `NOT_ELIGIBLE` even though its document gate is
  `NOT_REQUIRED` and satisfied. Only an approved `REGISTERED_COMPANY` is badge-
  eligible.
- An eligible Company's badge is derived as `EARNED` exactly while every active
  required document type under the current policy has effective approved
  evidence. Staff replacement request, invalidation, expiry, or a new unmet
  requirement removes it immediately; a voluntary successor preserves it only
  while its valid unchallenged predecessor remains effective.
- Operational `SUSPENDED` status does not rewrite document-verification or badge
  truth, but operational and public eligibility remain denied. R1-P12 owns any
  later anonymous badge rendering; R1-P06 exposes protected truth only.
- Only an active exact-Provider `OWNER` may create or update a Mobile Wallet
  payout-destination draft. It requires the Provider's authoritative active
  `countryCode`, the wallet number normalized to E.164, an `operatorCode`
  selected from the active country-scoped payout-operator registry, the wallet
  holder's full legal name, and relationship `PROVIDER_LEGAL_ENTITY` or
  `PROVIDER_OWNER`.
- The operator is neither inferred from the phone prefix nor entered as free
  text. The wallet number need not match the Owner's Authentication phone and
  `phoneVerified` is not required because SMS phone verification remains
  deferred.
- R1-P06 does not request, accept, or require a Mobile Wallet ownership/control-
  evidence file, screenshot, statement, contract, or other proof-of-ownership
  document.
- Submitting a Mobile Wallet makes the exact version `PENDING_VERIFICATION` and
  does not satisfy `payoutDestinationReady`. Only an active `STAFF_ADMIN` may
  approve, reject, or request correction or replacement.
- Before approval, the Staff Admin manually startsâ€”but does not completeâ€”an
  external wallet transfer attempt or beneficiary lookup and compares the
  displayed registered holder name with the Provider's authoritative legal-
  entity name for `PROVIDER_LEGAL_ENTITY`, or the exact active Owner's
  authoritative legal name for `PROVIDER_OWNER`. A mismatch or unverifiable
  name requires rejection or correction/replacement, not approval.
- The manual verification procedure does not authorize payout execution,
  automated verification money, a wallet-transfer API integration, a completed
  transfer, or an actual settlement record in R1-P06.
- Every Mobile Wallet Staff decision requires a meaningful non-empty reason or
  verification note, Staff actor ID, timestamp, exact payout-destination
  version, verification method such as `MANUAL_WALLET_TRANSFER_CHECK`, immutable
  lifecycle and decision history, and safe audit evidence. No uploaded
  ownership-evidence file is part of that decision.
- Every Mobile Wallet command uses an exact expected version. Matching retries
  are idempotent, while stale or competing commands conflict without partial
  destination, decision, history, audit, or readiness truth.
- Mobile Wallet uniqueness uses authoritative `countryCode` plus normalized
  E.164 number independently of `operatorCode`. A duplicate is prohibited
  within one Provider, and a concurrent cross-Provider claim is blocked pending
  active-`STAFF_ADMIN` resolution.
- After submission, ordinary Provider-facing responses, lists, and history show
  only a masked wallet number. The full number may be accessed only in the
  narrowly authorized Staff verification workflow and never appears in logs,
  audit payloads, generic history, ordinary responses, errors, or public
  responses.
- Only a current active `APPROVED` destination can satisfy
  `payoutDestinationReady`. Draft, submitted, `PENDING_VERIFICATION`, rejected,
  invalidated, removed, and replaced-but-not-approved destinations do not
  satisfy the gate.
- Only an active exact-Provider `OWNER` may create or update an IBAN-first Bank
  Account payout-destination draft. It requires the Provider's authoritative
  active `countryCode`, configured payout `currencyCode` (`EGP` for the launch
  `EG` policy), active country-scoped `bankCode`, normalized IBAN, holder full
  legal name, and relationship `PROVIDER_LEGAL_ENTITY` or `PROVIDER_OWNER`.
- Bank name is resolved from `bankCode`. The launch IBAN-first contract does not
  request a separate domestic account number, branch, or caller-entered
  SWIFT/BIC when the IBAN and bank registry provide the required identity.
- R1-P06 does not request, accept, or require a Bank Account bank statement,
  account certificate, cheque image, contract, screenshot, or other uploaded
  ownership/control-evidence document.
- Submitting a Bank Account makes the exact version `PENDING_VERIFICATION` and
  does not satisfy `payoutDestinationReady`. Only an active `STAFF_ADMIN` may
  approve, reject, or request correction or replacement.
- Before approval, the Staff Admin manually performs a beneficiary lookup or
  startsâ€”but does not completeâ€”a bank transfer and compares the displayed
  beneficiary name with the Provider's authoritative legal-entity name for
  `PROVIDER_LEGAL_ENTITY`, or the exact active Owner's authoritative legal name
  for `PROVIDER_OWNER`. A mismatch or unverifiable name requires rejection or
  correction/replacement, not approval.
- The manual Bank Account verification procedure does not authorize automated
  beneficiary lookup, verification-money movement, bank-transfer API
  integration, a completed transfer, or an actual settlement record in R1-P06.
- Every Bank Account Staff decision requires a meaningful non-empty reason or
  verification note, Staff actor ID, timestamp, exact payout-destination
  version, verification method such as `MANUAL_BANK_BENEFICIARY_CHECK`,
  immutable lifecycle and decision history, and safe audit evidence without an
  uploaded ownership-evidence file.
- Every Bank Account command uses an exact expected version. Matching retries
  are idempotent, while stale or competing commands conflict without partial
  destination, decision, history, audit, or readiness truth.
- Normalized IBAN is the Bank Account duplicate identity. A duplicate is
  prohibited within one Provider, and a concurrent cross-Provider claim is
  blocked pending active-`STAFF_ADMIN` resolution.
- After submission, ordinary Provider-facing responses, lists, and history show
  only a masked IBAN. The full IBAN may be accessed only in the narrowly
  authorized Staff verification workflow and never appears in logs, audit
  payloads, generic history, ordinary responses, errors, or public responses.
- Only a current active `APPROVED` Bank Account can satisfy
  `payoutDestinationReady`; all other Bank Account states cannot.
- One Provider may have at most five active payout-destination chains across
  both approved destination types in any combination. Retained terminal history
  does not count against this limit, and each chain may have only one open
  successor.
- Destination versions use exactly `DRAFT`, `PENDING_VERIFICATION`,
  `CHANGES_REQUESTED`, `APPROVED`, `REJECTED`, `REPLACEMENT_REQUESTED`,
  `INVALIDATED`, `SUPERSEDED`, and `REMOVED`. The approved actor-by-state
  transition matrix in the R1-P06 specification is closed; rejected,
  invalidated, superseded, and removed versions are terminal.
- Submitted destination details are immutable. Corrections and replacements
  create linked successor drafts, and ordinary hard deletion is prohibited.
- A voluntary successor preserves its approved unchallenged predecessor and
  primary status through review. Successor approval atomically supersedes it and
  inherits primary; successor rejection or changes requested leaves it
  effective.
- A Staff replacement request or invalidation removes the challenged approved
  destination's readiness credit and primary status immediately. No unrelated
  destination is auto-promoted; approved linked successor restoration may
  inherit the chain's former primary status.
- At most one global primary exists across both destination types, and
  `payoutDestinationReady` requires it to be current, active, and `APPROVED`.
  The first approval initializes primary; later unrelated approvals do not
  replace it automatically, and only the active exact-Provider `OWNER` selects
  another approved primary.
- Removing a primary while another approved destination exists requires atomic
  replacement-primary selection. The Owner may remove the last approved primary
  only with explicit acknowledgement and valid recent re-authentication, which
  clears primary and readiness. Staff invalidation is never blocked by missing
  alternatives and never triggers automatic failover.
- Owner initial submission, successor submission, primary change, withdrawal,
  and removal require an Authentication-owned re-authentication proof no older
  than 10 minutes. Masked reads and draft editing require only the active
  authorized session.
- Every transition uses exact expected versions, idempotent matching retries,
  safe conflicts, immutable domain history, and privileged audit where
  applicable.
- Submission creates one Staff review-queue effect and one durable idempotent
  localized-template email intent to the exact active Owner. Every Staff
  decision, primary change, removal, and successor approval/supersession creates
  one corresponding Owner email intent.
- Destination notifications contain only type, masked identifier, safe status,
  and safe reason. Delivery is asynchronous with durable retry; failure never
  rolls back, duplicates, or rewrites accepted business truth.
- Every recoverable full payout identifier and destination-holder legal name is
  encrypted before database persistence with AES-256-GCM, a unique random nonce
  per protected field, and authenticated context binding Provider ID,
  destination ID, exact version, type, field name, and encryption-key version.
  Persistence retains the ciphertext envelope, non-secret key ID, approved safe
  display suffix, and separately allowed routing/status facts, never plaintext
  protected values.
- Equality and deduplication use a separate versioned HMAC-SHA-256 lookup key
  ring over the domain-separated canonical identity
  `MOBILE_WALLET | countryCode | normalized E.164` or
  `BANK_ACCOUNT | normalized IBAN`. Lookup fingerprints exist only for equality
  and duplicate enforcement, never use encryption keys, and never appear in
  responses, logs, history, or audit evidence.
- Provider payout identifiers are write-only. Create/update responses and all
  later reads including `DRAFT` are masked; changes require complete re-entry.
  The active exact-Provider `OWNER` may see the configured bank/operator label,
  holder relationship, and current holder legal name in the authorized current-
  management view, but never the full identifier. `ADMIN` receives only type,
  approved mask, status, primary truth, and safe timestamps, with no holder
  name.
- Mobile Wallet masks preserve `+` and the country calling code, mask every
  national digit except the final four, and display those four. IBAN masks
  preserve only the two-letter country prefix and final four, replace every
  intervening alphanumeric with `â€¢`, and group in blocks of four. Holder legal
  name is either shown in full for an expressly authorized management or
  verification purpose or omitted; it is never partially masked.
- Full identifier and holder-name reveal is allowed only to an active
  `STAFF_ADMIN` with explicit payout-verification capability for one exact
  `PENDING_VERIFICATION` version, an Authentication-owned step-up no more than
  five minutes old, a meaningful reason, and a purpose-bound grant scoped to
  actor, Provider, destination version, and request. Responses are non-cacheable
  and expire with that purpose. Bulk reveal/export, reusable grants, Provider
  reveal, and approved/terminal browsing are prohibited.
- Every allowed or denied reveal attempt creates safe audit evidence containing
  actor, target Provider and exact destination version, purpose, reason,
  timestamp, request ID, outcome, and applicable key versions, but never
  plaintext, ciphertext, nonce, tag, lookup fingerprint, or key material. An
  accepted audit must persist before plaintext is returned; audit, key,
  decryption, authorization, step-up, or rate-limit failure fails closed.
  Accepted reveals are limited to five per Staff actor per rolling 10-minute
  window, and retries cannot bypass that limit.
- Release 1 declares separate externally supplied versioned key rings through
  `PAYOUT_DATA_ENCRYPTION_KEYS_JSON`,
  `PAYOUT_DATA_ENCRYPTION_ACTIVE_KEY_ID`,
  `PAYOUT_LOOKUP_HMAC_KEYS_JSON`, and
  `PAYOUT_LOOKUP_HMAC_ACTIVE_KEY_ID`. Decoded keys are independent and at least
  32 bytes, active key IDs are distinct, and no default exists. Startup and
  readiness fail closed for missing or malformed configuration, cross-purpose
  reuse, invalid active keys, or inability to cover retained versions.
- Rotation activates new encryption and lookup keys for new writes, keeps prior
  keys decrypt/compare-only, checks duplicates across every enabled lookup-key
  version, and uses bounded resumable re-encryption and re-fingerprinting. A key
  retires only after zero retained references are verified and a human
  explicitly approves the operation. Missing historical keys never cause
  ciphertext, fingerprints, or stored masks to be returned as plaintext.
- Cloud secret-manager integration remains deferred to Release 3. Private
  verification-document bytes, storage, processing, keys, and delivery remain
  Media-owned and outside this payout-data security contract.

### Privacy, review, readiness, and phase boundary

- Private Provider contacts, verification documents, and full payout details
  must never appear on public Provider profiles. Storage keys, raw tokens,
  private documents, and full sensitive payout identifiers must not appear in
  public interfaces or general logs.
- R1-P05 application review remains active-`staff_admin`-only. R1-P06 document
  review is also active-`staff_admin`-only under the clarification decision
  above. R1-P06 payout-destination verification is likewise active-
  `staff_admin`-only, while sensitive destination mutation and primary selection
  are active exact-Provider-`OWNER`-only.
- R1-P06 may satisfy only `documentsVerified` and
  `payoutDestinationReady`. It must preserve the separation between
  `profileCompletion` and `marketplaceReadiness`, and it cannot make a Provider
  operationally `LIVE` or publicly browseable. Provider-specific R1-P06 work
  begins only after application approval, the two owned gates progress
  independently, and operational suspension preserves authorized remediation
  without restoring operational or public eligibility.
- Cross-provider reads fail closed without leaking another Provider's existence
  or private data. Every privileged document decision preserves actor, a
  meaningful non-empty reason, timestamp, target document version, and immutable
  audit/history evidence. Every privileged payout-verification decision
  preserves equivalent reasoned evidence against the exact destination version;
  Owner destination mutations preserve safe actor/action/time and before/after
  evidence without full sensitive values.
- R1-P06 excludes application creation/approval, provider profile/media/gallery
  behavior completed by R1-P05, workers/teams, services/pricing, coverage,
  availability, capacity, final marketplace eligibility, anonymous Browse,
  booking/customer payments, actual payout execution, settlement scheduling,
  deployment, and production configuration.

### Documentation workflow result

- Clarification records all 12 owner-approved decisions with no material open
  product question.
- The technical plan, research, data model, public/API/transaction contracts,
  migration, security, UX, test, operations, and quickstart artifacts are
  complete and constitution-aligned.
- The mandatory after-plan and after-tasks Companion captures succeeded; all 25
  general and 80 focused specification-quality checklist items pass.
- `tasks.md` contains continuous T001â€“T137 across all 10 user stories with
  independent test criteria. The second cross-artifact analysis pass reports no
  remaining inconsistency, ambiguity, constitution conflict, or coverage gap.
- The implementation prompt is a handoff only. No implementation task, product
  code/test, Prisma/schema edit, migration, database operation, Git action,
  deployment, production configuration, or R1-P07 work was authorized or run.

OQ-007 is resolved by this decision. OQ-009 remains open and out of scope.
OQ-011 remains open only for payout and settlement scheduling.

---

## DEC-038 â€” Worker, team, access, and readiness pre-activation baseline

**Date:** 2026-08-22
**Status:** Approved baseline; R1-P07 activated on 2026-08-22 and later advanced
through separately authorized pre-implementation preparation

This decision originally recorded the owner's approved product baseline for
R1-P07 before activation. It resolves the 27 reviewed Worker and Team decision
questions. On 2026-08-22, the owner separately authorized R1-P07 activation and
`speckit-specify`, then issued a later instruction authorizing the remaining
pre-implementation specification-driven workflow through analysis. DEC-039
records its five clarification refinements. Neither authorization permits
product implementation, and derived artifacts must not silently replace these
decisions.

### Worker identity, engagement, and invitations

- A Worker Profile is Provider-owned operational data separate from the
  Authentication identity. A Provider may create the profile before the invited
  person has completed a Cleanora login account.
- Invitations are sent by email. A new user chooses their own password; an
  existing user signs in and accepts the invitation without changing their
  password. Invitation tokens and credentials never appear in generic logs,
  history, or safe audit payloads.
- An invitation expires after 72 hours. Resending invalidates every earlier
  invitation link for that engagement, and the exact Provider Owner may revoke
  an outstanding invitation.
- One Authentication identity may hold `CUSTOMER` and `WORKER` at the same time.
  Those roles do not merge Customer and Worker data ownership.
- A person may have only one current Provider engagement. `INACTIVE` remains a
  current engagement, so another Provider cannot engage the same identity until
  the prior engagement becomes `REMOVED` or the Worker leaves that Provider.
- The exact Provider Owner may remove a Worker, and a Worker may leave the
  Provider. Both operations preserve history and notify the other party.
- Rehiring creates a new engagement linked to its removed predecessor. A
  `REMOVED` engagement is never reopened.

### Worker lifecycle, contact privacy, and media

- Worker operational lifecycle is `DRAFT â†’ ACTIVE â†” INACTIVE â†’ REMOVED`.
  `REMOVED` is terminal. Login-access lifecycle is separate and uses
  `INVITED`, `ACTIVE`, `EXPIRED`, and `REVOKED`.
- The Worker operational phone is normalized to E.164 and is separate from the
  Authentication phone. The Worker reviews it when accepting the invitation;
  confirmation does not update Authentication phone data automatically and is
  not treated as proof of Authentication-phone ownership.
- The full operational phone is available only to the exact Provider Owner,
  an explicit exact-Provider Admin, the Worker themself, and the primary
  Supervisor of the Worker's current team. Other Workers cannot see the full
  value, and Customers never receive it.
- Worker avatar media uses the Media-owned private profile-image flow. The
  accepted input contract is JPEG, PNG, or WebP up to 5 MiB, with safe
  orientation and metadata handling and a processed WebP output no larger than
  1200 pixels on its longest edge. Any later public display requires a separate
  decision.

### Authority and recent authentication

- Exact-Provider Admin authority comes only from explicit active
  `provider_members.ADMIN` membership. No Worker boolean or profile flag grants
  Admin authority. The same identity may be both Worker and Provider Admin only
  when both relationships exist explicitly.
- The exact Provider Owner initiates or resets login access, grants or revokes
  Admin membership, removes Workers, and revokes Worker access. A new Worker
  still chooses their own password; the Owner never assigns it.
- An explicit Provider Admin manages Worker profiles, skills, teams, team
  membership, and operational states but cannot grant ownership or Admin
  authority. Under the DEC-039 refinement, a primary Supervisor reads only the
  assigned current Team and its current members and may write only `cleans` on
  an existing current membership. A Worker sees only their own profile and
  operational context and cannot modify their authority or Provider-managed
  administrative profile.
- High-risk credential, Admin-authority, removal, and access-revocation commands
  require Authentication-owned recent re-authentication, with a default maximum
  age of 10 minutes. Ordinary profile, skill, team, and operational edits do not
  require step-up authentication.

### Worker types, skills, and cleaning context

- `workerType` is closed to `CLEANING_STAFF`, `ESCORT`, and `OTHER`.
  Supervisor capability is independent of `workerType`.
- `cleans` is contextual membership data, not a permanent Worker trait. It is
  stored on team membership and may be copied as an immutable assignment
  snapshot by a later Booking phase.
- Display title is optional. Skills are Provider-managed normalized tags that
  reject duplicates within one Worker and may later map to the R1-P08 catalog.
- An Escort is a complete auditable Worker rather than a separate entity and,
  as refined by DEC-039, every Team membership for an Escort has
  `cleans=false`.

### Team lifecycle and membership

- A Worker has at most one active team membership, while earlier memberships
  remain historical.
- Team lifecycle is `DRAFT â†’ ACTIVE â†” INACTIVE â†’ ARCHIVED`; `ARCHIVED` is
  terminal. A normalized team name is unique among the exact Provider's
  non-archived teams.
- A `DRAFT` team may be empty. Activation requires a valid name and at least one
  active cleaning Worker.
- A team has at most one optional primary Supervisor. That Supervisor must be an
  active Worker, a current member of the team, and hold Supervisor capability.
- Before deactivating, removing, or accepting the departure of a Worker whose
  loss would remove the final active cleaning Worker from an active team, the UI
  shows the impact. After explicit confirmation, Worker and Team are made
  inactive atomically and history is retained for each transition.
- Deactivating the primary Supervisor clears that assignment. The Team remains
  `ACTIVE` only if at least one valid active cleaning Worker remains.
- Making a Team `INACTIVE` does not deactivate its Workers. Archiving a Team
  ends its current memberships and preserves their history.

### `workersReady` gate

- `workersReady` is satisfied when at least one Worker has operational status
  `ACTIVE`, has `workerType=CLEANING_STAFF`, has a complete required profile,
  and has an Authentication account, the Worker role, and active login access.
- Team membership is not required for `workersReady`. A Provider Owner counts
  only if an explicit Worker engagement exists for the same identity.
- An Escort, a Supervisor who is not eligible to clean, and an unaccepted
  invitation do not satisfy the gate.
- Deactivating or removing the final eligible Worker is allowed only after a
  warning and explicit confirmation. The operation makes `workersReady`
  unsatisfied and never auto-promotes another Worker.

### Concurrency, history, reasons, and notifications

- Lifecycle, invitation, membership, authority, and Team commands require
  `expectedVersion` and `idempotencyKey`. An identical retry is idempotent;
  stale or competing commands conflict without partial state.
- Immutable history records actor, timestamp, exact target and version,
  transition, and safe before/after facts without full phone values, invitation
  tokens, credentials, or other secrets.
- A reason code is required to deactivate or remove a Worker, revoke access, or
  grant or revoke Admin membership. Removal and reason `OTHER` additionally
  require a meaningful note of at least 10 characters. Routine name, title,
  skill, and team-membership changes require no reason.
- Invitations, access changes, Worker lifecycle changes, Admin membership
  changes, and Worker departure or removal emit localized email intents through
  an idempotent outbox. Delivery failure does not roll back or rewrite accepted
  business truth.

### Phase boundary

- DEC-038 approves product decisions only. It defines no HTTP endpoint,
  request/response schema, public module contract, Prisma model, migration, or
  database operation.
- The owner activated R1-P07 on 2026-08-22 and later authorized creation of the
  phase branch plus clarification, planning, specialized checklists, tasks,
  analysis, and Companion capture through `tasks / ready-to-implement`.
- Product implementation and tests, Prisma/schema changes, migrations, database
  work, staging, commit, push, merge, deployment, and production operations
  remain separately controlled and unperformed.

## DEC-039 â€” R1-P07 Supervisor scope, Escort cleaning, reasons, and notification locale

**Date:** 2026-08-22
**Status:** Approved clarification decision; R1-P07 pre-implementation workflow
is authorized and implementation remains unstarted

The owner approved five clarification answers for R1-P07 after DEC-038 and
authorized the specification-driven workflow to continue through clarification,
planning, checklists, tasks, and consistency analysis. These decisions refine
DEC-038 without authorizing product implementation, tests, Prisma changes,
migrations, database operations, staging, commit, push, merge, deployment, or
production work.

### Primary Supervisor scope

- A primary Supervisor may read only the exact current Team and its current
  members and may modify only `cleans` on an existing current membership within
  that Team.
- A primary Supervisor cannot add, remove, or move members; create or edit a
  Worker Profile, skills, Worker lifecycle, invitation, login access, or Admin
  membership; change Team name or lifecycle; or assign or clear the primary
  Supervisor.
- Full operational-phone access is limited to the Supervisor's current Team
  members and ends as soon as the primary-Supervisor assignment or current
  membership is no longer valid.
- R1-P07 adds no operational-notes field or other daily-operation write surface;
  the only new Supervisor write is the existing membership's `cleans` value.

### Escort cleaning invariant

- Every Team membership for a Worker whose `workerType=ESCORT` must carry
  `cleans=false`. A request for `cleans=true` is rejected and never changes the
  Worker's type automatically.
- Changing a Worker from `CLEANING_STAFF` to `ESCORT` is rejected while the
  current Team membership still has `cleans=true`. An authorized actor must
  correct the membership explicitly before retrying the type change.
- An Escort never counts as an active cleaning Worker and never satisfies
  `workersReady`.

### Primary-Supervisor last-cleaner command

- If a primary Supervisor attempts to set `cleans=false` for the final valid
  cleaning Worker in an `ACTIVE` Team, the command is rejected with a safe
  conflict that directs the actor to an Owner or Admin.
- An exact Provider Owner or Admin may make the same change only after the
  operational impact is shown and explicitly confirmed. On acceptance, the
  membership's `cleans` change and the Team transition to `INACTIVE` commit
  atomically with distinct history for each affected truth.
- Cancellation, stale expected version, a competing command, or failure changes
  zero business state, history, readiness, audit, or notification effects.

### Closed reason catalogs

- Worker deactivation accepts only `TEMPORARILY_UNAVAILABLE`,
  `SCHEDULE_OR_LEAVE`, `PERFORMANCE_OR_POLICY`,
  `PROVIDER_OPERATIONAL_CHANGE`, or `OTHER`.
- Worker removal accepts only `ENGAGEMENT_ENDED`, `PERFORMANCE_OR_POLICY`,
  `DUPLICATE_OR_INCORRECT_RECORD`, or `OTHER`.
- Login-access revocation accepts only `SECURITY_CONCERN`,
  `ACCESS_NO_LONGER_REQUIRED`, `ENGAGEMENT_ENDED`, or `OTHER`.
- Provider Admin grant accepts only `OPERATIONAL_RESPONSIBILITY`,
  `COVERAGE_OR_BACKUP`, or `OTHER`.
- Provider Admin revocation accepts only `RESPONSIBILITY_ENDED`,
  `SECURITY_CONCERN`, `ENGAGEMENT_ENDED`, or `OTHER`.
- Each command accepts only its own catalog. A meaningful note of at least 10
  characters is required for every Worker removal and every command whose
  reason is `OTHER`; routine edits remain reason-free under DEC-038.

### Notification locale

- The Owner selects `AR` or `EN` whenever an invitation version is issued,
  including resend, and the locale is stored with that exact version.
- After acceptance, email uses the recipient's valid `UserPreferences.language`
  when present. When it is absent or invalid, a Worker uses the locale of the
  last accepted invitation; if neither source is valid, the final fallback is
  `AR`.
- Locale is immutable intent meaning. Notification delivery failure or retry
  cannot roll back, duplicate, or rewrite the accepted business truth.

### Boundary and authorization

- DEC-039 refines DEC-038 and is canonical for these five topics. It does not
  define product HTTP or persistence contracts; those belong to the authorized
  technical plan.
- The owner authorized the pre-implementation workflow through clarification,
  planning, specialized checklists, tasks, and analysis on branch
  `r1-p07-worker-team-crew-management`, with a mandatory stop before
  `speckit-implement`.
- No product code or tests, Prisma/schema change, migration, database operation,
  staging, commit, push, merge, deployment, or production work is authorized or
  performed by this decision.

## DEC-040 â€” R1-P07 implementation completion and publication boundary

**Date:** 2026-08-24
**Status:** Approved and Complete â€” implementation, migration proofs, tests,
coverage, independent review, and evidence gates passed

The human owner instructed Codex to complete R1-P07, make it ready for Git
publication, and mark it completed. This decision closes the sole active phase
after repository-grounded verification; it does not reinterpret the historical
pre-implementation boundaries in DEC-038 or DEC-039.

### Completion evidence

- All FR-001â€“FR-088 and SC-001â€“SC-014 are implemented and trace to completed
  tasks T001â€“T156.
- The phase-owned additive migration applied chronologically on a clean
  disposable R1-P07 database and upgraded a populated R1-P06 fixture without
  changing any pre-existing baseline table digest or business truth.
- The final phase suite passed 79 files / 330 tests with no skip; full
  integration passed 149 files / 497 tests; global coverage passed 336 files /
  1,405 tests above every unchanged threshold.
- Prisma, typecheck, lint, build, OpenAPI, Postman, documentation, module
  boundaries, privacy/redaction, SQL review, concurrency, and diff gates passed.
- The accepted final read-only independent review has no unresolved BLOCKER or
  MAJOR, and Codex independently resolved every applicable finding.
- Companion records implementation completion and terminal phase completion.

### Preserved boundaries

- R1-P07 adds no separate Workers module, Booking assignment/snapshot, payroll,
  payout schedule/execution, attendance, public Worker profile, frontend,
  Docker, cloud, deployment, or production migration.
- Invitation proofs reuse the existing `AUTH_VERIFIER_SECRET` with domain
  separation; R1-P07 requires no new environment variable or secret.
- The repository `.env` database, remote databases, production resources, and
  the installed PostgreSQL service were not changed. Proof used only a
  temporary localhost cluster and phase-named disposable targets, which were
  stopped and deleted after verification.
- Phase completion does not authorize staging, commit, push, merge, deployment,
  production configuration, production migration, force-push, or history
  rewriting. The guarded Git workflow activates only on a new human message
  whose entire content is exactly `commit and push`.
- No later roadmap phase is activated by this decision.

## DEC-041 â€” R1-P08 strict bilingual catalog activation without fallback

**Date:** 2026-08-30
**Status:** Approved â€” first R1-P08 product clarification

The human owner selected strict bilingual activation for localized Catalog
records.

### Localization policy

- A localized category, service, customer-facing price unit, service field, or
  field option may be saved with incomplete localized content only while
  inactive. In R1-P08 that inactive record is its draft form; no separate
  `DRAFT` lifecycle state is introduced.
- The record cannot be activated, and a service depending on it cannot become
  selectable, until every required Arabic and English value is present and
  valid.
- A localized read must use the exact requested supported locale. Missing
  requested-locale content produces a safe deterministic failure and never
  silently substitutes the other locale.
- Blank-after-trimming or duplicate locale content remains invalid. Activation
  failure changes no partial Catalog, order, history, or audit state.

### Rationale and boundary

This policy makes the R1-P08 Arabic/English catalog completeness goal directly
testable, avoids mixed-language customer experiences, and still permits staff
to prepare incomplete drafts without adding a fallback framework. It does not
choose the remaining service-field-kind or staff-authority policies, implement
frontend behavior, or authorize product code, database operations, Git actions,
deployment, production migration, or phase completion.

## DEC-042 â€” R1-P08 closed Release 1 service-field kinds

**Date:** 2026-08-30
**Status:** Approved â€” second R1-P08 product clarification

The human owner selected the balanced six-kind service-field model for Release
1. R1-P08 defines field metadata for later consumers and does not persist
customer answers.

### Closed kind catalog and compatible constraints

- `INFORMATION` is localized display-only content. It never requires or stores
  an answer and accepts no options, length bounds, numeric bounds, or selection
  bounds.
- `TEXT` accepts optional minimum and maximum answer length and no options,
  numeric bounds, or selection bounds.
- `NUMBER` accepts optional minimum and maximum values plus an explicit integer-
  or-decimal mode and no options, length bounds, or selection bounds.
- `BOOLEAN` represents yes/no and accepts no options, length bounds, numeric
  bounds, or selection bounds.
- `SINGLE_SELECT` uses stable, ordered, localized options and permits exactly
  one selected value when answered. It accepts no length or numeric bounds.
- `MULTI_SELECT` uses stable, ordered, localized options and accepts optional
  minimum and maximum selection counts. It accepts no length or numeric bounds.
- Requiredness is explicit only for answer-bearing kinds. `INFORMATION` can
  never be required. Options are valid only for the two select kinds.
- A field cannot become active when its kind, constraints, options, or
  requiredness are internally inconsistent. An incompatible update fails
  atomically without changing field, order, version, or audit state.

### Exclusions and rationale

The Release 1 kind set excludes date, time, file/image upload, executable
expressions, conditional question graphs, arbitrary schemas, and customer answer
persistence. Scheduling belongs to Booking, files remain Media-owned, and
answers belong to a later Booking phase. The six kinds cover information,
free-text, quantity/measurement, yes/no, one-choice, and multiple-choice needs
without building a generic form engine.

This decision does not choose the remaining staff-authority policy, implement
frontend behavior, or authorize product code, database operations, Git actions,
deployment, production migration, or phase completion.

## DEC-043 â€” R1-P08 staff-admin-only protected Catalog management

**Date:** 2026-08-30
**Status:** Approved â€” final R1-P08 product clarification

The human owner selected active-`staff_admin`-only authority for protected
Catalog management.

### Permission and role mapping

- Authentication owns two additive permissions:
  `catalog.management.read` and `catalog.management.write`.
- Both permissions map only to the existing `staff_admin` role. Only an active
  grant contributes authority.
- `staff_operations`, `staff_support`, `staff_finance`, provider roles, workers,
  and customers receive neither permission. No staff role receives a protected
  read-only Catalog view.
- Catalog checks declared permissions/protected operations through the
  Authentication public contract; it does not inspect role tables or hard-code
  role hierarchy in Catalog business code.

### Protected and selectable surfaces

- Protected management reads may include inactive drafts, incomplete localized
  content, configuration, ordering, country availability, and version truth.
- Every Catalog mutation requires `catalog.management.write`, an active
  privileged reason capability, the operation's valid reason, atomic audit, and
  the command's conflict-safe precondition.
- Safe selectable reads are a separate Catalog contract for active, complete,
  country-available truth. They never expose inactive drafts or protected
  management detail and do not grant management authority.

### Rationale and boundary

The mapping follows Cleanora's current least-authority baseline: existing
product review and management permissions remain staff-admin-only, and R1-P08
defines no Operations or Support workflow that justifies broader access. A
later owner-approved phase may map one of the declared permissions to another
role without moving authorization ownership into Catalog.

This decision completes R1-P08 product clarification. It does not implement
frontend behavior or authorize product code, database operations, Git actions,
deployment, production migration, or phase completion.

## DEC-044 â€” R1-P08 minimal complete Egypt housekeeping seed

**Date:** 2026-08-30
**Status:** Approved â€” fourth and final R1-P08 product clarification

The human owner selected the smallest complete, active, selectable Egypt seed
rather than a multi-service catalog or inactive structural placeholders.

### Seed contract

- Create one `HOME_CLEANING` category named `Home Cleaning` /
  `طھظ†ط¸ظٹظپ ط§ظ„ظ…ظ†ط§ط²ظ„` and one `STANDARD_HOME_CLEANING` service named
  `Standard Home Cleaning` / `طھظ†ط¸ظٹظپ ظ…ظ†ط²ظ„ظٹ ظ‚ظٹط§ط³ظٹ`.
- Configure active `PER_VISIT` (`Per visit` / `ظ„ظƒظ„ ط²ظٹط§ط±ط©`) and `PER_HOUR`
  (`Per hour` / `ظ„ظƒظ„ ط³ط§ط¹ط©`) price units.
- Configure five representative fields: localized preparation information,
  integer bedroom count, integer bathroom count, optional pet presence, and
  optional special instructions. The seed does not require all six supported
  field kinds to appear; the full closed kind catalog remains required and
  tested independently under DEC-042.
- Make the service available for authoritative country code `EG` and satisfy
  every strict bilingual and activation rule before it becomes selectable.
- Do not seed Media files or create an external-storage dependency. Service
  media remains manageable after seed through the R1-P08 Media boundary.

### Idempotency and owner-managed values

- Stable codes identify seed-owned records. Re-running the seed creates missing
  records but does not duplicate them, silently reactivate records, or overwrite
  values that staff subsequently managed through the application.
- A double-run proof must produce the same identities and counts: one category,
  one service, two price units, five fields, and one Egypt availability record.
- Supporting bilingual descriptions and labels must be concise and neutral and
  must not decide OQ-002 concerning who supplies cleaning materials.

### Rationale and boundary

This seed proves a real end-to-end selectable Catalog path while keeping the
initial product content intentionally small. It avoids both an unusable
placeholder-only catalog and an unapproved multi-service taxonomy. It does not
authorize Provider prices, bookings, customer answers, frontend work, external
media creation, deployment, production migration, or any Git operation.

## DEC-045 â€” Dual disposable targets for R1-P08 repository gates

**Date:** 2026-09-02
**Status:** Approved â€” SC-012 closeout arrangement for R1-P08

The human owner selected option 1 of the R1-P08 closeout question: authorize a
current-schema disposable integration target that satisfies the historical
R1-P04 name guard, keep the separate R1-P08 live target, and require both
`test:integration` and `test:coverage` to pass.

### Dual-target contract

- `TEST_DATABASE_URL` and `TEST_MIGRATION_DATABASE_URL` name the same current-
  schema disposable database matching `cleanora_r1_p04_*_proof`. The authorized
  current target is `cleanora_r1_p04_current_proof`.
- `CLEANORA_R1_P08_DATABASE_URL` remains the separate live Catalog target
  matching `cleanora_r1_p08_*_(test|proof|clean|ci)`. The existing live target
  `cleanora_r1_p08_test` is retained.
- R1-P08 migration validators and live Catalog suites read
  `CLEANORA_R1_P08_DATABASE_URL`. They do not borrow the R1-P04-named
  integration URLs.
- Name guards, coverage thresholds, assertions, and skip-is-not-pass rules stay
  unchanged. Older remote tests may receive only demonstrably remote-safe timing
  budget adjustments if they still fail on this valid arrangement.

### Forbidden targets

- Do not migrate, reset, seed, or otherwise mutate the historical
  `cleanora_r1_p04_clean_proof`.
- Do not connect to, inspect, migrate, seed, or recover the historical
  `Cleanora` database.
- Do not point either family at R1-P02 CI, Railway, production-like, or shared
  application databases.

### Rationale and boundary

A single URL cannot satisfy both the R1-P04 proof-name guard and the R1-P08 live
name guard. Two named disposable databases preserve both locked contracts and
produce the command-level repository evidence SC-012 requires. This decision
does not mark R1-P08 Complete, does not authorize Git publication, deployment,
production configuration, or production migration, and does not accept a red
repository gate as tracked debt.

## DEC-046 â€” R1-P08 implementation completion and publication boundary

**Date:** 2026-09-03
**Status:** Approved and Complete â€” implementation, DEC-045 dual disposable
targets, migration proofs, tests, coverage, independent review, and evidence
gates passed

The human owner instructed the active agent to mark R1-P08 Complete after the
Ready-for-owner-completion-approval gate. This decision closes the sole active
phase after repository-grounded verification; it does not reinterpret
DEC-041â€“DEC-045.

### Completion evidence

- All FR-001â€“FR-052 and SC-001â€“SC-012 are implemented and trace to completed
  tasks T001â€“T156.
- The phase-owned additive migration applied chronologically on disposable
  R1-P08 targets and upgraded a populated R1-P07 fixture without changing
  pre-existing baseline digests or workforce truth.
- Phase suite: 54 files / 333 tests passed / 0 skipped; phase coverage
  85.41 / 76.04 / 83.37 / 85.21.
- Under DEC-045, `test:integration` exited 0 (169 passed / 3 skipped files,
  601 passed / 5 skipped tests) and `test:coverage` exited 0 at
  83.69 / 75.03 / 86.46 / 85.61 versus unchanged 80/75/80/80 thresholds.
- Prisma, typecheck, lint, build, OpenAPI, Postman, documentation, module
  boundaries, privacy/redaction, SQL review, and both migration validators
  passed.
- Independent review finding M-04 is resolved under DEC-045; no unresolved
  BLOCKER or MAJOR remains.

### Preserved boundaries

- R1-P08 adds no anonymous Browse HTTP, Provider pricing, Booking mutation,
  wallet behavior, frontend application, Docker, cloud, deployment, or
  production migration.
- Historical `cleanora_r1_p04_clean_proof` and `Cleanora` were not migrated,
  seeded, reset, or inspected for this closure.
- Phase completion does not authorize staging, commit, push, merge, deployment,
  production configuration, production migration, force-push, or history
  rewriting. The guarded Git workflow activates only on a new human message
  whose entire content is exactly `commit and push`.
- No later roadmap phase (including R1-P09) is activated by this decision.

## DEC-047 â€” R1-P09 Provider OWNER-and-ADMIN offering management

**Date:** 2026-09-05
**Status:** Approved â€” first R1-P09 product clarification

The human owner accepted the recommended Provider-service authority model.

### Provider-scoped authority

- Active Provider `OWNER` and `ADMIN` members may both list, read, create,
  edit, enable, and disable Provider-service offerings for their exact
  Provider.
- Every operation still requires a trusted active identity, the required
  enabled global capability, active membership for the exact Provider, valid
  Provider state, and the command's version, idempotency, and audit checks.
- Caller-supplied actor or Provider scope is never authoritative, and
  cross-Provider access fails closed without disclosing private offering,
  price, note, history, or approval facts.
- This offering-management authority does not grant an `ADMIN` Provider
  ownership, ownership transfer, or membership-administration powers. Existing
  OWNER-only membership and ownership rules remain unchanged.

### Boundary

This decision resolves only R1-P09 Provider membership authority. It does not
choose price-approval policy, monetary semantics, effective-price history,
snapshot/readiness details, or authorize implementation, schema or migration
changes, database operations, Git actions, deployment, production work, phase
completion, or R1-P10.

## DEC-048 â€” R1-P09 country-configured staff-admin price approval

**Date:** 2026-09-05
**Status:** Approved â€” second R1-P09 product clarification

The human owner accepted the recommended Provider-price approval policy.

### Configuration and authority

- The authoritative approval-required setting is country-scoped and belongs
  to Configuration. Providers consumes the resolved setting through
  Configuration's public contract and does not query Configuration tables.
- Where approval is required, only an active `staff_admin` may approve or
  reject a Provider-price proposal. The later plan may declare the smallest
  additive Authentication-owned permission needed for this Staff operation;
  Providers must not inspect role persistence.
- Where approval is disabled, no Staff task or hidden pending approval state is
  created.

### Effective-price behavior

- An initial price proposal in an approval-required country is pending and is
  not effective. The offering cannot be enabled and cannot satisfy
  `servicesReady` until that price is approved.
- When an already approved effective price has a pending replacement, the
  existing approved price remains effective. A rejection preserves it.
- Approval atomically makes the pending replacement effective and supersedes
  the preceding effective price. Pending, rejected, and superseded prices are
  never returned as current effective truth.
- An active Provider `OWNER` or `ADMIN` may disable an offering immediately;
  price approval is not required for disablement. Re-enablement requires a
  still-valid effective price and current Catalog conditions but does not by
  itself create another price-approval decision.

### Integrity and boundary

Every Staff decision requires a permitted reason, expected version,
idempotency, and atomic privileged audit evidence. This decision does not
choose decimal/currency rules, detailed price-history cardinality, the final
snapshot/readiness contract, or authorize implementation, schema or migration
changes, database operations, Git actions, deployment, production work, phase
completion, or R1-P10.

## DEC-049 â€” R1-P09 country-currency decimal and duration contract

**Date:** 2026-09-05
**Status:** Approved â€” third R1-P09 product clarification

The human owner accepted the recommended Provider-service monetary and
estimated-duration contract.

### Currency and decimal rules

- The Provider's authoritative country determines its active default currency
  through Configuration. The caller cannot select or override currency.
- Authoritative monetary values cross command, response, and module-public
  boundaries as plain decimal strings using that currency's configured decimal
  places. Accepted values may gain required trailing zeros for canonical
  output, but are never rounded silently.
- Exponent notation, grouping separators, explicit plus signs, non-canonical
  syntax, or fractional precision beyond the configured currency scale is
  rejected. Binary floating-point arithmetic is prohibited for authoritative
  money.
- Provider price and minimum charge must both be greater than zero. Minimum
  charge must be at least the Provider price.
- Both amounts must be no greater than a required Provider-service price
  maximum resolved for the Provider's country. Missing, inactive, or invalid
  country, currency, or maximum-price configuration fails closed; there is no
  hidden numeric fallback.

### Estimated duration

Estimated duration is a whole number of minutes from 1 through 1440 inclusive.
It is descriptive service configuration and does not represent coverage,
scheduling, availability, or capacity.

### Boundary

This decision does not authorize currency conversion, client-calculated totals,
taxes, fees, discounts, commissions, deposits, dynamic pricing, or any payment
behavior. It does not choose detailed effective-price history or the final
snapshot/readiness contract, and does not authorize implementation, schema or
migration changes, database operations, Git actions, deployment, production
work, phase completion, or R1-P10.

## DEC-050 â€” R1-P09 retained price proposals and aggregate concurrency

**Date:** 2026-09-05
**Status:** Approved â€” fourth R1-P09 product clarification

The human owner accepted the recommended current-price, price-history, pending-
replacement, and optimistic-concurrency policy.

### Accepted proposals and history

- Every Provider-price proposal that passes authorization, business validation,
  expected-version, and idempotency checks is an accepted proposal and is
  retained even if it is pending, later rejected, or superseded.
- Price history is append-only and records proposal creation plus every accepted
  pending, effective, approved, rejected, and superseded transition with safe
  before/after facts, actor, time, reason where required, request correlation,
  and resulting aggregate version.
- Invalid, unauthorized, stale, or idempotency-conflicting attempts do not enter
  domain price history. Separately required security or privileged-denial audit
  evidence remains governed by the owning audit policy.
- At most one pending proposal exists for an offering. A newer authorized,
  valid, accepted Provider proposal atomically supersedes an older pending
  proposal and records both outcomes.
- In a country where approval is disabled, a newly accepted price becomes
  effective immediately and atomically supersedes the preceding effective
  price.

### Concurrency and idempotency

- One Provider Service aggregate version guards every offering configuration,
  price-proposal, enable/disable, and Staff price-decision mutation.
- Every mutation supplies the current expected aggregate version. Each accepted
  mutation increments it exactly once; a stale writer changes no current,
  price, history, readiness, or audit state.
- Identical retries return the original safe result without duplicate state or
  history. Reusing an idempotency identity for different content fails without
  mutation.

### Boundary

This decision does not authorize hard deletion, editing retained commercial
values in place, recording malformed attempts as price history, or adding event
sourcing, CQRS, a generic state machine, or a pricing engine. It does not choose
the final snapshot/readiness contract and does not authorize implementation,
schema or migration changes, database operations, Git actions, deployment,
production work, phase completion, or R1-P10.

## DEC-051 â€” R1-P09 usable-offering readiness and snapshot-ready contract

**Date:** 2026-09-05
**Status:** Approved â€” fifth and final R1-P09 product clarification

The human owner accepted the recommended `servicesReady`, Catalog-change,
localized-note, and internal snapshot-ready policy.

### Usable offering and readiness

- `servicesReady` is satisfied when an approved Provider has at least one
  currently usable offering: Provider-enabled, currently selectable for the
  Provider's country, using a currently active allowed price unit, with a valid
  effective price, configured currency and maximum, valid duration, and either
  no notes or a complete valid localized note pair.
- When no usable offering exists, only applicable stable blocker codes are
  exposed: `NO_PROVIDER_SERVICES`, `NO_ENABLED_PROVIDER_SERVICE`,
  `CATALOG_SERVICE_UNAVAILABLE`, `PRICE_UNIT_UNAVAILABLE`,
  `NO_EFFECTIVE_PRICE`, `PRICE_APPROVAL_PENDING`, and
  `OFFERING_CONFIGURATION_INVALID`.
- `servicesReady` does not decide coverage, scheduling availability, capacity,
  Provider operational LIVE state, or final public eligibility.
  `eligibleForPublicBrowse` remains false in R1-P09.

### Catalog changes and localized notes

- Later Catalog service, country-availability, or selected price-unit
  deactivation makes an enabled offering temporarily unusable without changing
  its Provider-controlled enabled state or fabricating a Provider status
  transition. Restoration of the same qualifying Catalog truth automatically
  requalifies the unchanged offering when all other conditions still pass.
- Service notes are optional. If either localized note is present, Arabic and
  English must both be present and contain 1â€“1000 characters after trimming.
  Management sees the pair; safe consumers receive only the exact requested-
  locale note. There is no locale fallback and no OQ-002 materials rule.

### Internal snapshot-ready contract

- The input is Provider ID, Catalog service code, country code, and exact
  supported locale.
- A successful result contains Provider ID; Provider Service ID and aggregate
  version; Catalog service ID/code/version; estimated-duration minutes; exact-
  locale service note or null; Provider Service Price ID; canonical price and
  minimum-charge strings; currency code; effective-at time; selected price-unit
  ID/code/exact-locale label; and the complete exact-locale country-scoped
  Catalog snapshot-ready definition including category, fields, options, and
  media references.
- The result is available only for a currently usable enabled offering and the
  current effective price. It exposes no private contacts, raw persistence,
  pending/rejected/superseded prices, Staff reasons, or hidden approval data.
- A disabled or unusable offering returns one safe unavailable outcome. If
  Catalog, offering, or price truth changes during the read, the operation
  retries within a bounded policy or returns a stable conflict; it never returns
  mixed versions.
- R1-P09 creates no Booking record, price breakdown, answer, snapshot table, or
  Booking HTTP behavior. The future Booking owner decides when to copy and
  persist the returned values.

### Boundary

This decision completes R1-P09 product clarification. It does not authorize
implementation, schema or migration changes, database operations, Git actions,
deployment, production work, phase completion, or R1-P10.

## DEC-052 â€” R1-P09 completion and R1-P10 activation

**Date:** 2026-09-07
**Status:** Approved phase transition â€” activation only

After the PASS review and publication, the owner reported merging the pull
request and deleting the branch, then instructed: "are we ready now for activate
phase 10 ? if yes activate it". This conditional authorization to advance is
applied after verifying the predecessor's readiness, not inferred from merge alone.

- R1-P09 is Complete. Its reviewed commit 47fdf53 is contained in origin/main
  at 19d4b00 (PR #9); the merge tree has no differences from the reviewed tree.
- Its 84 tasks, review resolution, tests/coverage, migration proofs and artifact
  gates passed. Companion completion is recorded through the canonical writer.
- R1-P10 â€” Availability, Capacity & Textual Coverage becomes the sole active
  phase, for activation and subsequent specification preparation only.
- Phase 10 follows its existing roadmap scope. This decision chooses no new
  scheduling, capacity, pause, area-management or authorization semantics.

No Phase 10 implementation, schema/migration, database work, new Git publication,
deployment, production migration or later-phase activation is authorized.
See both phases' completion/activation records and docs/product/current.md.

## DEC-053 â€” R1-P10 authoritative scheduling time zone

Date: 2026-09-07. Status: Approved by owner (specify Q1: â€œrecommendedâ€‌).

Configuration Staff manage one IANA operating time zone per country. Egypt uses
`Africa/Cairo`; all Providers and their Workers inherit the country's zone.
Release 1 assumes one operating time zone per country. Calendar calculations
must honor that zone's daylight-saving rules rather than a fixed UTC offset.
This decision does not approve other interval, exception, capacity or pause
semantics; those remain to be resolved before implementation.

## DEC-054 â€” R1-P10 calendar boundaries, overnight shifts and exceptions

Date: 2026-09-07. Status: Approved by owner (specify Q2: â€œrecommendedâ€‌).

Periods include their start and exclude their end. Adjacent periods do not
conflict; overlapping periods for the same schedule are rejected. Positive
shifts no longer than 24 hours may cross midnight using an explicit
`endsNextDay` flag. Evaluation splits them at local midnight and applies dated
exceptions per civil date. A dated exception replaces that entire date's weekly
hours, including carryover; an empty exception is a holiday. Thus a Monday
22:00â€“Tuesday 02:00 shift loses its Tuesday portion when Tuesday is a holiday.
Worker availability is always intersected with Provider availability.
Capacity, pause, exact access and other unresolved semantics are not approved
by this calendar decision.

## DEC-055 â€” R1-P10 complete-Team capacity units

Date: 2026-09-07. Status: Approved by owner (specify Q3: option 1).

One complete Team represents one simultaneous-job capacity unit. It counts only
when active, with at least one valid cleaner, and every current member active
and available throughout the requested interval. Escorts add no units but must
be available. Capacity equals the smaller of the Provider's configured
simultaneous-Team limit and available Team count. Unteamed Workers add no units.
Three available Teams with a limit of two yield capacity two.
Phase 10 reports potential supply only; it creates no Booking, reservations or
busy-time ledger and makes no claim that this supply is unbooked.

## DEC-056 â€” R1-P10 textual area administration and coverage granularity

Date: 2026-09-07. Status: Approved by owner (clarify question 1 / overall Q4: option 1).

Staff administer localized countries, cities and districts. Providers select
whole cities or individual districts in their own country and cannot create
place names. Whole-city coverage includes all currently active districts of
that city, including subsequently added districts. Areas retain stable identity
and are deactivated rather than deleted. Inactive ancestry stops matching.
Coordinates and radius searches remain excluded.

## DEC-057 â€” R1-P10 temporary Provider pause

Date: 2026-09-07. Status: Approved by owner (clarify question 2 / overall Q5: option 1).

An Owner/Admin may start one immediate Provider pause with an optional future
end instant. Without an end it lasts until explicit resume. Any requested
interval overlapping an effective pause is unavailable and has zero capacity.
An Owner/Admin may resume early; optional expiry occurs automatically by time
evaluation. Neither event alters approval, suspension or go-live truth.
No future pause calendar, Booking cancellation or Booking modification is added.

## DEC-058 â€” R1-P10 Provider-setting authorization during suspension

Date: 2026-09-07. Status: Approved by owner (clarify question 3 / overall Q6: recommended option 1).

An active Owner or enabled Provider Admin may read and manage coverage,
Provider/Worker schedules and exceptions, capacity and pause for their exact
approved Provider in any operational state: `INACTIVE`, `LIVE` or `SUSPENDED`.
Suspension makes availability evaluation unavailable but does not make the
configuration read-only; operators may repair it before Staff reinstatement.
Workers and Team Supervisors gain no Phase 10 management authority. Staff
locality/time-zone administration uses separate Configuration permissions and
does not grant authority over Provider-owned settings.

## DEC-059 â€” R1-P10 internal coverage and availability read contracts

Date: 2026-09-07. Status: Approved by owner (clarify question 4 / overall Q7: recommended option 1).

Providers exposes narrow internal public contracts to find candidate Provider
identifiers for an active textual area and to evaluate one Provider for a
textual location, requested UTC interval and required complete-Team units. The
evaluation returns the applied country IANA zone, coverage, availability and
capacity facts, available units, stable blocker codes and relevant
configuration versions. Cross-module consumers use this contract rather than
Providers persistence. Phase 10 HTTP is limited to protected Staff locality and
Provider operational-management surfaces. Customer and anonymous availability
lookup remains with later Eligibility and Browse phases.

## DEC-060 â€” R1-P10 configuration readiness versus runtime availability

Date: 2026-09-07. Status: Approved by owner (clarify question 5 / overall Q8: recommended option 1).

The three Phase 10 readiness gates describe completed valid configuration.
`coverageReady` requires at least one effective active coverage selection.
`availabilityReady` requires at least one valid Provider weekly period.
`capacityReady` requires a positive simultaneous-Team limit and at least one
active structurally valid complete Team whose current members share nonzero
recurring availability with the Provider. One incomplete Team does not block a
different valid Team. Temporary pause, suspension, requested-time closure and
requested capacity affect runtime evaluation without erasing configuration
readiness. `eligibleForPublicBrowse` remains blocked until its later phase.

## DEC-061 â€” R1-P10 completion

**Date:** 2026-09-09
**Status:** Approved â€” explicit human-owner phase completion

After receiving the final technical-readiness handoff, the owner stated:
`I approve R1-P10 â€” Availability, Capacity & Textual Coverage as Complete.`

- R1-P10 is Complete. FR-001â€“FR-016 and SC-001â€“SC-008 are reconciled, and
  tasks T001â€“T077 are checked.
- The final Codex adversarial review has no unresolved BLOCKER or MAJOR; seven
  verified correctness/integrity defects were repaired and regression-tested.
- The Phase 10 live suite passed 43 files / 301 tests. Coverage passed at
  86.85% statements, 76.47% branches, 93.38% functions and 87.60% lines.
- Clean chronological installation and populated R1-P09â†’R1-P10 upgrade proofs
  both passed on the approved disposable `cleanora_r1_p10_proof` target.
- Typecheck, Prisma, build, source/test/script lint for the intended tree,
  OpenAPI, Postman, documentation, module-boundary and whitespace gates passed.
- Companion records the feature at `implement/completed` through its canonical
  lifecycle writer.

No next phase is activated by this decision. Completion does not authorize
staging, commit, push, merge, deployment, production migration, history
rewriting or destructive cleanup. Git publication still requires a separate
human message whose entire content is exactly `commit and push`.

## DEC-062 â€” R1-P11 activation and delegated owner authority

**Date:** 2026-09-09
**Status:** Approved â€” explicit human-owner phase activation with delegated
Codex decision and completion authority for R1-P11 only

The human owner activated `R1-P11 â€” Eligibility Engine V1` and authorized:

- Local feature branch `codex/r1-p11-eligibility-engine-v1` from the verified
  P10 baseline (`38f3efa` on
  `codex/r1-p10-availability-capacity-textual-coverage`), preserving all
  inherited dirty-tree work.
- Full preparation through completion for P11 only.
- Codex as project manager, product decision-maker, architecture authority,
  reviewer, and completion approver under delegated owner authority.
- Cursor as implementer for Codex-assigned or Codex-approved tasks.
- Codex to select its reasoned recommended option for every in-scope product or
  technical decision without asking the human, and to approve phase completion
  once required evidence passes.
- Automatic progression through phase gates once their actual requirements pass.

Locked product constraints remain binding. This decision does **not** authorize
staging, commit, push, merge, deployment, production migration, destructive
operations on existing user data, history rewriting, or activation of P12.
Git publication still requires a separate human message whose entire content is
exactly `commit and push`.

Canonical activation: `specs/R1-P11-eligibility-engine-v1/activation.md`.
## DEC-063 â€” Eligibility module ownership and dependency direction

**Date:** 2026-09-09
**Status:** Approved by Codex under delegated owner authority for R1-P11, DEC-062

Introduce one substantive `eligibility` module. It owns orchestration, eligibility
policies, reason vocabulary, evaluation persistence and tables
`eligibility_rule_versions`, `eligibility_evaluations`, and
`eligibility_candidate_results`. Public entry:
`src/modules/eligibility/eligibility.public.ts`.
Providers/Catalog/Configuration retain ownership of their facts; Eligibility
accesses them only through explicit public contracts. Composition may construct
adapters; Eligibility must not import private services, repositories or Prisma
models of other modules.
Rejected: Providers-owned eligibility, shared generic engine, separate
deployable, Browse/Bookings module in P11.

## DEC-064 â€” Evaluation order, complete applicable reasons and candidate scope

**Date:** 2026-09-09
**Status:** Approved by Codex under delegated owner authority for R1-P11, DEC-062

Validate request, trusted invocation and active rule version first. Fixed order:
(1) Catalog service/country applicability; (2) Provider approval/verification/live;
(3) Offering and effective price usability; (4) Textual coverage; (5) Provider
schedule/suspension/pause; (6) Complete-Team validity and whole-interval member
availability; (7) Crew preference; (8) Capacity after crew filtering; (9)
Configured performance gate. Collect all independently evaluable failures with
deduplicated machine-readable reasons. Dependent rules become `NOT_EVALUATED`
when prerequisites fail. Outcomes: `PASS`, `FAIL`, `NOT_APPLICABLE`,
`NOT_EVALUATED`. Normal discovery reuses P10 textual-area candidate lookup;
providers outside discovery scope are not claimed evaluated. Optional internal
explicit-candidate entry point may evaluate a bounded Provider-ID set (not HTTP).
Rejected: first-failure-only, invented defaults, global Provider scans for local search.

## DEC-065 â€” UTC input, P10 zone semantics and service duration

**Date:** 2026-09-09
**Status:** Approved by Codex under delegated owner authority for R1-P11, DEC-062

Require explicit canonical UTC interval `[startsAt, endsAt)`, active textual
country/city, optional district, exact service identity, crew preference and
positive required complete-Team units. Reuse DEC-053/054 calendar behavior via
Configuration country IANA zone. Interval must cover offering estimated duration;
too short excludes with `REQUESTED_INTERVAL_TOO_SHORT`. V1 bounds: positive
duration up to 24 elapsed hours; required units 1â€“50. Capture one trusted
evaluation clock per invocation. Reject ambiguous local timestamps and
caller-controlled historical-time live APIs.

## DEC-066 â€” Consistency and deterministic-result boundaries

**Date:** 2026-09-09
**Status:** Approved by Codex under delegated owner authority for R1-P11, DEC-062

One Eligibility-owned bounded `RepeatableRead` transaction binds discovery,
rule version, database-backed readers and successful persistence. Extend public
factories for transaction-bound execution. Deterministic function:
normalized request + pinned rule/config + captured facts + evaluation time +
engine/calendar version â†’ semantic result. Metadata includes contract/engine
version, rule-version ID/checksum, input/evidence/result hashes, source versions,
zone, calendar runtime version, discovery scope/counts and completeness.
Canonical ID and reason ordering; decimal money strings only. Generated IDs and
timestamps are operational, not semantic equality. Preserve safe decision evidence
within retention.
Rejected: claiming equal query text always yields equal live results; wall-clock
inside rules; indefinite replay of old code.

## DEC-067 â€” Immutable rule versions and configuration

**Date:** 2026-09-09
**Status:** Approved by Codex under delegated owner authority for R1-P11, DEC-062

`eligibility_rule_versions` stores immutable country-scoped rule bundles
(schema version, engine compatibility, rule order, typed parameters,
effective-from, checksum, provenance). Select latest compatible version effective
at evaluation time. Unique country/version and country/effective-from. Seed one
deterministic V1 bundle for Release 1 country; seed is idempotent for identical
content and must not overwrite changed content. Missing/invalid version is hard
error. No rule-authoring HTTP or dynamic code loading. Configuration retains
country/zone/pricing ownership; Eligibility records consumed values/versions.

## DEC-068 â€” Performance data, freshness and cold start

**Date:** 2026-09-09
**Status:** Approved by Codex under delegated owner authority for R1-P11, DEC-062

Ship initial performance gate **disabled**. Provide typed trusted evidence port
and implement/test enabled-gate behavior. Enabled bundle specifies metric key,
minimum threshold, minimum sample count and max evidence age. Below-threshold
excludes with `PERFORMANCE_GATE_FAILED`. Missing/insufficient/stale evidence does
**not** exclude in V1; record distinct `NOT_EVALUATED` diagnostics. Malformed or
reader-outage evidence is technical failure. No production metric producer or
Ratings module in P11; tests supply controlled evidence.
Rejected: missing equals zero; silently enabling invented ratings.

## DEC-069 â€” Evaluation persistence, atomicity and retention

**Date:** 2026-09-09
**Status:** Approved by Codex under delegated owner authority for R1-P11, DEC-062

Persist every successful completed application evaluation (including empty
candidates) atomically with Provider/Team result rows. Pure policy tests need not
persist. Store normalized non-contact inputs, pinned rule metadata, safe evidence,
ordered outcomes/reasons and sorting facts. No raw addresses, customer identity,
Worker identities, contacts, verification docs or payout identifiers. Typed
candidate identities with separate uniqueness for Provider-only and Team rows.
Immutable while retained. **30-day** retention from completion; Eligibility-owned
bounded idempotent purge (scheduling optional). Persistence failure fails the
operation. Fresh evaluations per invocation; request hash is not a unique key.
Does not authorize deleting inherited/existing user data.

## DEC-070 â€” Internal API, privacy and authorization

**Date:** 2026-09-09
**Status:** Approved by Codex under delegated owner authority for R1-P11, DEC-062

P11 exposes **in-process public module contracts only** â€” no eligibility HTTP.
Composition supplies the service to approved consumers. Separate detailed
internal diagnostic result from safe Browse-consumer projection (eligible
identities + allowlisted commercial/availability facts; omit rejected diagnostics
and member-level evidence). No historical-evaluation browsing surface.
Rejected: public diagnostic endpoints; exposing internal reasons because labelled
â€œinternal.â€‌

## DEC-071 â€” Expected exclusions versus technical failures

**Date:** 2026-09-09
**Status:** Approved by Codex under delegated owner authority for R1-P11, DEC-062

Expected business failures exclude the candidate and continue evaluation.
Malformed global input, missing rule version, dependency/DB failure, invalid DTO,
exhausted transaction conflict or persistence failure fails the **whole
evaluation** with typed error â€” no apparently complete partial list. Retry whole
transaction at most three attempts for recognised retryable failures. Preserve
P09 `CONFLICT` as technical failure, never `UNAVAILABLE`.
Rejected: catch-all empty arrays; silent per-candidate technical drops.

## DEC-072 â€” Minimum honest Browse integration

**Date:** 2026-09-09
**Status:** Approved by Codex under delegated owner authority for R1-P11, DEC-062

Implement Eligibility-owned composition-wired facade `getStandardBrowseCandidates`
calling the same evaluator and mapping to the safe candidate projection. No
independent filtering, HTTP, marketplace cards, ranking, pagination or Bookings.
Integration tests invoke the composed facade against real P09/P10-backed facts.
DoD: **P11 supplies and proves the Browse-use application contract; P12 mounts
the marketplace consumer.** Preserve `eligibleForPublicBrowse: false` placeholder
on Providers setup readiness; do not treat it as a P11 exclusion filter.

## DEC-073 â€” Reuse and exact public-contract extensions

**Date:** 2026-09-09
**Status:** Approved by Codex under delegated owner authority for R1-P11, DEC-062

Reuse Catalog, ProviderServiceSnapshotReader, ProviderPublicReader,
ProviderOperationalAvailabilityReader, ProviderWorkforcePublicReader and
Configuration readers; add transaction-bound paths and minimal Team-level /
eligibility projections as required for atomic evaluation. Applicable
verification uses Providers-owned satisfied/not-required rules. No direct foreign
Prisma access or copied calendar/price logic inside Eligibility.

## DEC-074 â€” Crew preference and capacity after filtering

**Date:** 2026-09-09
**Status:** Approved by Codex under delegated owner authority for R1-P11, DEC-062

Crew preferences: `all_male`, `all_female`, `any`. Apply gender preference to
members with `cleans=true`. Escorts (`cleans=false`) add no capacity units but
must be active/available with the complete Team; escort gender does not
disqualify cleaning-crew gender match. Capacity = count of complete, available,
crew-matching Teams, capped by Provider simultaneous-Team limit. Return all
qualifying Team alternatives with aggregate capacity limit (alternatives do not
imply simultaneous booking of all).

## DEC-075 â€” Sorting inputs and bounded work

**Date:** 2026-09-09
**Status:** Approved by Codex under delegated owner authority for R1-P11, DEC-062

Return price, minimum charge, currency, price-unit identity, estimated duration,
matching capacity, optional valid performance facts and stable Provider/Team IDs.
Canonical order: Provider ID then Team ID. Bounds: **500** discovered/explicit
Providers and **5,000** Team results per evaluation. Overflow â†’
`EVALUATION_LIMIT_EXCEEDED` (no silent truncation). No premium boosts or
synthetic ratings.

## DEC-076 â€” Migration scope

**Date:** 2026-09-09
**Status:** Approved by Codex under delegated owner authority for R1-P11, DEC-062

One additive migration `prisma/migrations/r1_p11_eligibility_engine_v1/`. Add
three tables, constraints/indexes and deterministic rule seed. Clean proof:
complete chronological history. Upgrade proof: populated P10 â†’ P11 preserving
earlier data. Expected ~18 migrations / ~96 tables under P10 counting convention,
verified not assumed. No applied-migration edits or geo tables.

## DEC-077 â€” R3 extension boundary

**Date:** 2026-09-09
**Status:** Approved by Codex under delegated owner authority for R1-P11, DEC-062

Keep typed rule context and versioned identities for future geo rules. P11
accepts textual location only; reject unsupported geographic input explicitly.
No coordinates, radius, distance, geo module or dormant geographic persistence.

## DEC-078 â€” Validation scope and automatic progression

**Date:** 2026-09-09
**Status:** Approved by Codex under delegated owner authority for R1-P11, DEC-062

P11 requires phase tests/coverage **and** repository regression gates. Phase
coverage â‰¥ 80% statements, 75% branches, 80% functions, 80% lines including new
code and changed seams. Repository coverage meets configured thresholds. P10
phase-only exemption does not carry forward. Inherited failures reported with
baseline evidence. Automatic progression after actual gates pass. Completion is
not Git/deploy authorization.

## DEC-079 â€” Concrete participant and public projection design

**Date:** 2026-09-09
**Status:** Approved by Codex under delegated owner authority for R1-P11, DEC-062

Composition-supplied transaction-bound factories with opaque transaction context; bound readers must not open nested/independent transactions. ID-based Eligibility inputs; resolve country via Configuration public reader and service via Catalog ID lookup. Locale-independent Providers eligibility pricing projection reusing P09 selection/usability (no invented locale). Separate normal-discovery and explicit-Provider entry points; `providerIds` forbidden on Browse facade. Providers return Team validity/availability plus aggregate cleaner-gender counts and Escort-validity facts â€” no Worker IDs/raw member arrays at Eligibility boundary. Methods return Promise<SuccessDto>; business exclusions are successful diagnostics; technical errors reject. Refines DEC-066/070/073.

## DEC-080 â€” Rule prerequisites and final eligibility

**Date:** 2026-09-09
**Status:** Approved by Codex under delegated owner authority for R1-P11, DEC-062

Evaluation order is presentation order, not universal prerequisites. Preconditions are required facts; independent readable facts still evaluate on non-live Providers. Unknown/inactive textual ancestry is global validation failure. Provider eligibility requires all applicable Provider gates, sufficient crew-filtered capacity, and â‰¥1 qualifying Team. Disabled/missing/stale optional performance does not falsify that predicate. Team eligibility requires Team qualifies AND Provider qualifies. Provider capacity/performance failure excludes all Team alternatives. One invalid Team does not exclude a Provider with other qualifying Teams. Disabled performance = NOT_APPLICABLE (port not called). Enabled missing/stale/insufficient = NOT_EVALUATED informational. Rejected rows need â‰¥1 real exclusion reason; informational diagnostics are not exclusion reasons. Refines DEC-064/068/074.

## DEC-081 â€” Invocation clock and reproducible evidence

**Date:** 2026-09-09
**Status:** Approved by Codex under delegated owner authority for R1-P11, DEC-062

Capture evaluatedAt once before the retry loop; reuse across â‰¤3 attempts. Each retry gets a fresh DB snapshot and reselects the effective bundle against the same captured instant; discard failed-attempt evidence. SHA-256 over UTF-8 canonical JSON (sorted keys, defined array order, no undefined, UTC timestamps, canonical decimals). evaluatedAt is semantic; only generated IDs/trace/duration/persistence timestamps are non-semantic. Performance evidence includes metric identity, policy/version identity, decimal value, sample count, observedAt; Eligibility computes freshness. No slow external calls inside the transaction. Persist normalized rule inputs and owned-reader outcomes sufficient for Eligibility decision replay without Worker identities. Refines DEC-065/066/068.

## DEC-082 â€” Persistence and seed invariants

**Date:** 2026-09-09
**Status:** Approved by Codex under delegated owner authority for R1-P11, DEC-062

Text-backed IDs; evaluation/candidate IDs UUID strings; fixed deterministic text ID for seeded rule bundle. schemaVersion text; rowKind enum PROVIDER_SUMMARY | TEAM_RESULT. Exactly one Provider summary per evaluated Provider (including excluded/nonexistent explicit). Team rows only for actual evaluated Teams. Enforce rowKind/teamId XOR and both partial uniqueness constraints. Restrictive FKs for rule country and evaluationâ†’rule; evaluation country agrees with selected rule. Provider/Team result IDs are historical logical references without live FKs (explicit nonexistent Providers must remain representable). Required createdAt; expiresAt = completedAt + 30 elapsed days. Purge: fixed cutoff per invocation, order (expiresAt, id), default batch 100, max 500, return deleted counts + moreRemaining. Initial bundle r1-v1 for Egypt EG effective 2026-09-09T00:00:00.000Z. Seed verifies all immutable fields including country/version/effective, not checksum alone. Refines DEC-067/069/076.

## DEC-083 â€” Minimal Batch A and evidence requirements

**Date:** 2026-09-09
**Status:** Approved by Codex under delegated owner authority for R1-P11, DEC-062

T007 creates only substantive approved declarations in eligibility.public.ts â€” no empty layer folders, barrels, fake runtime stubs. Later tasks add concrete files when needed under compact module convention. T006 must pass before Batch A acceptance. Phase selection is exact allowlist of P11 suites plus explicitly named changed-seam suites. Batch A must pass selection/boundary tests, fixture compilation, typecheck and relevant lint with actual outcomes. Coverage scripts may exist before substantial coverage; do not claim coverage pass early. Refines Batch A / DEC-063 scaffolding.

## DEC-084 â€” Final P11 contract and persistence clarifications

**Date:** 2026-09-09
**Status:** Approved by Codex under delegated owner authority for R1-P11, DEC-062

Refines DEC-079â€“082. Does not reopen phase scope. Full repair instructions:
`specs/R1-P11-eligibility-engine-v1/preparation-rereview-report.md`.

**Dependency contracts:** Name actual reused Catalog/Configuration methods
(`createTransactionalActiveCountryReader` / `getActiveCountryById`; locality/TZ
readers; `createTransactionalCatalogDefinitionReaderFactory`,
`getProviderOfferingReference`, `resolveSelectableProviderOffering`). Mutually
exclusive pricing: `AVAILABLE` (non-null money facts) | `UNAVAILABLE` (business
reason) | technical `CONFLICT` rejects. Explicit business-result variants for
missing Provider/config facts (no invented zeros). Bounded Team retrieval with
remaining Team budget + `OVERFLOW`; Providers evaluated in canonical order;
query at most budget+1 sentinel. Lifecycle/Team aggregate invariants; Escort
fields express Providers-owned validity and do not require every Team to
contain an Escort.

**Outcomes/reasons:** Required typed `evaluationOutcomes` on
`DiagnosticResult` / persisted semantic result (Catalog outcome even with zero
Providers). Closed `EligibilityRuleId` union. Well-formed unknown/inactive/
unavailable service â†’ Catalog business outcome (not hard error); malformed
service input and unknown/inactive textual ancestry remain global validation
failures. Expected absence â†’ dependent `NOT_EVALUATED`; reader outage/invalid
DTO â†’ whole-evaluation failure. Team-scoped `TEAM_STRUCTURALLY_INVALID`;
`NO_VALID_COMPLETE_TEAM` remains Provider summary. Public `EligibilityError` is
an interface extending `Error` (declaration-only for T007).

**Evidence/hashes:** Typed `EligibilityEvidenceSnapshot`. Exact hash inputs:
`requestHash` / `evidenceHash` / `resultHash` with null-vs-omit and array
ordering defined. Performance port returns complete evidence or `MISSING` only;
Eligibility checks samples/freshness/value; request includes rule-version
identity; returned `policyVersionId` must match. Concurrent mutation may
succeed on one consistent snapshot; retry only recognised transaction failures.

**Persistence/purge:** Rule versions unique `(id, countryId)`; evaluations
composite FK `(ruleVersionId, countryId)`. Retention **720 elapsed hours**
(`interval '720 hours'`). Purge `batchSize` integer 1â€“500 only (default 100);
reject invalid. No caller-supplied `asOf` on production purge; composition clock.

## DEC-085 â€” R1-P11 Complete

**Date:** 2026-09-09
**Status:** Approved by Codex under delegated owner authority for R1-P11, DEC-062

R1-P11 â€” Eligibility Engine V1 is Complete. Live evaluate, overflow, concurrent
snapshot and Browse-facade proofs passed on disposable `cleanora_r1_p11_proof`.
Phase coverage meets FR-032. Clean chronological install and populated R1-P10
upgrade validators passed. Review verdict is PASS with no unresolved BLOCKER or
MAJOR. Companion records `implement/completed`.

This decision does **not** activate R1-P12, and does **not** authorize merge,
deployment, production migration, force-push, or history rewriting. Git
publication of the local feature branch remains a separate owner-requested
action and still excludes those operations.

Canonical closure: `specs/R1-P11-eligibility-engine-v1/completion-report.md`.

## DEC-086 â€” R1-P12 preparation acceptance (MVB Browse HTTP)

**Date:** 2026-09-10
**Status:** Approved by Codex PM consultation (`gpt-5.6-sol` / `xhigh`) under
`/work-on-next-phase` preparation acceptance (thread
`01a0883e-4163-7483-8c53-2543cf0daee8`)

R1-P12 is activated as the sole active phase. Implementation of tasks T001â€“T036
is authorized for continuous Cursor delivery without mandatory batch gates.

Locked MVB holdings include: new `bookings` module owning `/api/v1/browse/*`;
Eligibility via `getStandardBrowseCandidates` only; optional Bearer with guest
access; contact-free projections (gallery yes, raw contacts no); deferred
optional analytics tables; no ratings invention; standard price/id sort; cursor
pagination with detail re-evaluation; Configuration public locality lists;
Providers signed contact-free preview; no booking mutation; reject
coordinates/radius/map/socket; phase coverage 80/75/80/80; migration N/A unless
schema is added.

Named exceptions:

- **EX-01**: Media signing failure omits the failed logo/cover/gallery item
  without failing the whole Browse response.
- **EX-02**: Tests must explicitly prove Browse creates no booking and initiates
  no payment.

This decision does **not** authorize phase Complete, commit, push, merge,
deployment, production migration, force-push, or history rewriting. DEC-062
completion authority does not carry forward. Final review remains a separate
Codex consultation before READY_FOR_OWNER_REVIEW.

Canonical record:
`specs/R1-P12-browse-marketplace-provider-details/preparation-acceptance-pm02.md`.

## DEC-087 â€” R1-P12 owner substitution for Codex final review

**Date:** 2026-09-10
**Status:** Approved by human owner (option 2) after Codex final-review
consultations timed out with websocket 503 and no verdict

The required R1-P12 Codex final adversarial review remains **unavailable**. The
owner explicitly substitutes owner review for that consultation so the phase may
reach **READY_FOR_OWNER_REVIEW**.

This substitution does **not** invent a Codex PASS. Gate evidence and Cursor
boundary checks remain the technical basis for readiness. This decision does
**not** authorize phase Complete, commit, push, merge, deployment, production
migration, force-push, or history rewriting.

Canonical record:
`specs/R1-P12-browse-marketplace-provider-details/review-report.md`,
`specs/R1-P12-browse-marketplace-provider-details/work-on-next-phase-progress.md`.

## DEC-088 â€” Complete Git staging and `commit and push plus`

**Date:** 2026-09-10
**Status:** Approved by human owner (explicit skill update request)

`commit and push` must stage the complete remaining working tree, including
skills, docs, specs, Cursor/Codex/agent files, and leftover inherited files.
Agents must not omit those paths as â€œunintendedâ€‌ or â€œunrelatedâ€‌. Secrets,
credentials, `.env` files other than `.env.example`, and gitignored junk stay
excluded.

The exact message `commit and push plus` is a second Git trigger for leftover
or tiny follow-up files. It commits them and pushes directly to `main` without
a pull request. It does not merge a feature branch, deploy, run a production
migration, force-push, or rewrite history.

Canonical record: `docs/ai/workflows/commit-and-push.md`,
`docs/ai/workflows/commit-and-push-plus.md`.

## DEC-089 â€” Combined P11 follow-up + P12 review PASS

**Date:** 2026-09-10
**Status:** Recorded after owner instruction to repair unpublished P11 follow-ups
and review both phases together before publication

The unpublished P11 Eligibility follow-up repairs and R1-P12 Browse HTTP are
reviewed together as one publication package. Technical verdict is **PASS** with
no unresolved BLOCKER or MAJOR. DEC-085 remains the historical P11 completion
record; this decision does not mark R1-P12 Complete.

This decision does **not** authorize commit, push, merge, deployment, production
migration, force-push, or history rewriting. Publication still requires a new
human message exactly equal to `commit and push`.

Canonical record:
`specs/R1-P12-browse-marketplace-provider-details/review-report.md`,
`specs/R1-P11-eligibility-engine-v1/follow-up-review-resolution.md`.

## DEC-090 â€” R1-P12 Complete and R1-P13 activation

**Date:** 2026-09-10
**Status:** Approved by human owner (explicit `/work-on-next-phase` plus
`/goal` to activate and complete R1-P13), using Codex on Windows user `hossa`

The owner instructed the next-phase workflow to activate and complete
R1-P13 â€” Booking Draft, Pricing Snapshot & Status Machine. R1-P12 had already
reached READY_FOR_OWNER_REVIEW with combined review PASS (DEC-089). That
advance is treated as completion of R1-P12 and activation of R1-P13 as the
sole active phase.

- R1-P12 is Complete. Browse HTTP, privacy projections, and API artifacts
  remain as reviewed. No P12 schema/migration was required.
- R1-P13 becomes the sole active phase for Spec Kit preparation, Cursor
  implementation, bounded Codex PM/review (`gpt-5.6-sol` / `xhigh` /
  `service_tier=priority` on the `hossa` Codex home), and
  READY_FOR_OWNER_REVIEW.
- OQ-010 is frozen under DEC-091 (Codex PM ACCEPT_IMPLEMENTATION).
- Unpublished P12 work stays in the working tree; publication still requires
  a later exact human message `commit and push`.

This decision does **not** authorize R1-P13 Complete, commit, push, merge,
deployment, production migration, force-push, history rewriting, payment
capture, ledger, wallets, Docker, or cloud.

Canonical record:
`specs/R1-P12-browse-marketplace-provider-details/completion-report.md`,
`specs/R1-P13-booking-draft-pricing-snapshot-status-machine/activation.md`.

## DEC-091 â€” R1-P13 OQ-010 freeze and in-scope implementation acceptance

**Date:** 2026-09-10
**Status:** Approved by Codex PM (`gpt-5.6-sol` / `xhigh` / `priority` on Windows
user `hossa`) via `/codex-delegate` read-only relay

Codex returned `VERDICT: ACCEPT_IMPLEMENTATION` for tasks T001â€“T038. OQ-010 is
frozen as written in the P13 spec Clarifications:

- Statuses: `DRAFT | AWAITING_DEPOSIT | CONFIRMED | CANCELLED`
- Executable customer transitions: `NONEâ†’DRAFT`, `DRAFTâ†’AWAITING_DEPOSIT`,
  `DRAFT|AWAITING_DEPOSITâ†’CANCELLED`
- Emergency is `emergencySignaled` (default false), not a status and not HTTP
- Snapshots freeze exactly on `DRAFT â†’ AWAITING_DEPOSIT`
- Configuration owns `commercial.deposit_percent` (Egypt 25); fail closed
- Eligibility uses `evaluateEligibility` explicit mode; selected team must be eligible
- Cancel records history and closed reasons with **no fees**

Named exceptions **EX-01, EX-02, EX-03 KEEP unchanged**. No additional exception.

This decision does **not** authorize phase Complete, Git publication, payments,
ledger, wallets, Staff override HTTP, Docker, or cloud.

Evidence: Codex thread `01a08b89-20e3-79c3-ba81-8998b18f980b`,
`C:\Users\hossa\AppData\Local\Temp\delegate-relay\Cleanora_R1-2026-09-10T13-36-53-560Z\result.json`.

## DEC-092 â€” R1-P13 owner substitution for Codex re-review

**Date:** 2026-09-10
**Status:** Approved by human owner (explicit â€œcomplete without Codexâ€‌
because Codex hit the usage-time limit)

The required R1-P13 Codex re-review after call-4 FAIL and Cursor repairs is
**unavailable**. Codex budget is exhausted (4/4 calls, ~16 of 20 delegated
minutes) and the owner hit the Codex usage-time limit. The owner substitutes
owner review for that re-review so the phase may reach
**READY_FOR_OWNER_REVIEW**.

This substitution does **not** invent a Codex PASS. Historical call-4 verdict
remains FAIL. Cursor remediations, file:line evidence in
`review-resolution.md`, and Cursor phase/repo gates remain the technical
basis for readiness. Live clean/upgrade proofs stay **BLOCKED** on missing
`CLEANORA_R1_P13_DATABASE_URL` (SC-010 / T035).

**Later the same day:** live proofs ran against a new empty disposable Neon
project naming `cleanora_r1_p13_proof`. Clean install, populated P11â†’P13
upgrade, and trigger rewrite proofs are recorded **PASS** in
`specs/R1-P13-booking-draft-pricing-snapshot-status-machine/migration-evidence.md`.
DEC-092's owner substitution is unchanged. This still does **not** invent a
Codex PASS.

**2026-09-11 technical follow-up:** the owner's new request to review Phase 13
enabled a fresh in-thread Codex review after the historical delegation budget
incident. That separate review inspected the repaired working tree, reran the
Phase 13 and live migration gates on the final bytes, and returned PASS with no
unresolved BLOCKER, MAJOR, or MINOR. The earlier delegated FAILs and DEC-092's
historical substitution remain recorded as the outcomes they were; neither is
retroactively relabeled.

This decision does **not** authorize phase Complete, commit, push, merge,
deployment, production migration, force-push, or history rewriting.

Canonical record:
`specs/R1-P13-booking-draft-pricing-snapshot-status-machine/review-report.md`,
`specs/R1-P13-booking-draft-pricing-snapshot-status-machine/work-on-next-phase-progress.md`.

## DEC-093 â€” R1-P13 Complete and R1-P14 activation

**Date:** 2026-09-11
**Status:** Approved by human owner (explicit `/work-on-next-phase` plus
instruction to activate phase 14 and work on it)

The owner instructed the next-phase workflow to activate and complete
R1-P14 â€” Financial Ledger & Payment Architecture. R1-P13 had already reached
READY_FOR_OWNER_REVIEW with a fresh Codex re-review PASS. That advance is
treated as completion of R1-P13 and activation of R1-P14 as the sole active
phase, matching the DEC-090 P12â†’P13 precedent.

- R1-P13 is Complete. Booking draft, server quote/deposit, snapshot freeze,
  status matrix, and cancel-without-fees remain as reviewed.
- R1-P14 becomes the sole active phase for Spec Kit preparation, Cursor
  implementation, bounded Codex PM/review when the locked dials are available,
  and READY_FOR_OWNER_REVIEW.
- Unpublished P13 work stays in the working tree / feature-branch history;
  publication still requires a later exact human message `commit and push`.
- Companion `mark-complete` was skipped: P13 has no `.spec-context.json`, and
  `python3` on this host is the Windows Store stub.

This decision does **not** authorize R1-P14 Complete, commit, push, merge,
deployment, production migration, force-push, history rewriting, payment
capture, webhooks, stored-value wallets, Docker, or cloud.

Canonical record:
`specs/R1-P13-booking-draft-pricing-snapshot-status-machine/completion-report.md`,
`specs/R1-P14-financial-ledger-payment-architecture/activation.md`.

## DEC-094 — R1-P14 completion

**Date:** 2026-09-12
**Status:** Approved — explicit human-owner phase completion

After receiving the READY_FOR_OWNER_REVIEW handoff (Codex T031 PASS), the
owner stated: `mark P14 complete`.

- R1-P14 is Complete. Append-only ledger, system accounts, balanced journals,
  adjustments, snapshots, derived balances, booking reconciliation, idempotency,
  and the wallet ban remain as reviewed. Zero payments/ledger HTTP shipped.
- Tasks T001–T032 are checked. Codex final review T031 returned PASS with no
  unresolved BLOCKER or MAJOR.
- Phase tests passed 8 files / 37 tests. Coverage passed at 89.23% statements,
  80.66% branches, 98.59% functions, and 88.84% lines.
- Live clean install and populated P13→P14 upgrade proofs passed on disposable
  `cleanora_r1_p14_proof`. Typecheck, Prisma, OpenAPI, Postman, and docs gates
  passed as recorded in the handoff.
- Companion `mark-complete` is skipped: `python3` on this Windows host is the
  Microsoft Store stub (same as DEC-093). Cleanora Complete is this decision
  plus the phase completion report.

No next phase is activated by this decision. Completion does not authorize
staging, commit, push, merge, deployment, production migration, history
rewriting, payment capture, webhooks, stored-value wallets, Docker, or cloud.
Git publication still requires a separate human message whose entire content
is exactly `commit and push`.

Canonical record:
`specs/R1-P14-financial-ledger-payment-architecture/completion-report.md`,
`specs/R1-P14-financial-ledger-payment-architecture/handoff-ready-for-owner-review.md`.

## DEC-095 — R1-P15 completion

**Date:** 2026-09-13
**Status:** Approved — explicit human-owner phase completion

After receiving the READY_FOR_OWNER_REVIEW handoff (Cursor interim PASS after
remediated Codex final BLOCKED migration/typecheck findings), the owner
stated: `mark complete`.

- R1-P15 is Complete. Deposit methods, idempotent initiate, browser return
  (status only), verified Paymob webhook → SUCCEEDED + DEPOSIT journal +
  receipt + Bookings `confirmDepositPayment`, staff method toggle, and
  refund-request foundation remain as reviewed. No stored-value wallets or
  invented InstaPay.
- Phase tasks are checked. Codex prep-accept returned ACCEPT_IMPLEMENTATION.
  Codex final review was BLOCKED then remediated; Cursor post-fix interim
  PASS with no unresolved BLOCKER or MAJOR (Codex budget exhausted).
- Phase tests and coverage passed as recorded in the handoff
  (89.47% statements, 78.87% branches, 98.8% functions, 89.32% lines).
- Live clean install and populated P14→P15 upgrade proofs passed on disposable
  `cleanora_r1_p15_proof`. Typecheck, OpenAPI, Postman, and docs gates passed
  as recorded in the handoff.
- Companion `mark-complete` refused: no finished Companion implement context
  for the feature directory. Cleanora Complete is this decision plus the phase
  completion report.

No next phase is activated by this decision. Completion does not authorize
staging, commit, push, merge, deployment, production migration, history
rewriting, stored-value wallets, invented InstaPay, Docker, or cloud. Git
publication of any leftover working-tree files still requires a separate human
message whose entire content is exactly `commit and push` or
`commit and push plus`.

Canonical record:
`specs/R1-P15-deposit-payments-methods-webhooks/completion-report.md`,
`specs/R1-P15-deposit-payments-methods-webhooks/handoff-ready-for-owner-review.md`.
