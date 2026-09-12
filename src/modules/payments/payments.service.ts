import { createHash, randomUUID } from "node:crypto";

import type {
  BookingFinancialSnapshotReader,
  ConfirmDepositPayment,
} from "#modules/bookings/bookings.public";

import type { PaymentGatewayPort } from "./adapters/payment-gateway.port.js";
import { createDepositWorkflows } from "./payments.deposit.js";
import { paymentsError } from "./payments.errors.js";
import {
  assertPostableJournal,
  parsePostJournalInput,
  rejectWalletAccount,
} from "./payments.journal.js";
import {
  addMinorUnits,
  compareMinorUnits,
  requirePositiveMinorUnits,
  signedBalanceMinorUnits,
} from "./payments.money.js";
import type { PaymentsRepository, PaymentsUnitOfWork } from "./payments.repository.js";
import { PaymentsIdempotencyCollision } from "./payments.repository.js";
import type {
  CreateSnapshotInput,
  DerivedBalance,
  LedgerAccountType,
  LedgerEntryView,
  PaymentsApplicationService,
  PostAdjustmentInput,
  PostJournalInput,
} from "./payments.public.js";

export interface PaymentsApplicationServiceDependencies {
  readonly unitOfWork: PaymentsUnitOfWork;
  readonly bookingReader: BookingFinancialSnapshotReader;
  readonly gateway: PaymentGatewayPort;
  readonly confirmDepositPayment: ConfirmDepositPayment;
  readonly returnTokenSecret: string;
  readonly isStaffAdmin?: (userId: string) => Promise<boolean>;
  readonly activeCountryExists?: (countryId: string) => Promise<boolean>;
  readonly clock?: () => Date;
}

/**
 * @desc Build the in-process payments application service.
 * @access Composition
 */
export function createPaymentsApplicationService(
  dependencies: PaymentsApplicationServiceDependencies,
): PaymentsApplicationService {
  const deposit = createDepositWorkflows({
    unitOfWork: dependencies.unitOfWork,
    bookingReader: dependencies.bookingReader,
    gateway: dependencies.gateway,
    confirmDepositPayment: dependencies.confirmDepositPayment,
    returnTokenSecret: dependencies.returnTokenSecret,
    ...(dependencies.isStaffAdmin === undefined
      ? {}
      : { isStaffAdmin: dependencies.isStaffAdmin }),
    ...(dependencies.activeCountryExists === undefined
      ? {}
      : { activeCountryExists: dependencies.activeCountryExists }),
    ...(dependencies.clock === undefined ? {} : { clock: dependencies.clock }),
  });

  return {
    async postJournal(input: PostJournalInput) {
      const command = parsePostJournalInput(input);
      assertPostableJournal(command);
      const payloadHash = hashPayload({
        countryId: command.countryId,
        currencyCode: command.currencyCode,
        lines: command.lines,
        bookingId: command.bookingId ?? null,
        linkKind: command.linkKind ?? null,
      });
      return dependencies.unitOfWork.run(async (repository) => {
        const replay = await replayOrConflict(repository, {
          commandType: "POST_JOURNAL",
          actorKind: command.actorKind,
          actorId: command.actorId,
          idempotencyKey: command.idempotencyKey,
          payloadHash,
        });
        if (replay?.journalId !== undefined && replay.journalId !== null) {
          return { journalId: replay.journalId };
        }
        const accounts = await requireAccounts(
          repository,
          command.countryId,
          command.currencyCode,
          command.lines.map((line) => line.accountType),
        );
        const journalId = randomUUID();
        const claimed = await claimIdempotency(repository, {
          commandType: "POST_JOURNAL",
          actorKind: command.actorKind,
          actorId: command.actorId,
          idempotencyKey: command.idempotencyKey,
          payloadHash,
          journalId,
        });
        if (claimed !== null) {
          if (claimed.journalId === null) {
            throw paymentsError("IDEMPOTENCY_CONFLICT");
          }
          return { journalId: claimed.journalId };
        }
        await repository.insertJournal({
          journalId,
          ...(command.bookingId === undefined ? {} : { bookingId: command.bookingId }),
          lines: command.lines.map((line) => {
            const account = accounts.get(line.accountType);
            if (account === undefined) {
              throw paymentsError("ACCOUNT_NOT_SEEDED", {
                accountType: line.accountType,
              });
            }
            return {
              id: randomUUID(),
              accountId: account.id,
              entryType: line.entryType,
              side: line.side,
              amountMinorUnits: requirePositiveMinorUnits(line.amountMinorUnits),
              currencyCode: command.currencyCode,
              currencyDecimalPlaces: account.currencyDecimalPlaces,
            };
          }),
        });
        return { journalId };
      });
    },

    async postAdjustment(input: PostAdjustmentInput) {
      if (input.actorKind !== "STAFF_FINANCE") {
        throw paymentsError("VALIDATION_FAILED", { reason: "ACTOR" });
      }
      const reason = input.reason.trim();
      if (reason.length === 0 || reason.length > 500) {
        throw paymentsError("ADJUSTMENT_REASON_REQUIRED");
      }
      if (input.actorId.trim().length === 0 || input.idempotencyKey.trim().length === 0) {
        throw paymentsError("VALIDATION_FAILED", { reason: "SCHEMA" });
      }
      const adjustedLines = input.lines.map((line) => ({
        ...line,
        entryType: "ADJUSTMENT" as const,
      }));
      assertPostableJournal({ lines: adjustedLines });
      const payloadHash = hashPayload({
        originalJournalId: input.originalJournalId,
        reason,
        lines: input.lines,
      });
      return dependencies.unitOfWork.run(async (repository) => {
        const replay = await replayOrConflict(repository, {
          commandType: "POST_ADJUSTMENT",
          actorKind: input.actorKind,
          actorId: input.actorId,
          idempotencyKey: input.idempotencyKey,
          payloadHash,
        });
        if (
          replay?.journalId !== undefined &&
          replay.journalId !== null &&
          replay.adjustmentId !== undefined &&
          replay.adjustmentId !== null
        ) {
          return {
            adjustmentId: replay.adjustmentId,
            journalId: replay.journalId,
          };
        }
        const original = await repository.findJournalEntries(input.originalJournalId);
        const first = original[0];
        if (first === undefined) {
          throw paymentsError("VALIDATION_FAILED", { reason: "ORIGINAL_JOURNAL" });
        }
        const accounts = await requireAccounts(
          repository,
          first.countryId,
          first.currencyCode,
          adjustedLines.map((line) => line.accountType),
        );
        const journalId = randomUUID();
        const adjustmentId = randomUUID();
        const claimed = await claimIdempotency(repository, {
          commandType: "POST_ADJUSTMENT",
          actorKind: input.actorKind,
          actorId: input.actorId,
          idempotencyKey: input.idempotencyKey,
          payloadHash,
          journalId,
          adjustmentId,
        });
        if (claimed !== null) {
          if (claimed.journalId === null || claimed.adjustmentId === null) {
            throw paymentsError("IDEMPOTENCY_CONFLICT");
          }
          return {
            adjustmentId: claimed.adjustmentId,
            journalId: claimed.journalId,
          };
        }
        await repository.insertJournal({
          journalId,
          ...(first.bookingId === null || first.bookingId === undefined
            ? {}
            : { bookingId: first.bookingId }),
          lines: adjustedLines.map((line) => {
            const account = accounts.get(line.accountType);
            if (account === undefined) {
              throw paymentsError("ACCOUNT_NOT_SEEDED", {
                accountType: line.accountType,
              });
            }
            return {
              id: randomUUID(),
              accountId: account.id,
              entryType: "ADJUSTMENT",
              side: line.side,
              amountMinorUnits: requirePositiveMinorUnits(line.amountMinorUnits),
              currencyCode: first.currencyCode,
              currencyDecimalPlaces: account.currencyDecimalPlaces,
            };
          }),
        });
        await repository.insertAdjustment({
          id: adjustmentId,
          actorKind: input.actorKind,
          actorId: input.actorId,
          reason,
          originalJournalId: input.originalJournalId,
          reversingJournalId: journalId,
        });
        return { adjustmentId, journalId };
      });
    },

    async createSnapshot(input: CreateSnapshotInput) {
      if (
        (input.bookingId === undefined && input.accountType === undefined) ||
        (input.bookingId !== undefined && input.accountType !== undefined)
      ) {
        throw paymentsError("VALIDATION_FAILED", { reason: "SNAPSHOT_SUBJECT" });
      }
      const payloadHash = hashPayload({
        bookingId: input.bookingId ?? null,
        accountType: input.accountType ?? null,
        countryId: input.countryId,
        currencyCode: input.currencyCode,
      });
      return dependencies.unitOfWork.run(async (repository) => {
        const replay = await replayOrConflict(repository, {
          commandType: "CREATE_SNAPSHOT",
          actorKind: input.actorKind,
          actorId: input.actorId,
          idempotencyKey: input.idempotencyKey,
          payloadHash,
        });
        if (replay?.snapshotId !== undefined && replay.snapshotId !== null) {
          return { snapshotId: replay.snapshotId };
        }
        const entries =
          input.bookingId === undefined
            ? await entriesForAccount(
                repository,
                input.countryId,
                input.currencyCode,
                input.accountType!,
              )
            : await repository.listEntriesByBooking(input.bookingId);
        const hash = hashEntryIds(entries.map((entry) => entry.id));
        let debit = "0";
        let credit = "0";
        for (const entry of entries) {
          if (entry.side === "DEBIT") {
            debit = addMinorUnits(debit, entry.amountMinorUnits);
          } else {
            credit = addMinorUnits(credit, entry.amountMinorUnits);
          }
        }
        const account =
          input.accountType === undefined
            ? undefined
            : (await requireAccounts(
                repository,
                input.countryId,
                input.currencyCode,
                [input.accountType],
              )).get(input.accountType);
        let decimalPlaces = account?.currencyDecimalPlaces;
        if (decimalPlaces === undefined) {
          if (input.bookingId !== undefined) {
            const booking = await dependencies.bookingReader.readById({
              bookingId: input.bookingId,
            });
            decimalPlaces = booking?.currencyDecimalPlaces;
          }
          if (decimalPlaces === undefined) {
            const seeded = await repository.findAccounts(
              input.countryId,
              input.currencyCode,
            );
            decimalPlaces = seeded[0]?.currencyDecimalPlaces ?? 2;
          }
        }
        const snapshotId = randomUUID();
        const claimed = await claimIdempotency(repository, {
          commandType: "CREATE_SNAPSHOT",
          actorKind: input.actorKind,
          actorId: input.actorId,
          idempotencyKey: input.idempotencyKey,
          payloadHash,
          snapshotId,
        });
        if (claimed !== null) {
          if (claimed.snapshotId === null) {
            throw paymentsError("IDEMPOTENCY_CONFLICT");
          }
          return { snapshotId: claimed.snapshotId };
        }
        await repository.insertSnapshot({
          id: snapshotId,
          subjectKind: input.bookingId === undefined ? "ACCOUNT" : "BOOKING",
          ...(account?.id === undefined ? {} : { accountId: account.id }),
          ...(input.bookingId === undefined ? {} : { bookingId: input.bookingId }),
          currencyCode: input.currencyCode,
          currencyDecimalPlaces: decimalPlaces,
          debitMinorUnits: debit,
          creditNetMinorUnits: credit,
          derivedBalanceMinorUnits: signedBalanceMinorUnits(debit, credit),
          entryIdHash: hash,
        });
        return { snapshotId };
      });
    },

    async getDerivedBalance(input: {
      readonly countryId: string;
      readonly currencyCode: string;
      readonly accountType: LedgerAccountType;
    }): Promise<DerivedBalance> {
      return dependencies.unitOfWork.run(async (repository) => {
        const accounts = await requireAccounts(
          repository,
          input.countryId,
          input.currencyCode,
          [input.accountType],
        );
        const account = accounts.get(input.accountType);
        if (account === undefined) {
          throw paymentsError("ACCOUNT_NOT_SEEDED");
        }
        const entries = await repository.listEntriesByAccount(account.id);
        let debit = "0";
        let credit = "0";
        for (const entry of entries) {
          if (entry.side === "DEBIT") {
            debit = addMinorUnits(debit, entry.amountMinorUnits);
          } else {
            credit = addMinorUnits(credit, entry.amountMinorUnits);
          }
        }
        return {
          accountType: input.accountType,
          countryId: input.countryId,
          currencyCode: input.currencyCode,
          debitMinorUnits: debit,
          creditMinorUnits: credit,
          balanceMinorUnits: signedBalanceMinorUnits(debit, credit),
        };
      });
    },

    async listEntries(input: {
      readonly journalId?: string;
      readonly bookingId?: string;
    }): Promise<readonly LedgerEntryView[]> {
      if (input.journalId === undefined && input.bookingId === undefined) {
        throw paymentsError("VALIDATION_FAILED", { reason: "LIST_FILTER" });
      }
      return dependencies.unitOfWork.run(async (repository) => {
        const rows =
          input.journalId === undefined
            ? await repository.listEntriesByBooking(input.bookingId!)
            : await repository.listEntriesByJournal(input.journalId);
        return rows.map((row) => ({
          journalId: row.journalId,
          entryId: row.id,
          accountType: row.accountType,
          entryType: row.entryType,
          side: row.side,
          amountMinorUnits: row.amountMinorUnits,
          currencyCode: row.currencyCode,
          bookingId: row.bookingId,
        }));
      });
    },

    async reconcileBooking(input: { readonly bookingId: string }) {
      const snapshot = await dependencies.bookingReader.readById({
        bookingId: input.bookingId,
      });
      if (snapshot === null) {
        throw paymentsError("DEPENDENCY_FAILURE", { reason: "BOOKING_NOT_FOUND" });
      }
      const entries = await dependencies.unitOfWork.run((repository) =>
        repository.listEntriesByBooking(input.bookingId),
      );
      const postedDepositMinorUnits = postedDeposit(entries);
      if (
        snapshot.status === "DRAFT" ||
        snapshot.depositMinorUnits === null
      ) {
        return {
          bookingId: input.bookingId,
          status: "NOT_READY" as const,
          requiredDepositMinorUnits: snapshot.depositMinorUnits,
          postedDepositMinorUnits,
          bookingStatus: snapshot.status,
        };
      }
      if (postedDepositMinorUnits === "0") {
        return {
          bookingId: input.bookingId,
          status: "MISSING" as const,
          requiredDepositMinorUnits: snapshot.depositMinorUnits,
          postedDepositMinorUnits,
          bookingStatus: snapshot.status,
        };
      }
      return {
        bookingId: input.bookingId,
        status:
          compareMinorUnits(postedDepositMinorUnits, snapshot.depositMinorUnits) ===
          0
            ? ("BALANCED" as const)
            : ("MISMATCHED" as const),
        requiredDepositMinorUnits: snapshot.depositMinorUnits,
        postedDepositMinorUnits,
        bookingStatus: snapshot.status,
      };
    },

    async createAccount(input: unknown): Promise<never> {
      rejectWalletAccount(input);
    },

    listEnabledMethodsForCountry: deposit.listEnabledMethodsForCountry,
    initiateBookingDeposit: deposit.initiateBookingDeposit,
    getBrowserReturnStatus: deposit.getBrowserReturnStatus,
    processPaymobWebhook: deposit.processPaymobWebhook,
    getPaymentForReader: deposit.getPaymentForReader,
    setPaymentMethodEnabled: deposit.setPaymentMethodEnabled,
    createRefundRequest: deposit.createRefundRequest,
  };
}

async function claimIdempotency(
  repository: PaymentsRepository,
  input: {
    readonly commandType: "POST_JOURNAL" | "POST_ADJUSTMENT" | "CREATE_SNAPSHOT";
    readonly actorKind: PostJournalInput["actorKind"];
    readonly actorId: string;
    readonly idempotencyKey: string;
    readonly payloadHash: string;
    readonly journalId?: string;
    readonly snapshotId?: string;
    readonly adjustmentId?: string;
  },
) {
  try {
    await repository.insertIdempotency(input);
    return null;
  } catch (error) {
    if (!(error instanceof PaymentsIdempotencyCollision)) {
      throw error;
    }
    const existing = await replayOrConflict(repository, input);
    if (existing === null) {
      throw paymentsError("IDEMPOTENCY_CONFLICT");
    }
    return existing;
  }
}

async function replayOrConflict(
  repository: PaymentsRepository,
  input: {
    readonly commandType: "POST_JOURNAL" | "POST_ADJUSTMENT" | "CREATE_SNAPSHOT";
    readonly actorKind: PostJournalInput["actorKind"];
    readonly actorId: string;
    readonly idempotencyKey: string;
    readonly payloadHash: string;
  },
) {
  const existing = await repository.findIdempotency(input);
  if (existing === null) {
    return null;
  }
  if (existing.payloadHash !== input.payloadHash) {
    throw paymentsError("IDEMPOTENCY_CONFLICT");
  }
  return existing;
}

async function requireAccounts(
  repository: PaymentsRepository,
  countryId: string,
  currencyCode: string,
  types: readonly LedgerAccountType[],
) {
  const accounts = await repository.findAccounts(countryId, currencyCode);
  if (accounts.length === 0) {
    throw paymentsError("ACCOUNT_NOT_SEEDED");
  }
  if (accounts.some((account) => account.currencyCode !== currencyCode)) {
    throw paymentsError("CURRENCY_MISMATCH");
  }
  const byType = new Map(accounts.map((account) => [account.accountType, account]));
  for (const type of types) {
    if (!byType.has(type)) {
      throw paymentsError("ACCOUNT_NOT_SEEDED", { accountType: type });
    }
  }
  return byType;
}

async function entriesForAccount(
  repository: PaymentsRepository,
  countryId: string,
  currencyCode: string,
  accountType: LedgerAccountType,
) {
  const accounts = await requireAccounts(repository, countryId, currencyCode, [
    accountType,
  ]);
  const account = accounts.get(accountType);
  if (account === undefined) {
    throw paymentsError("ACCOUNT_NOT_SEEDED");
  }
  return repository.listEntriesByAccount(account.id);
}

function postedDeposit(
  entries: readonly {
    readonly entryType: string;
    readonly side: string;
    readonly journalId: string;
    readonly amountMinorUnits: string;
  }[],
): string {
  const perJournal = new Map<string, string>();
  for (const entry of entries) {
    if (entry.entryType !== "DEPOSIT" || entry.side !== "DEBIT") {
      continue;
    }
    const current = perJournal.get(entry.journalId) ?? "0";
    perJournal.set(entry.journalId, addMinorUnits(current, entry.amountMinorUnits));
  }
  let total = "0";
  for (const amount of perJournal.values()) {
    total = addMinorUnits(total, amount);
  }
  return total;
}

function hashPayload(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function hashEntryIds(ids: readonly string[]): string {
  return createHash("sha256").update([...ids].sort().join(",")).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}
