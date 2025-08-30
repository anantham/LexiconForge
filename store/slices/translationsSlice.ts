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
import type { FeedbackItem, AmendmentProposal, HistoricalChapter } from '../../types';
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
  submitFeedback: (chapterId: string, feedback: string, category: string) => void;
  addFeedback: (chapterId: string, feedback: string, category: string) => void; // Alias for compatibility
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
      
      if (result.aborted) {
        set(prevState => ({
          translationProgress: {
            ...prevState.translationProgress,
            [chapterId]: { status: 'pending' }
          }
        }));
        return;
      }
      
      if (result.error) {
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
      
      // Update chapter with translation result
      if (result.translationResult) {
        const chaptersActions = state as any;
        if (chaptersActions.updateChapter) {
          const relevantSettings = TranslationService.extractSettingsSnapshot(context.settings);
          chaptersActions.updateChapter(chapterId, {
            translationResult: result.translationResult,
            translationSettingsSnapshot: relevantSettings
          });
        }
      }
      
      // Set amendment proposal if provided
      if (result.proposal) {
        set({ amendmentProposal: result.proposal });
      }
      
      // Handle image generation if needed
      if (result.translationResult?.suggestedIllustrations?.length > 0) {
        const imageActions = state as any;
        if (imageActions.loadExistingImages) {
          imageActions.loadExistingImages(chapterId);
        }
        
        const needsGeneration = result.translationResult.suggestedIllustrations.some(
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
  submitFeedback: (chapterId, feedback, category) => {
    const newFeedback: FeedbackItem = {
      id: crypto.randomUUID(),
      text: feedback,
      category,
      timestamp: Date.now(),
      chapterId
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
  },
  
  addFeedback: (chapterId, feedback, category) => {
    // Alias for submitFeedback for compatibility
    get().submitFeedback(chapterId, feedback, category);
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
    set(prevState => {
      const newFeedbackHistory = { ...prevState.feedbackHistory };
      for (const chapterId in newFeedbackHistory) {
        newFeedbackHistory[chapterId] = newFeedbackHistory[chapterId].filter(f => f.id !== feedbackId);
      }
      return { feedbackHistory: newFeedbackHistory };
    });
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
      console.log(`[TranslationsSlice] Fetched ${versions.length} translation versions for ${chapterId}`);
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
  }
});