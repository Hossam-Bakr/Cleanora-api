# Commit and Push

This workflow activates only when the human message is exactly:

```text
commit and push
```

It does not activate for `commit and push plus`, paraphrases, mentions inside another command, or slash-command names.

The trigger authorizes validation, **complete** staging of the remaining working tree, one conventional commit, and a safe feature-branch push. It does not authorize merge, deployment, production migration, force-push, history rewriting, or a direct push to `main`. Direct `main` publication uses the separate exact message `commit and push plus`.

## Complete working-tree rule

The default is to publish **every** remaining change. Do not ask the owner to choose a combined vs split scope after this trigger. Do not leave files behind for a later commit.

Must stage when present (modified, unstaged, staged, or untracked), including but not limited to:

- `.cursor/skills/`, `.cursor/commands/`, `.cursor/rules/`
- `.codex/skills/` and other `.codex/` project files
- `.agents/skills/` and other `.agents/` project files
- `docs/`, `specs/`, `.specify/`
- `src/`, `tests/`, `prisma/`, `scripts/`, `postman/`
- package manifests, lockfiles, Vitest/TS/ESLint configs
- any other project file not on the exclusion list

Never skip a file because it is a skill, command, rule, document, spec artifact, untracked, markdown, inherited from a previous phase, or “unrelated” to the current phase.

Exclude **only**:

- secrets, credentials, private keys, tokens
- `.env` and `.env.*` except `.env.example`
- files ignored by `.gitignore` (for example `node_modules/`, `dist/`, `coverage/`, `src/generated/`, `.tmp/`, logs, local IDE settings)

## Completeness gate

After staging, run `git status --short`. The only allowed leftover unstaged or untracked paths are exclusion-list files. If any other path remains, stage it. Then re-read the staged diff before committing.

If a leftover path looks like a secret, stop and report it. Do not skip skills or docs while waiting for confirmation.

## Procedure

1. Read the current phase pointer and Definition of Done.
2. Inspect branch, upstream, status, and the complete staged, unstaged, and untracked diff (`git status`, `git diff`, `git diff --cached`, `git ls-files --others --exclude-standard`).
3. Check for secrets, credentials, environment files, generated junk, and debug output. Do not treat skills, docs, specs, or Cursor/Codex artifacts as junk.
4. Require a completed review report and resolution, or an explicit human waiver.
5. Verify and fix valid blocker and major findings; rerun affected tests.
6. Discover actual checks from repository scripts/configuration and run them.
7. When Prisma changed, validate schema, review new migration SQL, check defaults/backfills/indexes/constraints, regenerate the client, and run applicable migration tests.
8. Update phase artifacts and current status only when evidence supports it.
9. Stage the complete remaining working tree under the complete working-tree rule. Re-inspect the staged diff. Pass the completeness gate.
10. Create one clear conventional commit describing the phase or focused fix. Pass the message via HEREDOC. Do not use `--amend`, `--no-verify`, or `--no-gpg-sign`.
11. Push the current feature branch safely, setting upstream only when needed. If the checkout is `main` or another protected default branch, create or switch to the phase feature branch first, then push that branch. Never push this workflow to `main`.
12. Report branch, commit SHA/message, checks, migration status, review resolution, push result, and a short inventory that skills, docs, specs, and Cursor/Codex files were included when they existed in the working tree.

Never use `--force`, amend shared history, bypass hooks, or omit remaining project files.
