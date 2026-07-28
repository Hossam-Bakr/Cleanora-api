import {
  clearGoogleOAuthStateCookie,
  clearRefreshCookie,
  GOOGLE_OAUTH_STATE_COOKIE_NAME,
  setGoogleOAuthStateCookie,
  setRefreshCookie,
} from "../../../../src/modules/authentication/http/authentication.cookies.js";

const configuration = {
  name: "cleanora_refresh_token",
  path: "/api/v1/auth",
  secure: false,
  sameSite: "lax",
} as const;

function response() {
  return {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  };
}

describe("authentication cookie names", () => {
  it("sets only the canonical refresh name and expires legacy names", () => {
    const target = response();

    setRefreshCookie(
      target as never,
      configuration,
      "private-refresh-token",
      new Date(Date.now() + 60_000),
    );

    expect(target.cookie).toHaveBeenCalledWith(
      "cleanora_refresh_token",
      "private-refresh-token",
      expect.objectContaining({
        httpOnly: true,
        path: "/api/v1/auth",
      }),
    );
    expect(target.clearCookie).toHaveBeenCalledWith(
      "cleanora_refresh",
      expect.objectContaining({ path: "/api/v1/auth" }),
    );
    expect(target.clearCookie).toHaveBeenCalledWith(
      "fs_refreshtoken",
      expect.objectContaining({ path: "/" }),
    );
  });

  it("uses the explicit Google OAuth state name and clears its legacy name", () => {
    const target = response();

    setGoogleOAuthStateCookie(target as never, configuration, "private-state");

    expect(target.cookie).toHaveBeenCalledWith(
      GOOGLE_OAUTH_STATE_COOKIE_NAME,
      "private-state",
      expect.objectContaining({
        httpOnly: true,
        path: "/api/v1/auth",
      }),
    );
    expect(target.clearCookie).toHaveBeenCalledWith(
      "cleanora_google_state",
      expect.objectContaining({ path: "/api/v1/auth" }),
    );

    clearGoogleOAuthStateCookie(target as never, configuration);
    clearRefreshCookie(target as never, configuration);
    expect(target.clearCookie).toHaveBeenCalledWith(
      GOOGLE_OAUTH_STATE_COOKIE_NAME,
      expect.objectContaining({ path: "/api/v1/auth" }),
    );
    expect(target.clearCookie).toHaveBeenCalledWith(
      "cleanora_refresh_token",
      expect.objectContaining({ path: "/api/v1/auth" }),
    );
  });
});
