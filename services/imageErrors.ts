export interface ImageErrorDetails {
  message?: string;
  name?: string;
  errorType?: string;
  canRetry?: boolean;
  retryable?: boolean;
  fallbackEligible?: boolean;
  suggestedActions?: string[];
  cause?: unknown;
}

/** Provider and persistence failures may be thrown as arbitrary values. */
export function getImageErrorDetails(error: unknown): ImageErrorDetails {
  if (typeof error !== 'object' || error === null) return {};
  return {
    message: 'message' in error && typeof error.message === 'string' ? error.message : undefined,
    name: 'name' in error && typeof error.name === 'string' ? error.name : undefined,
    errorType: 'errorType' in error && typeof error.errorType === 'string' ? error.errorType : undefined,
    canRetry: 'canRetry' in error && typeof error.canRetry === 'boolean' ? error.canRetry : undefined,
    retryable: 'retryable' in error && typeof error.retryable === 'boolean' ? error.retryable : undefined,
    fallbackEligible: 'fallbackEligible' in error && typeof error.fallbackEligible === 'boolean' ? error.fallbackEligible : undefined,
    suggestedActions: 'suggestedActions' in error && Array.isArray(error.suggestedActions)
      ? error.suggestedActions.filter((action): action is string => typeof action === 'string')
      : undefined,
    cause: 'cause' in error ? error.cause : undefined,
  };
}
