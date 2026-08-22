-- R1-P06 Provider verification and external payout destinations.
-- Forward-only additive migration. Protected payout plaintext is never stored.

ALTER TYPE "MediaOwnerType" ADD VALUE 'PROVIDER_VERIFICATION_DOCUMENT_PAGE';
ALTER TYPE "ProviderEmailTemplate" ADD VALUE 'VERIFICATION_DOCUMENT_SUBMITTED';
ALTER TYPE "ProviderEmailTemplate" ADD VALUE 'VERIFICATION_DOCUMENT_DECIDED';
ALTER TYPE "ProviderEmailTemplate" ADD VALUE 'PAYOUT_DESTINATION_SUBMITTED';
ALTER TYPE "ProviderEmailTemplate" ADD VALUE 'PAYOUT_DESTINATION_DECIDED';
ALTER TYPE "ProviderEmailTemplate" ADD VALUE 'PAYOUT_PRIMARY_CHANGED';
ALTER TYPE "ProviderEmailTemplate" ADD VALUE 'PAYOUT_DESTINATION_REMOVED';
ALTER TYPE "ProviderEmailTemplate" ADD VALUE 'PAYOUT_SUCCESSOR_APPROVED';

ALTER TABLE "providers" ADD COLUMN "payout_primary_state_version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "providers" ADD CONSTRAINT "providers_payout_primary_state_version_check" CHECK ("payout_primary_state_version" >= 0);

ALTER TABLE "media_files" ADD COLUMN "verification_page_count" INTEGER,
  ADD COLUMN "verification_provider_id" TEXT,
  ADD COLUMN "verification_document_version_id" TEXT;
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_verification_page_count_check" CHECK ("verification_page_count" IS NULL OR "verification_page_count" > 0);
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_verification_scope_pair_check" CHECK (("verification_provider_id" IS NULL) = ("verification_document_version_id" IS NULL));
CREATE INDEX "media_files_verification_scope_idx" ON "media_files"("verification_provider_id", "verification_document_version_id");

CREATE TABLE "sensitive_action_proof_uses" (
  "id" TEXT NOT NULL,
  "proof_id_hash" CHAR(64) NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "purpose" VARCHAR(100) NOT NULL,
  "provider_id" TEXT NOT NULL,
  "destination_version_id" TEXT NOT NULL,
  "request_id" VARCHAR(200) NOT NULL,
  "authenticated_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sensitive_action_proof_uses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sensitive_action_proof_uses_shape_check" CHECK (btrim("purpose") <> '' AND btrim("request_id") <> '')
);
CREATE UNIQUE INDEX "sensitive_action_proof_uses_proof_hash_key" ON "sensitive_action_proof_uses"("proof_id_hash");
CREATE INDEX "sensitive_action_proof_uses_actor_idx" ON "sensitive_action_proof_uses"("actor_user_id", "consumed_at");
CREATE INDEX "sensitive_action_proof_uses_destination_idx" ON "sensitive_action_proof_uses"("destination_version_id", "consumed_at");
ALTER TABLE "sensitive_action_proof_uses" ADD CONSTRAINT "sensitive_action_proof_uses_session_fkey" FOREIGN KEY ("session_id") REFERENCES "user_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TYPE "VerificationDocumentPolicyStatus" AS ENUM ('DRAFT', 'PUBLISHED');
CREATE TYPE "ProviderDocumentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REPLACEMENT_REQUESTED', 'EXPIRED', 'INVALIDATED', 'SUPERSEDED');
CREATE TYPE "ProviderDocumentEvidenceFormat" AS ENUM ('PDF', 'IMAGE_SET');
CREATE TYPE "ProviderDocumentDecisionOutcome" AS ENUM ('APPROVE', 'REJECT', 'REQUEST_REPLACEMENT', 'INVALIDATE');
CREATE TYPE "ProviderVerificationHistoryEvent" AS ENUM ('DOCUMENT_DRAFT_CREATED', 'DOCUMENT_DRAFT_UPDATED', 'DOCUMENT_EVIDENCE_BOUND', 'DOCUMENT_EVIDENCE_REMOVED', 'DOCUMENT_EVIDENCE_REORDERED', 'DOCUMENT_SUBMITTED', 'DOCUMENT_APPROVED', 'DOCUMENT_REJECTED', 'DOCUMENT_REPLACEMENT_REQUESTED', 'DOCUMENT_EXPIRED', 'DOCUMENT_INVALIDATED', 'DOCUMENT_SUPERSEDED', 'POLICY_PUBLISHED', 'POLICY_BECAME_EFFECTIVE', 'VERIFICATION_TRUTH_CHANGED', 'BADGE_TRUTH_CHANGED');
CREATE TYPE "VerificationBadgeState" AS ENUM ('NOT_ELIGIBLE', 'NOT_EARNED', 'EARNED');
CREATE TYPE "PayoutDestinationKind" AS ENUM ('MOBILE_WALLET', 'BANK_ACCOUNT');
CREATE TYPE "PayoutHolderRelationship" AS ENUM ('PROVIDER_LEGAL_ENTITY', 'PROVIDER_OWNER');
CREATE TYPE "PayoutDestinationStatus" AS ENUM ('DRAFT', 'PENDING_VERIFICATION', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'REPLACEMENT_REQUESTED', 'INVALIDATED', 'SUPERSEDED', 'REMOVED');
CREATE TYPE "PayoutVerificationMethod" AS ENUM ('MANUAL_WALLET_TRANSFER_CHECK', 'MANUAL_BANK_BENEFICIARY_CHECK');
CREATE TYPE "PayoutDecisionOutcome" AS ENUM ('APPROVE', 'REJECT', 'REQUEST_CHANGES', 'REQUEST_REPLACEMENT', 'INVALIDATE');
CREATE TYPE "PayoutIdentityClaimStatus" AS ENUM ('ACTIVE', 'RELEASED');
CREATE TYPE "PayoutConflictStatus" AS ENUM ('OPEN', 'CANDIDATE_REJECTED', 'RESOLVED_AFTER_RELEASE');
CREATE TYPE "PayoutHistoryEvent" AS ENUM ('DESTINATION_DRAFT_CREATED', 'DESTINATION_DRAFT_UPDATED', 'DESTINATION_SUBMITTED', 'DESTINATION_APPROVED', 'DESTINATION_REJECTED', 'DESTINATION_CHANGES_REQUESTED', 'DESTINATION_REPLACEMENT_REQUESTED', 'DESTINATION_INVALIDATED', 'DESTINATION_SUPERSEDED', 'DESTINATION_REMOVED', 'PRIMARY_INITIALIZED', 'PRIMARY_CHANGED', 'PRIMARY_CLEARED', 'IDENTITY_CONFLICT_OPENED', 'IDENTITY_CONFLICT_RESOLVED');
CREATE TYPE "PayoutKeyPurpose" AS ENUM ('ENCRYPTION', 'LOOKUP_HMAC');
CREATE TYPE "PayoutKeyRotationStatus" AS ENUM ('PLANNED', 'RUNNING', 'PAUSED', 'VERIFYING', 'READY_FOR_RETIREMENT', 'COMPLETED', 'FAILED', 'CANCELLED');

CREATE TABLE "verification_document_types" (
  "id" TEXT NOT NULL,
  "code" VARCHAR(100) NOT NULL,
  "display_name_ar" VARCHAR(200) NOT NULL,
  "display_name_en" VARCHAR(200) NOT NULL,
  "description_ar" VARCHAR(1000),
  "description_en" VARCHAR(1000),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "verification_document_types_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "verification_document_types_version_check" CHECK ("version" > 0),
  CONSTRAINT "verification_document_types_code_check" CHECK (btrim("code") <> '')
);

CREATE TABLE "verification_document_policy_versions" (
  "id" TEXT NOT NULL,
  "country_id" TEXT NOT NULL,
  "provider_kind" "ProviderKind" NOT NULL,
  "policy_version" INTEGER NOT NULL,
  "status" "VerificationDocumentPolicyStatus" NOT NULL DEFAULT 'DRAFT',
  "effective_at" TIMESTAMP(3),
  "published_by_user_id" TEXT,
  "published_at" TIMESTAMP(3),
  "publish_reason" VARCHAR(1000),
  "idempotency_key" VARCHAR(200) NOT NULL,
  "last_mutation_key" VARCHAR(200),
  "last_mutation_actor_user_id" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "verification_document_policy_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "verification_document_policy_versions_counters_check" CHECK ("policy_version" > 0 AND "version" > 0),
  CONSTRAINT "verification_document_policy_versions_publish_shape_check" CHECK (
    ("status" = 'DRAFT' AND "published_by_user_id" IS NULL AND "published_at" IS NULL AND "publish_reason" IS NULL)
    OR
    ("status" = 'PUBLISHED' AND "effective_at" IS NOT NULL AND "published_by_user_id" IS NOT NULL AND "published_at" IS NOT NULL AND btrim("publish_reason") <> '')
  )
);

CREATE TABLE "verification_document_policy_items" (
  "id" TEXT NOT NULL,
  "policy_version_id" TEXT NOT NULL,
  "document_type_id" TEXT NOT NULL,
  "is_required" BOOLEAN NOT NULL DEFAULT true,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "field_rules" JSONB NOT NULL,
  "position" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "verification_document_policy_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "verification_document_policy_items_position_check" CHECK ("position" >= 0)
);

CREATE TABLE "provider_policy_activation_states" (
  "id" VARCHAR(100) NOT NULL,
  "cursor" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_policy_activation_states_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_policy_activation_states_version_check" CHECK ("version" > 0)
);

CREATE TABLE "provider_document_chains" (
  "id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "document_type_id" TEXT NOT NULL,
  "effective_version_id" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_document_chains_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_document_chains_version_check" CHECK ("version" > 0)
);

CREATE TABLE "provider_document_versions" (
  "id" TEXT NOT NULL,
  "chain_id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "predecessor_version_id" TEXT,
  "status" "ProviderDocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "country_code" VARCHAR(2) NOT NULL,
  "document_number" VARCHAR(300) NOT NULL,
  "legal_name" VARCHAR(300) NOT NULL,
  "issuer_name" VARCHAR(300) NOT NULL,
  "issue_date" DATE NOT NULL,
  "expires_at" DATE,
  "evidence_format" "ProviderDocumentEvidenceFormat",
  "policy_version_id" TEXT,
  "policy_item_id" TEXT,
  "policy_rule_snapshot" JSONB,
  "created_by_user_id" TEXT NOT NULL,
  "submitted_by_user_id" TEXT,
  "submitted_at" TIMESTAMP(3),
  "approved_at" TIMESTAMP(3),
  "rejected_at" TIMESTAMP(3),
  "replacement_requested_at" TIMESTAMP(3),
  "expired_at" TIMESTAMP(3),
  "invalidated_at" TIMESTAMP(3),
  "superseded_at" TIMESTAMP(3),
  "idempotency_key" VARCHAR(200) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_document_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_document_versions_counters_check" CHECK ("sequence" > 0 AND "version" > 0),
  CONSTRAINT "provider_document_versions_country_check" CHECK ("country_code" ~ '^[A-Z]{2}$'),
  CONSTRAINT "provider_document_versions_dates_check" CHECK ("expires_at" IS NULL OR "expires_at" >= "issue_date"),
  CONSTRAINT "provider_document_versions_private_metadata_check" CHECK (btrim("document_number") <> '' AND btrim("legal_name") <> '' AND btrim("issuer_name") <> '')
);

CREATE TABLE "provider_document_evidence" (
  "id" TEXT NOT NULL,
  "document_version_id" TEXT NOT NULL,
  "media_file_id" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "canonical_content_type" VARCHAR(50) NOT NULL,
  "byte_size" INTEGER NOT NULL,
  "page_count" INTEGER,
  "expected_document_version" INTEGER NOT NULL,
  "bound_by_user_id" TEXT NOT NULL,
  "idempotency_key" VARCHAR(200) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_document_evidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_document_evidence_facts_check" CHECK (
    "position" >= 0 AND "byte_size" > 0 AND "expected_document_version" > 0 AND ("page_count" IS NULL OR "page_count" > 0)
    AND "canonical_content_type" IN ('application/pdf', 'image/jpeg', 'image/png')
  )
);

CREATE TABLE "provider_document_reviews" (
  "id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "document_version_id" TEXT NOT NULL,
  "outcome" "ProviderDocumentDecisionOutcome" NOT NULL,
  "reason" VARCHAR(1000) NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "request_id" VARCHAR(200),
  "expected_document_version" INTEGER NOT NULL,
  "operation_key" VARCHAR(200) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_document_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_document_reviews_reason_check" CHECK (length(btrim("reason")) >= 10 AND "expected_document_version" > 0)
);

CREATE TABLE "provider_verification_history" (
  "id" TEXT NOT NULL,
  "provider_id" TEXT,
  "document_version_id" TEXT,
  "policy_version_id" TEXT,
  "event" "ProviderVerificationHistoryEvent" NOT NULL,
  "from_status" "ProviderDocumentStatus",
  "to_status" "ProviderDocumentStatus",
  "actor_type" "AuditActorType" NOT NULL,
  "actor_user_id" TEXT,
  "reason_code" VARCHAR(100),
  "reason_text" VARCHAR(1000),
  "request_id" VARCHAR(200),
  "mutation_target_id" VARCHAR(200),
  "exact_version" INTEGER,
  "operation_key" VARCHAR(200) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_verification_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_verification_history_version_check" CHECK ("exact_version" IS NULL OR "exact_version" > 0)
);

CREATE TABLE "payout_destination_types" (
  "id" TEXT NOT NULL,
  "code" "PayoutDestinationKind" NOT NULL,
  "label_ar" VARCHAR(200) NOT NULL,
  "label_en" VARCHAR(200) NOT NULL,
  "description_ar" VARCHAR(1000),
  "description_en" VARCHAR(1000),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payout_destination_types_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payout_destination_types_version_check" CHECK ("version" > 0)
);

CREATE TABLE "payout_operators" (
  "id" TEXT NOT NULL,
  "country_id" TEXT NOT NULL,
  "code" VARCHAR(100) NOT NULL,
  "label_ar" VARCHAR(200) NOT NULL,
  "label_en" VARCHAR(200) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payout_operators_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payout_operators_version_check" CHECK ("version" > 0 AND btrim("code") <> '')
);

CREATE TABLE "payout_banks" (
  "id" TEXT NOT NULL,
  "country_id" TEXT NOT NULL,
  "code" VARCHAR(100) NOT NULL,
  "name_ar" VARCHAR(200) NOT NULL,
  "name_en" VARCHAR(200) NOT NULL,
  "routing_display" JSONB,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payout_banks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payout_banks_version_check" CHECK ("version" > 0 AND btrim("code") <> '')
);

CREATE TABLE "payout_country_policies" (
  "id" TEXT NOT NULL,
  "country_id" TEXT NOT NULL,
  "allowed_destination_types" "PayoutDestinationKind"[] NOT NULL,
  "allowed_currency_codes" TEXT[] NOT NULL,
  "calling_codes" TEXT[] NOT NULL,
  "iban_lengths" INTEGER[] NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payout_country_policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payout_country_policies_version_check" CHECK ("version" > 0)
);

CREATE TABLE "provider_payout_destination_chains" (
  "id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "destination_type_id" TEXT NOT NULL,
  "current_version_id" TEXT,
  "effective_approved_version_id" TEXT,
  "former_primary_eligible" BOOLEAN NOT NULL DEFAULT false,
  "primary_restoration_state_version" INTEGER,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_payout_destination_chains_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_payout_destination_chains_version_check" CHECK ("version" > 0 AND ("primary_restoration_state_version" IS NULL OR "primary_restoration_state_version" > 0))
);

CREATE TABLE "provider_payout_identity_claims" (
  "id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "chain_id" TEXT NOT NULL,
  "kind" "PayoutDestinationKind" NOT NULL,
  "country_code" VARCHAR(2),
  "calling_code" VARCHAR(3),
  "iban_country_prefix" VARCHAR(2),
  "last_four" VARCHAR(4) NOT NULL,
  "identifier_length" INTEGER NOT NULL,
  "status" "PayoutIdentityClaimStatus" NOT NULL DEFAULT 'ACTIVE',
  "claimed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "released_at" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_payout_identity_claims_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_payout_identity_claims_version_check" CHECK ("version" > 0 AND "identifier_length" > 0),
  CONSTRAINT "provider_payout_identity_claims_status_check" CHECK (("status" = 'ACTIVE' AND "released_at" IS NULL) OR ("status" = 'RELEASED' AND "released_at" IS NOT NULL)),
  CONSTRAINT "provider_payout_identity_claims_mask_shape_check" CHECK (
    ("kind" = 'MOBILE_WALLET' AND "country_code" IS NOT NULL AND "calling_code" IS NOT NULL AND "iban_country_prefix" IS NULL)
    OR
    ("kind" = 'BANK_ACCOUNT' AND "country_code" IS NULL AND "calling_code" IS NULL AND "iban_country_prefix" IS NOT NULL)
  )
);

CREATE TABLE "provider_payout_lookup_fingerprints" (
  "id" TEXT NOT NULL,
  "claim_id" TEXT NOT NULL,
  "lookup_key_id" VARCHAR(64) NOT NULL,
  "fingerprint" CHAR(64) NOT NULL,
  "claim_status" "PayoutIdentityClaimStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "retired_at" TIMESTAMP(3),
  CONSTRAINT "provider_payout_lookup_fingerprints_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_payout_lookup_fingerprints_value_check" CHECK ("fingerprint" ~ '^[0-9a-f]{64}$' AND btrim("lookup_key_id") <> '')
);

CREATE TABLE "provider_payout_destination_versions" (
  "id" TEXT NOT NULL,
  "chain_id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "identity_claim_id" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "predecessor_version_id" TEXT,
  "kind" "PayoutDestinationKind" NOT NULL,
  "status" "PayoutDestinationStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "crypto_revision" INTEGER NOT NULL DEFAULT 1,
  "country_id" TEXT NOT NULL,
  "country_code" VARCHAR(2) NOT NULL,
  "currency_code" VARCHAR(3),
  "operator_id" TEXT,
  "bank_id" TEXT,
  "holder_relationship" "PayoutHolderRelationship" NOT NULL,
  "identifier_ciphertext" TEXT NOT NULL,
  "identifier_nonce" VARCHAR(16) NOT NULL,
  "identifier_tag" VARCHAR(24) NOT NULL,
  "identifier_encryption_key_id" VARCHAR(64) NOT NULL,
  "holder_name_ciphertext" TEXT NOT NULL,
  "holder_name_nonce" VARCHAR(16) NOT NULL,
  "holder_name_tag" VARCHAR(24) NOT NULL,
  "holder_name_encryption_key_id" VARCHAR(64) NOT NULL,
  "created_by_user_id" TEXT NOT NULL,
  "submitted_by_user_id" TEXT,
  "submitted_at" TIMESTAMP(3),
  "approved_at" TIMESTAMP(3),
  "rejected_at" TIMESTAMP(3),
  "changes_requested_at" TIMESTAMP(3),
  "replacement_requested_at" TIMESTAMP(3),
  "invalidated_at" TIMESTAMP(3),
  "superseded_at" TIMESTAMP(3),
  "removed_at" TIMESTAMP(3),
  "idempotency_key" VARCHAR(200) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_payout_destination_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_payout_destination_versions_counters_check" CHECK ("sequence" > 0 AND "version" > 0 AND "crypto_revision" > 0),
  CONSTRAINT "provider_payout_destination_versions_country_check" CHECK ("country_code" ~ '^[A-Z]{2}$'),
  CONSTRAINT "provider_payout_destination_versions_type_shape_check" CHECK (
    ("kind" = 'MOBILE_WALLET' AND "operator_id" IS NOT NULL AND "bank_id" IS NULL AND "currency_code" IS NULL)
    OR
    ("kind" = 'BANK_ACCOUNT' AND "operator_id" IS NULL AND "bank_id" IS NOT NULL AND "currency_code" IS NOT NULL)
  ),
  CONSTRAINT "provider_payout_destination_versions_envelope_check" CHECK (
    btrim("identifier_ciphertext") <> '' AND btrim("holder_name_ciphertext") <> ''
    AND btrim("identifier_encryption_key_id") <> '' AND btrim("holder_name_encryption_key_id") <> ''
    AND length("identifier_nonce") = 16 AND length("holder_name_nonce") = 16
    AND length("identifier_tag") BETWEEN 22 AND 24 AND length("holder_name_tag") BETWEEN 22 AND 24
  )
);

CREATE TABLE "provider_payout_decisions" (
  "id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "destination_version_id" TEXT NOT NULL,
  "outcome" "PayoutDecisionOutcome" NOT NULL,
  "verification_method" "PayoutVerificationMethod" NOT NULL,
  "reason_code" VARCHAR(100) NOT NULL,
  "verification_note" VARCHAR(1000) NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expected_destination_version" INTEGER NOT NULL,
  "accepted_reveal_attempt_id" VARCHAR(200),
  "request_id" VARCHAR(200),
  "operation_key" VARCHAR(200) NOT NULL,
  "from_status" "PayoutDestinationStatus" NOT NULL,
  "to_status" "PayoutDestinationStatus" NOT NULL,
  "encryption_key_ids" TEXT[] NOT NULL,
  "lookup_key_ids" TEXT[] NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_payout_decisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_payout_decisions_reason_check" CHECK (length(btrim("verification_note")) >= 10 AND btrim("reason_code") <> '' AND "expected_destination_version" > 0)
);

CREATE TABLE "provider_primary_payout_destinations" (
  "provider_id" TEXT NOT NULL,
  "destination_version_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "selected_by_user_id" TEXT NOT NULL,
  "selected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "selection_reason_code" VARCHAR(100) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_primary_payout_destinations_pkey" PRIMARY KEY ("provider_id"),
  CONSTRAINT "provider_primary_payout_destinations_version_check" CHECK ("version" > 0 AND btrim("selection_reason_code") <> '')
);

CREATE TABLE "provider_payout_conflicts" (
  "id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "command_id" VARCHAR(100) NOT NULL,
  "operation_key" VARCHAR(200) NOT NULL,
  "kind" "PayoutDestinationKind" NOT NULL,
  "safe_mask" VARCHAR(100) NOT NULL,
  "incumbent_claim_id" TEXT NOT NULL,
  "status" "PayoutConflictStatus" NOT NULL DEFAULT 'OPEN',
  "opened_by_user_id" TEXT NOT NULL,
  "opened_request_id" VARCHAR(200),
  "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_by_user_id" TEXT,
  "resolved_at" TIMESTAMP(3),
  "resolution_reason" VARCHAR(1000),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_payout_conflicts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_payout_conflicts_version_check" CHECK ("version" > 0),
  CONSTRAINT "provider_payout_conflicts_resolution_shape_check" CHECK (
    ("status" = 'OPEN' AND "resolved_by_user_id" IS NULL AND "resolved_at" IS NULL AND "resolution_reason" IS NULL)
    OR
    ("status" <> 'OPEN' AND "resolved_by_user_id" IS NOT NULL AND "resolved_at" IS NOT NULL AND length(btrim("resolution_reason")) >= 10)
  )
);

CREATE TABLE "provider_payout_history" (
  "id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "chain_id" TEXT,
  "destination_version_id" TEXT,
  "decision_id" TEXT,
  "conflict_id" TEXT,
  "event" "PayoutHistoryEvent" NOT NULL,
  "from_status" "PayoutDestinationStatus",
  "to_status" "PayoutDestinationStatus",
  "actor_type" "AuditActorType" NOT NULL,
  "actor_user_id" TEXT,
  "reason_code" VARCHAR(100),
  "reason_text" VARCHAR(1000),
  "safe_mask" VARCHAR(100),
  "request_id" VARCHAR(200),
  "exact_version" INTEGER,
  "expected_primary_version" INTEGER,
  "replacement_destination_version_id" TEXT,
  "acknowledge_readiness_loss" BOOLEAN,
  "operation_key" VARCHAR(200) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_payout_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_payout_history_version_check" CHECK (("exact_version" IS NULL OR "exact_version" > 0) AND ("expected_primary_version" IS NULL OR "expected_primary_version" >= 0))
);

CREATE TABLE "provider_payout_key_rotation_runs" (
  "id" TEXT NOT NULL,
  "purpose" "PayoutKeyPurpose" NOT NULL,
  "from_key_ids" TEXT[] NOT NULL,
  "to_active_key_id" VARCHAR(64) NOT NULL,
  "status" "PayoutKeyRotationStatus" NOT NULL DEFAULT 'PLANNED',
  "batch_size" INTEGER NOT NULL,
  "cursor" TEXT,
  "scanned_count" INTEGER NOT NULL DEFAULT 0,
  "updated_count" INTEGER NOT NULL DEFAULT 0,
  "failed_count" INTEGER NOT NULL DEFAULT 0,
  "remaining_reference_count" INTEGER,
  "started_by_user_id" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verified_at" TIMESTAMP(3),
  "verified_by_user_id" TEXT,
  "retirement_approved_at" TIMESTAMP(3),
  "retirement_approved_by_user_id" TEXT,
  "retirement_reason" VARCHAR(1000),
  "last_safe_error_code" VARCHAR(100),
  "operation_key" VARCHAR(200) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_payout_key_rotation_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_payout_key_rotation_runs_counters_check" CHECK ("batch_size" BETWEEN 1 AND 1000 AND "version" > 0 AND "scanned_count" >= 0 AND "updated_count" >= 0 AND "failed_count" >= 0 AND ("remaining_reference_count" IS NULL OR "remaining_reference_count" >= 0)),
  CONSTRAINT "provider_payout_key_rotation_runs_retirement_check" CHECK (("retirement_approved_at" IS NULL AND "retirement_approved_by_user_id" IS NULL AND "retirement_reason" IS NULL) OR ("remaining_reference_count" = 0 AND "verified_at" IS NOT NULL AND "retirement_approved_at" IS NOT NULL AND "retirement_approved_by_user_id" IS NOT NULL AND length(btrim("retirement_reason")) >= 10))
);

ALTER TABLE "provider_email_outbox" ADD COLUMN "verification_history_id" TEXT;
ALTER TABLE "provider_email_outbox" ADD COLUMN "payout_history_id" TEXT;

CREATE UNIQUE INDEX "verification_document_types_code_key" ON "verification_document_types"("code");
CREATE INDEX "verification_document_types_is_active_code_idx" ON "verification_document_types"("is_active", "code");
CREATE UNIQUE INDEX "verification_document_policy_versions_scope_version_key" ON "verification_document_policy_versions"("country_id", "provider_kind", "policy_version");
CREATE UNIQUE INDEX "verification_document_policy_versions_idempotency_key" ON "verification_document_policy_versions"("idempotency_key");
CREATE UNIQUE INDEX "verification_document_policy_versions_last_mutation_key" ON "verification_document_policy_versions"("last_mutation_key");
CREATE UNIQUE INDEX "verification_document_policy_versions_one_draft" ON "verification_document_policy_versions"("country_id", "provider_kind") WHERE "status" = 'DRAFT';
CREATE UNIQUE INDEX "verification_document_policy_versions_effective_time_key" ON "verification_document_policy_versions"("country_id", "provider_kind", "effective_at") WHERE "status" = 'PUBLISHED';
CREATE INDEX "verification_document_policy_versions_effective_idx" ON "verification_document_policy_versions"("country_id", "provider_kind", "status", "effective_at" DESC);
CREATE UNIQUE INDEX "verification_document_policy_items_type_key" ON "verification_document_policy_items"("policy_version_id", "document_type_id");
CREATE UNIQUE INDEX "verification_document_policy_items_position_key" ON "verification_document_policy_items"("policy_version_id", "position");
CREATE UNIQUE INDEX "provider_document_chains_provider_type_key" ON "provider_document_chains"("provider_id", "document_type_id");
CREATE UNIQUE INDEX "provider_document_chains_effective_version_key" ON "provider_document_chains"("effective_version_id");
CREATE INDEX "provider_document_chains_provider_updated_idx" ON "provider_document_chains"("provider_id", "updated_at" DESC, "id");
CREATE UNIQUE INDEX "provider_document_versions_chain_sequence_key" ON "provider_document_versions"("chain_id", "sequence");
CREATE UNIQUE INDEX "provider_document_versions_predecessor_key" ON "provider_document_versions"("predecessor_version_id");
CREATE UNIQUE INDEX "provider_document_versions_idempotency_key" ON "provider_document_versions"("idempotency_key");
CREATE UNIQUE INDEX "provider_document_versions_one_open_successor" ON "provider_document_versions"("predecessor_version_id") WHERE "predecessor_version_id" IS NOT NULL AND "status" IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REPLACEMENT_REQUESTED');
CREATE INDEX "provider_document_versions_provider_status_idx" ON "provider_document_versions"("provider_id", "status", "updated_at" DESC, "id");
CREATE INDEX "provider_document_versions_queue_idx" ON "provider_document_versions"("status", "submitted_at", "id");
CREATE UNIQUE INDEX "provider_document_evidence_media_key" ON "provider_document_evidence"("media_file_id");
CREATE UNIQUE INDEX "provider_document_evidence_idempotency_key" ON "provider_document_evidence"("idempotency_key");
CREATE UNIQUE INDEX "provider_document_evidence_position_key" ON "provider_document_evidence"("document_version_id", "position");
CREATE UNIQUE INDEX "provider_document_reviews_operation_key" ON "provider_document_reviews"("operation_key");
CREATE INDEX "provider_document_reviews_version_idx" ON "provider_document_reviews"("document_version_id", "decided_at");
CREATE INDEX "provider_document_reviews_provider_idx" ON "provider_document_reviews"("provider_id", "decided_at" DESC, "id");
CREATE UNIQUE INDEX "provider_verification_history_operation_key" ON "provider_verification_history"("operation_key");
CREATE INDEX "provider_verification_history_provider_cursor_idx" ON "provider_verification_history"("provider_id", "created_at" DESC, "id");
CREATE INDEX "provider_verification_history_event_cursor_idx" ON "provider_verification_history"("event", "created_at", "id");
CREATE INDEX "provider_verification_history_request_event_idx" ON "provider_verification_history"("request_id", "event");
CREATE UNIQUE INDEX "payout_destination_types_code_key" ON "payout_destination_types"("code");
CREATE INDEX "payout_destination_types_active_idx" ON "payout_destination_types"("is_active", "code");
CREATE UNIQUE INDEX "payout_operators_country_code_key" ON "payout_operators"("country_id", "code");
CREATE INDEX "payout_operators_country_active_idx" ON "payout_operators"("country_id", "is_active", "code");
CREATE UNIQUE INDEX "payout_banks_country_code_key" ON "payout_banks"("country_id", "code");
CREATE INDEX "payout_banks_country_active_idx" ON "payout_banks"("country_id", "is_active", "code");
CREATE UNIQUE INDEX "payout_country_policies_country_key" ON "payout_country_policies"("country_id");
CREATE INDEX "payout_country_policies_active_idx" ON "payout_country_policies"("is_active");
CREATE UNIQUE INDEX "provider_payout_destination_chains_current_key" ON "provider_payout_destination_chains"("current_version_id");
CREATE UNIQUE INDEX "provider_payout_destination_chains_effective_key" ON "provider_payout_destination_chains"("effective_approved_version_id");
CREATE INDEX "provider_payout_destination_chains_provider_idx" ON "provider_payout_destination_chains"("provider_id", "updated_at" DESC, "id");
CREATE INDEX "provider_payout_identity_claims_provider_idx" ON "provider_payout_identity_claims"("provider_id", "kind", "status");
CREATE INDEX "provider_payout_identity_claims_chain_idx" ON "provider_payout_identity_claims"("chain_id", "status");
CREATE UNIQUE INDEX "provider_payout_lookup_fingerprints_claim_key" ON "provider_payout_lookup_fingerprints"("claim_id", "lookup_key_id");
CREATE UNIQUE INDEX "provider_payout_lookup_fingerprints_active_unique" ON "provider_payout_lookup_fingerprints"("lookup_key_id", "fingerprint") WHERE "claim_status" = 'ACTIVE' AND "retired_at" IS NULL;
CREATE INDEX "provider_payout_lookup_fingerprints_key_status_idx" ON "provider_payout_lookup_fingerprints"("lookup_key_id", "claim_status");
CREATE UNIQUE INDEX "provider_payout_destination_versions_chain_sequence_key" ON "provider_payout_destination_versions"("chain_id", "sequence");
CREATE UNIQUE INDEX "provider_payout_destination_versions_predecessor_key" ON "provider_payout_destination_versions"("predecessor_version_id");
CREATE UNIQUE INDEX "provider_payout_destination_versions_idempotency_key" ON "provider_payout_destination_versions"("idempotency_key");
CREATE UNIQUE INDEX "provider_payout_destination_versions_one_open_successor" ON "provider_payout_destination_versions"("predecessor_version_id") WHERE "predecessor_version_id" IS NOT NULL AND "status" IN ('DRAFT', 'PENDING_VERIFICATION', 'CHANGES_REQUESTED', 'APPROVED', 'REPLACEMENT_REQUESTED');
CREATE INDEX "provider_payout_destination_versions_provider_status_idx" ON "provider_payout_destination_versions"("provider_id", "status", "updated_at" DESC, "id");
CREATE INDEX "provider_payout_destination_versions_queue_idx" ON "provider_payout_destination_versions"("status", "submitted_at", "id");
CREATE UNIQUE INDEX "provider_payout_decisions_operation_key" ON "provider_payout_decisions"("operation_key");
CREATE UNIQUE INDEX "provider_payout_decisions_accepted_reveal_key" ON "provider_payout_decisions"("accepted_reveal_attempt_id") WHERE "accepted_reveal_attempt_id" IS NOT NULL;
CREATE INDEX "provider_payout_decisions_version_idx" ON "provider_payout_decisions"("destination_version_id", "decided_at");
CREATE INDEX "provider_payout_decisions_provider_idx" ON "provider_payout_decisions"("provider_id", "decided_at" DESC, "id");
CREATE UNIQUE INDEX "provider_primary_payout_destinations_version_key" ON "provider_primary_payout_destinations"("destination_version_id");
CREATE UNIQUE INDEX "provider_payout_conflicts_operation_key" ON "provider_payout_conflicts"("operation_key");
CREATE UNIQUE INDEX "provider_payout_conflicts_one_open_operation" ON "provider_payout_conflicts"("provider_id", "command_id") WHERE "status" = 'OPEN';
CREATE INDEX "provider_payout_conflicts_queue_idx" ON "provider_payout_conflicts"("status", "opened_at", "id");
CREATE INDEX "provider_payout_conflicts_provider_idx" ON "provider_payout_conflicts"("provider_id", "status", "opened_at");
CREATE UNIQUE INDEX "provider_payout_history_operation_key" ON "provider_payout_history"("operation_key");
CREATE INDEX "provider_payout_history_provider_cursor_idx" ON "provider_payout_history"("provider_id", "created_at" DESC, "id");
CREATE INDEX "provider_payout_history_event_cursor_idx" ON "provider_payout_history"("event", "created_at", "id");
CREATE UNIQUE INDEX "provider_payout_key_rotation_runs_operation_key" ON "provider_payout_key_rotation_runs"("operation_key");
CREATE INDEX "provider_payout_key_rotation_runs_cursor_idx" ON "provider_payout_key_rotation_runs"("purpose", "status", "updated_at", "id");
CREATE INDEX "provider_email_outbox_verification_history_id_idx" ON "provider_email_outbox"("verification_history_id");
CREATE INDEX "provider_email_outbox_payout_history_id_idx" ON "provider_email_outbox"("payout_history_id");

ALTER TABLE "verification_document_policy_versions" ADD CONSTRAINT "verification_document_policy_versions_country_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_document_policy_versions" ADD CONSTRAINT "verification_document_policy_versions_creator_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_document_policy_versions" ADD CONSTRAINT "verification_document_policy_versions_publisher_fkey" FOREIGN KEY ("published_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_document_policy_versions" ADD CONSTRAINT "verification_document_policy_versions_last_mutation_actor_fkey" FOREIGN KEY ("last_mutation_actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_document_policy_items" ADD CONSTRAINT "verification_document_policy_items_policy_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "verification_document_policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_document_policy_items" ADD CONSTRAINT "verification_document_policy_items_type_fkey" FOREIGN KEY ("document_type_id") REFERENCES "verification_document_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_document_chains" ADD CONSTRAINT "provider_document_chains_provider_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_document_chains" ADD CONSTRAINT "provider_document_chains_type_fkey" FOREIGN KEY ("document_type_id") REFERENCES "verification_document_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_document_versions" ADD CONSTRAINT "provider_document_versions_chain_fkey" FOREIGN KEY ("chain_id") REFERENCES "provider_document_chains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_document_versions" ADD CONSTRAINT "provider_document_versions_provider_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_document_versions" ADD CONSTRAINT "provider_document_versions_predecessor_fkey" FOREIGN KEY ("predecessor_version_id") REFERENCES "provider_document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_document_versions" ADD CONSTRAINT "provider_document_versions_policy_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "verification_document_policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_document_versions" ADD CONSTRAINT "provider_document_versions_policy_item_fkey" FOREIGN KEY ("policy_item_id") REFERENCES "verification_document_policy_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_document_versions" ADD CONSTRAINT "provider_document_versions_creator_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_document_versions" ADD CONSTRAINT "provider_document_versions_submitter_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_document_chains" ADD CONSTRAINT "provider_document_chains_effective_fkey" FOREIGN KEY ("effective_version_id") REFERENCES "provider_document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_document_evidence" ADD CONSTRAINT "provider_document_evidence_version_fkey" FOREIGN KEY ("document_version_id") REFERENCES "provider_document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_document_evidence" ADD CONSTRAINT "provider_document_evidence_media_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_document_evidence" ADD CONSTRAINT "provider_document_evidence_bound_by_fkey" FOREIGN KEY ("bound_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_document_reviews" ADD CONSTRAINT "provider_document_reviews_provider_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_document_reviews" ADD CONSTRAINT "provider_document_reviews_version_fkey" FOREIGN KEY ("document_version_id") REFERENCES "provider_document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_document_reviews" ADD CONSTRAINT "provider_document_reviews_actor_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_verification_history" ADD CONSTRAINT "provider_verification_history_provider_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_verification_history" ADD CONSTRAINT "provider_verification_history_version_fkey" FOREIGN KEY ("document_version_id") REFERENCES "provider_document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_verification_history" ADD CONSTRAINT "provider_verification_history_policy_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "verification_document_policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_verification_history" ADD CONSTRAINT "provider_verification_history_actor_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payout_operators" ADD CONSTRAINT "payout_operators_country_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payout_banks" ADD CONSTRAINT "payout_banks_country_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payout_country_policies" ADD CONSTRAINT "payout_country_policies_country_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_destination_chains" ADD CONSTRAINT "provider_payout_destination_chains_provider_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_destination_chains" ADD CONSTRAINT "provider_payout_destination_chains_type_fkey" FOREIGN KEY ("destination_type_id") REFERENCES "payout_destination_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_identity_claims" ADD CONSTRAINT "provider_payout_identity_claims_provider_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_identity_claims" ADD CONSTRAINT "provider_payout_identity_claims_chain_fkey" FOREIGN KEY ("chain_id") REFERENCES "provider_payout_destination_chains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_lookup_fingerprints" ADD CONSTRAINT "provider_payout_lookup_fingerprints_claim_fkey" FOREIGN KEY ("claim_id") REFERENCES "provider_payout_identity_claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_destination_versions" ADD CONSTRAINT "provider_payout_destination_versions_chain_fkey" FOREIGN KEY ("chain_id") REFERENCES "provider_payout_destination_chains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_destination_versions" ADD CONSTRAINT "provider_payout_destination_versions_provider_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_destination_versions" ADD CONSTRAINT "provider_payout_destination_versions_claim_fkey" FOREIGN KEY ("identity_claim_id") REFERENCES "provider_payout_identity_claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_destination_versions" ADD CONSTRAINT "provider_payout_destination_versions_country_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_destination_versions" ADD CONSTRAINT "provider_payout_destination_versions_operator_fkey" FOREIGN KEY ("operator_id") REFERENCES "payout_operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_destination_versions" ADD CONSTRAINT "provider_payout_destination_versions_bank_fkey" FOREIGN KEY ("bank_id") REFERENCES "payout_banks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_destination_versions" ADD CONSTRAINT "provider_payout_destination_versions_predecessor_fkey" FOREIGN KEY ("predecessor_version_id") REFERENCES "provider_payout_destination_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_destination_versions" ADD CONSTRAINT "provider_payout_destination_versions_creator_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_destination_versions" ADD CONSTRAINT "provider_payout_destination_versions_submitter_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_destination_chains" ADD CONSTRAINT "provider_payout_destination_chains_current_fkey" FOREIGN KEY ("current_version_id") REFERENCES "provider_payout_destination_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_destination_chains" ADD CONSTRAINT "provider_payout_destination_chains_effective_fkey" FOREIGN KEY ("effective_approved_version_id") REFERENCES "provider_payout_destination_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_decisions" ADD CONSTRAINT "provider_payout_decisions_provider_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_decisions" ADD CONSTRAINT "provider_payout_decisions_version_fkey" FOREIGN KEY ("destination_version_id") REFERENCES "provider_payout_destination_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_decisions" ADD CONSTRAINT "provider_payout_decisions_actor_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_primary_payout_destinations" ADD CONSTRAINT "provider_primary_payout_destinations_provider_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_primary_payout_destinations" ADD CONSTRAINT "provider_primary_payout_destinations_version_fkey" FOREIGN KEY ("destination_version_id") REFERENCES "provider_payout_destination_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_primary_payout_destinations" ADD CONSTRAINT "provider_primary_payout_destinations_actor_fkey" FOREIGN KEY ("selected_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_conflicts" ADD CONSTRAINT "provider_payout_conflicts_provider_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_conflicts" ADD CONSTRAINT "provider_payout_conflicts_claim_fkey" FOREIGN KEY ("incumbent_claim_id") REFERENCES "provider_payout_identity_claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_conflicts" ADD CONSTRAINT "provider_payout_conflicts_opener_fkey" FOREIGN KEY ("opened_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_conflicts" ADD CONSTRAINT "provider_payout_conflicts_resolver_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_history" ADD CONSTRAINT "provider_payout_history_provider_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_history" ADD CONSTRAINT "provider_payout_history_chain_fkey" FOREIGN KEY ("chain_id") REFERENCES "provider_payout_destination_chains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_history" ADD CONSTRAINT "provider_payout_history_version_fkey" FOREIGN KEY ("destination_version_id") REFERENCES "provider_payout_destination_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_history" ADD CONSTRAINT "provider_payout_history_decision_fkey" FOREIGN KEY ("decision_id") REFERENCES "provider_payout_decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_history" ADD CONSTRAINT "provider_payout_history_conflict_fkey" FOREIGN KEY ("conflict_id") REFERENCES "provider_payout_conflicts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_history" ADD CONSTRAINT "provider_payout_history_actor_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_key_rotation_runs" ADD CONSTRAINT "provider_payout_key_rotation_runs_starter_fkey" FOREIGN KEY ("started_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_key_rotation_runs" ADD CONSTRAINT "provider_payout_key_rotation_runs_verifier_fkey" FOREIGN KEY ("verified_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_payout_key_rotation_runs" ADD CONSTRAINT "provider_payout_key_rotation_runs_approver_fkey" FOREIGN KEY ("retirement_approved_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_email_outbox" ADD CONSTRAINT "provider_email_outbox_verification_history_fkey" FOREIGN KEY ("verification_history_id") REFERENCES "provider_verification_history"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_email_outbox" ADD CONSTRAINT "provider_email_outbox_payout_history_fkey" FOREIGN KEY ("payout_history_id") REFERENCES "provider_payout_history"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMENT ON TABLE "provider_document_versions" IS 'Providers-owned private verification metadata. Never expose private fields through ordinary projections.';
COMMENT ON TABLE "provider_payout_destination_versions" IS 'Providers-owned encrypted external payout destinations. Contains envelopes only, never protected plaintext.';
COMMENT ON TABLE "provider_payout_lookup_fingerprints" IS 'Providers-owned equality-only HMAC fingerprints. Never return through application DTOs.';
