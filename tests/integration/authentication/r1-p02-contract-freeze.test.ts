import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createAuthenticationRouter } from "../../../src/modules/authentication/auth.routes.js";

/**
 * SC-010: R1-P02 `/auth/*` HTTP contract freeze — R1-P04 must not rename,
 * remove, or alter existing authentication route registrations.
 */
describe("R1-P02 authentication contract freeze (SC-010)", () => {
  it("keeps the published R1-P02 OpenAPI auth path inventory stable", () => {
    const yaml = readFileSync(
      join(process.cwd(), "docs/apis/openapi/r1-p02-authentication.yaml"),
      "utf8",
    );

    for (const path of [
      "/auth/signup",
      "/auth/login",
      "/auth/logout",
      "/auth/refresh",
      "/auth/otp/request",
      "/auth/otp/verify",
      "/auth/password/forgot",
      "/auth/password/reset",
      "/auth/password/change",
      "/auth/me",
    ]) {
      expect(yaml).toContain(path);
    }
  });

  it("does not expose R1-P04 customer paths under /auth", () => {
    const yaml = readFileSync(
      join(process.cwd(), "docs/apis/openapi/r1-p02-authentication.yaml"),
      "utf8",
    );
    expect(yaml).not.toContain("/customers/");
    expect(yaml).not.toMatch(/geospatial|latitude|longitude|resource\.self\./iu);
  });

  it("keeps authentication router factory export available for composition", () => {
    expect(typeof createAuthenticationRouter).toBe("function");
  });
});
