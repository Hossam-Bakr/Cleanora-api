import type {
  IdempotencyRow,
  InsertAdjustmentInput,
  InsertJournalInput,
  InsertSnapshotInput,
  LedgerAccountRow,
  LedgerEntryRow,
  PaymentAttemptRow,
  PaymentGatewayEventRow,
  PaymentMethodRow,
  PaymentReceiptRow,
  PaymentRow,
  PaymentsRepository,
  PaymentsUnitOfWork,
  RefundRequestRow,
} from "#modules/payments/payments.repository";
import { PaymentsIdempotencyCollision } from "#modules/payments/payments.repository";
import type {
  LedgerAccountType,
  PaymentAttemptStatus,
  PaymentPurpose,
  PaymentRailProvider,
  PaymentStatus,
} from "#modules/payments/payments.public";

const ACCOUNT_TYPES: readonly LedgerAccountType[] = [
  "PLATFORM_CLEARING",
  "PLATFORM_REVENUE",
  "PROVIDER_PAYABLE",
  "CUSTOMER_DEPOSIT_LIABILITY",
  "COD_CLEARING",
  "PAYOUT_CLEARING",
  "REFUND_CLEARING",
  "ADJUSTMENT_CLEARING",
];

/**
 * @desc In-memory payments persistence for unit tests (P14 + P15).
 * @access Test helper
 */
export class InMemoryPaymentsRepository implements PaymentsRepository {
  public readonly accounts: LedgerAccountRow[] = [];
  public readonly entries: LedgerEntryRow[] = [];
  public readonly idempotency = new Map<string, IdempotencyRow>();
  public readonly adjustments: InsertAdjustmentInput[] = [];
  public readonly snapshots: InsertSnapshotInput[] = [];
  public readonly methods: PaymentMethodRow[] = [];
  public readonly payments: PaymentRow[] = [];
  public readonly attempts: PaymentAttemptRow[] = [];
  public readonly gatewayEvents: PaymentGatewayEventRow[] = [];
  public readonly receipts: PaymentReceiptRow[] = [];
  public readonly refundRequests: RefundRequestRow[] = [];

  public seedEgypt(countryId = "country-eg"): void {
    for (const accountType of ACCOUNT_TYPES) {
      this.accounts.push({
        id: `acc-${accountType}`,
        countryId,
        currencyCode: "EGP",
        currencyDecimalPlaces: 2,
        accountType,
      });
    }
    this.methods.push(
      {
        id: "method-card",
        countryId,
        provider: "PAYMOB",
        methodKind: "CARD",
        code: "PAYMOB_CARD",
        displayNameAr: "بطاقة",
        displayNameEn: "Card",
        enabled: true,
        sortOrder: 10,
      },
      {
        id: "method-wallet",
        countryId,
        provider: "PAYMOB",
        methodKind: "WALLET",
        code: "PAYMOB_WALLET",
        displayNameAr: "محفظة",
        displayNameEn: "Wallet",
        enabled: true,
        sortOrder: 20,
      },
      {
        id: "method-other",
        countryId,
        provider: "OTHER_DISABLED",
        methodKind: "OTHER",
        code: "OTHER_DISABLED",
        displayNameAr: "أخرى",
        displayNameEn: "Other",
        enabled: false,
        sortOrder: 90,
      },
    );
  }

  public async findAccounts(
    countryId: string,
    currencyCode: string,
  ): Promise<readonly LedgerAccountRow[]> {
    return this.accounts.filter(
      (account) =>
        account.countryId === countryId && account.currencyCode === currencyCode,
    );
  }

  public async findIdempotency(input: {
    readonly commandType: string;
    readonly actorKind: string;
    readonly actorId: string;
    readonly idempotencyKey: string;
  }): Promise<IdempotencyRow | null> {
    return this.idempotency.get(idempotencyKey(input)) ?? null;
  }

  public async insertIdempotency(input: {
    readonly commandType: string;
    readonly actorKind: string;
    readonly actorId: string;
    readonly idempotencyKey: string;
    readonly payloadHash: string;
    readonly journalId?: string;
    readonly snapshotId?: string;
    readonly adjustmentId?: string;
  }): Promise<void> {
    const key = idempotencyKey(input);
    if (this.idempotency.has(key)) {
      throw new PaymentsIdempotencyCollision();
    }
    this.idempotency.set(key, {
      payloadHash: input.payloadHash,
      journalId: input.journalId ?? null,
      snapshotId: input.snapshotId ?? null,
      adjustmentId: input.adjustmentId ?? null,
    });
  }

  public async insertJournal(input: InsertJournalInput): Promise<void> {
    for (const line of input.lines) {
      const account = this.accounts.find((row) => row.id === line.accountId);
      this.entries.push({
        id: line.id,
        journalId: input.journalId,
        accountId: line.accountId,
        countryId: account?.countryId ?? "",
        accountType: account?.accountType ?? "PLATFORM_CLEARING",
        entryType: line.entryType,
        side: line.side,
        amountMinorUnits: line.amountMinorUnits,
        currencyCode: line.currencyCode,
        bookingId: input.bookingId ?? null,
      });
    }
  }

  public async findJournalEntries(
    journalId: string,
  ): Promise<readonly LedgerEntryRow[]> {
    return this.entries.filter((entry) => entry.journalId === journalId);
  }

  public async listEntriesByAccount(
    accountId: string,
  ): Promise<readonly LedgerEntryRow[]> {
    return this.entries.filter((entry) => entry.accountId === accountId);
  }

  public async listEntriesByBooking(
    bookingId: string,
  ): Promise<readonly LedgerEntryRow[]> {
    return this.entries.filter((entry) => entry.bookingId === bookingId);
  }

  public async listEntriesByJournal(
    journalId: string,
  ): Promise<readonly LedgerEntryRow[]> {
    return this.findJournalEntries(journalId);
  }

  public async insertAdjustment(input: InsertAdjustmentInput): Promise<void> {
    this.adjustments.push(input);
  }

  public async insertSnapshot(input: InsertSnapshotInput): Promise<void> {
    this.snapshots.push(input);
  }

  public async listEnabledPaymentMethods(
    countryId: string,
  ): Promise<readonly PaymentMethodRow[]> {
    return this.methods
      .filter((method) => method.countryId === countryId && method.enabled)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  public async findPaymentMethodById(
    methodId: string,
  ): Promise<PaymentMethodRow | null> {
    return this.methods.find((method) => method.id === methodId) ?? null;
  }

  public async setPaymentMethodEnabled(
    methodId: string,
    enabled: boolean,
  ): Promise<PaymentMethodRow | null> {
    const method = this.methods.find((row) => row.id === methodId);
    if (method === undefined) {
      return null;
    }
    const updated = { ...method, enabled };
    const index = this.methods.findIndex((row) => row.id === methodId);
    this.methods[index] = updated;
    return updated;
  }

  public async findSucceededDepositPayment(
    bookingId: string,
  ): Promise<PaymentRow | null> {
    return (
      this.payments.find(
        (payment) =>
          payment.bookingId === bookingId &&
          payment.purpose === "BOOKING_DEPOSIT" &&
          payment.status === "SUCCEEDED",
      ) ?? null
    );
  }

  public async findPaymentById(paymentId: string): Promise<PaymentRow | null> {
    return this.payments.find((payment) => payment.id === paymentId) ?? null;
  }

  public async findAttemptByIdempotency(input: {
    readonly customerUserId: string;
    readonly bookingId: string;
    readonly idempotencyKey: string;
  }): Promise<PaymentAttemptRow | null> {
    return (
      this.attempts.find(
        (attempt) =>
          attempt.customerUserId === input.customerUserId &&
          attempt.bookingId === input.bookingId &&
          attempt.idempotencyKey === input.idempotencyKey,
      ) ?? null
    );
  }

  public async findAttemptById(
    attemptId: string,
  ): Promise<PaymentAttemptRow | null> {
    return this.attempts.find((attempt) => attempt.id === attemptId) ?? null;
  }

  public async findAttemptByGatewaySessionRef(
    sessionRef: string,
  ): Promise<PaymentAttemptRow | null> {
    return (
      this.attempts.find((attempt) => attempt.gatewaySessionRef === sessionRef) ??
      null
    );
  }

  public async insertPayment(input: {
    readonly id: string;
    readonly bookingId: string;
    readonly customerUserId: string;
    readonly purpose: PaymentPurpose;
    readonly status: PaymentStatus;
    readonly amountMinorUnits: string;
    readonly currencyCode: string;
    readonly currencyDecimalPlaces: number;
    readonly paymentMethodId: string;
  }): Promise<PaymentRow> {
    const row: PaymentRow = {
      ...input,
      succeededAttemptId: null,
      ledgerJournalId: null,
    };
    this.payments.push(row);
    return row;
  }

  public async insertAttempt(input: {
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
  }): Promise<PaymentAttemptRow> {
    if (
      this.attempts.some(
        (attempt) =>
          attempt.customerUserId === input.customerUserId &&
          attempt.bookingId === input.bookingId &&
          attempt.idempotencyKey === input.idempotencyKey,
      )
    ) {
      throw new PaymentsIdempotencyCollision();
    }
    const row: PaymentAttemptRow = {
      id: input.id,
      paymentId: input.paymentId,
      bookingId: input.bookingId,
      customerUserId: input.customerUserId,
      paymentMethodId: input.paymentMethodId,
      status: input.status,
      amountMinorUnits: input.amountMinorUnits,
      currencyCode: input.currencyCode,
      currencyDecimalPlaces: input.currencyDecimalPlaces,
      idempotencyKey: input.idempotencyKey,
      gatewaySessionRef: input.gatewaySessionRef ?? null,
      redirectUrl: input.redirectUrl ?? null,
      failureCode: null,
      failureMessageSafe: null,
      expiresAt: input.expiresAt ?? null,
      returnTokenHash: input.returnTokenHash ?? null,
    };
    this.attempts.push(row);
    return row;
  }

  public async updateAttemptGateway(input: {
    readonly attemptId: string;
    readonly status: PaymentAttemptStatus;
    readonly gatewaySessionRef: string;
    readonly redirectUrl: string;
    readonly returnTokenHash: string;
  }): Promise<void> {
    const index = this.attempts.findIndex((row) => row.id === input.attemptId);
    const current = this.attempts[index];
    if (current === undefined) {
      return;
    }
    this.attempts[index] = {
      ...current,
      status: input.status,
      gatewaySessionRef: input.gatewaySessionRef,
      redirectUrl: input.redirectUrl,
      returnTokenHash: input.returnTokenHash,
    };
  }

  public async markAttemptTerminal(input: {
    readonly attemptId: string;
    readonly status: "FAILED" | "EXPIRED" | "SUCCEEDED";
    readonly failureCode?: string;
    readonly failureMessageSafe?: string;
  }): Promise<void> {
    const index = this.attempts.findIndex((row) => row.id === input.attemptId);
    const current = this.attempts[index];
    if (current === undefined) {
      return;
    }
    this.attempts[index] = {
      ...current,
      status: input.status,
      failureCode: input.failureCode ?? null,
      failureMessageSafe: input.failureMessageSafe ?? null,
    };
  }

  public async markPaymentSucceeded(input: {
    readonly paymentId: string;
    readonly succeededAttemptId: string;
    readonly ledgerJournalId: string;
  }): Promise<void> {
    const index = this.payments.findIndex((row) => row.id === input.paymentId);
    const current = this.payments[index];
    if (current === undefined) {
      return;
    }
    if (
      this.payments.some(
        (payment) =>
          payment.bookingId === current.bookingId &&
          payment.purpose === "BOOKING_DEPOSIT" &&
          payment.status === "SUCCEEDED" &&
          payment.id !== current.id,
      )
    ) {
      throw new Error("partial unique succeeded deposit violated");
    }
    this.payments[index] = {
      ...current,
      status: "SUCCEEDED",
      succeededAttemptId: input.succeededAttemptId,
      ledgerJournalId: input.ledgerJournalId,
    };
  }

  public async markPaymentFailed(paymentId: string): Promise<void> {
    const index = this.payments.findIndex((row) => row.id === paymentId);
    const current = this.payments[index];
    if (current === undefined) {
      return;
    }
    this.payments[index] = { ...current, status: "FAILED" };
  }

  public async findGatewayEvent(
    provider: PaymentRailProvider,
    key: string,
  ): Promise<PaymentGatewayEventRow | null> {
    return (
      this.gatewayEvents.find(
        (event) => event.provider === provider && event.idempotencyKey === key,
      ) ?? null
    );
  }

  public async insertGatewayEvent(input: {
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
  }): Promise<PaymentGatewayEventRow> {
    if (
      this.gatewayEvents.some(
        (event) =>
          event.provider === input.provider &&
          event.idempotencyKey === input.idempotencyKey,
      )
    ) {
      throw new PaymentsIdempotencyCollision();
    }
    const row: PaymentGatewayEventRow = {
      id: input.id,
      provider: input.provider,
      idempotencyKey: input.idempotencyKey,
      paymentAttemptId: input.paymentAttemptId ?? null,
      paymentId: input.paymentId ?? null,
      eventType: input.eventType,
      signatureValid: input.signatureValid,
      status: input.status,
      payloadHash: input.payloadHash,
      processedAt: input.processedAt ?? null,
    };
    this.gatewayEvents.push(row);
    return row;
  }

  public async markGatewayEventProcessed(input: {
    readonly eventId: string;
    readonly status: "PROCESSED" | "IGNORED" | "REJECTED";
    readonly paymentAttemptId?: string;
    readonly paymentId?: string;
    readonly processedAt: Date;
  }): Promise<void> {
    const index = this.gatewayEvents.findIndex((row) => row.id === input.eventId);
    const current = this.gatewayEvents[index];
    if (current === undefined) {
      return;
    }
    this.gatewayEvents[index] = {
      ...current,
      status: input.status,
      processedAt: input.processedAt,
      paymentAttemptId: input.paymentAttemptId ?? current.paymentAttemptId,
      paymentId: input.paymentId ?? current.paymentId,
    };
  }

  public async findReceiptByPaymentId(
    paymentId: string,
  ): Promise<PaymentReceiptRow | null> {
    return this.receipts.find((receipt) => receipt.paymentId === paymentId) ?? null;
  }

  public async insertReceipt(input: {
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
  }): Promise<PaymentReceiptRow> {
    const row: PaymentReceiptRow = {
      id: input.id,
      paymentId: input.paymentId,
      bookingId: input.bookingId,
      customerUserId: input.customerUserId,
      amountMinorUnits: input.amountMinorUnits,
      currencyCode: input.currencyCode,
      currencyDecimalPlaces: input.currencyDecimalPlaces,
      methodCode: input.methodCode,
      providerRef: input.providerRef ?? null,
      issuedAt: input.issuedAt,
    };
    this.receipts.push(row);
    return row;
  }

  public async insertRefundRequest(input: {
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
  }): Promise<RefundRequestRow> {
    const row: RefundRequestRow = {
      id: input.id,
      paymentId: input.paymentId,
      bookingId: input.bookingId,
      customerUserId: input.customerUserId,
      amountMinorUnits: input.amountMinorUnits,
      currencyCode: input.currencyCode,
      currencyDecimalPlaces: input.currencyDecimalPlaces,
      status: "REQUESTED",
      reason: input.reason ?? null,
    };
    this.refundRequests.push(row);
    return row;
  }
}

export function createInMemoryPaymentsUnitOfWork(
  repository = new InMemoryPaymentsRepository(),
): {
  readonly unitOfWork: PaymentsUnitOfWork;
  readonly repository: InMemoryPaymentsRepository;
} {
  return {
    repository,
    unitOfWork: {
      run: async (work) => work(repository),
    },
  };
}

function idempotencyKey(input: {
  readonly commandType: string;
  readonly actorKind: string;
  readonly actorId: string;
  readonly idempotencyKey: string;
}): string {
  return `${input.commandType}:${input.actorKind}:${input.actorId}:${input.idempotencyKey}`;
}
