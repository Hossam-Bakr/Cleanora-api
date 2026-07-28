import { createAuthenticationController } from '../../../../src/modules/authentication/http/authentication.controller.js';

const cookies = {
  name: 'cleanora_refresh_token',
  secure: true,
  sameSite: 'strict',
  path: '/api/v1/auth'
} as const;

function request(overrides: Record<string, unknown> = {}) {
  return {
    body: {},
    cookies: {},
    query: {},
    protocol: 'https',
    originalUrl: '/api/v1/auth/google/callback',
    get: vi.fn(() => 'api.cleanora.test'),
    ...overrides
  };
}

function response(locals: Record<string, unknown> = {}) {
  const result = {
    locals,
    status: vi.fn(),
    json: vi.fn(),
    cookie: vi.fn(),
    clearCookie: vi.fn(),
    setHeader: vi.fn(),
    redirect: vi.fn()
  };
  result.status.mockReturnValue(result);
  result.json.mockReturnValue(result);
  result.cookie.mockReturnValue(result);
  result.clearCookie.mockReturnValue(result);
  result.setHeader.mockReturnValue(result);
  result.redirect.mockReturnValue(result);
  return result;
}

const principal = {
  userId: 'user-1',
  sessionId: 'session-1',
  accountCategories: ['INDIVIDUAL'],
  verifiedCategories: ['INDIVIDUAL'],
  pendingCategories: [],
  status: 'ACTIVE',
  verificationOnly: false
} as const;

function sessionTokens() {
  const user = {
    id: principal.userId,
    email: 'person@example.test',
    phone: '+201012345678',
    emailVerified: true,
    phoneVerified: true,
    status: 'ACTIVE',
    accountCategories: ['INDIVIDUAL'],
    verifiedCategories: ['INDIVIDUAL'],
    pendingCategories: []
  } as const;
  return {
    accessToken: 'access-token',
    refreshToken: 'replacement-refresh-token',
    accessExpiresAt: new Date('2026-07-25T12:15:00.000Z'),
    refreshExpiresAt: new Date('2026-08-24T12:00:00.000Z'),
    verificationOnly: false,
    principal,
    user
  };
}

describe('authentication controller failure alternatives', () => {
  it('rejects refresh when the refresh cookie is absent', async () => {
    const service = { refresh: vi.fn() };
    const controller = createAuthenticationController(service as never, cookies);
    const next = vi.fn();
    const responseValue = response();

    await controller.refresh(
      request() as never,
      responseValue as never,
      next,
    );

    expect(service.refresh).not.toHaveBeenCalled();
    expect(responseValue.clearCookie).toHaveBeenCalledWith(
      "cleanora_refresh_token",
      expect.objectContaining({ path: "/api/v1/auth" }),
    );
    expect(next.mock.calls[0]?.[0]).toMatchObject({ code: 'AUTH_REFRESH_TOKEN_INVALID' });
  });

  it('rejects password change when the refresh cookie is absent', async () => {
    const service = { changePassword: vi.fn() };
    const controller = createAuthenticationController(service as never, cookies);
    const next = vi.fn();

    await controller.change(
      request({ body: { currentPassword: 'old-password', newPassword: 'new-password' } }) as never,
      { locals: { authenticationPrincipal: { userId: 'user-1' } } } as never,
      next
    );

    expect(service.changePassword).not.toHaveBeenCalled();
    expect(next.mock.calls[0]?.[0]).toMatchObject({ code: 'AUTH_REFRESH_TOKEN_INVALID' });
  });

  it.each([
    'googleStart',
    'googleBrowserStart',
    'googleCallback',
    'googleLink'
  ] as const)('rejects %s when Google authentication is disabled', async (handlerName) => {
    const controller = createAuthenticationController({} as never, cookies);
    const next = vi.fn();

    await controller[handlerName](request() as never, response() as never, next);

    expect(next.mock.calls[0]?.[0]).toMatchObject({
      code: 'AUTH_ACCOUNT_CATEGORY_NOT_ALLOWED',
      statusCode: 403
    });
  });

  it('redirects a mismatched callback state with a safe generic result', async () => {
    const google = { callback: vi.fn(), start: vi.fn() };
    const controller = createAuthenticationController(
      {} as never,
      cookies,
      google as never,
      {
        providerCallbackUri: 'https://api.cleanora.test/api/v1/auth/google/callback',
        frontendCallbackUri: 'https://app.cleanora.test/auth/google/callback'
      }
    );
    const responseValue = response();
    const next = vi.fn();

    await controller.googleCallback(
      request({ query: { state: 'query-state' }, cookies: { cleanora_google_oauth_state: 'cookie-state' } }) as never,
      responseValue as never,
      next
    );

    expect(google.callback).not.toHaveBeenCalled();
    expect(responseValue.redirect).toHaveBeenCalledWith(
      303,
      expect.stringContaining(
        'google=error&intent=sign-in&reason=correlation-failed'
      )
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('maps a provider rejection to a safe browser reason without forwarding it', async () => {
    const google = {
      callback: vi.fn(async () => {
        throw new Error('provider payload must not escape');
      }),
      start: vi.fn()
    };
    const controller = createAuthenticationController(
      {} as never,
      cookies,
      google as never,
      {
        providerCallbackUri: 'https://api.cleanora.test/api/v1/auth/google/callback',
        frontendCallbackUri: 'https://app.cleanora.test/auth/google/callback'
      }
    );
    const responseValue = response();
    const next = vi.fn();

    await controller.googleCallback(
      request({
        query: {
          state: 'state-1',
          error: 'raw-provider-error-must-not-escape'
        },
        cookies: { cleanora_google_oauth_state: 'state-1' }
      }) as never,
      responseValue as never,
      next
    );

    const redirect = responseValue.redirect.mock.calls[0]?.[1] as string;
    expect(redirect).toContain(
      'google=error&intent=sign-in&reason=provider-rejected'
    );
    expect(redirect).not.toContain('raw-provider-error-must-not-escape');
    expect(redirect).not.toContain('provider+payload');
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a non-string Google callback state without object coercion', async () => {
    const google = { callback: vi.fn(), start: vi.fn() };
    const controller = createAuthenticationController(
      {} as never,
      cookies,
      google as never,
      {
        providerCallbackUri: 'https://api.cleanora.test/api/v1/auth/google/callback',
        frontendCallbackUri: 'https://app.cleanora.test/auth/google/callback'
      }
    );
    const responseValue = response();
    const next = vi.fn();

    await controller.googleCallback(
      request({
        query: { state: { attackerControlled: true } },
        cookies: { cleanora_google_oauth_state: '[object Object]' }
      }) as never,
      responseValue as never,
      next
    );

    expect(google.callback).not.toHaveBeenCalled();
    expect(responseValue.redirect).toHaveBeenCalledWith(
      303,
      expect.stringContaining('google=error&intent=sign-in')
    );
    expect(next).not.toHaveBeenCalled();
  });


  it('refreshes when the refresh cookie is present and returns a no-store token response', async () => {
    const service = { refresh: vi.fn(async () => sessionTokens()) };
    const controller = createAuthenticationController(service as never, cookies);
    const requestValue = request({
      requestId: 'request-1',
      cookies: { cleanora_refresh_token: 'current-refresh-token' },
      ip: '127.0.0.1',
      get: vi.fn((name: string) => name === 'user-agent' ? 'unit-test-agent' : undefined)
    });
    const responseValue = response();
    const next = vi.fn();

    await controller.refresh(requestValue as never, responseValue as never, next);

    expect(service.refresh).toHaveBeenCalledWith('current-refresh-token', {
      requestId: 'request-1',
      ip: '127.0.0.1',
      userAgent: 'unit-test-agent'
    });
    expect(responseValue.cookie).toHaveBeenCalled();
    expect(responseValue.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(responseValue.status).toHaveBeenCalledWith(200);
    expect(responseValue.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user: sessionTokens().user,
          identity: principal,
        }),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('changes a password when both the principal and refresh cookie are present', async () => {
    const service = { changePassword: vi.fn(async () => sessionTokens()) };
    const controller = createAuthenticationController(service as never, cookies);
    const responseValue = response({ authenticationPrincipal: principal });
    const next = vi.fn();

    await controller.change(
      request({
        body: { currentPassword: 'current-password', newPassword: 'replacement-password' },
        cookies: { cleanora_refresh_token: 'current-refresh-token' }
      }) as never,
      responseValue as never,
      next
    );

    expect(service.changePassword).toHaveBeenCalledWith(
      principal,
      'current-refresh-token',
      'current-password',
      'replacement-password'
    );
    expect(responseValue.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    ['googleStart', 'SIGN_IN'],
    ['googleLink', 'LINK']
  ] as const)('starts configured Google flow through %s', async (handlerName, intent) => {
    const google = {
      start: vi.fn(async () => ({ state: 'state-1', authorizationUrl: 'https://google.test/authorize' }))
    };
    const controller = createAuthenticationController({} as never, cookies, google as never);
    const responseValue = response({ authenticationPrincipal: principal });
    const next = vi.fn();

    await controller[handlerName](request({ requestId: 'request-1' }) as never, responseValue as never, next);

    expect(google.start).toHaveBeenCalledWith(...(intent === 'LINK' ? [intent, principal] : [intent]));
    expect(responseValue.cookie).toHaveBeenCalledWith(
      'cleanora_google_oauth_state',
      'state-1',
      expect.objectContaining({ httpOnly: true, maxAge: 600_000 })
    );
    expect(responseValue.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('starts Google with a direct no-store browser redirect', async () => {
    const google = {
      start: vi.fn(async () => ({
        state: 'state-1',
        authorizationUrl: 'https://google.test/authorize'
      }))
    };
    const controller = createAuthenticationController({} as never, cookies, google as never);
    const responseValue = response();
    const next = vi.fn();

    await controller.googleBrowserStart(
      request() as never,
      responseValue as never,
      next
    );

    expect(responseValue.cookie).toHaveBeenCalled();
    expect(responseValue.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(responseValue.redirect).toHaveBeenCalledWith(303, 'https://google.test/authorize');
    expect(next).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'uses the common callback for stored linking=%s intent',
    async (linking) => {
    const google = {
      callback: vi.fn(async () => linking
        ? { intent: 'LINK', result: { linked: true } }
        : { intent: 'SIGN_IN', result: sessionTokens() })
    };
    const controller = createAuthenticationController(
      {} as never,
      cookies,
      google as never,
      {
        providerCallbackUri: 'https://api.cleanora.test/api/v1/auth/google/callback',
        frontendCallbackUri: 'https://app.cleanora.test/auth/google/callback'
      }
    );
    const responseValue = response();
    const next = vi.fn();

    await controller.googleCallback(
      request({
        requestId: 'request-1',
        query: { state: 'state-1' },
        cookies: { cleanora_google_oauth_state: 'state-1' },
        originalUrl: '/api/v1/auth/google/callback?state=state-1',
        get: vi.fn(() => undefined)
      }) as never,
      responseValue as never,
      next
    );

    expect(google.callback).toHaveBeenCalledWith(
      'state-1',
      'https://api.cleanora.test/api/v1/auth/google/callback?state=state-1'
    );
    expect(responseValue.redirect).toHaveBeenCalledWith(
      303,
      expect.stringContaining(`google=success&intent=${linking ? 'link' : 'sign-in'}`)
    );
    expect(next).not.toHaveBeenCalled();
    },
  );

  it('registers signup and OTP journeys through the public controller contract', async () => {
    const challenge = {
      accepted: true,
      challengeId: 'challenge-1',
      nextAction: 'VERIFY_ACCOUNT',
      channel: 'EMAIL',
      purpose: 'CATEGORY_VERIFICATION',
      maskedDestination: 'p***n@example.test',
      expiresAt: '2026-07-28T12:00:00.000Z',
      resendAvailableAt: '2026-07-28T12:01:00.000Z',
    };
    const service = {
      signup: vi.fn(async () => challenge),
      requestVerification: vi.fn(async () => challenge),
      verifyCode: vi.fn(async () => ({ verified: true, nextAction: 'LOGIN' })),
      enroll: vi.fn(async () => challenge),
      login: vi.fn(async () => sessionTokens()),
      forgotPassword: vi.fn(async () => ({
        accepted: true,
        challengeId: "0d301aa0-a709-48e5-a5a6-1e5bfb7f132c",
      })),
      resetPassword: vi.fn(async () => ({ passwordReset: true, nextAction: 'LOGIN' })),
      currentUser: vi.fn(async () => ({ user: sessionTokens().user, verificationOnly: false })),
      logout: vi.fn(async () => ({ loggedOut: true })),
      logoutByRefresh: vi.fn(async () => ({ loggedOut: true })),
      logoutAll: vi.fn(async () => ({ loggedOutAll: true })),
      unlinkGoogle: vi.fn(async () => ({ unlinked: true })),
    };
    const controller = createAuthenticationController(service as never, cookies);

    const signupResponse = response();
    await controller.signup(
      request({
        requestId: 'req-signup',
        body: {
          accountCategory: 'INDIVIDUAL',
          phone: '+201012345678',
          email: 'person@example.test',
          password: 'safe-pass',
        },
        ip: '127.0.0.1',
        get: vi.fn((name: string) => (name === 'user-agent' ? 'unit-agent' : undefined)),
      }) as never,
      signupResponse as never,
      vi.fn(),
    );
    expect(service.signup).toHaveBeenCalledWith(
      expect.objectContaining({ accountCategory: 'INDIVIDUAL' }),
      expect.objectContaining({ requestId: 'req-signup' }),
    );
    expect(signupResponse.status).toHaveBeenCalledWith(202);

    const otpResponse = response();
    await controller.requestOtp(
      request({ body: { challengeId: 'challenge-1' } }) as never,
      otpResponse as never,
      vi.fn(),
    );
    expect(service.requestVerification).toHaveBeenCalledWith({
      challengeId: 'challenge-1',
      userId: undefined,
      category: undefined,
      purpose: undefined,
    });
    expect(otpResponse.status).toHaveBeenCalledWith(202);

    const verifyResponse = response();
    await controller.verifyOtp(
      request({ body: { challengeId: 'challenge-1', code: '123456' } }) as never,
      verifyResponse as never,
      vi.fn(),
    );
    expect(verifyResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { verified: true, nextAction: 'LOGIN' },
      }),
    );

    const enrollResponse = response({ authenticationPrincipal: principal });
    await controller.enroll(
      request({ body: { accountCategory: 'COMPANY' } }) as never,
      enrollResponse as never,
      vi.fn(),
    );
    expect(service.enroll).toHaveBeenCalledWith('user-1', 'COMPANY');
    expect(enrollResponse.status).toHaveBeenCalledWith(202);

    const loginResponse = response();
    await controller.login(
      request({
        requestId: 'req-login',
        body: { phone: '+201012345678', password: 'safe-pass' },
        get: vi.fn(() => undefined),
      }) as never,
      loginResponse as never,
      vi.fn(),
    );
    expect(loginResponse.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(loginResponse.status).toHaveBeenCalledWith(200);

    const forgotResponse = response();
    await controller.forgot(
      request({ body: { accountCategory: 'INDIVIDUAL', identifier: 'person@example.test' } }) as never,
      forgotResponse as never,
      vi.fn(),
    );
    expect(forgotResponse.status).toHaveBeenCalledWith(202);
    expect(forgotResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          accepted: true,
          challengeId: "0d301aa0-a709-48e5-a5a6-1e5bfb7f132c",
        },
      }),
    );

    const resetResponse = response();
    await controller.reset(
      request({
        body: {
          challengeId: "0d301aa0-a709-48e5-a5a6-1e5bfb7f132c",
          code: "5486",
          newPassword: "replacement-pass",
        },
      }) as never,
      resetResponse as never,
      vi.fn(),
    );
    expect(service.resetPassword).toHaveBeenCalledWith(
      "0d301aa0-a709-48e5-a5a6-1e5bfb7f132c",
      "5486",
      "replacement-pass",
    );
    expect(resetResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { passwordReset: true, nextAction: 'LOGIN' },
      }),
    );

    const meResponse = response({ authenticationPrincipal: principal });
    await controller.me(request() as never, meResponse as never, vi.fn());
    expect(service.currentUser).toHaveBeenCalledWith(principal);
    expect(meResponse.status).toHaveBeenCalledWith(200);

    const logoutBearer = response({ authenticationPrincipal: principal });
    await controller.logout(request() as never, logoutBearer as never, vi.fn());
    expect(service.logout).toHaveBeenCalledWith('session-1');
    expect(logoutBearer.clearCookie).toHaveBeenCalled();

    const logoutCookie = response();
    await controller.logout(
      request({ cookies: { cleanora_refresh_token: 'refresh-token' } }) as never,
      logoutCookie as never,
      vi.fn(),
    );
    expect(service.logoutByRefresh).toHaveBeenCalledWith('refresh-token');

    const logoutAllResponse = response({ authenticationPrincipal: principal });
    await controller.logoutAll(request() as never, logoutAllResponse as never, vi.fn());
    expect(service.logoutAll).toHaveBeenCalledWith('user-1');

    const unlinkResponse = response({ authenticationPrincipal: principal });
    await controller.googleUnlink(request() as never, unlinkResponse as never, vi.fn());
    expect(service.unlinkGoogle).toHaveBeenCalledWith(principal);
    expect(unlinkResponse.status).toHaveBeenCalledWith(200);
  });

  it('rejects logout without bearer principal or refresh cookie', async () => {
    const controller = createAuthenticationController({} as never, cookies);
    const next = vi.fn();
    await controller.logout(request() as never, response() as never, next);
    expect(next.mock.calls[0]?.[0]).toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
      statusCode: 401,
    });
  });

  it('rejects enroll when the authenticated principal is missing', async () => {
    const service = { enroll: vi.fn() };
    const controller = createAuthenticationController(service as never, cookies);
    const next = vi.fn();
    await controller.enroll(
      request({ body: { accountCategory: 'COMPANY' } }) as never,
      response() as never,
      next,
    );
    expect(service.enroll).not.toHaveBeenCalled();
    expect(next.mock.calls[0]?.[0]).toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
    });
  });

  it('marks a completed Google sign-in when phone verification is already satisfied', async () => {
    const google = {
      callback: vi.fn(async () => ({
        intent: 'SIGN_IN',
        result: { ...sessionTokens(), verificationOnly: false },
      })),
    };
    const controller = createAuthenticationController(
      {} as never,
      cookies,
      google as never,
      {
        providerCallbackUri: 'https://api.cleanora.test/api/v1/auth/google/callback',
        frontendCallbackUri: 'https://app.cleanora.test/auth/google/callback',
      },
    );
    const responseValue = response();
    await controller.googleCallback(
      request({
        query: { state: 'state-1' },
        cookies: { cleanora_google_oauth_state: 'state-1' },
        originalUrl: '/api/v1/auth/google/callback?state=state-1',
      }) as never,
      responseValue as never,
      vi.fn(),
    );
    expect(responseValue.redirect).toHaveBeenCalledWith(
      303,
      expect.stringContaining('google=success&intent=sign-in&verification=complete'),
    );
  });
});
