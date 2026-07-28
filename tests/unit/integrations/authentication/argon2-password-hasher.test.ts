import { Argon2PasswordHasherAdapter } from '../../../../src/integrations/authentication/argon2-password-hasher.adapter.js';

describe('Argon2PasswordHasherAdapter', () => {
  it('uses the approved Argon2id baseline', async () => {
    const hasher = new Argon2PasswordHasherAdapter();
    const hash = await hasher.hash('a-secure-long-password');
    expect(hash).toContain('$argon2id$');
    expect(hash).toContain('m=65536,p=1,t=3');
    await expect(hasher.verify(hash, 'a-secure-long-password')).resolves.toBe(true);
    await expect(hasher.verify(hash, 'wrong-password')).resolves.toBe(false);
    await expect(hasher.dummyVerify('unknown-user-password')).resolves.toBeUndefined();
  }, 20_000);
});
