import type { RequestHandler } from "express";
const morgan = require("morgan") as typeof import("morgan");

export interface HttpLogStream {
  write(line: string): void;
}

const SENSITIVE_PATH_MARKER = /^(?:authorization|cookie|credential|email|otp|password|phone|proof|secret|storage.?key|token)$/iu;
const ENCODED_CONTROL = /%(?:0a|0d|00)/giu;

/**
 * Return a bounded path safe for access logs. Query/fragment values never enter
 * the result, control characters are removed, and a value following a
 * secret-named path segment is replaced without attempting risky URL decoding.
 */
export function sanitizeHttpLogUrl(value: string | undefined): string {
  const withoutQuery = (value ?? "/").split(/[?#]/u, 1)[0] ?? "/";
  const withoutControls = [...withoutQuery]
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint > 31 && codePoint !== 127;
    })
    .join("")
    .replace(ENCODED_CONTROL, "[REDACTED]");
  const segments = withoutControls.split("/");
  const safeSegments = segments.map((segment, index) =>
    index > 0 && SENSITIVE_PATH_MARKER.test(segments[index - 1] ?? "")
      ? "[REDACTED]"
      : segment,
  );
  const safe = safeSegments.join("/").slice(0, 2_048);
  return safe.startsWith("/") && safe.length > 0 ? safe : "/";
}

// add safe-url token
morgan.token("safe-url", (request) => {
  const expressRequest = request as typeof request & {
    readonly originalUrl?: string;
  };
  return sanitizeHttpLogUrl(expressRequest.originalUrl ?? request.url);
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
