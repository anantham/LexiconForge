/**
 * Text decoding and normalization helpers for importer scripts.
 */

const CANDIDATE_ENCODINGS = ['utf-8', 'gb18030', 'gbk'] as const;

export interface DecodedTextResult {
  text: string;
  encoding: string;
  score: number;
}

const normalizeLigatures = (text: string): string => text
  .replace(/ﬀ/g, 'ff')
  .replace(/ﬁ/g, 'fi')
  .replace(/ﬂ/g, 'fl')
  .replace(/ﬃ/g, 'ffi')
  .replace(/ﬄ/g, 'ffl')
  .replace(/ﬅ/g, 'ft')
  .replace(/ﬆ/g, 'st');

const scoreDecodedText = (text: string): number => {
  const sample = text.slice(0, 6000);
  const replacementCount = (sample.match(/�/g) || []).length;
  const controlCount = (sample.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) || []).length;
  const readableCount = (sample.match(/[\p{L}\p{N}\p{P}\p{Zs}\r\n\t]/gu) || []).length;
  const chapterHintCount = (
    sample.match(/^第\d+章|^Chapter\s+\d+/gmu) || []
  ).length;

  return readableCount + (chapterHintCount * 250) - (replacementCount * 1000) - (controlCount * 250);
};

export const decodeTextBuffer = (
  buffer: Uint8Array,
  encodings: readonly string[] = CANDIDATE_ENCODINGS
): DecodedTextResult => {
  const attempts = encodings.map((encoding) => {
    const decoded = new TextDecoder(encoding).decode(buffer);
    return {
      text: normalizeLigatures(decoded),
      encoding,
      score: scoreDecodedText(decoded),
    };
  });

  attempts.sort((left, right) => right.score - left.score);
  return attempts[0];
};

export const normalizeLineEndings = (text: string): string => text
  .replace(/^\uFEFF/, '')
  .replace(/\r\n?/g, '\n');

export const normalizePlainText = (text: string): string => normalizeLigatures(
  normalizeLineEndings(text)
    .replace(/\u00A0/g, ' ')
    .replace(/\u200B/g, '')
);

export const stripSoftWrappedLineBreaks = (text: string): string => normalizePlainText(text)
  .replace(/([A-Za-z])-\n([A-Za-z])/g, '$1-$2');

export const splitParagraphBlocks = (text: string): string[] => normalizePlainText(text)
  .split(/\n{2,}/)
  .map((block) => block.trim())
  .filter(Boolean);

export const collapseWrappedLines = (text: string): string => text
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length > 0)
  .join(' ')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * Smarter paragraph splitting for PDF-extracted text where both soft wraps
 * and real paragraph breaks use single newlines.
 *
 * Heuristic: a newline is a real paragraph break when:
 * - The previous line ends with sentence-ending punctuation (.!?""')
 *   AND the next line starts with an uppercase letter, quote, or is very short (<40 chars)
 * - OR the previous line is very short (<40 chars) — likely a heading or short sentence
 * - OR the next line starts with a quote character
 */
export const splitPdfParagraphs = (text: string): string[] => {
  const lines = normalizePlainText(text)
    .split('\n')
    .map((line) => line.trim());

  const paragraphs: string[] = [];
  let current: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length === 0) {
      // Blank line is always a paragraph break
      if (current.length > 0) {
        paragraphs.push(current.join(' ').replace(/\s+/g, ' ').trim());
        current = [];
      }
      continue;
    }

    current.push(line);

    // Decide if we should break after this line
    const nextLine = lines[i + 1];
    if (!nextLine || nextLine.length === 0) continue; // blank line or end handles it

    const endsWithPunctuation = /[.!?"\u201C\u201D\u2018\u2019'"]$/.test(line);
    const nextStartsUpper = /^[A-Z"\u201C\u201D\u2018\u2019'\u2014—]/.test(nextLine);
    const lineIsShort = line.length < 40;
    const nextIsQuote = /^[""\u201C\u201D''\u2018\u2019]/.test(nextLine);

    if (
      (endsWithPunctuation && nextStartsUpper) ||
      (endsWithPunctuation && nextIsQuote) ||
      lineIsShort
    ) {
      paragraphs.push(current.join(' ').replace(/\s+/g, ' ').trim());
      current = [];
    }
  }

  if (current.length > 0) {
    paragraphs.push(current.join(' ').replace(/\s+/g, ' ').trim());
  }

  return paragraphs.filter(Boolean);
};

export const splitTextIntoParagraphs = (
  text: string,
  options: { collapseSoftWraps?: boolean; pdfMode?: boolean } = {}
): Array<{ text: string }> => {
  // PDF mode uses smarter heuristic for paragraph detection
  if (options.pdfMode) {
    return splitPdfParagraphs(text)
      .map((block) => ({ text: block }))
      .filter((paragraph) => paragraph.text.length > 0);
  }

  const normalized = options.collapseSoftWraps
    ? stripSoftWrappedLineBreaks(text)
    : normalizePlainText(text);

  return splitParagraphBlocks(normalized)
    .map((block) => ({
      text: options.collapseSoftWraps ? collapseWrappedLines(block) : block,
    }))
    .filter((paragraph) => paragraph.text.length > 0);
};
