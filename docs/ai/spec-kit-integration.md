# Spec Kit Integration

Spec Kit provides the phase specification, technical plan, and executable tasks. It does not replace Cleanora's canonical product rules.

Recommended phase structure:

```text
specs/
└── R1-PXX-phase-name/
    ├── spec.md
    ├── plan.md
    ├── tasks.md
    ├── checklists/
    ├── implementation-summary.md
    ├── review-report.md
    ├── review-resolution.md
    └── handoff.md
```

## Rules

- Maintain one active phase.
- Derive acceptance criteria from canonical documents and approved decisions.
- Record unresolved product questions; do not answer them technically.
- Keep plan and tasks within the phase boundary.
- Make database ownership, migration name, authorization, audit, and tests explicit when applicable.
- Update artifacts when approved scope changes.

## Initialization safety

Before initializing `.specify/`:

1. Confirm canonical product documents are repository-local.
2. Inspect the installed official Spec Kit CLI and its version/help.
3. Review the proposed changes.
4. Initialize only through the official workflow.
5. Do not assume integration keys or overwrite repository files destructively.

If the CLI is unavailable, leave `.specify/` absent and report that status. Do not imitate generated internals manually.
