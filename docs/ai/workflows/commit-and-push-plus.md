# Commit and Push Plus

This workflow activates only when the human message is exactly:

```text
commit and push plus
```

It does not activate for `commit and push`, paraphrases, mentions inside another command, or slash-command names.

The trigger authorizes a small follow-up publication: complete staging of the remaining working tree, one conventional commit, and a **direct push to `main`**. It does not authorize merge of a feature branch, deployment, production migration, force-push, history rewriting, hook bypass, or amend.

Use this after an earlier `commit and push` when leftover files or a tiny fix should land on `main` without a pull request.

## Complete working-tree rule

Same inclusion and exclusion rules as `docs/ai/workflows/commit-and-push.md`. Stage leftover skills, docs, specs, Cursor/Codex/agent files, and every other non-secret project change. Pass the same completeness gate before committing.

## Target

Publish **working-tree** changes onto `main` only. Do not merge a feature branch into `main`. Do not push unique feature-branch commits as a substitute for a pull request.

## Procedure

1. Confirm the human message is exactly `commit and push plus`.
2. Inspect status and the complete staged, unstaged, and untracked diff. Reject secrets, credentials, `.env` files other than `.env.example`, and gitignored junk.
3. If Prisma, `src/`, tests, or package manifests changed, run the discovered repository quality gates and Prisma safety checks. Skill, command, rule, and documentation-only changes do not require the full phase review/DoD suite.
4. Fetch `origin`.
5. Move the remaining working tree onto `main`:

   - If already on `main`: `git pull --ff-only origin main`.
   - If on another branch: `git stash push --include-untracked` with a clear message, `git checkout main`, `git pull --ff-only origin main`, then `git stash pop`. Stop on stash or fast-forward conflicts.

6. Stage the complete remaining working tree. Pass the completeness gate.
7. Create one conventional commit via HEREDOC. Do not amend, force, or bypass hooks.
8. Push `origin main` with a regular (non-force) push.
9. Report branch (`main`), commit SHA/message, whether checks ran, and that skills/docs were included when present.

If GitHub branch protection rejects the push, stop and report that result. Do not silently open a pull request, force-push, or rewrite history.

Never use `--force`, `--force-with-lease`, `--no-verify`, or `--no-gpg-sign`.
