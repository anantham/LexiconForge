import { describe, it, expect } from 'vitest';
import { __testUtils } from '../../services/aiService';

const {
  extractBalancedJson,
  validateAndFixIllustrations,
  validateAndFixFootnotes,
  validateAndClampParameter,
} = __testUtils;

describe('aiService internal utilities', () => {
  describe('extractBalancedJson', () => {
    it('returns the first balanced JSON object', () => {
      const text = 'noise {"key":{"inner":1,"list":[1,2,3]}} trailing';
      expect(extractBalancedJson(text)).toBe('{"key":{"inner":1,"list":[1,2,3]}}');
    });

    it('throws when no brace is present', () => {
      expect(() => extractBalancedJson('no json here')).toThrow(/No opening brace/);
    });

    it('throws when JSON is unbalanced', () => {
      expect(() => extractBalancedJson('{"missing": true')).toThrow(/unbalanced/i);
    });

    // Critical: Braces inside strings should NOT break brace matching
    // This was the exact bug that caused translations like {"translation": "<i>"} corruption
    it('handles braces inside string values correctly', () => {
      const text = '{"translation": "He said {hello} to her"}';
      expect(extractBalancedJson(text)).toBe('{"translation": "He said {hello} to her"}');
    });

    it('handles nested braces inside strings', () => {
      const text = '{"content": "function() { return { key: value }; }"}';
      expect(extractBalancedJson(text)).toBe('{"content": "function() { return { key: value }; }"}');
    });

    it('handles escaped quotes inside strings', () => {
      const text = '{"text": "She said \\"hello\\" to him"}';
      expect(extractBalancedJson(text)).toBe('{"text": "She said \\"hello\\" to him"}');
    });

    it('handles mixed braces, quotes and escapes', () => {
      const text = 'prefix {"translation": "Use {var} and \\"quotes\\" here"} suffix';
      expect(extractBalancedJson(text)).toBe('{"translation": "Use {var} and \\"quotes\\" here"}');
    });
  });

  describe('validateAndFixIllustrations', () => {
    it('returns original data when markers align', () => {
      const translation = 'Text before [ILLUSTRATION-1] text after.';
      const prompts = [{ placementMarker: '[ILLUSTRATION-1]', imagePrompt: 'scene' }];
      const result = validateAndFixIllustrations(translation, prompts);
      expect(result.translation).toBe(translation);
      expect(result.suggestedIllustrations).toEqual(prompts);
    });

    it('appends missing markers when JSON has extras', () => {
      const translation = 'Only text.';
      const prompts = [
        { placementMarker: '[ILLUSTRATION-1]', imagePrompt: 'one' },
        { placementMarker: '[ILLUSTRATION-2]', imagePrompt: 'two' },
      ];
      const result = validateAndFixIllustrations(translation, prompts);
      expect(result.translation.endsWith('[ILLUSTRATION-2]')).toBe(true);
      expect(result.suggestedIllustrations).toHaveLength(2);
    });

    it('remaps mismatched markers when counts match', () => {
      const translation = '[ILLUSTRATION-10] appears here.';
      const prompts = [{ placementMarker: '[ILLUSTRATION-2]', imagePrompt: 'two' }];
      const result = validateAndFixIllustrations(translation, prompts);
      expect(result.suggestedIllustrations[0].placementMarker).toBe('[ILLUSTRATION-10]');
    });

    it('throws when text markers outnumber prompts', () => {
      const translation = '[ILLUSTRATION-1] and [ILLUSTRATION-2]';
      const prompts = [{ placementMarker: '[ILLUSTRATION-1]', imagePrompt: 'one' }];
      expect(() => validateAndFixIllustrations(translation, prompts)).toThrow(/missing illustration prompts/i);
    });
  });

  describe('validateAndFixFootnotes', () => {
    it('normalizes matching footnotes', () => {
      const translation = 'Line with [1].';
      const footnotes = [{ marker: '1', text: 'Note' }];
      const result = validateAndFixFootnotes(translation, footnotes);
      expect(result.footnotes[0].marker).toBe('[1]');
    });

    it('appends markers when JSON has extras and strictMode=append', () => {
      const translation = 'No markers yet.';
      const footnotes = [{ marker: '1', text: 'First' }];
      const result = validateAndFixFootnotes(translation, footnotes);
      expect(result.translation.trim().endsWith('[1]')).toBe(true);
    });

    it('throws when strict mode is fail and extras exist', () => {
      const translation = 'No markers yet.';
      const footnotes = [{ marker: '1', text: 'First' }];
      expect(() => validateAndFixFootnotes(translation, footnotes, 'fail')).toThrow(/extra footnotes/i);
    });

    it('throws when text markers outnumber footnotes', () => {
      const translation = 'Has markers [1] [2].';
      const footnotes = [{ marker: '1', text: 'First' }];
      expect(() => validateAndFixFootnotes(translation, footnotes)).toThrow(/missing footnotes/i);
    });
  });

  describe('validateAndClampParameter', () => {
    it('clamps values outside configured limits', () => {
      expect(validateAndClampParameter(999, 'temperature')).toBeLessThanOrEqual(2);
    });

    it('returns original value when within limits', () => {
      expect(validateAndClampParameter(0.5, 'temperature')).toBeCloseTo(0.5);
    });
  });
});
