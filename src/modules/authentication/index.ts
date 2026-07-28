import type { RequestHandler } from 'express';
import type { ModuleRegistrar } from '#core/http/module-registrar';
import type { RateLimiterPort } from '#core/security/rate-limit.port';
import type { AuthenticationServiceDependencies } from './application/authentication.service.js';
import { AuthenticationService } from './application/authentication.service.js';
import { createAuthenticateAccess } from './http/authentication.middleware.js';
import { requireTrustedOrigin } from './http/authentication-origin.js';
import { createAuthenticationRouter } from './http/authentication.routes.js';
import type { RefreshCookieConfiguration } from './http/authentication.cookies.js';
import type {
  AuthenticationPolicyPort,
  GoogleIdentityPort,
  GoogleTransactionStorePort,
} from "./domain/authentication.ports.js";
import { GoogleAuthenticationService } from './application/google-authentication.js';
import { ConfigurationAuthenticationPolicyAdapter } from './infrastructure/configuration-authentication-policy.adapter.js';
import { authenticationError } from './domain/authentication.errors.js';

export type { AccountCategory, AuthenticationPrincipal, UserStatus, IdentityState, SafeAuthenticatedUser, AuthenticationMethod, SessionCapability, AuthDeliveryChannel } from './domain/authentication.types.js';
export type {
  AuthenticationDelivery,
  EmailAuthenticationDeliveryPort,
  SmsAuthenticationDeliveryPort,
} from "./domain/authentication.ports.js";
export {
  formatDeliveryExpiry,
  maskEmailDestination,
  maskPhoneDestination,
} from './domain/destination-presentation.js';
export type {
  AccessTokenClaims,
  RefreshTokenClaims,
  IssuedToken,
  TokenServicePort,
  OneTimeVerifierPort,
  PasswordHasherPort,
  GoogleIdentity,
  GoogleIdentityPort,
  GoogleTransaction,
  GoogleTransactionStorePort,
} from "./domain/authentication.ports.js";
export type { AuthenticationPolicyPort };

/** Create the approved configuration-backed policy dependency at composition time. */
export function createAuthenticationPolicy(): AuthenticationPolicyPort {
  return new ConfigurationAuthenticationPolicyAdapter();
}

/** Return the one safe provider-unavailable error exposed to fail-closed adapters. */
export function authenticationProviderUnavailableError(): Error {
  return authenticationError('AUTH_PROVIDER_UNAVAILABLE');
}

/** Return the stable invalid-token error required by token-service adapters. */
export function authenticationTokenInvalidError(type: 'access' | 'refresh'): Error {
  return authenticationError(type === 'access' ? 'AUTH_ACCESS_TOKEN_INVALID' : 'AUTH_REFRESH_TOKEN_INVALID');
}

export interface AuthenticationModuleDependencies extends AuthenticationServiceDependencies {
  readonly basePath: string;
  readonly trustedOrigins: readonly string[];
  readonly cookie: RefreshCookieConfiguration;
  readonly rateLimiter: RateLimiterPort;
  readonly googleIdentity?: GoogleIdentityPort;
  readonly googleTransactions?: GoogleTransactionStorePort;
  readonly googleProviderCallbackUri?: string;
  readonly googleFrontendCallbackUri?: string;
  readonly privacyHashSecret: string;
}

export interface AuthenticationModule {
  readonly moduleRegistrar: ModuleRegistrar;
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
    moduleRegistrar: {
      name: 'authentication',
      register(app) {
        app.use(
          dependencies.basePath,
          createAuthenticationRouter({
            service,
            authenticateAccess,
            trustedOrigin,
            cookies: dependencies.cookie,
            limiter: dependencies.rateLimiter,
            privacyHashSecret: dependencies.privacyHashSecret,
            google,
            googleProviderCallbackUri: dependencies.googleProviderCallbackUri,
            googleFrontendCallbackUri: dependencies.googleFrontendCallbackUri,
          }),
        );
      }
    }
  };
}
