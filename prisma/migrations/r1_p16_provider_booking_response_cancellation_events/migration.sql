-- R1-P16 Provider Booking Response & Cancellation Events
-- Additive only. No wallets. No fee columns. No table drops.

ALTER TYPE "BookingStatus" ADD VALUE 'ACCEPTED';
ALTER TYPE "StatusTransitionActor" ADD VALUE 'PROVIDER';

CREATE TYPE "BookingResponseStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');
CREATE TYPE "BookingCancellationActor" AS ENUM ('CUSTOMER', 'PROVIDER', 'STAFF_ADMIN', 'SYSTEM');
CREATE TYPE "CancellationReasonPurpose" AS ENUM ('REJECT', 'CANCEL');
CREATE TYPE "BookingNotificationTemplate" AS ENUM (
  'BOOKING_CONFIRMED_FOR_PROVIDER',
  'BOOKING_ACCEPTED',
  'BOOKING_REJECTED',
  'BOOKING_RESPONSE_EXPIRED',
  'BOOKING_CANCELLED'
);
CREATE TYPE "BookingNotificationIntentStatus" AS ENUM ('PENDING');
CREATE TYPE "BookingActorCommandType" AS ENUM ('ACCEPT', 'REJECT', 'PROVIDER_CANCEL', 'STAFF_CANCEL');

CREATE TABLE "cancellation_reasons" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "actor" "BookingCancellationActor" NOT NULL,
  "purpose" "CancellationReasonPurpose" NOT NULL,
  "label_ar" VARCHAR(200) NOT NULL,
  "label_en" VARCHAR(200) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cancellation_reasons_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cancellation_reasons_code_key" ON "cancellation_reasons"("code");
CREATE INDEX "cancellation_reasons_actor_purpose_active_idx"
  ON "cancellation_reasons"("actor", "purpose", "active");

CREATE TABLE "booking_responses" (
  "id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "status" "BookingResponseStatus" NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "decided_at" TIMESTAMP(3),
  "decided_by_user_id" TEXT,
  "reject_reason_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "booking_responses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "booking_responses_booking_id_key" ON "booking_responses"("booking_id");
CREATE INDEX "booking_responses_provider_id_status_expires_at_idx"
  ON "booking_responses"("provider_id", "status", "expires_at");

CREATE TABLE "booking_cancellations" (
  "id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "actor_kind" "BookingCancellationActor" NOT NULL,
  "actor_user_id" TEXT,
  "reason_id" TEXT NOT NULL,
  "from_status" TEXT NOT NULL,
  "notes" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_cancellations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "booking_cancellations_booking_id_key" ON "booking_cancellations"("booking_id");
CREATE INDEX "booking_cancellations_actor_kind_created_at_idx"
  ON "booking_cancellations"("actor_kind", "created_at");

CREATE TABLE "booking_notification_intents" (
  "id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "template" "BookingNotificationTemplate" NOT NULL,
  "locale" "PreferredLanguage" NOT NULL,
  "recipient_user_id" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "safe_variables" JSONB NOT NULL,
  "status" "BookingNotificationIntentStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_notification_intents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "booking_notification_intents_idempotency_key_key"
  ON "booking_notification_intents"("idempotency_key");
CREATE INDEX "booking_notification_intents_booking_id_template_idx"
  ON "booking_notification_intents"("booking_id", "template");

CREATE TABLE "booking_actor_commands" (
  "id" TEXT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "command_type" "BookingActorCommandType" NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "response_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_actor_commands_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "booking_actor_commands_actor_user_id_command_type_idempotency_key_key"
  ON "booking_actor_commands"("actor_user_id", "command_type", "idempotency_key");
CREATE INDEX "booking_actor_commands_booking_id_idx" ON "booking_actor_commands"("booking_id");

ALTER TABLE "booking_responses"
  ADD CONSTRAINT "booking_responses_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booking_responses"
  ADD CONSTRAINT "booking_responses_decided_by_user_id_fkey"
  FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booking_responses"
  ADD CONSTRAINT "booking_responses_reject_reason_id_fkey"
  FOREIGN KEY ("reject_reason_id") REFERENCES "cancellation_reasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "booking_cancellations"
  ADD CONSTRAINT "booking_cancellations_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booking_cancellations"
  ADD CONSTRAINT "booking_cancellations_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booking_cancellations"
  ADD CONSTRAINT "booking_cancellations_reason_id_fkey"
  FOREIGN KEY ("reason_id") REFERENCES "cancellation_reasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "booking_notification_intents"
  ADD CONSTRAINT "booking_notification_intents_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booking_notification_intents"
  ADD CONSTRAINT "booking_notification_intents_recipient_user_id_fkey"
  FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "booking_actor_commands"
  ADD CONSTRAINT "booking_actor_commands_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booking_actor_commands"
  ADD CONSTRAINT "booking_actor_commands_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "bookings_provider_id_status_created_at_idx"
  ON "bookings"("provider_id", "status", "created_at");

INSERT INTO "cancellation_reasons"
  ("id", "code", "actor", "purpose", "label_ar", "label_en", "active", "sort_order", "created_at", "updated_at")
VALUES
  ('cr_prov_rej_fulfill', 'PROVIDER_CANNOT_FULFILL', 'PROVIDER', 'REJECT', 'لا يمكن تنفيذ الطلب', 'Cannot fulfill the request', true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cr_prov_rej_sched', 'PROVIDER_SCHEDULE_CONFLICT', 'PROVIDER', 'REJECT', 'تعارض في الجدول', 'Schedule conflict', true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cr_prov_rej_other', 'PROVIDER_REJECT_OTHER', 'PROVIDER', 'REJECT', 'سبب آخر', 'Other', true, 90, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cr_prov_can_continue', 'PROVIDER_UNABLE_TO_CONTINUE', 'PROVIDER', 'CANCEL', 'تعذر الاستمرار', 'Unable to continue', true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cr_prov_can_other', 'PROVIDER_CANCEL_OTHER', 'PROVIDER', 'CANCEL', 'سبب آخر', 'Other', true, 90, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cr_cust_mind', 'CUSTOMER_CHANGED_MIND', 'CUSTOMER', 'CANCEL', 'تغيير الرأي', 'Changed mind', true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cr_cust_details', 'CUSTOMER_WRONG_DETAILS', 'CUSTOMER', 'CANCEL', 'بيانات غير صحيحة', 'Wrong details', true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cr_cust_other', 'CUSTOMER_CANCEL_OTHER', 'CUSTOMER', 'CANCEL', 'سبب آخر', 'Other', true, 90, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cr_staff_ops', 'STAFF_OPS_CANCEL', 'STAFF_ADMIN', 'CANCEL', 'إلغاء تشغيلي', 'Operations cancel', true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cr_staff_other', 'STAFF_CANCEL_OTHER', 'STAFF_ADMIN', 'CANCEL', 'سبب آخر', 'Other', true, 90, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cr_sys_expired', 'PROVIDER_RESPONSE_EXPIRED', 'SYSTEM', 'CANCEL', 'انتهت مهلة رد مقدم الخدمة', 'Provider response expired', true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "status_transition_rules"
  ("id", "actor", "from_status", "to_status", "category", "executable",
   "preconditions_json", "side_effects_json", "audit_json", "failure_json")
VALUES
  ('str_prov_confirmed_accepted', 'PROVIDER', 'CONFIRMED', 'ACCEPTED', 'NORMAL', true,
   '{"selectedProviderManager":true,"pendingResponse":true,"notExpired":true}',
   '{"responseAccepted":true,"notifyCustomer":true}',
   '{"actor":true,"beforeAfter":true}',
   '{"stateUnchanged":true}'),
  ('str_prov_confirmed_cancelled', 'PROVIDER', 'CONFIRMED', 'CANCELLED', 'CANCELLATION', true,
   '{"selectedProviderManager":true,"pendingResponse":true,"notExpired":true,"reasonRequired":true}',
   '{"responseRejected":true,"cancellationRow":true,"noFees":true}',
   '{"actor":true,"reason":true}',
   '{"stateUnchanged":true}'),
  ('str_sys_confirmed_cancelled_expiry', 'SYSTEM', 'CONFIRMED', 'CANCELLED', 'CANCELLATION', true,
   '{"pendingExpired":true}',
   '{"responseExpired":true,"cancellationRow":true,"noFees":true}',
   '{"system":true,"reason":"PROVIDER_RESPONSE_EXPIRED"}',
   '{"stateUnchanged":true}'),
  ('str_cust_confirmed_cancelled', 'CUSTOMER', 'CONFIRMED', 'CANCELLED', 'CANCELLATION', true,
   '{"owner":true,"reasonRequired":true}',
   '{"cancellationRow":true,"noFees":true}',
   '{"actor":true,"reason":true}',
   '{"stateUnchanged":true}'),
  ('str_cust_accepted_cancelled', 'CUSTOMER', 'ACCEPTED', 'CANCELLED', 'CANCELLATION', true,
   '{"owner":true,"reasonRequired":true}',
   '{"cancellationRow":true,"noFees":true}',
   '{"actor":true,"reason":true}',
   '{"stateUnchanged":true}'),
  ('str_prov_accepted_cancelled', 'PROVIDER', 'ACCEPTED', 'CANCELLED', 'CANCELLATION', true,
   '{"selectedProviderManager":true,"reasonRequired":true}',
   '{"cancellationRow":true,"noFees":true}',
   '{"actor":true,"reason":true}',
   '{"stateUnchanged":true}'),
  ('str_staff_confirmed_cancelled', 'STAFF_ADMIN', 'CONFIRMED', 'CANCELLED', 'PRIVILEGED_OVERRIDE', true,
   '{"staffAdmin":true,"reasonRequired":true}',
   '{"cancellationRow":true,"noFees":true}',
   '{"mandatory":true,"reason":true}',
   '{"stateUnchanged":true}'),
  ('str_staff_accepted_cancelled', 'STAFF_ADMIN', 'ACCEPTED', 'CANCELLED', 'PRIVILEGED_OVERRIDE', true,
   '{"staffAdmin":true,"reasonRequired":true}',
   '{"cancellationRow":true,"noFees":true}',
   '{"mandatory":true,"reason":true}',
   '{"stateUnchanged":true}');

INSERT INTO "app_configs" ("id", "key", "value", "value_kind", "resolution_policy", "description", "created_at", "updated_at")
SELECT 'r1p16_app_provider_response_hours', 'commercial.provider_response_hours', '24'::jsonb, 'NUMBER', 'COUNTRY_REQUIRED',
       'Country-required hours the selected provider has to accept or reject a confirmed booking', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "app_configs" WHERE "key" = 'commercial.provider_response_hours');

INSERT INTO "country_configs" ("id", "country_id", "key", "value", "value_kind", "version", "created_at", "updated_at")
SELECT 'r1p16rh_' || md5(c."id"), c."id", 'commercial.provider_response_hours', '24'::jsonb, 'NUMBER', 1,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "countries" c
WHERE c."code" = 'EG'
AND NOT EXISTS (
  SELECT 1 FROM "country_configs" cc
  WHERE cc."country_id" = c."id" AND cc."key" = 'commercial.provider_response_hours'
);
