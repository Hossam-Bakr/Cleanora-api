import type { RequestHandler } from "express";

import { seed } from "../../../prisma/seed.js";
import { getPrismaClient } from "../../../src/database/prisma.js";
import type { PrismaLifecycle } from "../../../src/database/prisma-lifecycle.js";
import { createAuthenticationRouter } from "../../../src/modules/authentication/auth.routes.js";
import type { AuthenticationService } from "../../../src/modules/authentication/auth.service.js";
import { authenticationError } from "../../../src/modules/authentication/domain/authentication.errors.js";
import { createRoleManagementFixture } from "../../helpers/authorization/role-management-integration.js";
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

function createRoleGrantSecurityApp(input: {
  readonly fixture: Awaited<ReturnType<typeof createRoleManagementFixture>>;
  readonly authenticateAccess: RequestHandler;
  readonly limiter?: {
    consume: () => Promise<{
      allowed: boolean;
      remaining: number;
      retryAfterSeconds?: number;
    }>;
  };
}) {
  const limiter = input.limiter ?? {
    consume: async () => ({ allowed: true, remaining: 99 }),
  };
  const service = {
    endpointLimits: async () => ({
      signupPer15Minutes: 1_000,
      loginPer15Minutes: 1_000,
    }),
  } as unknown as AuthenticationService;
  const router = createAuthenticationRouter({
    service,
    authenticateAccess: input.authenticateAccess,
    trustedOrigin: (_request, _response, next) => next(),
    cookies: {
      name: "cleanora_refresh_token",
      path: "/api/v1/auth",
      secure: false,
      sameSite: "lax",
    },
    limiter,
    privacyHashSecret: "role-grant-security-privacy-secret",
    google: undefined,
    googleProviderCallbackUri: undefined,
    googleFrontendCallbackUri: undefined,
    roleManagement: input.fixture.service,
  });

  return createTestApp({
    environment: createTestEnvironment(),
    logger: new TestLogger(),
    rateLimiter: limiter,
    authenticationRouter: router,
  });
}

describe.skipIf(!hasDatabase)("role-grant command security", () => {
  let database: PrismaLifecycle;

  beforeAll(async () => {
    database = await startTestDatabaseLifecycle();
    await seed(getPrismaClient());
  }, 180_000);

  afterAll(async () => {
    await stopTestDatabaseLifecycle(database);
  });

  it(
    "returns 401 when no principal is present",
    async () => {
      const fixture = await createRoleManagementFixture();
      const app = createRoleGrantSecurityApp({
        fixture,
        authenticateAccess: (_request, _response, next) => {
          next(authenticationError("AUTHENTICATION_REQUIRED"));
        },
      });

      const response = await request(app)
        .post("/api/v1/auth/role-grants/commands")
        .send({
          operation: "assign",
          targetUserId: fixture.targetUserId,
          roleCode: "worker",
          reasonCode: "role_grant_assign",
        })
        .expect(401);

      expect(response.body.error).toMatchObject({
        code: "AUTHENTICATION_REQUIRED",
        statusCode: 401,
      });
    },
    120_000,
  );

  it(
    "returns the same coalesced 403 for unknown targets and self-management",
    async () => {
      const fixture = await createRoleManagementFixture();
      const authenticateAccess: RequestHandler = (_request, response, next) => {
        response.locals["authenticationPrincipal"] = fixture.actorPrincipal;
        next();
      };
      const app = createRoleGrantSecurityApp({ fixture, authenticateAccess });

      const unknownTarget = await request(app)
        .post("/api/v1/auth/role-grants/commands")
        .set("Authorization", "Bearer test-access-token")
        .send({
          operation: "assign",
          targetUserId: "missing-target-user",
          roleCode: "worker",
          reasonCode: "role_grant_assign",
        })
        .expect(403);

      const selfTarget = await request(app)
        .post("/api/v1/auth/role-grants/commands")
        .set("Authorization", "Bearer test-access-token")
        .send({
          operation: "assign",
          targetUserId: fixture.actorPrincipal.userId,
          roleCode: "worker",
          reasonCode: "role_grant_assign",
        })
        .expect(403);

      expect(unknownTarget.body.error).toMatchObject({
        code: "ROLE_GRANT_COMMAND_REJECTED",
        statusCode: 403,
        message: "The role-grant command was rejected.",
      });
      expect(selfTarget.body.error).toEqual(unknownTarget.body.error);
    },
    120_000,
  );

  it(
    "returns 429 RATE_LIMIT_EXCEEDED when the limiter denies the request",
    async () => {
      const fixture = await createRoleManagementFixture();
      const authenticateAccess: RequestHandler = (_request, response, next) => {
        response.locals["authenticationPrincipal"] = fixture.actorPrincipal;
        next();
      };
      const app = createRoleGrantSecurityApp({
        fixture,
        authenticateAccess,
        limiter: {
          consume: async () => ({
            allowed: false,
            remaining: 0,
            retryAfterSeconds: 30,
          }),
        },
      });

      const response = await request(app)
        .post("/api/v1/auth/role-grants/commands")
        .set("Authorization", "Bearer test-access-token")
        .send({
          operation: "assign",
          targetUserId: fixture.targetUserId,
          roleCode: "worker",
          reasonCode: "role_grant_assign",
        })
        .expect(429);

      expect(response.headers["retry-after"]).toBe("30");
      expect(response.body.error).toMatchObject({
        code: "RATE_LIMIT_EXCEEDED",
        statusCode: 429,
        message: "Too many requests. Wait before trying again.",
      });
    },
    120_000,
  );
});
