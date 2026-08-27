
import { createFinalCleanerHarness, finalCleanerCommand } from "../../helpers/r1-p07-final-cleaner-harness.js";

describe("immutable evidence for multi-target workforce impact", () => {
  it("records one separate safe row for membership truth and one for Team lifecycle truth", async () => {
    const harness = createFinalCleanerHarness();
    await harness.service.change(finalCleanerCommand);
    const rows = harness.state().histories;
    expect(rows).toEqual([
      expect.objectContaining({
        targetType: "TEAM_MEMBERSHIP",
        targetId: "membership-final-cleaner",
        targetVersion: 3,
        eventCode: "TEAM_MEMBERSHIP_CLEANS_UPDATED",
        safeBefore: { status: "CURRENT", version: 2, teamId: "team-1", cleans: true },
        safeAfter: { status: "CURRENT", version: 3, teamId: "team-1", cleans: false },
      }),
      expect.objectContaining({
        targetType: "TEAM",
        targetId: "team-1",
        targetVersion: 6,
        eventCode: "TEAM_INACTIVATED_FINAL_CLEANER",
        safeBefore: { status: "ACTIVE", version: 4 },
        safeAfter: { status: "INACTIVE", version: 6 },
      }),
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/(?:phone|email|proof|password|credential|token|storage.?key)/iu);
  });
});
