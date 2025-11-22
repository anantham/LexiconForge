import { normalizeUrlAggressively } from '../../services/stableIdService';
import type { SessionActions } from '../storeTypes';
import type { BootstrapContext } from './index';
import { ImportOps, SettingsOps } from '../../services/db/operations';
import { fetchChaptersForReactRendering } from '../../services/db/operations/rendering';

export const createImportSessionData = (ctx: BootstrapContext): SessionActions['importSessionData'] => {
  return async (payload, onProgress) => {
    try {
      const obj = typeof payload === 'string' ? JSON.parse(payload) : (payload as any);

      if (obj?.metadata?.format === 'lexiconforge-full-1') {
        await ImportOps.importFullSessionData(obj, onProgress);

        const rendering = await fetchChaptersForReactRendering();
        const nav = await SettingsOps.getKey<any>('navigation-history').catch(() => null);
        const lastActive = await SettingsOps.getKey<any>('lastActiveChapter').catch(() => null);

        ctx.set((state) => {
          const newChapters = new Map<string, any>();
          const newUrlIndex = new Map<string, string>();
          const newRawUrlIndex = new Map<string, string>();

          for (const ch of rendering) {
            const sourceUrls = ch.sourceUrls ?? [ch.url];
            newChapters.set(ch.stableId, {
              id: ch.stableId,
              title: ch.title,
              content: ch.content,
              originalUrl: ch.originalUrl,
              nextUrl: ch.nextUrl ?? null,
              prevUrl: ch.prevUrl ?? null,
              chapterNumber: typeof ch.chapterNumber === 'number' ? ch.chapterNumber : 0,
              canonicalUrl: ch.canonicalUrl ?? ch.url,
              sourceUrls,
              fanTranslation: ch.fanTranslation ?? null,
              translationResult: ch.translationResult || null,
              feedback: [],
            });

            for (const rawUrl of sourceUrls) {
              if (!rawUrl) continue;
              newRawUrlIndex.set(rawUrl, ch.stableId);
              const norm = normalizeUrlAggressively(rawUrl);
              if (norm) newUrlIndex.set(norm, ch.stableId);
            }
          }

          return {
            chapters: newChapters,
            urlIndex: newUrlIndex,
            rawUrlIndex: newRawUrlIndex,
            navigationHistory: Array.isArray(nav?.stableIds) ? nav.stableIds : state.navigationHistory,
            currentChapterId: lastActive?.id ? lastActive.id : state.currentChapterId,
            error: null,
          };
        });

        return;
      }

      throw new Error('Legacy import format not implemented in new store structure');
    } catch (error) {
      console.error('[Store] Failed to import session data:', error);
      const uiActions = ctx.get();
      uiActions.setError(`Failed to import session: ${error}`);
      throw error;
    }
  };
};
