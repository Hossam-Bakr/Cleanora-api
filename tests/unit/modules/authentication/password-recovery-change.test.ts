import { recoveryChannel, RESET_MAX_ATTEMPTS, RESET_TTL_SECONDS } from '../../../../src/modules/authentication/domain/recovery-channel.policy.js';
import { assertPasswordPolicy } from '../../../../src/modules/authentication/domain/password.policy.js';

describe('password recovery and change policy', () => {
  it('selects authoritative recovery channels and bounded reset policy', () => {
    expect(recoveryChannel('INDIVIDUAL')).toBe('SMS');
    expect(recoveryChannel('WORKER')).toBe('SMS');
    expect(recoveryChannel('COMPANY')).toBe('EMAIL');
    expect(RESET_TTL_SECONDS).toBe(1800);
    expect(RESET_MAX_ATTEMPTS).toBe(5);
  });
  it('rejects weak replacement passwords', () => {
    expect(() => assertPasswordPolicy('weak')).toThrow();
  });
});
