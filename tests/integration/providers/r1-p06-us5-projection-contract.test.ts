import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("R1-P06 projection runtime/planning parity", () => {
  it("wires verification facts into overview and existing Provider projections", () => {
    const composition = readFileSync(resolve("src/composition.ts"), "utf8");
    const projection = readFileSync(resolve("src/modules/providers/provider-projection.service.ts"), "utf8");
    expect(composition).toContain("verificationFacts");
    expect(composition).toContain("isPayoutDestinationReady");
    expect(projection).toContain("documentsVerified");
    expect(projection).toContain("payoutDestinationReady");
  });
});
