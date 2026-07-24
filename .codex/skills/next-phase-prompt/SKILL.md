---
name: next-phase-prompt
description: Prepare a focused Cleanora prompt for the next roadmap phase after the current phase is validated and human-approved. Use when Codex must create the next preparation handoff without activating or implementing that phase.
---

# Next Phase Prompt

Follow `docs/ai/workflows/prepare-next-phase.md`.

1. Verify the current phase is complete, validated, reviewed, and human-approved.
2. Read its handoff and only the next roadmap section plus directly relevant decisions and open questions.
3. Confirm dependencies, inherited public contracts, migrations, known debt, and unresolved product decisions.
4. Draft the prompt using `docs/ai/templates/next-phase-prompt.md`.
5. Specify objective, required context, preparation deliverables, explicit exclusions, and owner decisions.
6. Do not mark the next phase active, create product code, read later phases, commit, or push.
