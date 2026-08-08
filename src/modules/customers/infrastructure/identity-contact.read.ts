import type { ContactStateView } from "../domain/customers.types.js";

/** Narrow Authentication-owned identity fact reader; it never writes identity state. */
export interface AuthenticationContactReader {
  readContactFacts(userId: string): Promise<{
    readonly phoneE164: string | null;
    readonly emailNormalized: string | null;
    readonly phoneVerifiedAt: Date | null;
    readonly emailVerifiedAt: Date | null;
  }>;
}

export class IdentityContactRead {
  public constructor(private readonly authentication: AuthenticationContactReader) {}

  public async read(userId: string): Promise<ContactStateView> {
    const identity = await this.authentication.readContactFacts(userId);
    return {
      phone: {
        value: identity.phoneE164,
        verified: identity.phoneE164 !== null && identity.phoneVerifiedAt !== null,
      },
      email: {
        value: identity.emailNormalized,
        verified: identity.emailNormalized !== null && identity.emailVerifiedAt !== null,
      },
    };
  }
}
