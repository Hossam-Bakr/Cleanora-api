import { assertNever } from "../../../src/shared/utilities/assert-never.js";

describe("shared utilities", () => {
  it("throws when an impossible branch reaches assertNever", () => {
    expect(() =>
      assertNever("unexpected" as never, "Unexpected state"),
    ).toThrow("Unexpected state: unexpected");
  });
});
