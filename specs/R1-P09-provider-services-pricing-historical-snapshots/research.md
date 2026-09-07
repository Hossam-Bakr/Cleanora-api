# Phase 0 Research: R1-P09 Provider Services and Pricing

**Date**: 2026-09-05

**Status**: Complete for planning. These are design decisions, not implemented
changes.

## Repository Findings

- The repository is a Node.js 24+/TypeScript 6 strict modular monolith using
  Express 5, Zod 4, Prisma 7, PostgreSQL, Vitest, and Supertest.
- Providers is already an established module with thin route/controller
  adapters, service-owned orchestration, Providers-owned Prisma repositories,
  transaction-bound Authentication and Admin collaborators, optimistic
  concurrency, retained histories, and phase-specific test suites.
- R1-P08 Catalog already exposes `CatalogDefinitionReader` from
  `src/modules/catalog/catalog.public.ts`. Its snapshot-ready method resolves
  one exact-locale, country-selectable definition in a Catalog-owned read
  snapshot and includes service/category versions, active price units, fields,
  options, and media references.
- Configuration already owns `Country`, `Currency`, `AppConfig`, and
  `CountryConfig`; it already resolves an active country's default currency and
  a country-required configuration key internally, but its public contract does
  not yet expose default currency scale or a Provider-service pricing policy.
- Authentication already supplies trusted principals, Provider-admin identity
  facts, Staff capability authorization, and transaction-bound Staff permission
  checks. The Staff union is currently limited to earlier Provider permissions.
- Admin already exposes a transaction-bound general audit writer. Providers
  must compose it rather than write `audit_logs` directly.
- The current readiness policy intentionally reports R1-P09 services as
  deferred. R1-P09 must replace that stub with dynamic Provider-service facts
  while keeping `eligibleForPublicBrowse=false`.
- The latest applied migration is
  `r1_p08_catalog_localization_service_requirements`; no R1-P09 schema exists.
- Phase gates already follow the pattern `vitest.r1-p0N.config.ts`,
  `test:r1-p0N`, `test:coverage:r1-p0N`, an additive Postman generator, a clean
  migration validator, and a populated previous-phase upgrade validator.

## Decision 1: Extend Providers, do not create a new capability

**Decision**: Add a compact Provider-service vertical under
`src/modules/providers/` with Provider-owned domain policies, one command
service, one management query service, one internal snapshot service, one
repository/UoW pair, and thin HTTP adapters.

**Rationale**: DEC-041/DEC-044, the ownership matrix, roadmap table ownership,
and FR-045 all assign these behaviors to Providers. The existing module already
has the required authorization, transaction, readiness, and audit integration
patterns.

**Rejected alternatives**:

- A Pricing or ProviderServices module would split ownership of one Provider
  aggregate and violate the locked modular-monolith boundary.
- A generic workflow/state-machine/approval component is broader than one
  phase and is explicitly out of scope.

## Decision 2: Use exactly four tables and place receipts in histories

**Decision**: Add only `provider_services`, `provider_service_prices`,
`provider_service_price_history`, and `provider_service_status_history`.
Durable idempotency receipt columns live on the primary history row for each
accepted command. Price proposals and Staff decisions use price history;
offering creation, configuration replacement, and enable/disable use status
history. Additional transition rows use derived operation keys and no second
receipt.

**Rationale**: Identical retries must return the original safe result even after
later mutations, so a single “last command” field is insufficient. The roadmap
authorizes four tables only. Both history tables are Provider-owned,
append-only, already mandatory for every accepted mutation family, and can
retain the command scope, idempotency key, SHA-256 request fingerprint, safe
result code, and safe result JSON without a fifth entity.

`ProviderServiceStatusHistory` therefore has internal `CREATED` and
`CONFIGURATION_UPDATED` aggregate-state receipt events in addition to
`ENABLED` and `DISABLED`. It remains phase-specific, never becomes a generic
workflow ledger, and the public management status-history endpoint filters to
the two actual status transitions. The internal rows are not represented as
Provider enable/disable events.

**Rejected alternatives**:

- A fifth command table conflicts with the authorized four-table roadmap.
- Reusing `provider_workforce_commands` would couple unrelated Provider
  capabilities and corrupt its workforce-specific semantics.
- Storing receipts in Admin audit would give Admin ownership of Provider
  idempotency and would require business reads from audit persistence.
- Keeping only the most recent receipt fails the specified late-retry case.
- An ever-growing receipt JSON array on `provider_services` weakens relational
  constraints and append-only enforcement.

## Decision 3: New offerings are disabled and creation starts at version 1

**Decision**: `POST /providers/:providerId/services` requires
`expectedVersion: 0`, creates the offering disabled, creates its first retained
price according to the current approval policy, appends creation/price history,
and returns aggregate version `1`. Enablement is a separate reasoned,
versioned, idempotent command.

**Rationale**: There is no current aggregate version before creation. The
zero-to-one convention preserves FR-024, prevents an initial pending price from
accidentally enabling an offering, and gives every enabled transition exactly
one status-history entry.

**Rejected alternatives**:

- Caller-selected initial enablement mixes creation and lifecycle semantics and
  becomes ambiguous when price approval is required.
- Omitting an expected version for creation creates an exception to the single
  aggregate concurrency contract.

## Decision 4: Separate Provider configuration from price proposals

**Decision**: Estimated duration and the optional AR/EN note pair are replaced
through a dedicated configuration command. Price unit, price, and minimum
charge are submitted through a price-proposal command. Creation accepts both
sets because an offering must begin with a complete configuration and retained
initial price.

**Rationale**: A notes-only or duration-only edit must not manufacture a new
commercial price proposal. Conversely, price history should change only for an
accepted price proposal or Staff price decision.

**Rejected alternative**: Replacing all fields through one endpoint would
either create duplicate price rows for non-price edits or mutate retained
commercial values in place.

## Decision 5: Reference Catalog identities structurally; read current truth

**Decision**: `provider_services` stores the Catalog service ID only.
`provider_service_prices` stores the selected Catalog price-unit ID and its
immutable code-at-proposal snapshot for historical evidence. Composite foreign
keys enforce that a price unit belongs to the offering's Catalog service.
Current service names, selectability, localization, unit activity/label,
fields/options, and media are never copied into mutable Provider state.

`CatalogDefinitionReader` gains the smallest non-localized selectable lookup by
code for creation and ID-based current-definition lookups for existing
offerings. The later snapshot-ready contract continues to resolve by the
immutable Catalog service code and exact requested locale. Catalog itself
applies selectability and localization rules.

**Rationale**: IDs and foreign keys preserve referential integrity in the
single database while code-level access stays behind the Catalog public
contract. The price-unit code snapshot makes historical management intelligible
after a later Catalog change and is expressly historical evidence, not current
Catalog authority.

**Rejected alternatives**:

- Providers querying `services` or `service_price_units` would violate module
  ownership.
- Copying Catalog names/labels/current versions into `provider_services` would
  create mutable duplicate truth.
- Storing only a unit code would not prove that the selected unit belonged to
  the referenced Catalog service at acceptance.

## Decision 6: Resolve one country pricing policy through Configuration

**Decision**: Configuration defines one country-required object key,
`providers.service_pricing_policy`, with:

```text
approvalRequired: boolean
maximumPrice: canonical positive decimal string
```

The public reader returns the active country identity, active default currency
identity/code/decimal places, approval flag, and maximum price. It converts the
maximum to an exact whole minor-unit digit string after canonical validation.
Missing or invalid country data, currency data, key metadata, country value,
maximum, a currency scale outside 0–30, or a minor-unit value wider than 65
digits fails closed. `prisma/seed.ts` may register the non-secret key metadata
with a null global value, but neither the migration nor seed may invent a
production country policy value.

**Rationale**: An atomic object avoids mismatched approval and maximum reads.
`COUNTRY_REQUIRED` exactly implements DEC-048/DEC-049. Decimal text avoids JSON
number/binary-float ambiguity. Exact `numeric(65,0)` minor units avoid fixed-
scale coercion and preserve the reader's explicit 0–30 currency scale for
formatting.

**Rejected alternatives**:

- Global configuration contradicts the accepted country-scoped policy.
- Provider-owned configuration duplicates Configuration authority.
- A JavaScript/JSON number maximum violates decimal safety.
- Hard-coded defaults would invent production policy and defeat fail-closed
  behavior.

## Decision 7: Retain price rows and select current truth by constrained status

**Decision**: Each accepted proposal creates a new immutable-commercial
`ProviderServicePrice`. Status is `PENDING`, `EFFECTIVE`, `REJECTED`, or
`SUPERSEDED`. Partial unique indexes guarantee at most one pending and one
effective row per offering. SQL prevents deletes and changes to commercial
columns. Price history records creation and every transition.

**Rationale**: This directly implements DEC-048/DEC-050 and removes pointer
cycles between the offering and its price. The database, not application
convention alone, prevents two current prices after a race.

**Rejected alternatives**:

- Updating one price row loses proposal history.
- Current/pending pointer columns create cyclic foreign keys and require extra
  belonging checks.
- Event sourcing is out of scope; current price rows remain directly queryable.

## Decision 8: Snapshot approval-at-proposal; do not auto-transition on config

**Decision**: Each price stores `approvalRequiredAtProposal`. A later policy
change does not automatically approve, reject, or supersede an existing row.
Enabling approval affects only new proposals. Disabling approval creates no new
Staff work and does not auto-activate an old pending amount. A later valid
Provider proposal under the disabled policy supersedes any old pending proposal
and becomes effective. A Staff decision requires the current policy to permit
approval.

**Rationale**: Automatic activation after a Configuration edit would change
authoritative price without a Provider command, expected version, history,
idempotency, or audit. Retaining the original flag explains why the row entered
its state and keeps historical truth intelligible.

**Rejected alternatives**:

- Auto-activating pending prices on policy disable is an unaudited commercial
  mutation.
- Retroactively making effective prices pending on policy enable would remove
  previously accepted truth.
- Mutating the stored approval flag would rewrite history.

## Decision 9: Revalidate usability dynamically

**Decision**: Do not persist `servicesReady` or an offering “usable” flag.
Every readiness/current-safe read checks Provider-owned enabled/configuration/
effective-price state against the current Provider country, Configuration
policy, and Catalog definition. Catalog or country-policy changes do not write
Provider status history; restoration requalifies the unchanged offering.

**Rationale**: DEC-051 explicitly separates Provider-controlled enablement from
external Catalog truth and requires automatic requalification. A persisted
derived flag would drift or require cross-module write callbacks.

**Rejected alternatives**:

- Event/queue synchronization is broader than the phase and introduces stale
  duplicate state.
- Changing `enabled` on Catalog deactivation fabricates a Provider action.

## Decision 10: Use transaction-bound public readers in one snapshot

**Decision**: The Providers UoW owns each serializable mutation transaction and
repeatable-read current-facts transaction. Composition supplies Catalog and
Configuration factories that accept the transaction as an opaque context and
return their owning public reader interfaces. Provider domain/services receive
only those interfaces, never the transaction or foreign repositories. The
internal snapshot reader resolves Catalog code, reads Provider current facts,
reads the exact-locale Catalog definition, and resolves Configuration within
one snapshot. A retryable serialization/snapshot failure retries the whole read
at most three times; a stable non-qualifying state returns `UNAVAILABLE`, and
repeated failure returns `CONFLICT`.

**Rationale**: This provides one actual consistency boundary for both writes
and current reads. It prevents Catalog/Configuration changes between validation
and Provider commit, while preserving module ownership through public
transaction-participant factories. It is stronger and simpler than independent
reads plus a double collect.

**Rejected alternatives**:

- Passing a typed/raw Providers transaction into Provider domain code or a
  foreign repository violates public-contract isolation; the opaque factory
  keeps that detail in infrastructure/composition.
- Independent pre-transaction Catalog/config reads can validate truth that
  changes before the Provider commit.
- A double collect reduces read drift but cannot make a mutation's foreign
  validation atomic with the Provider write.
- Persisting a Booking snapshot in Providers violates phase ownership.

## Decision 11: Authorization and reasons stay explicit

**Decision**:

- Active exact-Provider OWNER and ADMIN members use the existing trusted
  Provider-admin identity/global authority for all management reads/writes.
- Provider application status must be `APPROVED`; suspended Providers retain
  remediation management access, but no R1-P09 behavior makes them publicly
  eligible.
- Price-proposal and enable/disable commands require a trimmed 1–1000 character
  reason. Creation/configuration use stable safe action reason codes; they do
  not solicit unnecessary free text.
- Staff decisions require the new permission
  `providers.services.prices.approve`, mapped only to active `staff_admin`, plus
  a permitted 1–1000 character reason and transaction-bound reauthorization.
- No recent-authentication proof is required; none was approved for this
  ordinary offering-management surface.

**Rationale**: This implements DEC-047/DEC-048 and the authorized preparation
contract's actor/time/reason/version history requirement without expanding
OWNER-only membership authority.

## Decision 12: Follow the established phase evidence pattern

**Decision**: Add an R1-P09 Vitest configuration and package scripts, focused
unit/integration/HTTP/live-DB suites, OpenAPI source and parity tests, a generated
Postman collection, clean migration assertions, and a populated R1-P08→R1-P09
upgrade validator. Keep phase coverage at 80% statements/functions/lines and
75% branches for the touched include set, then run full repository gates only
during separately authorized implementation/verification.

**Rationale**: This is the current R1-P06–R1-P08 evidence convention and meets
the constitution's risk-proportional requirements without adding Docker or an
external test service.

## Resolved Unknowns

All material implementation-shaping questions asked during formal
clarification are resolved by DEC-047–DEC-051. OQ-002 and OQ-004 remain open but
do not block R1-P09 because the design preserves neutral free-text notes and
introduces no post-start charge behavior. Production values for the
country-required pricing policy are deliberately not selected by this phase;
missing values are a tested fail-closed operating condition, not an invented
default.
