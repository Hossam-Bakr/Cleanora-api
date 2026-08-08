
import {
  companyProfileBody,
  engineerProfileBody,
  individualProfileBody,
} from "../../../../src/modules/customers/customers.schema.js";

describe("US1 profile field validation", () => {
  it("trims approved individual fields and rejects blanks", () => {
    expect(individualProfileBody.parse({ fullName: "  Ada  " }).fullName).toBe("Ada");
    expect(() => individualProfileBody.parse({ fullName: "   " })).toThrow();
  });

  it("requires exactly the approved category fields", () => {
    expect(
      companyProfileBody.parse({
        companyName: " Cleanora ",
        representativeFullName: " Ada ",
      }),
    ).toEqual({ companyName: "Cleanora", representativeFullName: "Ada" });
    expect(() => engineerProfileBody.parse({ fullName: "Ada", biography: "no" })).toThrow();
  });
});
