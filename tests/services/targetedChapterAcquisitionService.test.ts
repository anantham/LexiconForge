import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  fetchNovelByIdMock,
  fetchManifestMock,
  fetchArtifactMock,
  importFullSessionDataMock,
  findByNumberMock,
} = vi.hoisted(() => ({
  fetchNovelByIdMock: vi.fn(),
  fetchManifestMock: vi.fn(),
  fetchArtifactMock: vi.fn(),
  importFullSessionDataMock: vi.fn(),
  findByNumberMock: vi.fn(),
}));

vi.mock('../../services/registryService', () => ({
  RegistryService: { fetchNovelById: fetchNovelByIdMock },
}));
vi.mock('../../services/library/chapterPublicationResolver', () => ({
  fetchVersionChapterManifest: fetchManifestMock,
}));
vi.mock('../../services/library/chapterArtifactService', () => ({
  fetchChapterArtifact: fetchArtifactMock,
}));
vi.mock('../../services/db/operations', () => ({
  ImportOps: { importFullSessionData: importFullSessionDataMock },
  ChapterOps: { findByNumber: findByNumberMock },
}));

import { acquirePublishedChapter } from '../../services/library/targetedChapterAcquisitionService';

const version = {
  versionId: 'v1',
  chapterManifestUrl: 'https://media.example/manifest.json',
};
const identity = {
  chapterNumber: 42,
  stableId: 'ch42_exact_hash',
  canonicalUrl: 'lexiconforge://test-novel/chapter/42',
  artifact: { url: 'https://media.example/42.json', sha256: 'a'.repeat(64), byteLength: 100 },
};
const artifact = {
  format: 'lexiconforge-chapter-artifact',
  version: '1.0',
  novelId: 'test-novel',
  versionId: 'v1',
  chapter: {
    chapterNumber: identity.chapterNumber,
    stableId: identity.stableId,
    canonicalUrl: identity.canonicalUrl,
    title: 'Chapter 42',
    content: 'Content',
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchNovelByIdMock.mockResolvedValue({ id: 'test-novel', versions: [version] });
  fetchManifestMock.mockResolvedValue({ chapters: [identity] });
  fetchArtifactMock.mockResolvedValue(artifact);
  importFullSessionDataMock.mockResolvedValue(undefined);
  findByNumberMock.mockResolvedValue({ stableId: 'scoped-ch42' });
});

describe('targeted chapter acquisition', () => {
  it('verifies, imports, and hydrates exactly one scoped published chapter', async () => {
    const hydrated = { id: 'scoped-ch42', chapterNumber: 42 } as any;
    const loadChapterFromIDB = vi.fn().mockResolvedValue(hydrated);

    await expect(acquirePublishedChapter({
      novelId: 'test-novel',
      versionId: 'v1',
      chapterNumber: 42,
      loadChapterFromIDB,
    })).resolves.toEqual({ chapterId: 'scoped-ch42', chapter: hydrated });

    expect(fetchArtifactMock).toHaveBeenCalledWith(identity.artifact, {
      novelId: 'test-novel',
      versionId: 'v1',
      identity,
    });
    expect(importFullSessionDataMock).toHaveBeenCalledWith({
      novelId: 'test-novel',
      libraryVersionId: 'v1',
      chapters: [artifact.chapter],
    });
    expect(findByNumberMock).toHaveBeenCalledWith(42, 'test-novel', 'v1');
    expect(loadChapterFromIDB).toHaveBeenCalledWith('scoped-ch42');
  });

  it('does not write when the manifest identity lacks an artifact', async () => {
    fetchManifestMock.mockResolvedValue({ chapters: [{ ...identity, artifact: undefined }] });

    await expect(acquirePublishedChapter({
      novelId: 'test-novel',
      versionId: 'v1',
      chapterNumber: 42,
      loadChapterFromIDB: vi.fn(),
    })).rejects.toMatchObject({ code: 'artifact_unavailable' });
    expect(fetchArtifactMock).not.toHaveBeenCalled();
    expect(importFullSessionDataMock).not.toHaveBeenCalled();
  });

  it('wraps verification or persistence failures without falling back', async () => {
    fetchArtifactMock.mockRejectedValue(new Error('checksum mismatch'));

    await expect(acquirePublishedChapter({
      novelId: 'test-novel',
      versionId: 'v1',
      chapterNumber: 42,
      loadChapterFromIDB: vi.fn(),
    })).rejects.toMatchObject({
      code: 'artifact_acquisition_failed',
      message: expect.stringContaining('checksum mismatch'),
    });
    expect(importFullSessionDataMock).not.toHaveBeenCalled();
  });
});
