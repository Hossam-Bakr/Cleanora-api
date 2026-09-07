# Implementation Prompt — R1-P09 Provider Services, Pricing & Historical Snapshots

## Objective

Implement the approved R1-P09 specification inside the existing Providers
module: exact-Provider offering management, server-authoritative decimal-safe
prices, retained price/status history, configured Staff approval, dynamic
`servicesReady`, and a safe internal snapshot-ready reader. Do not implement
Browse or Booking.

## Required context

Read, in order:

1. repository `AGENTS.md` and `docs/ai/context-router.md`;
2. `docs/product/current.md` and only the R1-P09 roadmap section;
3. DEC-047–DEC-051 and the relevant locked decisions routed by the context
   router;
4. this directory's `spec.md`, `plan.md`, `research.md`, `data-model.md`,
   `authorization-matrix.md`, `migration-plan.md`, `test-strategy.md`,
   `contracts/`, and `tasks.md`.

Treat `tasks.md` as the dependency order and keep every task unchecked until
its own acceptance evidence passes.

## Acceptance criteria

- Every FR-001–FR-046 and SC-001–SC-012 mapping in `tasks.md` passes.
- Active exact-Provider OWNER and ADMIN can manage offerings; all other and
  cross-Provider access fails closed.
- Currency/default scale/approval/maximum come only from Configuration; Catalog
  service/unit/selectability/localization come only from Catalog public
  contracts.
- Provider price and minimum charge are canonical decimal strings at boundaries
  and Decimal/numeric internally; client totals are rejected.
- New offerings are disabled, use expected version 0, and create one retained
  initial price. Every later accepted mutation increments one aggregate version
  exactly once.
- At most one pending and one effective price exist; accepted rows/history are
  retained; history is append-only; hard delete is absent.
- Country-configured Staff approval follows DEC-048/DEC-050, uses only active
  `staff_admin`, preserves the old effective price while replacement is pending
  or rejected, and commits audit atomically.
- Dynamic readiness and the internal Providers-owned repeatable-read snapshot
  with transaction-bound Catalog/Configuration public readers follow DEC-051;
  `eligibleForPublicBrowse` remains false and no Booking data is persisted.
- All phase-specific, migration, OpenAPI/Postman, privacy, boundary, coverage,
  and full repository gates in `test-strategy.md` pass with recorded evidence.

## In scope

- The exact four user-story slices and four roadmap tables.
- Additive public seams in Providers, Catalog, Configuration, Authentication,
  and reuse of Admin audit.
- The 11 protected HTTP operations in the HTTP contract.
- One forward migration, deterministic test fixtures, OpenAPI/Postman parity,
  documentation, phase scripts, and evidence.

## Out of scope

- Anonymous/customer Browse or Provider Details.
- Booking records, answers, totals, snapshots, orders, or HTTP operations.
- Coverage, schedule, holiday, availability, capacity, worker scheduling, LIVE
  promotion, or final eligibility.
- Taxes, fees, discounts, coupons, commissions, deposits, payments, payouts,
  currency conversion, additional charges, wallets, or dynamic pricing.
- New generic modules, workflows, approval engines, state machines, events,
  queues, workers, caches, external services, Docker, cloud, deployment, or any
  future phase.

## Module ownership and public contracts

Extend `src/modules/providers/`; do not create a new business module. Providers
owns its four tables, orchestration, UoW, histories, readiness, HTTP, and public
snapshot DTO. Consume Catalog, Configuration, Authentication, and Admin only
through their `*.public.ts` files. Repositories persist only; services
orchestrate; controllers/routes translate HTTP only.

## Database and migration work

Create one migration named
`r1_p09_provider_services_pricing_historical_snapshots`. Add exactly
`provider_services`, `provider_service_prices`,
`provider_service_price_history`, and `provider_service_status_history` with
the exact constraints/indexes/triggers in `data-model.md` and
`migration-plan.md`. Never edit an applied migration, hard-delete financial
history, backfill existing Provider/Catalog rows destructively, or seed a
Provider offering/price. Do not invent production country policy values.

## Authorization, audit, and security

Follow `authorization-matrix.md`. Use trusted principal/global authority plus
exact active membership for Provider routes. Add only
`providers.services.prices.approve` for active Staff Admin approval and recheck
it inside the committing transaction. No recent-auth proof is required. Write
allowlisted audit through Admin's transaction-bound public writer. Do not expose
contacts, secrets, raw Prisma/transactions, database URLs, stack traces,
receipts, hidden approval metadata, or another Provider's existence/state.

## Tests and quality gates

Use TDD and the task order. Run focused tests first, then the complete ordered
gate list in `test-strategy.md`, with explicit disposable-database authorization
for database commands. Do not use Docker/Testcontainers, production credentials,
or network services. Record commands, results, coverage, migration hashes, and
known limitations in the implementation evidence summary.

## Required handoff

Report completed task IDs, exact files changed, decisions preserved, migration
name/hash and SQL review, focused/full gate results, coverage, clean/upgrade
proof, OpenAPI/Postman parity, privacy/boundary evidence, remaining unchecked
tasks, and blockers. Do not commit or push. Do not merge, deploy, run a
production migration, mark the phase Complete, or activate R1-P10. Do not invent
unresolved product behavior.
