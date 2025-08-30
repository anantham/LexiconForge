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
      let history: HistoricalChapter[] = [];
      if (buildHistoryFn) {
        const historyResult = buildHistoryFn(chapterId);
        history = historyResult instanceof Promise ? await historyResult : historyResult;
      } else {
        history = this.buildTranslationHistory({
          contextDepth: settings.contextDepth || 0,
          currentChapter: chapterToTranslate,
          chapters
        });
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
        await indexedDBService.storeTranslationByStableId(chapterId, result as any, {
          provider: settings.provider,
          model: settings.model,
          temperature: settings.temperature,
          systemPrompt: settings.systemPrompt,
          promptId: activePromptTemplate?.id,
          promptName: activePromptTemplate?.name,
        });
        slog('[Translate] Persisted translation to IndexedDB');
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
      const sortedCandidates = allCandidates.slice(-contextDepth);
      
      slog(`[HistoryAsync] Built extended history with ${sortedCandidates.length} chapters`);
      return sortedCandidates;
      
    } catch (error) {
      swarn('[HistoryAsync] Failed to build async history, falling back to memory-only', error);
      return this.buildTranslationHistory(options);
    }
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