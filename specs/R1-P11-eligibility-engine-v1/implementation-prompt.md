# Implementation Prompt — R1-P11 Eligibility Engine V1 (Batch A)

## Objective

Implement **Batch A only** from `specs/R1-P11-eligibility-engine-v1/tasks.md`
(T001–T007) under **DEC-083**:

- Phase test selection and scripts
- Boundary fixtures / evidence stub
- Module-boundary test that **must pass**
- Substantive TypeScript **declarations only** in
  `src/modules/eligibility/eligibility.public.ts`

Do **not** implement business evaluation rules, Prisma migration, Browse facade
runtime logic, empty layer folders, barrels, or fake “not implemented” stubs.

**Conditional**: Proceed only after Codex preparation **re-review** acceptance
under DEC-062 (or explicit Codex instruction that preparation is accepted after
repair). If preparation is not yet accepted, **stop** after reading artifacts.
Current gate after repair: `PREPARATION_READY_FOR_REREVIEW` — Batch A still
unauthorized until Codex says otherwise.

## Required context

Read, in order:

1. `AGENTS.md`, `docs/ai/context-router.md`, `docs/product/current.md`
2. `specs/R1-P11-eligibility-engine-v1/spec.md`
3. `plan.md`, `tasks.md` (Batch A), `baseline-boundary.md`
4. `contracts/eligibility-public-contract.md`, `contracts/http-api.md`,
   `contracts/browse-consumer-contract.md`
5. DEC-062–083 in `docs/product/decision-log.md`
6. `preparation-review-report.md` (historical CHANGES_REQUIRED)
7. `analysis-report.md` (must show findings closed and
   `PREPARATION_READY_FOR_REREVIEW` or later Codex acceptance)

Do not preload future phases (P12) beyond the DoD sentence: P11 proves Browse-use
contract; P12 mounts HTTP.

## Acceptance criteria

- `vitest.r1-p11.config.ts` exists with exact allowlist (P11 + named changed seams).
- `npm run test:r1-p11` / `test:coverage:r1-p11` scripts exist (do not claim
  coverage pass).
- Selection guard test proves historical suites excluded and allowlist named.
- Fixtures helper exists without secrets.
- `src/modules/eligibility/eligibility.public.ts` compiles with frozen public
  types/signatures from the contract — **no** empty `domain/` /
  `application/` / `infrastructure/` / `ports/` directories.
- `tests/unit/modules/r1-p11-module-boundaries.test.ts` **passes**.
- typecheck + relevant lint pass with recorded exit codes.
- `implementation-evidence.md` started with selection + preservation notes.
- No evaluation business logic beyond declarations.
- No commit, push, merge, deploy, or production database use.

## In scope

- T001–T007 paths listed in tasks.md Batch A
- Minimal `package.json` script entries required for phase test commands
- Evidence markdown under the feature directory

## Out of scope

- Batches B–G
- Any eligibility HTTP / OpenAPI operations
- Wallets, Docker/cloud, geo, Booking, P12 marketplace
- Editing applied migrations
- Broad refactors outside allowlisted paths
- Git publication
- Creating speculative empty module folders

## Module ownership and public contracts

- New module `eligibility`; public entry `eligibility.public.ts`
- Match closed types in `contracts/eligibility-public-contract.md`
- Do not import other modules’ private infrastructure
- Zero new HTTP (see `contracts/http-api.md`)
- Follow compact module template: deeper folders only when later batches need them

## Database and migration work

**None in Batch A.** Persistence starts in Batch B.

## Authorization, audit, and security

- In-process trust boundary only
- Public declarations must not introduce Worker ID fields
- Preserve inherited dirty tree; use baseline-boundary pre-write hash procedure
  if editing inherited untracked files

## Tests and quality gates

- Add/adjust only Batch A tests
- Run `npm run test:r1-p11` after scripts exist; report exact exit codes
- T006 must be green before claiming Batch A complete
- Do not claim SC-007/SC-008 or full DEC-078 repository gates complete in Batch A

## Required handoff

Report:

1. Files created/changed
2. Commands run + exit codes
3. Any inherited lint/test failures with baseline attribution
4. Exact next batch (Batch B) blockers if any

Do not commit or push. Do not invent unresolved product behavior — DEC-063–083
are closed.

