import type {
  LogContext,
  Logger
} from "../../src/core/logging/logger.js";

export class TestLogger implements Logger {
  debug(_message: string, _context?: LogContext): void {}
  info(_message: string, _context?: LogContext): void {}
  warn(_message: string, _context?: LogContext): void {}
  error(_message: string, _context?: LogContext): void {}

  child(_context: LogContext): Logger {
    return this;
  }
}
