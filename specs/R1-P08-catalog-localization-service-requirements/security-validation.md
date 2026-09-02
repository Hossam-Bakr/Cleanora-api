# R1-P08 Security, Privacy, and Redaction Validation

Validation date: 2026-09-01  
Result: PASS — static, runtime, database-backed authorization, idempotency, Media boundary, and redaction gates complete

## Validated behavior

- active `staff_admin`-only `catalog.management.read` and
  `catalog.management.write`; deny-by-default for all other staff, provider,
  worker, and customer roles;
- every privileged Catalog write requires a valid privileged reason and
  records before/after audit evidence;
- actor-bound idempotency with fingerprint conflict detection and safe replay
  JSON only for matching actor/fingerprint;
- exact-locale selectable reads with no inactive-draft leakage and no
  anonymous/customer Browse HTTP;
- Media-owned Catalog service-image ingest, receipt identity, short-lived
  protected delivery, and detach-without-file-delete boundary;
- safe management DTOs and logs with no storage keys, delivery URLs, uploader
  payloads, idempotency secrets, or provider/wallet/booking facts;
- no Cleanora stored-value wallet, Booking mutation, or
  `booking_snapshots` behavior introduced.

## Commands actually run

```text
> npx vitest run tests/unit/modules/authentication/authorization-staff-separation.test.ts tests/unit/modules/authentication/authorization-catalog.test.ts tests/unit/catalog/catalog-idempotency.policy.test.ts tests/unit/catalog/catalog-output-redaction.test.ts tests/unit/catalog/catalog-media.policy.test.ts tests/integration/http/catalog-management-taxonomy.test.ts tests/integration/http/catalog-availability-lifecycle.test.ts tests/integration/catalog/catalog-selectable-definition.test.ts tests/integration/catalog/catalog-snapshot-boundary.test.ts
Test Files  passed
Tests       passed
```

Runtime tests serialize response, audit, command-result, and captured-log values
and fail on synthetic storage keys, delivery URLs, idempotency keys, and
forbidden Browse paths. Media and Cloudinary behavior uses fakes in unit tests;
live database proofs used disposable phase-named targets only.

## Database-backed result

The clean/populated migration proofs and the complete R1-P08 phase suite passed
on fresh phase-named disposable targets. The repository `.env` database,
production, remote resources, and older-phase databases were not used or
changed.

No secret, full database URL, credential, OTP, cookie, private storage key, or
raw DriverAdapter error is present in the recorded evidence. Phase coverage
remained above unchanged thresholds.
