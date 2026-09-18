-- R1-P18 Order Execution & Client Completion Code
-- Additive only. No BookingStatus changes. No wallets. No fees. No table drops.

CREATE TYPE "OrderStatus" AS ENUM (
  'ASSIGNED',
  'ON_THE_WAY',
  'IN_PROGRESS',
  'READY_TO_COMPLETE',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "OrderMediaKind" AS ENUM ('PROGRESS', 'COMPLETION');

CREATE TYPE "CompletionCodeStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'CONSUMED');

CREATE TYPE "OrderEventType" AS ENUM (
  'CREATED',
  'STATUS_CHANGED',
  'CODE_ISSUED',
  'CODE_RESENT',
  'CODE_ATTEMPT',
  'MEDIA_ATTACHED',
  'NOTE_ADDED',
  'CANCELLED'
);

CREATE TYPE "OrderNotificationTemplateKey" AS ENUM (
  'ORDER_ON_THE_WAY',
  'ORDER_READY_TO_COMPLETE',
  'ORDER_COMPLETED'
);

CREATE TYPE "OrderNotificationDeliveryStatus" AS ENUM ('PENDING');

CREATE TYPE "OrderActorCommandType" AS ENUM (
  'TRANSITION_ON_THE_WAY',
  'TRANSITION_IN_PROGRESS',
  'TRANSITION_READY_TO_COMPLETE',
  'COMPLETE',
  'RESEND_COMPLETION_CODE',
  'ATTACH_MEDIA',
  'ADD_NOTE'
);

CREATE TABLE "orders" (
  "id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "customer_user_id" TEXT NOT NULL,
  "status" "OrderStatus" NOT NULL,
  "assigned_at" TIMESTAMP(3) NOT NULL,
  "on_the_way_at" TIMESTAMP(3),
  "in_progress_at" TIMESTAMP(3),
  "ready_to_complete_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "orders_booking_id_key" ON "orders"("booking_id");
CREATE INDEX "orders_status_idx" ON "orders"("status");
CREATE INDEX "orders_provider_id_idx" ON "orders"("provider_id");
CREATE INDEX "orders_customer_user_id_idx" ON "orders"("customer_user_id");

CREATE TABLE "order_status_history" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "from_status" "OrderStatus",
  "to_status" "OrderStatus" NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "actor_role" VARCHAR(40) NOT NULL,
  "reason_code" VARCHAR(100),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_status_history_order_id_created_at_idx"
  ON "order_status_history"("order_id", "created_at");

CREATE TABLE "completion_codes" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "code_hash" VARCHAR(128) NOT NULL,
  "code_salt" VARCHAR(64) NOT NULL,
  "status" "CompletionCodeStatus" NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "max_attempts" INTEGER NOT NULL,
  "attempts_used" INTEGER NOT NULL DEFAULT 0,
  "issued_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "supersedes_code_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "completion_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "completion_codes_order_id_idx" ON "completion_codes"("order_id");
CREATE UNIQUE INDEX "completion_codes_one_active_per_order_idx"
  ON "completion_codes"("order_id")
  WHERE "status" = 'ACTIVE';

CREATE TABLE "completion_code_attempts" (
  "id" TEXT NOT NULL,
  "completion_code_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "success" BOOLEAN NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "completion_code_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "completion_code_attempts_completion_code_id_created_at_idx"
  ON "completion_code_attempts"("completion_code_id", "created_at");
CREATE INDEX "completion_code_attempts_order_id_created_at_idx"
  ON "completion_code_attempts"("order_id", "created_at");

CREATE TABLE "order_media" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "media_file_id" TEXT NOT NULL,
  "kind" "OrderMediaKind" NOT NULL,
  "uploaded_by_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_media_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_media_order_id_media_file_id_key"
  ON "order_media"("order_id", "media_file_id");
CREATE INDEX "order_media_order_id_kind_idx" ON "order_media"("order_id", "kind");

CREATE TABLE "order_notes" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "body" VARCHAR(2000) NOT NULL,
  "author_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_notes_order_id_created_at_idx"
  ON "order_notes"("order_id", "created_at");

CREATE TABLE "order_events" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "type" "OrderEventType" NOT NULL,
  "actor_user_id" TEXT,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_events_order_id_created_at_idx"
  ON "order_events"("order_id", "created_at");

CREATE TABLE "order_notification_intents" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "template_key" "OrderNotificationTemplateKey" NOT NULL,
  "recipient_user_id" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "delivery_status" "OrderNotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_notification_intents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_notification_intents_order_id_template_key_idx"
  ON "order_notification_intents"("order_id", "template_key");
CREATE INDEX "order_notification_intents_delivery_status_created_at_idx"
  ON "order_notification_intents"("delivery_status", "created_at");

CREATE TABLE "order_actor_commands" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "command_type" "OrderActorCommandType" NOT NULL,
  "idempotency_key" VARCHAR(128) NOT NULL,
  "request_hash" VARCHAR(64) NOT NULL,
  "response_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_actor_commands_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_actor_commands_order_id_actor_user_id_command_type_idempotency_key_key"
  ON "order_actor_commands"("order_id", "actor_user_id", "command_type", "idempotency_key");
CREATE INDEX "order_actor_commands_order_id_idx" ON "order_actor_commands"("order_id");

ALTER TABLE "order_status_history"
  ADD CONSTRAINT "order_status_history_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "completion_codes"
  ADD CONSTRAINT "completion_codes_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "completion_codes"
  ADD CONSTRAINT "completion_codes_supersedes_code_id_fkey"
  FOREIGN KEY ("supersedes_code_id") REFERENCES "completion_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "completion_code_attempts"
  ADD CONSTRAINT "completion_code_attempts_completion_code_id_fkey"
  FOREIGN KEY ("completion_code_id") REFERENCES "completion_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "completion_code_attempts"
  ADD CONSTRAINT "completion_code_attempts_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_media"
  ADD CONSTRAINT "order_media_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_notes"
  ADD CONSTRAINT "order_notes_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_events"
  ADD CONSTRAINT "order_events_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_notification_intents"
  ADD CONSTRAINT "order_notification_intents_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_actor_commands"
  ADD CONSTRAINT "order_actor_commands_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
