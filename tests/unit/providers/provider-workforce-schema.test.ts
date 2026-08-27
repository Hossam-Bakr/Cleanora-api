
import {
  replaceWorkerProfileSchema,
  teamMembershipCommandSchema,
  teamSupervisorCommandSchema,
  workerAdminMembershipCommandSchema,
  workerLifecycleCommandSchema,
  workerLoginAccessCommandSchema,
  workforceCursorQuerySchema,
} from "../../../src/modules/providers/provider-workforce.schema.js";

const commandMeta = {
  expectedVersion: 1,
  idempotencyKey: "00000000-0000-4000-8000-000000000161",
};

describe("Provider workforce discriminated command schemas", () => {
  it("accepts valid action-specific fields while retaining strict command metadata", () => {
    expect(workerLifecycleCommandSchema.safeParse({
      ...commandMeta,
      action: "DEACTIVATE",
      reasonCode: "TEMPORARILY_UNAVAILABLE",
      confirmTeamImpact: false,
      confirmReadinessImpact: false,
    }).success).toBe(true);
    expect(workerLoginAccessCommandSchema.safeParse({
      ...commandMeta,
      action: "ISSUE_INVITATION",
      locale: "AR",
      email: "worker@example.invalid",
      recentAuthenticationProof: "opaque",
      expectedAccessVersion: null,
    }).success).toBe(true);
    expect(workerAdminMembershipCommandSchema.safeParse({
      ...commandMeta,
      action: "GRANT",
      reasonCode: "OPERATIONAL_RESPONSIBILITY",
      recentAuthenticationProof: "opaque",
      expectedMembershipVersion: null,
    }).success).toBe(true);
    expect(teamMembershipCommandSchema.safeParse({
      ...commandMeta,
      action: "UPDATE_CLEANS",
      workerId: "worker-1",
      membershipId: "membership-1",
      cleans: false,
      expectedWorkerVersion: 1,
      expectedMembershipVersion: 1,
      confirmLastCleanerImpact: false,
    }).success).toBe(true);
    expect(teamSupervisorCommandSchema.safeParse({
      ...commandMeta,
      action: "ASSIGN",
      workerId: "worker-1",
      expectedWorkerVersion: 1,
      expectedMembershipVersion: 1,
    }).success).toBe(true);
  });

  it("rejects unknown fields and enforces meaningful OTHER notes", () => {
    expect(workerLifecycleCommandSchema.safeParse({
      ...commandMeta,
      action: "ACTIVATE",
      unexpected: true,
    }).success).toBe(false);
    expect(workerLoginAccessCommandSchema.safeParse({
      ...commandMeta,
      action: "RESET_ACCESS",
      locale: "AR",
      email: "worker@example.invalid",
      recentAuthenticationProof: "opaque",
      expectedAccessVersion: null,
    }).success).toBe(false);
    expect(workerLifecycleCommandSchema.safeParse({
      ...commandMeta,
      action: "DEACTIVATE",
      reasonCode: "OTHER",
      note: "short",
    }).success).toBe(false);
  });

  it("keeps the public pagination default and full-replacement requirements explicit", () => {
    expect(workforceCursorQuerySchema.parse({})).toEqual({ limit: 25 });
    expect(replaceWorkerProfileSchema.safeParse({
      ...commandMeta,
      fullLegalName: "Synthetic Worker",
      gender: "female",
      operationalPhoneE164: "+201012345678",
      workerType: "CLEANING_STAFF",
    }).success).toBe(false);
  });
});
