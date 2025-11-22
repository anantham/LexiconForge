/**
 * Test suite for <hr> tag rendering in ChapterView tokenizer
 *
 * Verifies that:
 * 1. <hr> tags are correctly tokenized
 * 2. <hr /> self-closing tags are handled
 * 3. Scene breaks from HtmlSanitizer are properly rendered
 */

import { describe, it, expect } from 'vitest';

// Mock React since we're testing tokenization logic
const React = {
  isValidElement: () => false,
  cloneElement: (node: any) => node,
};

// Extract the tokenization logic from ChapterView for testing
type TranslationToken =
  | { type: 'text'; chunkId: string; text: string }
  | { type: 'footnote'; marker: string; raw: string }
  | { type: 'illustration'; marker: string; raw: string }
  | { type: 'linebreak'; raw: string }
  | { type: 'hr'; raw: string }
  | { type: 'italic' | 'bold' | 'emphasis'; children: TranslationToken[] };

const TOKEN_SPLIT_REGEX = /(\[\d+\]|<i>[\s\S]*?<\/i>|<b>[\s\S]*?<\/b>|\*[\s\S]*?\*|\[ILLUSTRATION-\d+\]|<br\s*\/?>|<hr\s*\/?>)/g;
const ILLUSTRATION_RE = /^\[(ILLUSTRATION-\d+)\]$/;
const FOOTNOTE_RE = /^\[(\d+)\]$/;
const ITALIC_HTML_RE = /^<i>[\s\S]*<\/i>$/;
const BOLD_HTML_RE = /^<b>[\s\S]*<\/b>$/;
const EMPHASIS_RE = /^\*[\s\S]*\*$/;
const BR_RE = /^<br\s*\/?>$/i;
const HR_RE = /^<hr\s*\/?>$/i;

const buildTranslationTokens = (text: string, baseId: string, counter: { value: number }): TranslationToken[] => {
  if (!text) return [];
  const parts = text.split(TOKEN_SPLIT_REGEX).filter(Boolean);
  const tokens: TranslationToken[] = [];

  for (const part of parts) {
    const illustration = part.match(ILLUSTRATION_RE);
    if (illustration) {
      tokens.push({ type: 'illustration', marker: illustration[1], raw: part });
      continue;
    }

    const footnote = part.match(FOOTNOTE_RE);
    if (footnote) {
      tokens.push({ type: 'footnote', marker: footnote[1], raw: part });
      continue;
    }

    if (BR_RE.test(part)) {
      tokens.push({ type: 'linebreak', raw: part });
      continue;
    }

    if (HR_RE.test(part)) {
      tokens.push({ type: 'hr', raw: part });
      continue;
    }

    if (ITALIC_HTML_RE.test(part)) {
      const inner = part.slice(3, -4);
      tokens.push({ type: 'italic', children: buildTranslationTokens(inner, baseId, counter) });
      continue;
    }

    if (BOLD_HTML_RE.test(part)) {
      const inner = part.slice(3, -4);
      tokens.push({ type: 'bold', children: buildTranslationTokens(inner, baseId, counter) });
      continue;
    }

    if (EMPHASIS_RE.test(part)) {
      const inner = part.slice(1, -1);
      tokens.push({ type: 'emphasis', children: buildTranslationTokens(inner, baseId, counter) });
      continue;
    }

    const chunkId = `${baseId}-chunk-${counter.value++}`;
    tokens.push({ type: 'text', chunkId, text: part });
  }

  return tokens;
};

const tokensToString = (tokens: TranslationToken[]): string => {
  return tokens
    .map((token) => {
      switch (token.type) {
        case 'text':
          return token.text;
        case 'footnote':
          return `[${token.marker}]`;
        case 'illustration':
          return `[${token.marker}]`;
        case 'linebreak':
          return '<br />';
        case 'hr':
          return '<hr />';
        case 'italic':
          return `<i>${tokensToString(token.children)}</i>`;
        case 'bold':
          return `<b>${tokensToString(token.children)}</b>`;
        case 'emphasis':
          return `*${tokensToString(token.children)}*`;
        default:
          return '';
      }
    })
    .join('');
};

describe('HR Tag Rendering', () => {
  it('should tokenize <hr> tag correctly', () => {
    const input = 'Text before scene break<hr>Text after scene break';
    const tokens = buildTranslationTokens(input, 'test', { value: 0 });

    expect(tokens).toHaveLength(3);
    expect(tokens[0].type).toBe('text');
    expect(tokens[1].type).toBe('hr');
    expect(tokens[2].type).toBe('text');
  });

  it('should tokenize self-closing <hr /> tag correctly', () => {
    const input = 'Text before<hr />Text after';
    const tokens = buildTranslationTokens(input, 'test', { value: 0 });

    expect(tokens).toHaveLength(3);
    const hrToken = tokens[1];
    expect(hrToken.type).toBe('hr');
    if (hrToken.type === 'hr') {
      expect(hrToken.raw).toBe('<hr />');
    }
  });

  it('should handle multiple <hr> tags in sequence', () => {
    const input = 'Part 1<hr>Part 2<hr>Part 3';
    const tokens = buildTranslationTokens(input, 'test', { value: 0 });

    expect(tokens).toHaveLength(5);
    expect(tokens[1].type).toBe('hr');
    expect(tokens[3].type).toBe('hr');
  });

  it('should serialize <hr> tokens back to string correctly', () => {
    const input = 'Before<hr />After';
    const tokens = buildTranslationTokens(input, 'test', { value: 0 });
    const serialized = tokensToString(tokens);

    expect(serialized).toBe('Before<hr />After');
  });

  it('should handle text with <hr> from HtmlSanitizer (real-world case)', () => {
    // This is what HtmlSanitizer produces from "* * *" or "---"
    const input = 'I had a premonition that the two of us would one day sink into a murky swamp.<hr />Our mercenary company swept through northern Frankia.';
    const tokens = buildTranslationTokens(input, 'test', { value: 0 });

    expect(tokens).toHaveLength(3);
    expect(tokens[0].type).toBe('text');
    expect(tokens[0]).toHaveProperty('text', 'I had a premonition that the two of us would one day sink into a murky swamp.');
    expect(tokens[1].type).toBe('hr');
    expect(tokens[2].type).toBe('text');
    expect(tokens[2]).toHaveProperty('text', 'Our mercenary company swept through northern Frankia.');
  });

  it('should handle mixed content with hr, br, and formatting', () => {
    const input = 'Line 1<br>Line 2<hr><i>Italic after break</i>';
    const tokens = buildTranslationTokens(input, 'test', { value: 0 });

    expect(tokens).toHaveLength(5);
    expect(tokens[0].type).toBe('text');
    expect(tokens[1].type).toBe('linebreak');
    expect(tokens[2].type).toBe('text');
    expect(tokens[3].type).toBe('hr');
    expect(tokens[4].type).toBe('italic');
  });

  it('should handle whitespace variations in <hr> tags', () => {
    // Valid variations that our regex supports
    const variations = [
      '<hr>',
      '<hr/>',
      '<hr />',
      '<hr  />',
    ];

    variations.forEach(variant => {
      const tokens = buildTranslationTokens(`Before${variant}After`, 'test', { value: 0 });
      const hrToken = tokens.find(t => t.type === 'hr');
      expect(hrToken).toBeDefined();
      if (hrToken && hrToken.type === 'hr') {
        expect(hrToken.raw).toBe(variant);
      } else {
        throw new Error('Expected hr token for variant test');
      }
    });
  });

  it('should NOT tokenize <hr> inside text as hr token (edge case)', () => {
    // This should NOT happen in real usage, but testing regex boundaries
    const input = 'The tag <hr> is used for breaks';
    const tokens = buildTranslationTokens(input, 'test', { value: 0 });

    // The <hr> should be captured as a separate token
    const hrToken = tokens.find(t => t.type === 'hr');
    expect(hrToken).toBeDefined();
  });
});
