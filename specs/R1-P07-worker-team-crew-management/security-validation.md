# R1-P07 Security, Privacy, and Redaction Validation

Validation date: 2026-08-24
Result: PASS — static, runtime, database-backed privacy, authorization, concurrency, and redaction gates complete

## Validated behavior

- exact-Provider Owner/Admin authorization and deny-by-default Supervisor/self/customer/cross-Provider behavior;
- operational-phone projection only to self, exact Owner/Admin, or the current primary Supervisor's current Team scope;
- immediate scope loss after Supervisor or membership loss;
- private avatar receipt/authorization/signed delivery and no storage-key projection;
- recent-authentication purpose, actor, Provider, Worker, request, age, and one-use checks;
- invitation proof domain separation, constant-time invalid result, version/expiry handling, and URL/log redaction;
- allowlisted history, audit, command-result, outbox, and error facts;
- logger recursion/circular handling and redaction of phone/proof/password/OTP/token/cookie/credential/storage-key names;
- cross-Provider non-enumeration and private `Cache-Control: no-store` responses;
- SMTP failure after commit leaves accepted truth unchanged and retains a retryable intent.

## Commands actually run

```text
> npx vitest run tests/unit/providers/provider-workforce-authorization.policy.test.ts tests/unit/providers/provider-workforce-logging.test.ts tests/unit/providers/worker-invitation-proof.test.ts tests/unit/providers/us8-sensitive-projections.test.ts tests/unit/modules/admin/privileged-audit-redaction.test.ts tests/integration/logging.test.ts tests/integration/media/provider-worker-avatar.test.ts tests/integration/http/provider-workforce-cross-provider.test.ts tests/integration/authentication/worker-sensitive-action-proof.test.ts tests/integration/providers/provider-worker-phone-privacy.test.ts tests/integration/providers/provider-workforce-sensitive-output.test.ts
Test Files  11 passed (11)
Tests       62 passed (62)

> PowerShell R1-P07 source sentinel/storage-key scan
{"r1P07ProviderMediaAdminSyntheticSentinelFiles":0,"workforceApplicationStorageKeyMatches":0}
```

The runtime tests serialize response, history, audit, outbox, error, and captured-log values and fail on the synthetic full phone, invitation proof, password, OTP, and private storage key. SMTP and Cloudinary behavior uses fakes; no real external resource was mutated.

## Database-backed result

The clean/populated migration proofs, all three formerly guarded database test
files, the complete 149-file/497-test integration suite, and the full
336-file/1,405-test repository coverage run passed sequentially on fresh
phase-named disposable targets. The repository `.env` database, production,
remote resources, and older-phase databases were not used or changed.

No secret, full database URL, operational phone, invitation proof, credential,
OTP, cookie, private storage key, or raw DriverAdapter error is present in the
recorded evidence. Final global coverage remained above unchanged thresholds.

## Dependency-audit addendum — 2026-08-27

A fresh `npm audit --audit-level=high` initially reported 10 transitive
vulnerabilities (7 high, 3 moderate) published after the original completion
evidence. A non-force `npm audit fix` safely updated the compatible lockfile
resolutions. The remaining Prisma-tooling findings were resolved with narrowly
scoped overrides:

- `@prisma/config > deepmerge-ts` is pinned to `8.0.2`, which includes the
  circular-reference/depth protection for the stack-exhaustion advisory. The
  installed Prisma config implementation imports only the retained public
  `deepmerge` function; Prisma generate, validate, typecheck, and build passed
  with the override.
- `@prisma/dev > valibot` is pinned to the patched `1.4.2` release.

The override avoids npm's unsafe `--force` proposal to downgrade Prisma from
7.9.0 to 6.12.0. It should be removed when the stable Prisma 7 line ships those
patched transitive versions directly. The final audit reports `0
vulnerabilities`, and all unit and R1-P07 coverage tests passed again after the
lockfile change.
