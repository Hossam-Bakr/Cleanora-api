export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogContext = Readonly<Record<string, unknown>>;

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  child(context: LogContext): Logger;
}

export interface LogSink {
  write(line: string): void;
}

const REDACTED = "[REDACTED]";
const SENSITIVE_KEY =
  /(password|passcode|token|credential|verifier|jwt|api[_-]?key|email|phone|otp|secret|authorization|cookie|payment[_-]?payload)/iu;
const LEVEL_VALUE: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function sanitizeValue(
  value: unknown,
  visited: WeakSet<object>,
): unknown {
  if (typeof value !== "object" || value === null) {
    return value;
  }

  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (visited.has(value)) {
    return "[Circular]";
  }
  visited.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, visited));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    sanitized[key] = SENSITIVE_KEY.test(key)
      ? REDACTED
      : sanitizeValue(item, visited);
  }
  return sanitized;
}

/** Remove credentials and personal authentication data before logging. */
export function sanitizeLogContext(context: LogContext): LogContext {
  return sanitizeValue(context, new WeakSet<object>()) as LogContext;
}

/** Write the log line to the standard output. */
function defaultSink(line: string): void {
  process.stdout.write(`${line}\n`);
}

class ApplicationLogger implements Logger {
  constructor(
    private readonly level: LogLevel,
    private readonly baseContext: LogContext,
    private readonly sink: LogSink,
  ) {}

  debug(message: string, context: LogContext = {}): void {
    this.log("debug", message, context);
  }

  info(message: string, context: LogContext = {}): void {
    this.log("info", message, context);
  }

  warn(message: string, context: LogContext = {}): void {
    this.log("warn", message, context);
  }

  error(message: string, context: LogContext = {}): void {
    this.log("error", message, context);
  }

  child(context: LogContext): Logger {
    return new ApplicationLogger(
      this.level,
      { ...this.baseContext, ...sanitizeLogContext(context) },
      this.sink,
    );
  }

  private log(level: LogLevel, message: string, context: LogContext): void {
    if (LEVEL_VALUE[level] < LEVEL_VALUE[this.level]) {
      return;
    }

    this.sink.write(
      JSON.stringify({
        level,
        time: new Date().toISOString(),
        ...sanitizeLogContext(this.baseContext),
        ...sanitizeLogContext(context),
        message,
      }),
    );
  }
}

/**
 * Create the small application logger used for startup, shutdown and provider
 * failures. Morgan remains the only HTTP access logger.
 */
export function createApplicationLogger(
  level: LogLevel,
  baseContext: LogContext = {},
  sink: LogSink = { write: defaultSink },
): Logger {
  return new ApplicationLogger(level, sanitizeLogContext(baseContext), sink);
}
