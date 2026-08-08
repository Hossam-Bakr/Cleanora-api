# Transaction Boundaries — R1-P04

## Rule

Every R1-P04 business workflow has exactly one transaction owner: **customers**.

Other modules participate only through explicit ports wired in `composition.ts`.
No cross-module repository imports. Customers never imports Admin Prisma
infrastructure.

## Admin audit writers (composition-injected)

| Writer | Use |
|---|---|
| Admin **general** transactional audit writer | Ordinary FR-033 mutations (profile, image association, preferences, addresses, privacy submit/cancel, processor claim/resolve). Suitable for non-privileged, reasonless mutations. **Do not** reuse the privileged reason-bound writer unchanged for these. |
| Admin **privileged** transactional audit writer | Privileged reassignment only; requires approved reason `privacy_request_reassign` |
| Admin safe **non-transactional** audit writer | Security-relevant denials when no business mutation is being committed |

**Invariant:** Audit append failure rolls back every required business mutation
in the customers transaction.

Filesystem I/O remains outside the DB transaction with compensating media
cleanup.

## Units of work

### Profile text upsert

```text
customers transaction:
  authorize category-profile family
  upsert category profile row
  ensure customer_profiles anchor exists
  Admin general transactional audit.append(...)
commit  # audit failure aborts mutation
```

### Profile image replace

```text
authorize shared-image family
media.storeProfileImage -> StoredMediaReference
  # outside DB TX; Sharp WebP; Cloudinary authenticated upload; opaque public_id
customers transaction:
  CAS image_association_version + set profile_image_media_file_id
  Admin general transactional audit.append(...)
commit
on association/audit failure: media.markPendingDelete(new); keep old association
on success replacing old: media.markPendingDelete(old)
losing concurrent CAS: markPendingDelete(new); prior association remains
signed delivery URL generated after successful association (never inside TX)
```

### Preferences / addresses

```text
customers transaction:
  authorize family
  preferences (DEC-032): reject omitted fields; require version + language
    (AR|EN|null) + all four reminders/promotional booleans; full replace only
  require current version; on success version = version + 1
  mutate fields (addresses: resolve countryCode -> country_id)
  Admin general transactional audit.append(...)
commit  # audit failure aborts mutation; stale version -> conflict, prior state kept
```

### Privacy submit (idempotent active)

```text
customers transaction:
  authorize contact/privacy family
  find active (user_id, purpose) via partial unique semantics
  if present -> return existing
  else insert PENDING + Admin general transactional audit
commit
```

### Privacy cancel

```text
customers transaction:
  load owned PENDING request   # cancel only from PENDING; never after claim
  set CANCELLED + cancelled_at + terminal_at
       + purge_after = terminal_at + PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS
  keep processor_id NULL and processing_at NULL
  Admin general transactional audit
commit
# DB CANCELLED CHECK: cancelled_at/terminal_at/purge_after NOT NULL;
# outcome_code/processor_id/processing_at IS NULL
```

### Processor claim

```text
customers transaction:
  require capability privacy.requests.process
  UPDATE ... WHERE id=? AND status='PENDING' RETURNING
  if none: same-claimant PROCESSING -> idempotent; else conflict
  Admin general transactional audit
commit
```

### Processor resolve

```text
customers transaction:
  require capability privacy.requests.process
  validate CLOSED outcome pair only:
    COMPLETED + REQUEST_FULFILLED | REJECTED + REQUEST_REJECTED
  UPDATE claimant PROCESSING row; set terminal fields + purge_after
  Admin general transactional audit
commit  # illegal pair -> no change
```

### Privileged reassign

```text
customers transaction:
  authorize staff_admin + privacy.requests.reassign + privacy_request_reassign
  UPDATE PROCESSING row set processor_id/processing_at
  Admin privileged transactional audit (before/after)
commit (audit failure rolls back mutation)
```

## Retention sweep (outside request TX)

```text
customers bounded delete:
  DELETE FROM privacy_requests
  WHERE status IN ('COMPLETED','REJECTED','CANCELLED')
    AND purge_after <= now()
  LIMIT <documented_small_batch>
run at customers startup and once per hour; idempotent; concurrent-safe
never deletes active requests or audit_logs
```

## Forbidden patterns

- Authentication writing customer tables
- customers writing `users` identity/verification fields
- Direct Prisma access to another module's tables from outside the owner
- Processor bypassing this contract to edit `privacy_requests`
- Reusing privileged audit writer for ordinary reasonless mutations
- Silent partial preference merges or omit-as-default preference PUT behavior
- Returning storage keys or public media URLs
