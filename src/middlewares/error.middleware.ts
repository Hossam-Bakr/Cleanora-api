import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import { AppError } from "#shared/errors/app-error";
import type { Logger } from "#shared/logger";

import { createFailureResponse } from "#shared/http/api-response";

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

/** Extract only non-secret cause metadata for operators and test diagnosis. */
function describeSafeCause(cause: unknown): Readonly<Record<string, string>> {
  if (!(cause instanceof Error)) {
    return {};
  }

  const record: Record<string, string> = { causeName: cause.name };
  if ("code" in cause && typeof cause.code === "string") {
    record["causeCode"] = cause.code;
  }

  // Prisma interactive-transaction maxWait exhaustion — safe fixed phrase only.
  if (cause.message.includes("Unable to start a transaction in the given time")) {
    record["causeSafeMessage"] = "Unable to start a transaction in the given time";
  }

  return record;
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
      errorName: appError.name,
      ...describeSafeCause(appError.cause)
    });

    response.status(appError.statusCode).json(
      createFailureResponse(request, {
        code: appError.code,
        statusCode: appError.statusCode,
        message: appError.expose ? appError.message : "Internal server error",
        ...(appError.expose && appError.details !== undefined
          ? { details: appError.details }
          : {})
      })
    );
  };
}
