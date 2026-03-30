import { JSDOM } from 'jsdom';

import { normalizePlainText, splitTextIntoParagraphs } from '../text-processing';
import type {
  TranslationSourceAdapter,
  TranslationSourceChapter,
  TranslationSourceOutput,
} from '../translation-source-types';

const NOVELHI_CHAPTER_URL = /^https?:\/\/(?:www\.)?novelhi\.com\/s\/([^/?#]+)\/(\d+)(?:[/?#].*)?$/i;
const NOVELHI_RANGE_SPEC = /^novelhi:\/\/([^/?#]+)\?from=(\d+)&to=(\d+)(?:&.*)?$/i;

type NovelHiInputSpec =
  | {
    kind: 'single';
    slug: string;
    chapterNumber: number;
    url: string;
  }
  | {
    kind: 'range';
    slug: string;
    from: number;
    to: number;
  };

interface ParsedNovelHiChapter {
  novelTitle: string;
  chapter: TranslationSourceChapter;
}

const buildNovelHiChapterUrl = (slug: string, chapterNumber: number): string => (
  `https://novelhi.com/s/${slug}/${chapterNumber}`
);

const parsePositiveInteger = (value: string, label: string): number => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid NovelHi ${label}: ${value}`);
  }
  return parsed;
};

export const parseNovelHiInput = (input: string): NovelHiInputSpec | null => {
  const chapterMatch = input.match(NOVELHI_CHAPTER_URL);
  if (chapterMatch) {
    const slug = chapterMatch[1];
    const chapterNumber = parsePositiveInteger(chapterMatch[2], 'chapter number');
    return {
      kind: 'single',
      slug,
      chapterNumber,
      url: buildNovelHiChapterUrl(slug, chapterNumber),
    };
  }

  const rangeMatch = input.match(NOVELHI_RANGE_SPEC);
  if (rangeMatch) {
    const slug = rangeMatch[1];
    const from = parsePositiveInteger(rangeMatch[2], 'range start');
    const to = parsePositiveInteger(rangeMatch[3], 'range end');

    if (from > to) {
      throw new Error(`Invalid NovelHi range: from (${from}) cannot be greater than to (${to})`);
    }

    return {
      kind: 'range',
      slug,
      from,
      to,
    };
  }

  return null;
};

const parseChapterNumber = (title: string, fallback: number): number => {
  const match = title.match(/^Chapter\s+(\d+)/i);
  if (!match) {
    return fallback;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const nodeTextWithLineBreaks = (node: Node): string => {
  if (node.nodeType === node.TEXT_NODE) {
    return node.textContent || '';
  }

  if (node.nodeType !== node.ELEMENT_NODE) {
    return '';
  }

  const element = node as Element;
  if (element.tagName === 'BR') {
    return '\n';
  }

  return Array.from(element.childNodes)
    .map((child) => nodeTextWithLineBreaks(child))
    .join('');
};

export const parseNovelHiChapterHtml = (
  html: string,
  sourceUrl: string
): ParsedNovelHiChapter => {
  const dom = new JSDOM(html);
  const { document } = dom.window;

  const contentRoot = document.querySelector('#showReading');
  if (!contentRoot) {
    throw new Error(`NovelHi page did not contain #showReading for ${sourceUrl}`);
  }

  const titleElement = document.querySelector('.book_title h1');
  const title = normalizePlainText(titleElement?.textContent || '').trim();
  if (!title) {
    throw new Error(`NovelHi page did not contain a readable chapter title for ${sourceUrl}`);
  }

  const novelTitle = normalizePlainText(
    (document.querySelector('#bookName') as HTMLInputElement | null)?.value ||
      document.querySelector('.bookNav a:last-of-type')?.textContent ||
      ''
  ).trim();

  const removableNodes = Array.from(
    contentRoot.querySelectorAll('script, ins, iframe, noscript, style')
  ) as Element[];
  removableNodes.forEach((node) => node.remove());

  const rawText = (Array.from(contentRoot.childNodes) as Node[])
    .map((node) => nodeTextWithLineBreaks(node))
    .join('');

  const normalizedText = normalizePlainText(rawText)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const paragraphs = splitTextIntoParagraphs(normalizedText, { collapseSoftWraps: true });

  if (paragraphs.length === 0) {
    throw new Error(`NovelHi page did not contain readable chapter paragraphs for ${sourceUrl}`);
  }

  const urlMatch = sourceUrl.match(NOVELHI_CHAPTER_URL);
  const chapterNumber = parseChapterNumber(title, urlMatch ? Number.parseInt(urlMatch[2], 10) : 0);

  return {
    novelTitle,
    chapter: {
      chapterNumber,
      title,
      paragraphs,
    },
  };
};

const fetchNovelHiChapter = async (sourceUrl: string): Promise<ParsedNovelHiChapter> => {
  console.log(`🌐 Fetching NovelHi chapter: ${sourceUrl}`);

  const response = await fetch(sourceUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LexiconForge/1.0; +https://github.com/anantham/LexiconForge)',
    },
  });

  if (!response.ok) {
    throw new Error(`NovelHi request failed for ${sourceUrl}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const parsed = parseNovelHiChapterHtml(html, sourceUrl);

  console.log(`   Title: ${parsed.chapter.title}`);
  console.log(`   Paragraphs: ${parsed.chapter.paragraphs.length}`);

  return parsed;
};

export class NovelHiAdapter implements TranslationSourceAdapter {
  name = 'novelhi';

  canHandle(input: string): boolean {
    return parseNovelHiInput(input) !== null;
  }

  async extract(input: string): Promise<TranslationSourceOutput> {
    const spec = parseNovelHiInput(input);
    if (!spec) {
      throw new Error(`NovelHi adapter cannot handle input: ${input}`);
    }

    const parsedChapters: ParsedNovelHiChapter[] = [];
    if (spec.kind === 'single') {
      parsedChapters.push(await fetchNovelHiChapter(spec.url));
    } else {
      console.log(`🌐 Fetching NovelHi range: ${spec.slug} chapters ${spec.from}-${spec.to}`);
      for (let chapterNumber = spec.from; chapterNumber <= spec.to; chapterNumber += 1) {
        parsedChapters.push(await fetchNovelHiChapter(buildNovelHiChapterUrl(spec.slug, chapterNumber)));
      }
    }

    const translatorName = parsedChapters[0]?.novelTitle || 'NovelHi';
    const sourceReference = spec.kind === 'single'
      ? spec.url
      : `novelhi://${spec.slug}?from=${spec.from}&to=${spec.to}`;

    return {
      translatorId: 'novelhi-web',
      translator: {
        name: translatorName,
        language: 'English',
        tradition: 'Fan/Community',
        notes: spec.kind === 'single'
          ? 'Fetched from NovelHi chapter page'
          : `Fetched from NovelHi chapter range ${spec.from}-${spec.to}`,
        sourceReference,
      },
      chapters: parsedChapters.map((parsed) => parsed.chapter),
    };
  }
}
