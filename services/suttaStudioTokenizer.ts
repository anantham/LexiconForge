/**
 * suttaStudioTokenizer.ts
 *
 * Tokenizes English text for the Weaver pass.
 * Splits on whitespace and punctuation, preserving both as separate tokens.
 *
 * This is Phase 3.4 from the Assembly-Line Roadmap.
 */

export type EnglishTokenInput = {
  index: number;
  text: string;
  /** True if this token is whitespace only */
  isWhitespace: boolean;
  /** True if this token is punctuation only */
  isPunctuation: boolean;
};

/**
 * Tokenize English text into an array of tokens.
 * Preserves whitespace and punctuation as separate tokens.
 *
 * Example:
 *   tokenizeEnglish("Thus have I heard.")
 *   // => [
 *   //   { index: 0, text: "Thus", isWhitespace: false, isPunctuation: false },
 *   //   { index: 1, text: " ", isWhitespace: true, isPunctuation: false },
 *   //   { index: 2, text: "have", isWhitespace: false, isPunctuation: false },
 *   //   { index: 3, text: " ", isWhitespace: true, isPunctuation: false },
 *   //   { index: 4, text: "I", isWhitespace: false, isPunctuation: false },
 *   //   { index: 5, text: " ", isWhitespace: true, isPunctuation: false },
 *   //   { index: 6, text: "heard", isWhitespace: false, isPunctuation: false },
 *   //   { index: 7, text: ".", isWhitespace: false, isPunctuation: true },
 *   // ]
 */
export function tokenizeEnglish(text: string): EnglishTokenInput[] {
  if (!text) return [];

  // Split on whitespace and punctuation, capturing the delimiters
  // This regex splits while keeping whitespace and punctuation as separate tokens
  const parts = text.split(/(\s+|[.,;:!?'"()—\-–…""''«»‹›])/);

  const tokens: EnglishTokenInput[] = [];
  let index = 0;

  for (const part of parts) {
    if (part.length === 0) continue;

    const isWhitespace = /^\s+$/.test(part);
    const isPunctuation = /^[.,;:!?'"()—\-–…""''«»‹›]+$/.test(part);

    tokens.push({
      index,
      text: part,
      isWhitespace,
      isPunctuation,
    });
    index++;
  }

  return tokens;
}

/**
 * Get only the "word" tokens (non-whitespace, non-punctuation).
 * Useful for building a compact representation for the Weaver prompt.
 */
export function getWordTokens(tokens: EnglishTokenInput[]): EnglishTokenInput[] {
  return tokens.filter((t) => !t.isWhitespace && !t.isPunctuation);
}

/**
 * Build a compact string representation of tokens for the Weaver prompt.
 * Format: "0:Thus 2:have 4:I 6:heard"
 */
export function buildTokenListForPrompt(tokens: EnglishTokenInput[]): string {
  return getWordTokens(tokens)
    .map((t) => `${t.index}:${t.text}`)
    .join(' ');
}

/**
 * Concatenate tokens back into the original text.
 * Useful for verification.
 */
export function reconstructText(tokens: EnglishTokenInput[]): string {
  return tokens.map((t) => t.text).join('');
}
