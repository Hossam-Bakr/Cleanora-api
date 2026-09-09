# R1-P11 Baseline Boundary

**Captured for:** `R1-P11 — Eligibility Engine V1` preparation  
**Feature branch:** `codex/r1-p11-eligibility-engine-v1`  
**Starting HEAD:** `38f3efa080a4ffd71f24fd83b2ab800662558b30`  
**Baseline directory:** `C:\Users\hossa\AppData\Local\Temp\cleanora-r1-p11-20260909-145603\`  
**Source branch:** `codex/r1-p10-availability-capacity-textual-coverage` (P10 Complete under DEC-061)

## Snapshot inventory

| File | Purpose |
|---|---|
| `baseline-head.txt` | Exact HEAD SHA at activation |
| `baseline-branch.txt` | Branch name at activation |
| `baseline-status.txt` | Porcelain status of inherited dirty tree (65 lines at capture) |
| `baseline.patch` | Diff of tracked modifications at activation |
| `baseline-untracked.txt` | Path inventory of untracked files at activation (866 paths) |

This snapshot proves preservation intent. It is **not** a full content copy of every untracked file.

## Inherited dirty attribution

The working tree at activation contained completed P10 work plus preserved earlier-phase local edits and many untracked tooling/docs paths. Those files are **inherited**, not authored by P11.

Rules:

1. Do not discard, stash, or overwrite inherited tracked or untracked work.
2. Attribute every P11 edit relative to this baseline (new paths under the feature dir, or intentional modifications with an explicit P11 reason).
3. Never claim an inherited dirty path is “P11 complete” merely because it appears in `git status`.
4. When a P11 task must edit an inherited untracked or previously dirty file, record that path in implementation evidence with a one-line P11 purpose.

## P11 write allowlist (preparation batch)

Allowed in this preparation batch:

- `specs/R1-P11-eligibility-engine-v1/**` (all preparation artifacts)
- Narrow navigation updates: `docs/product/current.md`, and (when separately authorized) decision-log / README / Spec Kit pointer repairs named by Codex

Forbidden in preparation:

- `src/**`, `tests/**`, `prisma/**`
- `package.json`, lockfiles
- Runtime OpenAPI/Postman generators or route mounts
- Commits, pushes, merges, deploys, production migrations

## P11 write allowlist (implementation, after preparation acceptance)

Implementation may additionally touch only paths required by `tasks.md`, typically:

- `src/modules/eligibility/**` (new)
- Approved public-contract extensions in owning modules (Providers, Catalog, Configuration) and composition wiring
- `prisma/schema.prisma` + `prisma/migrations/r1_p11_eligibility_engine_v1/**` + deterministic seed additions
- `vitest.r1-p11.config.ts`, phase test helpers, phase unit/integration tests
- Planned scripts: `test:r1-p11`, `test:coverage:r1-p11`, `db:validate-r1-p11-upgrade` and their validators
- Docs/OpenAPI **notes** stating zero new HTTP (no new eligibility operations)

## Pre-write hash procedure for inherited untracked files

The activation baseline lists untracked **paths**, not content hashes. Before editing any inherited untracked file:

1. Resolve the absolute path.
2. Capture a pre-write content hash (for example SHA-256 of file bytes) and size into
   `specs/R1-P11-eligibility-engine-v1/implementation-evidence.md` (or a dated appendix).
3. Label the capture as **pre-write preservation**, never as “historical activation snapshot.”
4. After the edit, record the post-write hash and the P11 purpose of the change.
5. If the file must remain byte-identical, abort the edit and choose another path.

Do not invent hashes for files never read. Do not treat missing baseline copies as proof of prior contents.

## Change classification checklist

Before any write session:

- [ ] Confirm branch is `codex/r1-p11-eligibility-engine-v1`
- [ ] Confirm HEAD is still descended from `38f3efa` (or record intentional divergence)
- [ ] Classify touched paths as: new P11, inherited dirty (P11-attributed edit), or out-of-scope
- [ ] Refuse edits outside the active allowlist for the current batch

## Authority reminder

DEC-062 / activation authorize preparation through completion for P11 only. Exact-message `commit and push` remains the sole Git publication trigger and does **not** authorize merge, deployment, or production migration.
