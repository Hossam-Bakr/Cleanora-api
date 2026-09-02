# Start New Backend Phase in Notion

Add a new Cleanora backend phase row to the **Backend** database under **House Keeping (Hossam & Bassam)** in Notion.

## User input

```text
$ARGUMENTS
```

## Instructions

1. Read and follow the Cursor skill at `.cursor/skills/notion-start-new-phase/SKILL.md`.
2. Use the Notion MCP tools (`notion-search`, `notion-fetch`, `notion-create-pages`).
3. If the user named a phase number in `$ARGUMENTS`, use it. Otherwise infer the next missing Backend phase number.
4. Load phase name and description from `docs/product/roadmap.md` (section `R1-P{NN}`) or `docs/phases/release-1/README.md`.
5. Create the row with defaults: assignee **Hossam Bakr**, due date **today**, status **Not started**, priority **High**, effort **Medium**, task type **Feature**.
6. Return a summary table and the new Notion page link.
