# R1-P08 Cursor delta: close reviewable US1 gaps honestly

Continue the same R1-P08 Cursor session. This is a focused Codex review delta for Foundation/US1 only. Preserve the unrelated dirty worktree exactly.

## Hard boundaries

- No Git staging/commit/push/stash/reset/restore/clean/merge/history rewrite.
- No database connection, migration execution, seed execution, or live proof.
- No public/customer Browse HTTP.
- Do not begin US2+ in this correction.
- Work directly in this session; do not spawn a nested Cursor task/subagent.
- Run every verification command separately and honor every non-zero exit code.

## Review findings that must be corrected

### 1. FR-032 / SC-007 audit evidence is incomplete

`CatalogService` currently appends only final safe facts. FR-032 requires before/after audit data for every privileged write.

For each US1 mutation, write exactly one privileged audit row in the same unit of work, before `completeCommand`, with safe nested facts:

- create category/service: `before: { exists: false }` and an allowlisted `after` object;
- category content/lifecycle: allowlisted `before` and `after` objects including stable code, version, lifecycle state, and category identity/order facts but no localized names/descriptions;
- service move/lifecycle: allowlisted `before` and `after` objects including code, categoryId, displayOrder, version, lifecycle state, but no translations/localized text;
- include actor through the normal audit `actorId`, approved reason, target, and requestId when present.

Use the existing Admin-owned `PrivilegedAuditWriter`; do not add Catalog history tables. Keep audit append inside the mutation transaction so audit failure prevents command completion/commit.

Add executable tests with fakes to prove:

- accepted mutation appends exactly one row with actor, reason, requestId, before, and after;
- fresh transaction reauthorization denial prevents all mutation/audit calls;
- audit failure prevents `completeCommand` and surfaces failure;
- wrong reason/authorization denial makes zero repository/UoW mutation calls;
- audit context contains no localized text, storage keys, URLs, idempotency key, or request body.

### 2. T037 must contain real non-DB Supertest coverage

Replace the static-only taxonomy HTTP assertions with executable Supertest tests built from `createTestApp`, `createCatalogRouter`, a trusted authentication middleware stub, and a fake/stub `CatalogService`. Do not use Prisma.

Cover at minimum:

- protected staff category/service management endpoints are mounted under `/api/v1/staff/catalog`;
- create/list/detail/update/lifecycle happy envelopes use the standard response shape;
- draft DTOs remain visible to the staff management surface;
- validation error and a mapped Catalog conflict/forbidden error produce safe standard envelopes;
- no anonymous/customer Browse Catalog route exists.

Keep a separate `skipIf` block only for the actual approved-database staff journey, and make its body clearly TODO/evidence-gated rather than pretending `expect(true)` is live proof. Never mark the live journey complete.

### 3. T051 requires safe request-scoped structured logging

Inject the existing shared `Logger` into `CatalogService` from composition. Log only safe operation facts after accepted US1 writes: operation/outcome, target type/id, version, actorUserId, requestId when present, and non-localized identifiers/lifecycle/order facts. Do not log bodies, localized content, translations, idempotency keys, Media data, URLs, or secrets.

Add tests using `TestLogger` or a focused fake logger that prove the accepted log is request-scoped and contains no forbidden content keys. Do not weaken the shared logger redaction policy.

### 4. Replace misleading test evidence

`catalog-taxonomy.repository.test.ts` and `catalog-taxonomy-concurrency.test.ts` currently contain source-text assertions / scalar comparisons that do not prove repository or race behavior.

- Keep safe, useful non-DB unit/fake tests where they exercise actual methods.
- Keep the true Prisma repository journey and PostgreSQL two-writer race guarded by the exact approved-target regex.
- In guarded test bodies, fail loudly if accidentally run without actual implementation; do not use an `expect(hasApprovedLiveTarget).toBe(true)` no-op as the claimed proof.
- Because no DB target is approved, leave T034 and T038 unchecked unless you can fully prove their exact task wording without a database. A guarded skip is not completion evidence.

### 5. Evidence ledger and honest task markers

Update `implementation-summary.md` with:

- exact current independent command/file/test counts;
- US1 requirement/task mapping;
- a table separating safe green evidence from skipped/unverified live DB evidence;
- explicit statement that skipped tests are not proof;
- no claim about US2+.

Update `tasks.md` only for tasks whose exact wording is now implemented and verified. Expected review posture:

- likely complete after this correction: T033, T035–T037, T039–T051, T053, T054;
- keep T034 and T038 open unless their actual persistence/race requirements receive executable proof;
- keep T052 open while any T033–T038 prerequisite remains unproven;
- keep all T055+ open;
- live DB gates T144–T146 remain blocked;
- T153–T156 remain reserved for Codex/Claude/owner.

Do not check a task merely because a filename exists or a test is skipped.

## Verification: independent commands

Run each separately, fixing failures before proceeding:

1. `npm.cmd run typecheck`
2. `npm.cmd run lint`
3. `npm.cmd run test:r1-p08`
4. `npm.cmd run openapi:validate`
5. `git diff --check`

Stop after the focused US1 correction. Report exact files changed, exit codes, test file/pass/skip counts, task markers changed, and the precise open/blocked tasks.
