// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  createPublicationManifest,
  validateLibraryPublication,
} from '../../scripts/lib/library-publication-integrity';

const session = () => ({
  novel: { id: 'test-novel', title: 'Test Novel' },
  version: { versionId: 'v1', displayName: 'Version 1' },
  chapters: [
    { chapterNumber: 1, stableId: 'ch1_a_b', canonicalUrl: 'https://source.example/chapter/1' },
    { chapterNumber: 2, stableId: 'ch2_c_d', canonicalUrl: 'https://source.example/chapter/2' },
    { chapterNumber: 4, stableId: 'ch4_e_f', canonicalUrl: 'https://source.example/chapter/4' },
  ],
});

const metadata = () => ({
  id: 'test-novel',
  title: 'Test Novel',
  metadata: {
    originalLanguage: 'Test',
    chapterCount: 5,
    genres: [],
    description: 'Test',
    lastUpdated: '2026-08-31',
  },
  versions: [{
    versionId: 'v1',
    displayName: 'Version 1',
    sessionJsonUrl: 'https://example.com/test-novel/session.json',
    chapterManifestUrl: 'https://example.com/test-novel/chapter-manifest.json',
    chapterRange: { from: 1, to: 4 },
    completionStatus: 'In Progress',
    stats: { content: { totalRawChapters: 3 } },
  }],
});

describe('library publication integrity', () => {
  it('creates a checksummed manifest from exact session identities', () => {
    const sessionValue = session();
    const sessionJson = JSON.stringify(sessionValue, null, 2);
    const manifest = createPublicationManifest({
      metadata: metadata() as any,
      session: sessionValue as any,
      sessionJson,
      generatedAt: '2026-08-31T00:00:00.000Z',
    });

    expect(manifest).toMatchObject({
      novelId: 'test-novel',
      versionId: 'v1',
      expectedChapterCount: 5,
      publishedChapterCount: 3,
      session: {
        url: 'https://example.com/test-novel/session.json',
        byteLength: Buffer.byteLength(sessionJson),
      },
    });
    expect(manifest.session.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.chapters.map((chapter) => chapter.chapterNumber)).toEqual([1, 2, 4]);
  });

  it('attaches exact per-chapter references by stable ID', () => {
    const sessionValue = session();
    const artifact = {
      url: 'https://example.com/test-novel/chapters/chapter-000002.json',
      sha256: 'a'.repeat(64),
      byteLength: 123,
    };
    const manifest = createPublicationManifest({
      metadata: metadata() as any,
      session: sessionValue as any,
      sessionJson: JSON.stringify(sessionValue, null, 2),
      generatedAt: '2026-08-31T00:00:00.000Z',
      chapterArtifacts: new Map([['ch2_c_d', artifact]]),
    });

    expect(manifest.chapters[0].artifact).toBeUndefined();
    expect(manifest.chapters[1].artifact).toEqual(artifact);
  });

  it.each([
    ['chapter number', (value: any) => { value.chapters[2].chapterNumber = 2; }],
    ['stable ID', (value: any) => { value.chapters[2].stableId = 'ch2_c_d'; }],
  ])('rejects a session with duplicate %s identities before manifest creation', (_label, mutate) => {
    const sessionValue = session();
    mutate(sessionValue);

    expect(() => createPublicationManifest({
      metadata: metadata() as any,
      session: sessionValue as any,
      sessionJson: JSON.stringify(sessionValue, null, 2),
      generatedAt: '2026-08-31T00:00:00.000Z',
    })).toThrow(/duplicate/i);
  });

  it('rejects metadata that claims complete when expected chapters are not published', () => {
    const metadataValue = metadata();
    metadataValue.versions[0].completionStatus = 'Complete';

    expect(() => createPublicationManifest({
      metadata: metadataValue as any,
      session: session() as any,
      sessionJson: JSON.stringify(session(), null, 2),
      generatedAt: '2026-08-31T00:00:00.000Z',
    })).toThrow(/Complete.*3.*5/i);
  });

  it('rejects altered session bytes and tuple mismatches at the publication gate', () => {
    const sessionValue = session();
    const sessionJson = JSON.stringify(sessionValue, null, 2);
    const manifest = createPublicationManifest({
      metadata: metadata() as any,
      session: sessionValue as any,
      sessionJson,
      generatedAt: '2026-08-31T00:00:00.000Z',
    });

    expect(() => validateLibraryPublication({
      metadata: metadata() as any,
      session: sessionValue as any,
      sessionJson: `${sessionJson}\n`,
      manifest,
    })).toThrow(/sha256|byteLength/i);

    const changedSession = session();
    changedSession.chapters[1].stableId = 'changed';
    expect(() => validateLibraryPublication({
      metadata: metadata() as any,
      session: changedSession as any,
      sessionJson,
      manifest,
    })).toThrow(/stableId.*chapter 2/i);
  });
});
