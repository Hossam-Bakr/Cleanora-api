# Review Resolution — R1-P09

## Resolution summary

Codex reviewed and repaired the existing Phase 9 worktree under the owner's
review-and-fix instruction. Base: `e3383fb` on `main`. This is a Codex review;
no separate Claude review or human phase approval is represented.

| Finding | Decision | Evidence/fix | Validation |
|---|---|---|---|
| Empty integration tests | accepted | Replaced nine placeholder suites with real PostgreSQL/HTTP behavior and retained-state assertions | Live create, lifecycle, approval, concurrency, readiness, snapshot and HTTP suites |
| Current price policy drift | accepted | Shared exact-decimal country/currency/scale/maximum compatibility check in command, query, DTO, readiness and snapshot paths | Live maximum drift/restoration and unchanged-history tests |
| Stale preflight identity | accepted | Authentication public transaction-bound identity reader; recheck account and global role alongside exact Provider membership | Revoked-role regression and live denied/no-write scenarios |
| Loose test DB detection | accepted | Delegate to explicit phase database guard, fail closed | Database guard and real isolated-target gates |
| Configuration persistence ownership | accepted | Public country identity reader replaces Providers SQL join into countries | SQL boundary guard and all real Provider command/read tests |
| Missing live migration constraint probes | accepted | Shared rollback-only probe with 28 expected SQLSTATE failures, legal transitions and exact 65-digit money | Clean and populated-upgrade proofs, plus clean-test stdout assertion |
| Internal error over HTTP | accepted | Map internal serialization/snapshot conflict to contracted version-conflict 409 | Error-code/status regression |
| Stale phase/Companion evidence | accepted | Reconcile current pointer, specification execution status, task ledger and Companion against fresh evidence | Final documentation/Companion check |

## Files changed

The substantive fixes are in Providers policy, services, DTOs, repository and
unit of work; Authentication's identity reader/public contract; Configuration's
country identity reader/public contract; the explicit test target helper; the
new live integration harness and suites; migration validators/probes; and the
active phase evidence documents. The four-table migration SQL remains unchanged.
See the worktree diff and `review-report.md` for exact finding locations.

## Regression coverage

`implementation-evidence.md` records fresh command outcomes and the FR/SC map.
The tests use real production transaction participants, synthetic local records,
audit fault injection, concurrent mutations, late receipt replay, immutable
history comparisons, exact decimal output, trusted HTTP principal injection and
a concurrent Configuration change during a repeatable-read snapshot.

## Remaining risks or decisions

No new product decision is required by these fixes. Human phase completion and
the exact `commit and push` workflow are separate. Existing local extras and
pre-existing Phase 8 Postman import fixes remain outside the intended Phase 9
publication scope. No staging, commit, push, merge, deployment or remote database
mutation occurred in this review.

## Final checks

All required gates passed: Phase 9 168 tests; full regression 1894 tests; five
guarded Phase 7 tests passed separately; both coverage scopes meet thresholds;
clean/upgrade live constraint proofs, build, lint, typecheck, schema, API, Postman
and docs checks passed. `implementation-evidence.md` contains the exact ledger.
Verdict: technically ready for the separately triggered Git workflow.
