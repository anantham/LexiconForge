import { StateCreator } from 'zustand';
import { indexedDBService } from '../../services/indexeddb';

// Export slice state
export interface ExportSlice {
  // Export actions
  exportSessionData: () => string;
  exportEpub: () => Promise<void>;
}

// Debug logging utilities (copied from old store)
const storeDebugEnabled = (): boolean => {
  try {
    const lvl = localStorage.getItem('LF_AI_DEBUG_LEVEL');
    return lvl === 'full' || localStorage.getItem('LF_AI_DEBUG') === '1';
  } catch {
    return false;
  }
};

const swarn = (...args: any[]) => { 
  if (storeDebugEnabled()) console.warn(...args); 
};

export const createExportSlice: StateCreator<
  any, // We need to accept the full store type here
  [],
  [],
  ExportSlice
> = (set, get) => ({
  exportSessionData: () => {
    // Maintain return shape for tests: return in-memory snapshot
    const { chapters } = get();
    const memorySnapshot = {
      chapters: Array.from(chapters.values()).map((chapter: any) => ({
        sourceUrl: chapter.canonicalUrl,
        title: chapter.title,
        content: chapter.content,
        translationResult: chapter.translationResult,
        feedback: chapter.feedback,
        chapterNumber: chapter.chapterNumber,
        nextUrl: chapter.nextUrl,
        prevUrl: chapter.prevUrl
      })),
    };
    const memoryJson = JSON.stringify(memorySnapshot, null, 2);

    // Kick off full IndexedDB export for the actual download
    indexedDBService.exportFullSessionToJson()
      .then(jsonObj => {
        const json = JSON.stringify(jsonObj, null, 2);
        const ts = new Date().toISOString().slice(0,19).replace(/[-:T]/g, '');
        const filename = `lexicon-forge-session-${ts}.json`;
        try {
          const a = document.createElement('a');
          a.download = filename;
          a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(json);
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } catch {}
      })
      .catch(err => {
        swarn('[Export] Full export failed, falling back to memory snapshot download', err);
        try {
          const ts = new Date().toISOString().slice(0,19).replace(/[-:T]/g, '');
          const filename = `lexicon-forge-session-${ts}.json`;
          const a = document.createElement('a');
          a.download = filename;
          a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(memoryJson);
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } catch {}
      });

    return memoryJson;
  },

  exportEpub: async () => {
    try {
      // Gather chapters in order using IndexedDB as ground truth
      const [rendering, navHistSetting] = await Promise.all([
        indexedDBService.getChaptersForReactRendering(),
        indexedDBService.getSetting<any>('navigation-history').catch(() => null),
      ]);

      const navOrder: string[] = Array.isArray(navHistSetting?.stableIds) ? navHistSetting.stableIds : [];
      const byStableId = new Map(rendering.map(r => [r.stableId, r] as const));

      // Build candidate orders
      // A) Navigation-first (current default behavior)
      const remaining = rendering
        .map(r => r.stableId)
        .filter(id => !navOrder.includes(id));
      const sortedRemaining = remaining.sort((a, b) => {
        const ca = byStableId.get(a)?.chapterNumber ?? 0;
        const cb = byStableId.get(b)?.chapterNumber ?? 0;
        return ca - cb;
      });
      const navOrdered = [...navOrder.filter(id => byStableId.has(id)), ...sortedRemaining];

      // B) Numeric chapterNumber order (preferred when most chapters have numbers)
      const extractNumFromTitle = (t?: string): number => {
        if (!t) return 0;
        const m = t.match(/(?:chapter|episode)\s*(\d+)/i);
        return m ? parseInt(m[1], 10) : 0;
      };
      const withNumbers = rendering.map(r => ({
        id: r.stableId,
        num: (r.chapterNumber && r.chapterNumber > 0) ? r.chapterNumber : extractNumFromTitle(r.title)
      }));
      const haveNums = withNumbers.filter(x => x.num && x.num > 0).length;
      const numericOrdered = withNumbers
        .slice()
        .sort((a, b) => (a.num || 0) - (b.num || 0))
        .map(x => x.id);

      // Choose ordering based on settings or heuristic
      const prefOrder = get().settings.exportOrder;
      let ordered: string[];
      if (prefOrder === 'number') ordered = numericOrdered;
      else if (prefOrder === 'navigation') ordered = navOrdered;
      else {
        const threshold = Math.ceil(rendering.length * 0.6);
        ordered = haveNums >= threshold ? numericOrdered : navOrdered;
      }

      // Build ChapterForEpub list using active translation versions
      const chaptersForEpub: import('../../services/epubService').ChapterForEpub[] = [];
      for (const sid of ordered) {
        const ch = byStableId.get(sid);
        if (!ch) continue;
        const active = await indexedDBService.getActiveTranslationByStableId(sid);
        if (!active) continue;
        // Compose chapter for EPUB
        const images = (active.suggestedIllustrations || [])
          .filter((i: any) => !!(i as any).url)
          .map((i: any) => ({ marker: i.placementMarker, imageData: (i as any).url, prompt: i.imagePrompt }));
        const footnotes = (active.footnotes || []).map((f: any) => ({ marker: f.marker, text: f.text }));
        chaptersForEpub.push({
          title: ch.title,
          content: active.translation || ch.data?.chapter?.content || '',
          originalUrl: ch.url,
          translatedTitle: active.translatedTitle || ch.title,
          usageMetrics: {
            totalTokens: active.totalTokens || 0,
            promptTokens: active.promptTokens || 0,
            completionTokens: active.completionTokens || 0,
            estimatedCost: active.estimatedCost || 0,
            requestTime: active.requestTime || 0,
            provider: (active.provider as any) || get().settings.provider,
            model: active.model || get().settings.model,
          },
          images,
          footnotes,
        });
      }

      if (chaptersForEpub.length === 0) {
        throw new Error('No chapters with active translations found to export.');
      }

      // Generate EPUB via service
      const { generateEpub, getDefaultTemplate } = await import('../../services/epubService');
      // Enable EPUB debug artifacts only when API logging level is FULL
      let epubDebug = false;
      try {
        const level = localStorage.getItem('LF_AI_DEBUG_LEVEL');
        const full = localStorage.getItem('LF_AI_DEBUG_FULL');
        epubDebug = (level && level.toLowerCase() === 'full') || (full === '1' || (full ?? '').toLowerCase() === 'true');
      } catch {}

      const tpl = getDefaultTemplate();
      const s = get().settings as any;
      if (s.epubGratitudeMessage) tpl.gratitudeMessage = s.epubGratitudeMessage;
      if (s.epubProjectDescription) tpl.projectDescription = s.epubProjectDescription;
      if (s.epubFooter !== undefined) tpl.customFooter = s.epubFooter || '';

      await generateEpub({
        title: undefined,
        author: undefined,
        description: undefined,
        chapters: chaptersForEpub,
        settings: get().settings,
        template: tpl,
        novelConfig: undefined,
        includeTitlePage: !!get().settings.includeTitlePage,
        includeStatsPage: !!get().settings.includeStatsPage,
        debug: epubDebug,
      });
    } catch (e: any) {
      console.error('[Export] EPUB generation failed', e);
      throw e;
    }
  }
});