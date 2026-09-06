import type { ChapterPublicationManifest } from '../../types/chapterManifest';
import type { NovelEntry, NovelVersion } from '../../types/novel';
import { RegistryService } from '../registryService';
import { fetchChapterManifest } from './chapterManifestService';

export interface ExpectedChapterPublication {
  count: number | null;
  numbers: number[] | null;
  manifest: ChapterPublicationManifest | null;
}

const manifestContextFor = (novel: NovelEntry, version: NovelVersion) => ({
  novelId: novel.id,
  versionId: version.versionId,
  sessionUrl: version.sessionJsonUrl,
  expectedChapterCount: novel.metadata.chapterCount,
  publishedChapterCount: version.stats?.content?.totalRawChapters,
  chapterRange: version.chapterRange,
  completionStatus: version.completionStatus,
});

export const fetchVersionChapterManifest = (
  novel: NovelEntry,
  version: NovelVersion
): Promise<ChapterPublicationManifest> => fetchChapterManifest(
  version.chapterManifestUrl as string,
  manifestContextFor(novel, version)
);

/** Number of raw chapters expected in the selected packaged version. */
export const resolveExpectedChapterCount = (
  novel: NovelEntry,
  versionId: string | null
): number | null => {
  const version = RegistryService.resolveCompatibleVersion(novel, versionId).version;
  const packagedCount = version?.stats?.content?.totalRawChapters;
  if (typeof packagedCount === 'number' && Number.isSafeInteger(packagedCount) && packagedCount > 0) {
    return packagedCount;
  }

  if (
    typeof version?.chapterRange?.from === 'number' &&
    typeof version.chapterRange.to === 'number' &&
    version.chapterRange.from > 0 &&
    version.chapterRange.to >= version.chapterRange.from
  ) {
    return version.chapterRange.to - version.chapterRange.from + 1;
  }

  const novelCount = novel.metadata?.chapterCount;
  return typeof novelCount === 'number' && Number.isSafeInteger(novelCount) && novelCount > 0
    ? novelCount
    : null;
};

/** Exact legacy range identities used only when no manifest is declared. */
export const resolveExpectedChapterNumbers = (
  novel: NovelEntry,
  versionId: string | null
): number[] | null => {
  const version = RegistryService.resolveCompatibleVersion(novel, versionId).version;
  const range = version?.chapterRange;

  if (
    Number.isSafeInteger(range?.from) &&
    Number.isSafeInteger(range?.to) &&
    (range?.from ?? 0) > 0 &&
    (range?.to ?? 0) >= (range?.from ?? 0)
  ) {
    const from = range!.from;
    const to = range!.to;
    const rangeCount = to - from + 1;
    const packagedCount = version?.stats?.content?.totalRawChapters;
    if (
      typeof packagedCount === 'number' &&
      Number.isSafeInteger(packagedCount) &&
      packagedCount > 0 &&
      packagedCount !== rangeCount
    ) {
      return null;
    }
    return Array.from({ length: rangeCount }, (_, index) => from + index);
  }

  if (!version) {
    const novelCount = novel.metadata?.chapterCount;
    if (typeof novelCount === 'number' && Number.isSafeInteger(novelCount) && novelCount > 0) {
      return Array.from({ length: novelCount }, (_, index) => index + 1);
    }
  }

  return null;
};

/** Resolve authoritative manifest identities, or the legacy range contract. */
export const resolveExpectedChapterPublication = async (
  novel: NovelEntry,
  versionId: string | null
): Promise<ExpectedChapterPublication> => {
  const version = RegistryService.resolveCompatibleVersion(novel, versionId).version;
  if (version?.chapterManifestUrl) {
    const manifest = await fetchVersionChapterManifest(novel, version);
    return {
      count: manifest.publishedChapterCount,
      numbers: manifest.chapters.map((chapter) => chapter.chapterNumber),
      manifest,
    };
  }

  return {
    count: resolveExpectedChapterCount(novel, versionId),
    numbers: resolveExpectedChapterNumbers(novel, versionId),
    manifest: null,
  };
};
