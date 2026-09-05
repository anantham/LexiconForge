import type { SessionActions } from '../storeTypes';
import type { BootstrapContext } from './index';
import { ImportOps, SettingsOps } from '../../services/db/operations';
import { loadAllIntoStore, loadNovelIntoStore } from '../../services/readerHydrationService';
import {
  computeSemanticCorpusIdentity,
  parseSessionOscilloscope,
} from '../../services/semanticOscilloscopeSession';

/**
 * Convert a `lexiconforge-session` payload (the publish/quick-export format)
 * into the shape that `importFullSessionData` expects (`lexiconforge-full-1`).
 *
 * The chapter `translations[]` array is already compatible — we just need to
 * hoist `novel` → `novels[]` and build `urlMappings` from the chapter data.
 */
const convertSessionToFullPayload = (session: any): any => {
  const novel = session.novel ?? {};
  const chapters: any[] = Array.isArray(session.chapters) ? session.chapters : [];

  // Build urlMappings from chapter canonical URLs
  const urlMappings = chapters
    .filter((ch: any) => ch.canonicalUrl)
    .map((ch: any) => ({
      url: ch.canonicalUrl,
      stableId: ch.stableId || '',
      isCanonical: true,
      dateAdded: session.metadata?.exportedAt || new Date().toISOString(),
      chapterNumber: ch.chapterNumber,
    }));

  return {
    ...session,
    novelId: session.novelId ?? novel.id,
    // Registry callers can explicitly select the default/null library scope.
    libraryVersionId: session.libraryVersionId !== undefined
      ? session.libraryVersionId : session.version?.versionId ?? null,
    metadata: {
      ...session.metadata,
      format: 'lexiconforge-full-1',
      generatedAt: session.metadata?.exportedAt || new Date().toISOString(),
    },
    novels: novel.id ? [{
      id: novel.id,
      title: novel.title || 'Untitled Novel',
      source: 'library',
      chapterCount: chapters.length,
      dateAdded: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
    }] : [],
    urlMappings,
    chapters,
    settings: session.settings ?? {},
  };
};

export const createImportSessionData = (ctx: BootstrapContext): SessionActions['importSessionData'] => {
  return async (payload, onProgress) => {
    try {
      let obj = typeof payload === 'string' ? JSON.parse(payload) : (payload as any);

      // Convert legacy session format to full format
      if (obj?.metadata?.format === 'lexiconforge-session') {
        console.log('[Store] Converting lexiconforge-session to full import format');
        obj = convertSessionToFullPayload(obj);
      }

      if (obj?.metadata?.format === 'lexiconforge-full-1') {
        const { activeNovelId, activeVersionId } = ctx.get();
        const stillSelected = () => ctx.get().activeNovelId === activeNovelId
          && ctx.get().activeVersionId === activeVersionId;
        await ImportOps.importFullSessionData(obj, onProgress);
        if (!stillSelected()) return;
        const applyHydration: Parameters<typeof loadNovelIntoStore>[1] = (patch) => {
          if (stillSelected()) ctx.set(patch);
        };

        if (typeof obj?.novelId === 'string') {
          const firstChapterId = await loadNovelIntoStore(obj.novelId, applyHydration, {
            versionId: typeof obj?.libraryVersionId === 'string' ? obj.libraryVersionId : null,
          });
          if (!stillSelected()) return;
          ctx.set({
            activeNovelId: obj.novelId,
            activeVersionId: typeof obj.libraryVersionId === 'string' ? obj.libraryVersionId : null,
            currentChapterId: firstChapterId,
          });
        } else {
          const firstChapterId = await loadAllIntoStore(applyHydration);
          if (!stillSelected()) return;
          const current = ctx.get();
          if (!current.currentChapterId || !current.chapters.has(current.currentChapterId)) {
            ctx.set({ currentChapterId: firstChapterId });
          }
        }
        const hydrated = ctx.get();
        const nav = await SettingsOps.getKey<any>('navigation-history').catch(() => null);
        const lastActive = await SettingsOps.getKey<any>('lastActiveChapter').catch(() => null);
        if (ctx.get().chapters !== hydrated.chapters
          || ctx.get().activeNovelId !== hydrated.activeNovelId
          || ctx.get().activeVersionId !== hydrated.activeVersionId) return;

        ctx.set((state) => {
          const resolvedCurrentChapterId = lastActive?.id && state.chapters.has(lastActive.id)
            ? lastActive.id : state.currentChapterId;

          return {
            navigationHistory: Array.isArray(nav?.stableIds) ? nav.stableIds : state.navigationHistory,
            currentChapterId: resolvedCurrentChapterId,
            appScreen: resolvedCurrentChapterId ? 'reader' : state.appScreen,
            error: null,
          };
        });

        try {
          const hint = obj?.oscilloscope?.corpus;
          const corpusId = obj?.novelId ?? obj?.novel?.id ?? hint?.corpusId;
          const versionId = obj?.libraryVersionId ?? obj?.version?.versionId ?? hint?.versionId;
          const libraryVersionId = obj.oscilloscopeLibraryVersionId !== undefined
            ? obj.oscilloscopeLibraryVersionId
            : obj.libraryVersionId !== undefined ? obj.libraryVersionId : versionId;
          if (corpusId && versionId && Array.isArray(obj?.chapters)) {
            const chapters = Array.from(hydrated.chapters.values()).filter((chapter) =>
              chapter.novelId === corpusId && (chapter.libraryVersionId ?? null) === libraryVersionId);
            const corpus = await computeSemanticCorpusIdentity({
              novel: { id: corpusId },
              version: { versionId },
              chapters,
            } as any);
            if (ctx.get().chapters !== hydrated.chapters
              || ctx.get().activeNovelId !== hydrated.activeNovelId
              || ctx.get().activeVersionId !== hydrated.activeVersionId) return;
            const graph = obj.oscilloscope ? parseSessionOscilloscope(obj.oscilloscope, corpus) : null;
            ctx.set({
              activeNovelId: corpusId,
              activeVersionId: libraryVersionId,
              currentChapterId: chapters.some(chapter => chapter.id === hydrated.currentChapterId)
                ? hydrated.currentChapterId : chapters[0]?.id ?? null,
              appScreen: 'reader',
            });
            if (graph) {
              ctx.get().loadSessionOscilloscope(graph);
            } else {
              ctx.get().initializeOscilloscope(corpus);
            }
          } else {
            ctx.get().resetOscilloscope();
          }
        } catch (error) {
          console.warn('[Store] Graph corpus could not be verified; imported book remains readable:', error);
          if (ctx.get().chapters === hydrated.chapters
            && ctx.get().activeNovelId === hydrated.activeNovelId
            && ctx.get().activeVersionId === hydrated.activeVersionId) ctx.get().resetOscilloscope();
        }

        return;
      }

      throw new Error(`Unsupported import format: ${obj?.metadata?.format ?? 'unknown'}`);
    } catch (error) {
      console.error('[Store] Failed to import session data:', error);
      const uiActions = ctx.get();
      uiActions.setError(`Failed to import session: ${error}`);
      throw error;
    }
  };
};
