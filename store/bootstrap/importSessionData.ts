import type { SessionActions } from '../storeTypes';
import type { BootstrapContext } from './index';
import { ImportOps, SettingsOps } from '../../services/db/operations';
import { loadAllIntoStore, loadNovelIntoStore } from '../../services/readerHydrationService';

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
        await ImportOps.importFullSessionData(obj, onProgress);

        if (typeof obj?.novelId === 'string') {
          await loadNovelIntoStore(obj.novelId, (patch) => ctx.set(patch), {
            versionId: typeof obj?.libraryVersionId === 'string' ? obj.libraryVersionId : null,
          });
        } else {
          await loadAllIntoStore((patch) => ctx.set(patch));
        }
        const nav = await SettingsOps.getKey<any>('navigation-history').catch(() => null);
        const lastActive = await SettingsOps.getKey<any>('lastActiveChapter').catch(() => null);

        ctx.set((state) => {
          const resolvedCurrentChapterId = lastActive?.id ? lastActive.id : state.currentChapterId;

          return {
            navigationHistory: Array.isArray(nav?.stableIds) ? nav.stableIds : state.navigationHistory,
            currentChapterId: resolvedCurrentChapterId,
            appScreen: resolvedCurrentChapterId ? 'reader' : state.appScreen,
            error: null,
          };
        });

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
