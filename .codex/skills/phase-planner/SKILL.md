---
name: phase-planner
description: Prepare one Cleanora roadmap phase as focused Spec Kit artifacts. Use when Codex must turn the current roadmap section into a specification, technical plan, tasks, checklists, acceptance criteria, migration ownership, or a Cursor implementation prompt.
---

# Phase Planner

Follow `docs/ai/workflows/prepare-phase.md`.

1. Confirm repository-local canonical product documents and one current phase.
2. Extract locked rules, approved decisions, affected open questions, dependencies, and Definition of Done.
3. Stop on product gaps that materially change behavior.
4. Create or align `spec.md`, `plan.md`, `tasks.md`, and checklists under the recommended phase folder.
5. Define in/out scope, module ownership, public contracts, authorization, audit, events, data changes, migration name, failure modes, and tests.
6. Order tasks into complete vertical slices with traceable acceptance criteria.
7. Produce a focused implementation prompt from `docs/ai/templates/implementation-prompt.md`.
8. Report blockers and decisions needed. Do not implement unless separately requested.
