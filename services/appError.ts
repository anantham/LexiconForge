export interface AppErrorOptions {
  code: string;
  userMessage: string;
  developerMessage?: string;
  diagnostics?: string;
  retryable?: boolean;
  cause?: unknown;
  details?: Record<string, unknown>;
}

export class AppError extends Error {
  readonly code: string;
  readonly userMessage: string;
  readonly developerMessage?: string;
  readonly diagnostics?: string;
  readonly retryable: boolean;
  readonly cause?: unknown;
  readonly details?: Record<string, unknown>;

  constructor(options: AppErrorOptions) {
    super(options.developerMessage ?? options.userMessage);
    this.name = 'AppError';
    this.code = options.code;
    this.userMessage = options.userMessage;
    this.developerMessage = options.developerMessage;
    this.diagnostics = options.diagnostics;
    this.retryable = options.retryable ?? false;
    this.cause = options.cause;
    this.details = options.details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function getUserMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  if (isAppError(error)) {
    return error.userMessage;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  return fallback;
}
