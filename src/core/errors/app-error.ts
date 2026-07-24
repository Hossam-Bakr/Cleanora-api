export interface AppErrorOptions {
  readonly code: string;
  readonly message: string;
  readonly statusCode?: number;
  readonly expose?: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly cause?: unknown;
}

export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly expose: boolean;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  /**
   * @desc Create one safe application error.
   * @access Internal error contract
   * @explanation This error carries a stable code and safe exposure policy
   * while preserving the original cause for internal logging.
   */
  constructor(options: AppErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "AppError";
    this.code = options.code;
    this.statusCode = options.statusCode ?? 500;
    this.expose = options.expose ?? this.statusCode < 500;
    this.details = options.details;
  }
}
