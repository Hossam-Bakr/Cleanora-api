import type { IncomingMessage, ServerResponse } from "node:http";

import type { RequestHandler } from "express";
import type {
  DestinationStream,
  Logger as PinoInstance
} from "pino";

import type {
  LogContext,
  Logger,
  LogLevel
} from "#core/logging/logger";

const pino = require("pino") as typeof import("pino");
const pinoHttp = require("pino-http") as typeof import("pino-http").default;

const REDACTED_PATHS = [
  "password",
  "token",
  "credential",
  "apiKey",
  "api_key",
  "email",
  "phone",
  "otp",
  "secret",
  "authorization",
  "cookie",
  "paymentPayload",
  "*.password",
  "*.token",
  "*.credential",
  "*.apiKey",
  "*.api_key",
  "*.email",
  "*.phone",
  "*.otp",
  "*.secret",
  "*.authorization",
  "*.cookie",
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers.set-cookie"
] as const;

export interface PinoLogging {
  readonly logger: Logger;
  readonly requestLogger: RequestHandler;
}

class PinoLoggerAdapter implements Logger {
  constructor(private readonly instance: PinoInstance) {}

  debug(message: string, context: LogContext = {}): void {
    this.instance.debug(context, message);
  }

  info(message: string, context: LogContext = {}): void {
    this.instance.info(context, message);
  }

  warn(message: string, context: LogContext = {}): void {
    this.instance.warn(context, message);
  }

  error(message: string, context: LogContext = {}): void {
    this.instance.error(context, message);
  }

  child(context: LogContext): Logger {
    return new PinoLoggerAdapter(this.instance.child(context));
  }
}

function readRequestId(request: IncomingMessage): string | undefined {
  const expressRequest = request as IncomingMessage & {
    readonly requestId?: string;
  };
  const header = request.headers["x-request-id"];

  return (
    expressRequest.requestId ??
    (Array.isArray(header) ? header[0] : header)
  );
}

function readSafePath(request: IncomingMessage): string | undefined {
  if (request.url === undefined) {
    return undefined;
  }

  try {
    return new URL(request.url, "http://cleanora.internal").pathname;
  } catch {
    return request.url.split("?")[0];
  }
}

/**
 * @desc Create application and HTTP request loggers.
 * @access Internal infrastructure only
 * @explanation This function configures Pino JSON logs, request correlation,
 * safe status-based levels, and secret redaction. Request bodies are not logged.
 */
export function createPinoLogging(
  level: LogLevel,
  baseContext: LogContext,
  destination?: DestinationStream
): PinoLogging {
  const rawLogger = pino(
    {
      level,
      base: baseContext,
      redact: {
        paths: [...REDACTED_PATHS],
        censor: "[REDACTED]"
      }
    },
    destination
  );

  const requestLogger = pinoHttp({
    logger: rawLogger,
    wrapSerializers: false,
    quietReqLogger: true,
    genReqId: (request: IncomingMessage) =>
      readRequestId(request) ?? "missing-request-id",
    serializers: {
      req(request: IncomingMessage) {
        return {
          requestId: readRequestId(request),
          method: request.method,
          path: readSafePath(request),
          remoteAddress: request.socket.remoteAddress
        };
      },
      res(response: ServerResponse) {
        return { statusCode: response.statusCode };
      }
    },
    customProps: (request: IncomingMessage) => ({
      requestId: readRequestId(request)
    }),
    customLogLevel: (
      _request: IncomingMessage,
      response: ServerResponse,
      error?: Error
    ) => {
      if (error !== undefined || response.statusCode >= 500) {
        return "error";
      }

      if (response.statusCode >= 400) {
        return "warn";
      }

      return "info";
    },
    customSuccessMessage: (request: IncomingMessage) =>
      `${request.method ?? "HTTP"} request completed`,
    customErrorMessage: (request: IncomingMessage) =>
      `${request.method ?? "HTTP"} request failed`
  });

  return {
    logger: new PinoLoggerAdapter(rawLogger),
    requestLogger
  };
}
