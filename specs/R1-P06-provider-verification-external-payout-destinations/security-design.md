# Sensitive-Data Security Design — R1-P06

This artifact specifies the accepted payout-data contract. It does not broaden field-level encryption to document metadata and does not implement secrets or production configuration.

## Classification

| Class | Examples | Permitted persistence/output |
|---|---|---|
| Payout protected plaintext | E.164 wallet, normalized IBAN, holder full legal name | Input and request-scoped authorized memory only; AES-GCM envelope in DB; one audited Staff reveal for exact pending version. |
| Payout lookup secret-derived | HMAC fingerprint | Protected lookup table only; equality/dedup component only; never output/log/audit/history. |
| Cryptographic material | encryption/HMAC keys, raw environment values | External secret injection and process memory only; never DB/repo/log/error. |
| Envelope metadata | ciphertext, nonce, tag | Protected repository/crypto adapter only; never generic DTO/log/audit/history. |
| Non-secret key metadata | key IDs/versions | Protected persistence and expressly allowed safe reveal/rotation audit. |
| Safe display | exact mask components/mask, type, institution label, status, primary, safe timestamps | Role-specific ordinary projections. |
| Private document data | document numbers/names/dates and Media evidence | Authorized Provider/Staff verification views only; never public/log/generic audit/history. |

## Encryption Envelope

Encrypt each identifier and holder name independently with AES-256-GCM:

- 32 decoded bytes per encryption key;
- fresh cryptographically random 12-byte nonce for every field encryption;
- 16-byte authentication tag;
- explicit non-secret `encryptionKeyId`;
- no nonce reuse, including across the two fields of one version.

AAD uses a canonical length-prefixed/binary or canonical JSON encoding with a schema version and these server-owned values:

```text
envelopeSchemaVersion
providerId
destinationChainId
destinationVersionId
destinationSequence
destinationType
fieldName
encryptionKeyId
```

Delimiter-concatenated caller text is prohibited. A change to any AAD dimension fails authentication. Crypto-only rotation uses a separate crypto revision/progress token and does not increment business version, lifecycle timestamps, primary, or readiness.

## Lookup Fingerprints

Use HMAC-SHA-256 with a separate lookup key ring and canonical length-prefixed UTF-8 inputs:

```text
MOBILE_WALLET, countryCode, normalizedE164
BANK_ACCOUNT, normalizedIban
```

`operatorCode` is deliberately absent. New claims compute fingerprints under every enabled lookup key so duplicate protection remains complete during overlap. Insert all required rows in the destination transaction; map uniqueness collisions to safe conflicts. Fingerprints never perform display, recovery, analytics, logging, audit, or general search.

## Exact Masking

### Mobile Wallet

Parse the calling code from the validated authoritative-country E.164 value. Preserve `+` and the complete country calling code, replace every national digit except the final four with `•` (U+2022), then show the final four.

Example: `+201012345678` becomes `+20••••••5678`.

### IBAN

From uppercase whitespace-free normalized IBAN, preserve the two country letters and final four characters, replace every intervening alphanumeric with `•`, then group left-to-right into blocks of four.

Example: `EG38001900050000000026318002` becomes `EG•• •••• •••• •••• •••• •••• 8002`.

Ordinary reads render the mask from stored safe prefix/suffix/length facts and do not decrypt. A stored mask is never returned as a fallback for a failed reveal. Holder name is either full for an expressly authorized current-management/verification purpose or omitted; it is never partially masked.

## Projection Matrix

| Audience | Identifier | Holder name | Other data |
|---|---|---|---|
| exact active Owner management | exact mask only | full current holder name allowed | relationship, active institution label, state, primary, safe times |
| exact active Provider Admin | exact mask only | omitted | type, state, primary, safe times only |
| ordinary Staff queue/dossier | exact mask only | omitted | safe comparison/status metadata |
| Staff reveal workflow | full for one exact pending version | full for same version | purpose-bound response only |
| generic history/audit/log/error/email | never full; approved mask only where allowed | omitted | safe IDs/codes/state/reason |
| public/anonymous | omitted | omitted | no document or payout data |

## Reveal Protocol

1. Accept only POST body input; never URL/query values.
2. Recheck active Staff Admin and explicit payout-verification capability.
3. Require exact Provider, exact destination version/version number, PENDING_VERIFICATION, verification purpose, request ID, and meaningful safe reason.
4. Authentication verifies a step-up proof no older than five minutes and bound to current actor/session/request purpose.
5. Resolve referenced key IDs and authenticate/decrypt locally; retain plaintext only in request memory.
6. In the same short database transaction that locks/rechecks the exact pending
   version, Admin Audit serializes the Staff actor, counts accepted reveals in
   the rolling 10-minute window, and inserts the safe accepted attempt. Attempt
   six is denied/audited and returns no plaintext.
7. Only after that single transaction commits the version check and accepted
   audit may the controller return the two plaintext fields.
8. Set `Cache-Control: no-store, private` and `Pragma: no-cache`; bypass response-body logging/caching and end the request-scoped grant.

A new request ID or concurrency does not bypass the durable actor limit. A successful response consumes one accepted reveal. Denials are audited but do not consume an accepted-reveal slot. Audit/key/decrypt/proof/rate/commit failure fails closed. If denial-audit storage is unavailable, disclosure remains denied and a safe high-severity operational signal is emitted.

The Staff decision records method/outcome/note; it cannot prove the manual external channel was actually contacted. For approval, implementation should require a same-actor/same-version accepted reveal-attempt reference that remains within the active verification purpose, while still treating the Staff attestation as the manual-check evidence.

## Key-Ring Configuration

Exact environment names:

- `PAYOUT_DATA_ENCRYPTION_KEYS_JSON`
- `PAYOUT_DATA_ENCRYPTION_ACTIVE_KEY_ID`
- `PAYOUT_LOOKUP_HMAC_KEYS_JSON`
- `PAYOUT_LOOKUP_HMAC_ACTIVE_KEY_ID`

The JSON values are strict maps from nonempty key ID to strict base64/base64url key text. Composition validation requires:

- exact allowed shape and one active ID present per ring;
- encryption keys exactly 32 decoded bytes; HMAC keys at least 32 bytes;
- no decoded key bytes reused within or across rings;
- active key IDs distinct and material independent;
- no default/example/fallback key outside test dependency injection;
- no logging of JSON, raw environment values, or decoded bytes.

Protected readiness also verifies that every encryption/lookup key ID referenced in PostgreSQL is retained in the matching ring. Missing historical keys make protected operations/readiness fail closed.

## Rotation

1. Generate independent keys outside the repository.
2. Add new plus retained old keys; change active IDs.
3. Restart/reload via the approved operation; new writes use the new encryption key and all enabled lookup keys.
4. Start a human-authorized run with bounded batch size and stable cursor.
5. Re-encrypt each protected field with a fresh nonce/AAD and add target lookup fingerprint, skipping already-complete rows idempotently.
6. Persist only safe run IDs, key IDs, cursor, counts, status, times, and safe failure code.
7. Verify duplicate enforcement through partial overlap and resume after failure.
8. Remove old fingerprint rows only in bounded batches after target coverage.
9. Prove zero old encryption references and zero old lookup references.
10. Require explicit human approval and meaningful reason before configuration retirement.

Rotation never changes business status/version/readiness/history. Safe telemetry omits Provider IDs and all protected/envelope/fingerprint material.

## Logging and Safe Notes

Construct allowlisted safe contexts at call sites; redaction is defense in depth, not the primary control. Extend logger/audit guards for IBAN, wallet, holder name, ciphertext, nonce, tag, fingerprint, encryption/HMAC keys, raw proofs, and Media keys.

Decision/reveal notes use a closed reason code plus bounded optional text. Reject control characters, submitted full identifier, exact revealed holder name, E.164/IBAN-like sequences matching the target, and cryptographic material. Never copy reveal-screen text or external beneficiary names into history/audit.

## Security Acceptance Evidence

- AES round trip plus nonce uniqueness, tag tamper, wrong key, missing key, and every AAD mismatch.
- HMAC determinism/domain separation/key separation/all-enabled-key collision tests.
- golden wallet/IBAN masks.
- six concurrent reveal requests yield exactly five accepted audits/responses.
- forced accepted-audit failure yields no plaintext.
- sentinel scans across persistence, responses, logs, errors, audit, histories, outbox, examples, and fixtures.
- rotation overlap/resume/zero-reference/human-retirement tests.
