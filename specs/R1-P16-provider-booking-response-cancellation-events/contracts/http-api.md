# Bookings Response & Cancellation HTTP API Contract (R1-P16)

Base prefixes:

- Provider: `/api/v1/providers/:providerId/bookings`
- Customer: `/api/v1/bookings`
- Staff: `/api/v1/staff/bookings`

Success/error envelopes: repository standard
(`success`/`data`/`requestId` or `error.code`).

Idempotency: header `Idempotency-Key` (1–128 chars) **required** on
accept, reject, provider cancel, and staff cancel.

Optimistic concurrency: body `version` (positive int) on all mutating
commands.

Do not return payment gateway secrets, other providers' bookings, fee
amounts (none exist), or stack traces.

Stable error codes (extend bookings errors as needed):

- `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_FAILED`
- `TRANSITION_NOT_AVAILABLE`, `CONFLICT`, `IDEMPOTENCY_BODY_MISMATCH`
- `RESPONSE_EXPIRED`

Non-enumerating 404/403 for unauthorized provider/customer reads follows
existing bookings privacy.

---

## GET `/api/v1/providers/:providerId/bookings/inbox`

List CONFIRMED bookings with PENDING non-expired responses for this
provider. Lazy-expires overdue rows before listing.

**Auth**: Bearer; active OWNER or ADMIN of `:providerId`.

**Query**: `cursor?`, `limit?` (default 20, max 50)

**Data**:

```text
items: [{
  bookingId, status, startsAt, endsAt, serviceLabel?,
  responseStatus, expiresAt, version
}]
nextCursor: string | null
```

---

## GET `/api/v1/providers/:providerId/bookings/:bookingId`

Selected-provider dossier.

**Auth**: Bearer; active OWNER/ADMIN of the booking's `providerId` (must
match path).

**Data**: booking identity, status, `serviceId`, frozen catalog service code/version,
schedule, frozen price facts, address text, crew preference, response {status,
expiresAt, decidedAt}, cancellation {actorKind, reasonCode, createdAt} | null,
version.

---

## POST `/api/v1/providers/:providerId/bookings/:bookingId/accept`

**Auth**: selected provider OWNER/ADMIN.
**Headers**: `Idempotency-Key`
**Body**: `{ version }`

**Success data**: `{ bookingId, status: "ACCEPTED", version, responseStatus: "ACCEPTED" }`

Expired → `RESPONSE_EXPIRED` after lazy expiry (booking CANCELLED).
Wrong provider → NOT_FOUND/FORBIDDEN without leaking.

---

## POST `/api/v1/providers/:providerId/bookings/:bookingId/reject`

**Auth**: selected provider OWNER/ADMIN.
**Headers**: `Idempotency-Key`
**Body**: `{ version, reasonCode }` where reasonCode is an active
PROVIDER/REJECT seed.

**Success data**: `{ bookingId, status: "CANCELLED", version, responseStatus: "REJECTED", cancellationId }`

No `fee` field in request or response.

---

## POST `/api/v1/providers/:providerId/bookings/:bookingId/cancel`

Provider cancel after accept.

**Auth**: selected provider OWNER/ADMIN.
**Headers**: `Idempotency-Key`
**Body**: `{ version, reasonCode }` PROVIDER/CANCEL seed.

From CONFIRMED → `TRANSITION_NOT_AVAILABLE` (use reject).

---

## GET `/api/v1/bookings/cancellation-reasons`

**Auth**: any full authenticated principal.
**Query**: `actor` (`CUSTOMER` | `PROVIDER` | `STAFF_ADMIN`), `purpose`
(`REJECT` | `CANCEL`)

Returns active reasons the caller is allowed to see for that actor/purpose.
SYSTEM reasons are omitted from customer/provider lists.

---

## POST `/api/v1/bookings/:bookingId/cancel`

Existing customer cancel. Extend allowed from-status to CONFIRMED and
ACCEPTED. Body remains `{ version, reason }` mapped to customer CANCEL
reasons. Write `booking_cancellations` for post-confirm cancels. P13
DRAFT/AWAITING_DEPOSIT cancel still writes history; also write a
cancellation row when those paths remain cancellable if it does not break
P13 tests — prefer adding the row for all successful cancels in P16 for
one audit model.

---

## GET `/api/v1/bookings/:bookingId`

Existing customer get. Include `response` and `cancellation` projections
when present.

---

## POST `/api/v1/staff/bookings/:bookingId/cancel`

**Auth**: active `staff_admin`.
**Headers**: `Idempotency-Key`
**Body**: `{ version, reasonCode }` STAFF_ADMIN/CANCEL seed.

CONFIRMED or ACCEPTED only. Audit reason mandatory.

---

## GET `/api/v1/staff/bookings/:bookingId`

Staff dossier read (same facts as provider dossier plus actor identities
needed for ops, still no gateway secrets).
