
import { createFinalCleanerHarness, finalCleanerCommand } from "../../helpers/r1-p07-final-cleaner-harness.js";

describe("Owner/Admin final-cleaner atomic confirmation", () => {
  it("commits membership correction and Team inactivation as one accepted outcome", async () => {
    const harness = createFinalCleanerHarness();
    await expect(harness.service.change(finalCleanerCommand)).resolves.toMatchObject({
      outcomeCode: "TEAM_MEMBERSHIP_CLEANS_UPDATED",
      impacts: [expect.objectContaining({ outcomeCode: "TEAM_INACTIVATED", version: 6 })],
    });
    const state = harness.state();
    expect(state.membership).toMatchObject({ cleans: false, version: 3 });
    expect(state.team).toMatchObject({ status: "INACTIVE", version: 6 });
    expect(state.histories.map((row) => row["targetType"])).toEqual(["TEAM_MEMBERSHIP", "TEAM"]);
    expect(state.audits).toHaveLength(1);
    expect(state.accepted).toHaveLength(1);
  });

  it("rolls back every changed truth when later immutable-history persistence fails", async () => {
    const harness = createFinalCleanerHarness({ failHistoryAt: 2 });
    await expect(harness.service.change(finalCleanerCommand)).rejects.toThrow("synthetic history failure");
    expect(harness.state()).toMatchObject({
      team: { status: "ACTIVE", version: 4 },
      membership: { cleans: true, version: 2 },
      histories: [],
      audits: [],
      accepted: [],
    });
  });
});
