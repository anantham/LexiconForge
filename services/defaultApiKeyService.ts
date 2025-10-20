/**
 * Default API Key Service
 *
 * Provides a fallback OpenRouter API key for new users to try the app
 * Tracks usage and limits to 10 free translation requests
 */

const DEFAULT_API_KEY_USAGE_KEY = 'LF_DEFAULT_API_KEY_USAGE';
const MAX_DEFAULT_KEY_USES = 10;

export interface DefaultKeyStatus {
  isUsingDefault: boolean;
  usageCount: number;
  remainingUses: number;
  hasExceeded: boolean;
}

/**
 * Get current usage count for default API key
 */
export function getDefaultKeyUsage(): number {
  try {
    const stored = localStorage.getItem(DEFAULT_API_KEY_USAGE_KEY);
    return stored ? parseInt(stored, 10) : 0;
  } catch (e) {
    console.warn('[DefaultKey] Failed to read usage count:', e);
    return 0;
  }
}

/**
 * Increment usage count for default API key
 */
export function incrementDefaultKeyUsage(): number {
  try {
    const current = getDefaultKeyUsage();
    const newCount = current + 1;
    localStorage.setItem(DEFAULT_API_KEY_USAGE_KEY, String(newCount));
    console.log(`[DefaultKey] Usage: ${newCount}/${MAX_DEFAULT_KEY_USES}`);
    return newCount;
  } catch (e) {
    console.warn('[DefaultKey] Failed to increment usage:', e);
    return getDefaultKeyUsage();
  }
}

/**
 * Check if default key can still be used
 */
export function canUseDefaultKey(): boolean {
  return getDefaultKeyUsage() < MAX_DEFAULT_KEY_USES;
}

/**
 * Get default key status
 */
export function getDefaultKeyStatus(): DefaultKeyStatus {
  const usageCount = getDefaultKeyUsage();
  return {
    isUsingDefault: false, // Will be set by caller
    usageCount,
    remainingUses: Math.max(0, MAX_DEFAULT_KEY_USES - usageCount),
    hasExceeded: usageCount >= MAX_DEFAULT_KEY_USES,
  };
}

/**
 * Reset usage count (for testing or if user adds their own key)
 */
export function resetDefaultKeyUsage(): void {
  try {
    localStorage.removeItem(DEFAULT_API_KEY_USAGE_KEY);
    console.log('[DefaultKey] Usage count reset');
  } catch (e) {
    console.warn('[DefaultKey] Failed to reset usage:', e);
  }
}

/**
 * Get the default OpenRouter API key (if available and under limit)
 * Returns null if limit exceeded or key not available
 */
export function getDefaultApiKey(): string | null {
  // Check if we've exceeded the limit
  if (!canUseDefaultKey()) {
    console.log('[DefaultKey] Trial limit exceeded. Usage:', getDefaultKeyUsage(), '/', MAX_DEFAULT_KEY_USES);
    return null;
  }

  // Get from environment variable
  const defaultKey = import.meta.env.VITE_DEFAULT_OPENROUTER_KEY;

  // Log detailed environment info for debugging production issues
  console.log('[DefaultKey] Environment check:', {
    hasDefaultKey: !!defaultKey,
    keyLength: defaultKey?.length || 0,
    keyPrefix: defaultKey ? `${defaultKey.slice(0, 8)}...` : 'none',
    usageCount: getDefaultKeyUsage(),
    remainingUses: MAX_DEFAULT_KEY_USES - getDefaultKeyUsage(),
    env: import.meta.env.MODE,
    isDev: import.meta.env.DEV,
    isProd: import.meta.env.PROD,
  });

  if (!defaultKey) {
    console.warn('[DefaultKey] VITE_DEFAULT_OPENROUTER_KEY not found in environment variables');
    console.warn('[DefaultKey] Make sure VITE_DEFAULT_OPENROUTER_KEY is set in Vercel environment variables');
    return null;
  }

  console.log('[DefaultKey] Providing trial key for request');
  return defaultKey;
}
