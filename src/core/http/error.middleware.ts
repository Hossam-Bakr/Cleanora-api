import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import { AppError } from "#core/errors/app-error";
import type { Logger } from "#core/logging/logger";

import { createFailureResponse } from "./api-response.js";

function mapValidationError(error: ZodError): AppError {
  return new AppError({
    code: "REQUEST_VALIDATION_FAILED",
    message: "Request validation failed",
    statusCode: 400,
    expose: true,
    details: {
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        code: issue.code,
        message: issue.message
      }))
    }
  });
}

/**
 * @desc Convert application errors into the standard API error response.
 * @access Internal middleware
 * @explanation This middleware returns safe validation, connection, and
 * unexpected errors without exposing stack traces or private values.
 */
export function createErrorMiddleware(logger: Logger): ErrorRequestHandler {
  return (error, request, response, _next): void => {
    const appError =
      error instanceof AppError
        ? error
        : error instanceof ZodError
          ? mapValidationError(error)
          : new AppError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Unexpected application error",
              cause: error
            });

    logger.error(appError.message, {
      requestId: request.requestId,
      code: appError.code,
      statusCode: appError.statusCode,
      errorName: appError.name
    });

    response.status(appError.statusCode).json(
      createFailureResponse(request, {
        code: appError.code,
        message: appError.expose ? appError.message : "Internal server error",
        ...(appError.expose && appError.details !== undefined
          ? { details: appError.details }
          : {})
      })
    );
  };
}
