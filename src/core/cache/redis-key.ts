const SEGMENT_PATTERN = /^[a-z0-9][a-z0-9:_-]*$/;

/**
 * @desc Create one namespaced Redis key.
 * @access Internal cache helper
 * @explanation This function prevents mixed-case or unsafe segments and keeps
 * every application key inside the cleanora namespace.
 */
export function createRedisKey(
  namespace: string,
  ...segments: readonly string[]
): string {
  const allSegments = [namespace, ...segments];

  if (allSegments.some((segment) => !SEGMENT_PATTERN.test(segment))) {
    throw new Error("Redis key segments must be lowercase and namespaced");
  }

  return `cleanora:${allSegments.join(":")}`;
}
