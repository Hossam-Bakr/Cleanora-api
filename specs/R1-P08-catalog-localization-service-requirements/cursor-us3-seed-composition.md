# Cursor implementation brief — R1-P08 US3 DEC-044 seed composition

## Scope

Implement T091–T092 and testable non-live seed composition only.  Do **not**
execute `prisma db seed`, do not run migrations, do not change `schema.prisma`
or any migration, do not update task checkboxes/status files, and do not touch
US4/US5 or any public Browse route.

Read `AGENTS.md`, `docs/product/current.md`, the R1-P08 `spec.md`, `tasks.md`,
`research.md`, `implementation-prompt.md`, existing `prisma/seed.ts`, and
`src/modules/catalog/catalog.policy.ts` first.

## Binding behavior

- DEC-044 values must be exactly those in `EGYPT_HOUSEKEEPING_SEED`:
  one active bilingual `HOME_CLEANING`; one active bilingual
  `STANDARD_HOME_CLEANING`; active `PER_VISIT` and `PER_HOUR`; five active
  representative fields (information, integer bedrooms, integer bathrooms,
  optional pet presence, optional special instructions); active `EG`
  availability; **no Media** and no OQ-002 materials-supply decision.
- Use the existing R1-P08 policy/constant rather than duplicating truth.
- The seed must validate the intended seed configuration using the same
  Catalog policy used by managed truth before it writes.
- Stable existing Catalog rows are owner-managed facts: do **not** rewrite
  labels/translations/descriptions, reactivate, change category, order,
  constraints, or update version. Use `update: {}` on every existing stable
  catalog identity/translation/availability row; missing rows may be created.
- Seed idempotency needs to work for an empty DB, and must also avoid unique
  display-order collisions when an owner-managed category/service already
  exists. For a newly-created missing row, choose the next valid display order
  in that scope when it is non-empty; preserve the exact 0.. values on the
  empty baseline. Do not reorder existing owner-managed rows.
- Country remains Configuration-owned. Reuse the `country` resolved by the
  current seed; do not create a Catalog Country persistence type.
- DEC-043 auth permission/reason is already included through the existing
  `seedAuthorizationDefinitions` catalogs. Ensure the code path continues to
  seed those existing definitions; do not duplicate a second auth seed.

## Allowed files

- `prisma/seed.ts`
- a new or existing focused non-live unit test for catalog seed composition
  under `tests/unit/catalog/` or `tests/unit/scripts/`
- `tests/unit/catalog/catalog-seed.test.ts` only if its current test style
  suits the source-composition assertion

If any other file seems required, stop and report it. Do not alter unrelated
dirty work, docs, schema/migrations, tests for earlier phases, Postman, or
OpenAPI.

## Preferred structure and test evidence

Extract an exported, testable helper such as `seedR1P08Catalog(prisma, country)`
or a strictly equivalent narrow helper used from `seed()`. A focused fake Prisma
test must prove, without a DB:

1. exact intended creates use the DEC-044 values;
2. every existing Catalog stable identity has an empty update branch;
3. existing inactive/owner-modified facts are not reactivated or overwritten;
4. rerun semantics do not introduce duplicate natural identities; and
5. no Media or OQ-002 supply decision is composed.

The test must not claim it is a PostgreSQL proof. The real clean/double-run/
selectability seed integration test remains guarded and skipped until Codex has
an explicitly approved `CLEANORA_R1_P08_DATABASE_URL` target.

## Safe verification

Run only:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:r1-p08 -- tests/unit/catalog/catalog-seed.test.ts <your-new-focused-test>
```

Report exact results, all files changed, and the deferred live DB proof. Do not
commit.
