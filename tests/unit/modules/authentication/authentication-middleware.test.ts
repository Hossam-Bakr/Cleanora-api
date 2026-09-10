import { createOptionalAuthenticateAccess } from "#modules/authentication/auth.middleware";
import { authenticationError } from "#modules/authentication/domain/authentication.errors";

describe("createOptionalAuthenticateAccess", () => {
  it("allows guests when Authorization is absent", async () => {
    const next = vi.fn();
    const middleware = createOptionalAuthenticateAccess({
      authenticateAccess: vi.fn(),
    });
    await middleware(
      { get: () => undefined } as never,
      { locals: {} } as never,
      next,
    );
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects malformed Bearer tokens", async () => {
    const next = vi.fn();
    const middleware = createOptionalAuthenticateAccess({
      authenticateAccess: vi.fn(),
    });
    await middleware(
      { get: () => "Token abc" } as never,
      { locals: {} } as never,
      next,
    );
    expect(next.mock.calls[0]?.[0]).toMatchObject(
      authenticationError("AUTHENTICATION_REQUIRED"),
    );
  });

  it("authenticates valid Bearer tokens", async () => {
    const next = vi.fn();
    const principal = { userId: "u1" };
    const authenticateAccess = vi.fn().mockResolvedValue(principal);
    const middleware = createOptionalAuthenticateAccess({ authenticateAccess });
    const response = { locals: {} as Record<string, unknown> };
    await middleware(
      { get: () => "Bearer good-token" } as never,
      response as never,
      next,
    );
    expect(authenticateAccess).toHaveBeenCalledWith("good-token");
    expect(response.locals["authenticationPrincipal"]).toBe(principal);
    expect(next).toHaveBeenCalledWith();
  });
});
