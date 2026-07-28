import type { GoogleIdentity, GoogleIdentityPort, GoogleTransaction } from '../../../src/modules/authentication/index.js';

export class DeterministicGoogleAdapter implements GoogleIdentityPort {
  private result: GoogleIdentity = { subject: 'google-test-subject', email: 'individual@example.test', emailVerified: true };
  program(result: GoogleIdentity): void { this.result = result; }
  async createAuthorizationUrl(transaction: GoogleTransaction): Promise<string> { return `https://google.test/authorize?state=${transaction.state}`; }
  async consumeCallback(_url: string, _transaction: GoogleTransaction): Promise<GoogleIdentity> { return this.result; }
}
