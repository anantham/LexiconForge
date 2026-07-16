import { describe, it, expect, vi } from 'vitest';
import type { HistoricalChapter } from '../../types';

// feedback.ts only touches the repository inside FeedbackOps methods, never at module scope,
// so stubbing it lets us import the pure converter without standing up IndexedDB.
vi.mock('../../services/db/repositories/instances', () => ({ feedbackRepository: {} }));

import { formatHistory } from '../../services/prompts';
import { feedbackRecordToItem } from '../../services/db/operations/feedback';

const chapter = (overrides: Partial<HistoricalChapter> = {}): HistoricalChapter => ({
  originalTitle: 'Original',
  originalContent: 'Source text.',
  translatedTitle: 'Translated',
  translatedContent: 'Translated text.',
  fanTranslationReference: null,
  footnotes: [],
  feedback: [],
  ...overrides,
});

describe('prior-chapter context assembly', () => {
  describe('illustration marker count', () => {
    it('reports the real number of markers in the previous chapter', () => {
      // The count used an over-escaped regex that could never match, so this line reported
      // "Illustration markers: 0" for every chapter — telling the model that prior chapters
      // contained no illustrations, which suppresses new ones.
      const prompt = formatHistory([
        chapter({ translatedContent: 'A. [ILLUSTRATION-1] B. [ILLUSTRATION-2] C.' }),
      ]);

      expect(prompt).toContain('Illustration markers: 2');
    });

    it('reports zero only when the chapter genuinely has none', () => {
      const prompt = formatHistory([chapter({ translatedContent: 'No markers here.' })]);
      expect(prompt).toContain('Illustration markers: 0');
    });
  });

  describe('feedback comments', () => {
    it("carries the user's comment from an IndexedDB record into the prompt", () => {
      // translationService converted IDB feedback with a private copy of this mapping that
      // emitted `text` but not `comment` — and formatHistory reads `comment`. So the guidance
      // the user actually typed was dropped before it could ever influence a translation.
      const record = {
        id: 'fb-1',
        chapterUrl: 'https://example.com/ch-1',
        type: 'negative' as const,
        selection: 'the honorific',
        comment: 'Keep Japanese honorifics untranslated.',
        createdAt: new Date('2026-01-01').toISOString(),
      };

      const item = feedbackRecordToItem(record as any);
      expect(item.comment).toBe('Keep Japanese honorifics untranslated.');

      const prompt = formatHistory([chapter({ feedback: [item] })]);

      expect(prompt).toContain('User comment: Keep Japanese honorifics untranslated.');
      expect(prompt).toContain('the honorific');
    });

    it('omits the comment clause when the user left no comment', () => {
      const record = {
        id: 'fb-2',
        chapterUrl: 'https://example.com/ch-1',
        type: 'positive' as const,
        selection: 'this line',
        comment: '',
        createdAt: new Date('2026-01-01').toISOString(),
      };

      const prompt = formatHistory([chapter({ feedback: [feedbackRecordToItem(record as any)] })]);

      expect(prompt).not.toContain('User comment:');
    });
  });
});
