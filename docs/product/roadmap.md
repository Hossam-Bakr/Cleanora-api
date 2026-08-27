# Cleanora — Releases & Vertical-Slice Roadmap

| Field | Value |
|---|---|
| Product | Cleanora |
| Delivery Model | Three releases |
| Current Release | Release 1 |
| Current Phase | See `docs/product/current.md` (canonical live phase pointer) |
| Vision | `vision.md` |
| Approved Decisions | `decision-log.md` |
| Open Product Rules | `open-questions.md` |
| Live Pointer | `current.md` |

---

## 1. How to use this roadmap

This roadmap defines **when and how** the product vision is implemented.

Before starting any phase:

1. Read `vision.md`.
2. Read relevant entries in `decision-log.md`.
3. Check `open-questions.md`.
4. Update `current.md`.
5. Create a phase-specific planning file.
6. Implement and review the entire vertical slice.
7. Mark the phase complete only after its Definition of Done passes.

No roadmap item may silently weaken a locked business rule.

---

## 1.1 Standalone project rule

Cleanora must not depend on any previous application or repository.

All phases must assume that the AI/developer has access only to:

- The current Cleanora repository
- The Cleanora documentation pack
- Explicitly configured external services
- The current Cleanora database and migration history

A phase must not instruct the AI to inspect, copy, import, compare with, or remain compatible with an unavailable project.

---

## 2. Vertical-slice rule

Each phase owns one complete domain capability.

A phase includes, when applicable:

- Database design and migration
- Models/entities
- Validation
- Business rules
- Authorization
- Services/use cases
- Controllers/routes
- Background jobs
- Events and notifications
- Unit and integration tests
- API documentation
- Audit behavior
- Frontend integration contract
- Definition of Done review

A feature must not be intentionally split into an unusable half unless the roadmap explicitly defines a foundation phase and its later extension.

---

## 3. Database and Prisma strategy

> **Design globally, implement locally, migrate incrementally.**

### At R1-P00

R1-P00 defines the global database direction only:

- Design the Master ERD for all three releases.
- Define the major entities and relationships.
- Assign every planned table to a release and phase.
- Define Prisma and database conventions.
- Define ID, timestamp, money, enum, soft-delete, audit, indexing, and migration rules.
- Define the Cleanora schema from the approved vision without relying on any previous repository or database.
- Do not fully implement all future tables in `schema.prisma`.

The Master ERD is an architectural map. It is not the first production migration.

### During every later phase

Each phase owns the complete Prisma and migration work required by its vertical slice.

For example, during `R1-P02 — Complete Authentication & Identity`, the AI/developer must:

1. Inspect the current `schema.prisma`.
2. Inspect all existing migrations.
3. Identify the new and changed authentication models.
4. Update `schema.prisma` with only the required models, fields, enums, relations, indexes, and constraints.
5. Create a new named migration for the phase.
6. Review the generated SQL before applying it.
7. Add or update seed data when required.
8. Regenerate Prisma Client.
9. Run migration, schema, integration, and rollback/forward-fix checks.
10. Update the phase documentation with all database changes.

Typical authentication-owned models may include:

```text
users
user_credentials
user_sessions
otp_codes
password_reset_tokens
social_accounts
auth_events
```

The exact model names must follow the approved Prisma conventions and the current schema. They must not be copied blindly from the roadmap.

### Prisma phase rules

For every phase:

- Update `prisma/schema.prisma` as part of the phase.
- Create at least one phase-owned migration when the database changes.
- Use a clear migration name, for example:

```text
r1_p02_complete_authentication
r1_p07_worker_team_management
r2_p03_marketer_commission_engine
```

- A phase may create multiple migrations when technically necessary, but all must remain owned and documented by that phase.
- Do not edit an already-applied production migration.
- Fix an applied migration through a new forward migration.
- Do not reset or delete production migration history.
- Review destructive operations before execution.
- Preserve historical booking, order, review, and financial data.
- Financial records must never be hard-deleted.
- Add indexes and database constraints in the same phase that introduces the query or invariant requiring them.
- Add seed data only for stable configuration, roles, permissions, countries, catalog seeds, or other approved reference data.
- Keep migrations executable from an empty database in chronological order.
- Keep the Prisma schema valid after every completed phase.
- Run `prisma validate`, generate the client, apply the migration in a test database, and run relevant tests before marking the phase done.

### Changing tables from an earlier phase

A later phase may modify an earlier table only when the new vertical slice genuinely requires it.

The phase planning file must list:

- Existing model being changed
- New fields or relations
- Reason for the change
- Migration impact
- Backfill/default strategy
- Compatibility impact
- Tests protecting previous behavior

No AI or developer may silently change an earlier model.

### Future releases

- Do not create Release 2 or Release 3 models early merely because they appear in the Master ERD.
- A small compatibility field may be added early only when a documented dependency proves it is necessary.
- Any early future-release dependency must be recorded in the phase plan and `decision-log.md` when it changes the approved architecture.

### Phase database deliverables

Every database-changing phase must produce:

- Updated `prisma/schema.prisma`
- New migration directory and SQL
- Updated ERD section
- Seed changes when required
- Prisma Client regeneration
- Database-focused tests
- Migration notes in the phase file
- List of new models
- List of changed models
- List of indexes and constraints
- Data migration/backfill notes

---

## 4. Product-control pillars

The following domains must be explicit:

1. **Eligibility engine**
2. **Financial ledger and settlements**
3. **Order status machine**
4. **Admin/operations overrides with audit**

---

## 5. Release alignment with Bassam's product phases

| Product Capability | Bassam Product Timing | Approved Delivery |
|---|---|---|
| Trust core and standard Browse | P0 | Release 1 |
| COD, dues, payouts, ledger | P1 | Release 1 |
| Recommended sockets | P2 | Release 3 |
| Marketers | P3 | Release 2 |
| Premium ranking | P3 | Release 2 |
| Basic ratings/reviews | P4 guidance | Release 1 |
| Rich retention features | P4 | Not in current three releases |
| Maps and live admin map | Listed in early product scope | Release 3 |
| Multi-country launch | P5 | Not in current three releases |
| Internal wallets | Ambiguous terminology | Removed; external payout methods only |

This table changes implementation timing, not the underlying product behavior.

---

## 6. Release summary

| Release | Name | Outcome |
|---|---|---|
| Release 1 | Core Marketplace | Complete normal marketplace from registration through payment, execution, settlement, and review |
| Release 2 | Marketers & Growth | Referral acquisition, commissions, premium providers, and growth administration |
| Release 3 | Smart Marketplace | Maps, geo eligibility, WebSockets, live offers, negotiated pricing, and tracking |

---

# Release 1 — Core Marketplace

## Release objective

Ship a production-capable marketplace without Maps or WebSockets.

### Customer outcome

A customer can:

- Create and verify an account
- Browse providers using normal REST APIs
- Select a provider and service
- Create a booking
- Pay the configured deposit
- Follow the standard order timeline
- Receive a client completion code
- Complete the service
- Pay the remaining amount through the supported method
- Rate the provider and assigned team
- Open a complaint or support request

### Provider outcome

A provider can:

- Register and verify the owner account
- Complete a controlled provider profile
- Add and manage workers and teams
- Configure services and prices
- Define schedules and textual coverage
- Receive and respond to standard bookings
- Assign workers
- Execute orders
- Confirm COD when applicable
- View dues and settlement records
- Receive ratings and reviews

### Staff outcome

Authorized staff can operate identity, providers, catalog, bookings, payments, emergencies, support, configurations, and audit records without direct database edits.

## Release 1 exclusions

- Maps and coordinates
- Radius/distance matching
- WebSockets
- Recommended live offers
- Dynamic negotiated pricing
- Live team tracking
- Admin live map
- Marketers
- Premium provider plans
- Internal wallets
- Coupons
- Recurring packages
- Free in-order chat

## Release 1 Definition of Done

A real customer, provider, worker/supervisor, and staff operator can complete the normal end-to-end journey without manual database changes, hidden scripts, or temporary admin database access.

---

## R1-P00 — Product & Database Architecture

**Status:** `Not Started`

### Goal

Freeze the implementation contract and design the global data model before product migrations.

### Scope

- Consolidated vision review
- Decision log review
- Open-question classification
- Master ERD for all releases
- Entity ownership by release and phase
- Identity model and multi-role strategy
- Provider/team model
- Booking/order boundary
- Financial ledger model
- Country-scoped configuration model
- Media ownership model
- Audit model
- Status-machine design approach
- Naming, ID, timestamps, deletion, enums, money, indexing, and migration conventions
- Standalone Cleanora repository and database boundary

### Database output

No future feature tables should be blindly created.

Deliver under `docs/architecture/`:

- `master-erd.md`
- `database-conventions.md`
- `entity-ownership.md`
- `status-machine-draft.md`

Validate and reference the existing canonical boundary (do not create a duplicate):

- `docs/product/standalone-project-boundary.md`

### Done When

- Every major entity is present in the Master ERD.
- Every planned table has a release and phase owner.
- Internal stored-value wallets do not exist.
- External payout destinations are modeled separately from financial dues.
- Open product questions are visibly marked.
- Architecture review approves the clean-slate model.

---

## R1-P01 — Project Foundation & Country Configuration

### Goal

Create the production-ready technical foundation and Egypt-first configuration model.

### Scope

- Project structure
- Environment validation
- Database connection
- Migration and seed workflow
- Error format
- Logging and request tracing
- Health/readiness endpoints
- API versioning
- Validation foundation
- Test foundation
- OpenAPI foundation
- Security headers
- Rate limiting
- CI checks
- Country, currency, locale, and configuration foundations
- Egypt seed without hard-coded business rules

### Tables

- `countries`
- `currencies`
- `country_configs`
- `app_configs`
- `audit_logs` foundation

### Done When

- Application runs in local and test environments.
- Egypt is enabled by seed data.
- Country-sensitive configuration is read by `countryCode`.
- Migrations, tests, linting, and documentation checks run in CI.
- Error and logging conventions are documented.

---

## R1-P02 — Complete Authentication & Identity

### Goal

Implement the complete Release 1 identity journey in one phase.

### Scope

- Individual signup
- Company signup
- Engineer signup
- Provider-owner signup
- Worker login
- Phone/password login
- Logout and logout-all
- Current-user endpoint
- Required email OTP for individual, company, engineer, and provider-owner activation
- Phone is collected as an unverified contact identifier; ownership verification is deferred to R1-P26
- Forgot/reset/change password
- Access and refresh/session lifecycle
- Session revocation
- Google sign-in and account linking
- Verified Google email activates an Individual identity without a phone gate
- Authentication rate limits and events
- Ban/suspension enforcement at login and request authentication

### Tables

- `users`
- `user_credentials`
- `user_sessions`
- `otp_codes`
- `password_reset_tokens`
- `social_accounts`
- `auth_events`

### Done When

- Every R1-P02 self-signup actor completes the required email verification.
- Google sign-in trusts only Google-verified email and creates no phone-verification claim.
- Worker login is restricted to provider-created workers.
- Session expiry, revocation, and retry behavior are tested.
- Authentication documentation is complete.

---

## R1-P02A — Backend Structure Simplification

### Goal

Simplify the completed R1-P02 backend structure without changing product,
security, API, provider, or database behavior.

### Scope

- Explicit central route map
- Small Express app and HTTP-server composition roots
- Morgan HTTP access logging
- Clear database and middleware locations
- Removal of confirmed structural placeholders and duplicate E2E coverage
- Import, documentation, and boundary cleanup

### Done When

- Existing APIs and R1-P02 behavior remain unchanged.
- Unit and integration evidence passes.
- The source tree contains no module registrar, Pino HTTP logger, E2E suite, or
  empty future feature folders.
- R1-P03 remains inactive until separate human authorization.

---

## R1-P03 — Roles, Permissions & Privileged Audit

### Goal

Make authorization authoritative across customer, provider, worker, and staff operations.

### Scope

- Multi-role users
- Role and permission seeds
- User-role assignment
- Route permissions
- Resource ownership
- Provider membership scope
- Worker scope
- Explicit Provider-scoped Supervisor capability
- Explicit `provider_members.ADMIN` membership authority
- Staff roles: admin, operations, support, finance
- Privileged write reason
- Before/after audit records
- Authorization test matrix

### Tables

- `roles`
- `permissions`
- `role_permissions`
- `user_roles`
- `privileged_action_reasons`
- `audit_logs`

### Done When

- Every protected endpoint declares permission and ownership rules.
- Privileged writes require a reason where configured.
- Supervisor and explicit Provider Admin proxy authority is confined to the
  exact Provider and the granted scope.
- Staff powers are separated and tested.

---

## R1-P03A — Production Role Provisioning

### Goal

Establish an owner-controlled `staff_admin` provisioning path and an
authenticated caller for ordinary non-`customer` role management without
weakening completed authentication or authorization contracts.

### Scope

- Authentication-owned owner-secret internal API for `staff_admin` assign/re-enable
  (`POST /api/v1/internal/owner/staff-admins`, disabled by default)
- Timing-safe secret compare, rate limiting, idempotent atomic audit, no Admin UI
- Minimal authenticated staff-admin role-management surface
- Ordinary assign, revoke, enable, and disable delegation to the completed
  R1-P03 role-management contract for non-`customer` roles
- No Release 1 customer-role provisioning requirement (DEC-030)
- Preservation of R1-P02 authentication and R1-P03 authorization, transaction,
  and audit behavior

### Data boundary

- Authentication retains ownership of the existing authorization entities.
- No new table or schema representation is approved during specification
  preparation; any later data change requires an approved technical plan and a
  phase-owned forward migration.
- No seed, migration, backfill, startup path, category rule, or hidden database
  edit may create a production user-role grant.

### Done When

- Owner-secret `staff_admin` provisioning is disabled by default, idempotent,
  rate-limited, audited, and validated under DEC-030.
- Ordinary non-`customer` role commands use the completed R1-P03 service and
  preserve its permission, reason, transition, transaction, and audit rules.
- Release 1 does not require granting the historical `customer` role for
  customer self-service or marketplace participation.
- Completed R1-P02 authentication contracts remain unchanged.
- The phase passes independent review and validation and the human owner
  explicitly approves it as Complete before R1-P04 resumes.

---

## R1-P04 — Customer Profiles, Preferences & Text Addresses

### Goal

Allow customers to manage identity-adjacent account data without map dependencies.

### Scope

- Customer type profile fields
- Individual/company/engineer profile data
- Profile image
- Phone/email display and verification state
- Language preference
- Notification preferences foundation
- Address book using country, city, district, text, building, floor, and notes
- Account deactivation/deletion request
- Data export foundation

### Tables

- `customer_profiles`
- `company_profiles`
- `engineer_profiles`
- `user_addresses`
- `user_preferences`
- `account_deletion_requests`
- `media_files`

### Done When

- Each customer type has valid profile rules.
- Text addresses are usable for Release 1 booking.
- Address ownership is enforced.
- No coordinate field is required for Release 1.

---

## R1-P04A — Category-Aware Customer Signup & Verification

### Goal

Require the matching customer name/profile at registration while preserving the
current email-only activation model for every supported category.

### Scope

- Strict category-discriminated Individual, Company, and Engineer signup data
- Atomic customer profile creation with signup and category enrollment
- Blocking email OTP activation for every supported category
- Phone values remain unverified; SMS provider selection and phone verification
  are deferred to a later explicitly approved phase
- Nullable Company commercial-registration and tax-registration numbers edited
  after signup
- Fail-closed `SMS_AUTH_ENABLED=false` development configuration
- Additive API documentation and regression coverage

### Tables

- Incremental changes to `company_profiles` only
- Existing `individual_profiles`, `engineer_profiles`, `customer_profiles`,
  `user_credentials`, `user_sessions`, and `auth_events`

### Done When

- No accepted customer signup or customer-category enrollment can activate
  without its matching non-blank profile.
- Every accepted category activation sets email assurance only and never claims
  phone assurance.
- No SMS provider code, phone verification route, or future grace restriction is
  shipped early.
- Company registration identifiers can be completed privately after signup.
- Forward-only migration, contracts, tests, and repository quality gates pass.

---

## R1-P05 — Provider Onboarding, Profile & Lifecycle

**Status (2026-08-11):** **Complete** (T001–T159 checked). Independent review
returned PASS and human completion authorization is recorded. The next phase
is **not** activated. No deployment or production migration occurred.

### Goal

Allow a verified Individual or Company to build a controlled provider profile,
pass staff-admin application review, and prepare the provider for later
marketplace-readiness phases without exposing direct contact details.

### Scope

- Provider application for `INDIVIDUAL_TEAM` and `REGISTERED_COMPANY`
- Removal of direct `PROVIDER_OWNER` signup and self-enrollment
- Business profile with required Arabic and optional English content
- Private operational contacts that are never customer-facing
- Logo, cover, up to 12 gallery images, and up to 2 gallery videos
- Provider OWNER and ADMIN membership plus owner-managed admin invitations
- Kind-specific server-calculated profile completion
- Structured marketplace-readiness gates with owning-phase blockers
- Application states: draft, pending-review, changes-requested, approved, rejected
- Operational states: inactive, live, suspended
- Owner-only submission and resubmission
- Staff-admin approval, changes request, rejection, suspension, and reinstatement
- Auditable status history and decision reasons
- Protected contact-free preview; no anonymous public Browse API in R1-P05
- Provider dashboard summary and aggregated settings experience

### Tables

- `providers`
- `provider_profiles`
- `provider_contacts`
- `provider_members`
- `provider_admin_invitations`
- `provider_gallery_items`
- `provider_status_history`
- `provider_email_outbox`
- `media_files` (existing Media-owned table extended for Provider purposes)

### Done When

- Provider completion percentage and blockers are calculated server-side from
  only the requirements applicable to the provider kind.
- Application approval is distinct from document verification and leaves the
  provider operationally inactive.
- An `INDIVIDUAL_TEAM` has no document requirement; a `REGISTERED_COMPANY`
  remains blocked on the later configurable R1-P06 verification checklist.
- Only approved, complete, fully ready, live providers can eventually become
  public, and R1-P05 itself exposes no anonymous Browse surface.
- Status and review history, actors, reasons, and timestamps are preserved.
- Ownership, OWNER/ADMIN capability boundaries, staff-only review, invitation
  lifecycle, cross-provider denial, and direct-contact privacy are specified
  and tested by the owning implementation phase.

---

## R1-P06 — Provider Verification & External Payout Destinations

**Status (2026-08-14):** **Complete.** Clarification, technical planning,
focused checklists, continuous tasks T001–T137, consistency analysis and
remediation, implementation, review, focused validation, phase-scoped coverage,
API/runtime parity, and the explicitly approved disposable clean-install and
populated R1-P05-upgrade proofs all passed. The human product owner explicitly
approved R1-P06 as Complete. No Git action, deployment, production migration,
real payout execution, or R1-P07 activation was authorized or performed by the
completion decision.

### Goal

Verify provider records and collect approved external settlement destinations without creating internal wallets.

### Scope

- Immutable, effective-dated country-and-kind document-policy versions for
  `REGISTERED_COMPANY`, published only by active Staff Admins
- Required Commercial Registration (`COMMERCIAL_REGISTRATION`)
- Required Tax Registration/Card/Certificate (`TAX_REGISTRATION`)
- No document requirement for `INDIVIDUAL_TEAM`
- Private document upload through Media-owned capabilities
- Private upload accepts one bounded PDF or a bounded ordered JPEG/PNG set,
  explicitly including `.jpg`/`.jpeg` as `image/jpeg`, only after Media-owned
  content validation, malware/safety processing, and `READY` status
- Document review, approval, rejection, replacement, renewal, and expiration
- Immutable linked document versions with risk-aware continuity: voluntary
  successors preserve valid unchallenged approval, while Staff challenge,
  invalidation, and expiry remove credit immediately
- Provider verification history and state, plus protected derived Registered
  Company badge truth; Individual Teams are badge-ineligible and anonymous
  rendering remains owned by R1-P12
- External Mobile Wallet (`MOBILE_WALLET`) payout destinations
- Mobile Wallet drafts owned only by the active exact-Provider `OWNER`, with
  authoritative country, E.164 number, configured country-scoped operator,
  legal holder name, and legal-entity or Provider-Owner relationship
- Manual active-`STAFF_ADMIN` Mobile Wallet holder-name verification through an
  external transfer attempt or beneficiary lookup that stops before transfer
  completion, with no uploaded ownership-evidence file, automated transfer API,
  verification-money movement, payout execution, or settlement record
- External Bank Account (`BANK_ACCOUNT`) payout destinations
- IBAN-first Bank Account drafts owned only by the active exact-Provider
  `OWNER`, with authoritative country, configured payout currency, active
  country-scoped bank, normalized IBAN, legal holder name, and legal-entity or
  Provider-Owner relationship
- Manual active-`STAFF_ADMIN` Bank Account beneficiary-name verification that
  stops before transfer completion, with no uploaded bank-ownership document,
  automated bank API, verification-money movement, payout execution, or
  settlement record
- Primary payout-destination policy and readiness
- At most five active immutable destination chains across both types, each with
  no more than one open linked successor
- One explicit global primary, first-approval initialization, no unrelated
  automatic failover, risk-aware successor continuity, and acknowledged last-
  primary removal
- Authentication-owned re-authentication no older than 10 minutes for Owner
  submission, primary change, withdrawal, and removal
- Safe durable localized-template Owner email intents and a Staff review-queue
  effect, with asynchronous retry that never controls business truth
- AES-256-GCM protection with unique field nonces and bound authenticated context
  for recoverable payout identifiers and holder legal names
- Separate versioned HMAC-SHA-256 duplicate-lookup fingerprints with domain-
  separated Mobile Wallet and Bank Account canonical identities
- Write-only Provider identifiers with exact wallet/IBAN masks, narrower Admin
  projection, and full-or-omitted holder-name visibility
- Purpose-bound Staff verification reveal for one exact pending version, with
  five-minute Authentication step-up, reason, non-cacheable response, safe
  audit-before-return, and a five-per-10-minute per-actor limit
- Fail-closed externally supplied Release 1 encryption and lookup key rings with
  no defaults, complete retained-version coverage, bounded resumable rotation,
  and human-approved retirement; cloud secret-manager integration stays Release
  3 scope
- Missing-destination readiness blocker
- Secure access to private verification documents and payout information
- Audit history for privileged decisions and payout-destination changes
- Integration with the existing `documentsVerified` and
  `payoutDestinationReady` readiness gates

### Persistence families

The roadmap names conceptual families; exact tables, constraints, and ownership
are defined by the R1-P06 data model and phase migration plan:

- configurable document types plus immutable policy versions/items
- Provider document chains, immutable versions, ordered evidence associations,
  Staff reviews, and safe verification history
- payout destination types, country policy, operator registry, and bank registry
- Provider payout chains, immutable versions, protected identity claims and
  versioned lookup fingerprints, Staff decisions, one primary state, safe
  cross-Provider conflict cases, and safe payout history
- Admin-owned safe reveal-attempt/rate evidence and Providers-owned bounded key-
  rotation progress containing no key material
- the existing `provider_email_outbox`, extended only for safe R1-P06 event
  sources/templates
- the existing Media-owned `media_files` plus Media-owned evidence-validation
  receipts; Providers accesses both only through Media's public contract

### Done When

- Registered Company documents can be uploaded, reviewed, replaced, renewed,
  expired, and audited safely while required types remain configurable.
- Submitted document versions are immutable; successor approval supersedes the
  predecessor atomically, rejected voluntary successors do not displace valid
  unchallenged evidence, and all lifecycle history remains attributable.
- Both launch document types enforce the approved common metadata, authoritative
  country and date rules, optional-expiry semantics, complete private evidence,
  ordered additional pages, and snapshotted policy-version requirements.
- Valid evidence is exactly one PDF within 15 MiB/10 pages or 1–10 ordered
  JPEG/PNG pages within 5 MiB each and 20 MiB aggregate; the planned R1-P06 Media
  contract and Cloudinary adapter accept validated `.jpg`/`.jpeg` as
  `image/jpeg`, while invalid or non-`READY` evidence never enters review.
- The launch `EG` document policy has exactly the two approved required types;
  each effective replacement re-evaluates all approved Providers in scope while
  preserving historical policy, evidence, decision, and readiness meaning.
- Individual Team document readiness is `NOT_REQUIRED` and never lowers
  profile completion; its badge truth is `NOT_ELIGIBLE`, not `EARNED`.
- An approved Registered Company badge is `EARNED` exactly while its current
  required document evidence is effective; Staff challenge, invalidation,
  expiry, or a new unmet requirement removes it immediately, while suspension
  does not rewrite protected verification truth.
- Exactly the approved Mobile Wallet and Bank Account destination types are
  collected without moving money or creating balances.
- A submitted Mobile Wallet remains `PENDING_VERIFICATION` and blocks readiness
  until an active Staff Admin approves the exact version after the manual
  external holder-name check; every decision preserves its method, meaningful
  reason or note, actor, timestamp, immutable history, and safe audit evidence.
- Mobile Wallet identity is deduplicated by country plus normalized E.164 number
  regardless of operator. Submitted Provider views are masked, the full number
  is narrowly limited to Staff verification, and only a current active
  `APPROVED` destination can satisfy `payoutDestinationReady`.
- A submitted Bank Account remains `PENDING_VERIFICATION` until an active Staff
  Admin approves the exact version after a manual beneficiary-name check. The
  launch `EG` policy uses `EGP`, an active country-scoped bank, and a normalized
  IBAN without a separate account number, branch, caller-entered SWIFT/BIC, or
  uploaded ownership-evidence document.
- Bank Account identity is deduplicated by normalized IBAN. Ordinary views are
  masked, full-IBAN access is limited to the Staff verification workflow, and
  only a current active `APPROVED` destination can satisfy readiness.
- The final destination transition matrix uses the nine approved states;
  submitted versions are immutable, voluntary successors preserve approved
  unchallenged continuity, Staff challenge removes credit immediately, terminal
  history is retained, and every command is version-safe and idempotent.
- At most five destination chains may be active, at most one global primary may
  exist, and no unrelated destination is auto-promoted. Primary removal with an
  alternative is an atomic switch; acknowledged last-primary removal is allowed
  and makes readiness incomplete.
- High-risk Owner transitions require a re-authentication proof no older than 10
  minutes. Safe template-backed Owner email and Staff review-queue effects are
  idempotent, contain no full identifier, retry asynchronously, and never roll
  back accepted lifecycle or readiness truth.
- Recoverable payout identifiers and holder legal names are AES-256-GCM
  encrypted with unique nonces and bound context; duplicate lookup uses only the
  separate versioned domain-separated HMAC-SHA-256 key ring, and neither
  plaintext nor fingerprints leak into ordinary persistence surfaces, logs,
  history, errors, or audit payloads.
- Provider identifiers remain masked even in drafts and after writes, using the
  exact wallet and IBAN formats. Owners and Admins receive only their approved
  projections, and holder names are either fully purpose-authorized or omitted.
- Full reveal is limited to a capable active Staff Admin verifying one exact
  pending version with a meaningful reason and step-up no older than five
  minutes. Safe audit persists before a non-cacheable response, every denial is
  audited safely, and the five-per-10-minute actor limit cannot be bypassed.
- Release 1 starts and reports ready only with valid separate external
  encryption and lookup key rings covering retained versions. Rotation keeps
  duplicate and recovery protection intact through bounded resumable migration;
  retirement requires zero-reference proof and explicit human approval.
- R1-P06 updates only `documentsVerified` and `payoutDestinationReady`; it
  cannot make a Provider operationally live or publicly browseable.
- Missing or invalid required documents and payout-destination data produce
  explicit readiness blockers.
- Private documents, full payout identifiers, storage keys, and sensitive
  values are excluded from public surfaces and general logs.
- Privileged review, policy publication, and payout-verification decisions
  preserve actor, a meaningful non-empty reason, timestamp, target version, and
  durable history; Owner destination changes preserve safe attributable history.

---

## R1-P07 — Worker, Team & Crew Management

**Status:** Active and ready to implement as of 2026-08-22 under DEC-038,
DEC-039, and the owner's expanded pre-implementation authorization.
Clarification, planning, focused checklists, continuous tasks T001–T156, and
CLEAN consistency analysis are complete. The only next workflow step is
`speckit-implement`; implementation and further Git actions remain separately
controlled.

### Goal

Give providers complete worker and team management with gender and proxy-operation rules.

### Scope

- Provider-owned Worker Profiles separate from Authentication identities
- Email invitation, access acceptance, expiration, resend, and revocation
- Worker lifecycle: `DRAFT → ACTIVE ↔ INACTIVE → REMOVED` (`REMOVED` terminal)
- Separate login-access lifecycle: `INVITED / ACTIVE / EXPIRED / REVOKED`
- Historical-safe removal, Worker departure, and linked new engagement on rehire
- Required gender
- Closed `workerType`, optional display title, normalized skills, and private avatar
- Independent Supervisor capability and one optional primary Supervisor per Team
- Primary Supervisor reads limited to the current Team and current members, with
  the only write authority being `cleans` on an existing current membership
- Supervisor attempts to remove the final valid cleaner from an active Team
  conflict; Owner/Admin confirmation atomically changes membership and Team
- Provider Admin authority through explicit `provider_members.ADMIN` membership only
- Team creation with one active Team membership per Worker and retained history
- Team lifecycle: `DRAFT → ACTIVE ↔ INACTIVE → ARCHIVED` (`ARCHIVED` terminal)
- Crew gender composition
- Escort representation with membership `cleans=false`; incompatible cleaning
  membership or Worker-type changes are rejected until explicitly corrected
- Membership-level `cleans`, with assignment snapshots deferred to Booking
- `workersReady` based on an active, complete, login-enabled `CLEANING_STAFF`
- Versioned lifecycle, authority, invitation, and membership commands with safe
  history, reasons, audit evidence, and localized notification intents
- Closed action-specific reason catalogs for Worker deactivation/removal,
  login-access revocation, and Provider Admin grant/revocation, with meaningful
  notes for every removal and every `OTHER`
- Invitation-version locale selected as `AR` or `EN`, followed after acceptance
  by recipient preference, accepted-invitation locale, and final `AR` fallback

### Tables

- `workers`
- `worker_profiles`
- `worker_skills`
- `provider_teams`
- `provider_team_members`
- `worker_status_history`
- `provider_members`

### Done When

- Provider controls only its own workers.
- Historical engagements, memberships, and bookings survive lifecycle changes.
- Crew composition and membership-level cleaning participation can be evaluated.
- Supervisor scope and explicit Provider Admin membership authority are enforced.
- Last-cleaner membership changes cannot leave an active Team without a valid
  cleaner or produce partial membership/Team history.
- Escort workers are represented only with `cleans=false` memberships and are
  never counted as cleaners.
- `workersReady` cannot be satisfied by an Escort, an unaccepted invitation, or
  a Supervisor who is not an eligible cleaning Worker.
- The prepared HTTP contracts and persistence design remain implementation
  artifacts only until the separately authorized `speckit-implement` step.

---

## R1-P08 — Catalog, Localization & Service Requirements

### Goal

Create the platform-owned Arabic/English catalog.

### Scope

- Categories and services
- Arabic and English names/descriptions
- Price units
- Service requirements and booking fields
- Service media
- Display order
- Country availability
- Active/inactive status
- Egypt housekeeping seed
- Admin CRUD
- Snapshot-ready catalog data

### Tables

- `service_categories`
- `services`
- `service_translations`
- `service_price_units`
- `service_fields`
- `service_field_options`
- `service_country_availability`
- `media_files`

### Done When

- Catalog is manageable without deployment.
- Localized content is complete.
- Disabled services cannot be selected.
- Country and price-unit rules are validated.

---

## R1-P09 — Provider Services, Pricing & Historical Snapshots

### Goal

Allow providers to configure services and server-authoritative prices.

### Scope

- Select catalog services
- Enable/disable provider service
- Provider price and price unit
- Minimum charge
- Estimated duration
- Service notes
- Price history
- Approval rule when configured
- Snapshot structures for confirmed bookings
- Decimal-safe price validation

### Tables

- `provider_services`
- `provider_service_prices`
- `provider_service_price_history`
- `provider_service_status_history`

### Done When

- Public provider prices are correct.
- Price history is retained.
- Confirmed bookings can preserve service and price snapshots.
- Client-supplied totals are rejected.

---

## R1-P10 — Availability, Capacity & Textual Coverage

### Goal

Define when providers and workers can operate and where they work before maps are enabled.

### Scope

- Countries, cities, and districts
- Provider textual coverage
- Provider weekly schedule
- Provider holidays/exceptions
- Worker schedule
- Worker exceptions
- Team capacity
- Temporary provider pause
- Schedule conflict rules
- No coordinates or radius

### Tables

- `cities`
- `districts`
- `provider_coverage_areas`
- `provider_schedules`
- `provider_schedule_exceptions`
- `worker_schedules`
- `worker_schedule_exceptions`
- `provider_capacity_rules`

### Done When

- Provider availability can be evaluated.
- Textual areas can filter Browse candidates.
- Schedule and capacity conflicts are detected.
- The model can later be extended to geo coverage without replacement.

---

## R1-P11 — Eligibility Engine V1

### Goal

Build one reusable eligibility domain for standard Browse and future Recommended.

### Inputs

- Service
- Provider service price
- Provider verified/live status
- Textual coverage
- Date/time
- Provider schedule
- Worker/team capacity
- Crew preference
- Worker genders
- Escort/non-cleaner rule
- Configured performance gate when data exists

### Outputs

- Eligible provider/team candidates
- Exclusion reasons
- Deterministic result metadata
- Sorting inputs for standard Browse

### Tables

- Primarily reads earlier tables
- `eligibility_rule_versions`
- `eligibility_evaluations`
- `eligibility_candidate_results`

### Done When

- Browse uses this engine instead of duplicating filters.
- Every exclusion has a machine-readable reason.
- Same inputs produce consistent results.
- Engine interfaces are extension-ready for Release 3 geo rules.

---

## R1-P12 — Browse Marketplace & Provider Details

### Goal

Allow guests and customers to discover eligible providers through REST.

### Scope

- Browse categories and services
- Guest Browse
- Eligible provider list
- Provider profile
- Gallery and contacts
- Services and prices
- Team size and crew summary
- Rating summary when available
- Filters
- Pagination and search
- Standard sorting
- No premium boost before Release 2
- No map, distance, or socket behavior

### Tables

- Reads catalog, provider, team, rating, and eligibility tables
- `provider_view_events` optional
- `search_events` optional

### Done When

- Only eligible live providers appear.
- Guest Browse works.
- Verified account is required before booking/payment.
- Search and filters use server rules.

---

## R1-P13 — Booking Draft, Pricing Snapshot & Status Machine

### Goal

Create the canonical standard-booking domain and freeze order transitions.

### Scope

- Booking path: `browse`
- Customer, provider, service, schedule, address
- Crew preference
- Service-specific answers
- Notes and permitted media
- Server-side price calculation
- Deposit calculation
- Provider/service/price snapshot
- Booking draft
- Awaiting-deposit state
- Idempotent booking creation
- Actor × from × to × prerequisites matrix
- Emergency modeling decision
- Cancellation event foundation without unapproved fee rules

### Tables

- `bookings`
- `booking_items`
- `booking_answers`
- `booking_addresses`
- `booking_media`
- `booking_snapshots`
- `booking_price_breakdowns`
- `booking_status_history`
- `status_transition_rules`

### Done When

- Final enum names and transition matrix are approved.
- Draft and awaiting-deposit states work.
- Pricing is server-authoritative.
- Historical snapshots cannot be silently rewritten.
- Cancellation fees are not invented.

---

## R1-P14 — Financial Ledger & Payment Architecture

### Goal

Create the financial source of truth before collecting money.

### Scope

- Append-only ledger
- Financial account/reference model
- Order-level financial entries
- Deposit/platform-fee entry types
- Provider-share entry types
- COD remaining
- Payout, refund, and adjustment entry types
- Balance calculation from entries where needed
- Idempotency keys
- Financial snapshots
- Reconciliation interfaces
- No stored-value user wallet

### Tables

- `ledger_accounts`
- `ledger_entries`
- `ledger_entry_links`
- `financial_idempotency_keys`
- `financial_snapshots`
- `financial_adjustments`

### Done When

- Financial totals derive from controlled server records.
- Financial records are immutable or corrected through new entries.
- Decimal safety and idempotency are tested.
- User wallet functionality does not exist.

---

## R1-P15 — Deposit Payments, Methods & Webhooks

### Goal

Collect the configured deposit and confirm a booking only from verified gateway events.

### Scope

- Payment-method configuration by country
- Deposit payment initiation
- Gateway session/reference
- Browser return handling
- Idempotent webhook
- Payment verification
- Retry and failed payment
- Payment receipt
- Deposit ledger entries
- Booking transition to confirmed
- Refund record foundation
- Payment abstraction for Paymob and approved Egypt rails
- No invented InstaPay workflow

### Tables

- `payment_methods`
- `payment_attempts`
- `payments`
- `payment_gateway_events`
- `payment_receipts`
- `refund_requests`
- Uses ledger and booking tables

### Done When

- Redirect success alone never marks payment paid.
- Duplicate webhooks are harmless.
- Booking confirms only after verified deposit.
- Payment and ledger states reconcile.
- Unsupported rails remain disabled by configuration.

---

## R1-P16 — Provider Booking Response & Cancellation Events

### Goal

Allow the selected provider to accept or reject the confirmed standard request.

### Scope

- Provider booking inbox
- View booking dossier
- Accept
- Reject with reason
- Response expiry
- Customer cancellation event
- Provider cancellation event
- Admin cancellation hook
- Status transition validation
- Notification events
- No counteroffer or dynamic price
- No unapproved cancellation fee calculation

### Tables

- `booking_responses`
- `booking_cancellations`
- `cancellation_reasons`
- Uses booking status history and audit

### Done When

- Only the selected provider can respond.
- Expired or cancelled requests cannot be accepted.
- Cancellation is recorded and auditable.
- Financial side effects use approved rules only.

---

## R1-P17 — Worker & Team Assignment

### Goal

Assign eligible workers or a team to an accepted booking.

### Scope

- Assign worker
- Assign multiple workers
- Assign existing team
- Ownership checks
- Active-state checks
- Schedule/capacity checks
- Crew-gender checks
- Escort and `cleans` assignment flag
- Replace assignment according to status rules
- Assignment history
- Worker order visibility

### Tables

- `booking_assignments`
- `booking_assignment_members`
- `booking_assignment_history`

### Done When

- Only valid provider workers can be assigned.
- Crew preference is enforced.
- Conflicts and invalid team composition are blocked.
- Historical assignments are preserved.

---

## R1-P18 — Order Execution & Client Completion Code

### Goal

Complete the field journey through controlled transitions and mandatory customer verification.

### Scope

- Create operational order from confirmed booking
- Assigned
- Pending/scheduled
- On the way
- In progress
- Ready to complete
- Six-digit completion code
- SMS delivery request
- Code hash, TTL, attempts
- Worker or supervisor completion
- Optional completion media
- Completion notes
- Timeline
- No live socket status or GPS tracking

### Tables

- `orders`
- `order_status_history`
- `completion_codes`
- `completion_code_attempts`
- `order_media`
- `order_notes`
- `order_events`

### Done When

- Invalid status jumps fail.
- Order cannot complete without valid code.
- Supervisor proxy follows the same proof rules.
- Completion media visibility is controlled.
- Timeline is consistent for all actors.

---

## R1-P19 — Panic & Emergency Core

### Goal

Provide the locked emergency workflow without live location.

### Scope

- Worker panic
- Supervisor/explicit Provider Admin panic
- Emergency flag
- Emergency dossier
- Admin/operations alert record
- Provider alert record
- Emergency notes
- Controlled clear/escalate
- Permission and audit reason
- Link to support ticket
- No GPS, live map, or WebSocket update

### Tables

- `emergency_incidents`
- `emergency_status_history`
- `emergency_actions`
- Links to order, provider, worker, customer, and support

### Done When

- Panic creates a visible emergency immediately through normal APIs/notifications.
- Only authorized actors clear it with a reason.
- Full audit and dossier exist.
- Release 3 can attach consent-based location sessions.

---

## R1-P20 — Remaining Payment & COD Confirmation

### Goal

Close the customer payment side after service.

### Scope

- Remaining-payment choice
- COD remaining record
- Provider/supervisor cash-received confirmation
- Timestamp and actor
- Full-online remaining payment
- Deposit-plus-later-online option when enabled
- Remaining-payment webhook
- Financial entries
- Customer receipt state
- Dispute hook

### Tables

- `remaining_payment_choices`
- `cod_cash_confirmations`
- `remaining_payment_attempts`
- `remaining_payments`
- Uses ledger and payment tables

### Done When

- COD confirmation is attributable and auditable.
- Online remaining payment reconciles through webhook.
- Provider share is not marked settled merely because it is due.
- All order money states are consistent.

---

## R1-P21 — Provider Dues, Settlements & Reconciliation

### Goal

Pay provider obligations through external destinations without internal wallets.

### Scope

- Provider due generated from ledger
- Eligible due queue
- Settlement periods
- Manual settlement
- Scheduled settlement job
- Hold/release
- Missing payout destination
- External payout reference
- Off-gateway payment proof
- Failed payout and retry
- Finance adjustment through ledger
- Gateway funding-balance alert when available
- Provider payout history
- Reconciliation report

### Tables

- `provider_dues`
- `provider_settlements`
- `provider_settlement_items`
- `provider_payouts`
- `provider_payout_attempts`
- `provider_payout_documents`
- Uses external payout destinations and ledger

### Done When

- Every payable item traces to ledger entries.
- No payout occurs without a valid destination.
- Failed payout does not mark a due as settled.
- Manual/off-gateway actions require finance permission and audit.
- No provider wallet exists.

---

## R1-P22 — Basic Ratings & Reviews

### Goal

Deliver the approved Release 1 trust feedback without inventing open advanced rules.

### Scope

- Provider rating
- Assigned-team rating
- Written review
- One review per completed order
- Customer ownership check
- Aggregate rating
- Basic admin hide/report ability only if product approves the exact behavior
- Preserve future extension points for rating dimensions

### Tables

- `reviews`
- `review_targets`
- `review_ratings`
- `rating_summaries`
- `review_reports` only if approved

### Done When

- Only completed-order customers can review.
- Provider and team aggregates are separate.
- Duplicate review is blocked.
- Advanced edit/publish/dimension rules remain visibly open.

---

## R1-P23 — Notifications & Admin-Editable Templates

### Goal

Deliver audience-specific notifications without WebSockets.

### Scope

- SMS, email, and Firebase push adapters
- Customer SMS + push
- Provider/worker email + push
- REST notification inbox
- Arabic/English templates
- Template variables
- Delivery attempts
- Retry
- Notification preferences
- Critical events: verification, deposit, assignment, on the way, completion code, panic, payout issue
- No marketer templates until Release 2 activation
- No socket dependency

### Tables

- `notification_templates`
- `notification_template_translations`
- `notifications`
- `notification_deliveries`
- `notification_preferences`

### Done When

- Critical domain events generate the correct channel.
- Message content is admin-editable.
- Delivery failures are visible and retryable.
- Sensitive template variables are protected.

---

## R1-P24 — Support & Complaints

### Goal

Provide controlled support for order-related and general issues.

### Scope

- Complaint with order ID
- General support without order
- Ticket categories
- Priority
- Messages and attachments
- Support-agent assignment
- Status workflow
- Internal notes
- Emergency link
- Payment/refund link
- Resolution summary

### Tables

- `support_tickets`
- `support_ticket_messages`
- `support_ticket_attachments`
- `support_ticket_assignments`
- `support_status_history`
- `support_internal_notes`

### Done When

- Users can open and follow permitted tickets.
- Support staff can filter, reply, assign, and close.
- Internal notes remain private.
- Order, emergency, and financial links are auditable.

---

## R1-P25 — Admin, Operations & Finance Control

### Goal

Provide full non-map Release 1 control surfaces.

### Scope

#### Identity

- Ban/unban
- Suspend/reinstate
- Provider verify/revoke
- Worker/provider visibility

#### Orders

- Search and dossier
- Cancel
- Reassign
- Force allowed status
- Clear/escalate emergency
- View media and timeline

#### Money

- Payment visibility
- Refund requests/actions according to approved rules
- Due and payout hold/release
- Manual/off-gateway settlement
- Reconciliation views

#### Content/config

- Catalog
- Country configs
- Business percentages
- Payment methods
- Notification templates
- Verification document types

#### Control

- Permission
- Required reason
- Before/after audit
- Export where approved

### Tables

- Primarily uses all Release 1 tables
- `admin_actions`
- `admin_exports`
- `system_incidents`

### Done When

- Staff can operate Release 1 without database access.
- Staff role boundaries are tested.
- Every privileged mutation is audited.
- No map-based screen is required.

---

## R1-P26 — Reporting, Security, QA & Production Launch

### Goal

Prove that Release 1 is operationally and financially ready.

### Scope

- Customer end-to-end tests
- Provider end-to-end tests
- Worker/supervisor tests
- Admin/support/finance tests
- Payment webhook replay tests
- Ledger reconciliation
- COD reconciliation
- Provider settlement reconciliation
- Authorization matrix review
- Security review
- Performance/load tests
- Backup and restore
- Object-storage access review
- API documentation review
- Deployment runbook
- Rollback runbook
- Monitoring and incident procedures
- Launch metrics
- Real SMS provider selection and production integration
- Phone OTP request/verification endpoints and abuse controls
- Existing unverified-phone migration/backfill strategy
- Phone ownership acceptance for signup and Google identities

### Done When

- Complete customer-to-review flow passes.
- Complete provider-to-settlement flow passes.
- Critical security issues are closed.
- Financial reports reconcile.
- Backup and rollback are verified.
- Product and engineering approve production release.
- Real phone verification proves ownership without treating R1-P02 phone values as already verified.

---

# Release 2 — Marketers & Growth

## Release objective

Add controlled referral acquisition and paid provider visibility while preserving Release 1 financial invariants.

## Release 2 exclusions

- Maps
- WebSockets
- Live offers
- Tracking
- Coupons until approved
- Internal wallets

---

## R2-P01 — Marketer Identity & Activation

### Goal

Add marketer registration and activation over the shared identity system.

### Scope

- Marketer signup entry
- Profile
- Status lifecycle
- Configured signup fee
- Zero-fee auto activation
- Activation payment webhook
- Terms acceptance
- External payout destination
- Omit referral key while inactive
- Marketer authorization

### Tables

- `marketers`
- `marketer_profiles`
- `marketer_status_history`
- `marketer_terms_acceptances`
- `marketer_payout_destinations`
- Reuses identity, payment, ledger, and config tables

### Done When

- Marketer cannot use a referral key before activation.
- Activation fee is webhook-verified.
- No marketer wallet exists.
- Staff can suspend/reactivate marketers.

---

## R2-P02 — Referral Keys, Links & Attribution

### Goal

Bind qualified new customers to active marketers at signup.

### Scope

- Complex marketer key
- Referral URL
- Valid/invalid/inactive behavior
- Signup attribution
- Attribution start at signup
- Configured expiry
- First-touch rule
- Self-referral prevention
- Duplicate claim prevention
- Admin detach with audit
- Attribution history

### Tables

- `marketer_keys`
- `referral_links`
- `referral_visits`
- `referral_attributions`
- `referral_attribution_history`

### Done When

- Invalid key does not block normal signup.
- Attribution is deterministic and auditable.
- Expiry is evaluated server-side.
- Detach requires permission and reason.

---

## R2-P03 — Marketer Commission Engine

### Goal

Create commission from eligible orders without reducing the provider share.

### Scope

- Configured marketer percentage
- Commission from Cleanora share only
- Eligible order event
- Prefer completed/non-refunded
- Attribution-window check
- Sales-target cap
- Rule versioning
- Refund clawback
- Manual adjustment with audit
- Ledger entry
- Commission statuses

### Tables

- `commission_rules`
- `commission_rule_versions`
- `marketer_commissions`
- `commission_adjustments`
- `commission_status_history`
- Reuses ledger and attribution

### Done When

- Provider share is unchanged.
- Old commission retains original rule version.
- Refund/clawback is traceable.
- Sales target stops new commission correctly.

---

## R2-P04 — Marketer Dashboard & Reporting

### Goal

Give marketers transparent performance information.

### Scope

- Referral link
- Referred-customer summary
- Attribution expiry
- Qualified orders
- Pending/approved/paid/rejected commission
- Progress toward sales target
- Date filters
- Export
- Privacy-safe customer details
- Notification events and templates

### Tables

- Reads marketer/referral/commission tables
- `marketer_report_exports` optional

### Done When

- Dashboard totals match ledger and commissions.
- Marketer sees only permitted customer data.
- Expiry and target progress are understandable.

---

## R2-P05 — Marketer Settlements

### Goal

Settle approved marketer commission through external payout methods.

### Scope

- Settlement period
- Eligible commission selection
- Statement
- Approval
- External payout
- Payment proof/reference
- Failure and retry
- Off-gateway record
- Reconciliation
- No internal wallet

### Tables

- `marketer_settlements`
- `marketer_settlement_items`
- `marketer_payouts`
- `marketer_payout_attempts`
- `marketer_payout_documents`

### Done When

- Every paid commission belongs to one settlement.
- Failure never marks commission paid.
- External references are retained.
- Settlement totals reconcile.

---

## R2-P06 — Premium Provider Plans & Browse Boost

### Goal

Implement paid provider visibility without bypassing eligibility.

### Scope

- Configurable premium plans
- Activation and expiration
- Payment
- Badge
- Browse/search rank boost
- Optional configured gallery benefits
- Eligibility-first ordering
- Premium history
- Admin control

### Tables

- `premium_plans`
- `provider_premium_subscriptions`
- `premium_payments`
- `premium_status_history`
- `premium_benefits`

### Done When

- Ineligible providers remain hidden.
- Active premium changes only approved ranking inputs.
- Expired premium loses benefits.
- Price/duration/benefits are configurable pending final product values.

---

## R2-P07 — Growth Fraud & Admin Operations

### Goal

Give staff complete control over marketers, commissions, referrals, and premium.

### Scope

- Marketer approve/suspend/reactivate
- Attribution detach
- Suspicious-referral flags
- Self-referral and duplicate review
- Commission adjustment
- Sales target change
- Settlement approve/hold
- Premium control
- Audit
- Growth reports

### Tables

- `referral_risk_flags`
- `growth_admin_actions`
- Uses Release 2 tables

### Done When

- Staff can operate Release 2 without database access.
- Fraud cases are traceable.
- Every manual financial action is audited.

---

## R2-P08 — Release 2 Integration, QA & Launch

### Goal

Prove the complete marketer and premium journey.

### Scope

- Marketer registration-to-settlement tests
- Activation webhook replay
- Attribution expiry tests
- Refund clawback tests
- Sales-target tests
- Premium eligibility-order tests
- Security and authorization
- Reconciliation
- Documentation
- Deployment and rollback

### Done When

- Referral-to-paid-commission flow passes.
- Provider share remains invariant.
- Premium never bypasses eligibility.
- Release 2 is production approved.

---

# Release 3 — Smart Marketplace

## Release objective

Add maps, geographic eligibility, Recommended live offers, dynamic negotiated pricing, live tracking, and map-based operations.

## Release 3 prerequisites

- Release 1 status machine and ledger are stable.
- Release 1 eligibility interface is stable.
- Release 2 premium ranking input is available when enabled.
- Maps, WebSocket, notification, and object-storage providers are configured.

---

## R3-P01 — Maps, Geocoding & Geo Address Model

### Goal

Add map-selected addresses and coordinate-safe location handling.

### Scope

- Map provider abstraction
- Latitude/longitude
- Geocoding and reverse geocoding
- Customer pin selection
- Address validation
- Order pin snapshot
- Geocoding cache
- Privacy and precision rules
- Provider failure handling

### Tables

- `geo_addresses`
- `geo_points`
- `geocoding_cache`
- Extensions to customer and booking addresses

### Done When

- Address retains text and coordinates.
- Order location is snapshotted.
- Map-provider failure has a safe fallback.
- Location access follows privacy rules.

---

## R3-P02 — Geographic Coverage, Zones & Distance

### Goal

Upgrade textual coverage to geometry/radius eligibility.

### Scope

- Provider service zones
- Radius zones
- Boundary/polygon support when approved
- Distance calculation
- Zone priority
- Migration/link from textual coverage
- Geo index strategy
- Admin zone management

### Tables

- `service_zones`
- `service_zone_boundaries`
- `provider_geo_coverage`
- `distance_calculation_cache`

### Done When

- Provider geographic coverage is queryable.
- Release 1 textual coverage remains traceable during the geo upgrade.
- Geo indexes and distance tests pass.

---

## R3-P03 — Eligibility Engine V2

### Goal

Extend the same Release 1 engine with geographic and realtime inputs.

### Scope

- Coordinates
- Radius/geometry
- Distance
- Live provider state
- Current capacity
- Performance gates
- Premium sorting input
- Candidate explanation
- Versioned rules
- Performance targets

### Tables

- Extends eligibility tables
- `eligibility_geo_results`
- `provider_performance_metrics`

### Done When

- Browse and Recommended use one engine.
- V1 and V2 behavior is versioned.
- Every rejection remains explainable.
- Matching meets latency targets.

---

## R3-P04 — Secure Real-Time Infrastructure

### Goal

Create authenticated, observable, horizontally scalable WebSocket infrastructure.

### Scope

- Authentication
- Connection lifecycle
- Rooms/channels
- Presence
- Heartbeat
- Reconnection
- Event versioning
- Authorization
- Acknowledgements
- Rate limiting
- REST state recovery
- Scaling adapter
- Monitoring

### Tables

- Persist only auditable events when required
- `realtime_audit_events`
- Ephemeral connection state should not be modeled as permanent business truth

### Done When

- Unauthorized subscriptions fail.
- Reconnection recovers canonical server state.
- Concurrency tests pass.
- REST remains source of truth.

---

## R3-P05 — Recommended Request Sessions

### Goal

Allow customers to create and distribute eligible live service requests.

### Scope

- Recommended booking path
- Target price or permitted range
- Service, location, schedule, crew constraints
- Candidate audience
- Live distribution
- Delivery acknowledgement
- Expiration
- Customer cancellation
- Provider ignore/reject
- REST recovery

### Tables

- `recommended_requests`
- `recommended_request_candidates`
- `recommended_request_deliveries`
- `recommended_request_status_history`

### Done When

- Only eligible candidates receive requests.
- Expired requests cannot accept offers.
- Reconnection restores request state.

---

## R3-P06 — Provider Offers & Counteroffers

### Goal

Allow eligible providers to compete through controlled live offers.

### Scope

- Accept target price
- Submit alternative price
- Estimated arrival
- Team summary
- Offer notes
- Offer expiry
- Update/withdraw
- Reject
- Live customer offer list
- Atomic winner selection
- Offer caps and cooldowns

### Tables

- `provider_offers`
- `provider_offer_versions`
- `provider_offer_status_history`
- `offer_selection_attempts`

### Done When

- Only eligible providers can offer.
- Expired or withdrawn offers cannot win.
- One offer wins atomically.
- Spam controls are tested.

---

## R3-P07 — Negotiated Price, Deposit & Booking Conversion

### Goal

Convert a selected live offer into the standard financial and order domains.

### Scope

- Price floor/ceiling configuration
- Customer target/range
- Provider proposal
- Final negotiated price
- Pricing audit
- Booking snapshot
- Deposit recalculation
- Payment integration
- Booking conversion
- Failure recovery

### Tables

- `dynamic_pricing_rules`
- `dynamic_pricing_rule_versions`
- `request_price_ranges`
- `price_proposals`
- `negotiated_prices`
- `pricing_decision_logs`

### Done When

- Invalid prices are blocked.
- Final price is immutable after confirmation except audited adjustment.
- Deposit and ledger use the selected price.
- Recommended enters the same booking/status machine as Browse.

---

## R3-P08 — Smart Offer Ranking

### Goal

Rank live offers using configurable, explainable criteria.

### Scope

- Price
- Rating
- Distance
- Estimated arrival
- Reliability
- Completion rate
- Availability
- Premium boost
- Weight configuration
- Versioning
- Explanation
- Fairness review

### Tables

- `ranking_rules`
- `ranking_rule_versions`
- `offer_ranking_results`
- Uses provider performance metrics

### Done When

- Same inputs produce the same ranking.
- Staff can understand the score.
- Premium remains only one factor.

---

## R3-P09 — Live Team Tracking

### Goal

Share assigned-team location during the permitted active-order window.

### Scope

- Permission/consent
- Tracking session
- Location updates
- Fresh/stale/offline state
- Customer map
- Provider operations view
- Start/stop lifecycle
- Battery/network strategy
- Retention rules
- No tracking outside the authorized window

### Tables

- `tracking_sessions`
- `tracking_points`
- `tracking_status_history`
- `location_permission_events`

### Done When

- Tracking starts only for an authorized active order.
- Visibility is restricted.
- Tracking stops automatically.
- Retention and consent rules are enforced.

---

## R3-P10 — Panic Live Location & Real-Time Emergency Updates

### Goal

Extend the Release 1 emergency domain with consent-based live location.

### Scope

- Consent after panic
- Emergency tracking session
- Real-time location events
- Provider/admin live updates
- TTL
- Stop and revoke
- REST recovery
- Emergency location audit

### Tables

- Reuses tracking and emergency tables
- `emergency_location_consents`

### Done When

- Panic works even when location is refused.
- Consent is recorded.
- Location is visible only to authorized actors.
- Tracking expires or is revoked safely.

---

## R3-P11 — Admin Live Orders Map

### Goal

Give operations a real-time map-based control surface.

### Scope

- Active-order pins
- Status colors
- Emergency red highlight
- Provider/team location when authorized
- Order dossier
- Reassign/cancel/force-status actions
- Filters
- Realtime updates
- Audit and permission

### Tables

- Primarily reads order, tracking, emergency, and audit data
- `admin_map_preferences` optional

### Done When

- Staff sees authorized live operational state.
- Actions still use canonical domain APIs.
- Map never becomes an independent source of truth.

---

## R3-P12 — Smart Marketplace Integration, QA & Launch

### Goal

Prove the complete map-to-offer-to-tracking journey.

### Scope

- Geo address to eligibility
- Recommended request
- Offer selection
- Negotiated price
- Deposit
- Booking conversion
- Assignment
- Execution
- Live tracking
- Panic location
- Admin map
- Socket disconnect/retry
- Double-selection protection
- Load, security, and privacy tests
- Reconciliation
- Deployment and rollback

### Done When

- Full smart flow passes end to end.
- Duplicate winners and double bookings are prevented.
- Payment matches the final price.
- Disconnect recovery works.
- Tracking privacy rules pass.
- Release 3 is production approved.

---

# 7. Universal Phase Checklist

Copy this into every phase planning file.

```md
## Planning
- [ ] Vision rules identified
- [ ] Decision-log entries identified
- [ ] Open questions identified
- [ ] Goal and boundaries approved
- [ ] Dependencies complete
- [ ] Tables and changed tables listed
- [ ] Status and money side effects listed

## Database & Prisma
- [ ] Current `schema.prisma` inspected
- [ ] Existing migration history inspected
- [ ] New models listed
- [ ] Changed models listed
- [ ] ERD updated
- [ ] Prisma models and enums updated
- [ ] Columns and relationships reviewed
- [ ] Constraints and indexes added
- [ ] Named phase migration created
- [ ] Generated SQL reviewed
- [ ] Destructive changes reviewed
- [ ] Backfill/default strategy documented
- [ ] Rollback/forward-fix strategy reviewed
- [ ] Seed data created when needed
- [ ] Prisma Client regenerated
- [ ] `prisma validate` passes
- [ ] Migration applies on a clean test database
- [ ] Database integration tests pass
- [ ] Historical snapshot behavior reviewed
- [ ] Earlier-phase compatibility tests pass

## Backend
- [ ] Validation complete
- [ ] Business rules complete
- [ ] Authorization complete
- [ ] Services/use cases complete
- [ ] Endpoints complete
- [ ] Events/jobs complete
- [ ] Audit behavior complete
- [ ] Error cases complete

## Quality
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Authorization tests pass
- [ ] Idempotency/concurrency tests pass when applicable
- [ ] API documentation complete
- [ ] Frontend contract complete
- [ ] Code review complete
- [ ] No hidden product assumptions
- [ ] Definition of Done approved
```

---

# 8. Individual Phase File Template

```md
# R1-PXX — Phase Name

| Field | Value |
|---|---|
| Release | Release 1 |
| Phase | R1-PXX |
| Status | Not Started |
| Backend Branch | TBD |
| Frontend Branch | TBD |
| Started At | TBD |
| Completed At | TBD |
| New Tables | ... |
| Changed Tables | ... |
| Depends On | ... |
| Blocks | ... |

## Goal

## Source Rules

List exact sections or story IDs from the vision/source documents.

## Approved Decisions

List relevant `DEC-...` entries.

## Open Questions

List relevant `OQ-...` entries.

## In Scope

## Out of Scope

## Business Rules

## Database & Prisma Changes

### New Prisma Models

- ...

### Changed Prisma Models

- ...

### New or Changed Enums

- ...

### Relations

- ...

### Indexes and Constraints

- ...

### Migration Name

`r1_pxx_phase_name`

### Generated SQL Review

- ...

### Backfill / Default Strategy

- ...

### Seed Changes

- ...

### Compatibility Impact

- ...

### Database Test Scenarios

- ...

## API Contract

## Events and Notifications

## Authorization Matrix

## Test Scenarios

## Definition of Done
```

---

# 9. Starting sequence

Begin in this order:

1. `R1-P00 — Product & Database Architecture`
2. `R1-P01 — Project Foundation & Country Configuration`
3. `R1-P02 — Complete Authentication & Identity`
4. `R1-P03 — Roles, Permissions & Privileged Audit`
5. Continue sequentially unless an approved dependency plan allows parallel work.

Do not start implementation from the old P0–P5 table. Use this roadmap while preserving Bassam's locked business rules in `vision.md`.
