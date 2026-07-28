import type {
  LogContext,
  Logger
} from "../../src/core/logging/logger.js";

/** Capture the latest error context for database-contention diagnosis without printing secrets. */
export type CapturedTestLogError = {
  readonly message: string;
  readonly requestId?: string;
  readonly code?: string;
  readonly statusCode?: number;
  readonly errorName?: string;
  readonly causeName?: string;
  readonly causeCode?: string;
  readonly causeSafeMessage?: string;
};

export class TestLogger implements Logger {
  lastError: CapturedTestLogError | undefined;

  debug(_message: string, _context?: LogContext): void {}
  info(_message: string, _context?: LogContext): void {}
  warn(_message: string, _context?: LogContext): void {}
  error(message: string, context?: LogContext): void {
    const captured: {
      message: string;
      requestId?: string;
      code?: string;
      statusCode?: number;
      errorName?: string;
      causeName?: string;
      causeCode?: string;
      causeSafeMessage?: string;
    } = { message };
    if (typeof context?.["requestId"] === "string") {
      captured.requestId = context["requestId"];
    }
    if (typeof context?.["code"] === "string") {
      captured.code = context["code"];
    }
    if (typeof context?.["statusCode"] === "number") {
      captured.statusCode = context["statusCode"];
    }
    if (typeof context?.["errorName"] === "string") {
      captured.errorName = context["errorName"];
    }
    if (typeof context?.["causeName"] === "string") {
      captured.causeName = context["causeName"];
    }
    if (typeof context?.["causeCode"] === "string") {
      captured.causeCode = context["causeCode"];
    }
    if (typeof context?.["causeSafeMessage"] === "string") {
      captured.causeSafeMessage = context["causeSafeMessage"];
    }
    this.lastError = captured;
  }

  child(_context: LogContext): Logger {
    return this;
  }
}
