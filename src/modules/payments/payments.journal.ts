import { z } from "zod";

import { paymentsError } from "./payments.errors.js";
import {
  addMinorUnits,
  compareMinorUnits,
  requirePositiveMinorUnits,
} from "./payments.money.js";
import type {
  JournalLineInput,
  LedgerAccountType,
  LedgerActorKind,
  LedgerEntryType,
  LedgerLinkKind,
  PostJournalInput,
} from "./payments.public.js";

const ACCOUNT_TYPES = [
  "PLATFORM_CLEARING",
  "PLATFORM_REVENUE",
  "PROVIDER_PAYABLE",
  "CUSTOMER_DEPOSIT_LIABILITY",
  "COD_CLEARING",
  "PAYOUT_CLEARING",
  "REFUND_CLEARING",
  "ADJUSTMENT_CLEARING",
] as const satisfies readonly LedgerAccountType[];

const ENTRY_TYPES = [
  "DEPOSIT",
  "PLATFORM_FEE",
  "PROVIDER_SHARE",
  "MARKETER_COMMISSION",
  "COD_REMAINING",
  "PAYOUT",
  "REFUND",
  "ADJUSTMENT",
] as const satisfies readonly LedgerEntryType[];

const lineSchema = z.object({
  accountType: z.enum(ACCOUNT_TYPES),
  entryType: z.enum(ENTRY_TYPES),
  side: z.enum(["DEBIT", "CREDIT"]),
  amountMinorUnits: z.string(),
});

const postJournalSchema = z.object({
  actorKind: z.enum(["SYSTEM", "TEST", "STAFF_FINANCE"] satisfies readonly LedgerActorKind[]),
  actorId: z.string().min(1).max(200),
  idempotencyKey: z.string().min(1).max(200),
  countryId: z.string().min(1).max(200),
  currencyCode: z.string().regex(/^[A-Z]{3}$/u),
  lines: z.array(lineSchema).min(2),
  bookingId: z.string().min(1).max(200).optional(),
  linkKind: z.enum(["BOOKING", "ORDER"] satisfies readonly LedgerLinkKind[]).optional(),
});

/**
 * @desc Validate a post-journal command at the public boundary.
 * @access Payments domain
 */
export function parsePostJournalInput(input: unknown): PostJournalInput & {
  readonly linkKind?: LedgerLinkKind;
} {
  const parsed = postJournalSchema.safeParse(input);
  if (!parsed.success) {
    throw paymentsError("VALIDATION_FAILED", { reason: "SCHEMA" });
  }
  const { bookingId, linkKind, ...required } = parsed.data;
  return {
    ...required,
    ...(bookingId === undefined ? {} : { bookingId }),
    ...(linkKind === undefined ? {} : { linkKind }),
  };
}

/**
 * @desc Enforce closed posting rules before persistence.
 * @access Payments domain
 */
export function assertPostableJournal(input: {
  readonly lines: readonly JournalLineInput[];
  readonly bookingId?: string;
  readonly linkKind?: LedgerLinkKind;
}): void {
  if (input.linkKind === "ORDER") {
    throw paymentsError("LINK_KIND_NOT_AVAILABLE", { kind: "ORDER" });
  }
  if (input.lines.some((line) => line.entryType === "MARKETER_COMMISSION")) {
    throw paymentsError("ENTRY_TYPE_NOT_POSTABLE", {
      entryType: "MARKETER_COMMISSION",
    });
  }
  let debit = "0";
  let credit = "0";
  for (const line of input.lines) {
    const amount = requirePositiveMinorUnits(line.amountMinorUnits);
    if (line.side === "DEBIT") {
      debit = addMinorUnits(debit, amount);
    } else {
      credit = addMinorUnits(credit, amount);
    }
  }
  if (compareMinorUnits(debit, credit) !== 0) {
    throw paymentsError("JOURNAL_UNBALANCED", { debit, credit });
  }
}

/**
 * @desc Reject any attempt to create a user-scoped ledger account.
 * @access Payments domain
 */
export function rejectWalletAccount(input: unknown): never {
  void input;
  throw paymentsError("WALLET_PROHIBITED");
}
