import { getConfigKeyDefinition } from "../../../src/modules/configuration/config-key.catalog.js";
import { putCountryTimeZoneBodySchema } from "../../../src/modules/configuration/locality.schema.js";
import { isRecognizedIanaTimeZone } from "../../../src/modules/configuration/time-zone.js";

describe("Configuration IANA time-zone validation (DEC-053)", () => {
  it("accepts a recognized zone and rejects a shape-valid unknown zone", () => {
    expect(isRecognizedIanaTimeZone("Africa/Cairo")).toBe(true);
    expect(isRecognizedIanaTimeZone("Mars/Olympus")).toBe(false);
    expect(isRecognizedIanaTimeZone("")).toBe(false);
  });

  it("enforces recognition at both HTTP and configuration-key boundaries", () => {
    const validBody = {
      timeZone: "Africa/Cairo",
      expectedVersion: 0,
      idempotencyKey: "56565656-5656-4656-8656-565656565656",
      reasonCode: "configuration_locality_change",
    };
    expect(putCountryTimeZoneBodySchema.safeParse(validBody).success).toBe(true);
    expect(
      putCountryTimeZoneBodySchema.safeParse({
        ...validBody,
        timeZone: "Mars/Olympus",
      }).success,
    ).toBe(false);

    const definition = getConfigKeyDefinition("platform.default_timezone");
    expect(definition).toBeDefined();
    expect(definition?.valueSchema.safeParse("Africa/Cairo").success).toBe(true);
    expect(definition?.valueSchema.safeParse("Mars/Olympus").success).toBe(false);
  });
});
