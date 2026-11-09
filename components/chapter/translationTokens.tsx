import React from 'react';
import Illustration from '../Illustration';
import { computeDiffHash } from '../../services/diff/hash';
import { normalizeParagraphText, splitIntoParagraphSegments } from '../../services/diff/paragraphs';
import {
  ILLUSTRATION_MARKER_PATTERN,
  ILLUSTRATION_MARKER_INNER,
} from '../../services/ai/illustrationMarkers';

export type TranslationToken =
  | { type: 'text'; chunkId: string; text: string }
  | { type: 'footnote'; marker: string; raw: string }
  | { type: 'illustration'; marker: string; raw: string }
  | { type: 'linebreak'; raw: string }
  | { type: 'hr'; raw: string }
  | { type: 'italic' | 'bold' | 'emphasis'; children: TranslationToken[] };

export interface TranslationParagraph {
  position: number;
  diffChunkId: string;
  chunkId: string;
  nodes: React.ReactNode[];
}

export interface TokenizationResult {
  tokens: TranslationToken[];
  nodes: React.ReactNode[];
  paragraphs: TranslationParagraph[];
}

// The illustration alternative comes from the canonical marker module — the
// previous private copy here was narrower (no letter suffix), so a marker
// that passed validation could not be tokenized and rendered as literal text.
const TOKEN_SPLIT_REGEX = new RegExp(
  String.raw`(\[\d+\]|<i>[\s\S]*?<\/i>|<b>[\s\S]*?<\/b>|\*[\s\S]*?\*|${ILLUSTRATION_MARKER_PATTERN}|<br\s*\/?>|<hr\s*\/?>)`,
  'g'
);
const ILLUSTRATION_RE = new RegExp(String.raw`^\[(${ILLUSTRATION_MARKER_INNER})\]$`);
const FOOTNOTE_RE = /^\[(\d+)\]$/;
const ITALIC_HTML_RE = /^<i>[\s\S]*<\/i>$/;
const BOLD_HTML_RE = /^<b>[\s\S]*<\/b>$/;
const EMPHASIS_RE = /^\*[\s\S]*\*$/;
const BR_RE = /^<br\s*\/?>$/i;
const HR_RE = /^<hr\s*\/?>$/i;

const findOpenedTags = (html: string): string[] => {
  const opened: string[] = [];
  const openTagRegex = /<(i|b)>/g;
  let match: RegExpExecArray | null;

  while ((match = openTagRegex.exec(html)) !== null) {
    opened.push(match[1]);
  }

  return opened;
};

const findClosedTags = (html: string): string[] => {
  const closed: string[] = [];
  const closeTagRegex = /<\/(i|b)>/g;
  let match: RegExpExecArray | null;

  while ((match = closeTagRegex.exec(html)) !== null) {
    closed.push(match[1]);
  }

  return closed;
};

const balanceTagsAcrossSegments = (segments: Array<{ raw: string }>): Array<{ raw: string }> => {
  const openTags: string[] = [];

  return segments.map(segment => {
    const original = segment.raw;
    const originallyOpened = findOpenedTags(original);
    const originallyClosed = findClosedTags(original);
    let balanced = original;

    for (let i = openTags.length - 1; i >= 0; i--) {
      balanced = `<${openTags[i]}>${balanced}`;
    }

    for (const tag of originallyOpened) {
      openTags.push(tag);
    }

    for (const tag of originallyClosed) {
      const lastIndex = openTags.lastIndexOf(tag);
      if (lastIndex !== -1) {
        openTags.splice(lastIndex, 1);
      }
    }

    for (let i = openTags.length - 1; i >= 0; i--) {
      balanced = `${balanced}</${openTags[i]}>`;
    }

    return { raw: balanced };
  });
};

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

const renderTranslationTokens = (tokens: TranslationToken[], keyPrefix = ''): React.ReactNode[] => {
  return tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (token.type) {
      case 'text':
        return (
          <span
            key={key}
            data-lf-type="text"
            data-lf-chunk={token.chunkId}
            className="inline"
          >
            {token.text}
          </span>
        );
      case 'footnote':
        return (
          <sup key={key} id={`footnote-ref-${token.marker}`} data-lf-type="footnote" className="font-sans">
            <a href={`#footnote-def-${token.marker}`} className="text-blue-700 dark:text-blue-400 hover:underline no-underline">[{token.marker}]</a>
          </sup>
        );
      case 'illustration':
        return <Illustration key={key} marker={token.marker} />;
      case 'linebreak':
        return <br key={key} />;
      case 'hr':
        return <hr key={key} className="my-6 border-t border-gray-300 dark:border-gray-600" />;
      case 'italic':
        return <i key={key}>{renderTranslationTokens(token.children, key)}</i>;
      case 'bold':
        return <b key={key}>{renderTranslationTokens(token.children, key)}</b>;
      case 'emphasis':
        return <i key={key}>{renderTranslationTokens(token.children, key)}</i>;
      default:
        return null;
    }
  });
};

export const tokenizeTranslation = (text: string, baseId: string): TokenizationResult => {
  const segments = balanceTagsAcrossSegments(splitIntoParagraphSegments(text));
  const tokens: TranslationToken[] = [];
  const paragraphs: TranslationParagraph[] = [];
  const chunkIdPrefix = `para-${baseId}`;
  const counter = { value: 0 };

  for (const segment of segments) {
    const normalized = normalizeParagraphText(segment.raw);
    if (!normalized.trim()) continue;

    const position = paragraphs.length;
    const chunkId = `${chunkIdPrefix}-${position}`;
    const paragraphTokens = buildTranslationTokens(segment.raw, chunkIdPrefix, counter);
    const nodes = renderTranslationTokens(paragraphTokens, chunkIdPrefix);

    paragraphs.push({
      position,
      diffChunkId: computeDiffHash(normalized),
      chunkId,
      nodes,
    });

    tokens.push(...paragraphTokens);
  }

  return {
    tokens,
    nodes: paragraphs.flatMap((paragraph) => paragraph.nodes),
    paragraphs,
  };
};

export const cloneTokens = (tokens: TranslationToken[]): TranslationToken[] =>
  tokens.map((token) => {
    if (token.type === 'italic' || token.type === 'bold' || token.type === 'emphasis') {
      return { ...token, children: cloneTokens(token.children) };
    }
    return { ...token };
  });

export const updateTokenText = (tokens: TranslationToken[], chunkId: string, newText: string): boolean => {
  for (const token of tokens) {
    if (token.type === 'text' && token.chunkId === chunkId) {
      token.text = newText;
      return true;
    }

    if ((token.type === 'italic' || token.type === 'bold' || token.type === 'emphasis') && updateTokenText(token.children, chunkId, newText)) {
      return true;
    }
  }
  return false;
};

export const tokensToString = (tokens: TranslationToken[]): string => {
  return tokens
    .map((token) => {
      if (token.type === 'text') {
        return token.text;
      }
      if (token.type === 'footnote') {
        return `[${token.marker}]`;
      }
      if (token.type === 'illustration') {
        return `[${token.marker}]`;
      }
      if (token.type === 'linebreak') {
        return '<br />';
      }
      if (token.type === 'hr') {
        return '<hr />';
      }
      if (token.type === 'italic') {
        return `<i>${tokensToString(token.children)}</i>`;
      }
      if (token.type === 'bold') {
        return `<b>${tokensToString(token.children)}</b>`;
      }
      if (token.type === 'emphasis') {
        return `*${tokensToString(token.children)}*`;
      }
      return '';
    })
    .join('');
};
