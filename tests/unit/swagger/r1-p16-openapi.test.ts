import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildImplementedR1P16SwaggerFragments } from "../../../src/swagger/r1-p16-openapi.paths.js";

const yaml = require("js-yaml") as { load(input: string): unknown };

describe("R1-P16 OpenAPI fragments", () => {
  it("exposes provider, reason, and staff booking-response operations", () => {
    const fragments = buildImplementedR1P16SwaggerFragments();
    expect(Object.keys(fragments.paths).sort()).toEqual([
      "/api/v1/bookings/cancellation-reasons",
      "/api/v1/providers/{providerId}/bookings/inbox",
      "/api/v1/providers/{providerId}/bookings/{bookingId}",
      "/api/v1/providers/{providerId}/bookings/{bookingId}/accept",
      "/api/v1/providers/{providerId}/bookings/{bookingId}/cancel",
      "/api/v1/providers/{providerId}/bookings/{bookingId}/reject",
      "/api/v1/staff/bookings/{bookingId}",
      "/api/v1/staff/bookings/{bookingId}/cancel",
    ]);
    const acceptPath = fragments.paths[
      "/api/v1/providers/{providerId}/bookings/{bookingId}/accept"
    ] as { post?: unknown } | undefined;
    expect(acceptPath?.post).toBeDefined();
    expect(JSON.stringify(fragments.paths)).not.toMatch(/feeAmount|wallet/u);
  });

  it("extends the customer booking document with ACCEPTED, response, and cancellation", () => {
    const document = yaml.load(
      readFileSync(resolve(process.cwd(), "docs/apis/openapi/r1-p13-booking-draft.yaml"), "utf8"),
    ) as {
      components?: {
        schemas?: {
          BookingStatus?: { enum?: string[] };
          BookingData?: { properties?: Record<string, unknown> };
        };
      };
    };
    expect(document.components?.schemas?.BookingStatus?.enum).toEqual([
      "DRAFT",
      "AWAITING_DEPOSIT",
      "CONFIRMED",
      "ACCEPTED",
      "CANCELLED",
    ]);
    expect(document.components?.schemas?.BookingData?.properties).toHaveProperty("response");
    expect(document.components?.schemas?.BookingData?.properties).toHaveProperty("cancellation");
  });
});
