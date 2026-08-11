# Cleanora — Decision Log

> This file records approved project decisions that clarify delivery timing or terminology.
> It does not silently rewrite locked product behavior in `vision.md`.

---

## DEC-001 — Three-release delivery model

**Date:** 2026-07-23
**Status:** Approved

The product will be delivered through three releases:

1. Release 1 — Core Marketplace
2. Release 2 — Marketers & Growth
3. Release 3 — Smart Marketplace

Bassam's P0–P5 labels remain useful as historical product prioritization, but the implementation roadmap uses these three releases.

---

## DEC-002 — Release 1 is a large end-to-end marketplace

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

## DEC-003 — No internal Cleanora wallets

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

Any source-document reference to a provider or marketer “wallet” must be interpreted as an external payout method unless product explicitly changes this decision.

---

## DEC-004 — Maps and WebSockets are deferred to Release 3

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

## DEC-005 — Eligibility engine is built in two versions

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

## DEC-006 — Money closure moves into Release 1

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

## DEC-007 — Marketers and Premium are Release 2

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

## DEC-008 — Basic ratings and reviews are Release 1

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

## DEC-009 — Panic core is Release 1; live location is Release 3

**Date:** 2026-07-23
**Status:** Approved

Release 1 provides emergency state, alerts, dossier, audit, and controlled clearing.

Release 3 adds:

- Consent-based live location
- Realtime emergency updates
- Live map visualization

---

## DEC-010 — Admin control is split by dependency

**Date:** 2026-07-23
**Status:** Approved

Release 1 includes all admin actions that do not require maps or marketer modules.

Release 2 adds marketer and premium administration.

Release 3 adds live map and realtime operations.

---

## DEC-011 — Google sign-in is part of complete authentication

**Date:** 2026-07-23
**Status:** Approved product addition

Google sign-in is included in Release 1 authentication.

It does not replace the actor-specific verification rules. Required phone or email verification still applies based on account type.

---

## DEC-012 — Cleanora is a standalone greenfield project

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

## DEC-013 — Product sources remain traceable

**Date:** 2026-07-23
**Status:** Approved

Bassam's four documents remain unchanged source references.

`vision.md` is the consolidated canonical implementation vision.

`decision-log.md` records approved timing and terminology decisions.

`roadmap.md` controls delivery order.

`open-questions.md` blocks invention.

---

## DEC-014 — Prisma schema and migrations evolve phase by phase

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

## DEC-015 — Release 1 Google sign-in is individual-only

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

## DEC-016 — R1-P02 temporary branch-coverage debt (not a DoD exception)

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

## DEC-017 — Development-only SMS delivery redirect

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

## DEC-018 — Browser-safe Google callback and phone verification

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

## DEC-019 — Development-only Google browser result page

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

## DEC-020 — Descriptive API failures and practical password policy

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

- 7–128 characters and no more than 512 UTF-8 bytes;
- no character-class composition requirement;
- numbers-only values are permitted; and
- common values, one/repeated patterns, and ascending or descending numeric
  sequences are rejected.

---

## DEC-021 — Aggregate validation and explicit cookie names

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

## DEC-022 — Aggregate safe signup identifier conflicts

**Date:** 2026-07-27
**Status:** Approved by human owner

When a valid public signup contains both an already-registered phone and an
already-registered email, Cleanora returns one
`409 AUTH_SIGNUP_IDENTIFIERS_ALREADY_REGISTERED` response with `phone` and
`email` entries in `error.details.issues`. Single-field conflicts retain their
existing stable codes.

This extends the human-approved signup-only disclosure from DEC-020. It returns
only field names, stable reasons, and safe messages—never submitted values,
account records, ownership relationships, or identity details. Passwords are
not unique identifiers, are never compared across accounts, and must never be
reported as duplicate.

---

## DEC-023 — Google phone OTP temporary email delivery

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

## DEC-024 — Account-bound OTP delivery and frontend-only Google handoff

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

## DEC-025 — Google presentation claims for frontend authentication

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

## DEC-026 — Four-digit password-reset code with opaque correlation

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

## DEC-027 — Explicit hosted-preview SMS-to-email fallback

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

## DEC-028 — Email-only R1-P02 authentication; phone verification deferred

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

## DEC-029 — R1-P03A production role-provisioning boundaries

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

## DEC-030 — Junior-friendly MVP staff-admin and customer authorization

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

## DEC-031 — R1-P04 planning authority, outcomes, and retention

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

## DEC-032 — R1-P04 preference PUT full-replacement semantics

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

## DEC-033 — R1-P04 Cloudinary profile-image storage (always replace)

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

## DEC-034 — Category-aware customer signup and contact verification

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

## DEC-035 — Email-only R1-P04A activation; SMS deferred

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

## DEC-036 — Application-based provider ownership and kind-specific readiness

**Date:** 2026-08-10
**Status:** Approved by human owner for R1-P05; implementation and internal validation recorded 2026-08-11 — independent review (T158) and human Complete approval (T159) still pending; phase not formally Complete; next phase not activated; no deployment or production migration

This decision activates R1-P05 for specification preparation and supersedes
the direct Provider Owner signup and self-enrollment direction in DEC-034 and
DEC-035. It does not alter R1-P04A's historical delivered behavior; the runtime
change belongs to the separately authorized R1-P05 implementation workflow.

**Implementation note (2026-08-11):** R1-P05 implementation tasks through T157
are checked with evidence in
`specs/R1-P05-provider-onboarding-profile-lifecycle/completion-report.md`.
T158 independent review and T159 human Complete approval remain open.

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
