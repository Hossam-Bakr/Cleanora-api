import type { RequestHandler } from "express";
import { z } from "zod";

import { AppError } from "#shared/errors/app-error";

export interface RequestValidationSchemas {
  readonly body?: z.ZodType;
  readonly params?: z.ZodType;
  readonly query?: z.ZodType;
}

function formatIssues(error: z.ZodError): ReadonlyArray<{
  readonly path: string;
  readonly code: string;
  readonly message: string;
}> {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    code: issue.code,
    message: issue.message
  }));
}

/**
 * @desc Validate request body, path parameters, and query values with Zod.
 * @access Internal HTTP middleware
 * @explanation This boundary rejects invalid client input before a route
 * handler can pass it to application code.
 */
export function validateRequest(
  schemas: RequestValidationSchemas
): RequestHandler {
  return (request, _response, next): void => {
    const results = [
      schemas.body?.safeParse(request.body),
      schemas.params?.safeParse(request.params),
      schemas.query?.safeParse(request.query)
    ];
    const issues = results.flatMap((result) =>
      result !== undefined && !result.success ? formatIssues(result.error) : []
    );

    if (issues.length > 0) {
      next(
        new AppError({
          code: "REQUEST_VALIDATION_FAILED",
          message: "Request validation failed",
          statusCode: 400,
          expose: true,
          details: { issues }
        })
      );
      return;
    }

    next();
  };
}
