import type { RequestHandler } from "express";

import { seed } from "../../../prisma/seed.js";
import { getPrismaClient } from "../../../src/database/prisma.js";
import type { PrismaLifecycle } from "../../../src/database/prisma-lifecycle.js";
import { createAuthenticationRouter } from "../../../src/modules/authentication/auth.routes.js";
import type { AuthenticationService } from "../../../src/modules/authentication/auth.service.js";
import {
  createRoleManagementFixture,
  readGrantStatus,
} from "../../helpers/authorization/role-management-integration.js";
import { createTestApp } from "../../helpers/create-test-app.js";
import { hasApprovedTestDatabaseUrl } from "../../helpers/resolve-test-database-url.js";
import { createTestEnvironment } from "../../helpers/test-environment.js";
import {
  startTestDatabaseLifecycle,
  stopTestDatabaseLifecycle,
} from "../../helpers/test-database-lifecycle.js";
import { TestLogger } from "../../helpers/test-logger.js";

const request = require("supertest") as typeof import("supertest");

const hasDatabase = hasApprovedTestDatabaseUrl();

function createRoleGrantCommandApp(
  fixture: Awaited<ReturnType<typeof createRoleManagementFixture>>,
) {
  const limiter = { consume: async () => ({ allowed: true, remaining: 99 }) };
  const authenticateAccess: RequestHandler = (_request, response, next) => {
    response.locals["authenticationPrincipal"] = fixture.actorPrincipal;
    next();
  };
  const service = {
    endpointLimits: async () => ({
      signupPer15Minutes: 1_000,
      loginPer15Minutes: 1_000,
    }),
  } as unknown as AuthenticationService;
  const router = createAuthenticationRouter({
    service,
    authenticateAccess,
    trustedOrigin: (_request, _response, next) => next(),
    cookies: {
      name: "cleanora_refresh_token",
      path: "/api/v1/auth",
      secure: false,
      sameSite: "lax",
    },
    limiter,
    privacyHashSecret: "role-grant-api-privacy-secret",
    google: undefined,
    googleProviderCallbackUri: undefined,
    googleFrontendCallbackUri: undefined,
    roleManagement: fixture.service,
  });

  return createTestApp({
    environment: createTestEnvironment(),
    logger: new TestLogger(),
    rateLimiter: limiter,
    authenticationRouter: router,
  });
}

describe.skipIf(!hasDatabase)("role-grant command API", () => {
  let database: PrismaLifecycle;

  beforeAll(async () => {
    database = await startTestDatabaseLifecycle();
    await seed(getPrismaClient());
  }, 180_000);

  afterAll(async () => {
    await stopTestDatabaseLifecycle(database);
  });

  it(
    "assigns worker through the HTTP command surface",
    async () => {
      const fixture = await createRoleManagementFixture();
      const app = createRoleGrantCommandApp(fixture);

      const response = await request(app)
        .post("/api/v1/auth/role-grants/commands")
        .set("Authorization", "Bearer test-access-token")
        .send({
          operation: "assign",
          targetUserId: fixture.targetUserId,
          roleCode: "worker",
          reasonCode: "role_grant_assign",
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          targetUserId: fixture.targetUserId,
          roleCode: "worker",
          status: "ENABLED",
          mutated: true,
        },
      });
      expect(await readGrantStatus(fixture.targetUserId, "worker")).toBe(
        "ENABLED",
      );
    },
    120_000,
  );

  it(
    "rejects customer roleCode with 400 INVALID_REQUEST before service delegation",
    async () => {
      const fixture = await createRoleManagementFixture();
      const app = createRoleGrantCommandApp(fixture);

      const response = await request(app)
        .post("/api/v1/auth/role-grants/commands")
        .set("Authorization", "Bearer test-access-token")
        .send({
          operation: "assign",
          targetUserId: fixture.targetUserId,
          roleCode: "customer",
          reasonCode: "role_grant_assign",
        })
        .expect(400);

      expect(response.body.error).toMatchObject({
        code: "INVALID_REQUEST",
        statusCode: 400,
      });
      expect(await readGrantStatus(fixture.targetUserId, "customer")).toBe(
        undefined,
      );
    },
    120_000,
  );
});
