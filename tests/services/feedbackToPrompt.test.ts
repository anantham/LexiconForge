// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { feedbackRecordToItem } from '../../services/db/operations/feedback';
import { formatHistory } from '../../services/prompts';
import type { HistoricalChapter } from '../../types';

/**
 * P1.5 (TECH-DEBT-FIX-PRIORITY-2026-07-07): translationService kept a PRIVATE
 * copy of the feedback converter that never set `comment`. formatHistory
 * renders feedback as `- 👎 on: "<selection>" (User comment: <comment>)`, so
 * every piece of IDB-hydrated feedback reached the model with the user's
 * actual guidance stripped out. The user typed a correction; the model never
 * saw it. The private copy now delegates to this canonical converter.
 */

const record = {
  id: 'fb-1',
  chapterUrl: 'https://example.com/ch1',
  type: 'negative',
  selection: 'the crimson blade',
  comment: 'keep weapon names literal, do not embellish',
  createdAt: new Date(1700000000000).toISOString(),
} as never;

describe('feedbackRecordToItem (P1.5)', () => {
  it('carries the user comment through to the FeedbackItem', () => {
    const item = feedbackRecordToItem(record);
    expect(item.comment).toBe('keep weapon names literal, do not embellish');
    expect(item.selection).toBe('the crimson blade');
    expect(item.type).toBe('👎');
  });

  it('the comment actually reaches the prompt the model sees', () => {
    const history: HistoricalChapter[] = [
      {
        originalTitle: 'Ch 1',
        originalContent: 'source',
        translatedTitle: 'Chapter 1',
        translatedContent: '<p>He drew the crimson blade.</p>',
        footnotes: [],
        feedback: [feedbackRecordToItem(record)],
      } as HistoricalChapter,
    ];

    const prompt = formatHistory(history);

    expect(prompt).toContain('the crimson blade');
    // The whole point: the guidance the user typed must be in the prompt.
    expect(prompt).toContain('User comment: keep weapon names literal, do not embellish');
  });
});
