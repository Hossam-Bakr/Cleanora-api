import { CryptoVerifierAdapter } from '../../../../src/integrations/authentication/crypto-verifier.adapter.js';

describe('CryptoVerifierAdapter', () => {
  const verifier = new CryptoVerifierAdapter('test-verifier-secret-that-is-longer-than-32-chars');
  it('creates OTPs and domain-separated HMAC verifiers', () => {
    expect(verifier.randomOtp()).toMatch(/^\d{6}$/);
    expect(verifier.verifyOtp('id', 'purpose', '123456')).not.toBe(verifier.verifyReset('id', '123456'));
    expect(verifier.equals(verifier.verifyReset('id', 'secret'), verifier.verifyReset('id', 'secret'))).toBe(true);
  });
});
