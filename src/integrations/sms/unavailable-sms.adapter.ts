import type { AuthenticationDelivery, SmsAuthenticationDeliveryPort } from '#modules/authentication';
import { authenticationProviderUnavailableError } from '#modules/authentication';

export class UnavailableSmsAdapter implements SmsAuthenticationDeliveryPort {
  async send(_message: AuthenticationDelivery): Promise<void> {
    throw authenticationProviderUnavailableError();
  }
}
