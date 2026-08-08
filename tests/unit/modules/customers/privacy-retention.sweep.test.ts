
import {
  PRIVACY_RETENTION_SWEEP_BATCH_SIZE,
  PrivacyRetentionSweep,
} from "../../../../src/modules/customers/privacy-retention.sweep.js";

describe("privacy retention sweep", () => {
  it("uses one bounded customers-owned purge and never touches audit records", async () => {
    const purgeExpiredTerminal = vi.fn().mockResolvedValue(2);
    const sweep = new PrivacyRetentionSweep(
      {
        run: async (work: (context: unknown) => Promise<unknown>) =>
          work({ prisma: {}, generalAudit: {}, privilegedAudit: {} }),
      } as never,
      { purgeExpiredTerminal } as never,
      () => new Date("2026-08-07T00:00:00.000Z"),
    );
    await expect(sweep.run()).resolves.toBe(2);
    expect(purgeExpiredTerminal).toHaveBeenCalledWith(
      {}, new Date("2026-08-07T00:00:00.000Z"), PRIVACY_RETENTION_SWEEP_BATCH_SIZE,
    );
  });
});
