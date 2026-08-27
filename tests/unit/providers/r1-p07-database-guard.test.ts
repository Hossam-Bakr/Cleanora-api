
import { hasExplicitR1P07TestDatabase } from "../../helpers/r1-p07-workforce-fixtures.js";

describe("R1-P07 database target guard", () => {
  it("accepts only explicitly phase-named disposable targets", () => {
    const url = (name: string) => `postgresql://synthetic.invalid/${name}`;
    expect(hasExplicitR1P07TestDatabase({ TEST_DATABASE_URL: url("cleanora_r1_p07_proof") })).toBe(true);
    expect(hasExplicitR1P07TestDatabase({ TEST_DATABASE_URL: url("cleanora_r1_p07_isolated_test") })).toBe(true);
    expect(hasExplicitR1P07TestDatabase({ TEST_DATABASE_URL: url("cleanora_r1_p04_clean_proof") })).toBe(false);
    expect(hasExplicitR1P07TestDatabase({ TEST_DATABASE_URL: url("cleanora_production") })).toBe(false);
    expect(hasExplicitR1P07TestDatabase({})).toBe(false);
  });
});
