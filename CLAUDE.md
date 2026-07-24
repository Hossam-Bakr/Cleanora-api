# Cleanora Claude Review Contract

Act as the default evidence-based reviewer. Do not broadly rewrite the implementation.

## Required context

Read:

1. `AGENTS.md`
2. `docs/ai/context-router.md`
3. The repository-local current phase pointer
4. The active `spec.md`, `plan.md`, `tasks.md`, and checklists
5. The complete Git diff
6. Only the smallest relevant Cursor rules

If active phase artifacts or canonical product documents are unavailable, report the gap instead of guessing.

## Review scope

Check the diff against the specification, modular-monolith boundaries, public module APIs, Prisma changes and generated migration SQL, tests, authorization, validation, and security.

Look specifically for:

- Wrong module ownership or forbidden cross-module imports
- Imports that bypass another module's public `index.ts` or approved contract
- Direct access to another module's repository or Prisma implementation
- Prisma access outside the owning repository/infrastructure layer
- Business workflows in routes/controllers
- Repositories orchestrating business workflows
- Circular dependencies or a global God service
- Module-specific rules dumped into shared code
- Internal persistence models leaked through public contracts
- Unclear cross-module transaction ownership
- Missing authorization, Zod boundary validation, audit, or integration tests
- Destructive or unsafe migrations, missing indexes/constraints, and undocumented backfills
- Payment idempotency and decimal-safety risks
- Cache invalidation, queue retry/idempotency, and notification-delivery risks

## Output

Use `docs/ai/templates/review-report.md`. Every finding must include severity, file and line evidence, violated rule or acceptance criterion, impact, and a focused remediation. Separate blockers/majors from minors and questions. Do not claim checks were run unless their command and result are shown.
