// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { extractIllustrationMarkers, illustrationMarkerRegex } from '../../services/ai/responseValidators';
import { formatHistory } from '../../services/prompts';
import type { HistoricalChapter } from '../../types';

/**
 * P1.1 (TECH-DEBT-FIX-PRIORITY-2026-07-07).
 *
 * The pattern `/\\[ILLUSTRATION-\\d+\\]/` — double-escaped inside a regex
 * LITERAL — matches a literal backslash followed by "[ILLUSTRATION-", so it
 * could never match real translated text. That typo had been pasted into
 * three places and caused distinct user-facing failures: Claude appended a
 * duplicate of every marker (it believed the text contained none), and the
 * prior-chapter context always reported "Illustration markers: 0", teaching
 * the model that previous chapters had no illustrations at all.
 */

const TEXT = '<p>He drew the blade.</p>[ILLUSTRATION-1]<p>Rain fell.</p>[ILLUSTRATION-2a]';

describe('illustration marker pattern (P1.1)', () => {
  it('matches real markers, including the lettered variant', () => {
    expect(extractIllustrationMarkers(TEXT)).toEqual(['[ILLUSTRATION-1]', '[ILLUSTRATION-2a]']);
  });

  it('the OLD double-escaped pattern matched nothing — the bug, pinned', () => {
    expect(TEXT.match(/\\[ILLUSTRATION-\\d+[A-Za-z]*\\]/g)).toBeNull();
  });

  it('returns [] for text with no markers, and tolerates empty input', () => {
    expect(extractIllustrationMarkers('<p>nothing here</p>')).toEqual([]);
    expect(extractIllustrationMarkers('')).toEqual([]);
  });

  it('is a FACTORY, so /g lastIndex state cannot leak between callers', () => {
    const a = illustrationMarkerRegex();
    const b = illustrationMarkerRegex();
    expect(a).not.toBe(b);
    a.exec(TEXT);
    expect(a.lastIndex).toBeGreaterThan(0);
    expect(b.lastIndex).toBe(0);
    // repeated extraction is stable (a shared /g instance would alternate)
    expect(extractIllustrationMarkers(TEXT)).toHaveLength(2);
    expect(extractIllustrationMarkers(TEXT)).toHaveLength(2);
  });
});

describe('formatHistory illustration count (P1.1)', () => {
  const chapter: HistoricalChapter = {
    originalTitle: 'Ch 1',
    originalContent: 'source',
    translatedTitle: 'Chapter 1',
    translatedContent: TEXT,
    footnotes: [],
    feedback: [],
  } as HistoricalChapter;

  it('reports the REAL illustration count to the model, not 0', () => {
    const out = formatHistory([chapter]);
    expect(out).toContain('Illustration markers: 2');
    expect(out).not.toContain('Illustration markers: 0');
  });
});
