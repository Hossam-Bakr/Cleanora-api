# Commit and Push

This workflow activates only when the human message is exactly:

```text
commit and push
```

The trigger does not authorize merge, deployment, production migration, force-push, or history rewriting.

## Procedure

1. Read the current phase pointer and Definition of Done.
2. Inspect branch, upstream, status, and the complete staged and unstaged diff.
3. Check for secrets, credentials, environment files, generated junk, debug output, and unrelated changes.
4. Require a completed review report and resolution, or an explicit human waiver.
5. Verify and fix valid blocker and major findings; rerun affected tests.
6. Discover actual checks from repository scripts/configuration and run them.
7. When Prisma changed, validate schema, review new migration SQL, check defaults/backfills/indexes/constraints, regenerate the client, and run applicable migration tests.
8. Update phase artifacts and current status only when evidence supports it.
9. Stage only intended files and re-inspect the staged diff.
10. Create one clear conventional commit describing the phase or focused fix.
11. Push the current feature branch safely, setting upstream only when needed.
12. Never push directly to a protected default branch unless the human explicitly and separately authorizes it.
13. Report branch, commit SHA/message, checks, migration status, review resolution, and push result.

Never use `--force`, amend shared history, bypass hooks, or silently include unrelated user changes.
