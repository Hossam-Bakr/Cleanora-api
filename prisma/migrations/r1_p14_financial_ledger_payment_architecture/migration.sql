-- R1-P14 Financial Ledger & Payment Architecture (DEC-093).
-- Forward-only, additive after r1_p13_booking_draft_pricing_snapshot_status_machine.
-- System accounts only. No wallets, payment methods, or orders table.

CREATE TYPE "LedgerAccountType" AS ENUM (
  'PLATFORM_CLEARING',
  'PLATFORM_REVENUE',
  'PROVIDER_PAYABLE',
  'CUSTOMER_DEPOSIT_LIABILITY',
  'COD_CLEARING',
  'PAYOUT_CLEARING',
  'REFUND_CLEARING',
  'ADJUSTMENT_CLEARING'
);

CREATE TYPE "LedgerEntryType" AS ENUM (
  'DEPOSIT',
  'PLATFORM_FEE',
  'PROVIDER_SHARE',
  'MARKETER_COMMISSION',
  'COD_REMAINING',
  'PAYOUT',
  'REFUND',
  'ADJUSTMENT'
);

CREATE TYPE "LedgerEntrySide" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "LedgerLinkKind" AS ENUM ('BOOKING', 'ORDER');
CREATE TYPE "LedgerCommandType" AS ENUM (
  'POST_JOURNAL',
  'POST_ADJUSTMENT',
  'CREATE_SNAPSHOT'
);
CREATE TYPE "LedgerActorKind" AS ENUM ('SYSTEM', 'TEST', 'STAFF_FINANCE');
CREATE TYPE "LedgerSnapshotSubjectKind" AS ENUM ('ACCOUNT', 'BOOKING');

CREATE TABLE "ledger_accounts" (
  "id" TEXT NOT NULL,
  "country_id" TEXT NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL,
  "currency_decimal_places" INTEGER NOT NULL,
  "account_type" "LedgerAccountType" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ledger_accounts_decimal_places_check" CHECK ("currency_decimal_places" >= 0 AND "currency_decimal_places" <= 8)
);

CREATE UNIQUE INDEX "ledger_accounts_country_id_currency_code_account_type_key"
  ON "ledger_accounts"("country_id", "currency_code", "account_type");
CREATE INDEX "ledger_accounts_country_id_account_type_idx"
  ON "ledger_accounts"("country_id", "account_type");

ALTER TABLE "ledger_accounts"
  ADD CONSTRAINT "ledger_accounts_country_id_fkey"
  FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ledger_entries" (
  "id" TEXT NOT NULL,
  "journal_id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "entry_type" "LedgerEntryType" NOT NULL,
  "side" "LedgerEntrySide" NOT NULL,
  "amount_minor_units" DECIMAL(65,0) NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL,
  "currency_decimal_places" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ledger_entries_amount_positive_check" CHECK ("amount_minor_units" > 0)
);

CREATE INDEX "ledger_entries_journal_id_idx" ON "ledger_entries"("journal_id");
CREATE INDEX "ledger_entries_account_id_created_at_idx" ON "ledger_entries"("account_id", "created_at");
CREATE INDEX "ledger_entries_entry_type_created_at_idx" ON "ledger_entries"("entry_type", "created_at");

ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ledger_entry_links" (
  "id" TEXT NOT NULL,
  "journal_id" TEXT NOT NULL,
  "entry_id" TEXT,
  "kind" "LedgerLinkKind" NOT NULL,
  "booking_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ledger_entry_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ledger_entry_links_booking_kind_check" CHECK (
    ("kind" = 'BOOKING' AND "booking_id" IS NOT NULL) OR
    ("kind" = 'ORDER' AND "booking_id" IS NULL)
  )
);

CREATE UNIQUE INDEX "ledger_entry_links_journal_id_kind_booking_id_key"
  ON "ledger_entry_links"("journal_id", "kind", "booking_id");
CREATE INDEX "ledger_entry_links_booking_id_idx" ON "ledger_entry_links"("booking_id");

ALTER TABLE "ledger_entry_links"
  ADD CONSTRAINT "ledger_entry_links_entry_id_fkey"
  FOREIGN KEY ("entry_id") REFERENCES "ledger_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "financial_idempotency_keys" (
  "id" TEXT NOT NULL,
  "command_type" "LedgerCommandType" NOT NULL,
  "actor_kind" "LedgerActorKind" NOT NULL,
  "actor_id" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "journal_id" TEXT,
  "snapshot_id" TEXT,
  "adjustment_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_idempotency_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "financial_idempotency_keys_command_actor_key"
  ON "financial_idempotency_keys"("command_type", "actor_kind", "actor_id", "idempotency_key");

CREATE TABLE "financial_snapshots" (
  "id" TEXT NOT NULL,
  "subject_kind" "LedgerSnapshotSubjectKind" NOT NULL,
  "account_id" TEXT,
  "booking_id" TEXT,
  "currency_code" VARCHAR(3) NOT NULL,
  "currency_decimal_places" INTEGER NOT NULL,
  "debit_minor_units" DECIMAL(65,0) NOT NULL,
  "credit_net_minor_units" DECIMAL(65,0) NOT NULL,
  "derived_balance_minor_units" DECIMAL(65,0) NOT NULL,
  "entry_id_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "financial_snapshots_subject_check" CHECK (
    ("subject_kind" = 'ACCOUNT' AND "account_id" IS NOT NULL AND "booking_id" IS NULL) OR
    ("subject_kind" = 'BOOKING' AND "booking_id" IS NOT NULL AND "account_id" IS NULL)
  )
);

CREATE INDEX "financial_snapshots_booking_id_idx" ON "financial_snapshots"("booking_id");

ALTER TABLE "financial_snapshots"
  ADD CONSTRAINT "financial_snapshots_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "financial_adjustments" (
  "id" TEXT NOT NULL,
  "actor_kind" "LedgerActorKind" NOT NULL,
  "actor_id" TEXT NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "original_journal_id" TEXT NOT NULL,
  "reversing_journal_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_adjustments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "financial_adjustments_reason_check" CHECK (char_length(btrim("reason")) > 0)
);

CREATE INDEX "financial_adjustments_original_journal_id_idx"
  ON "financial_adjustments"("original_journal_id");

INSERT INTO "ledger_accounts" (
  "id", "country_id", "currency_code", "currency_decimal_places", "account_type", "created_at"
)
SELECT
  'ldgacc_' || c."id" || '_' || t.account_type,
  c."id",
  cur."code",
  cur."decimal_places",
  t.account_type::"LedgerAccountType",
  CURRENT_TIMESTAMP
FROM "countries" c
JOIN "currencies" cur ON cur."id" = c."default_currency_id"
CROSS JOIN (
  SELECT unnest(ARRAY[
    'PLATFORM_CLEARING',
    'PLATFORM_REVENUE',
    'PROVIDER_PAYABLE',
    'CUSTOMER_DEPOSIT_LIABILITY',
    'COD_CLEARING',
    'PAYOUT_CLEARING',
    'REFUND_CLEARING',
    'ADJUSTMENT_CLEARING'
  ]::text[]) AS account_type
) t
WHERE c."code" = 'EG'
AND NOT EXISTS (
  SELECT 1 FROM "ledger_accounts" a
  WHERE a."country_id" = c."id"
    AND a."currency_code" = cur."code"
    AND a."account_type" = t.account_type::"LedgerAccountType"
);

CREATE FUNCTION "r1_p14_reject_ledger_entry_mutation"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries_immutable' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ledger_entries_immutable"
BEFORE UPDATE OR DELETE ON "ledger_entries"
FOR EACH ROW EXECUTE FUNCTION "r1_p14_reject_ledger_entry_mutation"();

CREATE FUNCTION "r1_p14_reject_ledger_entry_link_mutation"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entry_links_immutable' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ledger_entry_links_immutable"
BEFORE UPDATE OR DELETE ON "ledger_entry_links"
FOR EACH ROW EXECUTE FUNCTION "r1_p14_reject_ledger_entry_link_mutation"();

CREATE FUNCTION "r1_p14_reject_financial_snapshot_mutation"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'financial_snapshots_immutable' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "financial_snapshots_immutable"
BEFORE UPDATE OR DELETE ON "financial_snapshots"
FOR EACH ROW EXECUTE FUNCTION "r1_p14_reject_financial_snapshot_mutation"();
