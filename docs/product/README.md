# Cleanora Documentation Pack

This folder is the implementation-facing documentation pack for Cleanora.

## Standalone repository rule

Cleanora is a standalone project. The documentation must never require access to another repository, database, schema, migration history, or source code.

Every instruction must be executable from the Cleanora repository and this documentation pack alone.


## Document hierarchy

Read the documents in this order:

1. `vision.md` — canonical product vision and locked business rules derived from Bassam's four source documents.
2. `decision-log.md` — approved delivery decisions that resolve timing or terminology differences without silently changing the vision.
3. `open-questions.md` — items that must not be invented during implementation.
4. `roadmap.md` — the three releases and their complete vertical-slice phases.
5. `current.md` — the small live pointer showing the phase currently being implemented.

## Source documents

The following files remain source inputs and should be kept unchanged for traceability:

- `CLEANORA-BRD(3).md`
- `CLEANORA-BUSINESS-LOGIC(3).md`
- `CLEANORA-COMPLETE-SPEC(3).md`
- `CLEANORA-USER-STORIES(3).md`

## Conflict rule

When documents appear to conflict:

1. A locked business rule in `vision.md` wins for product behavior.
2. An approved entry in `decision-log.md` wins for release timing and implementation sequencing.
3. `open-questions.md` prevents implementation where the product has not made a decision.
4. `roadmap.md` controls the current delivery order.
5. No AI or developer may silently invent a missing rule.
