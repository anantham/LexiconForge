/**
 * TranslationService - Handles all translation operations and history building
 * 
 * Extracted from useAppStore to separate translation concerns from state management.
 * This service manages:
 * - Chapter translation with context
 * - Translation history building (sync and async)
 * - Translation cancellation and abort handling
 * - Translation persistence to IndexedDB
 */

import { translateChapter, validateApiKey } from './aiService';
import { indexedDBService } from './indexeddb';
import type { AppSettings, HistoricalChapter, TranslationResult, PromptTemplate } from '../types';
import type { EnhancedChapter } from './stableIdService';
import { normalizeUrlAggressively } from './stableIdService';

// Logging utilities matching the store pattern
const storeDebugEnabled = () => {
  return typeof window !== 'undefined' && window.localStorage?.getItem('store-debug') === 'true';
};
const slog = (...args: any[]) => { if (storeDebugEnabled()) console.log(...args); };
const swarn = (...args: any[]) => { if (storeDebugEnabled()) console.warn(...args); };

export interface TranslationContext {
  chapters: Map<string, EnhancedChapter>;
  settings: AppSettings;
  activePromptTemplate?: PromptTemplate;
}

export interface TranslationResult {
  translationResult?: any; // TranslationResult type
  proposal?: any; // AmendmentProposal type
  error?: string;
  aborted?: boolean;
}

export interface TranslationHistoryOptions {
  contextDepth: number;
  currentChapter: EnhancedChapter;
  chapters: Map<string, EnhancedChapter>;
}

export class TranslationService {
  private static activeTranslations = new Map<string, AbortController>();

  /**
   * Main translation handler - translates a chapter with context
   */
  static async translateChapter(
    chapterId: string,
    context: TranslationContext,
    buildHistoryFn?: (chapterId: string) => HistoricalChapter[] | Promise<HistoricalChapter[]>
  ): Promise<TranslationResult> {
    const { chapters, settings, activePromptTemplate } = context;
    const chapterToTranslate = chapters.get(chapterId);

    if (!chapterToTranslate) {
      return { error: 'Chapter not found' };
    }

    // Validate API credentials
    const apiValidation = validateApiKey(settings);
    if (!apiValidation.isValid) {
      return { error: `Translation API error: ${apiValidation.errorMessage}` };
    }

    // Cancel any existing translation for this chapter
    if (this.activeTranslations.has(chapterId)) {
      this.activeTranslations.get(chapterId)?.abort();
    }

    const abortController = new AbortController();
    this.activeTranslations.set(chapterId, abortController);

    try {
      // Build translation history for context
      const contextDepth = settings.contextDepth || 0;
      console.log(`[Translation] Context depth setting: ${contextDepth}`);
      
      let history: HistoricalChapter[] = [];
      if (buildHistoryFn) {
        const historyResult = buildHistoryFn(chapterId);
        history = historyResult instanceof Promise ? await historyResult : historyResult;
        console.log(`[Translation] Built history via buildHistoryFn: ${history.length} chapters`);
      } else {
        history = this.buildTranslationHistory({
          contextDepth: contextDepth,
          currentChapter: chapterToTranslate,
          chapters
        });
        console.log(`[Translation] Built history via buildTranslationHistory: ${history.length} chapters`);
      }

      // Clear diagnostic when contextDepth > 0 but no history available
      if (contextDepth > 0 && history.length === 0) {
        console.warn(`🟡 [Translation] WARNING: contextDepth=${contextDepth} but no historical chapters resolved. Context will be empty.`);
        await TranslationService.logHistoryDiagnostics(contextDepth, chapterToTranslate, chapters);
        console.warn(`🟡 [Translation] Proceeding without prior context.`);
      } else {
        console.log(`[Translation] ✅ Using ${history.length} historical chapters as context (contextDepth: ${contextDepth})`);
      }

      slog('[Translate] Using context items:', history.length);

      const result = await translateChapter(
        chapterToTranslate.title,
        chapterToTranslate.content,
        settings,
        history,
        (chapterToTranslate as any).fanTranslation || null,
        3, // maxRetries
        2000, // timeout
        abortController.signal
      );

      if (abortController.signal.aborted) {
        console.log(`Translation for ${chapterId} was cancelled.`);
        return { aborted: true };
      }

      // Persist translation to IndexedDB
      try {
        const storedRecord = await indexedDBService.storeTranslationByStableId(chapterId, result as any, {
          provider: settings.provider,
          model: settings.model,
          temperature: settings.temperature,
          systemPrompt: settings.systemPrompt,
          promptId: activePromptTemplate?.id,
          promptName: activePromptTemplate?.name,
        });
        slog('[Translate] Persisted translation to IndexedDB');

        if (storedRecord?.id) {
          (result as any).id = storedRecord.id;
          (result as any).customVersionLabel = storedRecord.customVersionLabel;
        }
      } catch (e) {
        console.warn('[TranslationService] Failed to persist translation version', e);
      }

      return result;

    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.log(`Translation for ${chapterId} was aborted.`);
        return { aborted: true };
      } else {
        return { error: String(e?.message ?? e ?? 'Translate failed') };
      }
    } finally {
      this.activeTranslations.delete(chapterId);
    }
  }

  /**
   * Print detailed diagnostics explaining why history couldn't be built
   */
  private static async logHistoryDiagnostics(
    contextDepth: number,
    currentChapter: EnhancedChapter,
    chapters: Map<string, EnhancedChapter>
  ): Promise<void> {
    try {
      console.warn('🟡 [HistoryDiag] Current chapter:', {
        title: currentChapter?.title,
        number: currentChapter?.chapterNumber,
        id: (currentChapter as any)?.id,
      });

      if (!currentChapter?.chapterNumber || currentChapter.chapterNumber <= 0) {
        console.warn('🟡 [HistoryDiag] No chapterNumber on current chapter. Number-based context cannot be computed.');
        console.warn('🟡 [HistoryDiag] Tip: Ensure adapters/import assign sequential chapterNumber values.');
        return;
      }

      const targets: number[] = [];
      for (let i = 1; i <= contextDepth; i++) {
        const n = currentChapter.chapterNumber - i;
        if (n > 0) targets.push(n);
      }
      console.warn('🟡 [HistoryDiag] Target previous numbers:', targets);

      // In-memory scan
      const memByNumber: Record<number, { found: boolean; hasContent?: boolean; hasTranslation?: boolean; id?: string; title?: string }> = {};
      for (const t of targets) memByNumber[t] = { found: false };

      for (const [cid, ch] of chapters.entries()) {
        const num = ch.chapterNumber || 0;
        if (targets.includes(num)) {
          memByNumber[num] = {
            found: true,
            hasContent: !!(ch.content && ch.content.trim().length > 0),
            hasTranslation: !!ch.translationResult,
            id: (ch as any).id || cid,
            title: ch.title,
          };
        }
      }

      Object.entries(memByNumber).forEach(([num, info]) => {
        if (!info.found) {
          console.warn(`🟡 [HistoryDiag][Memory] #${num}: not present in memory (chapter map).`);
        } else if (!info.hasContent) {
          console.warn(`🟡 [HistoryDiag][Memory] #${num}: present but content is empty (scrape/import issue). id=${info.id}`);
        } else if (!info.hasTranslation) {
          console.warn(`🟡 [HistoryDiag][Memory] #${num}: present with content but no translation loaded in memory. id=${info.id}`);
        } else {
          console.warn(`🟡 [HistoryDiag][Memory] #${num}: present with translation (unexpectedly excluded). id=${info.id}`);
        }
      });

      // IndexedDB scan (active translations only)
      try {
        const allChapters = await indexedDBService.getAllChapters();
        const dbByNumber: Record<number, { found: boolean; hasContent?: boolean; hasActiveTranslation?: boolean; stableId?: string; title?: string }> = {};
        for (const t of targets) dbByNumber[t] = { found: false };

        for (const dbCh of allChapters) {
          const num = dbCh.chapterNumber || 0;
          if (!targets.includes(num)) continue;
          dbByNumber[num].found = true;
          dbByNumber[num].hasContent = !!(dbCh.content && dbCh.content.trim().length > 0);
          dbByNumber[num].stableId = dbCh.stableId;
          dbByNumber[num].title = dbCh.title;
          try {
            const active = await indexedDBService.getActiveTranslationByStableId(dbCh.stableId);
            dbByNumber[num].hasActiveTranslation = !!active;
          } catch {}
        }

        Object.entries(dbByNumber).forEach(([num, info]) => {
          if (!info.found) {
            console.warn(`🟡 [HistoryDiag][IDB]    #${num}: not found in IndexedDB (not fetched/imported yet).`);
          } else if (!info.hasContent) {
            console.warn(`🟡 [HistoryDiag][IDB]    #${num}: found but content empty (scrape failed or sanitized away). stableId=${info.stableId}`);
          } else if (!info.hasActiveTranslation) {
            console.warn(`🟡 [HistoryDiag][IDB]    #${num}: found with content but no ACTIVE translation version. stableId=${info.stableId}`);
          } else {
            console.warn(`🟡 [HistoryDiag][IDB]    #${num}: has active translation (unexpectedly not used). stableId=${info.stableId}`);
          }
        });
      } catch (e) {
        console.warn('[HistoryDiag] Skipped IDB scan due to error:', e);
      }

      // General guidance for imported vs scraped workflows
      console.warn('🟡 [HistoryDiag] Common causes and fixes:');
      console.warn('🟡   • Chapter numbering missing or inconsistent — ensure adapters/import assign sequential chapterNumber.');
      console.warn('🟡   • Translations exist but no ACTIVE version set in IDB — use version switcher or ensure persistence setActiveTranslationByStableId ran.');
      console.warn('🟡   • Scraped chapters not translated yet — translate previous chapters first or reduce contextDepth temporarily.');
      console.warn('🟡   • Different session/source produced different stableIds — ensure you are on the same novel and normalization is consistent.');
    } catch (err) {
      console.warn('[HistoryDiag] Diagnostic failed:', err);
    }
  }

  /**
   * Cancel an active translation
   */
  static cancelTranslation(chapterId: string): boolean {
    const controller = this.activeTranslations.get(chapterId);
    if (controller) {
      try {
        controller.abort();
        slog(`[Translate] Cancel requested for ${chapterId}`);
        return true;
      } catch (e) {
        console.warn('[TranslationService] Failed to abort translation', e);
        return false;
      } finally {
        this.activeTranslations.delete(chapterId);
      }
    }
    return false;
  }

  /**
   * Check if a translation is currently active for a chapter
   */
  static isTranslationActive(chapterId: string): boolean {
    return this.activeTranslations.has(chapterId);
  }

  /**
   * Get all active translation chapter IDs
   */
  static getActiveTranslationIds(): string[] {
    return Array.from(this.activeTranslations.keys());
  }

  /**
   * Build translation history from memory (synchronous version)
   */
  static buildTranslationHistory(options: TranslationHistoryOptions): HistoricalChapter[] {
    console.log(`[History] Building history for current chapter`);
    const { contextDepth, currentChapter, chapters } = options;
    
    console.log(`[History] Current chapter:`, {
      title: currentChapter?.title,
      chapterNumber: currentChapter?.chapterNumber
    });
    console.log(`[History] Total chapters in memory:`, chapters.size);
    console.log(`[History] Context depth setting:`, contextDepth);
    
    if (!currentChapter?.chapterNumber || contextDepth === 0) {
      console.log(`[History] No context: missing chapter number (${currentChapter?.chapterNumber}) or contextDepth is 0`);
      return [];
    }
    
    // Find previous chapters by chapter number that have translations
    const targetNumbers = [];
    for (let i = 1; i <= contextDepth; i++) {
      const prevNumber = currentChapter.chapterNumber - i;
      if (prevNumber > 0) targetNumbers.push(prevNumber);
    }
    console.log(`[History] Looking for chapters with numbers:`, targetNumbers);
    
    const candidateChapters: Array<{ chapter: EnhancedChapter, id: string }> = [];
    for (const [chapterId, chapter] of chapters.entries()) {
      if (targetNumbers.includes(chapter.chapterNumber || 0) && 
          chapter.translationResult &&
          chapter.content) {
        candidateChapters.push({ chapter, id: chapterId });
      }
    }
    
    console.log(`[History] Found ${candidateChapters.length} candidate chapters with translations`);
    
    // Sort by chapter number ascending and build history
    const result = candidateChapters
      .sort((a, b) => (a.chapter.chapterNumber || 0) - (b.chapter.chapterNumber || 0))
      .slice(-contextDepth)  // Take the most recent contextDepth chapters
      .map(({ chapter, id }) => {
        console.log(`[History] Including chapter ${id} (${chapter.chapterNumber}): ${chapter.title}`);
        return {
          originalTitle: chapter.title,
          originalContent: chapter.content,
          translatedTitle: chapter.translationResult!.translatedTitle,
          translatedContent: chapter.translationResult!.translation,
          footnotes: chapter.translationResult!.footnotes || [],
          feedback: (chapter as any).feedback ?? [],
        };
      });
    console.log('[History][DIAG] Mapped translationResult.translation → translatedContent for history', { count: result.length });
    
    console.log(`[History] Built history with ${result.length} chapters using chapter-number-based selection`);
    return result;
  }

  /**
   * Build translation history with IndexedDB hydration (async version)
   */
  static async buildTranslationHistoryAsync(
    chapterId: string,
    options: TranslationHistoryOptions
  ): Promise<HistoricalChapter[]> {
    try {
      slog(`[HistoryAsync] Building history for chapter: ${chapterId}`);
      const { contextDepth, currentChapter, chapters } = options;
      
      if (!currentChapter?.chapterNumber || contextDepth === 0) {
        slog(`[HistoryAsync] No context needed`);
        return [];
      }

      // First try the synchronous version with in-memory chapters
      const memoryHistory = this.buildTranslationHistory(options);
      
      if (memoryHistory.length >= contextDepth) {
        slog(`[HistoryAsync] Found sufficient context in memory (${memoryHistory.length}/${contextDepth})`);
        return memoryHistory;
      }

      // Need to hydrate more context from IndexedDB
      slog(`[HistoryAsync] Need more context, hydrating from IndexedDB (have ${memoryHistory.length}/${contextDepth})`);
      
      const targetNumbers = [];
      for (let i = 1; i <= contextDepth; i++) {
        const prevNumber = currentChapter.chapterNumber - i;
        if (prevNumber > 0) targetNumbers.push(prevNumber);
      }

      // Get all chapters from IndexedDB that match target numbers
      const allChapters = await indexedDBService.getAllChapters();
      const candidatesFromDB: HistoricalChapter[] = [];

      for (const dbChapter of allChapters) {
        if (targetNumbers.includes(dbChapter.chapterNumber || 0)) {
          // Get active translation for this chapter
          const activeTranslation = await indexedDBService.getActiveTranslationByStableId(dbChapter.stableId);
          
          if (activeTranslation && dbChapter.content) {
            candidatesFromDB.push({
              originalTitle: dbChapter.title || 'Untitled',
              originalContent: dbChapter.content,
              translatedTitle: activeTranslation.translatedTitle,
              translatedContent: activeTranslation.translation,
              footnotes: activeTranslation.footnotes || [],
              feedback: [], // IndexedDB doesn't store feedback history
            });
          }
        }
      }

      // Combine memory and DB results, deduplicate by content, and sort
      const allCandidates = [...memoryHistory];
      
      for (const dbCandidate of candidatesFromDB) {
        // Check if we already have this chapter from memory
        const alreadyExists = memoryHistory.some(mem => 
          mem.originalTitle === dbCandidate.originalTitle &&
          mem.originalContent === dbCandidate.originalContent
        );
        
        if (!alreadyExists) {
          allCandidates.push(dbCandidate);
        }
      }

      // Sort by finding the chapter numbers and take the most recent ones
      let sortedCandidates = allCandidates.slice(-contextDepth);
      
      if (sortedCandidates.length >= contextDepth) {
        slog(`[HistoryAsync] Built extended history with ${sortedCandidates.length} chapters`);
        return sortedCandidates;
      }

      // Fallback: build via prevUrl chain when numbering/data is missing
      slog(`[HistoryAsync] Falling back to prevUrl chain (have ${sortedCandidates.length}/${contextDepth})`);
      const chainHistory = await this.buildHistoryByPrevUrlChain(options.currentChapter, contextDepth, options.chapters);
      if (chainHistory.length > 0) {
        // Prefer DB/memory candidates first, then chain (dedupe by originalContent)
        const combined = [...sortedCandidates];
        for (const h of chainHistory) {
          const exists = combined.some(x => x.originalContent === h.originalContent);
          if (!exists) combined.push(h);
        }
        sortedCandidates = combined.slice(-contextDepth);
        slog(`[HistoryAsync] PrevUrl chain produced ${chainHistory.length}; using ${sortedCandidates.length} total.`);
        return sortedCandidates;
      }
      
      slog('[HistoryAsync] PrevUrl chain produced no results; returning what we have');
      return sortedCandidates;
      
    } catch (error) {
      swarn('[HistoryAsync] Failed to build async history, falling back to memory-only', error);
      return this.buildTranslationHistory(options);
    }
  }

  /**
   * Fallback: Build history by walking prevUrl chain, resolving chapters via memory or IndexedDB.
   */
  private static async buildHistoryByPrevUrlChain(
    currentChapter: EnhancedChapter,
    depth: number,
    chapters: Map<string, EnhancedChapter>
  ): Promise<HistoricalChapter[]> {
    const results: HistoricalChapter[] = [];
    const links: Array<{ stableId?: string; memChapter?: EnhancedChapter }> = [];
    try {
      let cursorPrev = currentChapter.prevUrl || null;
      let steps = 0;
      while (cursorPrev && steps < depth) {
        const normalized = normalizeUrlAggressively(cursorPrev);
        // Try in-memory match first
        let matched: EnhancedChapter | null = this.findByUrlInMemory(normalized, chapters);

        if (!matched) {
          // Try IndexedDB lookup
          const dbRec = await indexedDBService.findChapterByUrl(cursorPrev);
          if (dbRec && dbRec.stableId) {
            const active = await indexedDBService.getActiveTranslationByStableId(dbRec.stableId);
            if (active && dbRec.content) {
              results.push({
                originalTitle: dbRec.title || 'Untitled',
                originalContent: dbRec.content,
                translatedTitle: active.translatedTitle,
                translatedContent: active.translation,
                footnotes: active.footnotes || [],
                feedback: [],
              });
              links.push({ stableId: dbRec.stableId });
              // Continue chain using DB record's prevUrl
              cursorPrev = dbRec.prevUrl || null;
              steps++;
              continue;
            }
          }
        }

        if (matched && matched.translationResult && matched.content) {
          results.push({
            originalTitle: matched.title,
            originalContent: matched.content,
            translatedTitle: matched.translationResult.translatedTitle,
            translatedContent: matched.translationResult.translation,
            footnotes: matched.translationResult.footnotes || [],
            feedback: (matched as any).feedback ?? [],
          });
          links.push({ stableId: (matched as any).id, memChapter: matched });
          cursorPrev = matched.prevUrl || null;
          steps++;
        } else {
          // Could not resolve this prev link; abort chain
          break;
        }
      }
      // Persist inferred chapter numbers if current chapter has a number
      const currentNumber = currentChapter?.chapterNumber || 0;
      if (currentNumber > 0 && links.length > 0) {
        try {
          for (let i = 0; i < links.length; i++) {
            const inferred = currentNumber - (i + 1);
            if (inferred <= 0) break;
            const link = links[i];
            if (link.stableId) {
              try { await indexedDBService.setChapterNumberByStableId(link.stableId, inferred); } catch {}
            }
            if (link.memChapter) {
              try { (link.memChapter as any).chapterNumber = inferred; } catch {}
            }
          }
          slog(`[HistoryAsync] Persisted inferred chapter numbers for ${Math.min(links.length, currentNumber - 1)} link(s).`);
        } catch (e) {
          swarn('[HistoryAsync] Failed to persist inferred chapter numbers', e);
        }
      }

      // We built oldest-first (walking backward). Return as-is; history formatter handles order.
      return results;
    } catch (e) {
      swarn('[HistoryAsync] PrevUrl chain failed', e);
      return [];
    }
  }

  private static findByUrlInMemory(url: string | null, chapters: Map<string, EnhancedChapter>): EnhancedChapter | null {
    if (!url) return null;
    const norm = normalizeUrlAggressively(url);
    for (const [, ch] of chapters.entries()) {
      const originals = [ch.originalUrl, ch.canonicalUrl, ch.prevUrl || '', ch.nextUrl || '']
        .map(u => normalizeUrlAggressively(u));
      if (originals.includes(norm)) return ch;
    }
    return null;
  }

  /**
   * Extract relevant settings snapshot for translation persistence
   */
  static extractSettingsSnapshot(settings: AppSettings): Partial<AppSettings> {
    const { provider, model, temperature, topP, frequencyPenalty, presencePenalty, seed, contextDepth, systemPrompt } = settings;
    return { provider, model, temperature, topP, frequencyPenalty, presencePenalty, seed, contextDepth, systemPrompt };
  }

  /**
   * Check if retranslation should be enabled for a chapter
   */
  static shouldEnableRetranslation(
    chapterId: string,
    chapters: Map<string, EnhancedChapter>,
    settings: AppSettings
  ): boolean {
    const chapter = chapters.get(chapterId);
    if (!chapter || !chapter.translationResult) {
      return false;
    }

    // Check if the translation settings have changed significantly
    const snapshot = (chapter as any).translationSettingsSnapshot;
    if (!snapshot) {
      return true; // No snapshot means old translation, retranslation possible
    }

    // Compare key settings that would affect translation quality
    const currentRelevant = this.extractSettingsSnapshot(settings);
    const hasSettingsChanged = 
      snapshot.provider !== currentRelevant.provider ||
      snapshot.model !== currentRelevant.model ||
      snapshot.systemPrompt !== currentRelevant.systemPrompt ||
      Math.abs((snapshot.temperature || 0.7) - (currentRelevant.temperature || 0.7)) > 0.1;

    return hasSettingsChanged;
  }
}
