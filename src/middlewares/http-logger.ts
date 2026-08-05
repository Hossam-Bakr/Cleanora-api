import type { RequestHandler } from "express";
const morgan = require("morgan") as typeof import("morgan");

export interface HttpLogStream {
  write(line: string): void;
}
// add safe-url token
morgan.token("safe-url", (request) => {
  const expressRequest = request as typeof request & {
    readonly originalUrl?: string;
  };
  const url = expressRequest.originalUrl ?? request.url ?? "/";
  return url.split("?")[0] ?? "/";
});

// add request-id token
morgan.token("request-id", (request) => {
  const requestWithId = request as typeof request & {
    readonly requestId?: string;
  };
  return requestWithId.requestId ?? "-";
});

/**
 * Create the only HTTP access logger. Query strings, bodies, cookies and
 * authorization headers are intentionally excluded from every format.
 */
export function createHttpLogger(
  nodeEnvironment: "development" | "test" | "production",
  stream?: HttpLogStream,
): RequestHandler {
  if (nodeEnvironment === "test") {
    return (_request, _response, next): void => {
      next();
    };
  }

  const options = stream === undefined ? undefined : { stream };
  const format =
    nodeEnvironment === "development"
      ? ":method :safe-url :status :response-time ms [:request-id]"
      : ':remote-addr - :method :safe-url HTTP/:http-version :status :res[content-length] ":user-agent" :response-time ms [:request-id]';

  return morgan(format, options);
}
