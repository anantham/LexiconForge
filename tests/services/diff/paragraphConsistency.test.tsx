import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { tokenizeTranslation } from '../../../components/chapter/translationTokens';
import { DiffAnalysisService } from '../../../services/diff/DiffAnalysisService';
import { computeDiffHash } from '../../../services/diff/hash';

vi.mock('../../../components/Illustration', () => ({ default: () => null }));

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

const analyze = (html: string) => new DiffAnalysisService().analyzeDiff({
  chapterId: 'paragraph-contract',
  aiTranslation: html,
  fanTranslation: null,
  rawText: 'Synthetic source',
});

describe('reader and diff paragraph contract', () => {
  it.each([
    {
      html: '<p>First&nbsp;<i>one</i></p><p class="next">Second<br>line</p>',
      text: ['First one', 'Second\nline'],
    },
    { html: '<b>one<br><br>two</b>', text: ['one', 'two'] },
    { html: '<hr><br><br>one<br><br><hr>two<hr>', text: ['one', 'two'] },
    { html: 'a \t<br/>b\r\n\r\n\r\nc &amp; d', text: ['a\nb\n\nc &amp; d'] },
    { html: '<BR /> <br>one<HR/>two', text: ['one', 'two'] },
    { html: 'one\n\ntwo', text: ['one\n\ntwo'] },
  ])('matches normalized paragraph IDs for $html', async ({ html, text }) => {
    const reader = tokenizeTranslation(html, 'chapter');
    const diff = await analyze(html);
    const hashes = text.map(computeDiffHash);

    expect(reader.paragraphs.map((paragraph) => paragraph.diffChunkId)).toEqual(hashes);
    expect(diff.markers.map((marker) => marker.chunkId)).toEqual(
      hashes.map((hash, position) => `para-${position}-${hash.slice(0, 4)}`)
    );
    let start = 0;
    expect(diff.markers.map((marker) => marker.aiRange)).toEqual(text.map((paragraph) => {
      const range = { start, end: start + paragraph.length };
      start = range.end + 2;
      return range;
    }));
  });

  it('keeps formatting across paragraph boundaries in the reader', () => {
    const { paragraphs } = tokenizeTranslation('<i><b>one<br><br>two</b></i>', 'chapter');
    expect(paragraphs).toHaveLength(2);
    for (const paragraph of paragraphs) {
      const html = renderToStaticMarkup(paragraph.nodes);
      expect(html).toMatch(/^<i><b>.*<\/b><\/i>$/);
    }
  });

  it.each(['', '<br><hr>'])('retains the analyzer-only fallback for blank input %j', async (html) => {
    expect(tokenizeTranslation(html, 'chapter').paragraphs).toEqual([]);
    expect((await analyze(html)).markers).toHaveLength(1);
  });
});
