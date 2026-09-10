---
name: commit-and-push-plus
description: Commit leftover or tiny follow-up changes and push them directly to main without a pull request. Use only when the human's message is exactly "commit and push plus". Do not trigger for "commit and push", paraphrases, phase publication, merge, or ordinary implementation.
---

# Commit and Push Plus

Read and follow `docs/ai/workflows/commit-and-push-plus.md` exactly.

## Trigger

The human message must be exactly `commit and push plus`. This is not the same skill as `commit and push`.

This trigger authorizes complete staging of remaining working-tree files, one conventional commit, and a direct non-force push to `main`. It does not authorize merging a feature branch, deployment, production migration, force-push, amend, or hook bypass.

## Complete working tree

Stage **every** remaining change except secrets, credentials, `.env` files other than `.env.example`, and `.gitignore` junk. Always include leftover skills, commands, rules, docs, specs, `.cursor/`, `.codex/`, `.agents/`, and `.specify/` files. After staging, nothing except the exclusion list may remain unstaged.

## Publish target

Checkout and update `main`, apply the leftover working tree there, commit, and push `origin main`. Do not open a pull request. Do not merge unique feature-branch commits onto `main` through this skill.
