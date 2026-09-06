import type { EnhancedChapter } from '../stableIdService';
import { ChapterOps, ImportOps } from '../db/operations';
import { RegistryService } from '../registryService';
import { fetchChapterArtifact } from './chapterArtifactService';
import { fetchVersionChapterManifest } from './chapterPublicationResolver';

export type TargetedAcquisitionFailureCode =
  | 'artifact_unavailable'
  | 'artifact_acquisition_failed';

export class TargetedChapterAcquisitionError extends Error {
  public readonly code: TargetedAcquisitionFailureCode;

  constructor(
    _code: TargetedAcquisitionFailureCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'TargetedChapterAcquisitionError';
    this.code = _code;
  }
}

interface AcquirePublishedChapterInput {
  novelId: string;
  versionId: string;
  chapterNumber: number;
  loadChapterFromIDB: (_chapterId: string) => Promise<EnhancedChapter | null>;
}

export interface AcquiredPublishedChapter {
  chapterId: string;
  chapter: EnhancedChapter;
}

const unavailable = (message: string): never => {
  throw new TargetedChapterAcquisitionError('artifact_unavailable', message);
};

export const acquirePublishedChapter = async ({
  novelId,
  versionId,
  chapterNumber,
  loadChapterFromIDB,
}: AcquirePublishedChapterInput): Promise<AcquiredPublishedChapter> => {
  try {
    const novel = await RegistryService.fetchNovelById(novelId);
    if (!novel) return unavailable(`Novel "${novelId}" is not present in the active registry.`);
    const version = novel.versions?.find((candidate) => candidate.versionId === versionId);
    if (!version?.chapterManifestUrl) {
      return unavailable(`Version "${versionId}" does not publish targeted chapter artifacts.`);
    }

    const manifest = await fetchVersionChapterManifest(novel, version);
    const identity = manifest.chapters.find((candidate) => candidate.chapterNumber === chapterNumber);
    if (!identity) {
      return unavailable(`Chapter ${chapterNumber} is not published by version "${versionId}".`);
    }
    if (!identity.artifact) {
      return unavailable(`Chapter ${chapterNumber} has no independently downloadable artifact yet.`);
    }

    const document = await fetchChapterArtifact(identity.artifact, { novelId, versionId, identity });
    await ImportOps.importFullSessionData({
      novelId,
      libraryVersionId: versionId,
      chapters: [document.chapter],
    });

    const stored = await ChapterOps.findByNumber(chapterNumber, novelId, versionId);
    if (!stored?.stableId) {
      throw new Error('the verified chapter was not found after IndexedDB import');
    }
    const chapter = await loadChapterFromIDB(stored.stableId);
    if (!chapter) {
      throw new Error('the verified chapter could not be hydrated after IndexedDB import');
    }
    return { chapterId: stored.stableId, chapter };
  } catch (error) {
    if (error instanceof TargetedChapterAcquisitionError) throw error;
    throw new TargetedChapterAcquisitionError(
      'artifact_acquisition_failed',
      `Could not acquire chapter ${chapterNumber} for ${novelId}/${versionId}: ` +
        `${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
};
