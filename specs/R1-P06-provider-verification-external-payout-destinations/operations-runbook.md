# Operations and Key-Rotation Runbook — R1-P06

**Planning contract only**: no deployment, secret, database, migration, scanner, Cloudinary, email, or production operation is performed here.

## Required Release 1 Configuration

Protected payout traffic requires all four values with no defaults:

```text
PAYOUT_DATA_ENCRYPTION_KEYS_JSON
PAYOUT_DATA_ENCRYPTION_ACTIVE_KEY_ID
PAYOUT_LOOKUP_HMAC_KEYS_JSON
PAYOUT_LOOKUP_HMAC_ACTIVE_KEY_ID
```

Document verification additionally requires the existing private Media/Cloudinary configuration and a fail-closed malware-scanner adapter configuration. SMTP remains the existing Provider outbox dependency. Values and credentials are never written to documentation, fixtures, logs, screenshots, or audit.

## Startup / Readiness

Before protected capability is ready:

- strict-parse both key maps and active IDs;
- prove independent adequate key material and no reuse;
- query safe distinct referenced key IDs and prove coverage;
- prove Media private storage and scanner dependency configuration is syntactically valid;
- surface only safe status/error codes and non-secret key IDs where necessary.

Missing/malformed/inconsistent keys make payout protected readiness fail closed. Scanner failure makes document evidence ineligible and produces a safe dependency status; it is never treated as CLEAN. Email delivery failure does not roll back committed business truth and is retried through the outbox.

## Document Policy Activation

For the initial approved EG baseline, a human invokes the idempotent bootstrap
with an explicit active Staff actor, meaningful reason, and effective time; the
bootstrap calls the same draft/publication service and records truthful
provenance. It never runs as anonymous migration SQL.

1. Staff creates/edits a draft policy (or the initial bootstrap creates it for
   the explicit Staff actor).
2. Validate country/kind/type/rules and meaningful reason.
3. Publish immutable effective-dated version.
4. Current readiness resolves the effective policy dynamically, so truth is immediate at `effectiveAt`.
5. Run bounded resumable Provider-history/badge-effect processing outside publication transaction.
6. Monitor safe counts only; no private document metadata in metrics.

## Review Queue Operations

Document queue derives from `SUBMITTED`; payout queue derives from `PENDING_VERIFICATION`; duplicate queue derives from OPEN conflict cases. Use bounded cursors and oldest-first order. No external queue/broker is required.

Staff manual payout procedure:

1. open safe masked dossier;
2. provide reveal reason and fresh step-up;
3. reveal one pending version after accepted audit;
4. use the external wallet/bank channel to perform beneficiary lookup or begin but not complete a transfer;
5. compare against authoritative legal name;
6. record method/outcome/safe note without copying displayed names/identifiers;
7. do not send verification money, complete transfer, or record settlement.

## Encryption and Lookup Rotation

### Prepare

1. Human approves rotation scope/window.
2. Generate independent new keys outside repository/process logs.
3. Add new and retained old keys to injected maps; set new active IDs.
4. Restart/reload through approved operations and confirm startup/reference coverage.

### Migrate

The repository exposes the human-invoked `npm run r1-p06:payout-key-rotation`
runner. It requires an explicit active capable Staff actor and these action-
scoped environment values; it must be pointed only at an authorized database:

- common: `R1_P06_KEY_ROTATION_ACTION`, `R1_P06_KEY_ROTATION_STAFF_USER_ID`;
- `START`: `R1_P06_KEY_ROTATION_PURPOSE`, `R1_P06_KEY_ROTATION_FROM_KEY_IDS`,
  `R1_P06_KEY_ROTATION_BATCH_SIZE`, `R1_P06_KEY_ROTATION_COMMAND_ID`;
- `RUN_BATCH`: `R1_P06_KEY_ROTATION_RUN_ID`;
- `APPROVE_RETIREMENT`: `R1_P06_KEY_ROTATION_RUN_ID`,
  `R1_P06_KEY_ROTATION_EXPECTED_VERSION`, and `R1_P06_KEY_ROTATION_REASON`.

The runner prints safe run IDs, status, counters, and non-secret state only. It
does not delete a key, edit environment configuration, or authorize deployment.

1. Start a rotation run with bounded batch size and stable cursor.
2. New writes use active encryption key and fingerprints for all enabled lookup keys.
3. For each batch, skip target-complete rows; decrypt with recorded old key; re-encrypt each field using fresh nonce and target AAD; add target fingerprint; condition on crypto revision.
4. Commit per bounded batch and record safe cursor/counts/errors.
5. Pause safely on missing key/decrypt/fingerprint conflict; never alter business lifecycle/readiness or expose fallback data.
6. Resume idempotently from durable cursor.

### Verify and retire

1. Verify target encryption coverage and target lookup coverage.
2. Remove old fingerprint rows in bounded batches only after coverage.
3. Prove zero old encryption references and zero old lookup references.
4. Record safe proof counts and non-secret IDs.
5. Require separate explicit human retirement approval and meaningful reason.
6. Remove old key from injected configuration, restart/reload, and revalidate readiness.

No automatic retirement or cloud secret manager is part of Release 1.

## Safe Observability

Allowed: request ID, operation code, safe outcome/status, aggregate counts, run ID, non-secret key ID, duration, retry count, dependency-safe error code.

Forbidden: Provider identifier in rotation metrics unless strictly required and allowlisted, full/masked-to-full payout values, holder/document names, document numbers, ciphertext, nonce, tag, fingerprint, key material, Media keys/URLs, proofs, raw bodies, external beneficiary name.

Alert on key readiness failure, scanner unavailable/error, accepted-reveal audit failure, decrypt/authentication failure, reveal oversubscription attempt, rotation paused/failed, outbox exhaustion, and bounded policy activation failure. Alerts remain safe.

## Recovery

- Key missing/decrypt failure: deny reveal/write, keep ciphertext unchanged, restore the retained key through human-approved secret configuration, then retry.
- Scanner/Media failure: keep evidence non-READY, show safe retry/replacement action, cleanup abandoned objects through Media.
- Email failure: retry outbox; business state remains accepted.
- Rotation failure: pause and resume with old keys retained; never delete/retire to force progress.
- Migration defect after application: application rollback plus forward-fix migration; never edit/drop applied evidence.

## Human Gates

Human approval is required for policy publication, cross-Provider claim resolution, Staff decisions, key rotation start/retirement, migration application, secrets, deployment, production access, destructive action, phase completion, and Git publication. This runbook authorizes none of those operations by itself.
