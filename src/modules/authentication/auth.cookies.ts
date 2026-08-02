import type { CookieOptions, Response } from "express";

export const DEFAULT_REFRESH_COOKIE_NAME = "cleanora_refresh_token";
export const GOOGLE_OAUTH_STATE_COOKIE_NAME = "cleanora_google_oauth_state";

const LEGACY_REFRESH_COOKIE_NAMES = [
  "cleanora_refresh",
  "fs_refreshtoken",
] as const;
const LEGACY_GOOGLE_STATE_COOKIE_NAMES = ["cleanora_google_state"] as const;

export interface RefreshCookieConfiguration {
  readonly name: string;
  readonly path: string;
  readonly secure: boolean;
  readonly sameSite: "lax" | "strict" | "none";
}

function options(
  configuration: RefreshCookieConfiguration,
  expiresAt?: Date,
): CookieOptions {
  return {
    httpOnly: true,
    secure: configuration.secure,
    sameSite: configuration.sameSite,
    path: configuration.path,
    ...(expiresAt === undefined
      ? {}
      : { maxAge: Math.max(0, expiresAt.getTime() - Date.now()) }),
  };
}

function clearCookieOnConfiguredPaths(
  response: Response,
  configuration: RefreshCookieConfiguration,
  name: string,
): void {
  response.clearCookie(name, options(configuration));
  if (configuration.path !== "/") {
    response.clearCookie(name, {
      ...options(configuration),
      path: "/",
    });
  }
}

function clearLegacyCookies(
  response: Response,
  configuration: RefreshCookieConfiguration,
  names: readonly string[],
): void {
  for (const name of names) {
    if (name !== configuration.name) {
      clearCookieOnConfiguredPaths(response, configuration, name);
    }
  }
}

export function setRefreshCookie(
  response: Response,
  configuration: RefreshCookieConfiguration,
  token: string,
  expiresAt: Date,
): void {
  response.cookie(configuration.name, token, options(configuration, expiresAt));
  clearLegacyCookies(response, configuration, LEGACY_REFRESH_COOKIE_NAMES);
}

export function clearRefreshCookie(
  response: Response,
  configuration: RefreshCookieConfiguration,
): void {
  clearCookieOnConfiguredPaths(response, configuration, configuration.name);
  clearLegacyCookies(response, configuration, LEGACY_REFRESH_COOKIE_NAMES);
}

export function setGoogleOAuthStateCookie(
  response: Response,
  configuration: RefreshCookieConfiguration,
  state: string,
): void {
  response.cookie(GOOGLE_OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: configuration.secure,
    sameSite: "lax",
    path: configuration.path,
    maxAge: 600_000,
  });
  clearLegacyCookies(
    response,
    configuration,
    LEGACY_GOOGLE_STATE_COOKIE_NAMES,
  );
}

export function clearGoogleOAuthStateCookie(
  response: Response,
  configuration: RefreshCookieConfiguration,
): void {
  clearCookieOnConfiguredPaths(
    response,
    configuration,
    GOOGLE_OAUTH_STATE_COOKIE_NAME,
  );
  clearLegacyCookies(
    response,
    configuration,
    LEGACY_GOOGLE_STATE_COOKIE_NAMES,
  );
}
