import { blockingVerificationChannel } from './verification.policy.js';
import type { AccountCategory, AuthDeliveryChannel } from './authentication.types.js';

export const RESET_TTL_SECONDS = 1_800;
export const RESET_MAX_ATTEMPTS = 5;

export function recoveryChannel(category: AccountCategory): AuthDeliveryChannel {
  return blockingVerificationChannel(category);
}
