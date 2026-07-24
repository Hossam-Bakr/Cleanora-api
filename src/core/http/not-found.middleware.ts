import type { NextFunction, Request, Response } from "express";

import { AppError } from "#core/errors/app-error";

/**
 * @desc Report an API route that does not exist.
 * @access Public
 * @explanation This middleware creates a safe 404 error after every approved
 * route had a chance to handle the request.
 */
export function notFoundMiddleware(
  request: Request,
  _response: Response,
  next: NextFunction
): void {
  next(
    new AppError({
      code: "HTTP_ROUTE_NOT_FOUND",
      message: `Route ${request.method} ${request.path} was not found`,
      statusCode: 404,
      expose: true
    })
  );
}
