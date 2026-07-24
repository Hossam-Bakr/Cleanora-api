import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @desc Add a safe correlation ID to each HTTP request and response.
 * @access Public
 * @explanation This middleware accepts a valid UUID or creates a new one so
 * logs, errors, and clients can trace the same request.
 */
export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction
): void {
  const candidate = request.header("x-request-id");
  request.requestId =
    candidate !== undefined && UUID_PATTERN.test(candidate)
      ? candidate
      : randomUUID();
  response.setHeader("x-request-id", request.requestId);
  next();
}
