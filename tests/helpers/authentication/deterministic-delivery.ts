import type {
  AuthenticationDelivery,
  EmailAuthenticationDeliveryPort,
} from '../../../src/modules/authentication/index.js';

export interface DeliveredAuthenticationValue extends AuthenticationDelivery {
  readonly channel: 'EMAIL';
}

/** Test-only inbox retaining raw challenge values inside one test process. */
export class DeterministicAuthenticationInbox implements EmailAuthenticationDeliveryPort {
  private readonly messages: DeliveredAuthenticationValue[] = [];
  private nextFailure: Error | undefined;

  async send(message: AuthenticationDelivery): Promise<void> {
    if (this.nextFailure !== undefined) {
      const failure = this.nextFailure;
      this.nextFailure = undefined;
      throw failure;
    }
    this.messages.push({ ...message, channel: 'EMAIL' });
  }

  latest(destination?: string): DeliveredAuthenticationValue | undefined {
    return [...this.messages].reverse().find(
      (message) =>
        destination === undefined ||
        message.destination === destination,
    );
  }

  all(): readonly DeliveredAuthenticationValue[] { return [...this.messages]; }
  failNext(error = new Error('TEST_DELIVERY_FAILED')): void { this.nextFailure = error; }
  reset(): void { this.messages.length = 0; this.nextFailure = undefined; }
}
