import { readFile } from "node:fs/promises";
import { join } from "node:path";


import { assertR1P07MigrationSql } from "../../../scripts/validate-clean-migration.js";

const migrationPath = join(
  process.cwd(),
  "prisma",
  "migrations",
  "r1_p07_worker_team_crew_management",
  "migration.sql",
);

describe("R1-P07 reviewed database constraint contract", () => {
  it("defines every concurrency-critical partial unique index", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain('CREATE UNIQUE INDEX "provider_workers_current_identity_unique"');
    expect(sql).toContain('WHERE "identity_user_id" IS NOT NULL AND "ended_at" IS NULL');
    expect(sql).toContain('CREATE UNIQUE INDEX "provider_team_memberships_current_worker_unique"');
    expect(sql).toContain('WHERE "ended_at" IS NULL');
    expect(sql).toContain('CREATE UNIQUE INDEX "provider_teams_non_archived_name_unique"');
    expect(sql).toContain('WHERE "status" <> \'ARCHIVED\' AND "normalized_name" IS NOT NULL');
    expect(sql).toContain('CREATE UNIQUE INDEX "provider_worker_invitations_pending_unique"');
  });

  it("defines positive versions and deferred Escort/Supervisor/active-Team invariants", async () => {
    const sql = await readFile(migrationPath, "utf8");
    for (const name of [
      "providers_workforce_state_version_positive_check",
      "provider_members_version_positive_check",
      "provider_workers_version_positive_check",
      "provider_worker_profiles_version_positive_check",
      "provider_worker_login_access_version_positive_check",
      "provider_teams_version_positive_check",
      "provider_team_memberships_version_positive_check",
    ]) {
      expect(sql).toContain(name);
    }
    expect(sql).toContain("DEFERRABLE INITIALLY DEFERRED");
    expect(sql).toContain("provider_team_memberships_escort_never_cleans");
    expect(sql).toContain("provider_teams_primary_supervisor_valid");
    expect(sql).toContain("provider_teams_active_valid");
    expect(sql).toContain("provider_workers_profile_required");
    expect(sql).toContain("provider_worker_login_access_invitation_same_worker");
  });

  it("rechecks both sides of membership moves and profile-driven Escort conflicts", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain('PERFORM "r1_p07_check_team_row"(OLD."team_id")');
    expect(sql).toContain('PERFORM "r1_p07_check_team_row"(NEW."team_id")');
    expect(sql).toContain('NEW."worker_type" = \'ESCORT\'');
    expect(sql).toContain('"ended_at" IS NULL AND "cleans"');
    expect(sql).toContain('AFTER INSERT OR UPDATE OR DELETE ON "provider_worker_profiles"');
  });

  it("rejects cyclic predecessors and application history mutation", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("WITH RECURSIVE predecessor_chain");
    expect(sql).toContain("provider_workers_predecessor_cycle");
    expect(sql).toContain('CREATE TRIGGER "provider_workforce_history_immutable"');
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON "provider_workforce_history"');
    expect(sql).toContain('"request_id" VARCHAR(200) NOT NULL');
  });

  it("is additive and creates only the ten R1-P07 workforce tables", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(() => assertR1P07MigrationSql(sql)).not.toThrow();
    expect(sql).not.toMatch(/\b(?:DROP\s+TABLE|TRUNCATE|DELETE\s+FROM)\b/iu);
    expect(sql.match(/CREATE TABLE "provider_/gu)).toHaveLength(10);
    expect(sql).toContain('ALTER TABLE "provider_members"');
    expect(sql).toContain('ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1');
  });
});
