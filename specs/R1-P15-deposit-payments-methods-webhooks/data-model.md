# Data Model — R1-P15 Deposit Payments, Methods & Webhooks

Prisma models are added only by this phase in `prisma/schema.prisma`.
Booking ids are logical references from payments (application Restrict; no
cascade delete that erases payment history). Payments continues to own P14
ledger tables unchanged except for use via `postJournal`.

Migration folder name: `r1_p15_deposit_payments_methods_webhooks`.

## Enums

```text
PaymentRailProvider:
  PAYMOB
  | OTHER_DISABLED   # config-only placeholder; never executable in P15

PaymentMethodKind:
  CARD
  | WALLET
  | OTHER            # disabled-only config rows; no InstaPay behavior

PaymentAttemptStatus:
  CREATED
  | REDIRECTED
  | PENDING
  | SUCCEEDED
  | FAILED
  | EXPIRED

PaymentStatus:
  PENDING
  | SUCCEEDED
  | FAILED
  | CANCELLED

PaymentPurpose:
  BOOKING_DEPOSIT    # only purpose in P15

PaymentGatewayEventStatus:
  RECEIVED
  | PROCESSED
  | IGNORED
  | REJECTED

RefundRequestStatus:
  REQUESTED          # only status written in P15
  # later phases may add APPROVED / EXECUTED / FAILED — do not implement now
```

## Tables

### payment_methods

Country-scoped method configuration (authoritative for which rails customers
may initiate).

- id (cuid)
- countryId (FK Country)
- provider (PaymentRailProvider)
- methodKind (PaymentMethodKind)
- code (stable string, e.g. `PAYMOB_CARD`, `PAYMOB_WALLET`)
- displayNameAr / displayNameEn (or localization keys — implementer chooses
  one pattern already used in repo)
- enabled (boolean)
- sortOrder (int)
- createdAt
- updatedAt
- unique (countryId, code)
- unique (countryId, provider, methodKind) where applicable for Egypt seed
- index (countryId, enabled)

Egypt seed:

- `PAYMOB` + `CARD` → enabled true
- `PAYMOB` + `WALLET` → enabled true
- Optional other rails → enabled false only (no executable adapter path)

### payment_attempts

One initiation/session toward collecting a deposit.

- id (cuid)
- paymentId (FK payments; may be created with parent payment PENDING)
- bookingId (logical)
- customerUserId (logical owner)
- paymentMethodId (FK payment_methods)
- status (PaymentAttemptStatus)
- amountMinorUnits Decimal(65,0)
- currencyCode
- currencyDecimalPlaces
- idempotencyKey
- gatewaySessionRef nullable (gateway order/session id)
- redirectUrl nullable
- failureCode nullable
- failureMessageSafe nullable (no secrets)
- expiresAt nullable
- createdAt
- updatedAt
- unique (customerUserId, bookingId, idempotencyKey)
- index (bookingId, status)
- index (gatewaySessionRef)

### payments

Commercial payment record for a deposit purpose.

- id (cuid)
- bookingId (logical)
- customerUserId (logical)
- purpose (PaymentPurpose = BOOKING_DEPOSIT)
- status (PaymentStatus)
- amountMinorUnits Decimal(65,0)
- currencyCode
- currencyDecimalPlaces
- paymentMethodId (FK)
- succeededAttemptId nullable (FK payment_attempts)
- ledgerJournalId nullable (logical reference to P14 journal)
- createdAt
- updatedAt
- **partial unique**: at most one row with status `SUCCEEDED` per
  `(bookingId, purpose)` (enforce in SQL where supported, else application +
  unique success marker table/column — prefer DB-enforced uniqueness)
- index (bookingId, purpose, status)
- index (customerUserId, createdAt)

### payment_gateway_events

Inbound gateway callbacks / events (append-oriented; idempotent processing).

- id (cuid)
- provider (PaymentRailProvider; Paymob for executable path)
- idempotencyKey (string; provider event id or deterministic hash)
- paymentAttemptId nullable
- paymentId nullable
- eventType (string; provider event name/code)
- signatureValid (boolean)
- status (PaymentGatewayEventStatus)
- payloadHash (string)
- rawPayloadStored boolean / redacted storage policy: store minimal verified
  fields; do not log full card PANs or secrets
- processedAt nullable
- createdAt
- **unique (provider, idempotencyKey)**
- index (paymentId)
- index (paymentAttemptId)

### payment_receipts

Customer-visible receipt after success.

- id (cuid)
- paymentId (FK payments, unique)
- bookingId (logical)
- customerUserId (logical)
- amountMinorUnits Decimal(65,0)
- currencyCode
- currencyDecimalPlaces
- methodCode
- providerRef nullable (safe external reference)
- issuedAt
- createdAt only (immutable preferred)
- unique (paymentId)
- index (bookingId)
- index (customerUserId, issuedAt)

### refund_requests

Foundation only in P15.

- id (cuid)
- paymentId (FK payments)
- bookingId (logical)
- customerUserId (logical)
- amountMinorUnits Decimal(65,0)
- currencyCode
- currencyDecimalPlaces
- status (RefundRequestStatus = REQUESTED)
- reason nullable (safe string)
- requestedByActorKind / requestedByActorId
- createdAt
- updatedAt
- index (paymentId)
- index (status, createdAt)

No gatewayRefundId required in P15. No ledger REFUND journal id in P15.

## Relationships and invariants

1. Initiate requires enabled `payment_methods` for booking country.
2. Amount/currency on attempt/payment MUST match Bookings deposit requirement
   at initiate and again at verified success (fail closed on mismatch).
3. Browser return MUST NOT mutate payment to SUCCEEDED or booking to CONFIRMED.
4. Only verified gateway-event processing may set payment SUCCEEDED.
5. Duplicate `(provider, idempotencyKey)` events replay without new side effects.
6. At most one SUCCEEDED `BOOKING_DEPOSIT` payment per booking.
7. Prior attempts remain FAILED/EXPIRED when a new attempt starts.
8. Receipt exists only for SUCCEEDED payments.
9. Refund request does not imply money moved.

## Seed

Idempotent Egypt method seed in migration or seed script owned by payments:

| code | provider | kind | enabled |
|---|---|---|---|
| PAYMOB_CARD | PAYMOB | CARD | true |
| PAYMOB_WALLET | PAYMOB | WALLET | true |
| (optional others) | OTHER_DISABLED / PAYMOB | OTHER | false |

## Non-goals for schema

- No user wallet / balance tables
- No InstaPay-specific columns inventing a workflow
- No remaining-payment or payout tables (later phases)
- No edits to applied P14 migration SQL
