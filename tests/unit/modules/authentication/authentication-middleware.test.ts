import { createAuthenticateAccess } from '../../../../src/modules/authentication/http/authentication.middleware.js';

describe('authentication access middleware', () => {
  it.each([
    undefined,
    'Basic credentials',
    'Bearer'
  ])('rejects missing or malformed bearer input %#', async (authorization) => {
    const service = { authenticateAccess: vi.fn() };
    const middleware = createAuthenticateAccess(service as never);
    const next = vi.fn();

    await middleware(
      { get: vi.fn(() => authorization) } as never,
      { locals: {} } as never,
      next
    );

    expect(service.authenticateAccess).not.toHaveBeenCalled();
    expect(next.mock.calls[0]?.[0]).toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
      statusCode: 401
    });
  });

  it('forwards access-token verification failures without installing a principal', async () => {
    const failure = Object.assign(new Error('invalid access token'), {
      code: 'AUTH_ACCESS_TOKEN_INVALID',
      statusCode: 401
    });
    const service = { authenticateAccess: vi.fn(async () => Promise.reject(failure)) };
    const middleware = createAuthenticateAccess(service as never);
    const response = { locals: {} };
    const next = vi.fn();

    await middleware(
      { get: vi.fn(() => 'Bearer malformed-token') } as never,
      response as never,
      next
    );

    expect(service.authenticateAccess).toHaveBeenCalledWith('malformed-token');
    expect(response.locals).not.toHaveProperty('authenticationPrincipal');
    expect(next).toHaveBeenCalledWith(failure);
  });

  it('installs the authenticated principal for a well-formed bearer token', async () => {
    const principal = {
      userId: 'user-1',
      sessionId: 'session-1',
      accountCategories: ['INDIVIDUAL'],
      verifiedCategories: ['INDIVIDUAL'],
      pendingCategories: [],
      status: 'ACTIVE',
      verificationOnly: false
    };
    const service = {
      authenticateAccess: vi.fn(async () => principal)
    };
    const middleware = createAuthenticateAccess(service as never);
    const response = { locals: {} as Record<string, unknown> };
    const next = vi.fn();

    await middleware(
      { get: vi.fn(() => 'Bearer valid-access-token') } as never,
      response as never,
      next
    );

    expect(service.authenticateAccess).toHaveBeenCalledWith('valid-access-token');
    expect(response.locals['authenticationPrincipal']).toEqual(principal);
    expect(next).toHaveBeenCalledWith();
  });
});
