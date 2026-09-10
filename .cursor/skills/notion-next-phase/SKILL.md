---
name: notion-next-phase
description: >-
  Insert one new row in the House Keeping Backend Notion database for the next
  Cleanora phase, filling Task name, Description, Number, Due date, and related
  properties via Notion MCP. Use when the user sends /notion-next-phase,
  /notion-start-new-phase, or asks to add the next backend phase to
  housekeeping/backend. Do not use for Frontend rows, editing an existing phase,
  marking Done, or activating the repo phase.
disable-model-invocation: true
---

# Notion Next Phase

Insert **one** Backend database row under House Keeping. Do not activate the
phase in the repo, implement code, mark Complete, commit, or push.

## Fixed targets

| Target | Value |
|---|---|
| House Keeping page | `https://app.notion.com/p/d417b1da306d82f8802181766ccfd7d5` |
| Backend database | `https://app.notion.com/p/39e7b1da306d80819057c73ce0b2d319` |
| Data source ID | `39e7b1da-306d-8084-9d07-000bef5cafda` |
| Collection URL | `collection://39e7b1da-306d-8084-9d07-000bef5cafda` |
| Default assignee | Hossam Bakr `b0eb52ec-6b09-47c0-b082-e1cc2bf54bad` |

Discover Notion MCP tools with `GetDynamicTools` (`plugin-notion-workspace-notion`)
before calling them. If the namespace is `needsAuth`, authenticate, then retry.

## 1. Load the smallest context

Read `docs/product/current.md` and **only** the next `R1-P{NN}` section in
`docs/product/roadmap.md`. Fallback: `docs/phases/release-1/README.md`.
Do not load later phases or invent scope.

Resolve the phase number:

1. User named a phase (`13`, `P13`, `R1-P13`) → use that number.
2. Otherwise infer `current pointer + 1`, then confirm it matches the next
   roadmap heading.

## 2. Refresh schema and reject duplicates

1. `notion-fetch` the Backend database URL. Use the live property names.
2. Check for an existing row before writing:
   - Prefer `notion-query-data-sources` on the collection URL:
     `SELECT url, "Task name", "Number" FROM "collection://39e7b1da-306d-8084-9d07-000bef5cafda" WHERE "Number" = ? OR "Task name" LIKE ?`
   - Fallback: `notion-search` for `(00NN)` or the phase title.
3. If a matching row exists, return its link and stop unless the user explicitly
   asked to create another.

Do not set read-only fields (`Updated at`, `Past due`).

## 3. Build property values

### Task name

```text
{emoji}  {Roadmap phase title without R1-Pxx prefix} ({NNNN})
```

`NNNN` is the phase number padded to 4 digits. Put two spaces after the emoji.

| N | Emoji | Example |
|---|---|---|
| 1–9 | `1️⃣` … `9️⃣` | `9️⃣  Provider Services, Pricing & Historical Snapshots (0009)` |
| 10 | `🔟` | `🔟  Availability, Capacity & Textual Coverage (0010)` |
| 11+ | `1️⃣` + digit keycaps | `1️⃣2️⃣  Browse Marketplace & Provider Details (0012)` |

For 11+: `11 → 1️⃣1️⃣`, `12 → 1️⃣2️⃣`, `13 → 1️⃣3️⃣`.

### Description

One paragraph from that roadmap section's Goal plus key Scope bullets. Plain
prose. Do not paste the full spec or a bullet dump.

### Defaults (override only when the user asks)

| Property | Value |
|---|---|
| Task name | formatted title |
| Description | roadmap paragraph |
| Number | phase number as a JavaScript number (`13`, not `"13"`) |
| Assignee | `["b0eb52ec-6b09-47c0-b082-e1cc2bf54bad"]` |
| Status | `Not started` |
| Priority | `High` |
| Effort level | `Medium` |
| Task type | `["💬 Feature"]` |
| `date:Due date:start` | today `YYYY-MM-DD` |
| `date:Due date:is_datetime` | `0` |

Allowed select values:

- Status: `Not started`, `In progress`, `Done`
- Priority: `High`, `Medium`, `Low`
- Effort level: `Small`, `Medium`, `Large`
- Task type: `🐞 Bug`, `💬 Feature`, `Task`

Leave `Attach file` empty unless the user supplied a file.

## 4. Create the row

Call `notion-create-pages` with `allow_async: false`:

```json
{
  "parent": {
    "type": "data_source_id",
    "data_source_id": "39e7b1da-306d-8084-9d07-000bef5cafda"
  },
  "pages": [
    {
      "properties": {
        "Task name": "1️⃣3️⃣  Booking Draft, Pricing Snapshot & Status Machine (0013)",
        "Description": "<one paragraph>",
        "Number": 13,
        "Assignee": ["b0eb52ec-6b09-47c0-b082-e1cc2bf54bad"],
        "Status": "Not started",
        "Priority": "High",
        "Effort level": "Medium",
        "Task type": ["💬 Feature"],
        "date:Due date:start": "2026-09-10",
        "date:Due date:is_datetime": 0
      }
    }
  ]
}
```

Use today's real date. Do not use `database_id` as the parent. Do not apply a
template. Do not write to the Frontend database.

## 5. Confirm

After the tool returns a page URL, report:

| Field | Value |
|---|---|
| Task name | created title |
| Number | phase number |
| Description | truncated if long |
| Assignee | name |
| Due date | ISO date |
| Status | created status |
| Link | Notion page URL |

If creation failed, report the MCP error and stop. Never delete or overwrite
another Backend row without explicit confirmation.

## Missing inputs

- Phase not in the roadmap → ask for name and description; do not invent scope.
- Notion MCP unavailable → stop and say the row was not created.
- Duplicate found → show the existing link; do not create a second row.
