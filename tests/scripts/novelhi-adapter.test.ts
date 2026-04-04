// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  NovelHiAdapter,
  parseNovelHiChapterHtml,
  parseNovelHiInput,
} from '../../scripts/lib/adapters/novelhi-adapter';

const SAMPLE_HTML = `<!DOCTYPE html>
<html>
  <body>
    <input type="hidden" id="bookName" value="Forty Millenniums of Cultivation" />
    <div class="book_title">
      <h1>Chapter 766</h1>
    </div>
    <div id="showReading" class="readBox">
      <sent id="0">None of the storage chips had any barriers.</sent><br><br>
      <sent id="1">Zi Zi Zi Zi.</sent><br><br>
      <script>console.log('ad');</script>
      <ins class="adsbygoogle">AD</ins>
      <script>console.log('ad');</script><br>
      <sent id="2">Yan Xinjian had been lurking below the ground.</sent>
    </div>
  </body>
</html>`;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('novelhi-adapter', () => {
  it('parses single chapter URLs and range specs', () => {
    expect(parseNovelHiInput('https://novelhi.com/s/Forty-Millenniums-of-Cultivation/766')).toEqual({
      kind: 'single',
      slug: 'Forty-Millenniums-of-Cultivation',
      chapterNumber: 766,
      url: 'https://novelhi.com/s/Forty-Millenniums-of-Cultivation/766',
    });

    expect(parseNovelHiInput('novelhi://Forty-Millenniums-of-Cultivation?from=765&to=767')).toEqual({
      kind: 'range',
      slug: 'Forty-Millenniums-of-Cultivation',
      from: 765,
      to: 767,
    });
  });

  it('parses chapter HTML into clean paragraphs', () => {
    const parsed = parseNovelHiChapterHtml(
      SAMPLE_HTML,
      'https://novelhi.com/s/Forty-Millenniums-of-Cultivation/766'
    );

    expect(parsed.novelTitle).toBe('Forty Millenniums of Cultivation');
    expect(parsed.chapter.chapterNumber).toBe(766);
    expect(parsed.chapter.title).toBe('Chapter 766');
    expect(parsed.chapter.paragraphs.map((paragraph) => paragraph.text)).toEqual([
      'None of the storage chips had any barriers.',
      'Zi Zi Zi Zi.',
      'Yan Xinjian had been lurking below the ground.',
    ]);
  });

  it('extracts a NovelHi chapter from a live-looking URL response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(SAMPLE_HTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new NovelHiAdapter();
    const result = await adapter.extract('https://novelhi.com/s/Forty-Millenniums-of-Cultivation/766');

    expect(adapter.canHandle('https://novelhi.com/s/Forty-Millenniums-of-Cultivation/766')).toBe(true);
    expect(result.translatorId).toBe('novelhi-web');
    expect(result.translator.sourceReference).toBe('https://novelhi.com/s/Forty-Millenniums-of-Cultivation/766');
    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0]?.chapterNumber).toBe(766);
    expect(result.chapters[0]?.paragraphs[2]?.text).toContain('Yan Xinjian');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('extracts a NovelHi chapter range from a batch spec', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(SAMPLE_HTML.replace('Chapter 766', 'Chapter 765'), {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      )
      .mockResolvedValueOnce(
        new Response(SAMPLE_HTML.replace('None of the storage chips had any barriers.', 'Li Yao secretly wiped his sweat.'), {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new NovelHiAdapter();
    const result = await adapter.extract('novelhi://Forty-Millenniums-of-Cultivation?from=765&to=766');

    expect(adapter.canHandle('novelhi://Forty-Millenniums-of-Cultivation?from=765&to=766')).toBe(true);
    expect(result.translator.sourceReference).toBe('novelhi://Forty-Millenniums-of-Cultivation?from=765&to=766');
    expect(result.chapters).toHaveLength(2);
    expect(result.chapters[0]?.chapterNumber).toBe(765);
    expect(result.chapters[1]?.chapterNumber).toBe(766);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
