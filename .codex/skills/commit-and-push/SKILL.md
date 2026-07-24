---
name: commit-and-push
description: Execute Cleanora's guarded validation, staging, conventional commit, and safe feature-branch push workflow. Use only when the human's message is exactly "commit and push"; do not trigger for paraphrases, preparation, review, or ordinary implementation.
---

# Commit and Push

Read and follow `docs/ai/workflows/commit-and-push.md` exactly.

Before writing Git state, verify the current phase, complete diff, secrets/junk check, review resolution or waiver, repository quality gates, and Prisma safety when applicable. Stage only intended files, re-read the staged diff, create one clear conventional commit, and push the feature branch safely.

The trigger authorizes no merge, deployment, production migration, force-push, hook bypass, amend, or shared-history rewrite. Stop for unresolved blockers, failed required checks, unsafe migration risk, missing authorization, or ambiguous intended files. Report branch, commit, checks, migration/review status, and push result.
