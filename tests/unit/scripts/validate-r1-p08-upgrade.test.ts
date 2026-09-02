
/**
 * Guarded R1-P08 upgrade validator expectations.
 * Live migrate/seed against unapproved databases is forbidden until an owner
 * approves a target matching
 * ^cleanora_r1_p08(?:_[a-z0-9]+)*_(?:test|proof|clean|ci)$.
 */

const APPROVED_TARGET_PATTERN =
  /^cleanora_r1_p08(?:_[a-z0-9]+)*_(?:test|proof|clean|ci)$/;

describe("validate-r1-p08-upgrade scaffold", () => {
  it("accepts only approved disposable target names", () => {
    expect(APPROVED_TARGET_PATTERN.test("cleanora_r1_p08_proof")).toBe(true);
    expect(APPROVED_TARGET_PATTERN.test("cleanora_r1_p08_local_test")).toBe(true);
    expect(APPROVED_TARGET_PATTERN.test("Cleanora")).toBe(false);
    expect(APPROVED_TARGET_PATTERN.test("cleanora_r1_p07_proof")).toBe(false);
  });
});
