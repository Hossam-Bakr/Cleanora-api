import { MemoryGoogleTransactionStoreAdapter } from '../../../../src/integrations/authentication/memory-google-transaction-store.adapter.js';
import { GoogleAuthenticationService } from '../../../../src/modules/authentication/application/google-authentication.js';

describe('Google authentication policy', () => {
  it('creates bounded one-time state, nonce, and PKCE transactions', async () => {
    const store = new MemoryGoogleTransactionStoreAdapter();
    const identity = { createAuthorizationUrl: vi.fn(async (transaction) => `https://accounts.test/auth?state=${transaction.state}`), consumeCallback: vi.fn() };
    const service = new GoogleAuthenticationService(identity, store, {} as never);
    const started = await service.start('SIGN_IN');
    expect(started.authorizationUrl).toContain(started.state);
    const consumed = store.consume(started.state);
    expect(consumed?.nonce).toBeTruthy();
    expect(consumed?.pkceVerifier).toBeTruthy();
    expect(store.consume(started.state)).toBeUndefined();
  });
  it('rejects linking without a full verified individual session', async () => {
    const service = new GoogleAuthenticationService({} as never, new MemoryGoogleTransactionStoreAdapter(), {} as never);
    await expect(service.start('LINK', { userId: 'u', sessionId: 's', accountCategories: ['INDIVIDUAL'], verifiedCategories: [], pendingCategories: ['INDIVIDUAL'], status: 'ACTIVE', verificationOnly: true })).rejects.toThrow();
  });

  it('issues unpredictable state and rejects expiry, replay, and tampering', async () => {
    const store = new MemoryGoogleTransactionStoreAdapter();
    const provider = {
      subject: 'google-subject-1',
      email: 'user@example.test',
      emailVerified: true
    };
    const identity = {
      createAuthorizationUrl: vi.fn(async () => 'https://google.test'),
      consumeCallback: vi.fn(async () => provider)
    };
    const service = new GoogleAuthenticationService(identity, store, {} as never);
    const first = await service.start('SIGN_IN');
    const second = await service.start('SIGN_IN');
    expect(first.state).not.toBe(second.state);
    expect(first.state.length).toBeGreaterThanOrEqual(40);
    expect(store.consume(`${first.state}tampered`)).toBeUndefined();
    expect(store.consume(first.state)).toBeDefined();
    expect(store.consume(first.state)).toBeUndefined();
    store.save({ state: 'expired-state', nonce: 'nonce', pkceVerifier: 'pkce', intent: 'SIGN_IN', expiresAt: new Date(Date.now() - 1) });
    expect(store.consume('expired-state')).toBeUndefined();
  });

  it('binds link state to the initiating Cleanora user', async () => {
    const store = new MemoryGoogleTransactionStoreAdapter();
    const provider = {
      subject: 'google-subject-1',
      email: 'user@example.test',
      emailVerified: true
    };
    const identity = {
      createAuthorizationUrl: vi.fn(async () => 'https://google.test'),
      consumeCallback: vi.fn(async () => provider)
    };
    const linkedPrincipal = {
      userId: 'user-1',
      sessionId: 'session-1',
      accountCategories: ['INDIVIDUAL'] as const,
      verifiedCategories: ['INDIVIDUAL'] as const,
      pendingCategories: [],
      status: 'ACTIVE' as const,
      verificationOnly: false
    };
    const authentication = {
      resolveGoogleLinkPrincipal: vi.fn(async () => linkedPrincipal),
      linkGoogle: vi.fn(async () => ({ linked: true }))
    };
    const service = new GoogleAuthenticationService(identity, store, authentication as never);
    const started = await service.start('LINK', linkedPrincipal);
    await expect(service.callback(started.state, 'https://callback.test')).resolves.toEqual({
      intent: 'LINK',
      result: { linked: true }
    });
    expect(authentication.resolveGoogleLinkPrincipal).toHaveBeenCalledWith('user-1', 'session-1');
    expect(authentication.linkGoogle).toHaveBeenCalledWith(linkedPrincipal, provider);
    await expect(service.callback(started.state, 'https://callback.test')).rejects.toMatchObject({ code: 'AUTH_SOCIAL_AUTHENTICATION_FAILED' });
  });

  it('completes sign-in callbacks through the authentication service', async () => {
    const store = new MemoryGoogleTransactionStoreAdapter();
    const provider = {
      subject: 'google-subject-2',
      email: 'signin@example.test',
      emailVerified: true
    };
    const identity = {
      createAuthorizationUrl: vi.fn(async () => 'https://google.test'),
      consumeCallback: vi.fn(async () => provider)
    };
    const tokens = { accessToken: 'access', refreshToken: 'refresh', verificationOnly: true };
    const authentication = {
      googleSignIn: vi.fn(async () => tokens)
    };
    const service = new GoogleAuthenticationService(identity, store, authentication as never);
    const started = await service.start('SIGN_IN');
    await expect(service.callback(started.state, 'https://callback.test')).resolves.toEqual({
      intent: 'SIGN_IN',
      result: tokens
    });
    expect(authentication.googleSignIn).toHaveBeenCalledWith(provider);
  });

  it('rejects link callbacks whose stored transaction lost its user binding', async () => {
    const store = new MemoryGoogleTransactionStoreAdapter();
    const identity = {
      createAuthorizationUrl: vi.fn(async () => 'https://google.test'),
      consumeCallback: vi.fn(async () => ({
        subject: 'google-subject-3',
        email: 'link@example.test',
        emailVerified: true
      }))
    };
    const service = new GoogleAuthenticationService(identity, store, {} as never);
    store.save({
      state: 'unbound-link',
      nonce: 'nonce',
      pkceVerifier: 'pkce',
      intent: 'LINK',
      expiresAt: new Date(Date.now() + 60_000)
    });
    await expect(service.callback('unbound-link', 'https://callback.test')).rejects.toMatchObject({
      code: 'AUTH_SOCIAL_LINK_FAILED'
    });
  });
});
