---
name: review-fix-handoff
description: Verify, resolve, and document Cleanora code-review findings. Use when Codex receives a Claude or human review report and must validate blocker or major findings, implement focused fixes, reject invalid claims with evidence, add regression tests, and prepare a review-resolution handoff.
---

# Review Fix Handoff

Follow `docs/ai/workflows/fix-review-findings.md`.

1. Read the active phase artifacts, complete report, relevant diff, and affected code.
2. Verify each blocker and major finding independently before editing.
3. Classify it as accepted, rejected-with-evidence, already-resolved, or owner-decision-required.
4. Apply the smallest correct fix for accepted findings and preserve active scope.
5. Add regression tests tied to the failure mode.
6. Run focused checks followed by broader quality gates proportional to risk.
7. Complete `review-resolution.md` from the canonical template with evidence for every finding.
8. Report unresolved owner decisions. Do not commit or push.
