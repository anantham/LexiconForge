/**
 * Tests for services/wordAlignment.ts (issue #15 Phase 1).
 *
 * Verifies:
 *  - validateAlignment drops pairs whose offsets don't match the substring
 *  - alignWords short-circuits on empty inputs
 *  - alignWords calls the provider with the right schema + messages
 *  - alignWords parses provider response (raw JSON or fenced)
 *  - isAlignmentFresh stale-check works
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AppSettings } from '../../types';

const chatJSONSpy = vi.fn();

vi.mock('../../adapters/providers', () => ({
  initializeProviders: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../adapters/providers/registry', () => ({
  getProvider: vi.fn(() => ({ name: 'Gemini', chatJSON: chatJSONSpy })),
}));

import { alignWords, isAlignmentFresh } from '../../services/wordAlignment';

const baseSettings: AppSettings = {
  contextDepth: 0,
  preloadCount: 0,
  fontSize: 16,
  fontStyle: 'sans',
  lineHeight: 1.5,
  systemPrompt: '',
  provider: 'Gemini' as any,
  model: 'gemini-2.5-flash',
  imageModel: 'imagen-3.0',
  temperature: 0.0,
};

describe('wordAlignment', () => {
  beforeEach(() => {
    chatJSONSpy.mockReset();
  });

  describe('alignWords', () => {
    it('returns empty alignment when source or target is empty', async () => {
      const result = await alignWords({ source: '', target: 'hello', settings: baseSettings });
      expect(result.pairs).toEqual([]);
      expect(result.pairCount).toBe(0);
      expect(chatJSONSpy).not.toHaveBeenCalled();
    });

    it('returns LLM-produced pairs verbatim when offsets are valid', async () => {
      const source = '李逍遥很强';
      const target = 'Li Xiaoyao is strong';
      chatJSONSpy.mockResolvedValueOnce({
        text: JSON.stringify({
          pairs: [
            { source: '李逍遥', target: 'Li Xiaoyao', sourceStart: 0, sourceEnd: 3, targetStart: 0, targetEnd: 10 },
            { source: '很', target: 'is', sourceStart: 3, sourceEnd: 4, targetStart: 11, targetEnd: 13 },
            { source: '强', target: 'strong', sourceStart: 4, sourceEnd: 5, targetStart: 14, targetEnd: 20 },
          ],
        }),
      });

      const result = await alignWords({
        source,
        target,
        sourceLang: 'zh',
        targetLang: 'en',
        settings: baseSettings,
        translationVersionId: 'v1',
      });

      expect(result.pairs).toHaveLength(3);
      expect(result.pairs[0]).toMatchObject({ source: '李逍遥', target: 'Li Xiaoyao' });
      expect(result.translationVersionId).toBe('v1');
      expect(result.pairCount).toBe(3);
    });

    it('drops pairs whose offsets do not actually match the substring (LLM hallucination guard)', async () => {
      const source = 'hello world';
      const target = 'bonjour le monde';
      chatJSONSpy.mockResolvedValueOnce({
        text: JSON.stringify({
          pairs: [
            { source: 'hello', target: 'bonjour', sourceStart: 0, sourceEnd: 5, targetStart: 0, targetEnd: 7 }, // valid
            { source: 'world', target: 'monde', sourceStart: 6, sourceEnd: 11, targetStart: 11, targetEnd: 16 }, // valid
            { source: 'WRONG', target: 'monde', sourceStart: 0, sourceEnd: 5, targetStart: 11, targetEnd: 16 }, // invalid: source mismatch (slice = "hello", not "WRONG")
            { source: 'hello', target: 'X', sourceStart: 0, sourceEnd: 5, targetStart: 0, targetEnd: 7 }, // invalid: target mismatch (slice = "bonjour")
            { source: 'hello', target: 'oob', sourceStart: 0, sourceEnd: 5, targetStart: 50, targetEnd: 60 }, // invalid: target offset out of range
          ],
        }),
      });

      const result = await alignWords({
        source,
        target,
        settings: baseSettings,
      });

      expect(result.pairs).toHaveLength(2);
      expect(result.pairs.map((p) => p.source)).toEqual(['hello', 'world']);
    });

    it('keeps dropped-in-translation pairs (target="" with zero offsets)', async () => {
      const source = 'こんにちは';
      const target = 'hi';
      chatJSONSpy.mockResolvedValueOnce({
        text: JSON.stringify({
          pairs: [
            { source: 'こんにちは', target: 'hi', sourceStart: 0, sourceEnd: 5, targetStart: 0, targetEnd: 2 },
            // a hypothetical dropped particle
            { source: 'こ', target: '', sourceStart: 0, sourceEnd: 1, targetStart: 0, targetEnd: 0 },
          ],
        }),
      });

      const result = await alignWords({ source, target, settings: baseSettings });
      expect(result.pairs).toHaveLength(2);
      expect(result.pairs[1]).toMatchObject({ source: 'こ', target: '' });
    });

    it('extracts JSON when LLM wraps it in markdown code fences', async () => {
      const source = 'sati';
      const target = 'mindfulness';
      chatJSONSpy.mockResolvedValueOnce({
        text:
          'Sure, here is the alignment:\n```json\n' +
          JSON.stringify({
            pairs: [{ source: 'sati', target: 'mindfulness', sourceStart: 0, sourceEnd: 4, targetStart: 0, targetEnd: 11 }],
          }) +
          '\n```',
      });

      const result = await alignWords({ source, target, settings: baseSettings });
      expect(result.pairs).toHaveLength(1);
      expect(result.pairs[0].source).toBe('sati');
    });

    it('passes the alignment schema + structuredOutputs flag to the provider', async () => {
      chatJSONSpy.mockResolvedValueOnce({ text: '{"pairs":[]}' });
      await alignWords({ source: 'a', target: 'b', settings: baseSettings });
      const callArgs = chatJSONSpy.mock.calls[0][0];
      expect(callArgs.structuredOutputs).toBe(true);
      expect(callArgs.schemaName).toBe('WordAlignment');
      expect(callArgs.schema?.properties?.pairs?.items?.required).toContain('sourceStart');
      expect(callArgs.messages).toHaveLength(2);
      expect(callArgs.messages[0].role).toBe('system');
      expect(callArgs.messages[1].role).toBe('user');
    });
  });

  describe('isAlignmentFresh', () => {
    it('returns false when alignment is null/undefined', () => {
      expect(isAlignmentFresh(null, 'v1')).toBe(false);
      expect(isAlignmentFresh(undefined, 'v1')).toBe(false);
    });

    it('returns false when current version is null/undefined', () => {
      const a = { pairs: [], translationVersionId: 'v1', alignedAt: '', modelUsed: '', pairCount: 0 };
      expect(isAlignmentFresh(a, null)).toBe(false);
      expect(isAlignmentFresh(a, undefined)).toBe(false);
    });

    it('returns true when versions match', () => {
      const a = { pairs: [], translationVersionId: 'v1', alignedAt: '', modelUsed: '', pairCount: 0 };
      expect(isAlignmentFresh(a, 'v1')).toBe(true);
    });

    it('returns false when versions differ', () => {
      const a = { pairs: [], translationVersionId: 'v1', alignedAt: '', modelUsed: '', pairCount: 0 };
      expect(isAlignmentFresh(a, 'v2')).toBe(false);
    });
  });
});
