-- R1-P15 Deposit Payments, Methods & Webhooks (DEC-094).
-- Forward-only, additive after r1_p14_financial_ledger_payment_architecture.
-- Egypt enables PAYMOB CARD + WALLET only. No wallets / InstaPay invention.

CREATE TYPE "PaymentRailProvider" AS ENUM ('PAYMOB', 'OTHER_DISABLED');
CREATE TYPE "PaymentMethodKind" AS ENUM ('CARD', 'WALLET', 'OTHER');
CREATE TYPE "PaymentAttemptStatus" AS ENUM (
  'CREATED',
  'REDIRECTED',
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'EXPIRED'
);
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "PaymentPurpose" AS ENUM ('BOOKING_DEPOSIT');
CREATE TYPE "PaymentGatewayEventStatus" AS ENUM (
  'RECEIVED',
  'PROCESSED',
  'IGNORED',
  'REJECTED'
);
CREATE TYPE "RefundRequestStatus" AS ENUM ('REQUESTED');

CREATE TABLE "payment_methods" (
  "id" TEXT NOT NULL,
  "country_id" TEXT NOT NULL,
  "provider" "PaymentRailProvider" NOT NULL,
  "method_kind" "PaymentMethodKind" NOT NULL,
  "code" TEXT NOT NULL,
  "display_name_ar" TEXT NOT NULL,
  "display_name_en" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_methods_country_id_code_key"
  ON "payment_methods"("country_id", "code");
CREATE UNIQUE INDEX "payment_methods_country_id_provider_method_kind_key"
  ON "payment_methods"("country_id", "provider", "method_kind");
CREATE INDEX "payment_methods_country_id_enabled_idx"
  ON "payment_methods"("country_id", "enabled");

ALTER TABLE "payment_methods"
  ADD CONSTRAINT "payment_methods_country_id_fkey"
  FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "payments" (
  "id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "customer_user_id" TEXT NOT NULL,
  "purpose" "PaymentPurpose" NOT NULL,
  "status" "PaymentStatus" NOT NULL,
  "amount_minor_units" DECIMAL(65,0) NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL,
  "currency_decimal_places" INTEGER NOT NULL,
  "payment_method_id" TEXT NOT NULL,
  "succeeded_attempt_id" TEXT,
  "ledger_journal_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payments_amount_positive_check" CHECK ("amount_minor_units" > 0),
  CONSTRAINT "payments_decimal_places_check" CHECK (
    "currency_decimal_places" >= 0 AND "currency_decimal_places" <= 8
  )
);

CREATE UNIQUE INDEX "payments_succeeded_attempt_id_key"
  ON "payments"("succeeded_attempt_id");
CREATE UNIQUE INDEX "payments_one_succeeded_booking_deposit_key"
  ON "payments"("booking_id", "purpose")
  WHERE "status" = 'SUCCEEDED';
CREATE INDEX "payments_booking_id_purpose_status_idx"
  ON "payments"("booking_id", "purpose", "status");
CREATE INDEX "payments_customer_user_id_created_at_idx"
  ON "payments"("customer_user_id", "created_at");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_payment_method_id_fkey"
  FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "payment_attempts" (
  "id" TEXT NOT NULL,
  "payment_id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "customer_user_id" TEXT NOT NULL,
  "payment_method_id" TEXT NOT NULL,
  "status" "PaymentAttemptStatus" NOT NULL,
  "amount_minor_units" DECIMAL(65,0) NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL,
  "currency_decimal_places" INTEGER NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "gateway_session_ref" TEXT,
  "redirect_url" TEXT,
  "failure_code" TEXT,
  "failure_message_safe" TEXT,
  "expires_at" TIMESTAMP(3),
  "return_token_hash" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_attempts_amount_positive_check" CHECK ("amount_minor_units" > 0)
);

CREATE UNIQUE INDEX "payment_attempts_customer_booking_idempotency_key"
  ON "payment_attempts"("customer_user_id", "booking_id", "idempotency_key");
CREATE INDEX "payment_attempts_booking_id_status_idx"
  ON "payment_attempts"("booking_id", "status");
CREATE INDEX "payment_attempts_gateway_session_ref_idx"
  ON "payment_attempts"("gateway_session_ref");

ALTER TABLE "payment_attempts"
  ADD CONSTRAINT "payment_attempts_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_attempts"
  ADD CONSTRAINT "payment_attempts_payment_method_id_fkey"
  FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_succeeded_attempt_id_fkey"
  FOREIGN KEY ("succeeded_attempt_id") REFERENCES "payment_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "payment_gateway_events" (
  "id" TEXT NOT NULL,
  "provider" "PaymentRailProvider" NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payment_attempt_id" TEXT,
  "payment_id" TEXT,
  "event_type" TEXT NOT NULL,
  "signature_valid" BOOLEAN NOT NULL,
  "status" "PaymentGatewayEventStatus" NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "raw_payload_stored" BOOLEAN NOT NULL DEFAULT false,
  "processed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_gateway_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_gateway_events_provider_idempotency_key_key"
  ON "payment_gateway_events"("provider", "idempotency_key");
CREATE INDEX "payment_gateway_events_payment_id_idx"
  ON "payment_gateway_events"("payment_id");
CREATE INDEX "payment_gateway_events_payment_attempt_id_idx"
  ON "payment_gateway_events"("payment_attempt_id");

ALTER TABLE "payment_gateway_events"
  ADD CONSTRAINT "payment_gateway_events_payment_attempt_id_fkey"
  FOREIGN KEY ("payment_attempt_id") REFERENCES "payment_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_gateway_events"
  ADD CONSTRAINT "payment_gateway_events_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "payment_receipts" (
  "id" TEXT NOT NULL,
  "payment_id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "customer_user_id" TEXT NOT NULL,
  "amount_minor_units" DECIMAL(65,0) NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL,
  "currency_decimal_places" INTEGER NOT NULL,
  "method_code" TEXT NOT NULL,
  "provider_ref" TEXT,
  "issued_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_receipts_amount_positive_check" CHECK ("amount_minor_units" > 0)
);

CREATE UNIQUE INDEX "payment_receipts_payment_id_key" ON "payment_receipts"("payment_id");
CREATE INDEX "payment_receipts_booking_id_idx" ON "payment_receipts"("booking_id");
CREATE INDEX "payment_receipts_customer_user_id_issued_at_idx"
  ON "payment_receipts"("customer_user_id", "issued_at");

ALTER TABLE "payment_receipts"
  ADD CONSTRAINT "payment_receipts_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "refund_requests" (
  "id" TEXT NOT NULL,
  "payment_id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "customer_user_id" TEXT NOT NULL,
  "amount_minor_units" DECIMAL(65,0) NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL,
  "currency_decimal_places" INTEGER NOT NULL,
  "status" "RefundRequestStatus" NOT NULL,
  "reason" TEXT,
  "requested_by_actor_kind" TEXT NOT NULL,
  "requested_by_actor_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "refund_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "refund_requests_amount_positive_check" CHECK ("amount_minor_units" > 0)
);

CREATE INDEX "refund_requests_payment_id_idx" ON "refund_requests"("payment_id");
CREATE INDEX "refund_requests_status_created_at_idx"
  ON "refund_requests"("status", "created_at");

ALTER TABLE "refund_requests"
  ADD CONSTRAINT "refund_requests_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable SYSTEM AWAITING_DEPOSIT -> CONFIRMED for verified deposit success (P15).
-- status_transition_rules has no updated_at column (P13 model is immutable seed rows).
UPDATE "status_transition_rules"
SET "executable" = true
WHERE "id" = 'str_sys_awaiting_confirmed'
  AND "actor" = 'SYSTEM'
  AND "from_status" = 'AWAITING_DEPOSIT'
  AND "to_status" = 'CONFIRMED';

-- Egypt Paymob CARD + WALLET enabled; optional OTHER disabled only.
INSERT INTO "payment_methods" (
  "id",
  "country_id",
  "provider",
  "method_kind",
  "code",
  "display_name_ar",
  "display_name_en",
  "enabled",
  "sort_order",
  "created_at",
  "updated_at"
)
SELECT
  'paymthd_eg_paymob_card',
  c."id",
  'PAYMOB',
  'CARD',
  'PAYMOB_CARD',
  'بطاقة',
  'Card',
  true,
  10,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "countries" c
WHERE c."code" = 'EG'
  AND NOT EXISTS (
    SELECT 1 FROM "payment_methods" pm
    WHERE pm."country_id" = c."id" AND pm."code" = 'PAYMOB_CARD'
  );

INSERT INTO "payment_methods" (
  "id",
  "country_id",
  "provider",
  "method_kind",
  "code",
  "display_name_ar",
  "display_name_en",
  "enabled",
  "sort_order",
  "created_at",
  "updated_at"
)
SELECT
  'paymthd_eg_paymob_wallet',
  c."id",
  'PAYMOB',
  'WALLET',
  'PAYMOB_WALLET',
  'محفظة',
  'Wallet',
  true,
  20,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "countries" c
WHERE c."code" = 'EG'
  AND NOT EXISTS (
    SELECT 1 FROM "payment_methods" pm
    WHERE pm."country_id" = c."id" AND pm."code" = 'PAYMOB_WALLET'
  );

INSERT INTO "payment_methods" (
  "id",
  "country_id",
  "provider",
  "method_kind",
  "code",
  "display_name_ar",
  "display_name_en",
  "enabled",
  "sort_order",
  "created_at",
  "updated_at"
)
SELECT
  'paymthd_eg_other_disabled',
  c."id",
  'OTHER_DISABLED',
  'OTHER',
  'OTHER_DISABLED',
  'طريقة أخرى (معطلة)',
  'Other (disabled)',
  false,
  90,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "countries" c
WHERE c."code" = 'EG'
  AND NOT EXISTS (
    SELECT 1 FROM "payment_methods" pm
    WHERE pm."country_id" = c."id" AND pm."code" = 'OTHER_DISABLED'
  );
