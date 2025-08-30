/**
 * Translations Slice - Manages translation operations and feedback
 * 
 * Handles:
 * - Translation execution and cancellation
 * - Translation history and context building
 * - Feedback management
 * - Amendment proposals
 * - Translation retries and versioning
 */

import type { StateCreator } from 'zustand';
import type { FeedbackItem, AmendmentProposal, HistoricalChapter, TranslationResult, Footnote } from '../../types';
import { ExplanationService } from '../../services/explanationService';
import type { EnhancedChapter } from '../../services/stableIdService';
import { TranslationService, type TranslationContext } from '../../services/translationService';

export interface TranslationsState {
  // Active translations
  activeTranslations: Record<string, AbortController>;
  
  // Feedback and amendments
  feedbackHistory: Record<string, FeedbackItem[]>;
  amendmentProposal: AmendmentProposal | null;
  
  // Translation status
  translationProgress: Record<string, {
    status: 'pending' | 'translating' | 'completed' | 'failed';
    progress?: number;
    error?: string;
  }>;
}

export interface TranslationsActions {
  // Translation operations
  handleTranslate: (chapterId: string) => Promise<void>;
  handleRetranslateCurrent: () => void;
  cancelTranslation: (chapterId: string) => void;
  
  // Translation history and context
  buildTranslationHistory: (chapterId: string) => HistoricalChapter[];
  buildTranslationHistoryAsync: (chapterId: string) => Promise<HistoricalChapter[]>;
  
  // Feedback management
  submitFeedback: (chapterId: string, feedbackData: Omit<FeedbackItem, 'id' | 'timestamp' | 'chapterId'>) => void;
  addFeedback: (chapterId: string, feedbackData: Omit<FeedbackItem, 'id' | 'timestamp' | 'chapterId'>) => void; // Alias for compatibility
  getFeedback: (chapterId: string) => FeedbackItem[];
  clearFeedback: (chapterId: string) => void;
  deleteFeedback: (feedbackId: string) => void;
  updateFeedbackComment: (feedbackId: string, comment: string) => void;
  
  // Amendment proposals
  acceptProposal: () => void;
  rejectProposal: () => void;
  setAmendmentProposal: (proposal: AmendmentProposal | null) => void;
  
  // Translation validation and retry
  shouldEnableRetranslation: (chapterId: string) => boolean;
  isTranslationActive: (chapterId: string) => boolean;
  getActiveTranslationIds: () => string[];
  hasTranslationSettingsChanged: (chapterId: string) => boolean;
  
  // Batch operations
  cancelAllTranslations: () => void;
  retranslateChapters: (chapterIds: string[]) => Promise<void>;
  
  // Translation version management
  fetchTranslationVersions: (chapterId: string) => Promise<any[]>;
  setActiveTranslationVersion: (chapterId: string, version: number) => Promise<void>;
  deleteTranslationVersion: (chapterId: string, translationId: string) => Promise<void>;
  generateIllustrationForSelection: (chapterId: string, selection: string) => Promise<void>;
}

export type TranslationsSlice = TranslationsState & TranslationsActions;

export const createTranslationsSlice: StateCreator<
  any,
  [],
  [],
  TranslationsSlice
> = (set, get) => ({
  // Initial state
  activeTranslations: {},
  feedbackHistory: {},
  amendmentProposal: null,
  translationProgress: {},
  
  // Translation operations
  handleTranslate: async (chapterId) => {
    const state = get();
    const context: TranslationContext = {
      chapters: (state as any).chapters || new Map(),
      settings: (state as any).settings,
      activePromptTemplate: (state as any).activePromptTemplate
    };
    
    // Set translation status
    set(prevState => ({
      translationProgress: {
        ...prevState.translationProgress,
        [chapterId]: { status: 'translating', progress: 0 }
      }
    }));
    
    // Update UI loading state
    const uiActions = state as any;
    if (uiActions.setTranslatingState) {
      uiActions.setTranslatingState(true);
    }
    
    try {
      const result = await TranslationService.translateChapter(
        chapterId,
        context,
        (id) => get().buildTranslationHistoryAsync(id)
      );
      
      if ('aborted' in result && result.aborted) {
        set(prevState => ({
          translationProgress: {
            ...prevState.translationProgress,
            [chapterId]: { status: 'pending' }
          }
        }));
        return;
      }
      
      if ('error' in result && result.error) {
        set(prevState => ({
          translationProgress: {
            ...prevState.translationProgress,
            [chapterId]: { status: 'failed', error: result.error }
          }
        }));
        
        if (uiActions.setError) {
          uiActions.setError(result.error);
        }
        return;
      }
      
      const translationResult = result as TranslationResult;

      // Update chapter with translation result
      const chaptersActions = state as any;
      if (chaptersActions.updateChapter) {
        const relevantSettings = TranslationService.extractSettingsSnapshot(context.settings);
        chaptersActions.updateChapter(chapterId, {
          translationResult: translationResult,
          translationSettingsSnapshot: relevantSettings
        });
        console.log(`[Translation] Raw translationResult:`, translationResult);
        const metrics = translationResult.usageMetrics;
        console.log(`[Translation] ✅ Success for chapter ${chapterId}. Model: ${metrics?.provider}/${metrics?.model}. Tokens: ${metrics?.totalTokens}.`);
      }
      
      // Set amendment proposal if provided
      if (translationResult.proposal) {
        set({ amendmentProposal: translationResult.proposal });
      }
      
      // Handle image generation if needed
      if (translationResult.suggestedIllustrations?.length > 0) {
        const imageActions = state as any;
        if (imageActions.loadExistingImages) {
          imageActions.loadExistingImages(chapterId);
        }
        
        const needsGeneration = translationResult.suggestedIllustrations.some(
          (illust: any) => !illust.generatedImage
        );
        
        if (needsGeneration && imageActions.handleGenerateImages) {
          imageActions.handleGenerateImages(chapterId);
        }
      }
      
      set(prevState => ({
        translationProgress: {
          ...prevState.translationProgress,
          [chapterId]: { status: 'completed', progress: 100 }
        }
      }));
      
    } finally {
      // Update loading states
      const stillTranslating = TranslationService.getActiveTranslationIds().length > 0;
      if (uiActions.setTranslatingState) {
        uiActions.setTranslatingState(stillTranslating);
      }
      
      // Sync active translations with service
      const activeIds = TranslationService.getActiveTranslationIds();
      set(prevState => {
        const newActiveTranslations: Record<string, AbortController> = {};
        activeIds.forEach(id => {
          if (prevState.activeTranslations[id]) {
            newActiveTranslations[id] = prevState.activeTranslations[id];
          }
        });
        return { activeTranslations: newActiveTranslations };
      });
    }
  },
  
  handleRetranslateCurrent: () => {
    const currentChapterId = (get() as any).currentChapterId;
    if (currentChapterId) {
      get().handleTranslate(currentChapterId);
    }
  },
  
  cancelTranslation: (chapterId) => {
    const success = TranslationService.cancelTranslation(chapterId);
    
    if (success) {
      set(prevState => {
        const newActiveTranslations = { ...prevState.activeTranslations };
        delete newActiveTranslations[chapterId];
        
        const newProgress = { ...prevState.translationProgress };
        delete newProgress[chapterId];
        
        return {
          activeTranslations: newActiveTranslations,
          translationProgress: newProgress
        };
      });
      
      // Update UI loading state
      const stillTranslating = Object.keys(get().activeTranslations).length > 0;
      const uiActions = get() as any;
      if (uiActions.setTranslatingState) {
        uiActions.setTranslatingState(stillTranslating);
      }
    }
  },
  
  // Translation history and context
  buildTranslationHistory: (chapterId) => {
    const state = get();
    const chapters = (state as any).chapters || new Map();
    const settings = (state as any).settings;
    const currentChapter = chapters.get(chapterId);
    
    if (!currentChapter) return [];
    
    return TranslationService.buildTranslationHistory({
      contextDepth: settings?.contextDepth || 0,
      currentChapter,
      chapters
    });
  },
  
  buildTranslationHistoryAsync: async (chapterId) => {
    const state = get();
    const chapters = (state as any).chapters || new Map();
    const settings = (state as any).settings;
    const currentChapter = chapters.get(chapterId);
    
    if (!currentChapter) return [];
    
    return await TranslationService.buildTranslationHistoryAsync(chapterId, {
      contextDepth: settings?.contextDepth || 0,
      currentChapter,
      chapters
    });
  },
  
  // Feedback management
  submitFeedback: (chapterId: string, feedbackData: Omit<FeedbackItem, 'id' | 'timestamp' | 'chapterId'>) => {
    const newFeedback: FeedbackItem = {
      id: crypto.randomUUID(),
      text: feedbackData.selection || '',
      category: feedbackData.type || '?',
      timestamp: Date.now(),
      chapterId,
      selection: feedbackData.selection,
      type: feedbackData.type,
      comment: feedbackData.comment,
    };
    
    set(prevState => ({
      feedbackHistory: {
        ...prevState.feedbackHistory,
        [chapterId]: [
          ...(prevState.feedbackHistory[chapterId] || []),
          newFeedback
        ]
      }
    }));
    
    // Update chapter with feedback
    const chaptersActions = get() as any;
    if (chaptersActions.updateChapter) {
      const currentFeedback = get().feedbackHistory[chapterId] || [];
      chaptersActions.updateChapter(chapterId, {
        feedback: currentFeedback
      });
    }

    // --- NEW FEATURE: EXPLANATION FOOTNOTE ---
    if (newFeedback.category === '?') {
      const state = get();
      const chapter = (state.chapters as Map<string, EnhancedChapter>).get(chapterId);
      const settings = state.settings;

      if (chapter && chapter.content && chapter.translationResult && newFeedback.selection) {
        // Fire and forget the explanation generation
        ExplanationService.generateExplanationFootnote(
          chapter.content,
          chapter.translationResult.translation,
          newFeedback.selection,
          settings
        ).then(footnoteText => {
          if (!footnoteText) return;

          const chapterToUpdate = (get().chapters as Map<string, EnhancedChapter>).get(chapterId);
          if (!chapterToUpdate || !chapterToUpdate.translationResult) return;

          const existingFootnotes = chapterToUpdate.translationResult.footnotes || [];
          const nextFootnoteNumber = existingFootnotes.length + 1;
          const newMarker = `[${nextFootnoteNumber}]`;

          const newFootnote: Footnote = {
            marker: newMarker,
            text: footnoteText,
          };

          // Insert the marker into the text
          const updatedTranslation = chapterToUpdate.translationResult.translation.replace(
            newFeedback.selection!,
            `${newFeedback.selection} ${newMarker}`
          );

          const updatedTranslationResult = {
            ...chapterToUpdate.translationResult,
            translation: updatedTranslation,
            footnotes: [...existingFootnotes, newFootnote],
          };
          
          (get() as any).updateChapter(chapterId, { translationResult: updatedTranslationResult });

          // --- PERSISTENCE FIX ---
          const updatedChapter = (get().chapters as Map<string, EnhancedChapter>).get(chapterId);
          if (updatedChapter?.translationResult) {
            const { translationsRepo } = require('../../adapters/repo');
            translationsRepo.updateTranslation(updatedChapter.translationResult as any);
          }
        });
      }
    }
  },
  
  addFeedback: (chapterId, feedbackData) => {
    // Alias for submitFeedback for compatibility
    get().submitFeedback(chapterId, feedbackData as any);
  },
  
  getFeedback: (chapterId) => {
    return get().feedbackHistory[chapterId] || [];
  },
  
  clearFeedback: (chapterId) => {
    set(prevState => {
      const newFeedbackHistory = { ...prevState.feedbackHistory };
      delete newFeedbackHistory[chapterId];
      return { feedbackHistory: newFeedbackHistory };
    });
    
    // Update chapter
    const chaptersActions = get() as any;
    if (chaptersActions.updateChapter) {
      chaptersActions.updateChapter(chapterId, {
        feedback: []
      });
    }
  },
  
  deleteFeedback: (feedbackId) => {
    const state = get();
    const chaptersActions = state as any;
    let chapterToUpdate: EnhancedChapter | null = null;
    let chapterIdToUpdate: string | null = null;

    // Find the chapter that contains the feedback item
    for (const [chapterId, chapter] of (state.chapters as Map<string, EnhancedChapter>).entries()) {
      if (chapter.feedback?.some(f => f.id === feedbackId)) {
        chapterToUpdate = chapter;
        chapterIdToUpdate = chapterId;
        break;
      }
    }

    if (chapterToUpdate && chapterIdToUpdate) {
      const updatedFeedback = (chapterToUpdate.feedback || []).filter(f => f.id !== feedbackId);
      chaptersActions.updateChapter(chapterIdToUpdate, { feedback: updatedFeedback });

      // Also update the legacy feedbackHistory for any parts of the app that might still use it
      set(prevState => {
        const newFeedbackHistory = { ...prevState.feedbackHistory };
        if (newFeedbackHistory[chapterIdToUpdate!]) {
          newFeedbackHistory[chapterIdToUpdate!] = updatedFeedback;
        }
        return { feedbackHistory: newFeedbackHistory };
      });
    }
  },
  
  updateFeedbackComment: (feedbackId, comment) => {
    set(prevState => {
      const newFeedbackHistory = { ...prevState.feedbackHistory };
      for (const chapterId in newFeedbackHistory) {
        const feedback = newFeedbackHistory[chapterId].find(f => f.id === feedbackId);
        if (feedback) {
          feedback.comment = comment;
          break;
        }
      }
      return { feedbackHistory: newFeedbackHistory };
    });
  },
  
  // Amendment proposals
  acceptProposal: () => {
    const { amendmentProposal } = get();
    if (!amendmentProposal) return;
    
    const settingsActions = get() as any;
    if (settingsActions.updateSettings && settingsActions.settings) {
      const currentSystemPrompt = settingsActions.settings.systemPrompt;
      const newPrompt = currentSystemPrompt.replace(
        amendmentProposal.currentRule,
        amendmentProposal.proposedChange.replace(/^[+-]\s/gm, '')
      );
      
      settingsActions.updateSettings({ systemPrompt: newPrompt });
    }
    
    set({ amendmentProposal: null });
  },
  
  rejectProposal: () => {
    set({ amendmentProposal: null });
  },
  
  setAmendmentProposal: (proposal) => {
    set({ amendmentProposal: proposal });
  },
  
  // Translation validation and retry
  shouldEnableRetranslation: (chapterId) => {
    const state = get();
    const chapters = (state as any).chapters || new Map();
    const settings = (state as any).settings;
    
    return TranslationService.shouldEnableRetranslation(chapterId, chapters, settings);
  },
  
  isTranslationActive: (chapterId) => {
    return TranslationService.isTranslationActive(chapterId);
  },
  
  getActiveTranslationIds: () => {
    return TranslationService.getActiveTranslationIds();
  },
  
  hasTranslationSettingsChanged: (chapterId) => {
    const state = get();
    const chapters = (state as any).chapters || new Map();
    const settings = (state as any).settings;
    
    return TranslationService.shouldEnableRetranslation(chapterId, chapters, settings);
  },
  
  // Batch operations
  cancelAllTranslations: () => {
    const activeIds = get().getActiveTranslationIds();
    activeIds.forEach(id => get().cancelTranslation(id));
  },
  
  retranslateChapters: async (chapterIds) => {
    for (const chapterId of chapterIds) {
      await get().handleTranslate(chapterId);
    }
  },

  // Translation version management
  fetchTranslationVersions: async (chapterId) => {
    try {
      const { indexedDBService } = await import('../../services/indexeddb');
      const versions = await indexedDBService.getTranslationVersionsByStableId(chapterId);
      // console.log(`[TranslationsSlice] Fetched ${versions.length} translation versions for ${chapterId}`);
      return versions;
    } catch (error) {
      console.error('[TranslationsSlice] Failed to fetch translation versions:', error);
      return [];
    }
  },

  setActiveTranslationVersion: async (chapterId, version) => {
    try {
      const { indexedDBService } = await import('../../services/indexeddb');
      
      // Set the active version in IndexedDB
      await indexedDBService.setActiveTranslationByStableId(chapterId, version);
      
      // Load the active translation into chapter state
      const activeTranslation = await indexedDBService.getActiveTranslationByStableId(chapterId);
      
      if (activeTranslation) {
        console.log(`[TranslationsSlice] Loaded translation version ${version} for chapter ${chapterId}`);
        
        // Update the chapter with the new translation
        const chaptersActions = get() as any;
        if (chaptersActions.updateChapter) {
          const usageMetrics = {
            totalTokens: activeTranslation.totalTokens || 0,
            promptTokens: activeTranslation.promptTokens || 0,
            completionTokens: activeTranslation.completionTokens || 0,
            estimatedCost: activeTranslation.estimatedCost || 0,
            requestTime: activeTranslation.requestTime || 0,
            provider: activeTranslation.provider || 'unknown',
            model: activeTranslation.model || 'unknown',
          };
          
          const translationResult = {
            translatedTitle: activeTranslation.translatedTitle,
            translation: activeTranslation.translation,
            proposal: activeTranslation.proposal || null,
            footnotes: activeTranslation.footnotes || [],
            suggestedIllustrations: activeTranslation.suggestedIllustrations || [],
            usageMetrics,
          };
          
          chaptersActions.updateChapter(chapterId, {
            translationResult
          });
        }
      }
    } catch (error) {
      console.error('[TranslationsSlice] Failed to set active translation version:', error);
      const uiActions = get() as any;
      if (uiActions.setError) {
        uiActions.setError('Failed to switch translation version');
      }
    }
  },

  deleteTranslationVersion: async (chapterId, translationId) => {
    try {
      const { indexedDBService } = await import('../../services/indexeddb');
      const { translationsRepo } = await import('../../adapters/repo');

      // Get the current active translation for this chapter to check if we are deleting it
      const activeTranslation = await indexedDBService.getActiveTranslationByStableId(chapterId);

      // Delete the version from IndexedDB
      await translationsRepo.deleteTranslationVersion(translationId);
      console.log(`[TranslationsSlice] Deleted translation version ${translationId} for chapter ${chapterId}`);

      // If the deleted version was the active one, we need to promote a new version
      if (activeTranslation && activeTranslation.id === translationId) {
        const remainingVersions = await get().fetchTranslationVersions(chapterId);
        if (remainingVersions.length > 0) {
          // Set the latest remaining version as active (they are sorted by version descending)
          const latestVersion = remainingVersions[0];
          await get().setActiveTranslationVersion(chapterId, latestVersion.version);
          console.log(`[TranslationsSlice] Promoted version ${latestVersion.version} to active for chapter ${chapterId}`);
        } else {
          // No versions left, so we clear the translation result from the chapter
          const chaptersActions = get() as any;
          if (chaptersActions.updateChapter) {
            chaptersActions.updateChapter(chapterId, {
              translationResult: null,
              translationSettingsSnapshot: null,
            });
          }
          console.log(`[TranslationsSlice] No translations left for chapter ${chapterId}`);
        }
      }
      // If the deleted version was not active, no further action is needed here.
      // The component that shows the list of versions will simply get a shorter list next time it fetches.

    } catch (error) {
      console.error('[TranslationsSlice] Failed to delete translation version:', error);
      const uiActions = get() as any;
      if (uiActions.setError) {
        uiActions.setError('Failed to delete translation version');
      }
    }
  },

  generateIllustrationForSelection: async (chapterId, selection) => {
    const { IllustrationService } = await import('../../services/illustrationService');
    const state = get();
    const chapter = (state.chapters as Map<string, EnhancedChapter>).get(chapterId);
    const settings = state.settings;

    if (!chapter || !chapter.translationResult) return;

    const context = chapter.translationResult.translation;
    const imagePrompt = await IllustrationService.generateIllustrationForSelection(selection, context, settings);

    if (!imagePrompt) return;

    const chapterToUpdate = (get().chapters as Map<string, EnhancedChapter>).get(chapterId);
    if (!chapterToUpdate || !chapterToUpdate.translationResult) return;

    const existingIllustrations = chapterToUpdate.translationResult.suggestedIllustrations || [];
    const nextIllustrationNumber = existingIllustrations.length + 1;
    const newMarker = `[ILLUSTRATION-${nextIllustrationNumber}]`;

    const newIllustration = {
      placementMarker: newMarker,
      imagePrompt,
    };

    const updatedTranslation = chapterToUpdate.translationResult.translation.replace(
      selection,
      `${selection} ${newMarker}`
    );

    const updatedTranslationResult = {
      ...chapterToUpdate.translationResult,
      translation: updatedTranslation,
      suggestedIllustrations: [...existingIllustrations, newIllustration],
    };

    (get() as any).updateChapter(chapterId, { translationResult: updatedTranslationResult });

    // Diagnostic logs: show current suggestedIllustrations and whether the marker was inserted
    try {
      const stateAfter = get();
      const chAfter = (stateAfter.chapters as Map<string, any>).get(chapterId);
      console.log('[TranslationsSlice] After update - suggestedIllustrations:', chAfter?.translationResult?.suggestedIllustrations || []);
      console.log('[TranslationsSlice] After update - translation contains marker?', chAfter?.translationResult?.translation?.includes(newMarker));
    } catch (e) {
      console.warn('[TranslationsSlice] Failed to log post-update diagnostics:', e);
    }

    const updatedChapter = (get().chapters as Map<string, EnhancedChapter>).get(chapterId);
    if (updatedChapter?.translationResult) {
      // Use dynamic ESM import to avoid `require` in browser environments
      import('../../adapters/repo').then(({ translationsRepo }) => {
        try {
          // If the translation record already has an `id`, it's a full TranslationRecord and can be updated.
          const tr = updatedChapter.translationResult as any;
          if (tr && tr.id) {
            translationsRepo.updateTranslation(tr).catch((e: any) => {
              console.warn('[TranslationsSlice] Failed to update existing translation via translationsRepo:', e);
            });
            // Log persistence attempt for existing record
            console.log('[TranslationsSlice] Persisted update for translation id:', tr.id);
          } else {
            // No id => create a new stored translation tied to the stableId
            // Use minimal settings snapshot from the app settings
            const state = get();
            const settings = state.settings;
            translationsRepo.storeTranslationByStableId(chapterId, tr, {
              provider: settings.provider,
              model: settings.model,
              temperature: settings.temperature,
              systemPrompt: settings.systemPrompt,
            }).then((stored) => {
              console.log('[TranslationsSlice] Stored new translation via translationsRepo:', stored?.id);
              try {
                // Update in-memory record with persisted id so future updates use updateTranslation
                (get() as any).updateChapter(chapterId, { translationResult: stored as any });
              } catch (e) { console.warn('[TranslationsSlice] Failed to merge persisted translation into state:', e); }
            }).catch((e: any) => {
              console.warn('[TranslationsSlice] Failed to store new translation via translationsRepo:', e);
            });
          }
        } catch (e) {
          console.warn('[TranslationsSlice] Failed to persist updated translation via translationsRepo:', e);
        }
      }).catch((e) => {
        console.warn('[TranslationsSlice] Dynamic import of translationsRepo failed:', e);
      });
    }
  }
});
