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
import { TranslationPersistenceService, type TranslationSettingsSnapshot } from '../../services/translationPersistenceService';
import { indexedDBService } from '../../services/indexeddb';
import { debugLog, debugWarn } from '../../utils/debug';

export interface TranslationsState {
  // Active translations
  activeTranslations: Record<string, AbortController>;
  pendingTranslations: Set<string>;
  
  // Feedback and amendments
  feedbackHistory: Record<string, FeedbackItem[]>;
  amendmentProposals: AmendmentProposal[]; // Queue of proposals from multiple translations
  
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

  // Amendment proposals (queue-based)
  acceptProposal: (index?: number) => Promise<void>;
  rejectProposal: (index?: number) => Promise<void>;
  editAndAcceptProposal: (modifiedChange: string, index?: number) => Promise<void>;
  addAmendmentProposal: (proposal: AmendmentProposal) => void;
  clearAllProposals: () => void;
  
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
  pendingTranslations: new Set(),
  feedbackHistory: {},
  amendmentProposals: [],
  translationProgress: {},
  
  // Translation operations
  handleTranslate: async (chapterId) => {
    const state = get();
    if (state.pendingTranslations.has(chapterId)) {
      debugLog('translation', 'summary', '[Retranslate] Already translating, ignoring click', { chapterId });
      return;
    }
    const context: TranslationContext = {
      chapters: (state as any).chapters || new Map(),
      settings: (state as any).settings,
      activePromptTemplate: (state as any).activePromptTemplate
    };

    debugLog('translation', 'summary', '[Retranslate] Button clicked', {
      chapterId,
      provider: context.settings.provider,
      model: context.settings.model,
      temperature: context.settings.temperature,
      promptId: context.activePromptTemplate?.id
    });

    // Create abort controller for this translation
    const abortController = new AbortController();

    set(prevState => {
      const nextPending = new Set(prevState.pendingTranslations);
      nextPending.add(chapterId);
      return {
        pendingTranslations: nextPending,
        activeTranslations: {
          ...prevState.activeTranslations,
          [chapterId]: abortController
        },
        translationProgress: {
          ...prevState.translationProgress,
          [chapterId]: { status: 'translating', progress: 0 }
        }
      };
    });

    // Update UI loading state
    const uiActions = state as any;
    if (uiActions.setTranslatingState) {
      uiActions.setTranslatingState(true);
    }

    try {
      const existingVersions = await indexedDBService.getTranslationVersionsByStableId(chapterId).catch(() => []);
      debugLog('translation', 'summary', '[Retranslate] Found existing versions', {
        chapterId,
        count: existingVersions.length
      });

      if (Array.isArray(existingVersions) && existingVersions.length > 0) {
        // Check if a version with EXACT matching settings already exists
        const currentSettings = TranslationService.extractSettingsSnapshot(context.settings);
        currentSettings.promptId = context.activePromptTemplate?.id;
        currentSettings.promptName = context.activePromptTemplate?.name;

        const matchingVersion = existingVersions.find(v => {
          const snapshot = v.settingsSnapshot;
          if (!snapshot) return false;

          const providerMatch = snapshot.provider === currentSettings.provider;
          const modelMatch = snapshot.model === currentSettings.model;
          const promptMatch = snapshot.systemPrompt === currentSettings.systemPrompt;
          const tempMatch = Math.abs((snapshot.temperature || 0.7) - (currentSettings.temperature || 0.7)) < 0.1;

          return providerMatch && modelMatch && promptMatch && tempMatch;
        });

        if (matchingVersion) {
          debugLog('translation', 'summary', '[Retranslate] Blocking: Version with identical settings exists', {
            chapterId,
            existingVersionId: matchingVersion.id,
            version: matchingVersion.version,
            settings: {
              provider: matchingVersion.settingsSnapshot?.provider,
              model: matchingVersion.settingsSnapshot?.model,
              temperature: matchingVersion.settingsSnapshot?.temperature
            }
          });

          // Show user notification
          const showNotification = (state as any).showNotification;
          if (showNotification) {
            showNotification(
              'A translation with these exact settings already exists. Change settings or use the version picker to switch versions.',
              'info'
            );
          }

          set(prev => {
            const nextPending = new Set(prev.pendingTranslations);
            nextPending.delete(chapterId);
            const nextProgress = { ...prev.translationProgress };
            delete nextProgress[chapterId];
            return {
              pendingTranslations: nextPending,
              translationProgress: nextProgress,
            };
          });
          return;
        }

        // No matching version found, proceed to create new version
        debugLog('translation', 'summary', '[Retranslate] No matching settings version found, creating new version', {
          chapterId,
          existingVersionCount: existingVersions.length,
          currentSettings: {
            provider: currentSettings.provider,
            model: currentSettings.model,
            temperature: currentSettings.temperature
          }
        });
      }

      const response = await TranslationService.translateChapterSequential(
        chapterId,
        context,
        (id) => get().buildTranslationHistoryAsync(id)
      );
      
      if (response?.aborted) {
        set(prevState => ({
          translationProgress: {
            ...prevState.translationProgress,
            [chapterId]: { status: 'pending' }
          }
        }));
        return;
      }
      
      if (response?.error) {
        set(prevState => ({
          translationProgress: {
            ...prevState.translationProgress,
            [chapterId]: { status: 'failed', error: response.error }
          }
        }));
        
        if (uiActions.setError) {
          uiActions.setError(response.error);
        }
        return;
      }
      
      const translationResult = response?.translationResult as TranslationResult | undefined;
      if (!translationResult) {
        debugWarn('translation', 'summary', '[Translation] Missing translationResult payload from translateChapterSequential response', response);
        set(prevState => ({
          translationProgress: {
            ...prevState.translationProgress,
            [chapterId]: { status: 'failed', error: 'Translation finished without a result.' }
          }
        }));
        return;
      }
      const relevantSettings = TranslationService.extractSettingsSnapshot(context.settings);

      // Update chapter with translation result
      const chaptersActions = state as any;
      if (chaptersActions.updateChapter) {
        chaptersActions.updateChapter(chapterId, {
          translationResult: translationResult,
          translationSettingsSnapshot: relevantSettings
        });
        debugLog('translation', 'summary', '[Translation] Raw translationResult:', translationResult);
        const metrics = translationResult.usageMetrics;
        debugLog('translation', 'summary', `[Translation] ✅ Success for chapter ${chapterId}. Model: ${metrics?.provider}/${metrics?.model}. Tokens: ${metrics?.totalTokens}.`);
      }
      // Add amendment proposal to queue if provided and enabled in settings
      if (translationResult.proposal) {
        const enableAmendments = (state as any).settings?.enableAmendments ?? false;
        if (enableAmendments) {
          set((prevState) => ({
            amendmentProposals: [...prevState.amendmentProposals, translationResult.proposal!]
          }));
        } else {
          // Auto-reject if amendments are disabled
          debugLog('translation', 'summary', '[Translation] Auto-rejecting amendment proposal (amendments disabled in settings)');
        }
      }

      // Dispatch translation:complete event for diff analysis (only if diff heatmap is enabled)
      const chapter = context.chapters.get(chapterId);
      const isDiffHeatmapEnabled = context.settings?.showDiffHeatmap ?? true; // Default to true for backward compatibility
      if (chapter && typeof window !== 'undefined' && isDiffHeatmapEnabled) {
        window.dispatchEvent(new CustomEvent('translation:complete', {
          detail: {
            chapterId,
            aiTranslation: translationResult.translation || '',
            aiTranslationId: (translationResult as any)?.id ?? null,
            fanTranslation: (chapter as any).fanTranslation || null,
            fanTranslationId: null,
            rawText: chapter.content || '',
            previousVersionFeedback: undefined, // TODO: Add feedback summary if available
            preferredProvider: relevantSettings?.provider,
            preferredModel: relevantSettings?.model,
            preferredTemperature: relevantSettings?.temperature
          }
        }));
        debugLog('translation', 'summary', '[Translation] Dispatched translation:complete event for diff analysis');
      } else if (!isDiffHeatmapEnabled) {
        debugLog('translation', 'summary', '[Translation] Skipped diff analysis event (showDiffHeatmap is disabled)');
      }
      
      // Handle image generation if needed
      if (translationResult.suggestedIllustrations?.length > 0) {
        const imageActions = state as any;
        if (imageActions.loadExistingImages) {
          await imageActions.loadExistingImages(chapterId);
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
      set(prev => {
        const nextPending = new Set(prev.pendingTranslations);
        nextPending.delete(chapterId);
        return { pendingTranslations: nextPending };
      });
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
    const mapTypeToCategory = (type?: FeedbackItem['type']): string => {
      switch (type) {
        case '👍':
          return 'positive';
        case '👎':
          return 'negative';
        case '?':
          return 'question';
        case '🎨':
          return 'illustration';
        default:
          return 'unknown';
      }
    };

    const newFeedback: FeedbackItem = {
      id: crypto.randomUUID(),
      text: feedbackData.selection || '',
      category: mapTypeToCategory(feedbackData.type),
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
    if (newFeedback.type === '?') {
      const state = get();
      const chapter = (state.chapters as Map<string, EnhancedChapter>).get(chapterId);
      const settings = state.settings;

      if (chapter && chapter.content && chapter.translationResult && newFeedback.selection) {
        void (async () => {
          try {
            const footnoteText = await ExplanationService.generateExplanationFootnote(
              chapter.content,
              chapter.translationResult.translation,
              newFeedback.selection,
              settings
            );

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

            const updatedChapter = (get().chapters as Map<string, EnhancedChapter>).get(chapterId);
            if (!updatedChapter?.translationResult) {
              return;
            }

            const stateSnapshot = get() as any;
            const persistenceSettings: TranslationSettingsSnapshot = {
              provider: stateSnapshot.settings.provider,
              model: stateSnapshot.settings.model,
              temperature: stateSnapshot.settings.temperature,
              systemPrompt: stateSnapshot.settings.systemPrompt,
              promptId: stateSnapshot.activePromptTemplate?.id,
              promptName: stateSnapshot.activePromptTemplate?.name,
            };

            try {
              const stored = await TranslationPersistenceService.persistUpdatedTranslation(
                chapterId,
                updatedChapter.translationResult as any,
                persistenceSettings
              );

              if (stored && !(updatedChapter.translationResult as any).id) {
                (get() as any).updateChapter(chapterId, { translationResult: stored as any });
              }
            } catch (error) {
              console.warn('[TranslationsSlice] Failed to persist translation after generating footnote:', error);
            }
          } catch (error) {
            console.warn('[TranslationsSlice] Footnote generation workflow failed:', error);
          }
        })();
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
  
  // Amendment proposals (queue-based)
  acceptProposal: async (index = 0) => {
    const { amendmentProposals } = get();
    if (amendmentProposals.length === 0 || index >= amendmentProposals.length) return;

    const proposal = amendmentProposals[index];
    const state = get() as any;
    const settingsActions = state;
    const currentChapterId = state.currentChapterId;

    if (settingsActions.updateSettings && settingsActions.settings) {
      const currentSystemPrompt = settingsActions.settings.systemPrompt;
      const cleanChange = proposal.proposedChange.replace(/^[+-]\s/gm, '');
      const newPrompt = currentSystemPrompt.replace(
        proposal.currentRule,
        cleanChange
      );

      settingsActions.updateSettings({ systemPrompt: newPrompt });

      // Log the accepted amendment
      try {
        await indexedDBService.logAmendmentAction({
          chapterId: currentChapterId,
          proposal: proposal,
          action: 'accepted',
          finalPromptChange: cleanChange
        });
      } catch (error) {
        console.warn('[TranslationsSlice] Failed to log amendment action:', error);
      }
    }

    // Remove proposal from queue
    set((state) => ({
      amendmentProposals: state.amendmentProposals.filter((_, i) => i !== index)
    }));
  },

  rejectProposal: async (index = 0) => {
    const { amendmentProposals } = get();
    if (amendmentProposals.length === 0 || index >= amendmentProposals.length) return;

    const proposal = amendmentProposals[index];
    const state = get() as any;
    const currentChapterId = state.currentChapterId;

    // Log the rejected amendment
    try {
      await indexedDBService.logAmendmentAction({
        chapterId: currentChapterId,
        proposal: proposal,
        action: 'rejected'
      });
    } catch (error) {
      console.warn('[TranslationsSlice] Failed to log amendment action:', error);
    }

    // Remove proposal from queue
    set((state) => ({
      amendmentProposals: state.amendmentProposals.filter((_, i) => i !== index)
    }));
  },

  editAndAcceptProposal: async (modifiedChange: string, index = 0) => {
    const { amendmentProposals } = get();
    if (amendmentProposals.length === 0 || index >= amendmentProposals.length) return;

    const proposal = amendmentProposals[index];
    const state = get() as any;
    const settingsActions = state;
    const currentChapterId = state.currentChapterId;

    if (settingsActions.updateSettings && settingsActions.settings) {
      const currentSystemPrompt = settingsActions.settings.systemPrompt;
      const cleanChange = modifiedChange.replace(/^[+-]\s/gm, '');
      const newPrompt = currentSystemPrompt.replace(
        proposal.currentRule,
        cleanChange
      );

      settingsActions.updateSettings({ systemPrompt: newPrompt });

      // Log the modified amendment
      try {
        await indexedDBService.logAmendmentAction({
          chapterId: currentChapterId,
          proposal: proposal,
          action: 'modified',
          finalPromptChange: cleanChange
        });
      } catch (error) {
        console.warn('[TranslationsSlice] Failed to log amendment action:', error);
      }
    }

    // Remove proposal from queue
    set((state) => ({
      amendmentProposals: state.amendmentProposals.filter((_, i) => i !== index)
    }));
  },

  addAmendmentProposal: (proposal) => {
    set((state) => ({
      amendmentProposals: [...state.amendmentProposals, proposal]
    }));
  },

  clearAllProposals: () => {
    set({ amendmentProposals: [] });
  },
  
  // Translation validation and retry
  shouldEnableRetranslation: (chapterId) => {
    const state = get();
    const chapters = (state as any).chapters || new Map();
    const settings = (state as any).settings;
    
    return TranslationService.shouldEnableRetranslation(chapterId, chapters, settings);
  },
  
  isTranslationActive: (chapterId) => {
    // Use Zustand's reactive state instead of TranslationService's internal state
    // This ensures UI updates when translation status changes
    const state = get();
    return chapterId in state.activeTranslations || TranslationService.isTranslationActive(chapterId);
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
      debugLog('translation', 'summary', `[TranslationsSlice] Deleted translation version ${translationId} for chapter ${chapterId}`);

      // If the deleted version was the active one, we need to promote a new version
      if (activeTranslation && activeTranslation.id === translationId) {
        const remainingVersions = await get().fetchTranslationVersions(chapterId);
        if (remainingVersions.length > 0) {
          // Set the latest remaining version as active (they are sorted by version descending)
          const latestVersion = remainingVersions[0];
          await get().setActiveTranslationVersion(chapterId, latestVersion.version);
          debugLog('translation', 'summary', `[TranslationsSlice] Promoted version ${latestVersion.version} to active for chapter ${chapterId}`);
        } else {
          // No versions left, so we clear the translation result from the chapter
          const chaptersActions = get() as any;
          if (chaptersActions.updateChapter) {
            chaptersActions.updateChapter(chapterId, {
              translationResult: null,
              translationSettingsSnapshot: null,
            });
          }
          debugLog('translation', 'summary', `[TranslationsSlice] No translations left for chapter ${chapterId}`);
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
      debugLog('translation', 'summary', '[TranslationsSlice] After update - suggestedIllustrations:', chAfter?.translationResult?.suggestedIllustrations || []);
      debugLog('translation', 'summary', '[TranslationsSlice] After update - translation contains marker?', chAfter?.translationResult?.translation?.includes(newMarker));
    } catch (e) {
      console.warn('[TranslationsSlice] Failed to log post-update diagnostics:', e);
    }

    const updatedChapter = (get().chapters as Map<string, EnhancedChapter>).get(chapterId);
    if (!updatedChapter?.translationResult) {
      return;
    }

    const stateSnapshot = get() as any;
    const persistenceSettings: TranslationSettingsSnapshot = {
      provider: stateSnapshot.settings.provider,
      model: stateSnapshot.settings.model,
      temperature: stateSnapshot.settings.temperature,
      systemPrompt: stateSnapshot.settings.systemPrompt,
      promptId: stateSnapshot.activePromptTemplate?.id,
      promptName: stateSnapshot.activePromptTemplate?.name,
    };

    TranslationPersistenceService.persistUpdatedTranslation(
      chapterId,
      updatedChapter.translationResult as any,
      persistenceSettings
    ).then((stored) => {
      if (stored && !(updatedChapter.translationResult as any).id) {
        try {
          (get() as any).updateChapter(chapterId, { translationResult: stored as any });
        } catch (e) {
          console.warn('[TranslationsSlice] Failed to merge persisted translation after illustration update:', e);
        }
      }
    }).catch((error) => {
      console.warn('[TranslationsSlice] Failed to persist translation after illustration update:', error);
    });
  }
});
