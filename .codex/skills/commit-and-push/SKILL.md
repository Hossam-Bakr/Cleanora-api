---
name: commit-and-push
description: Execute Cleanora's guarded validation, complete working-tree staging, conventional commit, and safe feature-branch push. Use only when the human's message is exactly "commit and push". Do not trigger for "commit and push plus", paraphrases, preparation, review, or ordinary implementation.
---

# Commit and Push

Read and follow `docs/ai/workflows/commit-and-push.md` exactly.

## Trigger

The human message must be exactly `commit and push`. This skill does not run for `commit and push plus`.

This trigger authorizes no merge, deployment, production migration, force-push, amend, hook bypass, or direct push to `main`. Direct `main` publication is the separate `commit-and-push-plus` skill.

## Complete working tree

Stage **every** remaining change except secrets, credentials, `.env` files other than `.env.example`, and `.gitignore` junk.

Always include leftover skills, commands, rules, docs, specs, `.cursor/`, `.codex/`, `.agents/`, `.specify/`, inherited follow-up files, and untracked project files. Do not ask whether they are in scope. Do not leave them unstaged.

After staging, `git status --short` must show no remaining project files outside the exclusion list. If any remain, stage them before committing.

## Publish target

Push the feature branch only. If the checkout is `main`, move the commit onto the phase feature branch first. Never push this workflow to a protected default branch.
