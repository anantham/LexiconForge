import { describe, expect, it, vi } from 'vitest';

import {
  ChapterManifestIntegrityError,
  fetchChapterManifest,
  validateChapterManifest,
} from '../../services/library/chapterManifestService';

const validManifest = () => ({
  format: 'lexiconforge-chapter-manifest',
  version: '1.0',
  novelId: 'test-novel',
  versionId: 'v1',
  generatedAt: '2026-08-31T00:00:00.000Z',
  expectedChapterCount: 5,
  publishedChapterCount: 3,
  session: {
    url: 'https://example.com/test-novel/session.json',
    sha256: 'a'.repeat(64),
    byteLength: 1234,
  },
  chapters: [
    { chapterNumber: 1, stableId: 'ch1_a_b', canonicalUrl: 'https://source.example/chapter/1' },
    { chapterNumber: 2, stableId: 'ch2_c_d', canonicalUrl: 'https://source.example/chapter/2' },
    { chapterNumber: 4, stableId: 'ch4_e_f', canonicalUrl: 'https://source.example/chapter/4' },
  ],
});

describe('chapterManifestService', () => {
  it('accepts exact ordered, non-contiguous published identities', () => {
    const result = validateChapterManifest(validManifest(), {
      novelId: 'test-novel',
      versionId: 'v1',
    });

    expect(result.chapters.map((chapter) => chapter.chapterNumber)).toEqual([1, 2, 4]);
    expect(result.publishedChapterCount).toBe(3);
    expect(result.expectedChapterCount).toBe(5);
  });

  it.each([
    ['chapter number', (manifest: any) => { manifest.chapters[2].chapterNumber = 2; }],
    ['stable ID', (manifest: any) => { manifest.chapters[2].stableId = 'ch2_c_d'; }],
  ])('rejects duplicate %s identities', (_label, mutate) => {
    const manifest = validManifest();
    mutate(manifest);

    expect(() => validateChapterManifest(manifest)).toThrow(ChapterManifestIntegrityError);
    expect(() => validateChapterManifest(manifest)).toThrow(/duplicate/i);
  });

  it('rejects count and expected-context mismatches descriptively', () => {
    const manifest = validManifest();
    manifest.publishedChapterCount = 4;

    expect(() => validateChapterManifest(manifest)).toThrow(/publishedChapterCount.*4.*3/i);
    expect(() => validateChapterManifest(validManifest(), { novelId: 'other', versionId: 'v1' }))
      .toThrow(/novelId.*other.*test-novel/i);
  });

  it('rejects metadata/session drift in the live registry contract', () => {
    expect(() => validateChapterManifest(validManifest(), {
      novelId: 'test-novel',
      versionId: 'v1',
      sessionUrl: 'https://example.com/other-session.json',
    })).toThrow(/expected session URL.*other-session.*session\.json/i);

    expect(() => validateChapterManifest(validManifest(), {
      expectedChapterCount: 6,
    })).toThrow(/expectedChapterCount 5.*metadata chapterCount 6/i);

    expect(() => validateChapterManifest(validManifest(), {
      chapterRange: { from: 1, to: 5 },
    })).toThrow(/chapterRange 1-5.*endpoints 1-4/i);
  });

  it('fetches and validates a manifest before returning any identities', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => validManifest(),
    }));

    const result = await fetchChapterManifest(
      'https://example.com/test-novel/chapter-manifest.json',
      { novelId: 'test-novel', versionId: 'v1' }
    );

    expect(result.publishedChapterCount).toBe(3);
    vi.unstubAllGlobals();
  });

  it('fails loudly when a declared manifest cannot be acquired', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Unavailable',
    }));

    await expect(fetchChapterManifest(
      'https://example.com/test-novel/chapter-manifest.json',
      { novelId: 'test-novel', versionId: 'v1' }
    )).rejects.toThrow(/503.*Unavailable/i);
    vi.unstubAllGlobals();
  });
});
