import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = join(
  process.cwd(), "prisma", "migrations",
  "r1_p06_provider_verification_external_payout_destinations", "migration.sql",
);
const cleanValidator = join(process.cwd(), "scripts", "validate-clean-migration.ts");
const upgradeValidator = join(process.cwd(), "scripts", "validate-r1-p06-upgrade.ts");

describe("R1-P06 migration contract", () => {
  it("is additive, owns all phase tables and state guards, and persists no plaintext payout columns", () => {
    const sql = readFileSync(migration, "utf8");
    expect(sql).not.toMatch(/\b(?:DROP TABLE|TRUNCATE|DELETE FROM)\b/iu);
    expect(sql).not.toMatch(/(?:wallet_number|\biban\b|holder_legal_name)\s+/iu);
    for (const table of [
      "sensitive_action_proof_uses",
      "verification_document_types", "verification_document_policy_versions",
      "verification_document_policy_items", "provider_document_chains",
      "provider_policy_activation_states",
      "provider_document_versions", "provider_document_evidence", "provider_document_reviews",
      "provider_verification_history", "payout_destination_types", "payout_operators",
      "payout_banks", "payout_country_policies", "provider_payout_destination_chains",
      "provider_payout_identity_claims", "provider_payout_lookup_fingerprints",
      "provider_payout_destination_versions", "provider_payout_decisions",
      "provider_primary_payout_destinations", "provider_payout_conflicts",
      "provider_payout_history", "provider_payout_key_rotation_runs",
    ]) expect(sql).toContain(`CREATE TABLE "${table}"`);
    expect((sql.match(/CREATE TABLE/g) ?? [])).toHaveLength(23);
    expect(sql).toContain("provider_payout_lookup_fingerprints_active_unique");
    expect(sql).toContain("provider_document_versions_one_open_successor");
    expect(sql).toContain("provider_payout_destination_versions_one_open_successor");
    expect(sql).toContain("payout_primary_state_version");
    expect(sql).toContain("verification_document_policy_versions_last_mutation_key");
    expect(sql).toContain("provider_policy_activation_states_version_check");
    expect(sql).toContain("provider_payout_decisions_accepted_reveal_key");
    expect(sql).toContain("verification_provider_id");
    expect(sql).toContain("verification_document_version_id");
    expect(sql).toContain("media_files_verification_scope_pair_check");
    expect(sql).toContain("expected_document_version");
    expect(sql).toContain("provider_verification_history_request_event_idx");
    expect(sql).toContain("expected_primary_version");
    expect(sql).toContain("replacement_destination_version_id");
    expect(sql).toContain("acknowledge_readiness_loss");
    expect(sql).toContain("last_mutation_actor_user_id");
  });

  it("keeps executable clean and populated-upgrade proof coverage for critical live invariants", () => {
    const cleanProof = readFileSync(cleanValidator, "utf8");
    const upgradeProof = readFileSync(upgradeValidator, "utf8");
    for (const proofMarker of [
      "provider_payout_identity_claims_mask_shape_check",
      "cross-Provider active payout fingerprint uniqueness accepted a duplicate",
      "provider_payout_destination_versions_type_shape_check",
      "provider_payout_destination_versions_envelope_check",
      "one-open-successor uniqueness accepted a second successor",
      "one-primary uniqueness accepted a second primary",
      "operation idempotency uniqueness accepted a duplicate",
      "PAYOUT_DESTINATION_LIMIT_REACHED",
      "Live reveal serialization did not accept exactly five attempts",
    ]) expect(cleanProof).toContain(proofMarker);
    expect(upgradeProof).toContain("assertR1P05UpgradeBaselineHistory");
    expect(upgradeProof).toContain("populateR1P05Fixture");
    expect(upgradeProof).toContain("assertR1P05FixturePreserved");
    expect(upgradeProof).toContain("assertPostDeployState");
  });
});
