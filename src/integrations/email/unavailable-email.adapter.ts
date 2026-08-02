import type { EmailMessage, EmailPort } from '#integrations/email/email.types';
import { authenticationError } from "../../modules/authentication/domain/authentication.errors.js";

/** Fail closed when no approved email transport has been composed. */
export class UnavailableEmailAdapter implements EmailPort {
  async send(_message: EmailMessage): Promise<void> {
    throw authenticationError("AUTH_PROVIDER_UNAVAILABLE");
  }
}
