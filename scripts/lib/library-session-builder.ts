/**
 * Build hosted-library metadata.json + session.json artifacts from parsed sources.
 */

import type { NovelEntry, NovelVersion, SourceLinks } from '../../types/novel';
import type { SessionData } from '../../types/session';
import {
  loadAlignmentMap,
  resolveAlignmentTarget,
} from './alignment-map';
import type { AlignmentMap } from './chapter-alignment-types';
import type {
  SourceChapterRange,
  TranslationSourceOutput,
  TranslatorMetadata,
} from './translation-source-types';
import { findAdapter } from './translation-sources';

export interface BuildRange {
  from: number;
  to: number;
}

export interface SourceOverride extends Partial<TranslatorMetadata> {
  id?: string;
}

export interface BuildNovelMetadata {
  id: string;
  title: string;
  alternateTitles?: string[];
  author?: string;
  originalLanguage: string;
  targetLanguage: string;
  chapterCount?: number;
  genres: string[];
  description: string;
  coverImageUrl?: string;
  publicationStatus?: 'Ongoing' | 'Completed' | 'Hiatus' | 'Cancelled';
  originalPublicationDate?: string;
  sourceLinks?: SourceLinks;
  tags?: string[];
  lastUpdated?: string;
}

export interface BuildVersionMetadata {
  versionId: string;
  displayName: string;
  translator: {
    name: string;
    link?: string;
    bio?: string;
  };
  style: NovelVersion['style'];
  features: string[];
  completionStatus: NovelVersion['completionStatus'];
  targetLanguage: string;
  description?: string;
  translationPhilosophy?: string;
  contentNotes?: string;
  translationType?: NovelVersion['stats']['translation']['translationType'];
  qualityRating?: number;
}

export interface BuildSourceSpec {
  path: string;
  translator?: SourceOverride;
  ranges?: BuildRange[];
  label?: string;
  alignmentMapPath?: string;
}

export interface BuildOutputConfig {
  novelsRoot: string;
  registryPath?: string;
  publicBaseUrl?: string;
  metadataFileName?: string;
  sessionFileName?: string;
  reportFileName?: string;
}

export interface LibraryBuildManifest {
  novel: BuildNovelMetadata;
  version: BuildVersionMetadata;
  sources: {
    raw: BuildSourceSpec;
    fan: BuildSourceSpec[];
  };
  output: BuildOutputConfig;
}

export interface FanSourceMatch {
  chapterNumber: number;
  title: string;
  text: string;
  sourcePath: string;
  sourceLabel: string;
  translatorName: string;
}

export interface LibraryBuildWarning {
  chapterNumber: number;
  kind:
    | 'missing-fan-translation'
    | 'ambiguous-range-match'
    | 'alignment-unresolved'
    | 'alignment-map-missing-exact';
  message: string;
}

export interface LibraryBuildReport {
  novelId: string;
  generatedAt: string;
  rawChapterCount: number;
  sessionChapterCount: number;
  translatedChapterCount: number;
  warnings: LibraryBuildWarning[];
  sources: Array<{
    path: string;
    label: string;
    translator: string;
    loadedChapterCount: number;
    alignmentMapPath?: string;
    selectedRanges?: BuildRange[];
  }>;
}

export interface LoadedSource {
  spec: BuildSourceSpec;
  source: TranslationSourceOutput;
  alignmentMap?: AlignmentMap;
}

const today = (): string => new Date().toISOString().split('T')[0];

const simpleHash = (value: string): string => {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    const char = value.charCodeAt(index);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const generateStableChapterId = (content: string, chapterNumber: number, title: string): string => {
  const contentHash = simpleHash(content.substring(0, 1000));
  const titleHash = simpleHash(title);
  return `ch${chapterNumber}_${contentHash.substring(0, 8)}_${titleHash.substring(0, 4)}`;
};

const rangeIncludes = (range: BuildRange | SourceChapterRange, chapterNumber: number): boolean => (
  chapterNumber >= range.from && chapterNumber <= range.to
);

const sourceChapterText = (chapter: TranslationSourceOutput['chapters'][number]): string => chapter.paragraphs
  .map((paragraph) => paragraph.text)
  .filter(Boolean)
  .join('\n\n');

const withOverride = (
  output: TranslationSourceOutput,
  override?: SourceOverride
): TranslationSourceOutput => {
  if (!override) {
    return output;
  }

  return {
    ...output,
    translatorId: override.id || output.translatorId,
    translator: {
      ...output.translator,
      ...override,
      name: override.name || output.translator.name,
      language: override.language || output.translator.language,
    },
  };
};

export const loadSource = async (spec: BuildSourceSpec): Promise<LoadedSource> => {
  const adapter = findAdapter(spec.path);
  if (!adapter) {
    throw new Error(`No source adapter found for ${spec.path}`);
  }

  const extracted = await adapter.extract(spec.path);
  return {
    spec,
    source: withOverride(extracted, spec.translator),
    ...(spec.alignmentMapPath ? { alignmentMap: loadAlignmentMap(spec.alignmentMapPath) } : {}),
  };
};

const buildFanIndexes = (fanSources: LoadedSource[]) => fanSources.map(({ spec, source, alignmentMap }) => {
  const exact = new Map<number, TranslationSourceOutput['chapters'][number]>();
  const ranged: TranslationSourceOutput['chapters'][number][] = [];

  for (const chapter of source.chapters) {
    const isMergedRange = chapter.chapterRange && chapter.chapterRange.to !== chapter.chapterRange.from;
    if (!isMergedRange) {
      exact.set(chapter.chapterNumber, chapter);
    }
    if (isMergedRange) {
      ranged.push(chapter);
    }
  }

  return {
    spec,
    source,
    alignmentMap,
    exact,
    ranged,
  };
});

export const resolveFanTranslationForChapter = (
  chapterNumber: number,
  fanSources: LoadedSource[]
): { match: FanSourceMatch | null; warnings: LibraryBuildWarning[] } => {
  const warnings: LibraryBuildWarning[] = [];
  const indexedSources = buildFanIndexes(fanSources);

  for (const candidate of indexedSources) {
    const configuredRanges = candidate.spec.ranges || [];
    if (configuredRanges.length > 0 && !configuredRanges.some((range) => rangeIncludes(range, chapterNumber))) {
      continue;
    }

    if (candidate.alignmentMap) {
      const target = resolveAlignmentTarget(candidate.alignmentMap, chapterNumber);

      if (target.status === 'exact' && typeof target.englishChapterNumber === 'number') {
        const exactFromMap = candidate.exact.get(target.englishChapterNumber);
        if (exactFromMap) {
          return {
            match: {
              chapterNumber,
              title: exactFromMap.title,
              text: sourceChapterText(exactFromMap),
              sourcePath: candidate.spec.path,
              sourceLabel: candidate.spec.label || candidate.spec.path,
              translatorName: candidate.source.translator.name,
            },
            warnings,
          };
        }

        warnings.push({
          chapterNumber,
          kind: 'alignment-map-missing-exact',
          message: `Alignment map ${candidate.spec.alignmentMapPath} expected English chapter ${target.englishChapterNumber} for raw chapter ${chapterNumber}, but no exact extracted chapter was found in ${candidate.spec.label || candidate.spec.path}.`,
        });
        return { match: null, warnings };
      }

      if (target.status === 'merged' && target.segment?.english) {
        warnings.push({
          chapterNumber,
          kind: 'ambiguous-range-match',
          message: `Alignment map ${candidate.spec.alignmentMapPath} marks raw chapter ${chapterNumber} as part of merged English chapter ${target.segment.english.from}-${target.segment.english.to} in ${candidate.spec.label || candidate.spec.path}; skipping automatic attachment.`,
        });
        return { match: null, warnings };
      }

      if (target.status === 'unresolved') {
        warnings.push({
          chapterNumber,
          kind: 'alignment-unresolved',
          message: `Alignment map ${candidate.spec.alignmentMapPath} could not resolve a verified English chapter for raw chapter ${chapterNumber}.`,
        });
        return { match: null, warnings };
      }

      if (target.status === 'missing') {
        warnings.push({
          chapterNumber,
          kind: 'missing-fan-translation',
          message: `Alignment map ${candidate.spec.alignmentMapPath} has no segment covering raw chapter ${chapterNumber}.`,
        });
        return { match: null, warnings };
      }
    }

    const exactMatch = candidate.exact.get(chapterNumber);
    if (exactMatch) {
      return {
        match: {
          chapterNumber,
          title: exactMatch.title,
          text: sourceChapterText(exactMatch),
          sourcePath: candidate.spec.path,
          sourceLabel: candidate.spec.label || candidate.spec.path,
          translatorName: candidate.source.translator.name,
        },
        warnings,
      };
    }

    const rangedMatch = candidate.ranged.find((chapter) => chapter.chapterRange && rangeIncludes(chapter.chapterRange, chapterNumber));
    if (rangedMatch?.chapterRange) {
      warnings.push({
        chapterNumber,
        kind: 'ambiguous-range-match',
        message: `Skipped ${candidate.spec.label || candidate.spec.path} chapter ${rangedMatch.chapterRange.from}-${rangedMatch.chapterRange.to} for raw chapter ${chapterNumber} to avoid silently attaching merged fan-translation text.`,
      });
      return { match: null, warnings };
    }
  }

  warnings.push({
    chapterNumber,
    kind: 'missing-fan-translation',
    message: `No fan translation source matched chapter ${chapterNumber}.`,
  });
  return { match: null, warnings };
};

const buildSessionMetadata = (manifest: LibraryBuildManifest, exportedAt: string, rawChapterCount: number) => ({
  format: 'lexiconforge-session' as const,
  version: '2.0' as const,
  exportedAt,
  title: manifest.novel.title,
  author: manifest.novel.author,
  description: manifest.novel.description,
  originalLanguage: manifest.novel.originalLanguage,
  targetLanguage: manifest.novel.targetLanguage,
  chapterCount: manifest.novel.chapterCount || rawChapterCount,
  genres: manifest.novel.genres,
  coverImageUrl: manifest.novel.coverImageUrl,
  publicationStatus: manifest.novel.publicationStatus,
  originalPublicationDate: manifest.novel.originalPublicationDate,
  tags: manifest.novel.tags,
  sourceLinks: manifest.novel.sourceLinks,
  lastUpdated: manifest.novel.lastUpdated || today(),
});

export const buildHostedLibraryArtifacts = async (
  manifest: LibraryBuildManifest
): Promise<{
  metadata: NovelEntry;
  session: SessionData & { metadata: Record<string, any> };
  report: LibraryBuildReport;
}> => {
  const exportedAt = new Date().toISOString();
  const rawLoaded = await loadSource(manifest.sources.raw);
  const fanLoaded = await Promise.all(manifest.sources.fan.map(loadSource));

  const warnings: LibraryBuildWarning[] = [];
  const chapters = rawLoaded.source.chapters.map((rawChapter, index, allRawChapters) => {
    const content = sourceChapterText(rawChapter);
    const stableId = generateStableChapterId(content, rawChapter.chapterNumber, rawChapter.title);
    const canonicalUrl = `lexiconforge://${manifest.novel.id}/chapter/${rawChapter.chapterNumber}`;
    const fan = resolveFanTranslationForChapter(rawChapter.chapterNumber, fanLoaded);
    warnings.push(...fan.warnings);

    return {
      stableId,
      canonicalUrl,
      title: rawChapter.title,
      content,
      fanTranslation: fan.match?.text || null,
      nextUrl: index < allRawChapters.length - 1
        ? `lexiconforge://${manifest.novel.id}/chapter/${allRawChapters[index + 1].chapterNumber}`
        : null,
      prevUrl: index > 0
        ? `lexiconforge://${manifest.novel.id}/chapter/${allRawChapters[index - 1].chapterNumber}`
        : null,
      chapterNumber: rawChapter.chapterNumber,
      translations: [],
    };
  });

  const translatedChapters = chapters.filter((chapter) => typeof chapter.fanTranslation === 'string' && chapter.fanTranslation.length > 0);

  const session: SessionData & { metadata: Record<string, any> } = {
    metadata: buildSessionMetadata(manifest, exportedAt, rawLoaded.source.chapters.length),
    novel: {
      id: manifest.novel.id,
      title: manifest.novel.title,
      ...(manifest.novel.alternateTitles ? { alternateTitles: manifest.novel.alternateTitles } : {}),
    } as SessionData['novel'] & { alternateTitles?: string[] },
    version: {
      versionId: manifest.version.versionId,
      displayName: manifest.version.displayName,
      translator: manifest.version.translator,
      targetLanguage: manifest.version.targetLanguage,
      style: manifest.version.style,
      features: manifest.version.features,
      description: manifest.version.description,
      translationPhilosophy: manifest.version.translationPhilosophy,
      contentNotes: manifest.version.contentNotes,
    } as SessionData['version'] & Record<string, any>,
    provenance: {
      originalCreator: {
        name: manifest.version.translator.name,
        link: manifest.version.translator.link,
        versionId: manifest.version.versionId,
        createdAt: exportedAt,
      },
      contributors: [
        {
          name: manifest.version.translator.name,
          link: manifest.version.translator.link,
          role: 'original-translator',
          changes: manifest.version.translationPhilosophy || manifest.version.contentNotes,
          dateRange: exportedAt.split('T')[0],
        },
      ],
    },
    chapters,
    settings: {},
  };

  const avgChapterLength = translatedChapters.length > 0
    ? translatedChapters.reduce((sum, chapter) => sum + (chapter.fanTranslation?.length || 0), 0) / translatedChapters.length
    : 0;

  const metadata: NovelEntry = {
    id: manifest.novel.id,
    title: manifest.novel.title,
    ...(manifest.novel.alternateTitles ? { alternateTitles: manifest.novel.alternateTitles } : {}),
    metadata: {
      originalLanguage: manifest.novel.originalLanguage,
      targetLanguage: manifest.novel.targetLanguage,
      chapterCount: manifest.novel.chapterCount || rawLoaded.source.chapters.length,
      genres: manifest.novel.genres,
      description: manifest.novel.description,
      ...(manifest.novel.coverImageUrl ? { coverImageUrl: manifest.novel.coverImageUrl } : {}),
      ...(manifest.novel.author ? { author: manifest.novel.author } : {}),
      ...(manifest.novel.sourceLinks ? { sourceLinks: manifest.novel.sourceLinks } : {}),
      ...(manifest.novel.tags ? { tags: manifest.novel.tags } : {}),
      ...(manifest.novel.publicationStatus ? { publicationStatus: manifest.novel.publicationStatus } : {}),
      ...(manifest.novel.originalPublicationDate ? { originalPublicationDate: manifest.novel.originalPublicationDate } : {}),
      lastUpdated: manifest.novel.lastUpdated || today(),
    },
    versions: [
      {
        versionId: manifest.version.versionId,
        displayName: manifest.version.displayName,
        translator: manifest.version.translator,
        sessionJsonUrl: `${(manifest.output.publicBaseUrl || 'https://raw.githubusercontent.com/anantham/lexiconforge-novels/main/novels').replace(/\/$/, '')}/${manifest.novel.id}/${manifest.output.sessionFileName || 'session.json'}`,
        targetLanguage: manifest.version.targetLanguage,
        style: manifest.version.style,
        features: manifest.version.features,
        chapterRange: {
          from: chapters[0]?.chapterNumber || 1,
          to: chapters[chapters.length - 1]?.chapterNumber || 1,
        },
        completionStatus: manifest.version.completionStatus,
        lastUpdated: manifest.novel.lastUpdated || today(),
        ...(manifest.version.description ? { description: manifest.version.description } : {}),
        ...(manifest.version.translationPhilosophy ? { translationPhilosophy: manifest.version.translationPhilosophy } : {}),
        ...(manifest.version.contentNotes ? { contentNotes: manifest.version.contentNotes } : {}),
        stats: {
          downloads: 0,
          fileSize: '0MB',
          content: {
            totalImages: 0,
            totalFootnotes: 0,
            totalRawChapters: chapters.length,
            totalTranslatedChapters: translatedChapters.length,
            avgImagesPerChapter: 0,
            medianImagesPerChapter: 0,
            avgFootnotesPerChapter: 0,
            medianFootnotesPerChapter: 0,
            avgChapterLength,
            medianChapterLength: avgChapterLength,
          },
          translation: {
            translationType: manifest.version.translationType || 'human',
            ...(typeof manifest.version.qualityRating === 'number' ? { qualityRating: manifest.version.qualityRating } : {}),
            feedbackCount: 0,
          },
        },
      },
    ],
  };

  const report: LibraryBuildReport = {
    novelId: manifest.novel.id,
    generatedAt: exportedAt,
    rawChapterCount: rawLoaded.source.chapters.length,
    sessionChapterCount: chapters.length,
    translatedChapterCount: translatedChapters.length,
    warnings,
    sources: [
      {
        path: manifest.sources.raw.path,
        label: manifest.sources.raw.label || manifest.sources.raw.path,
        translator: rawLoaded.source.translator.name,
        loadedChapterCount: rawLoaded.source.chapters.length,
        ...(manifest.sources.raw.ranges ? { selectedRanges: manifest.sources.raw.ranges } : {}),
      },
      ...fanLoaded.map(({ spec, source }) => ({
        path: spec.path,
        label: spec.label || spec.path,
        translator: source.translator.name,
        loadedChapterCount: source.chapters.length,
        ...(spec.alignmentMapPath ? { alignmentMapPath: spec.alignmentMapPath } : {}),
        ...(spec.ranges ? { selectedRanges: spec.ranges } : {}),
      })),
    ],
  };

  return { metadata, session, report };
};

export const updateRegistryJson = (
  registry: { version: string; lastUpdated: string; novels: Array<{ id: string; metadataUrl: string }> },
  manifest: LibraryBuildManifest
): { version: string; lastUpdated: string; novels: Array<{ id: string; metadataUrl: string }> } => {
  const metadataUrl = `${(manifest.output.publicBaseUrl || 'https://raw.githubusercontent.com/anantham/lexiconforge-novels/main/novels').replace(/\/$/, '')}/${manifest.novel.id}/${manifest.output.metadataFileName || 'metadata.json'}`;
  const novels = [...registry.novels];
  const existingIndex = novels.findIndex((entry) => entry.id === manifest.novel.id);

  if (existingIndex >= 0) {
    novels[existingIndex] = { id: manifest.novel.id, metadataUrl };
  } else {
    novels.push({ id: manifest.novel.id, metadataUrl });
  }

  novels.sort((left, right) => left.id.localeCompare(right.id));

  return {
    ...registry,
    lastUpdated: today(),
    novels,
  };
};
