# Review report — R1-P18

## Scope and evidence

- Specification: `specs/R1-P18-order-execution-completion-code/spec.md`
- Activation: DEC-100; prep-accept Codex call 1 ACCEPT_IMPLEMENTATION KEEP EX-01–04
- Diff: branch `r1-p18-order-execution-completion-code`
- Checks run (Cursor):
  - `npm run test:r1-p18` → 10 files / **26** PASS
  - Coverage: **88.15 / 77.77 / 80.18 / 88.03**
  - `npm run typecheck` / `openapi:validate` / `postman:validate` / `docs:check` PASS
  - Live clean + upgrade migration PASS (Neon; pg apply)

## Codex consultations

| # | purpose | minutes | status | outcome |
|---|---|---|---|---|
| 1 | prep-accept | ~1 | completed | ACCEPT_IMPLEMENTATION |
| 2–3 | final review | ~5 each | timeout | no verdict |
| 4 | minimal | ~0.4 | completed | BLOCKED (code not inspected) |
| 5 | exceptional FS review | ~5.2 | timeout | no verdict |
| 6 | resume | ~0.3 | completed | BLOCKED (code not inspected) |
| 7 | **inline-evidence final review** | ~0.3 | completed | **PASS** (thread `01a0a034-3325-7023-b483-19bef755357a`) |

Call 7 used an inlined critical-path brief (`briefs/codex-review-07-inline.txt`) after FS reads failed in prior attempts. Codex reviewed matrix, authz, completion-code, ensure-before-authz, CAS, intents-only, EX-01–04.

## Findings

### BLOCKER/MAJOR

none (Codex call 7).

### Previously repaired (Cursor, before call 7)

1. Ensure-order before authz → fixed (`requireReadAccessForActivation` first)
2. Unconditional status update → fixed (`updateMany` CAS + ACTIVE supersede)

### Residual MINOR

1. Completion pepper falls back to JWT / dev string in composition
2. Lazy ensure via GET by-booking only (contract-aligned)
3. `workerUserId: null` members never classify as FIELD_MEMBER

## EX-01..04

All **ok** per Codex call 7.

## Verdict

`PASS` — no unresolved BLOCKER/MAJOR. SC-010 satisfied by Codex call 7 PASS.
