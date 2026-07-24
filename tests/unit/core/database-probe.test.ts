
import { createDatabaseProbe } from "../../../src/core/health/database-probe.js";

describe("createDatabaseProbe", () => {
  it("delegates a successful connectivity check", async () => {
    const checkConnection = vi.fn(async () => Promise.resolve());
    const probe = createDatabaseProbe(checkConnection);

    await expect(probe.check()).resolves.toBeUndefined();

    expect(checkConnection).toHaveBeenCalledTimes(1);
  });

  it("preserves a failed probe for the HTTP boundary to map safely", async () => {
    const failure = new Error("postgresql://private-host");
    const probe = createDatabaseProbe(async () => Promise.reject(failure));

    await expect(probe.check()).rejects.toBe(failure);
  });
});
