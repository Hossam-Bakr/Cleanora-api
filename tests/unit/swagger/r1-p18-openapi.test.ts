import { buildImplementedR1P18SwaggerFragments } from "../../../src/swagger/r1-p18-openapi.paths.js";

describe("R1-P18 OpenAPI fragments", () => {
  it("exposes order dossier, transitions, complete, resend, media, notes", () => {
    const fragments = buildImplementedR1P18SwaggerFragments();
    expect(Object.keys(fragments.paths).sort()).toEqual([
      "/api/v1/orders/by-booking/{bookingId}",
      "/api/v1/orders/{orderId}",
      "/api/v1/orders/{orderId}/complete",
      "/api/v1/orders/{orderId}/completion-code/resend",
      "/api/v1/orders/{orderId}/media",
      "/api/v1/orders/{orderId}/notes",
      "/api/v1/orders/{orderId}/timeline",
      "/api/v1/orders/{orderId}/transitions/in-progress",
      "/api/v1/orders/{orderId}/transitions/on-the-way",
      "/api/v1/orders/{orderId}/transitions/ready-to-complete",
    ]);
    expect(JSON.stringify(fragments.paths)).not.toMatch(/feeAmount|wallet|FAILED/u);
  });
});
