import type {
  LedgerAccountType,
  LedgerActorKind,
  LedgerEntrySide,
  LedgerEntryType,
  LedgerLinkKind,
  PaymentAttemptStatus,
  PaymentMethodKind,
  PaymentPurpose,
  PaymentRailProvider,
  PaymentStatus,
} from "./payments.public.js";

export interface LedgerAccountRow {
  readonly id: string;
  readonly countryId: string;
  readonly currencyCode: string;
  readonly currencyDecimalPlaces: number;
  readonly accountType: LedgerAccountType;
}

export interface LedgerEntryRow {
  readonly id: string;
  readonly journalId: string;
  readonly accountId: string;
  readonly countryId: string;
  readonly accountType: LedgerAccountType;
  readonly entryType: LedgerEntryType;
  readonly side: LedgerEntrySide;
  readonly amountMinorUnits: string;
  readonly currencyCode: string;
  readonly bookingId: string | null;
}

export interface IdempotencyRow {
  readonly payloadHash: string;
  readonly journalId: string | null;
  readonly snapshotId: string | null;
  readonly adjustmentId: string | null;
}

export interface InsertJournalInput {
  readonly journalId: string;
  readonly lines: readonly {
    readonly id: string;
    readonly accountId: string;
    readonly entryType: LedgerEntryType;
    readonly side: LedgerEntrySide;
    readonly amountMinorUnits: string;
    readonly currencyCode: string;
    readonly currencyDecimalPlaces: number;
  }[];
  readonly bookingId?: string;
}

export interface InsertAdjustmentInput {
  readonly id: string;
  readonly actorKind: LedgerActorKind;
  readonly actorId: string;
  readonly reason: string;
  readonly originalJournalId: string;
  readonly reversingJournalId: string;
}

export interface InsertSnapshotInput {
  readonly id: string;
  readonly subjectKind: "ACCOUNT" | "BOOKING";
  readonly accountId?: string;
  readonly bookingId?: string;
  readonly currencyCode: string;
  readonly currencyDecimalPlaces: number;
  readonly debitMinorUnits: string;
  readonly creditNetMinorUnits: string;
  readonly derivedBalanceMinorUnits: string;
  readonly entryIdHash: string;
}

export interface PaymentMethodRow {
  readonly id: string;
  readonly countryId: string;
  readonly provider: PaymentRailProvider;
  readonly methodKind: PaymentMethodKind;
  readonly code: string;
  readonly displayNameAr: string;
  readonly displayNameEn: string;
  readonly enabled: boolean;
  readonly sortOrder: number;
}

export interface PaymentRow {
  readonly id: string;
  readonly bookingId: string;
  readonly customerUserId: string;
  readonly purpose: PaymentPurpose;
  readonly status: PaymentStatus;
  readonly amountMinorUnits: string;
  readonly currencyCode: string;
  readonly currencyDecimalPlaces: number;
  readonly paymentMethodId: string;
  readonly succeededAttemptId: string | null;
  readonly ledgerJournalId: string | null;
}

export interface PaymentAttemptRow {
  readonly id: string;
  readonly paymentId: string;
  readonly bookingId: string;
  readonly customerUserId: string;
  readonly paymentMethodId: string;
  readonly status: PaymentAttemptStatus;
  readonly amountMinorUnits: string;
  readonly currencyCode: string;
  readonly currencyDecimalPlaces: number;
  readonly idempotencyKey: string;
  readonly gatewaySessionRef: string | null;
  readonly redirectUrl: string | null;
  readonly failureCode: string | null;
  readonly failureMessageSafe: string | null;
  readonly expiresAt: Date | null;
  readonly returnTokenHash: string | null;
}

export interface PaymentGatewayEventRow {
  readonly id: string;
  readonly provider: PaymentRailProvider;
  readonly idempotencyKey: string;
  readonly paymentAttemptId: string | null;
  readonly paymentId: string | null;
  readonly eventType: string;
  readonly signatureValid: boolean;
  readonly status: "RECEIVED" | "PROCESSED" | "IGNORED" | "REJECTED";
  readonly payloadHash: string;
  readonly processedAt: Date | null;
}

export interface PaymentReceiptRow {
  readonly id: string;
  readonly paymentId: string;
  readonly bookingId: string;
  readonly customerUserId: string;
  readonly amountMinorUnits: string;
  readonly currencyCode: string;
  readonly currencyDecimalPlaces: number;
  readonly methodCode: string;
  readonly providerRef: string | null;
  readonly issuedAt: Date;
}

export interface RefundRequestRow {
  readonly id: string;
  readonly paymentId: string;
  readonly bookingId: string;
  readonly customerUserId: string;
  readonly amountMinorUnits: string;
  readonly currencyCode: string;
  readonly currencyDecimalPlaces: number;
  readonly status: "REQUESTED";
  readonly reason: string | null;
}

export interface PaymentsRepository {
  findAccounts(
    countryId: string,
    currencyCode: string,
  ): Promise<readonly LedgerAccountRow[]>;
  findIdempotency(input: {
    readonly commandType: "POST_JOURNAL" | "POST_ADJUSTMENT" | "CREATE_SNAPSHOT";
    readonly actorKind: LedgerActorKind;
    readonly actorId: string;
    readonly idempotencyKey: string;
  }): Promise<IdempotencyRow | null>;
  insertIdempotency(input: {
    readonly commandType: "POST_JOURNAL" | "POST_ADJUSTMENT" | "CREATE_SNAPSHOT";
    readonly actorKind: LedgerActorKind;
    readonly actorId: string;
    readonly idempotencyKey: string;
    readonly payloadHash: string;
    readonly journalId?: string;
    readonly snapshotId?: string;
    readonly adjustmentId?: string;
  }): Promise<void>;
  insertJournal(input: InsertJournalInput): Promise<void>;
  findJournalEntries(journalId: string): Promise<readonly LedgerEntryRow[]>;
  listEntriesByAccount(accountId: string): Promise<readonly LedgerEntryRow[]>;
  listEntriesByBooking(bookingId: string): Promise<readonly LedgerEntryRow[]>;
  listEntriesByJournal(journalId: string): Promise<readonly LedgerEntryRow[]>;
  insertAdjustment(input: InsertAdjustmentInput): Promise<void>;
  insertSnapshot(input: InsertSnapshotInput): Promise<void>;

  listEnabledPaymentMethods(countryId: string): Promise<readonly PaymentMethodRow[]>;
  findPaymentMethodById(methodId: string): Promise<PaymentMethodRow | null>;
  setPaymentMethodEnabled(
    methodId: string,
    enabled: boolean,
  ): Promise<PaymentMethodRow | null>;

  findSucceededDepositPayment(bookingId: string): Promise<PaymentRow | null>;
  findPaymentById(paymentId: string): Promise<PaymentRow | null>;
  findAttemptByIdempotency(input: {
    readonly customerUserId: string;
    readonly bookingId: string;
    readonly idempotencyKey: string;
  }): Promise<PaymentAttemptRow | null>;
  findAttemptById(attemptId: string): Promise<PaymentAttemptRow | null>;
  findAttemptByGatewaySessionRef(
    sessionRef: string,
  ): Promise<PaymentAttemptRow | null>;
  insertPayment(input: {
    readonly id: string;
    readonly bookingId: string;
    readonly customerUserId: string;
    readonly purpose: PaymentPurpose;
    readonly status: PaymentStatus;
    readonly amountMinorUnits: string;
    readonly currencyCode: string;
    readonly currencyDecimalPlaces: number;
    readonly paymentMethodId: string;
  }): Promise<PaymentRow>;
  insertAttempt(input: {
    readonly id: string;
    readonly paymentId: string;
    readonly bookingId: string;
    readonly customerUserId: string;
    readonly paymentMethodId: string;
    readonly status: PaymentAttemptStatus;
    readonly amountMinorUnits: string;
    readonly currencyCode: string;
    readonly currencyDecimalPlaces: number;
    readonly idempotencyKey: string;
    readonly gatewaySessionRef?: string;
    readonly redirectUrl?: string;
    readonly returnTokenHash?: string;
    readonly expiresAt?: Date;
  }): Promise<PaymentAttemptRow>;
  updateAttemptGateway(input: {
    readonly attemptId: string;
    readonly status: PaymentAttemptStatus;
    readonly gatewaySessionRef: string;
    readonly redirectUrl: string;
    readonly returnTokenHash: string;
  }): Promise<void>;
  markAttemptTerminal(input: {
    readonly attemptId: string;
    readonly status: "FAILED" | "EXPIRED" | "SUCCEEDED";
    readonly failureCode?: string;
    readonly failureMessageSafe?: string;
  }): Promise<void>;
  markPaymentSucceeded(input: {
    readonly paymentId: string;
    readonly succeededAttemptId: string;
    readonly ledgerJournalId: string;
  }): Promise<void>;
  markPaymentFailed(paymentId: string): Promise<void>;

  findGatewayEvent(
    provider: PaymentRailProvider,
    idempotencyKey: string,
  ): Promise<PaymentGatewayEventRow | null>;
  insertGatewayEvent(input: {
    readonly id: string;
    readonly provider: PaymentRailProvider;
    readonly idempotencyKey: string;
    readonly paymentAttemptId?: string;
    readonly paymentId?: string;
    readonly eventType: string;
    readonly signatureValid: boolean;
    readonly status: "RECEIVED" | "PROCESSED" | "IGNORED" | "REJECTED";
    readonly payloadHash: string;
    readonly processedAt?: Date;
  }): Promise<PaymentGatewayEventRow>;
  markGatewayEventProcessed(input: {
    readonly eventId: string;
    readonly status: "PROCESSED" | "IGNORED" | "REJECTED";
    readonly paymentAttemptId?: string;
    readonly paymentId?: string;
    readonly processedAt: Date;
  }): Promise<void>;

  findReceiptByPaymentId(paymentId: string): Promise<PaymentReceiptRow | null>;
  insertReceipt(input: {
    readonly id: string;
    readonly paymentId: string;
    readonly bookingId: string;
    readonly customerUserId: string;
    readonly amountMinorUnits: string;
    readonly currencyCode: string;
    readonly currencyDecimalPlaces: number;
    readonly methodCode: string;
    readonly providerRef?: string;
    readonly issuedAt: Date;
  }): Promise<PaymentReceiptRow>;

  insertRefundRequest(input: {
    readonly id: string;
    readonly paymentId: string;
    readonly bookingId: string;
    readonly customerUserId: string;
    readonly amountMinorUnits: string;
    readonly currencyCode: string;
    readonly currencyDecimalPlaces: number;
    readonly reason?: string;
    readonly requestedByActorKind: string;
    readonly requestedByActorId: string;
  }): Promise<RefundRequestRow>;
}

export interface PaymentsUnitOfWork {
  run<T>(work: (repository: PaymentsRepository) => Promise<T>): Promise<T>;
}

/** Thrown when the idempotency unique key is already reserved in another write. */
export class PaymentsIdempotencyCollision extends Error {
  public constructor() {
    super("Payments idempotency key already reserved");
    this.name = "PaymentsIdempotencyCollision";
  }
}

export type { LedgerLinkKind };
