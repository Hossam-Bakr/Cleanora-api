# Feature Specification: R1-P12 — Browse Marketplace & Provider Details

**Feature Branch**: `codex/r1-p12-browse-marketplace-provider-details`  
**Created**: 2026-09-10  
**Status**: Accepted for implementation — Codex PM-02 `ACCEPT_IMPLEMENTATION` (2026-09-10)  
**Input**: Roadmap §R1-P12; `/work-on-next-phase` activation; inherited DEC-072 Browse facade; architecture entity ownership for `bookings`.

## Clarifications

### Session 2026-09-10 (MVB — accepted by Codex PM-02)

- Q: Which module owns Browse HTTP and optional marketplace event tables? → A: New `bookings` module (architecture owner of `provider_view_events` / `search_events` and browse/provider-detail consumer of Eligibility/Providers/Catalog/Media/Configuration public contracts).
- Q: Do optional analytics tables ship in MVB? → A: **No.** Skip `provider_view_events` and `search_events` unless prep acceptance explicitly requires them. Zero or additive-only migration accordingly.
- Q: How is eligibility enforced? → A: Eligible list **must** come from composition-wired `getStandardBrowseCandidates`. Do **not** treat Providers `eligibleForPublicBrowse: false` readiness placeholder as eligibility truth or as a filter substitute.
- Q: Guest access model? → A: New optional-auth middleware: anonymous guests may call Browse HTTP; if a Bearer token is present it must be valid. No actor identity is trusted from the body.
- Q: Public provider projection privacy? → A: Contact-free allowlist only for Browse list and detail (display names, descriptions, country, signed logo/cover/gallery). No phone, email, channels, applicant PII, storage keys, Worker IDs, payouts, or verification documents.
- Q: “Contacts” roadmap item? → A: Guest/customer Browse does **not** expose raw contact channels in R1-P12 MVB. Gallery is included. Raw contacts remain Provider-protected until a later approved surface.
- Q: Ratings summary? → A: Omit until a ratings module exists. Response schemas may reserve absence (`ratingSummary: null` or field omitted) without inventing scores.
- Q: Sorting? → A: Server-only standard sort over eligible candidates: primary `priceAmount` ascending (decimal-safe), tie-break `providerId` then `teamId` ascending. No premium boost (Release 2).
- Q: Filters / search? → A: Required eligibility inputs (service, country, city, optional district, UTC interval, crew preference, required team units). Optional filter: `maxPriceAmount` applied **after** eligibility on sortingFacts. Search: optional `q` case-insensitive substring on provider display name (locale-selected) within the eligible set only — never a bypass of eligibility.
- Q: Pagination? → A: Limit + opaque cursor over the **sorted eligible** list. Default limit 20; max 50. Cursor is server-issued; clients must not invent offsets into unevaluated Providers.
- Q: Catalog / locality browse? → A: Bookings exposes guest read HTTP that projects Catalog `listSelectable` / definition reads and Configuration locality reads through those modules’ public contracts. Catalog and Configuration remain fact owners; no Prisma cross-module access.
- Q: Booking / verified account Done-When? → A: P12 documents and tests that Browse does **not** create bookings. Verified-account-before-booking/payment is an explicit **out-of-phase gate** owned by P13+; P12 may return a stable machine-readable `bookingPrerequisites` hint on provider detail without enforcing booking.
- Q: Geo / realtime? → A: Textual locality only. Reject coordinates, radius, map, and socket behavior explicitly.
- Q: HTTP surface naming? → A: Mount under `/api/v1/browse/*` (guest-capable). No Eligibility HTTP. No staff Catalog route reuse for guests.

## Definition of Done (explicit)

1. Guests can list selectable catalog services and discover **only** Eligibility-eligible Provider/Team candidates for a well-formed browse request.
2. Guests can open a provider/team detail card with profile, gallery, offered service price facts, and crew/team summary without private leakage.
3. Search, filters, pagination, and sorting are server-authoritative and cannot surface ineligible Providers.
4. OpenAPI + Postman cover every new HTTP operation; Zod validates boundaries; authorization/privacy tests pass.
5. Phase and repository gates required by the DoD pass; no unresolved BLOCKER/MAJOR review findings.
6. No booking mutation, payments, wallets, maps, premium boost, Docker, or cloud.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Guest discovers eligible providers (Priority: P1)

An anonymous guest selects service, textual locality, date/time window, and crew preference, then receives a paginated eligible Provider/Team list with safe commercial sorting facts.

**Why this priority**: Core marketplace discovery; roadmap Done-When.  
**Independent Test**: HTTP integration against composition-wired Eligibility facade + seeded Catalog/Providers/Configuration facts; assert ineligible Providers never appear.  
**Acceptance Scenarios**:

1. **Given** valid browse query inputs and at least one eligible Team, **When** `GET /api/v1/browse/providers` runs, **Then** only allowlisted eligible candidates appear, sorted by standard rules, with pagination metadata.
2. **Given** a Provider that Eligibility would exclude, **When** the same query runs, **Then** that Provider/Team is absent and no exclusion diagnostics leak.
3. **Given** missing required query fields or coordinates/radius, **When** called, **Then** validation fails with a stable error (no partial eligible dump).
4. **Given** no Bearer token, **When** called, **Then** the request succeeds under guest access (subject to rate limits).

### User Story 2 — Guest browses categories and services (Priority: P1)

An anonymous guest lists selectable catalog services (and category grouping facts exposed by the selectable summary) for an active country/locale.

**Why this priority**: Roadmap “Browse categories and services”; prerequisite for discovery.  
**Independent Test**: Call browse catalog endpoints; assert only selectable/active catalog projections; no staff mutation routes.  
**Acceptance Scenarios**:

1. **Given** an active country and locale `AR` or `EN`, **When** `GET /api/v1/browse/services` is called, **Then** selectable summaries return with pagination consistent with Catalog public reader semantics.
2. **Given** a staff-only or non-selectable service, **When** listed/fetched via browse, **Then** it is omitted or not found without enumerating internal staff fields.

### User Story 3 — Guest opens provider details (Priority: P1)

An anonymous guest opens details for an eligible Provider/Team in context of a browse request (service + locality + time + crew), seeing profile text, signed media, price, and team/crew summary.

**Why this priority**: Roadmap provider profile / gallery / services / prices / team summary.  
**Independent Test**: Detail endpoint for an eligible candidate returns allowlisted fields; detail for an ineligible or unknown id fails closed without leaking existence beyond non-enumerating rules defined in plan.  
**Acceptance Scenarios**:

1. **Given** an eligible `providerId`+`teamId` for the request context, **When** detail is fetched, **Then** response includes contact-free profile, gallery delivery URLs, service price facts for the requested service, and crew summary counts/genders without Worker identity PII.
2. **Given** phone/email/channel contact rows exist privately, **When** detail is fetched, **Then** those values are absent.
3. **Given** ratings module is absent, **When** detail is fetched, **Then** no fabricated rating values appear.

### User Story 4 — Server search, filters, and stable pagination (Priority: P2)

Guests refine the eligible list with optional max price and display-name search without bypassing Eligibility; cursors remain stable for a single evaluation result set.

**Why this priority**: Roadmap filters/pagination/search.  
**Independent Test**: Assert filter/search operate only on eligible projection; cursor round-trip does not introduce ineligible rows.  
**Acceptance Scenarios**:

1. **Given** eligible candidates spanning prices, **When** `maxPriceAmount` is set, **Then** only candidates with `sortingFacts.priceAmount` ≤ max remain.
2. **Given** `q` matching one display name, **When** searched, **Then** only matching eligible candidates remain.
3. **Given** limit/cursor, **When** pages are walked, **Then** no duplicates/skips within the frozen sorted eligible set for that evaluation fingerprint (plan defines fingerprint binding).

### User Story 5 — Booking is not created here (Priority: P2)

Browse never creates a booking; responses may advertise that verified account + later booking phases are required before payment.

**Why this priority**: Roadmap Done-When without pulling P13 scope.  
**Independent Test**: No bookings tables/mutations in phase migration/diff; contract documents prerequisites.  
**Acceptance Scenarios**:

1. **Given** any browse success, **When** inspected, **Then** no booking id or draft is created.
2. **Given** provider detail, **When** returned, **Then** a stable `bookingPrerequisites` object states booking/payment are unavailable in this phase / require verified customer in later phases (exact shape in contract).

## Edge Cases

- Eligibility hard failure → Browse returns a mapped safe technical error; no empty “success” that pretends evaluation succeeded.
- Empty eligible set → `200` with empty page (not an error).
- Invalid cursor / cursor from different request fingerprint → `VALIDATION_FAILED`.
- Locale missing/invalid → validation failure; defaulting policy fixed in plan (likely require explicit `locale`).
- Media signing failure for one logo/cover/gallery item → omit that slot/item (EX-01); do not fail the whole list/detail response.
- Team inactive between list and detail → fail closed on detail (not found / no longer eligible).
- Authenticated but verification-only principal calling browse → still allowed for browse reads (booking remains later).
- Rate-limit abuse on guest list/detail → limited without leaking internals.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST expose guest-capable Browse HTTP under `/api/v1/browse/*`.
- **FR-002**: System MUST obtain eligible Provider/Team candidates only via composition-wired `getStandardBrowseCandidates`.
- **FR-003**: System MUST NOT expose excluded-candidate diagnostics, Worker IDs, or private Provider contacts on Browse responses.
- **FR-004**: System MUST support listing selectable catalog services for browse (country + locale).
- **FR-005**: System MUST support provider/team detail with contact-free profile, gallery, service price facts, and crew/team summary for an eligible candidate in request context.
- **FR-006**: System MUST apply server-side standard sorting (price asc, then providerId, teamId).
- **FR-007**: System MUST support limit/cursor pagination over the sorted eligible set (default 20, max 50).
- **FR-008**: System MUST support optional `maxPriceAmount` and optional display-name `q` filters after eligibility.
- **FR-009**: System MUST reject coordinates, radius, map, and socket browse behavior.
- **FR-010**: System MUST validate all Browse inputs with Zod at the HTTP boundary.
- **FR-011**: System MUST document and test that Browse creates no bookings and performs no payments.
- **FR-012**: System MUST omit fabricated ratings; rating summary only when a real ratings module exists (not in this phase).
- **FR-013**: Bookings module MUST call other modules only through approved public contracts / composition.
- **FR-014**: OpenAPI and Postman MUST cover every new Browse operation including auth, errors, and examples.
- **FR-015**: System MUST provide read-only locality helpers needed to form a browse request (active cities/districts for an active country) without staff credentials.

### Key Entities

- **BrowseEvaluationContext**: service, country, city, optional district, UTC interval, crew preference, required units, locale — binds list/detail/pagination.
- **BrowseCandidateCard**: safe list projection (ids + sorting facts + contact-free name/media thumbnails as planned).
- **BrowseProviderDetail**: contact-free profile, gallery, price, crew summary, prerequisites hint.
- **BrowseCatalogServiceSummary**: selectable catalog projection for guests.

## Success Criteria *(mandatory)*

- **SC-001**: Integration tests prove ineligible Providers never appear in list or detail success payloads.
- **SC-002**: Guest (no auth) can complete catalog → list → detail happy path against disposable fixtures.
- **SC-003**: Privacy tests assert forbidden markers (phone, email, workerId, storage keys) absent from Browse JSON.
- **SC-004**: OpenAPI validate + Postman validate pass for new operations.
- **SC-005**: Phase coverage meets ≥80% statements / ≥75% branches / ≥80% functions / ≥80% lines on phase-owned executable files.
- **SC-006**: Module-boundary review finds no forbidden cross-module Prisma/repository imports.
- **SC-007**: If a migration is required, clean install + populated P11→P12 upgrade proofs pass; if none, migration gates are NOT_APPLICABLE with recorded reason.

## Out of Scope

- Booking draft, pricing snapshot mutation, status machine (P13)
- Ledger, deposit payments, webhooks
- Ratings/reviews module
- Premium boost / Recommended
- Maps, distance, coordinates, sockets
- Analytics event tables (unless prep acceptance forces them)
- Staff catalog/locality mutation via browse routes
- Flipping `eligibleForPublicBrowse` as browse authority
- Docker, cloud, production migration, Git publication
