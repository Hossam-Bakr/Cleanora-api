import type { RequestHandler, Router } from "express";
import type { RateLimiterPort } from "#middlewares/rate-limit.types";
import type { AuthenticationServiceDependencies } from "./auth.service.js";
import { AuthenticationService } from "./auth.service.js";
import {
  createAuthenticateAccess,
  requireTrustedOrigin,
} from "./auth.middleware.js";
import { createAuthenticationRouter } from "./auth.routes.js";
import type { RefreshCookieConfiguration } from "./auth.cookies.js";
import type {
  AuthenticationPolicyPort,
  GoogleIdentityPort,
  GoogleTransactionStorePort,
} from "./domain/authentication.ports.js";
import { GoogleAuthenticationService } from "./google-auth.service.js";
import { ConfigurationAuthenticationPolicyAdapter } from './infrastructure/configuration-authentication-policy.adapter.js';
import type { RoleManagementService } from "./role-management.service.js";

/** Create the approved configuration-backed policy dependency at composition time. */
export function createAuthenticationPolicy(): AuthenticationPolicyPort {
  return new ConfigurationAuthenticationPolicyAdapter();
}

export interface AuthenticationModuleDependencies extends AuthenticationServiceDependencies {
  readonly trustedOrigins: readonly string[];
  readonly cookie: RefreshCookieConfiguration;
  readonly rateLimiter: RateLimiterPort;
  readonly googleIdentity?: GoogleIdentityPort;
  readonly googleTransactions?: GoogleTransactionStorePort;
  readonly googleProviderCallbackUri?: string;
  readonly googleFrontendCallbackUri?: string;
  readonly privacyHashSecret: string;
  readonly roleManagement?: RoleManagementService;
}

export interface AuthenticationModule {
  readonly router: Router;
  readonly authenticateAccess: RequestHandler;
}

export function createAuthenticationModule(dependencies: AuthenticationModuleDependencies): AuthenticationModule {
  const service = new AuthenticationService(dependencies);
  const authenticateAccess = createAuthenticateAccess(service);
  const trustedOrigin = requireTrustedOrigin(dependencies.trustedOrigins);
  const google = dependencies.googleIdentity === undefined || dependencies.googleTransactions === undefined
    ? undefined
    : new GoogleAuthenticationService(dependencies.googleIdentity, dependencies.googleTransactions, service);
  return {
    authenticateAccess,
    router: createAuthenticationRouter({
      service,
      authenticateAccess,
      trustedOrigin,
      cookies: dependencies.cookie,
      limiter: dependencies.rateLimiter,
      privacyHashSecret: dependencies.privacyHashSecret,
      google,
      googleProviderCallbackUri: dependencies.googleProviderCallbackUri,
      googleFrontendCallbackUri: dependencies.googleFrontendCallbackUri,
      ...(dependencies.roleManagement === undefined
        ? {}
        : { roleManagement: dependencies.roleManagement }),
    }),
  };
}
