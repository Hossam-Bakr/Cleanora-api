# R1-P07 Independent Review Resolution

Updated: 2026-08-24
Status: PASS — the accepted final read-only review has no unresolved BLOCKER or MAJOR; every applicable finding was independently remediated and regression-tested

Claude operated through the installed `claude-delegate` relay in read-only mode. Codex remained the only implementation writer and independently classified every returned finding.

## Checkpoint B — Worker and invitation flows

Claude session: `d0dc1672-7174-4535-84f1-0c46907b573b`
Completed report artifact: `C:\Users\ALYOSER\AppData\Local\Temp\delegate-relay\Cleanora_R1-2026-08-23T16-21-33-496Z-4644\result.json`
Relay result: exit 0, result subtype `success`, one report-only resume turn, `readOnlyViolation: false`

| Finding | Claude final disposition | Codex disposition/resolution |
|---|---|---|
| F-01 proof verification/recheck ordering | RESOLVED | Accepted. Verification is outside Providers UoW; exact consumed-proof recheck follows the replay short-circuit. |
| F-02 actor-bound idempotency | RESOLVED | Accepted. Same key/fingerprint with another actor conflicts; replay returns accepted safe JSON only. |
| F-03 superseded invitation history | RESOLVED | Accepted. Resend writes a separate prior-version `SUPERSEDED` history row plus replacement/access truths. |
| F-04 due acceptance expiry | RESOLVED | Accepted. Exact due invitation/access expire atomically in a completed UoW before generic acceptance rejection; no identity/role/notification effects. |
| F-05 existing `AUTH_VERIFIER_SECRET` | RESOLVED, finding withdrawn | Rejected original finding. `plan.md` explicitly requires domain-separated reuse and no new secret. |
| M-1 unverified routing may trigger due settlement | MINOR | Rejected as invalid. Routing cannot select an ineligible row: stored ID/version/latest status/expiry/access are locked and rechecked, and FR-013 requires an outstanding invitation to expire after 72 hours. No premature or cross-invitation transition is possible. |
| M-2 presenting principal is expiry-history actor | MINOR | Rejected as invalid. The presenting principal caused the lazy settlement; `actorUserId` is a required User FK and no system actor is approved. Event code/before/after state preserve that the transition reason is time expiry. |
| M-3 ISSUE relies on rollback after supersede | MINOR | Valid hardening. Codex moved existing-access CAS validation before the pending-invitation supersede write and added a regression assertion that supersede is not called on the conflict. |
| M-4 ordering/commit assertions incomplete | MINOR | Partially valid. Codex added a UoW spy proving invalid recent proof rejects before UoW entry, and a completed-UoW marker proving expiry settlement finishes before the outer generic acceptance rejection. |

Regression evidence after M-3/M-4 remediation:

```text
> npx vitest run tests/integration/providers/r1-p07-workforce-repository.test.ts tests/integration/providers/provider-worker-invitation-issue.test.ts tests/integration/providers/provider-worker-invitation-acceptance-expiry.test.ts
Test Files  3 passed (3)
Tests       16 passed (16)

> npm run typecheck
exit 0

> npm run lint
exit 0

> npm run test:r1-p07
Test Files  76 passed | 3 skipped (79)
Tests       324 passed | 5 skipped (329)
```

A final B delta resume was attempted but produced no event beyond Claude initialization and was interrupted after five minutes. The same changed lines must be included in Checkpoint D; no B BLOCKER or MAJOR remains.

## Checkpoint C — Team, Supervisor, Escort, and readiness

Initial Claude session: `8e488331-47ba-43dc-9ff7-c4a588e31b78`
Initial report artifact: `C:\Users\ALYOSER\AppData\Local\Temp\delegate-relay\Cleanora_R1-2026-08-23T13-11-19-111Z-17940\result.json`
Delta report artifact: `C:\Users\ALYOSER\AppData\Local\Temp\delegate-relay\Cleanora_R1-2026-08-23T14-42-22-830Z-1396\result.json`

Valid findings remediated by Codex:

- lifecycle/self-leave/profile-reclassification now lock the current Team and re-read/lock membership before Team-impact decisions;
- primary-Supervisor assignment no longer requires a pre-existing Authentication identity, while role projection reconciles when an identity exists or is later accepted;
- MOVE validates locked target Team/version/archive state before the source membership write;
- readiness authorization and derivation now share one locked Providers UoW;
- Prisma error mapping recognizes safe concurrency and known SQLSTATEs without exposing raw database text;
- unused qualifying-worker repository surface was removed;
- explicit Owner/Admin management guards were added;
- clean-proof constraint probes now require the exact SQLSTATE and isolate duplicate-identity uniqueness with a valid profile fixture.

Rejected C findings:

- authorization-policy branches were not dead behavior: Provider membership and dynamic primary-Supervisor Team facts require distinct repository-backed decisions;
- adding target Team to the idempotency scope was unnecessary because the target and version are in the fingerprint, so reuse with another target conflicts;
- live constraint execution is implemented in the clean migration proof; it was pending at Checkpoint C and subsequently passed on the isolated R1-P07 target.

C delta conclusion: no unresolved BLOCKER or MAJOR. The two final new MINOR items (exact SQLSTATE proof and explicit management level) were fixed and passed five focused files / 27 tests plus typecheck/lint. They remain in the mandatory final review delta because the subsequent report-only resume timed out.

## Checkpoint A — Foundations, schema, migration, contracts

No Checkpoint A attempt is counted as a passed report:

- session `475f536b-8420-4c5c-8d09-0ff50431dff0` performed 24 read-only turns, then returned DNS `ENOTFOUND`; artifact `...\Cleanora_R1-2026-08-23T14-57-09-271Z-12220\result.json`, `readOnlyViolation: false`;
- SQL-only session `6030630f-178c-49eb-9c32-853bd364d27a` completed the requested reads but stopped producing events before a final report; no result artifact was produced after interruption;
- contracts/UoW session `a782afcf-9de2-4cb2-a7f0-a8d316596116` completed 23 read-only turns, then the gateway returned a malformed HTTP-200 body after stream idle timeout; `readOnlyViolation: false`;
- report-only resumes of the affected A sessions reached initialization but returned no model message and were stopped without writes.

Codex's manual/static SQL and boundary evidence is recorded separately, but it does not replace the required successful independent A report.

## Checkpoint D — final independent review

PASS. Claude's final full-diff report returned no unresolved BLOCKER or MAJOR.
Codex independently inspected every finding, remediated each applicable MINOR,
added focused regression evidence, and rejected invalid or already-covered
claims with repository/specification proof. The final migration, database,
phase, integration, and global-coverage runs subsequently passed with no skip.

The earlier Checkpoint A relay failures remain historical tooling evidence and
are not misreported as successful standalone reports. Their intended schema,
migration, public-contract, UoW, and foundation scope is covered by the accepted
final full-diff review plus the manual/live SQL and boundary evidence.

Phase completion is separately authorized by the owner's 2026-08-24 instruction
to complete R1-P07 and mark it completed. Git publication, deployment, and
production migration remain unauthorized.

## Final Claude review delta — 2026-08-24

Claude's final independent report returned no unresolved BLOCKER or MAJOR. The
following MINOR findings were independently validated and remediated:

- private workforce responses now consistently emit `no-store, private`;
- the runtime OpenAPI fragment builder validates private response descriptions
  and the `no-store, private` header contract, with a focused assertion;
- login-access RESET and Supervisor ASSIGN schemas require non-null versions,
  so malformed requests are rejected at the boundary rather than converted to
  state conflicts;
- invitation history uses the locked invitation identifier instead of a
  placeholder literal;
- lifecycle commands evaluate the shared authorization policy, including an
  explicit Owner-only `REMOVE_WORKER` capability;
- the future phase migration aligns its phone constraint with the application
  and checks active normalized Team names in its companion invariant trigger.

The task-marker/current-pointer observation remains a final evidence-gate
reconciliation: T001–T156 will be marked only after all required evidence,
including authorized PostgreSQL proofs, exists. Claude's implementation-
authorization question is rejected with evidence from the current user task,
which explicitly authorizes completion of R1-P07 implementation; the original
activation's pre-implementation stop text is stale and will be reconciled in
the final evidence update. The denial-code question is covered by the phase
error catalog and cross-Provider tests. An explicit unknown-key negative
assertion is now present in the focused schema suite.

The migration and trigger edits are only in the not-yet-applied,
phase-owned migration; no applied migration was edited. Live SQL behavior
was subsequently proved by the clean-install and populated-upgrade runs recorded
in `migration-evidence.md`.

## Post-review database and tooling delta

The live proof exposed three tooling/fixture issues rather than new product
findings: the affected-Team trigger's table-specific `OLD` field access, Prisma
7 DriverAdapter SQLSTATE extraction, and stale R1-P05/R1-P06 proof fixtures.
Codex fixed them narrowly, added unit regressions, and then ran the final
database/phase/integration/global coverage gates. The new repository tests close
real inherited global-coverage gaps without changing thresholds or exclusions.
No new application capability or architecture boundary was introduced after
the accepted review.
