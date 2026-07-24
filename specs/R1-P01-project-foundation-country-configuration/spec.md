# Feature Specification: Project Foundation & Country Configuration

**Feature Branch**: `Not created (no before_specify hook configured)`

**Created**: 2026-07-24

**Status**: Draft

**Input**: Specify R1-P01 — Project Foundation & Country Configuration: a production-ready application foundation and Egypt-first, country-aware configuration foundation that later phases (especially R1-P02 authentication) can safely build on. Preparation only; do not implement.

## Canonical Sources & Phase Boundary *(mandatory)*

**Active Phase**: `R1-P01 — Project Foundation & Country Configuration`, confirmed by `docs/product/current.md` with status `Not Started`.

**Phase Goal and Definition of Done**: `docs/product/roadmap.md`, section `R1-P01 — Project Foundation & Country Configuration`. The phase creates the production-ready technical foundation and Egypt-first configuration model. It is done when the application runs in local and test environments, Egypt is enabled by seed data, country-sensitive configuration is read by `countryCode`, migrations/tests/linting/documentation checks run in CI, and error/logging conventions are documented.

**Dependency evidence**: R1-P00 is Complete with final review verdict APPROVED. Its architecture contract under `docs/architecture/` is frozen. R1-P01 is the only current phase. R1-P00 implementation summary: `specs/R1-P00-product-database-architecture/implementation-summary.md`.

**Canonical standalone boundary**: `docs/product/standalone-project-boundary.md`. R1-P01 MUST create Cleanora’s first product migration inside this repository and MUST NOT depend on another repository, schema, migration history, database, or undocumented service.

**Locked Product Rules** (R1-P01-relevant):

- Vision §1.1 and DEC-012: standalone greenfield product; repository-local schema and migration history only.
- Vision launch country Egypt (`EG`) with multi-country-ready design: country-sensitive configuration MUST use `countryCode`; business code MUST NOT hard-code Egypt.
- Vision §15 and database conventions FR-047/FR-048: countries and currencies are reference data; localization foundations support Arabic and English without inventing unapproved locales.
- DEC-003 / constitution IX: no Cleanora stored-value wallets.
- DEC-014 / constitution IV & X: design globally, implement locally, migrate incrementally; applied migrations are immutable; R1-P01 owns the first phase-owned product migration named `r1_p01_<short_description>`.
- Constitution III: modular monolith; other modules consume configuration and audit foundations through explicit public contracts, never direct persistence access.
- Constitution VII: risk-proportional tests; Release 1 tests MUST NOT depend on Docker or Testcontainers.
- Constitution IX: Docker and cloud work deferred until Release 3.

**Approved Decisions** (directly relevant):

- DEC-003 — No internal Cleanora wallets.
- DEC-012 — Standalone greenfield project.
- DEC-014 — Prisma schema and migrations evolve phase by phase; R1-P01 is the first product migration owner.

**Open Questions** (R1-P01 impact):

| ID | Blocks R1-P01? | Impact on this phase | Temporary boundary |
|---|---|---|---|
| OQ-001–OQ-014 | No | None change application foundation, country/currency reference data, Egypt seed, or audit-log foundation scope | Preserve each OQ’s temporary rule; do not invent answers during R1-P01 |

Effective configuration precedence is **resolved** in Clarifications (Session 2026-07-24): per-key resolution policy. It no longer blocks planning.

**Approved persisted scope** (behavior and ownership; field-level design lives in the approved plan and data-model):

| Concept / table | Owning module | Notes |
|---|---|---|
| `countries` | `configuration` | Authoritative country reference data |
| `currencies` | `configuration` | Authoritative currency reference data |
| `country_configs` | `configuration` | Country-scoped configuration |
| `app_configs` | `configuration` | Global application configuration |
| `audit_logs` foundation | `admin` | Shared audit foundation; R1-P03 may extend for privileged authorization actions |

**Explicit exclusions**:

- No authentication, signup, login, JWT, refresh token, cookies, OTP, password reset, or Google sign-in (R1-P02).
- No roles or permissions (R1-P03).
- No customer, provider, catalog, booking, order, payment, marketer, or geo implementation.
- No future-phase tables.
- No Docker or cloud work before Release 3.
- No stored-value wallet.
- No production deployment or production migration.
- No implementation during specification.
- Do not mark R1-P01 In Progress or Complete during specification.

## Clarifications

### Session 2026-07-24

- Q: How should effective configuration resolve when global and country-specific values interact or a country value is missing? → A: Option C — per-key effective-configuration policy. Each key declares one of: (1) Global only — value from global application configuration only; country override rejected; (2) Country override with global fallback — country value overrides global; missing country uses global; both missing fails explicitly; (3) Country required — country value must exist for the requested country (fail closed); global must not silently replace it. Unknown keys fail explicitly; unknown/inactive/unsupported `countryCode` fails explicitly; same-key country and global records must not be ambiguous; the configuration public contract returns the effective value and its resolved scope/source; no additional table — planning may place policy metadata in approved `app_configs`/`country_configs` design; configuration values must not store credentials or secrets.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start and Observe a Safe Application Foundation (Priority: P1)

As a developer or operator, I need the application to start predictably when configuration is valid, fail safely when it is not, and expose distinguishable health signals so local/test work and later phases have a trustworthy runtime foundation.

**Why this priority**: Without a safe startup, observability, and health baseline, no later phase can be developed or verified reliably.

**Independent Test**: Start with valid configuration and confirm the process becomes ready; start with invalid configuration and confirm a clear failure; query liveness, readiness, and database-connectivity signals and confirm they are distinguishable and do not expose secrets.

**Acceptance Scenarios**:

1. **Given** all required environment configuration is present and valid, **When** a developer starts the application in a local or test environment, **Then** the application starts predictably and becomes ready for requests.
2. **Given** required configuration is missing or malformed, **When** startup is attempted, **Then** startup fails safely before serving traffic and reports actionable diagnostics that identify the configuration problem without exposing secrets.
3. **Given** the application is running, **When** an operator inspects health, **Then** live, ready, and database-unavailable (or database-connectivity-failed) states are distinguishable from each other.
4. **Given** a health or readiness check, **When** the response is inspected, **Then** it does not reveal sensitive configuration values, credentials, or internal secrets.

---

### User Story 2 - Consume Stable API Contracts (Priority: P1)

As an API consumer (including future authentication and other modules), I need one consistent public API foundation with stable success, validation-error, and unexpected-error formats so clients and tests can rely on predictable behavior.

**Why this priority**: Inconsistent response and validation contracts would force every later phase to invent incompatible formats.

**Independent Test**: Call a foundation endpoint or representative validated request path and verify success payload shape, validation failure shape, unexpected-error shape, API versioning consistency, and presence of a correlation identifier without leaking sensitive internals.

**Acceptance Scenarios**:

1. **Given** a successful request on the public API foundation, **When** the response is inspected, **Then** it follows the documented stable success format under one consistent API versioning approach.
2. **Given** a request that fails input validation, **When** the response is inspected, **Then** the failure is consistent, machine-readable, and does not claim success.
3. **Given** an unexpected server failure, **When** the response is inspected, **Then** the client receives a stable unexpected-error format that does not leak sensitive implementation details.
4. **Given** any request, **When** logs and response metadata are inspected, **Then** a correlation/trace identifier is available for tracing that request across structured logs.

---

### User Story 3 - Trace Operations Without Leaking Secrets (Priority: P1)

As a maintainer, I need structured request and application logging with correlation identifiers and redaction so I can diagnose failures without writing credentials, tokens, secrets, cookies, or sensitive personal data into logs.

**Why this priority**: Undiagnosable failures and secret leakage both block production-ready foundation quality.

**Independent Test**: Issue a request with known identifiers, locate matching structured log entries by correlation identifier, and confirm sensitive values are redacted or absent.

**Acceptance Scenarios**:

1. **Given** a request with a correlation identifier, **When** a maintainer searches structured logs, **Then** request and application log entries for that request are findable by that identifier.
2. **Given** a request that includes credentials, tokens, secrets, cookies, or sensitive personal data, **When** logs are written, **Then** those sensitive values are redacted or omitted.
3. **Given** a missing, malformed, or untrusted client-supplied correlation identifier, **When** the request is processed, **Then** the system still assigns or normalizes a trustworthy correlation identifier for server-side tracing and does not treat an untrusted client value as authoritative security evidence.

---

### User Story 4 - Resolve Country-Aware Configuration Safely (Priority: P1)

As a country-aware module (or its maintainer), I need authoritative countries and currencies, distinguishable global versus country configuration, and deterministic effective-configuration resolution by `countryCode` so Egypt and future countries behave through configuration rather than hard-coded rules.

**Why this priority**: R1-P02 and later marketplace phases depend on a trustworthy, non-hard-coded country/configuration contract.

**Independent Test**: Seed Egypt, resolve configuration by Egypt’s `countryCode` for keys under each per-key policy, attempt unknown keys and unknown/inactive/unsupported countries, and confirm consumers use the configuration module’s public contract (effective value plus resolved scope/source) rather than direct persistence access.

**Acceptance Scenarios**:

1. **Given** Egypt is seeded as enabled configuration, **When** a country-aware consumer resolves settings by Egypt’s `countryCode`, **Then** effective configuration is returned through the configuration module’s public contract with the effective value and its resolved scope/source, and Egypt-specific behavior is not hard-coded in application logic.
2. **Given** a key declared **Global only**, **When** a consumer resolves that key (with or without a country context), **Then** the effective value comes only from global application configuration and any country override for that key is rejected.
3. **Given** a key declared **Country override with global fallback**, **When** a country-specific value exists, **Then** that country value is the effective value with country scope/source; **When** the country value is missing and a global value exists, **Then** the global value is used with global scope/source; **When** both are missing, **Then** resolution fails explicitly.
4. **Given** a key declared **Country required**, **When** a country-specific value exists for the requested country, **Then** that value is returned; **When** it is missing, **Then** resolution fails closed and a global value must not silently replace it.
5. **Given** an unknown configuration key, **When** resolution is attempted, **Then** the system fails explicitly.
6. **Given** an unknown, inactive, or unsupported `countryCode`, **When** resolution is attempted, **Then** the system fails explicitly rather than silently substituting another country or inventing defaults.
7. **Given** a country configured with an unsupported or inactive currency, **When** validation or resolution occurs, **Then** the combination fails explicitly.
8. **Given** a future module needs country or configuration data, **When** it integrates, **Then** it consumes only the configuration module’s explicit public contract and does not access configuration persistence directly.

---

### User Story 5 - Seed Egypt and Apply the First Product Migration (Priority: P1)

As a maintainer, I need a repeatable Egypt seed and the first Cleanora phase-owned product migration so a clean test database can be created from repository-local history without duplicates or external-system dependencies.

**Why this priority**: Standalone boundary and later phases require a clean, repeatable database starting point owned by R1-P01.

**Independent Test**: Apply the R1-P01 migration to a clean test database, run the Egypt seed twice, and confirm countries/currencies/configuration exist once and migration naming follows `r1_p01_<short_description>`.

**Acceptance Scenarios**:

1. **Given** a clean test database and the Cleanora migration history, **When** a maintainer applies the R1-P01 phase-owned migration, **Then** only approved R1-P01 persisted foundations are created and no future-phase tables appear.
2. **Given** the Egypt seed workflow, **When** the maintainer runs it successfully, **Then** Egypt is enabled through configuration data (country, currency, locale foundations, and required configuration records) without hard-coded Egypt business rules.
3. **Given** a prior successful or interrupted seed run, **When** the seed is executed again, **Then** execution is repeatable and does not create duplicate authoritative reference data.
4. **Given** configuration records, **When** they are reviewed, **Then** they are not used as an undocumented secret store for credentials or sensitive secrets.

---

### User Story 6 - Establish Shared Audit Evidence Foundation (Priority: P2)

As a platform maintainer preparing later privileged workflows, I need a shared audit-log foundation owned by the admin module so future auditable actions can record actor/system identity (when available), action, target, timestamp, reason/context where applicable, and traceability — without inventing future business actions in R1-P01.

**Why this priority**: Audit evidence is required by constitution and architecture, but privileged workflows belong to later phases.

**Independent Test**: Persist a foundation audit record with required identity/action/target/timestamp/context fields for a representative foundation-level event (or documented write path), confirm ownership remains `admin`, and confirm no R1-P03 privileged workflows are implemented.

**Acceptance Scenarios**:

1. **Given** the audit-log foundation, **When** an allowed foundation write occurs, **Then** the record can capture actor or system identity when available, action, target, timestamp, and reason/context where applicable, with traceability to the originating operation.
2. **Given** R1-P01 scope, **When** the phase is reviewed, **Then** only the audit foundation exists; privileged authorization workflows and R1-P03 extensions are absent.
3. **Given** audit logging fails during an operation that requires audit evidence in a later phase, **When** that failure mode is considered for R1-P01 foundation design, **Then** the specification requires the foundation to make audit-write failure an explicit, testable concern (fail closed or surface failure) rather than silently dropping required evidence — without implementing those future workflows now.

---

### User Story 7 - Prove Quality Gates in CI (Priority: P2)

As a maintainer, I need unit, integration, E2E (where applicable), helper, and coverage foundations plus CI checks for linting, type checking, tests, documentation, schema/migration validation, and seed failures so defects are detected before later phases build on a broken base.

**Why this priority**: Foundation quality without automated detection will regress as soon as authentication and marketplace work begins.

**Independent Test**: Run the documented CI-equivalent quality gate set against known-good and deliberately broken lint/type/test/docs/schema/migration/seed conditions and confirm failures are detected.

**Acceptance Scenarios**:

1. **Given** the R1-P01 test foundations, **When** applicable unit, integration, E2E, helper, and coverage checks are exercised, **Then** they are available and can fail the quality gate when assertions fail.
2. **Given** a lint, type, test, documentation, schema, migration, or seed failure, **When** CI (or the documented local equivalent gate) runs, **Then** the failure is detected and the gate does not pass.
3. **Given** security-header and rate-limiting foundations, **When** they are exercised under normal and storage/middleware-failure conditions, **Then** expected protective behavior or explicit failure handling is demonstrable without requiring Docker/cloud deployment.

---

### Edge Cases

- Missing or malformed required environment values at startup.
- Database unavailable during startup or readiness/connectivity checks.
- Duplicate seed execution after success.
- Interrupted seed execution followed by retry.
- Unknown `countryCode`.
- Inactive `countryCode`.
- Unsupported `countryCode` for the current product scope.
- Country configured with unsupported or inactive currency.
- Unknown configuration key requested for effective resolution.
- Key declared **Global only** but a country-specific value is supplied or present — country override rejected.
- Key declared **Country override with global fallback** with country value present — country wins.
- Key declared **Country override with global fallback** with country value missing and global present — global fallback used.
- Key declared **Country override with global fallback** with both country and global values missing — explicit failure.
- Key declared **Country required** with country value missing — fail closed; global must not silently replace it.
- Ambiguous same-key country and global records that violate the key’s declared policy (for example, conflicting or duplicate authoritative rows for one logical key/scope).
- Invalid configuration value or type for a known key.
- Configuration value attempted to store credentials or secrets.
- Request correlation identifier missing, malformed, or supplied by an untrusted client.
- Logs that would otherwise contain credentials, tokens, secrets, cookies, or sensitive personal data.
- Rate-limit storage or middleware failure.
- Audit logging failure for an operation that later phases will treat as auditable.
- Health endpoints accidentally exposing sensitive configuration.
- Migration partially fails.
- Generated migration SQL contains destructive behavior.
- Configuration records incorrectly used to store undocumented secrets.
- Cross-module attempt to read configuration persistence directly instead of the public contract.

## Requirements *(mandatory)*

### Functional Requirements

#### Application foundation

- **FR-001**: System MUST start predictably in local and test environments when required configuration is valid.
- **FR-002**: System MUST validate required environment configuration before becoming ready to serve traffic.
- **FR-003**: System MUST fail startup safely with actionable diagnostics when required configuration is missing or invalid, without exposing secrets.
- **FR-004**: System MUST establish database connectivity and make connectivity status observable.
- **FR-005**: System MUST distinguish liveness, readiness, and database-connectivity health outcomes.
- **FR-006**: System MUST expose one consistent public API versioning foundation for versioned endpoints introduced in this and later phases.
- **FR-007**: System MUST return successful responses in a documented, stable success format.
- **FR-008**: System MUST return validation failures in a documented, stable, machine-readable format.
- **FR-009**: System MUST return unexpected errors in a documented, stable format that does not leak sensitive implementation details.
- **FR-010**: System MUST associate requests with correlation/trace identifiers usable across logs and diagnostics.
- **FR-011**: System MUST provide structured request and application logging.
- **FR-012**: System MUST redact or omit sensitive values (credentials, tokens, secrets, cookies, and sensitive personal data) from logs.
- **FR-013**: System MUST define security-header foundations for public HTTP responses.
- **FR-014**: System MUST define rate-limiting foundations for public HTTP traffic, including explicit behavior when rate-limit storage or middleware fails.
- **FR-015**: System MUST provide a maintainable API documentation foundation for public endpoints.
- **FR-016**: System MUST provide unit, integration, helper, and coverage test foundations; and E2E foundations where applicable to this phase’s risks.
- **FR-017**: System MUST support CI execution of linting, type checking, tests, documentation checks, and migration/seed validation such that failures are detected.

#### Country and configuration foundation

- **FR-018**: System MUST treat countries as authoritative reference data owned by the configuration module.
- **FR-019**: System MUST treat currencies as authoritative reference data owned by the configuration module.
- **FR-020**: System MUST resolve country-sensitive behavior using `countryCode` rather than hard-coded country branches in business logic.
- **FR-021**: System MUST structurally distinguish global application configuration (`app_configs`) from country-specific configuration (`country_configs`).
- **FR-022**: System MUST resolve effective configuration deterministically for a given configuration key (and `countryCode` when the key’s policy requires country context) using a **per-key resolution policy** declared for that key, with exactly one of the following behaviors:
  - **Global only**: the effective value comes only from global application configuration; a country override for that key is rejected.
  - **Country override with global fallback**: a country-specific value overrides the global value; if the country value is missing, the global value is used; if both are missing, resolution fails explicitly.
  - **Country required**: a country-specific value MUST exist for the requested country; missing country configuration fails closed; a global value MUST NOT silently replace it.
  Additionally, unknown configuration keys MUST fail explicitly; country and global records for the same key MUST NOT be ambiguous relative to the declared policy; the configuration module public contract MUST return the effective value and its resolved scope/source; policy metadata MUST be expressed within the approved `app_configs` / `country_configs` design (no additional table invented in this phase); and configuration values MUST NOT store credentials or secrets.
- **FR-023**: System MUST enable Egypt through repeatable seed data, not through hard-coded Egypt-only business rules.
- **FR-024**: System MUST provide currency and locale foundations that support Egypt while remaining usable for future countries without schema invention beyond this phase’s approved scope.
- **FR-025**: System MUST fail explicitly for unknown, inactive, or unsupported country/currency combinations.
- **FR-026**: System MUST make seed execution repeatable without creating duplicate authoritative reference data.
- **FR-027**: System MUST NOT use configuration records as an undocumented secret store.
- **FR-028**: Authorized consumers MUST obtain country and configuration data only through the configuration module’s explicit public contract, never through direct access to another module’s persistence internals.

#### Audit foundation

- **FR-029**: System MUST provide a shared audit-log foundation owned by the admin module.
- **FR-030**: Audit foundation records MUST support actor or system identity when available, action, target, timestamp, reason/context where applicable, and traceability to the originating operation.
- **FR-031**: R1-P01 MUST establish the audit foundation only and MUST NOT implement future privileged authorization workflows reserved for R1-P03 or later.
- **FR-032**: Audit-write failure MUST be an explicit, testable foundation concern (not silent discard) for operations that require audit evidence; future privileged workflows remain out of scope for implementation in this phase.

#### Database and standalone boundary

- **FR-033**: R1-P01 MUST own the first Cleanora product migration inside this repository’s schema and migration history.
- **FR-034**: The phase-owned migration MUST be incremental, clearly named `r1_p01_<short_description>`, and limited to approved R1-P01 persisted foundations.
- **FR-035**: The later technical plan MUST define schema changes, constraints, indexes, seed ownership, SQL review, clean-database validation, and forward-fix strategy; the specification MUST NOT invent Prisma field designs.
- **FR-036**: System MUST NEVER depend on another repository, schema, migration history, database, or undocumented service.
- **FR-037**: System MUST NOT create future-phase tables in this phase.
- **FR-038**: Migration SQL MUST be reviewed so partial failure modes and destructive operations are detected before acceptance; destructive behavior requires explicit justification and evidence, otherwise it is rejected.
- **FR-039**: Health and diagnostics endpoints MUST NOT expose sensitive configuration.

### Key Entities

- **Country**: Authoritative reference for a supported or known country, identified for business use by `countryCode`, with activation/availability semantics sufficient to reject inactive or unsupported use.
- **Currency**: Authoritative reference for a currency usable by country configuration and later monetary phases; activation/availability semantics allow explicit rejection of unsupported pairings.
- **Global application configuration (`app_configs`)**: Keyed application settings that are global in scope, structurally distinct from country-scoped settings, and able to participate in per-key policy metadata without inventing an additional table.
- **Country configuration (`country_configs`)**: Keyed settings scoped to a `countryCode`, used with global configuration under each key’s declared resolution policy to produce effective configuration for country-aware consumers.
- **Effective configuration (derived)**: The deterministic resolved view a consumer receives for a key (and country when required) after applying that key’s declared policy — one of Global only, Country override with global fallback, or Country required — including the effective value and its resolved scope/source (global or country). Unknown keys and policy violations fail explicitly; no silent cross-scope substitution outside the declared policy.
- **Locale foundation**: Configuration-supported locale capability (at minimum enabling Egypt’s Arabic and English needs) without inventing unapproved additional locale product rules.
- **Audit log (foundation)**: Append-oriented evidence record owned by `admin`, capturing identity (when available), action, target, timestamp, optional reason/context, and traceability; extended later by R1-P03 for privileged authorization actions.
- **Phase-owned migration & seed workflow**: Repository-local first product migration and repeatable Egypt-enabling seed process that create only approved R1-P01 foundations.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With valid local/test configuration, a developer can start the application and observe a ready state in one documented startup attempt without manual schema improvisation.
- **SC-002**: With any single required configuration value missing or malformed, startup fails in 100% of attempts before serving traffic and names the defective configuration area in diagnostics (without secret values).
- **SC-003**: An operator can distinguish live, ready, and database-unavailable outcomes using health signals in 100% of exercised failure/success cases in the phase test suite.
- **SC-004**: 100% of sampled successful, validation-failed, and unexpected-error responses in the phase suite conform to the documented stable formats and one API versioning foundation.
- **SC-005**: For 100% of traced sample requests, a maintainer can locate corresponding structured log entries by correlation identifier within the phase’s logging evidence.
- **SC-006**: In 100% of redaction test cases covering credentials, tokens, secrets, cookies, and sensitive personal data fixtures, those values do not appear in clear text in emitted logs.
- **SC-007**: After one successful Egypt seed, repeating the seed produces zero duplicate authoritative country/currency/reference rows for Egypt’s seeded identity.
- **SC-008**: 100% of resolution attempts for unknown, inactive, or unsupported country/currency combinations fail explicitly in tests (no silent substitution).
- **SC-009**: A clean test database can be created by applying Cleanora migrations through R1-P01 with zero future-phase tables present and with migration name matching `r1_p01_<short_description>`.
- **SC-010**: CI (or the documented equivalent gate set) fails when any one of lint, type check, tests, documentation check, schema/migration validation, or seed validation is intentionally broken in the phase evidence suite.
- **SC-011**: 100% of configuration-consumer tests in this phase use the configuration module public contract; direct persistence access by foreign modules is absent from accepted code and tests.
- **SC-012**: Audit foundation evidence for required sample writes includes identity (when available), action, target, timestamp, and traceability fields in 100% of foundation audit tests; no R1-P03 privileged workflow is implemented.
- **SC-013**: Health responses in the phase suite contain zero sensitive configuration secrets across positive and negative cases.
- **SC-014**: Egypt-enabled behavior demonstrated in this phase is achievable with Egypt removed from hard-coded business-rule branches (configuration/seed driven), verified by review and targeted tests.
- **SC-015**: For each declared per-key policy (Global only; Country override with global fallback; Country required), 100% of phase suite cases for that policy produce the approved effective value or explicit failure, and successful resolutions expose the correct resolved scope/source.
- **SC-016**: 100% of resolution attempts for unknown configuration keys fail explicitly in the phase suite (no invented defaults).

## Assumptions

- R1-P00 architecture deliverables remain the frozen contract for ownership, conventions, and standalone boundary; this specification does not reopen them.
- Local and test environments are the delivery targets for R1-P01; production deployment and production migration remain human-controlled later operations outside this phase’s completion bar.
- “API versioning foundation” means one consistent public versioning approach and documentation baseline, not the invention of every future endpoint.
- Security headers and rate limiting in R1-P01 are foundations (baseline protections and failure semantics), not a complete abuse-prevention product.
- Locale foundation for Egypt includes Arabic and English capability at the configuration level; additional locales are not invented.
- Audit foundation may be exercised with foundation-level or technical audit writes sufficient to prove the record shape and ownership; business privileged actions remain for R1-P03+.
- Rate-limit and health foundations do not require Docker or cloud infrastructure in Release 1 tests.
- No open question in `docs/product/open-questions.md` currently changes R1-P01 table ownership; effective-configuration precedence is clarified as per-key policy (Clarifications Session 2026-07-24) and does not invent an additional table.
- Branch naming remains TBD in `docs/product/current.md`; absence of a git branch does not block specification.
- The approved `plan.md` and `data-model.md` now define Prisma columns, indexes, SQL expectations, and policy-metadata placement within `app_configs` / `country_configs`. Implementation MUST follow those approved artifacts. Any material deviation requires an explicit plan/spec amendment before implementation. Migration naming remains `r1_p01_foundation_country_configuration`.
