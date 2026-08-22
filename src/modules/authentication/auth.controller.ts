import type { Request, RequestHandler, Response } from "express";
import { sendSuccess } from "#shared/http/api-response";
import type {
  AuthenticationService,
  SessionTokens,
} from "./auth.service.js";
import type { AuthenticationPrincipal } from "./domain/authentication.types.js";
import { authenticationError } from "./domain/authentication.errors.js";
import {
  clearGoogleOAuthStateCookie,
  clearRefreshCookie,
  GOOGLE_OAUTH_STATE_COOKIE_NAME,
  setGoogleOAuthStateCookie,
  setRefreshCookie,
  type RefreshCookieConfiguration,
} from "./auth.cookies.js";
import type { GoogleAuthenticationService } from "./google-auth.service.js";

export interface GoogleBrowserConfiguration {
  readonly providerCallbackUri: string;
  readonly frontendCallbackUri: string;
}

type GoogleBrowserFailureReason =
  | "correlation-failed"
  | "provider-rejected"
  | "authentication-failed";

/** Select only non-secret request evidence for privacy-hashed auth events. */
function eventMetadata(request: Request) {
  const userAgent = request.get("user-agent");
  return {
    requestId: request.requestId,
    ...(request.ip === undefined ? {} : { ip: request.ip }),
    ...(userAgent === undefined ? {} : { userAgent }),
  };
}

function principal(response: Response): AuthenticationPrincipal {
  const value = response.locals["authenticationPrincipal"] as
    | AuthenticationPrincipal
    | undefined;
  if (value === undefined) {
    throw authenticationError("AUTHENTICATION_REQUIRED");
  }
  return value;
}

function queryString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function tokenResponse(
  response: Response,
  cookies: RefreshCookieConfiguration,
  result: SessionTokens,
): object {
  setRefreshCookie(
    response,
    cookies,
    result.refreshToken,
    result.refreshExpiresAt,
  );
  response.setHeader("Cache-Control", "no-store");
  return {
    accessToken: result.accessToken,
    accessExpiresAt: result.accessExpiresAt.toISOString(),
    verificationOnly: result.verificationOnly,
    user: result.user,
    // Kept during R1 for backward compatibility with existing clients.
    identity: result.principal,
  };
}

function redirectGoogleResult(
  response: Response,
  configuration: GoogleBrowserConfiguration,
  result: {
    readonly status: "success" | "error";
    readonly intent: "sign-in" | "link";
    readonly verification?: "complete";
    readonly reason?: GoogleBrowserFailureReason;
  },
): void {
  const target = new URL(configuration.frontendCallbackUri);
  target.searchParams.set("google", result.status);
  target.searchParams.set("intent", result.intent);
  if (result.verification !== undefined) {
    target.searchParams.set("verification", result.verification);
  }
  if (result.reason !== undefined) {
    target.searchParams.set("reason", result.reason);
  }
  response.setHeader("Cache-Control", "no-store");
  response.redirect(303, target.toString());
}

function googleProviderCallbackUrl(
  request: Request,
  configuration: GoogleBrowserConfiguration,
): string {
  const trustedCallback = new URL(configuration.providerCallbackUri);
  const received = new URL(
    request.originalUrl,
    `${request.protocol}://${request.get("host") ?? "localhost"}`,
  );
  trustedCallback.search = received.search;
  return trustedCallback.toString();
}

export function createAuthenticationController(
  service: AuthenticationService,
  cookies: RefreshCookieConfiguration,
  google?: GoogleAuthenticationService,
  googleBrowser?: GoogleBrowserConfiguration,
) {
  /**
   * @desc         Register a supported public account category.
   * @route        POST /api/v1/auth/signup
   * @access       Public
   * @explanation  Creates one identity and sends its required verification code without exposing stored secrets.
   */
  const signup: RequestHandler = async (request, response, next) => {
    try {
      sendSuccess(
        request,
        response,
        202,
        await service.signup(request.body, eventMetadata(request)),
      );
    } catch (error) {
      next(error);
    }
  };
  /** @desc Add an account category @route POST /api/v1/auth/account-categories @access Private @explanation Adds a pending non-worker category to the same identity. */
  const enroll: RequestHandler = async (request, response, next) => {
    try {
      sendSuccess(
        request,
        response,
        202,
        await service.enroll(
          principal(response).userId,
          request.body,
        ),
      );
    } catch (error) {
      next(error);
    }
  };
  /** @desc Request a verification code @route POST /api/v1/auth/otp/request @access Public @explanation Supersedes an older code and delivers a new bounded challenge. */
  const requestOtp: RequestHandler = async (request, response, next) => {
    try {
      sendSuccess(
        request,
        response,
        202,
        await service.requestVerification({
          challengeId: request.body.challengeId,
          userId: request.body.userId,
          category: request.body.accountCategory,
          purpose: request.body.purpose,
        }),
      );
    } catch (error) {
      next(error);
    }
  };
  /** @desc Verify a one-time code @route POST /api/v1/auth/otp/verify @access Public @explanation Consumes one active code and completes only its approved verification gate. */
  const verifyOtp: RequestHandler = async (request, response, next) => {
    try {
      sendSuccess(
        request,
        response,
        200,
        await service.verifyCode(request.body),
      );
    } catch (error) {
      next(error);
    }
  };
  /** @desc Sign in with phone and password @route POST /api/v1/auth/login @access Public @explanation Proves credentials and creates a full or verification-only session. */
  const login: RequestHandler = async (request, response, next) => {
    try {
      sendSuccess(
        request,
        response,
        200,
        tokenResponse(
          response,
          cookies,
          await service.login(
            request.body.phone,
            request.body.password,
            eventMetadata(request),
          ),
        ),
      );
    } catch (error) {
      next(error);
    }
  };
  /** @desc Rotate a refresh session @route POST /api/v1/auth/refresh @access Public @explanation Replaces the cookie credential and rejects replay of an older credential. */
  const refresh: RequestHandler = async (request, response, next) => {
    try {
      const raw = request.cookies?.[cookies.name] as string | undefined;
      if (raw === undefined) {
        throw authenticationError("AUTH_REFRESH_TOKEN_INVALID");
      }
      sendSuccess(
        request,
        response,
        200,
        tokenResponse(
          response,
          cookies,
          await service.refresh(raw, eventMetadata(request)),
        ),
      );
    } catch (error) {
      clearRefreshCookie(response, cookies);
      next(error);
    }
  };
  /** @desc End the current session @route POST /api/v1/auth/logout @access Private @explanation Revokes the current session family and clears its cookie. */
  const logout: RequestHandler = async (request, response, next) => {
    try {
      const current = response.locals["authenticationPrincipal"] as
        | AuthenticationPrincipal
        | undefined;
      const raw = request.cookies?.[cookies.name] as string | undefined;
      if (current === undefined && raw === undefined) {
        throw authenticationError("AUTHENTICATION_REQUIRED");
      }
      const result =
        current === undefined
          ? await service.logoutByRefresh(raw!)
          : await service.logout(current.sessionId);
      clearRefreshCookie(response, cookies);
      sendSuccess(request, response, 200, result);
    } catch (error) {
      clearRefreshCookie(response, cookies);
      next(error);
    }
  };
  /** @desc End every user session @route POST /api/v1/auth/logout-all @access Private @explanation Revokes every refresh family owned by the identity. */
  const logoutAll: RequestHandler = async (request, response, next) => {
    try {
      const result = await service.logoutAll(principal(response).userId);
      clearRefreshCookie(response, cookies);
      sendSuccess(request, response, 200, result);
    } catch (error) {
      next(error);
    }
  };
  /** @desc Get the current identity @route GET /api/v1/auth/me @access Private @explanation Returns safe category and verification state without credentials or token data. */
  const me: RequestHandler = async (request, response, next) => {
    try {
      sendSuccess(
        request,
        response,
        200,
        await service.currentUser(principal(response)),
      );
    } catch (error) {
      next(error);
    }
  };
  /** @desc Request password recovery @route POST /api/v1/auth/password/forgot @access Public @explanation Always accepts valid-shaped requests so account existence is not disclosed. */
  const forgot: RequestHandler = async (request, response, next) => {
    try {
      sendSuccess(
        request,
        response,
        202,
        await service.forgotPassword({
          category: request.body.accountCategory,
          identifier: request.body.identifier,
        }),
      );
    } catch (error) {
      next(error);
    }
  };
  /** @desc Reset a forgotten password @route POST /api/v1/auth/password/reset @access Public @explanation Consumes one reset proof, changes the password, and revokes all sessions. */
  const reset: RequestHandler = async (request, response, next) => {
    try {
      sendSuccess(
        request,
        response,
        200,
        await service.resetPassword(
          request.body.challengeId,
          request.body.code,
          request.body.newPassword,
        ),
      );
    } catch (error) {
      next(error);
    }
  };
  /** @desc Change a known password @route POST /api/v1/auth/password/change @access Private @explanation Requires the current password and revokes existing sessions after replacement. */
  const change: RequestHandler = async (request, response, next) => {
    try {
      const raw = request.cookies?.[cookies.name] as string | undefined;
      if (raw === undefined) {
        throw authenticationError("AUTH_REFRESH_TOKEN_INVALID");
      }
      const result = await service.changePassword(
        principal(response),
        raw,
        request.body.currentPassword,
        request.body.newPassword,
      );
      sendSuccess(
        request,
        response,
        200,
        tokenResponse(response, cookies, result),
      );
    } catch (error) {
      next(error);
    }
  };
  /** Issue one opaque, request/purpose-bound, one-use R1-P06 proof after password re-authentication. */
  const issueSensitiveActionProof: RequestHandler = async (request, response, next) => {
    try {
      const result = await service.issueSensitiveActionProof(
        principal(response),
        request.body.currentPassword,
        {
          purpose: request.body.purpose,
          providerId: request.body.providerId,
          destinationVersionId: request.body.destinationVersionId,
          requestId: request.body.requestId,
        },
      );
      response.setHeader("Cache-Control", "no-store, private");
      response.setHeader("Pragma", "no-cache");
      sendSuccess(request, response, 201, result);
    } catch (error) {
      next(error);
    }
  };
  /** @desc Start Google sign-in 
   * @route GET /api/v1/auth/google
   *  @access Public 
   * @explanation Creates one-time state, nonce, and PKCE values for an individual-only Google flow. */
  const googleStart: RequestHandler = async (request, response, next) => {
    try {
      if (google === undefined) {
        throw authenticationError("AUTH_ACCOUNT_CATEGORY_NOT_ALLOWED");
      }
      const result = await google.start("SIGN_IN");
      setGoogleOAuthStateCookie(response, cookies, result.state);
      sendSuccess(request, response, 200, {
        authorizationUrl: result.authorizationUrl,
      });
    } catch (error) {
      next(error);
    }
  };
  /** @desc Start browser Google sign-in @route GET /api/v1/auth/google/browser @access Public @explanation Creates the correlated transaction and redirects the top-level browser directly to Google. */
  const googleBrowserStart: RequestHandler = async (
    _request,
    response,
    next,
  ) => {
    try {
      if (google === undefined) {
        throw authenticationError("AUTH_ACCOUNT_CATEGORY_NOT_ALLOWED");
      }
      const result = await google.start("SIGN_IN");
      setGoogleOAuthStateCookie(response, cookies, result.state);
      response.setHeader("Cache-Control", "no-store");
      response.redirect(303, result.authorizationUrl);
    } catch (error) {
      next(error);
    }
  };
  const completeGoogleCallback =
    (fallbackIntent: "sign-in" | "link"): RequestHandler =>
    async (request, response, next) => {
      let failureReason: GoogleBrowserFailureReason = "authentication-failed";
      try {
        if (google === undefined || googleBrowser === undefined) {
          throw authenticationError("AUTH_ACCOUNT_CATEGORY_NOT_ALLOWED");
        }
        const state = queryString(request.query["state"]);
        if (request.cookies?.[GOOGLE_OAUTH_STATE_COOKIE_NAME] !== state) {
          failureReason = "correlation-failed";
          throw authenticationError(
            fallbackIntent === "link"
              ? "AUTH_SOCIAL_LINK_FAILED"
              : "AUTH_SOCIAL_AUTHENTICATION_FAILED",
          );
        }
        if (queryString(request.query["error"]) !== "") {
          failureReason = "provider-rejected";
        }
        const callback = await google.callback(
          state,
          googleProviderCallbackUrl(request, googleBrowser),
        );
        clearGoogleOAuthStateCookie(response, cookies);
        if (callback.intent === "SIGN_IN") {
          const result = callback.result;
          setRefreshCookie(
            response,
            cookies,
            result.refreshToken,
            result.refreshExpiresAt,
          );
          redirectGoogleResult(response, googleBrowser, {
            status: "success",
            intent: "sign-in",
            verification: "complete",
          });
          return;
        }
        redirectGoogleResult(response, googleBrowser, {
          status: "success",
          intent: "link",
        });
      } catch (error) {
        clearGoogleOAuthStateCookie(response, cookies);
        if (googleBrowser === undefined) {
          next(error);
          return;
        }
        redirectGoogleResult(response, googleBrowser, {
          status: "error",
          intent: fallbackIntent,
          reason: failureReason,
        });
      }
    };
  /** @desc Complete Google authentication @route GET /api/v1/auth/google/callback @access Correlated browser callback @explanation Uses the server-held transaction intent to finish either sign-in or deliberate account linking through the one provider-registered callback URI. */
  const googleCallback = completeGoogleCallback("sign-in");
  /** @desc Start deliberate Google linking @route GET /api/v1/auth/google/link @access Private @explanation Binds one-time Google state to the current verified individual. */
  const googleLink: RequestHandler = async (request, response, next) => {
    try {
      if (google === undefined) {
        throw authenticationError("AUTH_ACCOUNT_CATEGORY_NOT_ALLOWED");
      }
      const result = await google.start("LINK", principal(response));
      setGoogleOAuthStateCookie(response, cookies, result.state);
      sendSuccess(request, response, 200, {
        authorizationUrl: result.authorizationUrl,
      });
    } catch (error) {
      next(error);
    }
  };
  /** @desc Unlink Google @route DELETE /api/v1/auth/social/google @access Private @explanation Removes Google only when another recoverable password method remains. */
  const googleUnlink: RequestHandler = async (request, response, next) => {
    try {
      sendSuccess(
        request,
        response,
        200,
        await service.unlinkGoogle(principal(response)),
      );
    } catch (error) {
      next(error);
    }
  };
  return {
    signup,
    enroll,
    requestOtp,
    verifyOtp,
    login,
    refresh,
    logout,
    logoutAll,
    me,
    forgot,
    reset,
    change,
    issueSensitiveActionProof,
    googleStart,
    googleBrowserStart,
    googleCallback,
    googleLink,
    googleUnlink,
  };
}
