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
