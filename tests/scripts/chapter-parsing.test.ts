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
});
