import type { EmailMessage, EmailPort } from '#core/email/index';
import { authenticationProviderUnavailableError } from '#modules/authentication';

/** Fail closed when no approved email transport has been composed. */
export class UnavailableEmailAdapter implements EmailPort {
  async send(_message: EmailMessage): Promise<void> {
    throw authenticationProviderUnavailableError();
  }
}
