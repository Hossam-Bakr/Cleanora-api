import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { hasApprovedTestDatabaseUrl } from "../../helpers/resolve-test-database-url.js";
import {
  signupAndLogin,
  startProviderApplicationTestApp,
} from "../../helpers/authentication/provider-application-test-app.js";
import { createProvidersRouter } from "../../../src/modules/providers/providers.routes.js";

const request = require("supertest") as typeof import("supertest");

const hasDatabase = hasApprovedTestDatabaseUrl();

vi.setConfig({ testTimeout: 120_000 });

const ANONYMOUS_BROWSE_MARKERS = [
  "/browse",
  "/public",
  "/marketplace",
  "/directory",
  "/details",
] as const;

describe("US12 negative anonymous Browse surface (T132/T136)", () => {
  it("keeps Provider routers authenticated and omits anonymous Browse/Details", async () => {
    const routesSource = await readFile(
      join(process.cwd(), "src/modules/providers/providers.routes.ts"),
      "utf8",
    );
    expect(routesSource).toMatch(/router\.use\(dependencies\.authenticateAccess\)/);
    for (const marker of ANONYMOUS_BROWSE_MARKERS) {
      expect(routesSource).not.toContain(`"${marker}"`);
      expect(routesSource).not.toContain(`'${marker}'`);
    }

    const indexSource = await readFile(
      join(process.cwd(), "src/routes/index.ts"),
      "utf8",
    );
    expect(indexSource).toMatch(/providersRouter/);
    expect(indexSource).toMatch(/staffProvidersRouter/);
    expect(indexSource).toMatch(/providerAdminInvitationRouter/);
    expect(indexSource).not.toMatch(/browseRouter|publicProviders|marketplace/i);

    const openApi = await readFile(
      join(
        process.cwd(),
        "docs/apis/openapi/r1-p05-provider-onboarding-profile-lifecycle.yaml",
      ),
      "utf8",
    );
    expect(openApi).toMatch(/exposes no anonymous Provider browse route/i);
    expect(openApi).not.toMatch(/\/providers\/browse|\/public\/providers/i);

    // Router factory still requires authenticateAccess before any route.
    expect(() =>
      createProvidersRouter({
        authenticateAccess: ((_req: unknown, _res: unknown, next: () => void) =>
          next()) as never,
        applications: {} as never,
        profiles: {} as never,
        media: {} as never,
        projections: {} as never,
      }),
    ).not.toThrow();
  });

  it.skipIf(!hasDatabase)(
    "returns 401 for anonymous Provider list/get/preview",
    async () => {
      const context = await startProviderApplicationTestApp();
      try {
        const session = await signupAndLogin(context.app, {
          accountCategory: "INDIVIDUAL",
          emailInbox: context.email,
          label: "us12-anon",
        });
        const created = await request(context.app)
          .post("/api/v1/providers")
          .set("Authorization", `Bearer ${session.accessToken}`)
          .send({ providerKind: "INDIVIDUAL_TEAM" })
          .expect(201);
        const providerId = created.body.data.provider.id as string;

        for (const path of [
          "/api/v1/providers",
          `/api/v1/providers/${providerId}`,
          `/api/v1/providers/${providerId}/preview`,
          `/api/v1/providers/${providerId}/contacts`,
          "/api/v1/providers/browse",
          `/api/v1/providers/${providerId}/details`,
        ]) {
          const response = await request(context.app).get(path);
          expect([401, 404]).toContain(response.status);
          if (response.status === 401) {
            expect(response.body.error.code).toMatch(
              /AUTHENTICATION_REQUIRED|UNAUTHORIZED/u,
            );
          }
        }
      } finally {
        await context.stop();
      }
    },
  );
});
