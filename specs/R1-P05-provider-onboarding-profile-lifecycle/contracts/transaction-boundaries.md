# Transaction Boundaries

## Rule

The Provider application service that owns a workflow owns its transaction.
Transactions are short, database-focused, and contain no Cloudinary, SMTP,
password hashing, or other slow external I/O.

## Context

`PrismaProvidersUnitOfWork` provides transaction-scoped Provider repositories,
Authentication's `ProviderIdentityAuthorityWriter`, Admin's transactional audit
writer, and the Provider email-outbox repository. Infrastructure factories are
injected by composition.

The service sees business ports, not another module's Prisma delegates.

## Workflow matrix

| Workflow | Transaction owner | Locks / guards | Atomic writes | External work |
|---|---|---|---|---|
| Create application | Providers | unique application owner; current identity/profile recheck | Provider, empty profile/contact anchors, initial history/audit | none |
| Edit kind/profile/contact | Providers | Provider row + expectedVersion + editable policy | business rows, version, audit | active-country read occurs before TX and rechecked as needed |
| Submit/resubmit | Providers | Provider row; expectedVersion; all completion/media checks | status, incremented reviewCycle, history, audit, email intent | email after commit |
| Request changes/reject | Providers | pending Provider/current reviewCycle + expectedVersion + Staff permission | status, history, audit, email intent | email after commit |
| Approve | Providers | pending Provider/current reviewCycle + current eligibility | application/owner state, category/role, OWNER membership, history/audit/outbox | email after commit |
| Suspend/reinstate | Providers | approved Provider + expectedVersion + Staff permission | operational state/history/audit/outbox | email after commit |
| Invite/resend/revoke | Providers | approved Provider + OWNER membership + invitation CAS | verifier/version/status/audit | raw-token email once from memory after create/resend commit |
| Accept invitation | Providers | pending unexpired invitation + user/email proof | consume invite, ADMIN membership, role reconciliation, audit | none in TX |
| Disable ADMIN | Providers | OWNER + target membership + expectedVersion | membership status, global role reconciliation, audit | none |
| Media reserve/finalize | Providers | Provider row + expectedVersion + count/slot guards | media reservation then profile-slot/gallery-item reference/version/audit | Cloudinary between reserve and finalize |

## Approval transaction sequence

1. Authenticate and rate-limit before transaction.
2. Open Provider unit of work.
3. Lock Provider and verify `PENDING_REVIEW`, expected version, and no final
   history decision for the current `reviewCycle` counter.
4. Re-read current identity/category and matching customer profile facts.
5. Verify active Staff permission from transaction-safe grants.
6. Append the cycle's `APPROVED` history, set Provider application `APPROVED`,
   owner id and approved time, and increment version.
7. Authentication writer adds verified `PROVIDER_OWNER` and assigns/enables
   `provider_admin` idempotently.
8. Insert/confirm active OWNER membership.
9. Append application history and audit.
10. Insert idempotent approval email intent.
11. Commit. Any failure in steps 3–10 rolls back all effects.

Repeated approval returns the already-complete matching result only after all
components are verified present; an incomplete prior outcome is an integrity
error, not a silent success.

## Invitation acceptance transaction sequence

1. Token verifier, expiry/status/version, authenticated user state, and matching
   verified normalized email are checked.
2. Lock invitation and Provider; recheck approved state and token.
3. Create or reactivate exactly one ADMIN membership.
4. Count remaining active Provider authority and reconcile `provider_admin` to
   enabled.
5. Mark invitation accepted with actor/time/version.
6. Append audit.
7. Commit.

Concurrent accept/revoke/resend has one row-lock winner. Old token versions and
terminal invitations never grant authority.

## Invitation delivery boundary

Create/resend commits only the keyed verifier, token version, expiry, and audit.
After commit, the service sends the raw token exactly once from process memory.
The raw token never enters the durable email outbox, database payloads, logs,
audit, errors, or API responses. If SMTP fails, a short follow-up write stores
only `deliveryFailedAt` plus a safe error code and the API reports a resend-
required delivery state. OWNER resend rotates verifier/token/version/expiry;
there is no automatic retry of the same raw token.

## Media reservation and compensation

- Validate multipart byte limit/content signature before reservation.
- Lock Provider, verify write policy/version, count pending+READY items, reserve
  slot/capacity, increment version, then commit.
- Upload/process through Media/Cloudinary outside the DB transaction.
- Finalize with reservation id/version. Success assigns a READY slot/gallery reference; failure
  marks media pending delete and does not replace the previous READY logo/cover.
- Cleanup is bounded/idempotent. A cleanup failure never exposes the asset or
  changes completion.

## Review and operational email outbox

Application submission/review and operational lifecycle transactions write one
unique idempotency-keyed intent. The dispatcher
claims a bounded batch with a recoverable lease, resolves the authoritative
recipient, sends through `EmailPort`, and marks SENT or schedules retry with a
safe error code. Delays are 1 minute, 5 minutes, 30 minutes, 2 hours, and
12 hours; the fifth failure marks terminal `FAILED` for explicit operational
repair. Business decisions never roll back after commit because SMTP failed,
and SMTP is never called before commit. Invitation delivery is excluded and
follows the one-shot boundary above.

## Failure and audit invariants

- Required audit or review/operational outbox failure aborts the business write.
- Safe denial audit runs outside the business transaction only when no business
  mutation committed.
- No transaction retries an external side effect.
- No caller-provided actor, owner, member, status, role, category, completion,
  or readiness fact is trusted.
- All retries/concurrent races must prove row cardinality and component effects,
  not only HTTP status totals.
