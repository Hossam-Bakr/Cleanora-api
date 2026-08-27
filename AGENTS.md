# Cleanora AI Routing

Cleanora is a standalone greenfield product. Never depend on another repository, schema, migration history, database, or undocumented service.

The backend is one deployable modular monolith. Business modules own their behavior and persistence access and expose explicit public contracts.

## Start here

1. Read `docs/ai/context-router.md`.
2. Read the repository-local current phase pointer.
3. Load only the active phase specification or its roadmap section.
4. Load the smallest matching rules and, when useful, one skill from `.codex/skills/`.

When a material owner decision or approval is required, follow
`docs/ai/decision-question-format.md`: ask one numbered question in the owner's
language, give two to four mutually exclusive numbered options, and place the
reasoned recommendation after the options. Do not force simple factual questions
into multiple choice.

Canonical product documents must be repository-local before implementation. Their expected destinations and current bootstrap status are recorded in `docs/README.md`. Do not substitute files from another project or silently invent missing rules.

## Roles

- Cursor Auto implements the active specification and tests.
- Cursor Claude reviews the Git diff and active specification; `CLAUDE.md` is its entry point.
- Codex plans phases, protects architecture, debugs, verifies review findings, runs quality gates, and manages the safe Git workflow.
- The human owner approves product decisions, phase completion, commits, merges, deployments, production migrations, and destructive actions.

Only one phase may be active. Stay within its specification, plan, tasks, and Definition of Done.

Every database-changing phase must incrementally update `prisma/schema.prisma`, create a clearly named phase-owned migration, review its SQL, and validate it. Never edit an applied migration.

Locked constraints:

- Docker and cloud work are deferred until Release 3.
- Cleanora user stored-value wallets are prohibited; external payment and payout rails are allowed.
- Do not preload the complete documentation set or future phase specifications.
- Route repeatable work through `.codex/skills/` and canonical workflows under `docs/ai/workflows/`.

The Git workflow activates only when the human message is exactly `commit and push`. That phrase authorizes validation, staging intended files, one conventional commit, and a safe feature-branch push. It does not authorize merge, deployment, production migration, force-push, or history rewriting.
