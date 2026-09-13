# Bookings P16 public contract notes

File: `src/modules/bookings/bookings.public.ts`

Keep existing `BOOKINGS_PUBLIC_CONTRACT`, financial snapshot reader, and
`confirmDepositPayment`.

## confirmDepositPayment (extend)

After a successful `AWAITING_DEPOSIT → CONFIRMED` update, in the same
transaction:

1. Read `commercial.provider_response_hours` for the booking country
   (fail closed if missing or invalid positive integer hours).
2. Insert `booking_responses` PENDING with `expiresAt = now + hours`
   if no row exists.
3. Insert notification intent `BOOKING_CONFIRMED_FOR_PROVIDER` to the
   provider owner recipient resolved via Providers public read (fail closed
   if no active owner can be resolved — or persist intent to a configured
   provider contact user id already stored on membership). If owner user id
   cannot be resolved, still confirm the booking and skip only that intent
   **is not allowed**; fail closed so ops cannot lose the inbox trigger
   silently. Implementer uses the existing Providers public owner lookup.

Idempotent replay: if already CONFIRMED, ensure PENDING response exists
(create if missing) then return CONFIRMED.

Payments continues to call this seam only; it must not know about
responses.

## Membership

Composition injects a function:

```text
assertActiveProviderManager(providerId, userId) →
  { providerId, userId, level: "OWNER" | "ADMIN" }
```

sourced from Providers public membership, not bookings Prisma on
provider tables.

## Clock

`now(): Date` injected; tests control expiry.
