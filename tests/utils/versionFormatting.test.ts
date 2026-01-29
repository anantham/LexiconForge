/**
 * Version Formatting Utility Tests
 */

import { describe, it, expect } from 'vitest';
import {
  getModelAbbreviation,
  formatVersionTimestamp,
  formatVersionLabel,
  formatVersionLabelShort,
  formatVersionLabelLong,
  type TranslationVersion,
} from '../../utils/versionFormatting';

describe('versionFormatting', () => {
  describe('getModelAbbreviation', () => {
    it('returns abbreviation for known models', () => {
      expect(getModelAbbreviation('gpt-4o')).toBe('gpt-4o');
      expect(getModelAbbreviation('gemini-2.5-flash')).toBe('G2.5-F');
    });

    it('returns "Unknown" for undefined model', () => {
      expect(getModelAbbreviation(undefined)).toBe('Unknown');
      expect(getModelAbbreviation(null)).toBe('Unknown');
    });

    it('returns "Unknown" for "unknown" string', () => {
      expect(getModelAbbreviation('unknown')).toBe('Unknown');
    });

    it('returns model name if no abbreviation exists', () => {
      expect(getModelAbbreviation('some-new-model')).toBe('some-new-model');
    });
  });

  describe('formatVersionTimestamp', () => {
    it('returns empty string for undefined', () => {
      expect(formatVersionTimestamp(undefined)).toBe('');
    });

    it('returns empty string for invalid date', () => {
      expect(formatVersionTimestamp('not-a-date')).toBe('');
    });

    it('formats valid date', () => {
      const result = formatVersionTimestamp('2025-01-15T10:00:00Z');
      // Should contain month and year at minimum
      expect(result).toMatch(/Jan/);
      expect(result).toMatch(/2025/);
    });

    it('formats long timestamp with weekday', () => {
      const result = formatVersionTimestamp('2025-01-15T10:00:00Z', { long: true });
      // Long format includes weekday
      expect(result).toMatch(/Jan/);
      expect(result).toMatch(/2025/);
    });
  });

  describe('formatVersionLabel', () => {
    it('formats version with model and timestamp', () => {
      const version: TranslationVersion = {
        id: 'v1',
        version: 1,
        model: 'gpt-4o',
        createdAt: '2025-01-15T10:00:00Z',
      };

      const result = formatVersionLabel(version);
      expect(result).toContain('v1');
      expect(result).toContain('gpt-4o');
      expect(result).toContain('Jan');
    });

    it('handles missing timestamp', () => {
      const version: TranslationVersion = {
        id: 'v1',
        version: 1,
        model: 'gpt-4o',
      };

      const result = formatVersionLabel(version);
      expect(result).toBe('v1 — gpt-4o');
    });

    it('handles undefined model', () => {
      const version: TranslationVersion = {
        id: 'v1',
        version: 1,
        model: undefined,
        createdAt: '2025-01-15T10:00:00Z',
      };

      const result = formatVersionLabel(version);
      expect(result).toContain('Unknown');
    });

    it('includes custom version label when present', () => {
      const version: TranslationVersion = {
        id: 'v1',
        version: 1,
        model: 'gpt-4o',
        createdAt: '2025-01-15T10:00:00Z',
        customVersionLabel: 'Edited by human',
      };

      const result = formatVersionLabel(version);
      expect(result).toContain('Edited by human');
    });
  });

  describe('formatVersionLabelShort', () => {
    it('returns compact label without timestamp', () => {
      const version: TranslationVersion = {
        id: 'v1',
        version: 1,
        model: 'gpt-4o',
        createdAt: '2025-01-15T10:00:00Z',
      };

      const result = formatVersionLabelShort(version);
      expect(result).toBe('v1 — gpt-4o');
      expect(result).not.toContain('Jan');
    });

    it('includes custom label in short format', () => {
      const version: TranslationVersion = {
        id: 'v1',
        version: 1,
        model: 'gpt-4o',
        customVersionLabel: 'Edited',
      };

      const result = formatVersionLabelShort(version);
      expect(result).toBe('v1 — gpt-4o • Edited');
    });
  });

  describe('formatVersionLabelLong', () => {
    it('returns title and subtitle separately', () => {
      const version: TranslationVersion = {
        id: 'v1',
        version: 1,
        model: 'gpt-4o',
        createdAt: '2025-01-15T10:00:00Z',
      };

      const result = formatVersionLabelLong(version);
      expect(result.title).toBe('v1 — gpt-4o');
      expect(result.subtitle).toMatch(/Jan/);
    });

    it('returns empty subtitle for missing timestamp', () => {
      const version: TranslationVersion = {
        id: 'v1',
        version: 1,
        model: 'gpt-4o',
      };

      const result = formatVersionLabelLong(version);
      expect(result.title).toBe('v1 — gpt-4o');
      expect(result.subtitle).toBe('');
    });
  });
});
