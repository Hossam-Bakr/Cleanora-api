import { requireFullAuthentication } from '../../../../src/modules/authentication/auth.middleware.js';

describe('verification-only route guard', () => {
  it('rejects requests when authentication middleware supplied no principal', () => {
    const next = vi.fn();
    requireFullAuthentication({} as never, { locals: {} } as never, next);

    expect(next.mock.calls[0]?.[0]).toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
      statusCode: 401
    });
  });

  it('rejects verification-only principals with the stable verification error', () => {
    const next = vi.fn();
    requireFullAuthentication(
      {} as never,
      { locals: { authenticationPrincipal: { verificationOnly: true } } } as never,
      next
    );

    expect(next.mock.calls[0]?.[0]).toMatchObject({
      code: 'AUTH_VERIFICATION_REQUIRED',
      statusCode: 403
    });
  });

  it('allows fully verified principals', () => {
    const next = vi.fn();
    requireFullAuthentication(
      {} as never,
      { locals: { authenticationPrincipal: { verificationOnly: false } } } as never,
      next
    );

    expect(next).toHaveBeenCalledWith();
  });
});
