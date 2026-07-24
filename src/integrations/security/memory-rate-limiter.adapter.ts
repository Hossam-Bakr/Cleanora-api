import {
  RateLimiterMemory,
  RateLimiterRes
} from "rate-limiter-flexible";

import type {
  RateLimitDecision,
  RateLimitKey,
  RateLimiterPort
} from "#core/security/rate-limit.port";

interface MemoryLimiter {
  consume(key: string): Promise<{
    readonly remainingPoints: number;
  }>;
}

type MemoryLimiterFactory = (
  limit: number,
  windowSeconds: number,
  scope: string
) => MemoryLimiter;

function createLimiter(
  limit: number,
  windowSeconds: number,
  scope: string
): MemoryLimiter {
  return new RateLimiterMemory({
    points: limit,
    duration: windowSeconds,
    keyPrefix: `cleanora:${scope}`
  });
}

/**
 * @desc Enforce local rate-limit policies with process memory.
 * @access Infrastructure adapter
 * @explanation This adapter is suitable for single-process local and test
 * execution. Unexpected limiter failures are rethrown so HTTP callers fail
 * closed instead of silently allowing requests.
 */
export class MemoryRateLimiterAdapter implements RateLimiterPort {
  private readonly limiters = new Map<string, MemoryLimiter>();

  constructor(private readonly limiterFactory: MemoryLimiterFactory = createLimiter) {}

  async consume(
    key: RateLimitKey,
    limit: number,
    windowSeconds: number
  ): Promise<RateLimitDecision> {
    const limiter = this.getLimiter(key.scope, limit, windowSeconds);

    try {
      const result = await limiter.consume(key.subject);
      return {
        allowed: true,
        remaining: result.remainingPoints
      };
    } catch (error: unknown) {
      if (error instanceof RateLimiterRes) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(1, Math.ceil(error.msBeforeNext / 1_000))
        };
      }

      throw error;
    }
  }

  private getLimiter(
    scope: string,
    limit: number,
    windowSeconds: number
  ): MemoryLimiter {
    const cacheKey = `${scope}:${limit}:${windowSeconds}`;
    const existing = this.limiters.get(cacheKey);
    if (existing !== undefined) {
      return existing;
    }

    const limiter = this.limiterFactory(limit, windowSeconds, scope);
    this.limiters.set(cacheKey, limiter);
    return limiter;
  }
}
