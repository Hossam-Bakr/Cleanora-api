import type { RequestHandler } from "express";

import type { RateLimiterPort } from "./rate-limit.port.js";
import { createFailureResponse } from "#core/http/api-response";

export interface RateLimitMiddlewareOptions {
  readonly limiter: RateLimiterPort;
  readonly scope: string;
  readonly limit: number;
  readonly windowSeconds: number;
  subject(requestIp: string | undefined): string;
}

/**
 * @desc Enforce one explicitly approved endpoint rate-limit policy.
 * @access Internal middleware
 * @explanation Every caller must provide the limit and time window so the
 * application never activates an unapproved global default.
 */
export function createRateLimitMiddleware(
  options: RateLimitMiddlewareOptions
): RequestHandler {
  return async (request, response, next): Promise<void> => {
    try {
      const decision = await options.limiter.consume(
        {
          scope: options.scope,
          subject: options.subject(request.ip)
        },
        options.limit,
        options.windowSeconds
      );

      response.setHeader("ratelimit-remaining", decision.remaining);

      if (!decision.allowed) {
        if (decision.retryAfterSeconds !== undefined) {
          response.setHeader("retry-after", decision.retryAfterSeconds);
        }

        response.status(429).json(
          createFailureResponse(request, {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many requests"
          })
        );
        return;
      }

      next();
    } catch (error: unknown) {
      response.status(503).json(
        createFailureResponse(request, {
          code: "RATE_LIMITER_UNAVAILABLE",
          message: "Rate limiter is unavailable"
        })
      );
    }
  };
}
