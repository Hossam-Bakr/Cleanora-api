# Payments Deposit Public Contract (P15 additions)

**Module entry**: `src/modules/payments/payments.public.ts`
**Transport**: in-process additions for composition + Bookings seam; HTTP is
documented separately in `http-api.md`.
**Authority**: spec Clarifications; DEC-094; OQ-009; DEC-003.

## Existing P14 surface (unchanged)

Keep ledger methods:

- `postJournal`, `postAdjustment`, `createSnapshot`
- `getDerivedBalance`, `listEntries`, `reconcileBooking`

Deposit success **must** call existing `postJournal` with a balanced DEPOSIT
journal linked to the booking. Do not invent a second ledger writer.

## New / extended types (illustrative)

```ts
export type PaymentPurpose = "BOOKING_DEPOSIT";

export type PaymentStatus =
  | "PENDING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED";

export type PaymentAttemptStatus =
  | "CREATED"
  | "REDIRECTED"
  | "PENDING"
  | "SUCCEEDED"
  | "FAILED"
  | "EXPIRED";

export interface PaymentGatewayPort {
  readonly provider: "PAYMOB";
  /**
   * Create a hostable checkout/session for an attempt.
   * Must fail closed if env/secrets are incomplete.
   */
  createDepositSession(input: {
    readonly attemptId: string;
    readonly paymentId: string;
    readonly amountMinorUnits: string;
    readonly currencyCode: string;
    readonly customerReference: string;
    readonly returnUrl: string;
    readonly methodKind: "CARD" | "WALLET";
  }): Promise<{
    readonly sessionRef: string;
    readonly redirectUrl: string;
  }>;

  verifyWebhookSignature(input: {
    readonly rawBody: Buffer;
    readonly signatureHeader: string | undefined;
  }): boolean;

  parseWebhookEvent(input: {
    readonly rawBody: Buffer;
  }): {
    readonly idempotencyKey: string;
    readonly eventType: string;
    readonly success: boolean;
    readonly sessionRef?: string;
    readonly amountMinorUnits?: string;
    readonly currencyCode?: string;
  };
}
```

## In-process methods to add on payments application service

These may be called by HTTP adapters in the same module; other modules should
not need most of them except where composition tests require fakes.

```ts
listEnabledMethodsForCountry(input: {
  readonly countryId: string;
}): Promise<readonly PaymentMethodPublic[]>;

initiateBookingDeposit(input: {
  readonly actorUserId: string;
  readonly bookingId: string;
  readonly paymentMethodId: string;
  readonly idempotencyKey: string;
}): Promise<InitiateDepositResult>;

getBrowserReturnStatus(input: {
  readonly actorUserId?: string;
  readonly paymentId?: string;
  readonly attemptId?: string;
  readonly returnToken?: string;
}): Promise<BrowserReturnStatus>;

processPaymobWebhook(input: {
  readonly rawBody: Buffer;
  readonly signatureHeader: string | undefined;
}): Promise<{ readonly replayed: boolean; readonly paymentId?: string }>;

getPaymentForReader(input: {
  readonly paymentId: string;
  readonly reader:
    | { readonly kind: "CUSTOMER"; readonly userId: string }
    | { readonly kind: "STAFF_ADMIN"; readonly userId: string };
}): Promise<PaymentPublicView>;

setPaymentMethodEnabled(input: {
  readonly staffUserId: string;
  readonly methodId: string;
  readonly enabled: boolean;
}): Promise<PaymentMethodPublic>;

createRefundRequest(input: {
  readonly paymentId: string;
  readonly actorKind: string;
  readonly actorId: string;
  readonly reason?: string;
  readonly amountMinorUnits?: string; // default full payment if omitted
}): Promise<{ readonly refundRequestId: string; readonly status: "REQUESTED" }>;
```

Exact TypeScript shapes may be refined at implement time; behavioral
invariants are normative.

## Bookings public seam (required)

**File**: `src/modules/bookings/bookings.public.ts`

```ts
confirmDepositPayment(input: {
  readonly bookingId: string;
  readonly paymentId: string;
  readonly expectedDepositMinorUnits: string;
  readonly currencyCode: string;
  readonly actorKind: "SYSTEM" | "TEST";
  readonly actorId: string;
  readonly reason: string;
}): Promise<{ readonly bookingId: string; readonly status: "CONFIRMED" }>;
```

Rules:

- Only `AWAITING_DEPOSIT` → `CONFIRMED`.
- Fail closed on amount/currency mismatch or illegal status.
- Payments calls this **only** after verified success + durable SUCCEEDED
  payment + DEPOSIT journal + receipt create (see plan ordering).
- Bookings must not import payments Prisma.

## Authorization notes

- Customer commands derive `actorUserId` from auth middleware, never from body.
- Staff method toggle requires active `staff_admin`.
- Webhook has no user principal; signature is the gate.
- `confirmDepositPayment` is not an HTTP customer endpoint in P15.

## Error codes (in-process)

Align with HTTP mapping: `VALIDATION_FAILED`, `NOT_FOUND`, `FORBIDDEN`,
`CONFLICT`, `TRANSITION_NOT_AVAILABLE`, `GATEWAY_MISCONFIGURED`,
`WEBHOOK_SIGNATURE_INVALID`, `PAYMENT_ALREADY_SUCCEEDED`, `AMOUNT_MISMATCH`,
`DEPENDENCY_FAILURE`.

## Explicit non-methods

- No wallet top-up/transfer/withdraw
- No `executeGatewayRefund`
- No `postRefundJournal` helper in P15
- No InstaPay adapter
