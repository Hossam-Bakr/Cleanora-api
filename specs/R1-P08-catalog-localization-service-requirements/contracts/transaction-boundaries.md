# R1-P08 Transaction Boundaries

## Ownership rule

`CatalogService` coordinates use cases. `PrismaCatalogRepository` owns Catalog
transactions and Catalog persistence. Composition supplies transaction-bound
Configuration, Media, Authentication, and Admin adapters without exposing their
infrastructure inside Catalog application/domain files.

## Ordinary mutation transaction

Applies to category/service create/update/lifecycle/order, service configuration
replacement, and service-media reorder/remove.

```text
trusted principal + validated command
  -> pre-authorize catalog.management.write and validate reason
  -> begin Catalog transaction
     -> advisory-lock idempotency scope/key
     -> replay same hash OR reject different hash
     -> lock category/service aggregates in stable ID order
     -> re-authorize against current Authentication facts
     -> assert exact expected version(s)
     -> resolve current Country/Media facts through transaction-bound ports
     -> validate complete proposed aggregate
     -> persist business rows and aggregate version(s)
     -> append one Admin privileged audit row
     -> persist COMPLETED command receipt
  -> commit
  -> return command receipt / refetchable management DTO
```

Catalog truth, version, success audit, and completed receipt are one atomic
commit. No external I/O occurs inside this transaction.

## Category command propagation

Category content/lifecycle/order may change service definitions.

1. Lock the category.
2. Lock all current child services by ascending ID.
3. Check category expected version; for category-order replacement check every
   supplied category version after locking all categories by ID.
4. Apply category change/order.
5. Increment category version once.
6. Increment each affected child service version once.
7. Write one aggregate-level audit record with safe counts/version facts.

Do not flip child service `isActive` during category deactivation. Selectable
queries require both category and service active; reactivation therefore
restores only still-valid child services without rewriting their lifecycle.

## Service configuration replacement

The PUT represents one proposed aggregate graph.

1. Validate request shape and kind compatibility before transaction.
2. Lock service and parent category.
3. Recheck authority/version and resolve every requested country.
4. Build/validate the complete proposed translations, units, fields/options,
   and availability in memory.
5. Replace children in deterministic groups. Stable codes always preserve
   existing child IDs. Omitted price units, fields, options, and country rows
   are retained and made inactive/unavailable; they are never hard-deleted.
   Missing translation locales are retained with nullable draft content.
6. Re-read/assert the resulting active aggregate.
7. Increment service once, audit once, complete receipt once.

There is never an intermediate externally visible partially replaced graph.
No stable category, service, price-unit, field, or option identity is
hard-deleted. Removing a service-media association is the intentional exception;
it never deletes the Media file.

## Service image upload orchestration

Binary Media I/O cannot share a long Catalog database transaction.

### Reserve

Short Catalog transaction:

1. authorize/validate reason;
2. advisory-lock idempotency scope/key;
3. if `COMPLETED` with same hash, return prior receipt;
4. if `PENDING` with same hash, reuse `reservedMediaFileId`;
5. if same key/different hash, conflict;
6. otherwise create `PENDING` receipt with a generated stable Media ID;
7. commit without changing service/version/audit.

### Ingest

Call `CatalogServiceImagePort.ingest` outside Catalog transaction using the
reserved Media ID and trusted uploader. Media normalizes/stores the image and
returns a safe receipt. A retry with the same ID is idempotent.

### Finalize

Catalog transaction:

1. lock command receipt, service, and current media associations;
2. re-authorize, revalidate reason, and assert expected service version;
3. use the transaction-bound Media authorizer to prove the reserved ID is READY,
   the correct owner type, and tied to the trusted uploader;
4. insert association at deterministic final position;
5. increment service version;
6. append privileged audit;
7. mark receipt `COMPLETED` with target and accepted version;
8. commit.

### Compensate

If ingest or finalization fails, no association/version/success audit commits.
Request Media cleanup using the reserved media ID. A process crash leaves a
PENDING receipt that a same-payload retry can resume. Pending receipt expiry or
batch cleanup may be added only if implementation proves an immediate need;
R1-P08 does not introduce a background worker.

## Media delivery read

1. Read one selectable service definition in a read-only/repeatable snapshot.
2. Return only READY stable Media references from the transaction-bound reader.
3. After the database snapshot closes, request short-lived delivery URLs from
   Media for HTTP presentation.
4. If URL issuance fails, return safe dependency failure or omit the individual
   presentation according to the OpenAPI contract; never expose a storage key.

The internal snapshot-ready contract contains stable Media references, not
ephemeral URLs.

## Seed transaction

Resolve authoritative `EG`, then create-if-missing stable records in one Catalog
transaction. Existing records take empty update branches. A failed seed changes
no partial Catalog graph. The seed does not write privileged staff audit because
the actor is the controlled system seed path; its evidence is migration/seed
validation, not a forged user actor.

## Isolation and lock order

- Use PostgreSQL transactions at the repository's established isolation level;
  use repeatable-read/serializable behavior or explicit row/advisory locks where
  the invariant requires it.
- Lock order: idempotency advisory identity → categories ascending → services
  ascending → translations → units → fields → options → availability → media
  associations → audit/receipt inserts.
- Never hold a transaction across Cloudinary/Sharp work, network calls, or
  signed URL creation.
- Never call another module's repository directly.

## Failure semantics

| Failure | HTTP/internal outcome | Committed effect |
|---|---|---|
| Authentication missing | 401 | None |
| Permission/account denied | 403 safe denial | No Catalog success effect |
| Validation/localization/kind invalid | 400 stable code | None |
| Target unavailable to protected actor | 404 safe code when appropriate | None |
| Expected version stale | 409 `CATALOG_VERSION_CONFLICT` | None |
| Idempotency key reused with different payload | 409 `CATALOG_IDEMPOTENCY_CONFLICT` | None |
| Same completed command replayed | Original receipt / 200 family | No second effect/audit/version |
| Country unavailable | 400 `CATALOG_COUNTRY_UNAVAILABLE` | None |
| Media invalid/not READY | 400 `CATALOG_MEDIA_INVALID` | No association; cleanup when owned reservation exists |
| Media provider unavailable | 503 `CATALOG_MEDIA_UNAVAILABLE` | No association/version/audit |
| Audit persistence fails | Safe 500 | Entire Catalog transaction rolls back |
| Unexpected persistence failure | Safe 500 | Entire transaction rolls back; no raw detail |
