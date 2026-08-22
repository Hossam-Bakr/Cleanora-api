# Migration Plan — R1-P06

**Implementation status**: the additive Prisma schema and R1-P06 migration are implemented and validated. After explicit human approval, the clean-apply and populated R1-P05-to-R1-P06 upgrade validators both passed against the isolated local database `cleanora_r1_p06_local_proof` on the temporary `127.0.0.1:55432` server. The successful clean schema `cleanora_r1_p06_proof_14416_1786669436430` and upgrade schema `cleanora_r1_p06_upgrade_proof_10676_1786669463156` each contain 57 expected tables and exactly 13 successful migrations. The temporary server was stopped and its proof files retained. No shared, installed-service, production, or deployment database was changed.

## Boundary

The implementation adds one forward-only migration after the R1-P05 migration:

`prisma/migrations/r1_p06_provider_verification_external_payout_destinations/migration.sql`

All 12 existing migration files remain immutable. If PostgreSQL same-transaction enum visibility prevents safe use of an added enum label, implementation may use `::text` in checks as R1-P05 does; only if that is insufficient may the phase use a second clearly named R1-P06 forward migration, documented before application.

## Ordered SQL Work

1. Create R1-P06 enums and add approved values to `MediaOwnerType` and `ProviderEmailTemplate`.
2. Create Providers-owned document type/policy/item tables.
3. Create document chain/version/evidence/review/history tables.
4. Create payout type/country-policy/operator/bank tables.
5. Create payout chain/identity-claim/fingerprint/version/decision/primary/conflict/history/key-rotation tables.
6. Create a Media-owned evidence-validation receipt table if safe receipt facts cannot be represented without weakening Media ownership.
7. Create an Admin-owned payout-reveal attempt/rate-gate table if the generic audit table cannot provide actor-serialized audit-before-return semantics.
8. Add nullable R1-P06 history references to the existing Provider email outbox.
9. Add indexes and unique/partial unique indexes.
10. Add FKs with reviewed `ON DELETE RESTRICT` behavior.
11. Add positive-version, nonblank-reason, lifecycle/timestamp, type-shape, encryption-envelope, one-source outbox, and allowed-status checks.
12. Add comments documenting that full payout plaintext and key material have no persistence column.

The detailed model and invariants are in [data-model.md](./data-model.md).

## Database-Enforced Invariants

- one Provider document chain per Provider/document type;
- linear document and payout predecessor relationships;
- at most one open successor per chain;
- one current effective document version pointer per chain;
- one primary payout state row per Provider and one referenced destination version;
- at most five active payout chain slots per Provider through partial unique `(provider_id, active_slot)` where slots are `1..5`;
- one fingerprint for each claim/key ID;
- global unique active `(lookup_key_id, fingerprint)` claim across Providers;
- one open safe conflict case per candidate claim;
- unique operation/idempotency keys for decisions, transitions, history, outbox, reveal grants, and rotation runs;
- exactly one type-specific registry shape per payout version;
- nonempty ciphertext, 12-byte nonce, 16-byte tag, and nonempty key IDs for both protected fields;
- no cascade or ordinary hard deletion across immutable evidence/history.

Cross-row conditions that SQL FKs cannot fully express—same-Provider primary, current approved status, five-chain counting if slots are not used, restoration eligibility, and current policy resolution—are rechecked while holding stable-order row locks and proved by concurrency tests.

## Existing Schema Compatibility

- Existing Providers gain no required column and need no row backfill.
- Existing Provider outbox rows keep their current `statusHistoryId` relationship and satisfy the new one-source shape.
- Existing Media rows do not require validation receipts; only the new evidence owner type requires a successful receipt before READY/submission credit.
- Historical `AccountCategory.PROVIDER_OWNER` is not removed and is not used as R1-P06 Provider authority.
- Customers-owned company registration/tax fields are not reused as R1-P06 document versions.
- `Country.defaultCurrency` is not treated as the payout currency policy.

## Seed and Operational Data

Idempotent repository seed/bootstrap changes may add only:

- document type codes `COMMERCIAL_REGISTRATION`, `TAX_REGISTRATION`;
- payout type codes `MOBILE_WALLET`, `BANK_ACCOUNT`;
- finalized R1-P06 Staff permission catalog entries and role mappings.

The initial owner-approved `EG`/`REGISTERED_COMPANY` policy is bootstrapped
idempotently through the same Providers policy service and must receive an
explicit active Staff actor ID, meaningful publication reason, and effective
time from the human-invoked operation. This establishes both approved required
types without fabricating publication provenance in migration SQL or an
unattended seed. Do not seed guessed Egyptian operators/banks, cryptographic
keys, production evidence, reveal rows, or rotation rows. The EG/EGP payout
policy and operator/bank registries require truthful operational workflows and
an approved source manifest before launch.

## Implemented Validator Changes

`scripts/validate-clean-migration.ts` now asserts:

- expected migration names and chronological order;
- expected/migration-owned/post-deploy table inventories;
- exact R1-P06 SQL assertions;
- prohibition of plaintext payout/key columns;
- live probes for lifecycle shapes, five slots, one primary, one successor, active fingerprint uniqueness, type shapes, envelope lengths, operation idempotency, and reveal serialization;
- seed definition count/idempotency checks.

`scripts/validate-r1-p06-upgrade.ts` additionally creates an isolated schema,
deploys only the exact chronological R1-P01-through-R1-P05 baseline, inserts a
populated approved Provider/Owner/profile fixture, deploys R1-P06, proves the
fixture and migration history are preserved, and then runs the same post-deploy
seed/idempotency and live-constraint probes. Both validators reject any target
whose database name is not explicitly marked `r1_p06`/`r1-p06` before opening a
connection.

## Validation Sequence

The sequence below was completed against the exact human-approved disposable
R1-P06 target; it remains the required sequence for any future isolated proof:

1. review generated SQL line by line;
2. `npm run prisma:validate`;
3. `npm run prisma:generate`;
4. static guard against unexplained `DROP TABLE`, `TRUNCATE`, `DELETE`, cascade delete, plaintext payout columns, or key-material columns;
5. apply all migrations chronologically to an explicitly disposable clean database through `npm run db:validate-clean-migration`;
6. upgrade a populated disposable R1-P05-compatible schema through `npm run db:validate-r1-p06-upgrade`;
7. run the validators' live constraint and reveal-serialization probes plus the focused rotation/concurrency suites;
8. run full repository quality gates.

Database-backed suites run sequentially unless each worker has a genuinely isolated database.

## Rollback and Forward Fix

Before any R1-P06 write, application rollback may leave unused additive schema in place. After any R1-P06 write, retain all tables/evidence and correct defects with a new forward migration; do not drop immutable history. During key rotation, pause/resume and retain old decrypt/compare keys. Rollback never means retiring/deleting an old key, resetting the database, or editing an applied migration.

## Pre-Application Human Gate

The already-completed disposable local proof was authorized only for the exact isolated target recorded above. Any application to another environment remains separately authorized. Before such an environment is changed, a human must approve the SQL review, exact target database, backup/recovery posture, operator/bank manifest, policy publication procedure, and key-ring operational readiness. Production migration/deployment is outside R1-P06 planning and implementation authorization.
