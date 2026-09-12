# Payments Deposit HTTP API Contract (R1-P15)

Base prefixes:

- Customer/staff payment resources: `/api/v1/payments`
- Webhook: `/api/v1/webhooks/paymob`
- Staff method admin: `/api/v1/staff/payments/methods`

Success/error envelopes: repository standard
(`success`/`data`/`requestId` or `error.code`).

Idempotency: header `Idempotency-Key` (1–128 chars) **required** on
`POST /api/v1/payments/deposits`.

Money in JSON: digit-string minor units + `currencyCode` +
`currencyDecimalPlaces` (never JS number money).

Do not return raw gateway secrets, full unsigned payloads with PAN data, or
stack traces.

---

## GET `/api/v1/payments/methods`

List country-enabled payment methods for the authenticated customer.

**Auth**: Bearer; verified customer category (`INDIVIDUAL` | `COMPANY` |
`ENGINEER`).

**Query**:

- `countryId` required (or derived from active customer country if repo already
  has a single-country convention — prefer explicit `countryId` and validate
  it is an active country the caller may use)

**Data**:

```text
items: [{
  id, code, provider, methodKind,
  displayNameAr?, displayNameEn?,
  enabled: true  // list returns enabled-only for customers
}]
```

**Errors**: `AUTHENTICATION_REQUIRED` | `FORBIDDEN` | `VALIDATION_FAILED` |
`NOT_FOUND` (unknown/inactive country)

**Notes**: Disabled rails are omitted from this customer list. Egypt seed
yields Paymob CARD and Paymob WALLET only when enabled.

---

## POST `/api/v1/payments/deposits`

Initiate deposit payment for an owned `AWAITING_DEPOSIT` booking.

**Auth**: Bearer; verified customer; ownership of booking required.

**Headers**: `Idempotency-Key` required.

**Body**:

```text
{
  bookingId: string,
  paymentMethodId: string
}
```

**Data** (illustrative):

```text
{
  paymentId,
  attemptId,
  status: "PENDING" | "CREATED" | "REDIRECTED",
  amountMinorUnits, currencyCode, currencyDecimalPlaces,
  gateway: { provider: "PAYMOB", redirectUrl?, sessionRef? }
}
```

**Errors**:

- `AUTHENTICATION_REQUIRED` | `FORBIDDEN`
- `VALIDATION_FAILED` (disabled method, bad ids)
- `NOT_FOUND` (non-owned booking — non-enumerating policy)
- `TRANSITION_NOT_AVAILABLE` / `CONFLICT` (booking not AWAITING_DEPOSIT;
  already SUCCEEDED deposit)
- `CONFLICT` (idempotency key payload mismatch)
- `DEPENDENCY_FAILURE` / `GATEWAY_MISCONFIGURED` (fail closed; stable code
  name chosen at implement time and listed in OpenAPI)

**Invariant**: Does **not** mark payment `SUCCEEDED` or booking `CONFIRMED`.

---

## GET `/api/v1/payments/return`

Browser return handler after gateway redirect.

**Auth**: Prefer authenticated customer when session cookie/token present; if
public query-token pattern is required by Paymob return URL constraints,
validate a signed opaque return token issued at initiate — **never** trust
gateway query `success=true` alone. Exact token shape is an implementation
detail; product rule is fixed: return never marks paid.

**Query**: attempt/payment correlation params + optional gateway echo params
(ignored as proof).

**Data**:

```text
{
  paymentId?, attemptId?,
  paymentStatus: "PENDING" | "SUCCEEDED" | "FAILED" | ...,
  bookingStatus: "AWAITING_DEPOSIT" | "CONFIRMED" | ...,
  message: safe status text
}
```

**Errors**: `AUTHENTICATION_REQUIRED` | `FORBIDDEN` | `VALIDATION_FAILED` |
`NOT_FOUND`

**Invariant**: Handler performs **read/status projection only**. No
SUCCEEDED transition, no ledger post, no receipt create, no booking confirm.

---

## POST `/api/v1/webhooks/paymob`

Paymob webhook receiver.

**Auth**: None (signature verification on **raw body**).

**Body**: raw bytes as delivered by Paymob (Express must not JSON-parse before
HMAC).

**Processing**:

1. Verify signature using env secret; invalid → `401`/`403` with stable code
   `WEBHOOK_SIGNATURE_INVALID` (or mapped standard) and **no** mutation.
2. Claim/insert `payment_gateway_events` by `(provider, idempotencyKey)`.
3. Idempotent success/failure handling per spec.

**Response**: `2xx` on accepted verified processing (including harmless
replay). Do not leak internal ids unnecessarily.

**Errors**: signature invalid; validation failed for malformed body after
verify policy.

**Invariant**: Sole HTTP authority path that may mark payment SUCCEEDED and
drive confirm pipeline.

---

## GET `/api/v1/payments/:paymentId`

Payment detail including receipt when present.

**Auth**: Bearer; owner customer **or** active `staff_admin`.

**Data**:

```text
{
  paymentId, bookingId, purpose, status,
  amountMinorUnits, currencyCode, currencyDecimalPlaces,
  methodCode,
  receipt?: { receiptId, issuedAt, providerRef? }
}
```

**Errors**: `AUTHENTICATION_REQUIRED` | `FORBIDDEN` | `NOT_FOUND`
(non-enumerating for non-owners)

---

## PATCH `/api/v1/staff/payments/methods/:methodId`

(also allow PUT with same semantics if OpenAPI lists both)

Enable/disable a payment method for its country (minimal config).

**Auth**: Bearer; active `staff_admin`.

**Body**:

```text
{
  enabled: boolean
}
```

**Data**: updated method `{ id, countryId, code, enabled, ... }`

**Errors**: `AUTHENTICATION_REQUIRED` | `FORBIDDEN` | `VALIDATION_FAILED` |
`NOT_FOUND`

**Audit**: privileged write should record actor + before/after per security
standards.

---

## Error codes (stable set for P15)

`AUTHENTICATION_REQUIRED` | `FORBIDDEN` | `VALIDATION_FAILED` | `NOT_FOUND` |
`CONFLICT` | `TRANSITION_NOT_AVAILABLE` | `DEPENDENCY_FAILURE` |
`GATEWAY_MISCONFIGURED` | `WEBHOOK_SIGNATURE_INVALID` |
`PAYMENT_ALREADY_SUCCEEDED` | `AMOUNT_MISMATCH`

(Map domain errors to the standard envelope; keep codes stable in OpenAPI.)

## Explicit non-endpoints

- No wallet top-up/transfer/withdraw
- No InstaPay callback routes
- No gateway refund execution route in P15
- No customer enable/disable of methods
