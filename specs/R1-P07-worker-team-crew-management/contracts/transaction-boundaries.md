# R1-P07 Transaction Boundaries

## Transaction owner

`ProviderWorkforceService` owns every workforce command and runs it through
`PrismaProvidersWorkforceUnitOfWork`. The unit of work receives the same Prisma
transaction client in Providers repositories and injected transaction-bound
Authentication, Media, and Admin public writers. No participating public writer
may open a nested transaction.

## Standard command algorithm

1. Validate Zod input without logging sensitive values.
2. For high-risk commands, verify current-session proof outside the transaction
   and receive an opaque consumed `proofId`.
3. Begin Providers transaction.
4. Acquire/lock the idempotency scope. If accepted fingerprint matches, return
   stored safe result. If the key exists with another fingerprint, conflict.
5. Lock Provider and active exact actor membership; re-authorize.
6. Lock target Worker/Team aggregates and all affected rows in fixed order.
7. Recheck `expectedVersion`, lifecycle, scope, reason/note, Escort,
   primary-Supervisor, final-cleaner, and readiness invariants.
8. Recheck consumed recent-auth proof transactionally when applicable.
9. Apply business rows and Authentication role projection through the
   transaction-bound public writer.
10. Append one safe history row per changed truth and required transactional
    audit.
11. Insert idempotent localized notification intents.
12. Store the safe accepted idempotency result and commit.
13. Dispatch email asynchronously outside the transaction.

Any failure through step 12 rolls back all accepted-state effects. External
failure after commit changes delivery state only.

## Fixed lock order

1. Advisory/idempotency key scoped by command family and aggregate.
2. Provider row, then exact actor `provider_members` row.
3. Worker rows sorted by Worker ID; for each: engagement → profile → access →
   invitations sorted by version.
4. Team rows sorted by Team ID.
5. Team memberships sorted by membership ID.
6. Provider-membership rows whose Admin authority is changing, sorted by user
   ID.
7. Transaction-bound Authentication role/proof rows using Authentication's
   documented internal order.
8. History, audit, command-result, and outbox inserts.

No command may reverse this ordering. A Prisma transaction timeout/contention
maps to a safe `WORKFORCE_STATE_CONFLICT` with no automatic semantic retry. The
client may retry with the same idempotency key.

## Command-specific atomic sets

### Create profile

Provider Worker + profile + idempotency result + safe history/audit. No User is
required. A duplicate accepted request replays; another Provider identity claim
is evaluated only when an Authentication identity becomes known.

### Issue/resend/revoke/reset access

Worker/access/invitation versions + transaction-bound proof recheck + history +
audit + locale-bound notification intent. Resend supersedes every older pending
version before inserting the replacement. The outbox stores no link/token.

### Accept invitation

Latest invitation terminal outcome + Worker identity claim + access `ACTIVE` +
Authentication Worker-role reconciliation + accepted locale fallback + profile
phone review/correction + history/audit/idempotency. Cross-Provider current
identity uniqueness wins once; loser conflicts with zero partial state.

### Worker deactivation/removal/self-leave

Worker lifecycle + invalid primary-Supervisor clear + membership end where
applicable + login-access revoke + role reconciliation + each affected Team
transition + readiness-visible source facts + separate history rows + audit +
notification intents. Removal uses recent auth, removal catalog, and note;
self-leave uses exact self identity and does not disable the shared User.

### Admin grant/revoke

Versioned `provider_members` change + Authentication Provider-Admin role
reconciliation + history/audit/outbox/idempotency. Worker status is unchanged.
Role reconciliation considers all active explicit Admin memberships before
disabling the global role.

### Team membership change

Affected Team(s), membership(s), Worker profile/type, Supervisor assignment,
valid-cleaner count, Team lifecycle consequence, history/audit/idempotency. Move
ends old and creates new membership in one transaction.

If a primary Supervisor requests `cleans=false` for the active Team's final
valid cleaner, authorization returns `WORKFORCE_FINAL_CLEANER_CONFLICT` before
any write. Owner/Admin must submit the exact versions plus
`confirmLastCleanerImpact=true`; accepted command changes `cleans` and Team to
`INACTIVE` atomically.

### Worker type change to Escort

Lock profile and current membership. If current `cleans=true`, reject before
write. The client must first perform an explicit allowed membership change; if
that is the final cleaner, the Owner/Admin confirmation flow applies.

### Team archive

Team `INACTIVE→ARCHIVED` + end every current membership + clear primary
Supervisor + role reconciliation if necessary + separate history/audit rows +
idempotency. Worker lifecycle is unchanged.

### Avatar association

Cloudinary/Sharp work is completed by Media before the transaction. Providers
then locks Worker/profile, authorizes purpose, validates the exact READY receipt
through Media's transaction-bound reader, and swaps `avatarMediaFileId` by CAS
with safe history/audit/idempotency. Cleanup of replaced/unbound media is
requested after commit and is retryable; storage key is never returned.

## Read transactions

- Provider lists and history use bounded cursor pagination and exact membership
  authorization.
- Supervisor reads join the current primary-Supervisor assignment and current
  membership inside the query; losing assignment immediately removes scope.
- Full-phone reads use separate role-specific mappers and `Cache-Control:
  no-store, private`.
- Worker self reads resolve current engagement by trusted principal ID.
- `workersReady` is derived from current locked/consistent source facts and is
  not a writable row.

## Side-effect failure semantics

| Side effect | Timing | Failure outcome |
|---|---|---|
| SMTP send | After commit | Intent remains/re-enters retry state; truth unchanged |
| Avatar upload/process | Before association transaction | No profile change; media cleanup policy handles orphan |
| Signed avatar delivery | After authorization read | Safe dependency error; no business state change |
| Denied-command audit | Separate safe path | Never converts denial to acceptance; failure is logged safely |
| Transactional accepted audit | Before commit | Audit failure rolls back privileged business change |
| Postman/OpenAPI generation | Build-time | Validation fails; runtime state unaffected |

## Version ownership

- Worker engagement version: lifecycle/identity-link changes.
- Worker profile version: profile, type, skill-set, Supervisor capability,
  avatar association.
- Login-access version: access projection commands.
- Invitation version and row version: issued sequence and terminal CAS.
- Team version: name/lifecycle/Supervisor and invariant-affecting changes.
- Membership version: `cleans`/end changes.
- ProviderMember version: Admin grant/revoke.
- Provider workforce-state version: CAS anchor for inserting a new Worker or
  Team when the target aggregate does not exist yet.

Commands include every aggregate version they may mutate. Missing affected
versions is validation failure; stale values are 409. A command never silently
upgrades an expected version from a prior read.

For access issuance before an access row exists, `expectedVersion` is the Worker
engagement version and `expectedAccessVersion` is null. Once access exists, both
versions are supplied. Invitation acceptance supplies exact invitation, Worker,
and access versions returned by inspection. Admin grant against a missing
membership uses null `expectedMembershipVersion`; revocation supplies it.
