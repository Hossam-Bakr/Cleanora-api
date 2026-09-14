import { buildImplementedR1P17SwaggerFragments } from "../../../src/swagger/r1-p17-openapi.paths.js";

describe("R1-P17 OpenAPI fragments", () => {
  it("exposes assign, replace, current, history, and worker visibility", () => {
    const fragments = buildImplementedR1P17SwaggerFragments();
    expect(Object.keys(fragments.paths).sort()).toEqual([
      "/api/v1/providers/{providerId}/bookings/{bookingId}/assignments/current",
      "/api/v1/providers/{providerId}/bookings/{bookingId}/assignments/history",
      "/api/v1/providers/{providerId}/bookings/{bookingId}/assignments/team",
      "/api/v1/providers/{providerId}/bookings/{bookingId}/assignments/team/replace",
      "/api/v1/providers/{providerId}/bookings/{bookingId}/assignments/workers",
      "/api/v1/providers/{providerId}/bookings/{bookingId}/assignments/workers/replace",
      "/api/v1/workers/me/assignments",
    ]);
    expect(JSON.stringify(fragments.paths)).not.toMatch(/feeAmount|wallet/u);
  });
});
