import { createTestApp } from "../../../helpers/create-test-app.js";
import { createTestEnvironment } from "../../../helpers/test-environment.js";
import { TestLogger } from "../../../helpers/test-logger.js";
import { createCustomersRouter } from "../../../../src/modules/customers/customers.routes.js";

const request = require("supertest") as typeof import("supertest");

describe("customers profile-image HTTP surface", () => {
  it("serves signed GET JSON and CAS DELETE through route-scoped handlers", async () => {
    const profileImages = {
      get: async () => ({
        mediaId: "media-1",
        url: "https://res.cloudinary.test/signed",
        urlExpiresAt: new Date().toISOString(),
        associationVersion: 2,
        contentType: "image/webp",
        width: 32,
        height: 32,
      }),
      put: async () => ({
        profiles: [],
        profileImage: {
          mediaId: "media-2",
          url: "https://res.cloudinary.test/new",
          urlExpiresAt: new Date().toISOString(),
          associationVersion: 3,
          contentType: "image/webp",
        },
      }),
      remove: async () => ({ removed: true, associationVersion: 4 }),
    };

    const customersRouter = createCustomersRouter({
      authenticateAccess: (_request, response, next) => {
        response.locals["authenticationPrincipal"] = {
          userId: "user-1",
          sessionId: "session-1",
          accountCategories: ["INDIVIDUAL"],
          verifiedCategories: ["INDIVIDUAL"],
          pendingCategories: [],
          status: "ACTIVE",
          verificationOnly: false,
        };
        next();
      },
      profiles: {} as never,
      profileImages: profileImages as never,
      addresses: {} as never,
      preferences: {} as never,
      privacyRequests: {} as never,
    });

    const app = createTestApp({
      environment: createTestEnvironment(),
      logger: new TestLogger(),
      mountTestRoutes(expressApp) {
        expressApp.use("/api/v1/customers", customersRouter);
      },
    });

    const getResponse = await request(app).get("/api/v1/customers/profile-image");
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.data.profileImage.url).toContain("https://");

    const deleteResponse = await request(app)
      .delete("/api/v1/customers/profile-image")
      .send({ expectedAssociationVersion: 3 });
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.data.removed).toBe(true);
  });
});
