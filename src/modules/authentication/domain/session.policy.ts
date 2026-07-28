export const ACCESS_TOKEN_TTL_SECONDS = 900;
export const REFRESH_TOKEN_TTL_SECONDS = 2_592_000;

export function isSessionActive(
  session: { readonly expiresAt: Date; readonly revokedAt: Date | null },
  now = new Date()
): boolean {
  return session.revokedAt === null && session.expiresAt > now;
}
