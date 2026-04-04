import type { SessionActions } from '../storeTypes';
import type { BootstrapContext } from './index';
import { ImportOps, SettingsOps } from '../../services/db/operations';
import { loadAllIntoStore, loadNovelIntoStore } from '../../services/readerHydrationService';

export const createImportSessionData = (ctx: BootstrapContext): SessionActions['importSessionData'] => {
  return async (payload, onProgress) => {
    try {
      const obj = typeof payload === 'string' ? JSON.parse(payload) : (payload as any);

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

      throw new Error('Legacy import format not implemented in new store structure');
    } catch (error) {
      console.error('[Store] Failed to import session data:', error);
      const uiActions = ctx.get();
      uiActions.setError(`Failed to import session: ${error}`);
      throw error;
    }
  };
};
