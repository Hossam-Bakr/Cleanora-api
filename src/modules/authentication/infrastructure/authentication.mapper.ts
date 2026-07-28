import type { User } from '#generated/prisma/client';
import type { AccountCategory, IdentityState } from '../domain/authentication.types.js';

export function mapIdentity(user: User): IdentityState {
  return {
    id: user.id,
    phoneE164: user.phoneE164,
    emailNormalized: user.emailNormalized,
    accountCategories: user.accountCategories as AccountCategory[],
    verifiedCategories: user.verifiedCategories as AccountCategory[],
    status: user.status,
    suspendedUntil: user.suspendedUntil,
    phoneVerifiedAt: user.phoneVerifiedAt,
    emailVerifiedAt: user.emailVerifiedAt
  };
}
