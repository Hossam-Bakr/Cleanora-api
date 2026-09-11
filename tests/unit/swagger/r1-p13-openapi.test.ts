import {
  buildImplementedR1P13SwaggerFragments,
  r1P13FragmentsFromDocument,
} from "../../../src/swagger/r1-p13-openapi.paths.js";

describe("R1-P13 OpenAPI fragments", () => {
  it("exposes the seven booking command operations", () => {
    const fragments = buildImplementedR1P13SwaggerFragments();
    expect(Object.keys(fragments.paths).sort()).toEqual([
      "/bookings",
      "/bookings/{bookingId}",
      "/bookings/{bookingId}/cancel",
      "/bookings/{bookingId}/media",
      "/bookings/{bookingId}/submit-for-deposit",
    ]);
    expect(fragments.paths["/bookings"]?.["post"]).toBeDefined();
    expect(fragments.paths["/bookings"]?.["get"]).toBeDefined();
    expect(fragments.paths["/bookings/{bookingId}"]?.["patch"]).toBeDefined();
  });

  it("defaults missing YAML sections so Swagger merge cannot crash", () => {
    expect(r1P13FragmentsFromDocument({})).toEqual({
      tags: [],
      paths: {},
      parameters: {},
      responses: {},
      schemas: {},
    });
    expect(r1P13FragmentsFromDocument({ components: {} })).toEqual({
      tags: [],
      paths: {},
      parameters: {},
      responses: {},
      schemas: {},
    });
  });

  it("documents frozen snapshot and immutable price-breakdown responses", () => {
    const fragments = buildImplementedR1P13SwaggerFragments();

    expect(fragments.schemas).toMatchObject({
      BookingSnapshot: {
        required: ["catalog", "provider", "frozenAt"],
      },
      BookingPriceBreakdown: {
        required: [
          "gross",
          "deposit",
          "remainder",
          "currencyCode",
          "decimalPlaces",
          "depositPercent",
          "formulaVersion",
          "createdAt",
        ],
      },
      BookingData: {
        required: expect.arrayContaining(["snapshot", "priceBreakdown"]),
      },
    });
  });
});
