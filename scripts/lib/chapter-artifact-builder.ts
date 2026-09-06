import { toMediaGitHubUrl } from '../../services/library/artifactUrl';
import type {
  ChapterArtifactDocument,
  ChapterArtifactReference,
  PublishedChapterArtifactPayload,
} from '../../types/chapterManifest';
import { sha256Utf8 } from './library-publication-integrity';

export interface BuiltChapterArtifact {
  fileName: string;
  document: ChapterArtifactDocument;
  json: string;
  reference: ChapterArtifactReference;
}

interface BuildChapterArtifactsInput {
  novelId: string;
  versionId: string;
  chapters: PublishedChapterArtifactPayload[];
  publicBaseUrl: string;
  directoryName?: string;
}

export const resolveChapterArtifactDirectoryName = (value = 'chapters'): string => {
  if (value === '.' || value === '..' || !/^[a-zA-Z0-9._-]+$/.test(value)) {
    throw new Error('chapter artifact directory must be one safe directory name.');
  }
  return value;
};

export const buildChapterArtifacts = ({
  novelId,
  versionId,
  chapters,
  publicBaseUrl,
  directoryName = 'chapters',
}: BuildChapterArtifactsInput): BuiltChapterArtifact[] => {
  const baseUrl = publicBaseUrl.replace(/\/$/, '');
  const artifactDirectory = resolveChapterArtifactDirectoryName(directoryName);

  return chapters.map((chapter) => {
    const document: ChapterArtifactDocument = {
      format: 'lexiconforge-chapter-artifact',
      version: '1.0',
      novelId,
      versionId,
      chapter,
    };
    const json = JSON.stringify(document, null, 2);
    const sha256 = sha256Utf8(json);
    const fileName = `chapter-${String(chapter.chapterNumber).padStart(6, '0')}-${sha256}.json`;
    return {
      fileName,
      document,
      json,
      reference: {
        url: toMediaGitHubUrl(`${baseUrl}/${novelId}/${artifactDirectory}/${fileName}`),
        sha256,
        byteLength: Buffer.byteLength(json, 'utf8'),
      },
    };
  });
};

export const indexChapterArtifactReferences = (
  artifacts: BuiltChapterArtifact[]
): ReadonlyMap<string, ChapterArtifactReference> => new Map(
  artifacts.map((artifact) => [artifact.document.chapter.stableId, artifact.reference])
);
