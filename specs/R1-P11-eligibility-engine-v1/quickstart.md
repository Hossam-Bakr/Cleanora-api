# R1-P11 Quickstart

Preparation batch is documentation-only. Runtime commands below distinguish **existing** vs **planned**.

## Existing commands (repository)

```text
npm run typecheck
npm run lint
npm run build
npm run prisma:validate
npm run prisma:generate
npm run test:unit
npm run test:integration
npm run test:coverage
npm run openapi:validate
npm run postman:validate
npm run docs:check
npm run db:validate-clean-migration
git diff --check
```

Use these for DEC-078 repository gates during/after implementation. During preparation, prefer docs consistency and `git diff --check` on tracked edits; inspect new Markdown separately.

## Planned commands (implementation will add)

```text
npm run test:r1-p11
npm run test:coverage:r1-p11
npm run db:validate-r1-p11-upgrade
```

Supporting files (planned):

- `vitest.r1-p11.config.ts`
- `scripts/validate-r1-p11-upgrade.ts`
- phase tests under `tests/**` with `r1-p11` naming

## Safe verification order (implementation)

1. Confirm branch `codex/r1-p11-eligibility-engine-v1` and baseline attribution ([baseline-boundary.md](baseline-boundary.md)).
2. List resolved files from `vitest.r1-p11.config.ts` before running phase tests.
3. `npm run test:r1-p11`
4. `npm run test:coverage:r1-p11` — verify four thresholds.
5. Prisma validate/generate; review migration SQL.
6. Disposable clean chronology + `db:validate-r1-p11-upgrade`.
7. Repository gates listed above.
8. Boundary/no-HTTP assertions.

## Not available / not authorized here

- Eligibility HTTP smoke tests (no routes)
- Production migrate/deploy
- `commit and push` unless the human sends that exact message
- Docker/cloud workflows (deferred to R3)
