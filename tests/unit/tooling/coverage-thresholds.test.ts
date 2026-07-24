
import vitestConfig from "../../../vitest.config.js";

describe("coverage thresholds", () => {
  it("keeps the approved R1-P01 minimums", () => {
    expect(vitestConfig.test?.coverage?.thresholds).toEqual({
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    });
  });
});
