// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  parseChapterNumberToken,
  parseChineseMonolithicText,
  parseEnglishMonolithicText,
} from '../../scripts/lib/chapter-parsing';

describe('chapter-parsing', () => {
  it('parses numbered Chinese chapters from a monolithic txt blob', () => {
    const text = [
      '封面信息',
      '',
      '第1章 法宝坟墓',
      '',
      '第一段。',
      '',
      '第二段。',
      '',
      '第2章 光幕仪',
      '',
      '第三段。',
      '',
    ].join('\n');

    const chapters = parseChineseMonolithicText(text);

    expect(chapters).toHaveLength(2);
    expect(chapters[0].chapterNumber).toBe(1);
    expect(chapters[0].title).toBe('第1章 法宝坟墓');
    expect(chapters[0].paragraphs.map((paragraph) => paragraph.text)).toEqual(['第一段。', '第二段。']);
    expect(chapters[1].chapterNumber).toBe(2);
  });

  it('skips a dense PDF table of contents and starts from the real chapter body', () => {
    const toc = Array.from({ length: 12 }, (_, index) => `Chapter ${index + 1}: TOC Entry ${index + 1}`).join('\n');
    const bodyGap = '\n'.repeat(40);
    const body = [
      'Chapter 1: Artifact Graveyard',
      '',
      'Li Yao lived in the Artifact Graveyard.',
      '',
      'Chapter 2: Hologram Projector',
      '',
      'The projector shimmered.',
      '',
    ].join('\n');

    const chapters = parseEnglishMonolithicText(`${toc}${bodyGap}${body}`);

    expect(chapters).toHaveLength(2);
    expect(chapters[0].chapterNumber).toBe(1);
    expect(chapters[0].title).toBe('Chapter 1: Artifact Graveyard');
    expect(chapters[0].paragraphs[0].text).toBe('Li Yao lived in the Artifact Graveyard.');
    expect(chapters[1].chapterNumber).toBe(2);
  });

  it('parses merged chapter tokens without losing the range', () => {
    expect(parseChapterNumberToken('3269-3270')).toEqual({ from: 3269, to: 3270 });
    expect(parseChapterNumberToken('2388')).toEqual({ from: 2388, to: 2388 });
  });

  // Regression guards (integrity scan 2026-07): the heading regexes used `\s`-class
  // whitespace before the title group. `\s` matches `\n`, so a BARE heading absorbed
  // the next body line as its TITLE — and buildChaptersFromHeadings then sliced that
  // line out of the content, leaving an empty body that dropped the whole chapter.
  it('keeps the body line after a bare Chinese heading (no title absorption)', () => {
    const chapters = parseChineseMonolithicText('第1章\n正文第一行');

    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBe('第1章');
    expect(chapters[0].paragraphs.map((paragraph) => paragraph.text)).toEqual(['正文第一行']);
  });

  it('keeps the body line after a bare English heading (no title absorption)', () => {
    const chapters = parseEnglishMonolithicText('Chapter 1\nThe first body line.');

    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBe('Chapter 1');
    expect(chapters[0].paragraphs.map((paragraph) => paragraph.text)).toEqual(['The first body line.']);
  });

  it('still parses titles separated by a full-width CJK space', () => {
    const chapters = parseChineseMonolithicText('第3章　光幕仪\n\n第三段。');

    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBe('第3章 光幕仪');
    expect(chapters[0].paragraphs.map((paragraph) => paragraph.text)).toEqual(['第三段。']);
  });
});
