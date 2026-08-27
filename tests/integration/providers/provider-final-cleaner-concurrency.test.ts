
import { createFinalCleanerHarness, finalCleanerCommand } from "../../helpers/r1-p07-final-cleaner-harness.js";

describe("final-cleaner stale and competing commands", () => {
  it("changes nothing for cancellation and stale confirmation versions", async () => {
    for (const command of [
      { ...finalCleanerCommand, confirmLastCleanerImpact: false },
      { ...finalCleanerCommand, expectedMembershipVersion: 1 },
      { ...finalCleanerCommand, expectedVersion: 3 },
    ]) {
      const harness = createFinalCleanerHarness();
      await expect(harness.service.change(command)).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });
      expect(harness.state()).toMatchObject({
        team: { status: "ACTIVE", version: 4 },
        membership: { cleans: true, version: 2 },
        histories: [],
        audits: [],
        accepted: [],
      });
    }
  });

  it("serializes a competing lock wave so exactly one command wins and the stale peer changes nothing", async () => {
    const harness = createFinalCleanerHarness({ serializeTransactions: true });
    const settled = await Promise.allSettled([
      harness.service.change(finalCleanerCommand),
      harness.service.change({
        ...finalCleanerCommand,
        idempotencyKey: "00000000-0000-4000-8000-000000000763",
        requestId: "00000000-0000-4000-8000-000000000764",
      }),
    ]);
    expect(settled.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(settled.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(settled.find((result) => result.status === "rejected")).toMatchObject({
      reason: { code: "WORKFORCE_STATE_CONFLICT" },
    });
    expect(harness.state()).toMatchObject({
      team: { status: "INACTIVE", version: 6 },
      membership: { cleans: false, version: 3 },
    });
    expect(harness.state().histories).toHaveLength(2);
    expect(harness.state().audits).toHaveLength(1);
    expect(harness.state().accepted).toHaveLength(1);
  });
});
