# R1-P09 Preparation Prompt — Provider Services, Pricing & Historical Snapshots

## Objective

Prepare the active R1-P09 phase as a precise, testable Spec Kit contract for
Provider service selection, server-authoritative decimal-safe pricing,
readiness, retained price/status history, and snapshot-ready facts for later
Booking. Do not implement product behavior.

## Authority and stop gate

R1-P09 is active for specification preparation only. This prompt authorizes
repository-grounded analysis and a draft `spec.md` plus requirements checklist
only when the owner separately instructs the preparation workflow to begin.
Formal clarification, technical planning, tasks, implementation, Prisma work,
database operations, branch creation, Git publication, deployment, and
production work remain separate transitions.

Stop and ask the human owner one numbered question at a time whenever a choice
would materially change product, UX, authorization, data, audit, or failure
behavior. Never let an AI agent answer an owner decision.

## Dependency evidence

- R1-P08 is Complete under DEC-046 and merged through PR #8 at `e3383fb`.
- The R1-P08 completion report records green migration, test, coverage,
  contract, architecture, privacy, and independent-review gates.
- `main` matched `origin/main` and the worktree was clean at activation.
- R1-P05 owns Provider identity/membership/readiness; R1-P08 owns Catalog truth;
  R1-P13 owns persisted confirmed-booking snapshots.

## Required context

Read in this order and keep context limited to the active phase:

1. `AGENTS.md`
2. `docs/ai/context-router.md`
3. `docs/product/current.md`
4. `specs/R1-P09-provider-services-pricing-historical-snapshots/activation.md`
5. only the R1-P09 section of `docs/product/roadmap.md`
6. `docs/product/vision.md` sections relevant to backend authority, decimal-safe
   money, historical snapshots, Admin control, and product boundaries
7. only directly relevant decisions in `docs/product/decision-log.md`,
   especially DEC-036 and DEC-041–DEC-046
8. OQ-002 and OQ-004 in `docs/product/open-questions.md`
9. R1-P09 ownership rows in `docs/architecture/entity-ownership.md`
10. `src/modules/providers/providers.public.ts`, Provider readiness policy, and
    `src/modules/catalog/catalog.public.ts`
11. `.specify/memory/constitution.md`, `.specify/extensions.yml`,
    `docs/ai/spec-kit-integration.md`, and the exact Spec Kit skill for the
    current authorized step

Consult prior phase artifacts only for an inherited public contract or
repository convention. Never treat prior implementation details as permission
to invent R1-P09 behavior, and do not preload later phase specifications.

## Locked scope

In scope for specification:

- select one of the Provider country’s currently selectable Catalog services;
- configure Provider offering enable/disable state;
- choose an allowed Catalog price unit and configure a decimal-safe Provider
  price, minimum charge, estimated duration, and service notes;
- retain price and offering-status history with actor/time/reason/version facts;
- define server-authoritative price computation inputs and explicitly reject
  client-supplied monetary totals;
- define the R1-P09-owned `servicesReady` truth and its public Provider contract;
- define a narrow snapshot-ready Provider offering/price reader for later
  Booking without persisting Booking snapshots;
- define the configured approval-rule boundary after owner clarification;
- specify concurrency, retry/idempotency, audit/redaction, Catalog deactivation,
  country/selectability, and stale-version failure semantics;
- specify the four roadmap tables and one forward-only phase-owned migration;
- define protected Provider management HTTP and internal module-public
  contracts, with generated OpenAPI/Postman parity if HTTP is approved;
- define focused, integration, migration, boundary, security, and coverage
  evidence plus the full repository gates required for completion.

Explicitly out of scope:

- Catalog management or direct Catalog persistence access;
- anonymous/customer Browse and Provider Details (R1-P12);
- booking creation, customer service-field answers, persisted booking snapshots,
  order mutation, deposits, payment, ledger, or additional-charge flows;
- provider availability, coverage, capacity, and eligibility (R1-P10/R1-P11);
- frontend applications, maps, WebSockets, Docker, cloud, deployment,
  production configuration/migration, internal wallets, and future releases.

## Required specification decisions

Use `speckit-clarify` only after a draft specification and checklist pass their
prerequisites. Resolve material ambiguity one owner question at a time. The
specification must not silently decide:

- which Provider membership levels can view and manage offerings, and whether
  any operation requires Staff approval or recent authentication;
- the meaning and configuration source of `approval rule when configured`;
- price cardinality, currency source, decimal precision/scale, positivity,
  minimum-charge semantics, and price-unit compatibility;
- estimated-duration representation and validation;
- `servicesReady` satisfaction and blocker codes;
- service-note localization, length, visibility, and OQ-002 neutrality;
- effects of Catalog service, country availability, or price-unit deactivation
  on an existing Provider offering and its public eligibility;
- enable/disable reason requirements, history immutability/retention, and
  whether editing price creates a successor version or another approved model;
- exact snapshot-ready Provider DTO and consistency/version guarantees.

At most three genuine `[NEEDS CLARIFICATION]` markers may remain in the initial
draft. Do not hide material choices as assumptions or technical details.

## Preparation deliverables

When each transition is separately authorized, produce and validate:

1. `spec.md` with prioritized user stories, stable FR/SC identifiers, edge
   cases, failure semantics, measurable outcomes, and no implementation detail.
2. `checklists/requirements.md`, fully evaluated against the specification.
3. Sequential owner clarification persisted into the specification and
   decision log, with conflicts reconciled after every answer.
4. `plan.md`, `research.md`, `data-model.md`, migration plan, authorization and
   audit matrix, test strategy, quickstart, public contracts, transaction
   boundaries, and API design where approved.
5. Focused security, lifecycle/concurrency, data/migration, API/UX, and
   module-boundary checklists.
6. Dependency-ordered `tasks.md` with complete vertical slices and direct
   FR/SC traceability.
7. A non-destructive Spec Kit analysis with every blocker or major inconsistency
   resolved before implementation handoff.
8. A focused implementation prompt generated from
   `docs/ai/templates/implementation-prompt.md` only after the reviewed task
   contract is ready.

Mandatory Companion hooks in `.specify/extensions.yml` must actually execute
and be verified after specify, plan, and tasks. Do not hand-create generated
Companion state or change `.specify/feature.json` outside the official workflow.

## Database and architecture requirements

- Providers owns the four R1-P09 tables, business behavior, persistence access,
  transaction boundaries, history, and public offering/price contracts.
- Catalog access is only through `CatalogDefinitionReader`; no Providers import
  may reach Catalog repository, service, Prisma models, or raw transactions.
- Booking snapshots remain Booking-owned and deferred to R1-P13.
- Any persisted-data design must incrementally update `prisma/schema.prisma`,
  create one clearly named forward-only R1-P09 migration, review its SQL, and
  prove chronological clean install plus populated R1-P08 upgrade on explicitly
  approved disposable targets. Never edit an applied migration.
- Monetary values cross APIs and public contracts as canonical decimal strings
  unless a later approved decision specifies an equally decimal-safe form.

## Quality and handoff boundary

Planning must define tests for authority and cross-provider denial, Catalog
selectability changes, decimal precision, client-total rejection, price/status
history, optimistic concurrency and retry, readiness, snapshot consistency,
privacy/redaction, migration constraints and upgrade preservation, OpenAPI and
Postman parity, module boundaries, phase coverage, and full repository gates.

Do not commit or push. Do not implement unresolved product behavior. The final
preparation handoff must state scope, decisions, remaining risks, evidence,
exact next authorized action, and all excluded operations.
