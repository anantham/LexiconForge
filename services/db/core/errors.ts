/**
 * Database Error Handling - Hybrid Approach
 * 
 * Combines GPT-5's structured error taxonomy with Claude's domain context.
 * Maps browser IndexedDB errors to typed, actionable error categories.
 */

export type DbErrorKind =
  | 'Blocked'      // Another tab has DB open for upgrade
  | 'Upgrade'      // Version/schema upgrade needed
  | 'Quota'        // Storage quota exceeded
  | 'Transient'    // Temporary failure, safe to retry
  | 'NotFound'     // Record not found
  | 'Constraint'   // Unique constraint or validation error
  | 'Permission'   // Access denied (private browsing, etc.)
  | 'Timeout'      // Operation timed out
  | 'Version';     // DB version incompatible (newer than app)

export class DbError extends Error {
  constructor(
    public readonly kind: DbErrorKind,
    public readonly domain: string,    // e.g., 'chapters', 'translations'
    public readonly service: string,   // e.g., 'translationService', 'navigationService'
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'DbError';
  }

  get isRetryable(): boolean {
    return this.kind === 'Transient' || this.kind === 'Timeout';
  }

  get requiresUserAction(): boolean {
    return this.kind === 'Quota' || this.kind === 'Permission' || this.kind === 'Version';
  }
}

/**
 * Maps browser DOMException to our typed DbError
 */
export function mapDomError(
  error: unknown, 
  domain: string, 
  service: string,
  operation?: string
): DbError {
  const domError = error as any;
  const name = String(domError?.name ?? '');
  const message = String(domError?.message ?? error);
  
  // Map based on DOMException.name
  if (name.includes('QuotaExceededError') || message.includes('quota')) {
    return new DbError('Quota', domain, service, 
      `Storage quota exceeded in ${domain}`, error);
  }
  
  if (name.includes('VersionError') || name.includes('InvalidStateError')) {
    return new DbError('Upgrade', domain, service, 
      `Database version conflict in ${domain}`, error);
  }
  
  if (name.includes('AbortError')) {
    return new DbError('Transient', domain, service, 
      `Transaction aborted in ${domain}${operation ? `.${operation}` : ''}`, error);
  }
  
  if (name.includes('NotFoundError')) {
    return new DbError('NotFound', domain, service, 
      `Record not found in ${domain}`, error);
  }
  
  if (name.includes('ConstraintError')) {
    return new DbError('Constraint', domain, service, 
      `Constraint violation in ${domain}`, error);
  }
  
  if (name.includes('InvalidAccessError')) {
    return new DbError('Permission', domain, service, 
      `Database access denied - possibly private browsing`, error);
  }
  
  if (name.includes('TimeoutError')) {
    return new DbError('Timeout', domain, service, 
      `Operation timed out in ${domain}`, error);
  }
  
  if (name.includes('BlockedError')) {
    return new DbError('Blocked', domain, service, 
      `Database blocked by another connection`, error);
  }
  
  // Default to transient for unknown errors
  return new DbError('Transient', domain, service, 
    `Unknown database error in ${domain}: ${message}`, error);
}

/**
 * Retry policy for database operations
 */
export class RetryPolicy {
  private static readonly MAX_RETRIES = 3;
  private static readonly BASE_DELAY_MS = 100;
  private static readonly MAX_DELAY_MS = 1500;

  static async execute<T>(
    operation: () => Promise<T>,
    domain: string,
    service: string,
    operationName: string
  ): Promise<T> {
    let lastError: DbError;
    
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof DbError 
          ? error 
          : mapDomError(error, domain, service, operationName);
        
        // Don't retry non-retryable errors
        if (!lastError.isRetryable || attempt === this.MAX_RETRIES) {
          throw lastError;
        }
        
        // Exponential backoff
        const delay = Math.min(
          this.BASE_DELAY_MS * Math.pow(2, attempt),
          this.MAX_DELAY_MS
        );
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }
}