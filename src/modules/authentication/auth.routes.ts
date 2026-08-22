import { createHmac } from "node:crypto";
import { Router, type Request, type RequestHandler } from "express";
import { validateRequest } from "#middlewares/validate-request";
import type { AuthenticationService } from "./auth.service.js";
import type { RateLimiterPort } from "#middlewares/rate-limit.types";
import { createRateLimitMiddleware } from "#middlewares/rate-limit.middleware";
import { createAuthenticationController } from "./auth.controller.js";
import type { RefreshCookieConfiguration } from "./auth.cookies.js";
import {
  changeSchema,
  enrollSchema,
  forgotSchema,
  loginSchema,
  otpRequestSchema,
  otpVerifySchema,
  resetSchema,
  sensitiveActionProofSchema,
  signupSchema,
} from "./auth.schema.js";
import type { GoogleAuthenticationService } from "./google-auth.service.js";
import { AUTH_RATE_LIMITS } from "./domain/auth.policy.js";
import { requireFullAuthentication } from "./auth.middleware.js";
import type { RoleManagementService } from "./role-management.service.js";
import { createRoleGrantCommandController } from "./role-grant-command.controller.js";

export interface AuthenticationRouterDependencies {
  readonly service: AuthenticationService;
  readonly authenticateAccess: RequestHandler;
  readonly trustedOrigin: RequestHandler;
  readonly cookies: RefreshCookieConfiguration;
  readonly limiter: RateLimiterPort;
  readonly privacyHashSecret: string;
  readonly google: GoogleAuthenticationService | undefined;
  readonly googleProviderCallbackUri: string | undefined;
  readonly googleFrontendCallbackUri: string | undefined;
  readonly roleManagement?: RoleManagementService;
}

function rateLimitSubject(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "missing";
}

export function createAuthenticationRouter(
  dependencies: AuthenticationRouterDependencies,
): Router {
  const {
    service,
    authenticateAccess,
    trustedOrigin,
    cookies,
    limiter,
    privacyHashSecret,
    google,
    googleProviderCallbackUri,
    googleFrontendCallbackUri,
    roleManagement,
  } = dependencies;
  const router = Router();
  const controller = createAuthenticationController(
    service,
    cookies,
    google,
    googleProviderCallbackUri === undefined ||
    googleFrontendCallbackUri === undefined
      ? undefined
      : {
          providerCallbackUri: googleProviderCallbackUri,
          frontendCallbackUri: googleFrontendCallbackUri,
        },
  );
  const roleGrantController =
    roleManagement === undefined
      ? undefined
      : createRoleGrantCommandController(roleManagement);
  const hashSubject = (value: unknown) =>
    createHmac("sha256", privacyHashSecret)
      .update(rateLimitSubject(value))
      .digest("hex");
  const limit = (
    scope: string,
    values: readonly [number, number],
    subject: (request: Request) => unknown = (request) => request.ip,
  ) =>
    createRateLimitMiddleware({
      limiter,
      scope: `auth-${scope}`,
      limit: values[0],
      windowSeconds: values[1],
      subject: (_ip, request) =>
        hashSubject(request === undefined ? "unknown" : subject(request)),
    });
  const policy = (
    scope: string,
    values: {
      readonly ip: readonly [number, number];
      readonly subject?: readonly [number, number];
    },
    subject?: (request: Request) => unknown,
  ): RequestHandler[] => [
    limit(`${scope}-ip`, values.ip),
    ...(values.subject === undefined || subject === undefined
      ? []
      : [limit(`${scope}-subject`, values.subject, subject)]),
  ];
  const responsePrincipalId = (request: Request): string => {
    const value = (
      request.res?.locals as { authenticationPrincipal?: { userId?: string } } | undefined
    )?.authenticationPrincipal?.userId;
    return typeof value === "string" ? value : "missing";
  };
  const configuredIp = (
    scope: string,
    key: 'signupPer15Minutes' | 'loginPer15Minutes',
  ): RequestHandler => async (request, response, next) => {
    try {
      const values = await service.endpointLimits();
      await limit(`${scope}-ip`, [values[key], 900])(request, response, next);
    } catch (error) {
      next(error);
    }
  };
  router.post(
    "/signup",
    validateRequest({ body: signupSchema.shape.body }),
    configuredIp('signup', 'signupPer15Minutes'),
    limit('signup-subject', AUTH_RATE_LIMITS.signup.subject, (request) => request.body.phone ?? request.body.email),
    controller.signup,
  );
  router.post(
    "/account-categories",
    authenticateAccess,
    requireFullAuthentication,
    validateRequest({ body: enrollSchema.shape.body }),
    controller.enroll,
  );
  router.post(
    "/otp/request",
    validateRequest({ body: otpRequestSchema.shape.body }),
    ...policy(
      "otp-send",
      AUTH_RATE_LIMITS.otpSend,
      (request) => request.body.challengeId ?? request.body.userId,
    ),
    controller.requestOtp,
  );
  router.post(
    "/otp/verify",
    validateRequest({ body: otpVerifySchema.shape.body }),
    ...policy("otp-verify", AUTH_RATE_LIMITS.otpVerify),
    controller.verifyOtp,
  );
  router.post(
    "/login",
    validateRequest({ body: loginSchema.shape.body }),
    configuredIp('login', 'loginPer15Minutes'),
    limit('login-subject', AUTH_RATE_LIMITS.login.subject, (request) => request.body.phone),
    controller.login,
  );
  router.post(
    "/refresh",
    trustedOrigin,
    ...policy(
      "refresh",
      AUTH_RATE_LIMITS.refresh,
      (request) => request.cookies?.[cookies.name],
    ),
    controller.refresh,
  );
  router.post(
    "/logout",
    trustedOrigin,
    (request, response, next) => {
      if (request.get("authorization") === undefined) {
        next();
        return;
      }
      authenticateAccess(request, response, next);
    },
    controller.logout,
  );
  router.post("/logout-all", authenticateAccess, controller.logoutAll);
  router.get("/me", authenticateAccess, controller.me);
  router.post(
    "/password/forgot",
    validateRequest({ body: forgotSchema.shape.body }),
    ...policy(
      "forgot",
      AUTH_RATE_LIMITS.forgot,
      (request) => request.body.identifier,
    ),
    controller.forgot,
  );
  router.post(
    "/password/reset",
    validateRequest({ body: resetSchema.shape.body }),
    ...policy("reset", AUTH_RATE_LIMITS.reset),
    controller.reset,
  );
  router.post(
    "/password/change",
    authenticateAccess,
    requireFullAuthentication,
    trustedOrigin,
    validateRequest({ body: changeSchema.shape.body }),
    controller.change,
  );
  router.post(
    "/sensitive-action-proofs",
    authenticateAccess,
    requireFullAuthentication,
    trustedOrigin,
    validateRequest({ body: sensitiveActionProofSchema.shape.body }),
    controller.issueSensitiveActionProof,
  );
  router.get(
    "/google",
    ...policy("google-start", AUTH_RATE_LIMITS.google),
    controller.googleStart,
  );
  router.get(
    "/google/browser",
    ...policy("google-start", AUTH_RATE_LIMITS.google),
    controller.googleBrowserStart,
  );
  router.get(
    "/google/callback",
    ...policy("google-callback", AUTH_RATE_LIMITS.google),
    controller.googleCallback,
  );
  router.get(
    "/google/link",
    authenticateAccess,
    requireFullAuthentication,
    controller.googleLink,
  );
  router.delete(
    "/social/google",
    authenticateAccess,
    requireFullAuthentication,
    controller.googleUnlink,
  );
  if (roleGrantController !== undefined) {
    router.post(
      "/role-grants/commands",
      authenticateAccess,
      requireFullAuthentication,
      ...policy(
        "role-grant-command",
        { ip: [20, 60], subject: [10, 60] },
        (request) => responsePrincipalId(request),
      ),
      roleGrantController.submit,
    );
  }
  return router;
}
