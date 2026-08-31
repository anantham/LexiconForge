import { createHash } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MAX_CHAPTER_ARTIFACT_BYTES,
  fetchChapterArtifact,
} from '../../services/library/chapterArtifactService';

const identity = {
  chapterNumber: 42,
  stableId: 'ch42_exact_hash',
  canonicalUrl: 'lexiconforge://test-novel/chapter/42',
};
const document = () => ({
  format: 'lexiconforge-chapter-artifact',
  version: '1.0',
  novelId: 'test-novel',
  versionId: 'v1',
  chapter: {
    ...identity,
    title: 'Chapter 42',
    content: 'Exact chapter content',
    translations: [{ version: 1, translation: 'Exact translation' }],
  },
});
const referenceFor = (text: string) => ({
  url: 'https://media.example/test-novel/chapters/chapter-000042.json',
  sha256: createHash('sha256').update(text, 'utf8').digest('hex'),
  byteLength: Buffer.byteLength(text, 'utf8'),
});

afterEach(() => vi.unstubAllGlobals());

describe('chapter artifact service', () => {
  it('verifies exact bytes before accepting the manifest identity tuple', async () => {
    const text = JSON.stringify(document(), null, 2);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(text, { status: 200 })));

    await expect(fetchChapterArtifact(referenceFor(text), {
      novelId: 'test-novel',
      versionId: 'v1',
      identity,
    })).resolves.toEqual(document());
  });

  it('rejects altered bytes even when they remain valid JSON', async () => {
    const text = JSON.stringify(document(), null, 2);
    const altered = text.replace('Exact chapter content', 'Wrong chapter content');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(altered, { status: 200 })));

    await expect(fetchChapterArtifact(referenceFor(text), {
      novelId: 'test-novel',
      versionId: 'v1',
      identity,
    })).rejects.toThrow(/SHA-256.*does not match/i);
  });

  it('rejects a tuple mismatch even when the artifact hash is valid', async () => {
    const changed = document();
    changed.chapter.chapterNumber = 41;
    const text = JSON.stringify(changed, null, 2);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(text, { status: 200 })));

    await expect(fetchChapterArtifact(referenceFor(text), {
      novelId: 'test-novel',
      versionId: 'v1',
      identity,
    })).rejects.toThrow(/tuple does not match/i);
  });

  it('rejects oversized declarations and HTTP failures before parsing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchChapterArtifact({
      url: 'https://media.example/too-large.json',
      sha256: 'a'.repeat(64),
      byteLength: MAX_CHAPTER_ARTIFACT_BYTES + 1,
    }, {
      novelId: 'test-novel',
      versionId: 'v1',
      identity,
    })).rejects.toThrow(/browser limit/i);
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(new Response('missing', { status: 404, statusText: 'Not Found' }));
    await expect(fetchChapterArtifact({
      url: 'https://media.example/missing.json',
      sha256: 'a'.repeat(64),
      byteLength: 7,
    }, {
      novelId: 'test-novel',
      versionId: 'v1',
      identity,
    })).rejects.toThrow(/HTTP 404 Not Found/i);
  });
});
