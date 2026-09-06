// @vitest-environment node

import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  buildChapterArtifacts,
} from '../../scripts/lib/chapter-artifact-builder';

const chapter = {
  chapterNumber: 42,
  stableId: 'ch42_exact_hash',
  canonicalUrl: 'lexiconforge://test-novel/chapter/42',
  title: 'Chapter 42',
  content: 'Exact source text',
  translations: [{ version: 1, translation: 'Exact translation', isActive: true }],
};

describe('chapter artifact builder', () => {
  it('emits a deterministic immutable envelope and byte reference', () => {
    const [artifact] = buildChapterArtifacts({
      novelId: 'test-novel',
      versionId: 'v1',
      chapters: [chapter],
      publicBaseUrl: 'https://media.example/novels/',
    });

    const digest = createHash('sha256').update(artifact.json, 'utf8').digest('hex');
    expect(artifact.fileName).toBe(`chapter-000042-${digest}.json`);
    expect(artifact.document).toEqual({
      format: 'lexiconforge-chapter-artifact',
      version: '1.0',
      novelId: 'test-novel',
      versionId: 'v1',
      chapter,
    });
    expect(artifact.reference).toEqual({
      url: `https://media.example/novels/test-novel/chapters/${artifact.fileName}`,
      sha256: digest,
      byteLength: Buffer.byteLength(artifact.json, 'utf8'),
    });
  });

  it.each(['../outside', 'nested/chapters', '.', '']) (
    'rejects unsafe artifact directory %j before output',
    (directoryName) => {
      expect(() => buildChapterArtifacts({
        novelId: 'test-novel',
        versionId: 'v1',
        chapters: [chapter],
        publicBaseUrl: 'https://media.example/novels',
        directoryName,
      })).toThrow(/one safe directory name/i);
    }
  );
});
