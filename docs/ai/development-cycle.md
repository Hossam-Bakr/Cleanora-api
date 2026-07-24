# Development Cycle

```text
Roadmap phase
-> specification
-> technical plan
-> tasks
-> Cursor implementation
-> Claude review
-> Codex verification and focused fixes
-> validation
-> human approval
-> commit and push
-> next phase
```

Only one phase is active.

## Gates

1. Preparation: canonical documents exist, blockers are resolved, and scope and DoD are explicit.
2. Implementation: tasks are traceable, module ownership is respected, and tests accompany behavior.
3. Review: the complete diff is checked with file/line evidence.
4. Resolution: each blocker/major finding is verified, fixed or explicitly rejected with evidence, and retested.
5. Completion: repository checks and phase DoD pass; the human approves.
6. Git: only the exact phrase `commit and push` triggers staging, commit, and safe feature-branch push.

Never merge, deploy, run production migrations, or begin the next implementation phase as an implied step.
