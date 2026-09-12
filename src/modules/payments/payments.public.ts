/**
 * Payments public contract (R1-P14 ledger + R1-P15 deposit payments).
 */

export type LedgerAccountType =
  | "PLATFORM_CLEARING"
  | "PLATFORM_REVENUE"
  | "PROVIDER_PAYABLE"
  | "CUSTOMER_DEPOSIT_LIABILITY"
  | "COD_CLEARING"
  | "PAYOUT_CLEARING"
  | "REFUND_CLEARING"
  | "ADJUSTMENT_CLEARING";

export type LedgerEntryType =
  | "DEPOSIT"
  | "PLATFORM_FEE"
  | "PROVIDER_SHARE"
  | "MARKETER_COMMISSION"
  | "COD_REMAINING"
  | "PAYOUT"
  | "REFUND"
  | "ADJUSTMENT";

export type LedgerEntrySide = "DEBIT" | "CREDIT";
export type LedgerLinkKind = "BOOKING" | "ORDER";
export type LedgerActorKind = "SYSTEM" | "TEST" | "STAFF_FINANCE";

export interface JournalLineInput {
  readonly accountType: LedgerAccountType;
  readonly entryType: LedgerEntryType;
  readonly side: LedgerEntrySide;
  readonly amountMinorUnits: string;
}

export interface PostJournalInput {
  readonly actorKind: LedgerActorKind;
  readonly actorId: string;
  readonly idempotencyKey: string;
  readonly countryId: string;
  readonly currencyCode: string;
  readonly lines: readonly JournalLineInput[];
  readonly bookingId?: string;
  readonly linkKind?: LedgerLinkKind;
}

export interface PostAdjustmentInput {
  readonly actorKind: "STAFF_FINANCE";
  readonly actorId: string;
  readonly idempotencyKey: string;
  readonly reason: string;
  readonly originalJournalId: string;
  readonly lines: readonly JournalLineInput[];
}

export interface CreateSnapshotInput {
  readonly actorKind: LedgerActorKind;
  readonly actorId: string;
  readonly idempotencyKey: string;
  readonly bookingId?: string;
  readonly accountType?: LedgerAccountType;
  readonly countryId: string;
  readonly currencyCode: string;
}

export interface DerivedBalance {
  readonly accountType: LedgerAccountType;
  readonly countryId: string;
  readonly currencyCode: string;
  readonly debitMinorUnits: string;
  readonly creditMinorUnits: string;
  readonly balanceMinorUnits: string;
}

export type ReconcileStatus = "BALANCED" | "MISSING" | "MISMATCHED" | "NOT_READY";

export interface BookingReconcileResult {
  readonly bookingId: string;
  readonly status: ReconcileStatus;
  readonly requiredDepositMinorUnits: string | null;
  readonly postedDepositMinorUnits: string;
  readonly bookingStatus: string;
}

export interface LedgerEntryView {
  readonly journalId: string;
  readonly entryId: string;
  readonly accountType: LedgerAccountType;
  readonly entryType: LedgerEntryType;
  readonly side: LedgerEntrySide;
  readonly amountMinorUnits: string;
  readonly currencyCode: string;
  readonly bookingId: string | null;
}

export type PaymentPurpose = "BOOKING_DEPOSIT";
export type PaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
export type PaymentAttemptStatus =
  | "CREATED"
  | "REDIRECTED"
  | "PENDING"
  | "SUCCEEDED"
  | "FAILED"
  | "EXPIRED";
export type PaymentRailProvider = "PAYMOB" | "OTHER_DISABLED";
export type PaymentMethodKind = "CARD" | "WALLET" | "OTHER";

export interface PaymentMethodPublic {
  readonly id: string;
  readonly countryId: string;
  readonly code: string;
  readonly provider: PaymentRailProvider;
  readonly methodKind: PaymentMethodKind;
  readonly displayNameAr: string;
  readonly displayNameEn: string;
  readonly enabled: boolean;
  readonly sortOrder: number;
}

export interface InitiateDepositResult {
  readonly paymentId: string;
  readonly attemptId: string;
  readonly status: "PENDING" | "CREATED" | "REDIRECTED";
  readonly amountMinorUnits: string;
  readonly currencyCode: string;
  readonly currencyDecimalPlaces: number;
  readonly gateway: {
    readonly provider: "PAYMOB";
    readonly redirectUrl?: string;
    readonly sessionRef?: string;
  };
  readonly returnToken: string;
}

export interface BrowserReturnStatus {
  readonly paymentId: string | null;
  readonly attemptId: string | null;
  readonly paymentStatus: PaymentStatus | "UNKNOWN";
  readonly bookingStatus: string;
  readonly message: string;
}

export interface PaymentPublicView {
  readonly paymentId: string;
  readonly bookingId: string;
  readonly purpose: PaymentPurpose;
  readonly status: PaymentStatus;
  readonly amountMinorUnits: string;
  readonly currencyCode: string;
  readonly currencyDecimalPlaces: number;
  readonly methodCode: string;
  readonly receipt?: {
    readonly receiptId: string;
    readonly issuedAt: string;
    readonly providerRef?: string;
  };
}

export type PaymentsErrorCode =
  | "VALIDATION_FAILED"
  | "JOURNAL_UNBALANCED"
  | "CURRENCY_MISMATCH"
  | "ACCOUNT_NOT_SEEDED"
  | "ENTRY_TYPE_NOT_POSTABLE"
  | "LINK_KIND_NOT_AVAILABLE"
  | "IDEMPOTENCY_CONFLICT"
  | "DEPENDENCY_FAILURE"
  | "ADJUSTMENT_REASON_REQUIRED"
  | "WALLET_PROHIBITED"
  | "SNAPSHOT_HASH_MISMATCH"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "CONFLICT"
  | "TRANSITION_NOT_AVAILABLE"
  | "GATEWAY_MISCONFIGURED"
  | "WEBHOOK_SIGNATURE_INVALID"
  | "PAYMENT_ALREADY_SUCCEEDED"
  | "AMOUNT_MISMATCH"
  | "AUTHENTICATION_REQUIRED";

export interface PaymentsError extends Error {
  readonly code: PaymentsErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface PaymentsApplicationService {
  postJournal(input: PostJournalInput): Promise<{ readonly journalId: string }>;
  postAdjustment(
    input: PostAdjustmentInput,
  ): Promise<{ readonly adjustmentId: string; readonly journalId: string }>;
  createSnapshot(input: CreateSnapshotInput): Promise<{ readonly snapshotId: string }>;
  getDerivedBalance(input: {
    readonly countryId: string;
    readonly currencyCode: string;
    readonly accountType: LedgerAccountType;
  }): Promise<DerivedBalance>;
  listEntries(input: {
    readonly journalId?: string;
    readonly bookingId?: string;
  }): Promise<readonly LedgerEntryView[]>;
  reconcileBooking(input: {
    readonly bookingId: string;
  }): Promise<BookingReconcileResult>;
  createAccount(input: unknown): Promise<never>;

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
    readonly amountMinorUnits?: string;
  }): Promise<{ readonly refundRequestId: string; readonly status: "REQUESTED" }>;
}

export const PAYMENTS_PUBLIC_CONTRACT = {
  contractVersion: "payments.public.v2",
  module: "payments",
} as const;

export {
  createPaymentsApplicationService,
  type PaymentsApplicationServiceDependencies,
} from "./payments.service.js";

export { isPaymentsError } from "./payments.errors.js";

export type {
  PaymentGatewayPort,
  CreateDepositSessionInput,
  CreateDepositSessionResult,
  ParsedWebhookEvent,
} from "./adapters/payment-gateway.port.js";

export { FakePaymentGateway } from "./adapters/fake.payment-gateway.js";
export { PaymobPaymentGateway } from "./adapters/paymob.gateway.js";
