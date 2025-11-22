import { useCallback, useEffect, useState } from 'react';
import { SettingsOps } from '../services/db/operations';
import { debugLog } from '../utils/debug';
import type { PublisherMetadata } from '../components/settings/types';

const pickFirstNonEmpty = (...values: (string | undefined | null)[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
};

const ensureArray = (value: any): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === 'string' ? item : '')).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

const normalizeMetadataDefaults = (metadata: PublisherMetadata, chapterFallbackCount: number): PublisherMetadata => {
  const today = new Date().toISOString().split('T')[0];
  const coercedCount = (() => {
    if (typeof metadata.chapterCount === 'number' && Number.isFinite(metadata.chapterCount)) {
      return metadata.chapterCount;
    }
    const parsed = parseInt(String(metadata.chapterCount ?? ''), 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
    return chapterFallbackCount || 1;
  })();

  return {
    ...metadata,
    title: metadata.title || 'Untitled Novel',
    description: metadata.description || 'Please provide a description for this novel.',
    originalLanguage: metadata.originalLanguage || 'Unknown',
    targetLanguage: metadata.targetLanguage || 'English',
    chapterCount: coercedCount,
    genres: ensureArray(metadata.genres),
    tags: ensureArray(metadata.tags),
    alternateTitles: ensureArray(metadata.alternateTitles),
    publicationStatus: metadata.publicationStatus || 'Ongoing',
    lastUpdated: metadata.lastUpdated || today,
  };
};

const buildMetadataFromSessionInfo = (sessionInfo: any, chapters: any[]): PublisherMetadata | null => {
  if (!sessionInfo) return null;
  const meta = sessionInfo.metadata ?? {};
  const novel = sessionInfo.novel ?? {};
  const version = sessionInfo.version ?? {};
  const provenance = sessionInfo.provenance?.originalCreator ?? null;
  const firstChapter = chapters[0] || {};

  const metadata: PublisherMetadata = {
    title: pickFirstNonEmpty(novel.title, meta.title, firstChapter?.data?.chapter?.novelTitle, firstChapter?.title),
    alternateTitles: ensureArray(novel.alternateTitles || meta.alternateTitles),
    author: meta.author || provenance?.name || undefined,
    description: pickFirstNonEmpty(meta.description, firstChapter?.data?.chapter?.description, firstChapter?.translationResult?.summary),
    originalLanguage: meta.originalLanguage || firstChapter?.data?.chapter?.originalLanguage || 'Unknown',
    targetLanguage: meta.targetLanguage || version.targetLanguage || firstChapter?.translationResult?.targetLanguage || 'English',
    chapterCount: meta.chapterCount || chapters.length,
    genres: ensureArray(meta.genres),
    coverImageUrl: meta.coverImageUrl || firstChapter?.data?.chapter?.coverImageUrl,
    publicationStatus: meta.publicationStatus || firstChapter?.data?.chapter?.publicationStatus || 'Ongoing',
    originalPublicationDate: meta.originalPublicationDate || firstChapter?.data?.chapter?.originalPublicationDate,
    tags: ensureArray(meta.tags || firstChapter?.data?.chapter?.tags),
    sourceLinks: meta.sourceLinks || firstChapter?.data?.chapter?.sourceLinks,
    lastUpdated: meta.lastUpdated || (sessionInfo.metadata?.exportedAt ? sessionInfo.metadata.exportedAt.split('T')[0] : undefined),
    translatorName: version.translator?.name || provenance?.name,
    translatorWebsite: version.translator?.link || provenance?.link,
    translationApproach: meta.translationApproach,
    versionDescription: version.description || meta.versionDescription,
    contentNotes: meta.contentNotes,
  };

  return normalizeMetadataDefaults(metadata, chapters.length);
};

const buildMetadataFromChapters = (chapters: any[]): PublisherMetadata | null => {
  if (!chapters.length) return null;
  const first = chapters[0] || {};
  const chapterData = first.data?.chapter ?? {};
  const translation = first.data?.translationResult ?? first.translationResult ?? {};

  const metadata: PublisherMetadata = {
    title: pickFirstNonEmpty(chapterData.novelTitle, chapterData.title, first.title),
    alternateTitles: ensureArray(chapterData.alternateTitles),
    author: chapterData.author,
    description: pickFirstNonEmpty(chapterData.description, translation.summary),
    originalLanguage: chapterData.originalLanguage || 'Unknown',
    targetLanguage: translation.targetLanguage || 'English',
    chapterCount: chapterData.totalChapters || chapters.length,
    genres: ensureArray(chapterData.genres),
    coverImageUrl: chapterData.coverImageUrl,
    publicationStatus: chapterData.publicationStatus || 'Ongoing',
    originalPublicationDate: chapterData.originalPublicationDate,
    tags: ensureArray(chapterData.tags),
    sourceLinks: chapterData.sourceLinks,
    lastUpdated: chapterData.lastUpdated,
  };

  return normalizeMetadataDefaults(metadata, chapters.length);
};

export const useNovelMetadata = (chaptersMap?: Map<string, any> | null) => {
  const [novelMetadata, setNovelMetadata] = useState<PublisherMetadata | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('novelMetadata');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setNovelMetadata(normalizeMetadataDefaults(parsed, parsed?.chapterCount ?? 1));
      } catch (error) {
        console.error('Failed to load novel metadata:', error);
      }
    }
  }, []);

  const persistNovelMetadata = useCallback(async (metadata: PublisherMetadata) => {
    try {
      await SettingsOps.set('novelMetadata', metadata);
    } catch (error) {
      console.error('Failed to persist novel metadata to IndexedDB:', error);
    }
  }, []);

  const applyMetadata = useCallback(
    (metadata: PublisherMetadata, fallbackCount: number, source?: string) => {
      const normalized = normalizeMetadataDefaults(metadata, fallbackCount);
      setNovelMetadata(normalized);
      localStorage.setItem('novelMetadata', JSON.stringify(normalized));
      persistNovelMetadata(normalized);
      if (source) {
        debugLog('ui', 'summary', '[SettingsModal] Prefilled novel metadata', {
          title: normalized.title,
          source,
        });
      }
    },
    [persistNovelMetadata]
  );

  const handleNovelMetadataChange = useCallback(
    (metadata: PublisherMetadata) => {
      applyMetadata(metadata, metadata.chapterCount ?? 1);
    },
    [applyMetadata]
  );

  useEffect(() => {
    const loadMetadataFromSession = async () => {
      if (novelMetadata) return;
      const safeChaptersMap =
        chaptersMap && typeof (chaptersMap as any).values === 'function'
          ? chaptersMap
          : new Map<string, any>();
      const chaptersArray = Array.from(safeChaptersMap.values());
      if (chaptersArray.length === 0) {
        return;
      }
      try {
        const savedMetadata = await SettingsOps.getKey<PublisherMetadata>('novelMetadata');
        if (savedMetadata && typeof savedMetadata === 'object') {
          applyMetadata(savedMetadata as PublisherMetadata, chaptersArray.length, 'indexeddb');
          return;
        }

        const sessionInfo = await SettingsOps.getKey<any>('sessionInfo');
        if (sessionInfo && typeof sessionInfo === 'object') {
          const generated = buildMetadataFromSessionInfo(sessionInfo as any, chaptersArray);
          if (generated) {
            applyMetadata(generated, chaptersArray.length, 'sessionInfo');
            return;
          }
        }

        const generated = buildMetadataFromChapters(chaptersArray);
        if (generated) {
          applyMetadata(generated, chaptersArray.length, 'chapterFallback');
        }
      } catch (error) {
        console.error('Failed to hydrate novel metadata from session:', error);
      }
    };

    loadMetadataFromSession();
  }, [applyMetadata, chaptersMap, novelMetadata]);

  return { novelMetadata, handleNovelMetadataChange };
};
