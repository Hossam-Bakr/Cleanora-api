import type { AuthenticationDelivery, EmailAuthenticationDeliveryPort, SmsAuthenticationDeliveryPort } from '../../../src/modules/authentication/index.js';

export interface DeliveredAuthenticationValue extends AuthenticationDelivery {
  readonly channel: 'SMS' | 'EMAIL';
}

/** Test-only inbox retaining raw challenge values inside one test process. */
export class DeterministicAuthenticationInbox implements SmsAuthenticationDeliveryPort, EmailAuthenticationDeliveryPort {
  private readonly messages: DeliveredAuthenticationValue[] = [];
  private nextFailure: Error | undefined;

  constructor(private readonly channel: 'SMS' | 'EMAIL') {}

  async send(message: AuthenticationDelivery): Promise<void> {
    if (this.nextFailure !== undefined) {
      const failure = this.nextFailure;
      this.nextFailure = undefined;
      throw failure;
    }
    this.messages.push({ ...message, channel: this.channel });
  }

  latest(destination?: string): DeliveredAuthenticationValue | undefined {
    return [...this.messages].reverse().find(
      (message) =>
        destination === undefined ||
        message.destination === destination ||
        message.temporaryEmailDeliveryAddress === destination,
    );
  }

  all(): readonly DeliveredAuthenticationValue[] { return [...this.messages]; }
  failNext(error = new Error('TEST_DELIVERY_FAILED')): void { this.nextFailure = error; }
  reset(): void { this.messages.length = 0; this.nextFailure = undefined; }
}
