
import {
  addressUpdateBody,
  addressWriteBody,
  versionBody,
} from "../../../../src/modules/customers/customers.schema.js";

const validAddress = {
  countryCode: " eg ",
  city: " Cairo ",
  district: " Maadi ",
  addressText: " 12 Road ",
  building: " ",
  floor: null,
  notes: " Gate A ",
};

describe("US2 address validation", () => {
  it("normalizes text and converts blank optional values to absent", () => {
    expect(addressWriteBody.parse(validAddress)).toEqual({
      countryCode: "EG",
      city: "Cairo",
      district: "Maadi",
      addressText: "12 Road",
      building: null,
      floor: null,
      notes: "Gate A",
    });
  });

  it("rejects blank required values, geo attributes, and unknown properties", () => {
    expect(() => addressWriteBody.parse({ ...validAddress, city: " " })).toThrow();
    expect(() => addressWriteBody.parse({ ...validAddress, latitude: 30.0 })).toThrow();
    expect(() => addressWriteBody.parse({ ...validAddress, mapPin: "x" })).toThrow();
  });

  it("requires positive CAS versions for update and removal", () => {
    expect(addressUpdateBody.parse({ ...validAddress, version: 1 }).version).toBe(1);
    expect(() => versionBody.parse({ version: 0 })).toThrow();
  });
});
