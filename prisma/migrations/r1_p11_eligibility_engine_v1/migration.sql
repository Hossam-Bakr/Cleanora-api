-- R1-P11 Eligibility Engine V1 (DEC-082 / DEC-084).
-- Forward-only, additive migration after r1_p10_availability_capacity_textual_coverage.
-- No Country/Provider/Team/Catalog production truth rows are deleted.
-- expiresAt is an ordinary column; the application sets completedAt + interval
-- '720 hours' — no database DEFAULT interval expression at create time.
-- Partial unique indexes and the rowKind/teamId XOR CHECK cannot be expressed
-- in Prisma schema and are owned here.

CREATE TYPE "EligibilityCandidateRowKind" AS ENUM (
  'PROVIDER_SUMMARY',
  'TEAM_RESULT'
);

CREATE TABLE "eligibility_rule_versions" (
  "id" TEXT NOT NULL,
  "country_id" TEXT NOT NULL,
  "version_label" TEXT NOT NULL,
  "schema_version" TEXT NOT NULL,
  "engine_compatibility" TEXT NOT NULL,
  "rule_order" JSONB NOT NULL,
  "parameters" JSONB NOT NULL,
  "effective_from" TIMESTAMP(3) NOT NULL,
  "content_checksum" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by_provenance" TEXT NOT NULL,
  CONSTRAINT "eligibility_rule_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "eligibility_rule_versions_id_country_id_key"
  ON "eligibility_rule_versions"("id", "country_id");
CREATE UNIQUE INDEX "eligibility_rule_versions_country_id_version_label_key"
  ON "eligibility_rule_versions"("country_id", "version_label");
CREATE UNIQUE INDEX "eligibility_rule_versions_country_id_effective_from_key"
  ON "eligibility_rule_versions"("country_id", "effective_from");
CREATE INDEX "eligibility_rule_versions_country_id_effective_from_idx"
  ON "eligibility_rule_versions"("country_id", "effective_from");

ALTER TABLE "eligibility_rule_versions"
  ADD CONSTRAINT "eligibility_rule_versions_country_id_fkey"
  FOREIGN KEY ("country_id") REFERENCES "countries"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "eligibility_evaluations" (
  "id" TEXT NOT NULL,
  "rule_version_id" TEXT NOT NULL,
  "country_id" TEXT NOT NULL,
  "evaluated_at" TIMESTAMP(3) NOT NULL,
  "completed_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "request_normalized" JSONB NOT NULL,
  "request_hash" TEXT NOT NULL,
  "evidence_safe" JSONB NOT NULL,
  "evidence_hash" TEXT NOT NULL,
  "result_hash" TEXT NOT NULL,
  "metadata" JSONB NOT NULL,
  "outcome_summary" JSONB NOT NULL,
  "trace_id" TEXT,
  "engine_version" TEXT NOT NULL,
  CONSTRAINT "eligibility_evaluations_pkey" PRIMARY KEY ("id")
);

-- request_hash is intentionally not unique (fresh row per live invocation).
CREATE INDEX "eligibility_evaluations_expires_at_id_idx"
  ON "eligibility_evaluations"("expires_at", "id");
CREATE INDEX "eligibility_evaluations_rule_version_id_country_id_idx"
  ON "eligibility_evaluations"("rule_version_id", "country_id");
CREATE INDEX "eligibility_evaluations_country_id_evaluated_at_idx"
  ON "eligibility_evaluations"("country_id", "evaluated_at");

ALTER TABLE "eligibility_evaluations"
  ADD CONSTRAINT "eligibility_evaluations_rule_version_country_fkey"
  FOREIGN KEY ("rule_version_id", "country_id")
  REFERENCES "eligibility_rule_versions"("id", "country_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "eligibility_candidate_results" (
  "id" TEXT NOT NULL,
  "evaluation_id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "team_id" TEXT,
  "row_kind" "EligibilityCandidateRowKind" NOT NULL,
  "eligible" BOOLEAN NOT NULL,
  "rule_outcomes" JSONB NOT NULL,
  "reasons" JSONB NOT NULL,
  "sorting_facts" JSONB,
  "diagnostics_safe" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "eligibility_candidate_results_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "eligibility_candidate_results_row_kind_team_xor" CHECK (
    ("row_kind" = 'PROVIDER_SUMMARY' AND "team_id" IS NULL)
    OR ("row_kind" = 'TEAM_RESULT' AND "team_id" IS NOT NULL)
  )
);

CREATE INDEX "eligibility_candidate_results_evaluation_id_provider_id_idx"
  ON "eligibility_candidate_results"("evaluation_id", "provider_id");

-- Partial uniques: one Provider summary per (evaluation, provider);
-- one Team result per (evaluation, provider, team).
CREATE UNIQUE INDEX "eligibility_candidate_results_provider_summary_unique"
  ON "eligibility_candidate_results"("evaluation_id", "provider_id")
  WHERE "row_kind" = 'PROVIDER_SUMMARY';
CREATE UNIQUE INDEX "eligibility_candidate_results_team_result_unique"
  ON "eligibility_candidate_results"("evaluation_id", "provider_id", "team_id")
  WHERE "row_kind" = 'TEAM_RESULT';

ALTER TABLE "eligibility_candidate_results"
  ADD CONSTRAINT "eligibility_candidate_results_evaluation_id_fkey"
  FOREIGN KEY ("evaluation_id") REFERENCES "eligibility_evaluations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- No live FK on provider_id / team_id: historical evaluations and explicit
-- nonexistent Provider IDs must remain representable (DEC-082).
