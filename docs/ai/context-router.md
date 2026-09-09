# Context Router

Use the smallest context that can answer the task.

## Default load order

For a normal task, begin with:

1. `AGENTS.md`
2. This router
3. `docs/product/current.md`
4. The active phase `spec.md`, or only its section in `docs/product/roadmap.md`
5. The smallest relevant rule or architecture files

Normally load three to six files. If a required repository-local file is absent, report the gap; do not search another application for an answer.

Summarize loaded context in no more than five bullets. Never paste full documents into responses. Expand only after discovering a concrete dependency. Load one matching Codex skill unless multiple skills are genuinely necessary. Keep work focused on one phase or one defect. Do not read future phase specifications during ordinary implementation.

## Task routes

| Task | Add context | Preferred skill/workflow |
|---|---|---|
| Prepare current phase | Product precedence docs, current roadmap section | `phase-planner`; `workflows/prepare-phase.md` |
| Implement current phase | Active spec, plan, tasks, applicable rules | `workflows/implement-phase.md` |
| Scaffold a module | Active plan and architecture convention | `module-scaffolder` |
| Define architecture | Active phase ownership needs | `modular-monolith-architect` |
| Review module boundaries | Diff, public contracts, boundary rules | `module-boundary-reviewer` |
| Prisma schema/migration | Active data requirements, current schema, migrations | `prisma-phase-migration` |
| Express endpoint | Active API contract, response/error standard, Express/Zod and security rules | `.cursor/rules/40-express-zod.mdc`; `.cursor/rules/45-api-responses-errors.mdc` |
| Debug error | Exact failure, reproduction, narrow owning code | `debug-and-fix`; `workflows/debug-error.md` |
| Review code | Active artifacts, complete diff, review rules | `workflows/review-code.md`; `CLAUDE.md` |
| Fix review findings | Review report, evidence, affected tests | `review-fix-handoff` |
| Redis | Active cache/rate-limit requirement and adapter contract | Relevant spec only; verify failure semantics |
| BullMQ | Active job contract, retries, idempotency, observability | Relevant spec only; verify producer/consumer ownership |
| Paymob | Payment contract, webhook rules, ledger invariants | Security, payment tests, provider docs when configured |
| Notifications | Event trigger, template/channel rules, retry policy | Active spec and adapter contract |
| Commit and push | Current phase DoD, full diff, review resolution, scripts | `commit-and-push` |
| Prepare next phase | Completed handoff and next roadmap section | `next-phase-prompt` |
| Start next Backend Notion row | Current phase pointer and next roadmap section only | `notion-start-new-phase` |

## Expansion triggers

Load another file only when:

- A referenced acceptance criterion cannot be resolved from current context.
- A public contract crosses a module boundary.
- A database change touches an existing model or migration.
- A security, payment, queue, cache, or notification invariant is involved.
- The active phase explicitly cites the document.

Do not load documents speculatively.
