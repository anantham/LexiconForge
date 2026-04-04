/**
 * Default API Key Service
 *
 * Provides a fallback OpenRouter API key for new users to try the app
 * Tracks usage and limits to 10 free translation requests per day
 */

const DEFAULT_API_KEY_USAGE_KEY = 'LF_DEFAULT_API_KEY_USAGE';
const DEFAULT_API_KEY_DATE_KEY = 'LF_DEFAULT_API_KEY_DATE';
const MAX_DEFAULT_KEY_USES = 10;

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10); // "2026-04-01"
}

/**
 * Reset counter if the stored date is not today
 */
function resetIfNewDay(): void {
  try {
    const storedDate = localStorage.getItem(DEFAULT_API_KEY_DATE_KEY);
    if (storedDate !== getTodayString()) {
      localStorage.setItem(DEFAULT_API_KEY_USAGE_KEY, '0');
      localStorage.setItem(DEFAULT_API_KEY_DATE_KEY, getTodayString());
    }
  } catch {}
}

export interface DefaultKeyStatus {
  isUsingDefault: boolean;
  usageCount: number;
  remainingUses: number;
  hasExceeded: boolean;
}

/**
 * Get current usage count for default API key (resets daily)
 */
export function getDefaultKeyUsage(): number {
  resetIfNewDay();
  try {
    const stored = localStorage.getItem(DEFAULT_API_KEY_USAGE_KEY);
    return stored ? parseInt(stored, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Increment usage count for default API key
 */
export function incrementDefaultKeyUsage(): number {
  resetIfNewDay();
  try {
    const current = getDefaultKeyUsage();
    const newCount = current + 1;
    localStorage.setItem(DEFAULT_API_KEY_USAGE_KEY, String(newCount));
    return newCount;
  } catch {
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
    localStorage.removeItem(DEFAULT_API_KEY_DATE_KEY);
  } catch {}
}

/**
 * Get the default OpenRouter API key (if available and under limit)
 * Returns null if limit exceeded or key not available
 */
export function getDefaultApiKey(): string | null {
  if (!canUseDefaultKey()) {
    return null;
  }

  const defaultKey = import.meta.env.VITE_DEFAULT_OPENROUTER_KEY;
  if (!defaultKey) {
    return null;
  }

  return defaultKey;
}
