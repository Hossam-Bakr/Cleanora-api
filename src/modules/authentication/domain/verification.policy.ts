import type { AccountCategory, AuthDeliveryChannel } from './authentication.types.js';

export const OTP_TTL_SECONDS = 600;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_SECONDS = 60;

export function blockingVerificationChannel(category: AccountCategory): AuthDeliveryChannel {
  void category;
  return 'EMAIL';
}
