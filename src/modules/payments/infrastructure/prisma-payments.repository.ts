import { Prisma } from "#generated/prisma/client";

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
  RefundRequestRow,
} from "../payments.repository.js";
import { PaymentsIdempotencyCollision } from "../payments.repository.js";
import type {
  LedgerAccountType,
  PaymentPurpose,
  PaymentRailProvider,
  PaymentStatus,
  PaymentAttemptStatus,
} from "../payments.public.js";

type PaymentsClient = Prisma.TransactionClient;
/**
 * @desc Payments-owned Prisma repository.
 * @access Payments infrastructure
 */
export class PrismaPaymentsRepository implements PaymentsRepository {
  public constructor(private readonly client: PaymentsClient) {}

  public async findAccounts(
    countryId: string,
    currencyCode: string,
  ): Promise<readonly LedgerAccountRow[]> {
    const rows = await this.client.ledgerAccount.findMany({
      where: { countryId, currencyCode },
    });
    return rows.map((row) => ({
      id: row.id,
      countryId: row.countryId,
      currencyCode: row.currencyCode,
      currencyDecimalPlaces: row.currencyDecimalPlaces,
      accountType: row.accountType,
    }));
  }

  public async findIdempotency(input: {
    readonly commandType: "POST_JOURNAL" | "POST_ADJUSTMENT" | "CREATE_SNAPSHOT";
    readonly actorKind: IdempotencyRow extends never ? never : string;
    readonly actorId: string;
    readonly idempotencyKey: string;
  }): Promise<IdempotencyRow | null> {
    const row = await this.client.financialIdempotencyKey.findUnique({
      where: {
        commandType_actorKind_actorId_idempotencyKey: {
          commandType: input.commandType,
          actorKind: input.actorKind as never,
          actorId: input.actorId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (row === null) {
      return null;
    }
    return {
      payloadHash: row.payloadHash,
      journalId: row.journalId,
      snapshotId: row.snapshotId,
      adjustmentId: row.adjustmentId,
    };
  }

  public async insertIdempotency(input: {
    readonly commandType: "POST_JOURNAL" | "POST_ADJUSTMENT" | "CREATE_SNAPSHOT";
    readonly actorKind: string;
    readonly actorId: string;
    readonly idempotencyKey: string;
    readonly payloadHash: string;
    readonly journalId?: string;
    readonly snapshotId?: string;
    readonly adjustmentId?: string;
  }): Promise<void> {
    try {
      await this.client.financialIdempotencyKey.create({
        data: {
          commandType: input.commandType,
          actorKind: input.actorKind as never,
          actorId: input.actorId,
          idempotencyKey: input.idempotencyKey,
          payloadHash: input.payloadHash,
          journalId: input.journalId ?? null,
          snapshotId: input.snapshotId ?? null,
          adjustmentId: input.adjustmentId ?? null,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new PaymentsIdempotencyCollision();
      }
      throw error;
    }
  }

  public async insertJournal(input: InsertJournalInput): Promise<void> {
    await this.client.ledgerEntry.createMany({
      data: input.lines.map((line) => ({
        id: line.id,
        journalId: input.journalId,
        accountId: line.accountId,
        entryType: line.entryType,
        side: line.side,
        amountMinorUnits: new Prisma.Decimal(line.amountMinorUnits),
        currencyCode: line.currencyCode,
        currencyDecimalPlaces: line.currencyDecimalPlaces,
      })),
    });
    if (input.bookingId !== undefined) {
      await this.client.ledgerEntryLink.create({
        data: {
          journalId: input.journalId,
          kind: "BOOKING",
          bookingId: input.bookingId,
        },
      });
    }
  }

  public async findJournalEntries(
    journalId: string,
  ): Promise<readonly LedgerEntryRow[]> {
    return this.listEntriesByJournal(journalId);
  }

  public async listEntriesByAccount(
    accountId: string,
  ): Promise<readonly LedgerEntryRow[]> {
    const rows = await this.client.ledgerEntry.findMany({
      where: { accountId },
      include: { account: true, links: true },
      orderBy: { createdAt: "asc" },
    });
    const bookingByJournal = await this.bookingIdsByJournal(
      rows.map((row) => row.journalId),
    );
    return rows.map((row) =>
      mapEntry(row, bookingByJournal.get(row.journalId) ?? undefined),
    );
  }

  public async listEntriesByBooking(
    bookingId: string,
  ): Promise<readonly LedgerEntryRow[]> {
    const links = await this.client.ledgerEntryLink.findMany({
      where: { bookingId, kind: "BOOKING" },
    });
    const journalIds = [...new Set(links.map((link) => link.journalId))];
    if (journalIds.length === 0) {
      return [];
    }
    const rows = await this.client.ledgerEntry.findMany({
      where: { journalId: { in: journalIds } },
      include: { account: true, links: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => mapEntry(row, bookingId));
  }

  public async listEntriesByJournal(
    journalId: string,
  ): Promise<readonly LedgerEntryRow[]> {
    const rows = await this.client.ledgerEntry.findMany({
      where: { journalId },
      include: { account: true, links: true },
      orderBy: { createdAt: "asc" },
    });
    const bookingByJournal = await this.bookingIdsByJournal([journalId]);
    return rows.map((row) =>
      mapEntry(row, bookingByJournal.get(journalId) ?? undefined),
    );
  }

  private async bookingIdsByJournal(
    journalIds: readonly string[],
  ): Promise<ReadonlyMap<string, string>> {
    const unique = [...new Set(journalIds)];
    if (unique.length === 0) {
      return new Map();
    }
    const links = await this.client.ledgerEntryLink.findMany({
      where: { journalId: { in: unique }, kind: "BOOKING" },
    });
    const result = new Map<string, string>();
    for (const link of links) {
      if (link.bookingId !== null && !result.has(link.journalId)) {
        result.set(link.journalId, link.bookingId);
      }
    }
    return result;
  }

  public async insertAdjustment(input: InsertAdjustmentInput): Promise<void> {
    await this.client.financialAdjustment.create({
      data: {
        id: input.id,
        actorKind: input.actorKind,
        actorId: input.actorId,
        reason: input.reason,
        originalJournalId: input.originalJournalId,
        reversingJournalId: input.reversingJournalId,
      },
    });
  }

  public async insertSnapshot(input: InsertSnapshotInput): Promise<void> {
    await this.client.financialSnapshot.create({
      data: {
        id: input.id,
        subjectKind: input.subjectKind,
        accountId: input.accountId ?? null,
        bookingId: input.bookingId ?? null,
        currencyCode: input.currencyCode,
        currencyDecimalPlaces: input.currencyDecimalPlaces,
        debitMinorUnits: new Prisma.Decimal(input.debitMinorUnits),
        creditNetMinorUnits: new Prisma.Decimal(input.creditNetMinorUnits),
        derivedBalanceMinorUnits: new Prisma.Decimal(input.derivedBalanceMinorUnits),
        entryIdHash: input.entryIdHash,
      },
    });
  }

  public async listEnabledPaymentMethods(
    countryId: string,
  ): Promise<readonly PaymentMethodRow[]> {
    const rows = await this.client.paymentMethod.findMany({
      where: { countryId, enabled: true },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    });
    return rows.map(mapMethod);
  }

  public async findPaymentMethodById(
    methodId: string,
  ): Promise<PaymentMethodRow | null> {
    const row = await this.client.paymentMethod.findUnique({
      where: { id: methodId },
    });
    return row === null ? null : mapMethod(row);
  }

  public async setPaymentMethodEnabled(
    methodId: string,
    enabled: boolean,
  ): Promise<PaymentMethodRow | null> {
    try {
      const row = await this.client.paymentMethod.update({
        where: { id: methodId },
        data: { enabled },
      });
      return mapMethod(row);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return null;
      }
      throw error;
    }
  }

  public async findSucceededDepositPayment(
    bookingId: string,
  ): Promise<PaymentRow | null> {
    const row = await this.client.payment.findFirst({
      where: {
        bookingId,
        purpose: "BOOKING_DEPOSIT",
        status: "SUCCEEDED",
      },
    });
    return row === null ? null : mapPayment(row);
  }

  public async findPaymentById(paymentId: string): Promise<PaymentRow | null> {
    const row = await this.client.payment.findUnique({ where: { id: paymentId } });
    return row === null ? null : mapPayment(row);
  }

  public async findAttemptByIdempotency(input: {
    readonly customerUserId: string;
    readonly bookingId: string;
    readonly idempotencyKey: string;
  }): Promise<PaymentAttemptRow | null> {
    const row = await this.client.paymentAttempt.findUnique({
      where: {
        customerUserId_bookingId_idempotencyKey: {
          customerUserId: input.customerUserId,
          bookingId: input.bookingId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    return row === null ? null : mapAttempt(row);
  }

  public async findAttemptById(
    attemptId: string,
  ): Promise<PaymentAttemptRow | null> {
    const row = await this.client.paymentAttempt.findUnique({
      where: { id: attemptId },
    });
    return row === null ? null : mapAttempt(row);
  }

  public async findAttemptByGatewaySessionRef(
    sessionRef: string,
  ): Promise<PaymentAttemptRow | null> {
    const row = await this.client.paymentAttempt.findFirst({
      where: { gatewaySessionRef: sessionRef },
    });
    return row === null ? null : mapAttempt(row);
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
    const row = await this.client.payment.create({
      data: {
        id: input.id,
        bookingId: input.bookingId,
        customerUserId: input.customerUserId,
        purpose: input.purpose,
        status: input.status,
        amountMinorUnits: new Prisma.Decimal(input.amountMinorUnits),
        currencyCode: input.currencyCode,
        currencyDecimalPlaces: input.currencyDecimalPlaces,
        paymentMethodId: input.paymentMethodId,
      },
    });
    return mapPayment(row);
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
    try {
      const row = await this.client.paymentAttempt.create({
        data: {
          id: input.id,
          paymentId: input.paymentId,
          bookingId: input.bookingId,
          customerUserId: input.customerUserId,
          paymentMethodId: input.paymentMethodId,
          status: input.status,
          amountMinorUnits: new Prisma.Decimal(input.amountMinorUnits),
          currencyCode: input.currencyCode,
          currencyDecimalPlaces: input.currencyDecimalPlaces,
          idempotencyKey: input.idempotencyKey,
          gatewaySessionRef: input.gatewaySessionRef ?? null,
          redirectUrl: input.redirectUrl ?? null,
          returnTokenHash: input.returnTokenHash ?? null,
          expiresAt: input.expiresAt ?? null,
        },
      });
      return mapAttempt(row);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new PaymentsIdempotencyCollision();
      }
      throw error;
    }
  }

  public async updateAttemptGateway(input: {
    readonly attemptId: string;
    readonly status: PaymentAttemptStatus;
    readonly gatewaySessionRef: string;
    readonly redirectUrl: string;
    readonly returnTokenHash: string;
  }): Promise<void> {
    await this.client.paymentAttempt.update({
      where: { id: input.attemptId },
      data: {
        status: input.status,
        gatewaySessionRef: input.gatewaySessionRef,
        redirectUrl: input.redirectUrl,
        returnTokenHash: input.returnTokenHash,
      },
    });
  }

  public async markAttemptTerminal(input: {
    readonly attemptId: string;
    readonly status: "FAILED" | "EXPIRED" | "SUCCEEDED";
    readonly failureCode?: string;
    readonly failureMessageSafe?: string;
  }): Promise<void> {
    await this.client.paymentAttempt.update({
      where: { id: input.attemptId },
      data: {
        status: input.status,
        failureCode: input.failureCode ?? null,
        failureMessageSafe: input.failureMessageSafe ?? null,
      },
    });
  }

  public async markPaymentSucceeded(input: {
    readonly paymentId: string;
    readonly succeededAttemptId: string;
    readonly ledgerJournalId: string;
  }): Promise<void> {
    await this.client.payment.update({
      where: { id: input.paymentId },
      data: {
        status: "SUCCEEDED",
        succeededAttemptId: input.succeededAttemptId,
        ledgerJournalId: input.ledgerJournalId,
      },
    });
  }

  public async markPaymentFailed(paymentId: string): Promise<void> {
    await this.client.payment.update({
      where: { id: paymentId },
      data: { status: "FAILED" },
    });
  }

  public async findGatewayEvent(
    provider: PaymentRailProvider,
    idempotencyKey: string,
  ): Promise<PaymentGatewayEventRow | null> {
    const row = await this.client.paymentGatewayEvent.findUnique({
      where: {
        provider_idempotencyKey: { provider, idempotencyKey },
      },
    });
    return row === null ? null : mapGatewayEvent(row);
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
    try {
      const row = await this.client.paymentGatewayEvent.create({
        data: {
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
        },
      });
      return mapGatewayEvent(row);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new PaymentsIdempotencyCollision();
      }
      throw error;
    }
  }

  public async markGatewayEventProcessed(input: {
    readonly eventId: string;
    readonly status: "PROCESSED" | "IGNORED" | "REJECTED";
    readonly paymentAttemptId?: string;
    readonly paymentId?: string;
    readonly processedAt: Date;
  }): Promise<void> {
    await this.client.paymentGatewayEvent.update({
      where: { id: input.eventId },
      data: {
        status: input.status,
        processedAt: input.processedAt,
        ...(input.paymentAttemptId === undefined
          ? {}
          : { paymentAttemptId: input.paymentAttemptId }),
        ...(input.paymentId === undefined ? {} : { paymentId: input.paymentId }),
      },
    });
  }

  public async findReceiptByPaymentId(
    paymentId: string,
  ): Promise<PaymentReceiptRow | null> {
    const row = await this.client.paymentReceipt.findUnique({
      where: { paymentId },
    });
    return row === null ? null : mapReceipt(row);
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
    const row = await this.client.paymentReceipt.create({
      data: {
        id: input.id,
        paymentId: input.paymentId,
        bookingId: input.bookingId,
        customerUserId: input.customerUserId,
        amountMinorUnits: new Prisma.Decimal(input.amountMinorUnits),
        currencyCode: input.currencyCode,
        currencyDecimalPlaces: input.currencyDecimalPlaces,
        methodCode: input.methodCode,
        providerRef: input.providerRef ?? null,
        issuedAt: input.issuedAt,
      },
    });
    return mapReceipt(row);
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
    const row = await this.client.refundRequest.create({
      data: {
        id: input.id,
        paymentId: input.paymentId,
        bookingId: input.bookingId,
        customerUserId: input.customerUserId,
        amountMinorUnits: new Prisma.Decimal(input.amountMinorUnits),
        currencyCode: input.currencyCode,
        currencyDecimalPlaces: input.currencyDecimalPlaces,
        status: "REQUESTED",
        reason: input.reason ?? null,
        requestedByActorKind: input.requestedByActorKind,
        requestedByActorId: input.requestedByActorId,
      },
    });
    return {
      id: row.id,
      paymentId: row.paymentId,
      bookingId: row.bookingId,
      customerUserId: row.customerUserId,
      amountMinorUnits: row.amountMinorUnits.toFixed(0),
      currencyCode: row.currencyCode,
      currencyDecimalPlaces: row.currencyDecimalPlaces,
      status: "REQUESTED",
      reason: row.reason,
    };
  }
}

function mapMethod(row: {
  readonly id: string;
  readonly countryId: string;
  readonly provider: PaymentMethodRow["provider"];
  readonly methodKind: PaymentMethodRow["methodKind"];
  readonly code: string;
  readonly displayNameAr: string;
  readonly displayNameEn: string;
  readonly enabled: boolean;
  readonly sortOrder: number;
}): PaymentMethodRow {
  return {
    id: row.id,
    countryId: row.countryId,
    provider: row.provider,
    methodKind: row.methodKind,
    code: row.code,
    displayNameAr: row.displayNameAr,
    displayNameEn: row.displayNameEn,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
  };
}

function mapPayment(row: {
  readonly id: string;
  readonly bookingId: string;
  readonly customerUserId: string;
  readonly purpose: PaymentPurpose;
  readonly status: PaymentStatus;
  readonly amountMinorUnits: Prisma.Decimal;
  readonly currencyCode: string;
  readonly currencyDecimalPlaces: number;
  readonly paymentMethodId: string;
  readonly succeededAttemptId: string | null;
  readonly ledgerJournalId: string | null;
}): PaymentRow {
  return {
    id: row.id,
    bookingId: row.bookingId,
    customerUserId: row.customerUserId,
    purpose: row.purpose,
    status: row.status,
    amountMinorUnits: row.amountMinorUnits.toFixed(0),
    currencyCode: row.currencyCode,
    currencyDecimalPlaces: row.currencyDecimalPlaces,
    paymentMethodId: row.paymentMethodId,
    succeededAttemptId: row.succeededAttemptId,
    ledgerJournalId: row.ledgerJournalId,
  };
}

function mapAttempt(row: {
  readonly id: string;
  readonly paymentId: string;
  readonly bookingId: string;
  readonly customerUserId: string;
  readonly paymentMethodId: string;
  readonly status: PaymentAttemptStatus;
  readonly amountMinorUnits: Prisma.Decimal;
  readonly currencyCode: string;
  readonly currencyDecimalPlaces: number;
  readonly idempotencyKey: string;
  readonly gatewaySessionRef: string | null;
  readonly redirectUrl: string | null;
  readonly failureCode: string | null;
  readonly failureMessageSafe: string | null;
  readonly expiresAt: Date | null;
  readonly returnTokenHash: string | null;
}): PaymentAttemptRow {
  return {
    id: row.id,
    paymentId: row.paymentId,
    bookingId: row.bookingId,
    customerUserId: row.customerUserId,
    paymentMethodId: row.paymentMethodId,
    status: row.status,
    amountMinorUnits: row.amountMinorUnits.toFixed(0),
    currencyCode: row.currencyCode,
    currencyDecimalPlaces: row.currencyDecimalPlaces,
    idempotencyKey: row.idempotencyKey,
    gatewaySessionRef: row.gatewaySessionRef,
    redirectUrl: row.redirectUrl,
    failureCode: row.failureCode,
    failureMessageSafe: row.failureMessageSafe,
    expiresAt: row.expiresAt,
    returnTokenHash: row.returnTokenHash,
  };
}

function mapGatewayEvent(row: {
  readonly id: string;
  readonly provider: PaymentRailProvider;
  readonly idempotencyKey: string;
  readonly paymentAttemptId: string | null;
  readonly paymentId: string | null;
  readonly eventType: string;
  readonly signatureValid: boolean;
  readonly status: PaymentGatewayEventRow["status"];
  readonly payloadHash: string;
  readonly processedAt: Date | null;
}): PaymentGatewayEventRow {
  return {
    id: row.id,
    provider: row.provider,
    idempotencyKey: row.idempotencyKey,
    paymentAttemptId: row.paymentAttemptId,
    paymentId: row.paymentId,
    eventType: row.eventType,
    signatureValid: row.signatureValid,
    status: row.status,
    payloadHash: row.payloadHash,
    processedAt: row.processedAt,
  };
}

function mapReceipt(row: {
  readonly id: string;
  readonly paymentId: string;
  readonly bookingId: string;
  readonly customerUserId: string;
  readonly amountMinorUnits: Prisma.Decimal;
  readonly currencyCode: string;
  readonly currencyDecimalPlaces: number;
  readonly methodCode: string;
  readonly providerRef: string | null;
  readonly issuedAt: Date;
}): PaymentReceiptRow {
  return {
    id: row.id,
    paymentId: row.paymentId,
    bookingId: row.bookingId,
    customerUserId: row.customerUserId,
    amountMinorUnits: row.amountMinorUnits.toFixed(0),
    currencyCode: row.currencyCode,
    currencyDecimalPlaces: row.currencyDecimalPlaces,
    methodCode: row.methodCode,
    providerRef: row.providerRef,
    issuedAt: row.issuedAt,
  };
}

function mapEntry(
  row: {
    readonly id: string;
    readonly journalId: string;
    readonly accountId: string;
    readonly entryType: LedgerEntryRow["entryType"];
    readonly side: LedgerEntryRow["side"];
    readonly amountMinorUnits: Prisma.Decimal;
    readonly currencyCode: string;
    readonly account: { readonly countryId: string; readonly accountType: LedgerAccountType };
    readonly links: readonly { readonly bookingId: string | null }[];
  },
  bookingId?: string,
): LedgerEntryRow {
  return {
    id: row.id,
    journalId: row.journalId,
    accountId: row.accountId,
    countryId: row.account.countryId,
    accountType: row.account.accountType,
    entryType: row.entryType,
    side: row.side,
    amountMinorUnits: row.amountMinorUnits.toFixed(0),
    currencyCode: row.currencyCode,
    bookingId:
      bookingId ??
      row.links.find((link) => link.bookingId !== null)?.bookingId ??
      null,
  };
}
