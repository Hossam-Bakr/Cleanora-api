import { requireTrustedOrigin } from "../../../../src/modules/authentication/auth.middleware.js";

describe('authentication origin guard', () => {
  it('accepts only allowlisted browser origins', () => {
    const middleware = requireTrustedOrigin(['https://cleanora.test']);
    const accepted = vi.fn();
    middleware({ get: () => 'https://cleanora.test' } as never, {} as never, accepted);
    expect(accepted).toHaveBeenCalledWith();
    const rejected = vi.fn();
    middleware({ get: () => 'https://evil.test' } as never, {} as never, rejected);
    expect(rejected.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it('rejects cookie-state requests with a missing Origin header', () => {
    const middleware = requireTrustedOrigin(['https://cleanora.test']);
    const next = vi.fn();
    middleware({ get: () => undefined } as never, {} as never, next);
    expect(next.mock.calls[0]?.[0]).toMatchObject({
      code: 'AUTH_REQUEST_ORIGIN_REJECTED',
      statusCode: 403,
    });
  });
});
