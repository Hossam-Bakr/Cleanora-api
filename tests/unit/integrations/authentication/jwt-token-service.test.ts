import { JwtTokenServiceAdapter } from '../../../../src/integrations/authentication/jwt-token-service.adapter.js';

describe('JwtTokenServiceAdapter', () => {
  const service = new JwtTokenServiceAdapter({ accessSecret: 'access-secret-at-least-thirty-two-characters', refreshSecret: 'refresh-secret-at-least-thirty-two-characters', issuer: 'cleanora', audience: 'web', accessTtlSeconds: 60 });
  it('pins token types and claims', () => {
    const access = service.issueAccess({ userId: 'u', sessionId: 's', credentialVersion: 1 });
    expect(service.verifyAccess(access.token)).toMatchObject({ userId: 'u', sessionId: 's' });
    expect(() => service.verifyRefresh(access.token)).toThrow();
    const refresh = service.issueRefresh({ userId: 'u', sessionId: 's', credentialVersion: 1, rotationCounter: 0, jwtId: 'j' }, new Date(Date.now() + 60_000));
    expect(service.verifyRefresh(refresh.token).rotationCounter).toBe(0);
  });
});
