---
name: notion-start-new-phase
description: >-
  Create a new Cleanora backend phase row in the Notion House Keeping Backend
  database. Use when the user runs /notion-start-new-phase, asks to start a new
  backend phase in Notion, or add the next housekeeping/backend phase row.
disable-model-invocation: true
---

# Start New Backend Phase in Notion

## Trigger

- `/notion-start-new-phase`
- "add phase N to housekeeping/backend"
- "insert the next backend phase in Notion"

Do **not** use for Frontend rows, updating existing phases, or marking phases Done.

## Outcome

One new row in the **Backend** database under **House Keeping (Hossam & Bassam)** with phase name, description, assignee, and today's due date.

## Fixed targets

| Item | Value |
|---|---|
| House Keeping page | https://app.notion.com/p/d417b1da306d82f8802181766ccfd7d5 |
| Backend database | https://app.notion.com/p/39e7b1da306d80819057c73ce0b2d319 |
| Data source ID | `39e7b1da-306d-8084-9d07-000bef5cafda` |
| Default assignee | Hossam Bakr — `b0eb52ec-6b09-47c0-b082-e1cc2bf54bad` |

## Required inputs

1. **Phase number** — from user args or next missing `(000N)` in Backend.
2. **Phase name** — from `docs/product/roadmap.md` (`R1-P{NN}`) or `docs/phases/release-1/README.md`.
3. **Description** — one paragraph from Goal + Scope in the roadmap section.

Optional overrides only when explicitly requested: assignee, due date, status, priority, effort.

## Workflow

### 1. Load context

- `notion-fetch` the Backend database schema if needed.
- Read the phase section from Cleanora docs.
- Search Backend for existing `(000{NN})` row; stop and report link if duplicate.

### 2. Build row values

**Task name pattern:**

```text
{emoji}  {Phase Name} (000{NN})
```

Emoji map: `1️⃣` … `9️⃣` for phases 1–9; use `🔟` for phase 10+.

**Default properties:**

| Property | Value |
|---|---|
| Task name | formatted as above |
| Description | roadmap summary paragraph |
| Assignee | `["b0eb52ec-6b09-47c0-b082-e1cc2bf54bad"]` |
| Status | `Not started` |
| Priority | `High` |
| Effort level | `Medium` |
| Task type | `["💬 Feature"]` |
| `date:Due date:start` | today (`YYYY-MM-DD`) |
| `date:Due date:is_datetime` | `0` |

### 3. Create row

Use `notion-create-pages` with:

```json
{
  "parent": { "data_source_id": "39e7b1da-306d-8084-9d07-000bef5cafda" },
  "pages": [{ "properties": { "...": "..." } }]
}
```

Do not set read-only fields (`Updated at`, `Past due`).

### 4. Confirm

Return a summary table (task name, description, assignee, due date, status) and the new page URL.

## Safety

- Never delete or overwrite existing rows without explicit confirmation.
- Never invent phase scope if roadmap section is missing — ask the user.
- Verify creation succeeded before reporting done.

## Example

**Input:** `/notion-start-new-phase 9`

**Task name:** `9️⃣  Provider Services, Pricing & Historical Snapshots (0009)`

**Description:** Allow providers to configure services and server-authoritative prices—selecting catalog services, enabling/disabling provider offerings, setting price and price unit, minimum charge, estimated duration, and service notes; retaining price and status history; enforcing approval rules when configured; and producing snapshot structures for confirmed bookings with decimal-safe validation and rejection of client-supplied totals.
