# Cleanora — Current Work

| Field | Value |
|---|---|
| Current Release | Release 1 — Core Marketplace |
| Current Phase | R1-P15 — Deposit Payments, Methods & Webhooks |
| Status | **READY_FOR_OWNER_REVIEW** — prep-accept PASS; migration MAJORs remediated; Cursor interim PASS; not Complete |
| Backend Owner | Cursor (implementation); Codex bounded PM/review |
| Local Checkout | `codex/r1-p15-deposit-payments-methods-webhooks` |
| Verified Main | `origin/main` remains P13-merged baseline; this workflow does not merge |
| Started At | 2026-09-12 |
| Completed At | — |
| Last Updated | 2026-09-12 — R1-P15 READY_FOR_OWNER_REVIEW |

## Active phase — R1-P15

R1-P15 is the sole active phase under DEC-094 at **READY_FOR_OWNER_REVIEW**.
Cursor delivered Spec Kit artifacts, deposit/webhook implementation, tests,
Prisma migration, and API docs. Codex prep-accept **ACCEPT_IMPLEMENTATION**.
Codex final review was BLOCKED on live migration + pending typecheck; both
were remediated (typecheck PASS; clean + P14→P15 upgrade PASS on
`cleanora_r1_p15_proof`). Cursor post-fix interim **PASS** (Codex budget
exhausted). Handoff:
`specs/R1-P15-deposit-payments-methods-webhooks/handoff-ready-for-owner-review.md`.

The phase is **not** Complete. Feature-branch publication uses the exact
human message `commit and push`; this does not merge, deploy, or mark
Complete.

No stored-value wallets, invented InstaPay (OQ-009), assignment execution,
Docker, or cloud.

## Most recently completed phase — R1-P14

R1-P14 is **Complete** under DEC-094 after READY_FOR_OWNER_REVIEW and Codex
T031 PASS. In-process ledger module only. Closure:
`specs/R1-P14-financial-ledger-payment-architecture/completion-report.md`.

## Previously completed phase — R1-P13

R1-P13 is **Complete** under DEC-093. Browse-path booking drafts, server
quote/deposit, snapshots, status matrix, cancel without fees.
