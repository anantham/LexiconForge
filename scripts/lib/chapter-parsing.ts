/**
 * Chapter segmentation helpers for monolithic TXT and PDF imports.
 */

import type { SourceChapterRange, TranslationSourceChapter } from './translation-source-types';
import {
  normalizePlainText,
  normalizeLineEndings,
  splitTextIntoParagraphs,
} from './text-processing';

const CHINESE_CHAPTER_HEADING = /^第(\d+)章(?:\s+|[ \t\u3000]*)(.+)?$/gmu;
const ENGLISH_CHAPTER_HEADING = /^Chapter\s+(\d+(?:-\d+)?)(?:\s*[:\-–]\s*(.+)|\s+(.+))?$/gmu;

interface HeadingMatch {
  matchIndex: number;
  lineIndex: number;
  rawToken: string;
  title: string;
  range: SourceChapterRange;
  startOffset: number;
  endOffset: number;
}

const lineIndexAtOffset = (text: string, offset: number): number => {
  let lineIndex = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') {
      lineIndex++;
    }
  }
  return lineIndex;
};

export const parseChapterNumberToken = (rawToken: string): SourceChapterRange => {
  const trimmed = rawToken.trim();
  if (trimmed.includes('-')) {
    const [fromRaw, toRaw] = trimmed.split('-', 2);
    const from = parseInt(fromRaw, 10);
    const to = parseInt(toRaw, 10);
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
      throw new Error(`Invalid chapter token: ${rawToken}`);
    }
    return { from, to };
  }

  const chapter = parseInt(trimmed, 10);
  if (!Number.isFinite(chapter)) {
    throw new Error(`Invalid chapter token: ${rawToken}`);
  }

  return { from: chapter, to: chapter };
};

const parseHeadingMatches = (text: string, pattern: RegExp): HeadingMatch[] => {
  const matches: HeadingMatch[] = [];
  for (const match of text.matchAll(pattern)) {
    const rawToken = match[1];
    const title = (match[2] || match[3] || '').trim();
    const startOffset = match.index ?? 0;
    const endOffset = startOffset + match[0].length;
    matches.push({
      matchIndex: matches.length,
      lineIndex: lineIndexAtOffset(text, startOffset),
      rawToken,
      title,
      range: parseChapterNumberToken(rawToken),
      startOffset,
      endOffset,
    });
  }
  return matches;
};

const findEnglishBodyStartIndex = (headings: HeadingMatch[]): number => {
  if (headings.length === 0) {
    return 0;
  }

  const denseEarlyHeadings = headings.filter((heading) => heading.lineIndex < 400);
  if (denseEarlyHeadings.length < 10) {
    return 0;
  }

  for (let index = 1; index < headings.length; index++) {
    const gap = headings[index].lineIndex - headings[index - 1].lineIndex;
    if (gap > 20) {
      return index;
    }
  }

  return 0;
};

const buildChaptersFromHeadings = (
  text: string,
  headings: HeadingMatch[],
  options: { collapseSoftWraps?: boolean; titlePrefix: 'Chapter' | '第' }
): TranslationSourceChapter[] => {
  const chapters: TranslationSourceChapter[] = [];

  for (let index = 0; index < headings.length; index++) {
    const current = headings[index];
    const next = headings[index + 1];
    const body = text.slice(current.endOffset, next?.startOffset ?? text.length).trim();
    const paragraphs = splitTextIntoParagraphs(body, {
      collapseSoftWraps: options.collapseSoftWraps,
    });

    if (paragraphs.length === 0) {
      continue;
    }

    const isSingleChapter = current.range.from === current.range.to;
    const title = current.title.length > 0
      ? (options.titlePrefix === '第'
          ? `第${current.range.from}章 ${current.title}`
          : `Chapter ${current.rawToken}: ${current.title}`)
      : (isSingleChapter
          ? `${options.titlePrefix === '第' ? `第${current.range.from}章` : `Chapter ${current.range.from}`}`
          : `Chapter ${current.rawToken}`);

    chapters.push({
      chapterNumber: current.range.from,
      title,
      chapterRange: current.range,
      paragraphs,
    });
  }

  return chapters;
};

export const parseChineseMonolithicText = (text: string): TranslationSourceChapter[] => {
  const normalized = normalizeLineEndings(text);
  const headings = parseHeadingMatches(normalized, CHINESE_CHAPTER_HEADING);
  return buildChaptersFromHeadings(normalized, headings, {
    collapseSoftWraps: false,
    titlePrefix: '第',
  });
};

export const parseEnglishMonolithicText = (text: string): TranslationSourceChapter[] => {
  const normalized = normalizeLineEndings(text);
  const headings = parseHeadingMatches(normalized, ENGLISH_CHAPTER_HEADING);
  const bodyStartIndex = findEnglishBodyStartIndex(headings);
  return buildChaptersFromHeadings(normalized, headings.slice(bodyStartIndex), {
    collapseSoftWraps: true,
    titlePrefix: 'Chapter',
  });
};

export const inferMonolithicTextStructure = (
  text: string
): 'chinese-numbered-chapters' | 'english-numbered-chapters' | 'unknown' => {
  const normalized = normalizePlainText(text);
  if (/^第\d+章/mu.test(normalized)) {
    return 'chinese-numbered-chapters';
  }
  if (/^Chapter\s+\d+/mi.test(normalized)) {
    return 'english-numbered-chapters';
  }
  return 'unknown';
};
