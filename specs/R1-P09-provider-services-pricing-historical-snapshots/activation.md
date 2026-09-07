# R1-P09 Activation — Provider Services, Pricing & Historical Snapshots

**Activated:** 2026-09-04

**Authorized by:** Human product owner in the active Codex task

**Status:** **Active — specification, clarification, planning, tasks, and analysis completed; implementation not authorized**

**Feature directory:** `specs/R1-P09-provider-services-pricing-historical-snapshots`

**Feature branch:** Not created; activation remains on `main` at `e3383fb`

## Exact authorization

The human message was:

```text
make it ready and activate it
```

This authorization is applied narrowly to:

1. Verify that R1-P08 and the inherited Provider/Catalog dependencies are ready.
2. Record R1-P09 as the sole active phase in the repository-local pointer.
3. Reconcile stale live-pointer and R1-P08 Git-publication wording.
4. Create this activation record and the focused preparation prompt.

It does not authorize a feature branch, `.specify/feature.json` change,
Companion lifecycle capture, a completed specification, formal clarification,
technical plan, tasks, implementation prompt, product code, test changes,
Prisma schema or migration work, seed changes, database operations, staging,
commit, push, merge, deployment, production configuration, or production
migration.

## Activation evidence

- R1-P08 is Complete under DEC-046. Its completion report records all
  FR-001–FR-052 and SC-001–SC-012, tasks T001–T156, the phase migration and
  clean/upgrade proof, phase and repository tests/coverage, architecture and
  privacy checks, independent review resolution, and explicit human approval.
- Git records R1-P08 as published through PR #8: `main` and `origin/main` both
  resolve to merge commit `e3383fb`; the feature commit is `879f1ed`.
- The worktree was clean immediately before activation.
- `docs/product/current.md` recorded no active phase before this transition.
- No R1-P09 feature directory, Spec Kit feature pointer, specification, plan,
  tasks, branch, code, Prisma model, migration, seed, or database evidence
  existed before activation.
- The canonical product pack is repository-local under `docs/product`.

## Approved product baseline

- R1-P09 allows Providers to select platform Catalog services and configure
  server-authoritative prices.
- Roadmap scope covers offering enable/disable state, provider price and Catalog
  price unit, minimum charge, estimated duration, service notes, price and
  status history, an approval rule when configured, snapshot-ready structures,
  and decimal-safe validation.
- R1-P09 Done When is: public provider prices are correct; price history is
  retained; confirmed bookings can preserve service and price snapshots; and
  client-supplied totals are rejected.
- The Providers module owns `provider_services`, `provider_service_prices`,
  `provider_service_price_history`, and `provider_service_status_history`, as
  well as the R1-P09 transaction boundaries and readiness truth.
- The Catalog module remains the sole owner of Catalog persistence. R1-P09 must
  consume only `CatalogDefinitionReader` and must not query or mutate Catalog
  tables directly.
- Booking owns persisted confirmed-booking snapshots in R1-P13. R1-P09 may
  publish current copy-ready Provider offering/price facts for that later owner
  but must not create Booking records or `booking_snapshots`.
- Provider authorization remains actor-, capability-, and exact-provider-scope
  based. Caller-supplied Provider scope and monetary totals are never
  authoritative.
- Financial amounts and numeric bounds use decimal-safe representations; no
  binary floating-point money arithmetic is permitted.
- Docker and cloud work remain deferred until Release 3. Cleanora stored-value
  wallets remain prohibited.

## Dependencies and inherited contracts

- R1-P05 provides Provider identity, application/operational lifecycle,
  OWNER/ADMIN membership scope, dashboard/readiness projections, and the
  `servicesReady` gate owned by R1-P09.
- R1-P06 and R1-P07 remain completed readiness dependencies for documents,
  payout destinations, workers, and teams but are not expanded by R1-P09.
- R1-P08 provides exact-locale, active, complete, country-available Catalog
  service definitions, allowed price units, stable field/media references, and
  a repeatable-read snapshot boundary through `CatalogDefinitionReader`.
- R1-P12 owns anonymous Browse/Provider Details and public presentation. R1-P09
  prepares accurate public-consumer facts but does not add anonymous Browse.
- R1-P13 owns booking creation, customer answers, server-computed totals, and
  persisted booking snapshots.

## Open-question boundary

- OQ-002 remains unresolved. Service notes may preserve configurable
  requirements, but R1-P09 may not enforce a universal provider-supplied or
  customer-supplied cleaning-materials rule without owner approval.
- OQ-004 remains unresolved. R1-P09 must not authorize automatic, unapproved
  price increases after work starts; order-time additional-charge behavior is
  outside this phase.
- The roadmap phrase `approval rule when configured`, exact service-management
  authority, price model and currency semantics, `servicesReady` satisfaction
  rule, note localization, disable/history behavior, and the snapshot-ready
  Provider contract require specification clarification before implementation.
  No answer is implied by activation.

## Current workflow gate

On 2026-09-05 the human owner supplied one bounded persistent instruction that
authorizes the complete R1-P09 Spec Kit preparation sequence:
`speckit-specify` → `speckit-clarify` → `speckit-plan` → `speckit-tasks` →
read-only `speckit-analyze`, including focused remediation of non-product
planning-artifact inconsistencies and the mandatory Companion hooks after
specify, plan, and tasks.

The owner subsequently authorized treating exactly the four pre-existing
activation paths (`docs/README.md`, `docs/product/current.md`, `activation.md`,
and `preparation-prompt.md`) as the preserved dirty-worktree baseline. Any
additional conflicting dirty path remains a stop condition.

This continuation authorizes `.specify/feature.json` and R1-P09 planning
artifacts. It still excludes branch creation or switching, product code, tests,
Prisma schema edits, migration SQL, OpenAPI/Postman/runtime changes, database or
implementation commands, Git publication, deployment, production operations,
phase completion, and R1-P10. The mandatory stop was reached after the read-
only analysis and one focused planning-artifact remediation iteration produced
zero CRITICAL/HIGH findings, zero Constitution conflicts, and complete FR/SC-
to-task coverage. Implementation still requires separate explicit human
authorization.
