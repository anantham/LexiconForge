/**
 * Version Formatting Utilities
 *
 * Extracted from SessionInfo.tsx to make version display logic
 * testable and reusable across components.
 */

import { MODEL_ABBREVIATIONS } from '../config/constants';

export interface TranslationVersion {
  id: string;
  version: number;
  isActive?: boolean;
  model?: string;
  createdAt?: string;
  customVersionLabel?: string;
}

/**
 * Get abbreviated model name for display.
 * Returns "Unknown" for undefined/null/unknown models.
 *
 * NOTE: "Unknown" indicates a data integrity issue - the model should
 * always be set when storing translations. Run the model field repair
 * migration to fix legacy data.
 */
export function getModelAbbreviation(model?: string | null): string {
  if (!model || model === 'unknown') {
    // Log warning in development to help identify data issues
    if (typeof console !== 'undefined' && process.env.NODE_ENV !== 'production') {
      console.warn(
        '[versionFormatting] Missing model field detected. ' +
        'This indicates legacy data or a pipeline bug. ' +
        'Run ensureModelFieldsRepaired() to fix.'
      );
    }
    return 'Unknown';
  }
  return MODEL_ABBREVIATIONS[model] || model;
}

/**
 * Format version timestamp for display.
 * Returns empty string if no timestamp provided.
 */
export function formatVersionTimestamp(
  createdAt?: string,
  options?: { long?: boolean }
): string {
  if (!createdAt) return '';

  try {
    const date = new Date(createdAt);
    if (isNaN(date.getTime())) return '';

    if (options?.long) {
      return date.toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }

    return date.toLocaleString(undefined, {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

/**
 * Format a complete version label for dropdown/select display.
 * Example: "v1 — gpt-4o • 15 Jan 2025, 3:30 pm"
 * Example with custom label: "v1 — gpt-4o • 15 Jan 2025, 3:30 pm • Edited by human"
 */
export function formatVersionLabel(version: TranslationVersion): string {
  const abbr = getModelAbbreviation(version.model);
  const timestamp = formatVersionTimestamp(version.createdAt);

  const baseLabel = timestamp
    ? `v${version.version} — ${abbr} • ${timestamp}`
    : `v${version.version} — ${abbr}`;

  return version.customVersionLabel
    ? `${baseLabel} • ${version.customVersionLabel}`
    : baseLabel;
}

/**
 * Format a short version label for mobile/compact display.
 * Example: "v1 — gpt-4o"
 * Example with custom label: "v1 — gpt-4o • Edited"
 */
export function formatVersionLabelShort(version: TranslationVersion): string {
  const abbr = getModelAbbreviation(version.model);
  const base = `v${version.version} — ${abbr}`;
  return version.customVersionLabel
    ? `${base} • ${version.customVersionLabel}`
    : base;
}

/**
 * Format version label for mobile picker (with long timestamp).
 */
export function formatVersionLabelLong(version: TranslationVersion): {
  title: string;
  subtitle: string;
} {
  const abbr = getModelAbbreviation(version.model);
  const timestamp = formatVersionTimestamp(version.createdAt, { long: true });

  return {
    title: `v${version.version} — ${abbr}`,
    subtitle: timestamp,
  };
}
