export interface RateLimitKey {
  readonly scope: string;
  readonly subject: string;
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly retryAfterSeconds?: number;
}

export interface RateLimiterPort {
  consume(key: RateLimitKey, limit: number, windowSeconds: number): Promise<RateLimitDecision>;
}
