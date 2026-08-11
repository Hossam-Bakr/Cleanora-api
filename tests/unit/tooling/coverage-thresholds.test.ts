
import vitestConfig from "../../../vitest.config.js";
import packageJson from "../../../package.json";

describe("coverage thresholds", () => {
  it("keeps the approved R1-P01 minimums", () => {
    expect(vitestConfig.test?.coverage?.thresholds).toEqual({
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    });
  });

  it("keeps timing-sensitive SC-008 outside instrumentation and directly runnable", () => {
    expect(packageJson.scripts["test:coverage"]).toContain(
      "--exclude tests/integration/customers/sc008-workload.test.ts",
    );
    expect(packageJson.scripts["test:performance:sc008"]).toContain(
      "run tests/integration/customers/sc008-workload.test.ts",
    );
  });
});
