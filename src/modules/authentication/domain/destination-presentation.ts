/** Mask a phone so delivery receipts and API responses never echo the full value. */
export function maskPhoneDestination(phone: string): string {
  if (phone.length <= 6) return `***${phone.slice(-2)}`;
  return `${phone.slice(0, 3)}${"*".repeat(Math.max(4, phone.length - 7))}${phone.slice(-4)}`;
}

/** Mask an email local-part while keeping a recognizable domain fragment. */
export function maskEmailDestination(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visibleLocal =
    local.length <= 2 ? `${local[0] ?? "*"}*` : `${local.slice(0, 2)}***`;
  const dot = domain.lastIndexOf(".");
  if (dot <= 0) return `${visibleLocal}@***`;
  return `${visibleLocal}@***${domain.slice(dot)}`;
}

/** Render a short UTC expiry line for human-facing delivery messages. */
export function formatDeliveryExpiry(expiresAt: Date): string {
  return `${expiresAt.toISOString()} (UTC)`;
}
