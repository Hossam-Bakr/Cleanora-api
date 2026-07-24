# AI Tool Roles

## Cursor Auto

Implements the active Spec Kit tasks, code, tests, incremental Prisma work, and phase documentation. It must stay inside active scope.

## Cursor Claude

Reviews the active Git diff against the specification and architectural, security, database, and testing rules. It reports evidence and avoids broad rewrites by default.

## Codex

Owns phase coordination, focused prompts, architecture guardrails, diagnosis, repair of verified findings, migration guidance, quality gates, and the guarded Git workflow.

## Human owner

Approves product decisions, resolves open questions, accepts phase completion, and explicitly triggers Git actions. Merge, deployment, production migrations, credentials, and destructive actions require separate approval.

## Handoff rule

Artifacts are the handoff:

```text
spec/plan/tasks -> implementation summary -> review report
-> review resolution -> validation -> phase handoff
```

No tool may silently reinterpret a locked product rule.
