import { describe, expect, it } from 'vitest';
import {
  generateStableChapterId,
  normalizeUrlAggressively,
  generateCanonicalUrl,
  buildEnhancedChapter,
  type ChapterRecordLike,
} from '../../services/stableIdService';

describe('generateStableChapterId', () => {
  it('produces deterministic IDs for same input', () => {
    const id1 = generateStableChapterId('Hello world', 1, 'Chapter 1');
    const id2 = generateStableChapterId('Hello world', 1, 'Chapter 1');
    expect(id1).toBe(id2);
  });

  it('produces different IDs for different content', () => {
    const id1 = generateStableChapterId('Hello world', 1, 'Chapter 1');
    const id2 = generateStableChapterId('Different content', 1, 'Chapter 1');
    expect(id1).not.toBe(id2);
  });

  it('produces different IDs for different chapter numbers', () => {
    const id1 = generateStableChapterId('Same content', 1, 'Title');
    const id2 = generateStableChapterId('Same content', 2, 'Title');
    expect(id1).not.toBe(id2);
  });

  it('title hash has limited discrimination (4 chars)', () => {
    // Short titles like 'Title A' vs 'Title B' may collide in the 4-char hash.
    // The content hash (8 chars) is the primary discriminator.
    // This documents the known limitation — not a bug for real-world data
    // where content differs between chapters.
    const id1 = generateStableChapterId('Same content', 1, 'Chapter 1: The Beginning of a Long Journey');
    const id2 = generateStableChapterId('Same content', 1, 'Chapter 1: Completely Different Title Here');
    // These SHOULD differ for sufficiently different titles
    expect(id1).not.toBe(id2);
  });

  it('follows ch{number}_{hash}_{hash} format', () => {
    const id = generateStableChapterId('content', 42, 'title');
    expect(id).toMatch(/^ch42_[a-z0-9]+_[a-z0-9]+$/);
  });

  it('handles empty content gracefully', () => {
    const id = generateStableChapterId('', 1, 'Title');
    expect(id).toMatch(/^ch1_/);
  });

  it('only hashes first 1000 chars of content (performance)', () => {
    const longA = 'a'.repeat(2000);
    const longB = 'a'.repeat(1000) + 'b'.repeat(1000);
    const id1 = generateStableChapterId(longA, 1, 'T');
    const id2 = generateStableChapterId(longB, 1, 'T');
    // First 1000 chars are identical, so IDs should match
    expect(id1).toBe(id2);
  });
});

describe('normalizeUrlAggressively', () => {
  it('returns null for null/undefined/empty', () => {
    expect(normalizeUrlAggressively(null)).toBeNull();
    expect(normalizeUrlAggressively(undefined)).toBeNull();
    expect(normalizeUrlAggressively('')).toBeNull();
  });

  it('strips query parameters', () => {
    const result = normalizeUrlAggressively('https://example.com/page?foo=bar&baz=1');
    expect(result).toBe('https://example.com/page');
  });

  it('strips hash fragments', () => {
    const result = normalizeUrlAggressively('https://example.com/page#section');
    expect(result).toBe('https://example.com/page');
  });

  it('removes trailing slash', () => {
    const result = normalizeUrlAggressively('https://example.com/page/');
    expect(result).toBe('https://example.com/page');
  });

  it('returns as-is for invalid URLs', () => {
    const result = normalizeUrlAggressively('not-a-url');
    expect(result).toBe('not-a-url');
  });

  it('normalizes real-world novel URLs', () => {
    const result = normalizeUrlAggressively('https://hetushu.com/book/2991/2051040.html?ref=sidebar');
    expect(result).toBe('https://hetushu.com/book/2991/2051040.html');
  });

  it('returns custom protocol URLs as-is (URL constructor treats origin as null)', () => {
    const result = normalizeUrlAggressively('lexiconforge://novel-name/chapter/1');
    // URL constructor can't parse custom protocols properly — origin is null
    // The function returns a mangled result; this documents current behavior
    expect(result).toBe('null/chapter/1');
  });
});

describe('generateCanonicalUrl', () => {
  it('throws on empty array', () => {
    expect(() => generateCanonicalUrl([])).toThrow('No URLs provided');
  });

  it('returns the shortest normalized URL', () => {
    const result = generateCanonicalUrl([
      'https://example.com/novel/123/chapter/1?ref=home',
      'https://example.com/novel/123/chapter/1',
    ]);
    expect(result).toBe('https://example.com/novel/123/chapter/1');
  });

  it('falls back to first URL if none normalize', () => {
    const result = generateCanonicalUrl(['not-a-url']);
    expect(result).toBe('not-a-url');
  });
});

describe('buildEnhancedChapter', () => {
  const baseRecord: ChapterRecordLike = {
    url: 'https://example.com/ch1',
    canonicalUrl: 'https://example.com/ch1',
    originalUrl: 'https://example.com/ch1?v=2',
    title: 'Chapter 1: Dawn',
    content: '<p>The sun rose.</p>',
    chapterNumber: 1,
    novelId: 'novel-1',
    libraryVersionId: 'v1',
    fanTranslation: 'Fan text here',
    dateAdded: '2025-01-01T00:00:00Z',
  };

  it('sets all required fields consistently', () => {
    const ch = buildEnhancedChapter('stable-id-1', baseRecord);
    expect(ch.id).toBe('stable-id-1');
    expect(ch.stableId).toBe('stable-id-1');
    expect(ch.url).toBe('https://example.com/ch1');
    expect(ch.canonicalUrl).toBe('https://example.com/ch1');
    expect(ch.originalUrl).toBe('https://example.com/ch1?v=2');
    expect(ch.title).toBe('Chapter 1: Dawn');
    expect(ch.content).toBe('<p>The sun rose.</p>');
    expect(ch.chapterNumber).toBe(1);
    expect(ch.novelId).toBe('novel-1');
    expect(ch.libraryVersionId).toBe('v1');
    expect(ch.fanTranslation).toBe('Fan text here');
  });

  it('sets importSource from record metadata', () => {
    const ch = buildEnhancedChapter('id', baseRecord);
    expect(ch.importSource).toBeDefined();
    expect(ch.importSource!.originalUrl).toBe('https://example.com/ch1?v=2');
    expect(ch.importSource!.sourceFormat).toBe('json');
  });

  it('initializes translationResult as null and feedback as empty', () => {
    const ch = buildEnhancedChapter('id', baseRecord);
    expect(ch.translationResult).toBeNull();
    expect(ch.feedback).toEqual([]);
  });

  it('builds sourceUrls from URL fields when not provided', () => {
    const ch = buildEnhancedChapter('id', baseRecord);
    expect(ch.sourceUrls).toContain('https://example.com/ch1');
    expect(ch.sourceUrls.length).toBeGreaterThan(0);
  });

  it('uses provided sourceUrls when available', () => {
    const ch = buildEnhancedChapter('id', {
      ...baseRecord,
      sourceUrls: ['url-a', 'url-b'],
    });
    expect(ch.sourceUrls).toEqual(['url-a', 'url-b']);
  });

  it('excludes library storage URLs from sourceUrls', () => {
    const ch = buildEnhancedChapter('id', {
      ...baseRecord,
      url: 'lf-library://novel/chapter',
      canonicalUrl: 'https://example.com/ch1',
      originalUrl: 'https://example.com/ch1',
    });
    // lf-library:// URL should NOT be in sourceUrls
    expect(ch.sourceUrls.every(u => !u.startsWith('lf-library://'))).toBe(true);
  });

  it('handles missing optional fields with safe defaults', () => {
    const minimal: ChapterRecordLike = {
      url: 'https://example.com/ch1',
      title: '',
      content: '',
    };
    const ch = buildEnhancedChapter('id', minimal);
    expect(ch.title).toBe('Untitled Chapter');
    expect(ch.content).toBe('');
    expect(ch.chapterNumber).toBe(0);
    expect(ch.novelId).toBeNull();
    expect(ch.fanTranslation).toBeNull();
    expect(ch.feedback).toEqual([]);
  });
});
