# Cursor implementation brief — R1-P08 US3 management and internal selection

## Authority and scope

Implement the **non-seed, non-database-execution** source and tests needed for
R1-P08 User Story 3 (tasks T078–T090, except any operation that needs a live
database).  This is a bounded implementation slice, not phase completion.

Read before editing:

- `AGENTS.md`
- `docs/product/current.md`
- `specs/R1-P08-catalog-localization-service-requirements/spec.md`
- `specs/R1-P08-catalog-localization-service-requirements/plan.md`
- `specs/R1-P08-catalog-localization-service-requirements/tasks.md` (US3 only)
- `specs/R1-P08-catalog-localization-service-requirements/research.md`
- `specs/R1-P08-catalog-localization-service-requirements/implementation-prompt.md`

Treat DEC-041 through DEC-044 and the frozen US2 configuration replacement
rule as binding. In particular:

- An incomplete item is only an inactive draft; no DRAFT state.
- Activation and selectability require complete Arabic and English; requested
  locale never falls back to the other language.
- The six field kinds and their exact constraints remain binding.
- Country facts come only through the transaction-bound Configuration-owned
  `ActiveCountryReader`; do not add, duplicate, upsert, or otherwise manage a
  Catalog Country record.
- Protected runtime HTTP stays active-`staff_admin` management only. Do **not**
  add anonymous, customer, provider, worker, or Browse HTTP. The selectable
  reader is Catalog module-public only.
- Do not implement media (US4), snapshot detail beyond this narrow reader (US5),
  provider enrollment/pricing, bookings, answers, or any later phase.
- Do not change applied migrations, run migrations, deploy/seed a database, or
  use an unknown database target.  Tests requiring a DB must remain guarded/skipped
  until Codex has an explicit approved R1-P08 target.
- Preserve all unrelated dirty work. Do not alter `tasks.md`, phase status,
  unrelated docs, global scripts, or unrelated modules.

## Existing state to preserve and improve

US1 and US2 source is already present. `catalog.policy.ts` now has pure US3
policy exports and unit tests, but the management/repository/public-contract
implementation still needs to consume them. Review the source yourself; do not
blindly trust this note.

Critical correctness fixes to include while wiring the policy:

1. When a service is activated, validate the locked **full stored configuration**:
   active category, AR+EN service translations, at least one active fully
   localized unit, and every active field/option. Validation must be based on
   real field `kind`, requiredness, constraints, and option applicability—not
   only labels. Reuse/extend existing normalizers/assertions safely; do not
   weaken DEC-042.
2. Existing active services must continue to satisfy that same policy when their
   configuration is replaced. This must happen before persistence/audit receipt
   completion and be atomic with the optimistic-version write.
3. Internal selectable reads must return only active category/service,
   authoritative active-country availability, active complete price units,
   active valid fields/options in deterministic display order, and only exact
   requested-locale content. Incomplete/missing exact locale must fail safely;
   no cross-locale fallback. This is a Catalog public contract, not an HTTP route.
4. Availability writes accept a `countryCode` only, resolve it transactionally
   via `ActiveCountryReader`, are version/idempotency/audit safe, and never
   accept a client country ID / active-state assertion.
5. Full category and service ordering is exact-set replacement: every currently
   ordered ID exactly once with matching expected version; normalize positions
   contiguously. Lock a deterministic sibling set and avoid transient unique
   order collisions. Retain identities (inactive, never ordinary hard delete).
6. Category content, lifecycle, and order changes must propagate a version bump
   to child services so downstream reader truth remains safely invalidated.

## Allowed files

Edit only the Catalog source/test/OpenAPI/Postman files reasonably necessary for
T078–T090, plus `src/composition.ts` if required to construct an existing
Catalog dependency. Expected candidates:

- `src/modules/catalog/catalog.policy.ts`
- `src/modules/catalog/catalog.repository.ts`
- `src/modules/catalog/catalog.service.ts`
- `src/modules/catalog/catalog.controller.ts`
- `src/modules/catalog/catalog.routes.ts`
- `src/modules/catalog/catalog.schema.ts`
- `src/modules/catalog/catalog.public.ts`
- `src/modules/catalog/catalog.mapper.ts` only if required
- `src/composition.ts` only if required
- `tests/integration/catalog/catalog-availability-lifecycle.repository.test.ts`
- `tests/integration/catalog/catalog-lifecycle-concurrency.test.ts`
- `tests/integration/http/catalog-availability-lifecycle.test.ts`
- `tests/unit/catalog/catalog-lifecycle.policy.test.ts` only to add missing
  regression coverage for actual field-kind validation
- `src/swagger/r1-p08-openapi.paths.ts`
- `scripts/generate-r1-p08-postman.ts`

If another file appears essential, stop and report its path/reason rather than
expanding scope silently.

## Deliverables

1. Implement the source surface described above using the repository’s modular
   monolith conventions, existing Catalogue interfaces, and safe errors.
2. Add test-first/focused coverage for lifecycle, availability, exact-set order,
   race-safe behavior (guard DB-dependent tests), and the no-Browse route
   contract. Never fake an actual Prisma integration proof with a recording
   object and describe it as integration.
3. Update protected OpenAPI and generated Postman source only for actual
   protected management endpoints; add explicit no-anonymous-Browse parity
   assertions where the existing convention supports it.
4. Do **not** change task checkboxes or `implementation-summary.md`; Codex
   independently verifies and records evidence.

## Verification

Run only safe local checks:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:r1-p08 -- tests/unit/catalog/catalog-lifecycle.policy.test.ts tests/unit/catalog/catalog-country.policy.test.ts tests/unit/catalog/catalog-order.policy.test.ts tests/integration/catalog/catalog-availability-lifecycle.repository.test.ts tests/integration/catalog/catalog-lifecycle-concurrency.test.ts tests/integration/http/catalog-availability-lifecycle.test.ts
```

If a requested test is intentionally guarded because no exact approved R1-P08
database target is configured, report it as skipped/blocked with the exact
guard—not as passed. Do not commit.

## Final report format

Report:

- files changed;
- each task-like behavior implemented;
- exact commands, pass/fail/skip counts;
- every deferred DB proof or scope blocker;
- any source concern Codex should review.
