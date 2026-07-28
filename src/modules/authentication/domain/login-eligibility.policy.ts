import { authenticationError } from './authentication.errors.js';
import type { IdentityState, SessionCapability } from './authentication.types.js';

export function loginCapability(identity: IdentityState, _now = new Date()): SessionCapability {
  if (identity.status === 'BANNED' || (identity.status === 'SUSPENDED' && (identity.suspendedUntil === null || identity.suspendedUntil > _now))) {
    throw authenticationError('AUTHENTICATION_FAILED');
  }
  return identity.verifiedCategories.length > 0 ? 'FULL' : 'VERIFICATION_ONLY';
}
