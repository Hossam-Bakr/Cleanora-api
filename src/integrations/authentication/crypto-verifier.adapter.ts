import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

import type { OneTimeVerifierPort } from "../../modules/authentication/domain/authentication.ports.js";

export class CryptoVerifierAdapter implements OneTimeVerifierPort {
  constructor(private readonly secret: string) {}

  randomOtp(): string { return randomInt(0, 1_000_000).toString().padStart(6, '0'); }
  randomSecret(bytes = 32): string { return randomBytes(bytes).toString('base64url'); }
  verifyOtp(challengeId: string, purpose: string, code: string): string { return this.hmac(`otp:${challengeId}:${purpose}:${code}`); }
  verifyReset(challengeId: string, secret: string): string { return this.hmac(`reset:${challengeId}:${secret}`); }
  verifyRefresh(sessionId: string, token: string): string { return this.hmac(`refresh:${sessionId}:${token}`); }
  hashDestination(channel: string, destination: string): string { return this.hmac(`destination:${channel}:${destination}`); }
  equals(left: string, right: string): boolean {
    if (left.length !== right.length) return false;
    return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
  }
  private hmac(value: string): string { return createHmac('sha256', this.secret).update(value).digest('hex'); }
}
