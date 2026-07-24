---
name: debug-and-fix
description: Diagnose and repair a focused Cleanora defect with reproducible evidence and regression coverage. Use when a command, test, endpoint, migration, queue, payment, cache, notification, or runtime behavior fails and Codex is asked to debug or fix it.
---

# Debug and Fix

Follow `docs/ai/workflows/debug-error.md`.

1. Capture the exact failure, command, environment, inputs, and expected result.
2. Reproduce the smallest deterministic case and identify the owning module.
3. Inspect recent relevant changes and trace state and side effects.
4. Test hypotheses and state the root cause with evidence.
5. When repair is authorized, make the smallest correct change without weakening validation, types, authorization, or tests.
6. Add regression coverage and run focused then risk-proportionate broader checks.
7. Record the outcome using the bug-report template.
8. Report remaining risk; do not commit or push.
