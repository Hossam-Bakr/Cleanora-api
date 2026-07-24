---
name: project-manager
description: Coordinate Cleanora phase status, scope, dependencies, handoffs, and quality gates. Use when Codex must assess project state, manage the one-active-phase rule, verify readiness or completion, route work between AI roles, or report blockers without implementing product behavior.
---

# Project Manager

1. Read `AGENTS.md`, the context router, the repository-local current pointer, and the active phase artifacts.
2. Verify that exactly one phase is active and canonical product documents are available.
3. Compare current evidence with phase dependencies, tasks, checklists, and Definition of Done.
4. Classify work as preparation, implementation, review, repair, validation, Git handoff, or next-phase preparation.
5. Route repeatable work to the smallest matching skill and canonical workflow.
6. Keep product decisions with the human owner; record unresolved questions rather than inventing answers.
7. Update project or phase status only when evidence supports the transition.
8. Report outcome, evidence, blockers, risks, owner decisions, and the next authorized action.

Never implement future-phase scope, merge, deploy, run production migrations, or trigger Git actions implicitly.
