import { createCustomersRouter } from "../../../../src/modules/customers/customers.routes.js";
import { createTestApp } from "../../../helpers/create-test-app.js";
import { createTestEnvironment } from "../../../helpers/test-environment.js";
import { TestLogger } from "../../../helpers/test-logger.js";

const request = require("supertest") as typeof import("supertest");

describe("customer overview HTTP surface", () => {
  it("returns one complete profile-screen payload from the authenticated principal", async () => {
    const overviewGet = vi.fn(async () => ({
      identity: {
        userId: "user-1",
        status: "ACTIVE",
        accountCategories: ["INDIVIDUAL"],
        verifiedCategories: ["INDIVIDUAL"],
        pendingCategories: [],
      },
      profiles: [
        { category: "INDIVIDUAL", created: true, fullName: "Aly Oser" },
      ],
      profileImage: {
        mediaId: "media-1",
        url: "https://example.test/signed-profile.webp",
        urlExpiresAt: "2026-08-09T12:15:00.000Z",
        associationVersion: 2,
        contentType: "image/webp",
        width: 1200,
        height: 900,
      },
      contactState: {
        phone: { value: "+201001234567", verified: false },
        email: { value: "user@example.test", verified: true },
      },
      preferences: {
        version: 1,
        language: null,
        reminders: { sms: false, push: false },
        promotional: { sms: false, push: false },
        mandatory: {
          security: { sms: true, push: true },
          activeService: { sms: true, push: true },
        },
      },
      addresses: [],
    }));
    const router = createCustomersRouter({
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
      overview: { get: overviewGet } as never,
      profiles: {} as never,
      profileImages: {} as never,
      addresses: {} as never,
      preferences: {} as never,
      privacyRequests: {} as never,
    });
    const app = createTestApp({
      environment: createTestEnvironment(),
      logger: new TestLogger(),
      mountTestRoutes(expressApp) {
        expressApp.use("/api/v1/customers", router);
      },
    });

    const response = await request(app).get("/api/v1/customers/me/overview");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.identity.userId).toBe("user-1");
    expect(response.body.data.profiles[0].fullName).toBe("Aly Oser");
    expect(response.body.data.profileImage.url).toContain("signed-profile.webp");
    expect(response.body.data.contactState.email.verified).toBe(true);
    expect(response.body.data.preferences.version).toBe(1);
    expect(response.body.data.addresses).toEqual([]);
    expect(overviewGet).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" }),
      expect.any(String),
    );
  });
});
