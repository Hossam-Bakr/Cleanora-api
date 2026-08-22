# Transaction Boundaries — R1-P06

## Global Rules

1. Providers owns business transactions.
2. Precompute CPU-only normalization/encryption/HMAC outside or immediately before the transaction; never return values until commit.
3. No Cloudinary, file decoding, malware scanner, email, external bank/wallet action, or unbounded scan in a transaction.
4. Lock order: Provider -> chain(s) -> version(s) -> primary -> identity claim/fingerprint/conflict -> history/outbox. Multiple IDs sort ascending.
5. Re-read exact expected versions and current state under lock.
6. State, decision, safe history/audit, pointer/readiness effect, conflict, and outbox belonging to one command commit atomically.
7. Unique operation IDs make matching retries idempotent. Changed input or stale/competing commands return 409 and write nothing.

## Policy Publication

Before transaction: authenticate capable Staff, validate request shape/country/type facts.
Inside: lock scope and draft; recheck Staff/country/types/version; validate complete policy; write published fields and safe audit/history/activation cursor.
After: current readiness resolves by effective query; bounded runner appends affected Provider history. Never scan all Providers while publishing.

## Evidence Upload

1. Providers authorizes exact member/application/draft and reserves association.
2. Media reserves opaque file state.
3. File decode/scan/normalize/Cloudinary occurs outside Provider transaction.
4. Media finalizes validation receipt/status.
5. Providers binds/updates ordered draft reference in a short exact-version transaction.
6. Submission locks document and re-reads all Media facts through the transaction-aware public contract.

Failed/abandoned Media is cleanup-eligible and never partial verification truth.

## Document Submission

Lock Provider, chain, DRAFT version, applicable policy/version/item, then evidence associations. Recheck application approval, active exact Owner/Admin, country/policy rules, all Media READY, format/order/aggregate, expected version, and operation ID. Freeze snapshot, set SUBMITTED, append safe history/audit. No email is required unless a later explicit requirement says so.

## Document Staff Decision / Expiry

Lock Provider, chain, exact version, effective predecessor/successor as needed. Recheck Staff permission, legal transition, evidence eligibility, reason, version. Insert immutable review and safe audit/history; move effective pointer and derived truth/badge atomically. A bounded clock-driven runner applies expiry idempotently with the same locks.

## Payout Draft Create/Update

Before: authorize principal/session, normalize/validate full input, resolve active country/registry/legal-name facts, create exact mask and crypto/HMAC material.
Inside: lock Provider and chain if existing; recheck approved application and exact active Owner, authoritative country/active registry, five active slots, one open successor, version/operation ID, same-Provider historical identity reuse, and all enabled active-fingerprint uniqueness. Insert/update DRAFT version, claim/fingerprints, safe history/audit. A cross-Provider collision rolls back the destination transaction, then records/returns one separate safe idempotent conflict case without creating a second claim or disclosing the incumbent.

For retry comparison, decrypt the already stored value inside the authorized service and compare canonical input in memory. Do not store low-entropy request hashes or reuse lookup HMAC for command idempotency.

## Payout Submission / Successor Submission

Authentication first verifies a request-bound Owner proof no older than 10 minutes. Inside Providers transaction lock Provider, chain/version/claim, recheck membership/application/country/registry/expected version and proof scope, set PENDING_VERIFICATION, append history/audit, and insert one deterministic Owner outbox intent. Queue visibility derives from state. Commit before email.

## Staff Reveal

1. Authorize Staff capability and verify request-bound step-up no older than five minutes.
2. Lock/read exact destination and recheck PENDING_VERIFICATION/version/purpose.
3. In one short Providers-owned database transaction, lock and recheck the exact
   pending version, resolve key IDs, and authenticate/decrypt identifier and
   holder in request memory.
4. Within that same transaction, call the Admin-owned actor-serialized audit
   gate with the transaction context; it holds the actor advisory lock, counts
   accepted attempts in the rolling 10 minutes, and inserts accepted evidence.
5. Commit the version lock and audit together. Only the post-commit accepted
   acknowledgement permits plaintext response. Set no-store headers and discard
   the request grant.

Any auth/state/key/decrypt/audit/rate/commit failure returns no plaintext. Denied audit is best-effort only after disclosure is already denied; audit-store outage emits safe operational alert, never a fallback response.

## Staff Payout Decision

Lock Provider, chain, exact version, primary row, predecessor/successor, claim/conflict as applicable. Recheck permission, expected version, legal method/outcome, meaningful safe note, and for approval a same-actor/same-version accepted reveal reference. Atomically insert decision/history/audit/outbox and apply lifecycle/effective pointer/claim/primary/readiness effects.

- first approval initializes primary only if absent;
- voluntary successor approval supersedes and inherits predecessor primary;
- unrelated approval never changes primary;
- Staff challenge clears challenged primary immediately and marks narrowly scoped restoration eligibility;
- no automatic failover.

## Owner Primary / Removal

Proof no older than 10 minutes. Lock Provider, primary row, all involved destinations/claims. Require expected primary and destination versions plus operation ID.

- primary switch targets current active APPROVED version;
- removing primary with another approved destination requires replacement in the same transaction;
- removing last approved primary requires explicit acknowledgement, then clears readiness;
- remove/release claim only when no nonterminal/effective version still depends on it.

Write history/audit/outbox atomically. Any conflict rolls all effects back.

## Cross-Provider Conflict Resolution

No override allows two active identical fingerprints. Staff may reject the candidate conflict or invalidate/release the incumbent through the ordinary audited exact-version workflow. Conflict resolution records actor/reason/outcome; candidate Owner retries after release. Provider responses never reveal the other Provider.

## Notification Dispatch

The transaction stores a unique safe outbox intent. The existing worker leases after commit, renders a closed localized template, sends, retries with bounded backoff, and stores safe errors. Delivery never controls business truth.
