# Codex consultation protocol

Read this before the first Codex dispatch in `/work-on-next-phase`. Cursor remains the implementer. Codex is a bounded PM and reviewer reached **only** through the installed `/codex-delegate` skill (Codex CLI).

## Role split

| Actor | Owns |
|---|---|
| Cursor | Spec Kit artifacts Cursor is executing, all product code, tests, Prisma, OpenAPI/Swagger, Postman, gate commands, review repairs |
| Codex CLI via `/codex-delegate` | MVB scope/decision acceptance, preparation authorization, mandatory batch acceptance, adversarial review of the phase diff |
| Owner | Material product/UX/security decisions Codex cannot settle, phase Complete, `commit and push`, `commit and push plus` |

Never ask Codex to implement, scaffold, refactor, write tests, edit Prisma, or generate API artifacts. If a brief would require those actions, rewrite it as a decision or review question, or do the work in Cursor. `/codex-delegate` is the transport, not an implementation handoff. Ignore that skill's "orchestrator commits" step; this workflow never commits or pushes.

## Model lock

Required mode: **sol xhigh speed 1.5**

| Dial | Required value | Meaning |
|---|---|---|
| Model | `gpt-5.6-sol` | Sol |
| Reasoning | `xhigh` | Extra-high effort |
| Speed | `service_tier=priority` | Fast **1.5x**, increased usage |

Verify against the local CLI and account before the first call:

```bash
command -v codex
codex --version
codex login status
```

Confirm `~/.codex/config.toml` has `service_tier = "priority"` so Fast 1.5x is active. The installed `/codex-delegate` relay does not expose a `--service-tier` flag; do **not** pass `--clean-env`, so this config applies. If `service_tier` is missing or not `priority`, stop new Codex calls, record the exact config, and ask the owner before changing global Codex settings.

Inspect live model/effort help from this CLI version. Accept only an exact `gpt-5.6-sol` match, or a documented alias that the CLI itself lists as that model. If `gpt-5.6-sol`, `xhigh`, or Fast 1.5x / `priority` is missing, unauthenticated, or rejected, **stop new Codex calls**. Record the exact CLI output. Do not silently switch to another model, including `gpt-5.5`, `gpt-5.6-sol-medium`, or the account default.

## Budget

Persist totals in `specs/<phase-dir>/work-on-next-phase-progress.md`. Carry them across invocations of this command.

| Limit | Default |
|---|---|
| Target consultations | 2: preparation/decision acceptance, then final review |
| Hard ceiling | 4 calls and 20 minutes cumulative delegated wall time per phase |
| Per-call watchdog | 5 minutes |
| Concurrency | 1 Codex process |

Count every fresh dispatch, retry, and `--session` / `--resume-last` resume. A timed-out or failed call still counts.

Reuse an already-accepted preparation decision. Do not spend a call to re-ask the same accepted question.

Required existing batch-acceptance gates may need more than two calls. Use the remaining budget for those gates or for re-review after Cursor repairs. Do not skip a required gate to stay under two calls, and do not exceed the ceiling.

If the budget is exhausted and a required Codex review has not happened, leave that review **pending**. Ask the owner for restored access/budget or an explicit owner-review substitution. Never label a missing review PASS.

## Quota and telemetry

The five-hour Codex usage window is not five hours of available execution. Inspect real telemetry only when the CLI or account actually exposes it at a dispatch boundary. Otherwise record usage as `unknown`.

Never fabricate a remaining percentage, token count, or reset time. Never buy or redeem quota. On quota exhaustion, auth failure, or budget exhaustion: stop new Codex calls and continue only the Cursor work already covered by accepted decisions.

## Dispatch

Use the installed `/codex-delegate` skill. Resolve its directory in this order, then read that `SKILL.md` completely before writing the brief:

1. `$HOME/.claude/skills/codex-delegate`
2. `$HOME/.codex/skills/codex-delegate`
3. repo `.agents/skills/codex-delegate` only if present
4. `find "$HOME" -name relay.mjs -path '*codex-delegate*'` and use the directory above `scripts/`

Write the brief to a temp file. Keep one process at a time. Dispatch only through that skill's relay, in read-only mode, locked to sol xhigh speed 1.5:

```bash
node "<codex-delegate-skill-dir>/scripts/relay.mjs" \
  --brief /tmp/work-on-next-phase-brief.txt \
  --cd "<repo-root>" \
  --read-only \
  --model gpt-5.6-sol \
  --effort xhigh \
  --timeout 5m
```

Do not add `--clean-env`. Follow `/codex-delegate` for brief shape, polling `result.json`, and reviewing the self-report. After the run, re-verify the working tree yourself; Codex must not have written product files.

If the installed `/codex-delegate` skill or its `relay.mjs` is missing after the lookup above, **stop new Codex calls**, record the gap, and continue only Cursor work already covered by accepted decisions. Do not invent a substitute dispatcher. A last-resort raw CLI path is allowed only when the owner explicitly authorizes it after that gap report:

```bash
codex exec --read-only --model gpt-5.6-sol \
  -c model_reasoning_effort=xhigh \
  -c service_tier=priority \
  --sandbox read-only \
  < /tmp/work-on-next-phase-brief.txt
```

Apply a five-minute watchdog to that owner-authorized fallback as well. Kill the process on timeout and record `timeout` in the progress file.

After every call, persist: purpose, dispatch path (`/codex-delegate` or owner-authorized fallback), model, effort, `service_tier`, started/finished timestamps, wall minutes, exit status, `threadId` if any, touched-files claim, and a one-line outcome.

## Brief contract

Codex sees only the brief. Include:

1. Role: read-only PM or reviewer. Do not edit files. Do not implement.
2. Phase id, MVB constraint, and the exact decision or review question.
3. In/out scope and already-accepted decisions (ids and one-line holdings).
4. Named files and short excerpts or diffs, not the repository.
5. The answer shape: accept / reject with reasons / options with a recommendation / findings with severity.
6. Instruction to name exceptions explicitly and to refuse over-engineering.

Keep briefs short. Ask one coherent question per call. For final review, send the reviewable file list, acceptance criteria, gate evidence summary, and `docs/ai/templates/review-report.md` shape.

## Allowed calls

1. **Preparation / decision acceptance** — compact spec/plan/tasks package; ask for complete in-scope implementation authorization and named exceptions.
2. **Mandatory batch acceptance** — only when the active phase already requires it.
3. **Final review** — after implementation and required gates; repair in Cursor.
4. **Re-review** — only after material repairs to previously reported BLOCKER or MAJOR findings.

Ordinary test failures, lint, typecheck, coverage gaps, and routine repairs stay in Cursor.

## Progress file

Create `specs/<phase-dir>/work-on-next-phase-progress.md` if missing. Keep at least:

```markdown
# Work-on-next-phase progress — <phase-id>

## Objective
READY_FOR_OWNER_REVIEW without mark-complete or Git publication.

## Codex budget
- calls_used: 0
- calls_ceiling: 4
- wall_minutes_used: 0
- wall_minutes_ceiling: 20
- model: gpt-5.6-sol
- effort: xhigh
- service_tier: priority
- speed: 1.5x
- dispatch: /codex-delegate
- usage_telemetry: unknown

## Consultations
| # | purpose | started | minutes | status | thread | outcome |
|---|---|---|---|---|---|---|

## Accepted decisions
- source / id / holding

## Next unblocked work
- task id and evidence still required
```

## Failure handling

| Condition | Action |
|---|---|
| Model, effort, or Fast 1.5x / `priority` unavailable | Stop Codex. Record CLI evidence. Continue authorized Cursor work. Ask owner if a required review is blocked. |
| `/codex-delegate` skill or `relay.mjs` missing | Stop new Codex calls. Record the lookup paths tried. Continue authorized Cursor work. Ask owner before any raw `codex exec` fallback. |
| Timeout | Count the call. Do not resume the same bloated brief. Narrow it or continue in Cursor. |
| Codex edited files | Revert those edits unless they are exact accepted review notes already applied by Cursor. Treat as a protocol breach. |
| Two Codex processes | Do not start the second. Wait or abort the extra process. |
