import type { Request, Response } from "express";

export interface ApiMeta {
  readonly [key: string]: unknown;
}

export interface ApiSuccess<TData> {
  readonly success: true;
  readonly data: TData;
  readonly requestId: string;
  readonly meta?: ApiMeta;
}

export interface ApiFailure {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly statusCode: number;
    readonly message: string;
    readonly details?: Readonly<Record<string, unknown>>;
  };
  readonly requestId: string;
}

/**
 * @desc Send one standard successful API response.
 * @access Internal HTTP helper
 * @explanation This helper keeps every successful response predictable for
 * frontend, Postman, tests, and API documentation.
 */
export function sendSuccess<TData>(
  request: Request,
  response: Response,
  statusCode: number,
  data: TData,
  meta?: ApiMeta
): Response<ApiSuccess<TData>> {
  return response.status(statusCode).json({
    success: true,
    data,
    requestId: request.requestId,
    ...(meta === undefined ? {} : { meta })
  });
}

/**
 * @desc Create one standard failed API response body.
 * @access Internal HTTP helper
 * @explanation This helper prevents error handlers and middleware from
 * returning different response shapes.
 */
export function createFailureResponse(
  request: Request,
  error: ApiFailure["error"]
): ApiFailure {
  return {
    success: false,
    error,
    requestId: request.requestId
  };
}
