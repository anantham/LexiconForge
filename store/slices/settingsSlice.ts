/**
 * Settings Slice - Manages application settings and prompt templates
 * 
 * Handles:
 * - App settings (API keys, models, parameters)
 * - Prompt template management
 * - Settings persistence
 * - Default settings and initialization
 */

import type { StateCreator } from 'zustand';
import type { StoreState } from '../storeTypes';
import type { AppSettings, PromptTemplate } from '../../types';
import type { OpenRouterKeyUsageCache } from '../../services/openrouterService';
import type { ProviderCreditSummary, SupportedCreditProvider } from '../../services/providerCreditCacheService';
import { SessionManagementService, defaultSettings } from '../../services/sessionManagementService';
import { debugLog, debugWarn } from '../../utils/debug';
import { providerCreditCacheService } from '../../services/providerCreditCacheService';
import { getConfiguredApiKey } from '../../services/ai/providerCredentials';
import { audioService } from '../../services/audio/AudioService';

const syncAudioProviders = (
  previousSettings: AppSettings,
  nextSettings: AppSettings,
  force = false
): void => {
  const previousKey = getConfiguredApiKey(previousSettings, 'PiAPI');
  const nextKey = getConfiguredApiKey(nextSettings, 'PiAPI');
  if (force || previousKey !== nextKey) {
    audioService.initialize(nextSettings);
  }
};

export interface SettingsState {
  // Core settings
  settings: AppSettings;
  
  // Prompt templates
  promptTemplates: PromptTemplate[];
  activePromptTemplate: PromptTemplate | null;
  
  // Settings status
  settingsLoaded: boolean;
  settingsError: string | null;
  
  // OpenRouter dynamic catalogue state (cached)
  openRouterModels?: { data: any[]; fetchedAt: string } | null;
  openRouterKeyUsage?: OpenRouterKeyUsageCache | null;
  providerCredits: Partial<Record<SupportedCreditProvider, ProviderCreditSummary | null>>;
}

export interface SettingsActions {
  // Settings management
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;
  loadSettings: () => void;
  
  // Prompt template management
  loadPromptTemplates: () => Promise<void>;
  createPromptTemplate: (template: Omit<PromptTemplate, 'id' | 'createdAt'>) => Promise<void>;
  updatePromptTemplate: (template: PromptTemplate) => Promise<void>;
  deletePromptTemplate: (id: string) => Promise<void>;
  setActivePromptTemplate: (id: string) => Promise<void>;
  
  // OpenRouter helpers
  loadOpenRouterCatalogue: (force?: boolean) => Promise<void>;
  refreshOpenRouterModels: () => Promise<void>;
  refreshOpenRouterCredits: () => Promise<void>;
  getOpenRouterOptions: (search?: string) => Array<{ id: string; label: string; lastUsed?: string; priceKey?: number | null }>;
  refreshProviderCredits: (provider: SupportedCreditProvider) => Promise<void>;
  loadProviderCreditsFromCache: () => Promise<void>;
  
  // Utility methods
  getPromptTemplate: (id: string) => PromptTemplate | null;
  isSettingsValid: () => boolean;
  exportSettings: () => any;
  importSettings: (config: any) => Promise<void>;
}

export type SettingsSlice = SettingsState & SettingsActions;

export const createSettingsSlice: StateCreator<
  StoreState,
  [],
  [],
  SettingsSlice
> = (set, get) => ({
  // Initial state
  settings: defaultSettings,
  promptTemplates: [],
  activePromptTemplate: null,
  settingsLoaded: false,
  settingsError: null,
  openRouterModels: null,
  openRouterKeyUsage: null,
  providerCredits: {},
  
  // Settings management
  updateSettings: (partial) => {
    const currentSettings = get().settings;
    const newSettings = SessionManagementService.updateSettings(currentSettings, partial);
    set({ settings: newSettings });
    syncAudioProviders(currentSettings, newSettings);
  },
  
  resetSettings: () => {
    const currentSettings = get().settings;
    const resetSettings = { ...defaultSettings };
    SessionManagementService.saveSettings(defaultSettings);
    set({ 
      settings: resetSettings,
      settingsError: null 
    });
    syncAudioProviders(currentSettings, resetSettings, true);
  },
  
  loadSettings: () => {
    try {
      const loadedSettings = SessionManagementService.loadSettings();
      debugLog('ui', 'summary', '📥 [SettingsSlice] Loading settings:', { provider: loadedSettings.provider, model: loadedSettings.model });
      set({
        settings: loadedSettings,
        settingsLoaded: true,
        settingsError: null
      });
      syncAudioProviders(get().settings, loadedSettings, true);
    } catch (error) {
      console.error('[SettingsSlice] Failed to load settings:', error);
      set({
        settingsError: `Failed to load settings: ${error}`,
        settingsLoaded: true
      });
    }
  },
  
  // Prompt template management
  loadPromptTemplates: async () => {
    try {
      const { templates, activeTemplate } = await SessionManagementService.loadPromptTemplates();
      set({ 
        promptTemplates: templates,
        activePromptTemplate: activeTemplate,
        settingsError: null 
      });
    } catch (error) {
      console.error('[SettingsSlice] Failed to load prompt templates:', error);
      set({ 
        settingsError: `Failed to load prompt templates: ${error}` 
      });
    }
  },
  
  createPromptTemplate: async (templateData) => {
    try {
      const template = await SessionManagementService.createPromptTemplate(templateData);
      set(state => ({
        promptTemplates: [...state.promptTemplates, template],
        settingsError: null
      }));
    } catch (error) {
      console.error('[SettingsSlice] Failed to create prompt template:', error);
      set({ 
        settingsError: `Failed to create prompt template: ${error}` 
      });
    }
  },
  
  updatePromptTemplate: async (template) => {
    try {
      await SessionManagementService.updatePromptTemplate(template);
      set(state => ({
        promptTemplates: state.promptTemplates.map(t => t.id === template.id ? template : t),
        activePromptTemplate: state.activePromptTemplate?.id === template.id ? template : state.activePromptTemplate,
        settingsError: null
      }));
    } catch (error) {
      console.error('[SettingsSlice] Failed to update prompt template:', error);
      set({ 
        settingsError: `Failed to update prompt template: ${error}` 
      });
    }
  },
  
  deletePromptTemplate: async (id) => {
    try {
      await SessionManagementService.deletePromptTemplate(id);
      set(state => ({
        promptTemplates: state.promptTemplates.filter(t => t.id !== id),
        activePromptTemplate: state.activePromptTemplate?.id === id ? null : state.activePromptTemplate,
        settingsError: null
      }));
    } catch (error) {
      console.error('[SettingsSlice] Failed to delete prompt template:', error);
      set({ 
        settingsError: `Failed to delete prompt template: ${error}` 
      });
    }
  },
  
  setActivePromptTemplate: async (id) => {
    try {
      await SessionManagementService.setActivePromptTemplate(id);
      const template = get().promptTemplates.find(t => t.id === id);
      set({ 
        activePromptTemplate: template || null,
        settings: { ...get().settings, activePromptId: id },
        settingsError: null
      });
    } catch (error) {
      console.error('[SettingsSlice] Failed to set active prompt template:', error);
      set({ 
        settingsError: `Failed to set active prompt template: ${error}` 
      });
    }
  },
  
  // Utility methods
  getPromptTemplate: (id) => {
    return get().promptTemplates.find(t => t.id === id) || null;
  },
  
  isSettingsValid: () => {
    const { settings } = get();
    
    // Check required fields
    if (!settings.provider || !settings.model) {
      return false;
    }
    
    // Check API keys based on provider
    switch (settings.provider) {
      case 'OpenAI':
        return !!settings.apiKeyOpenAI;
      case 'Gemini':
        return !!settings.apiKeyGemini;
      case 'DeepSeek':
        return !!settings.apiKeyDeepSeek;
      case 'OpenRouter':
        return !!settings.apiKeyOpenRouter;
      default:
        return false;
    }
  },
  
  exportSettings: () => {
    return SessionManagementService.exportSessionConfig();
  },
  
  importSettings: async (config) => {
    try {
      const currentSettings = get().settings;
      SessionManagementService.importSessionConfig(config);
      
      // Reload settings after import
      const loadedSettings = SessionManagementService.loadSettings();
      set({ 
        settings: loadedSettings,
        settingsError: null 
      });
      syncAudioProviders(currentSettings, loadedSettings, true);
      
      // Reload prompt templates if they were included
      await get().loadPromptTemplates();
      
    } catch (error) {
      console.error('[SettingsSlice] Failed to import settings:', error);
      set({ 
        settingsError: `Failed to import settings: ${error}` 
      });
      throw error;
    }
  },

  // OpenRouter implementations
  loadOpenRouterCatalogue: async (force = false) => {
    try {
      const { openrouterService } = await import('../../services/openrouterService');

      // Check in-memory state first
      let currentModels = get().openRouterModels;

      // If memory is empty, try loading from IndexedDB cache
      if (!currentModels?.data?.length) {
        const persistedCache = await openrouterService.getCachedModels();
        if (persistedCache?.data?.length) {
          debugLog('api', 'summary', '[SettingsSlice] Loaded models from IndexedDB cache:', persistedCache.data.length);
          set({ openRouterModels: persistedCache });
          currentModels = persistedCache;
        }
      }

      debugLog('api', 'summary', '[SettingsSlice] loadOpenRouterCatalogue called', {
        force,
        hasCachedModels: !!currentModels,
        cachedModelCount: currentModels?.data?.length || 0,
        cachedAt: currentModels?.fetchedAt,
      });

      if (!force && currentModels?.fetchedAt) {
        const age = Date.now() - new Date(currentModels.fetchedAt).getTime();
        // Use cache if less than 1 hour old
        if (age < 60 * 60 * 1000) {
          debugLog('api', 'summary', '[SettingsSlice] Using cached models, age:', Math.round(age / 1000 / 60), 'minutes');
          return;
        }
      }
      
      // Fetch fresh models
      const apiKey = getConfiguredApiKey(get().settings, 'OpenRouter');
      
      const modelsCache = await openrouterService.fetchModels(apiKey);
      
      set({ 
        openRouterModels: modelsCache,
        settingsError: null 
      });
      
    } catch (error) {
      console.error('[SettingsSlice] Failed to load OpenRouter catalogue:', error);
      set({ 
        settingsError: `Failed to load OpenRouter models: ${error}` 
      });
    }
  },

  refreshOpenRouterModels: async () => {
    await get().loadOpenRouterCatalogue(true);
  },

  refreshOpenRouterCredits: async () => {
    try {
      const { openrouterService } = await import('../../services/openrouterService');
      
      const apiKey = getConfiguredApiKey(get().settings, 'OpenRouter');
      
      if (!apiKey) {
        debugWarn('api', 'summary', '[SettingsSlice] No OpenRouter API key in Settings for credit check');
        return;
      }
      
      debugLog('translation', 'summary', '[SettingsSlice] Refreshing OpenRouter credits with the Settings key');
      
      const keyUsage = await openrouterService.fetchKeyUsage(apiKey);
      
      set({ 
        openRouterKeyUsage: keyUsage,
        settingsError: null 
      });
      
    } catch (error) {
      console.error('[SettingsSlice] Failed to refresh OpenRouter credits:', error);
      set({ 
        settingsError: `Failed to refresh OpenRouter credits: ${error}` 
      });
    }
  },

  refreshProviderCredits: async (provider) => {
    try {
      const state = get();
      const apiKey = getConfiguredApiKey(state.settings, provider);

      if (!apiKey) {
        debugWarn('api', 'summary', `[SettingsSlice] No ${provider} API key in Settings for credit check`);
        set(current => ({
          providerCredits: {
            ...current.providerCredits,
            [provider]: null,
          },
        }));
        return;
      }

      debugLog(
        'translation',
        'summary',
        `[SettingsSlice] Refreshing ${provider} credits with the Settings key`
      );

      const summary = provider === 'DeepSeek'
        ? await providerCreditCacheService.fetchDeepSeekBalance(apiKey)
        : await providerCreditCacheService.fetchPiApiBalance(apiKey);

      set(current => ({
        providerCredits: {
          ...current.providerCredits,
          [provider]: summary,
        },
        settingsError: null,
      }));
    } catch (error) {
      console.error(`[SettingsSlice] Failed to refresh ${provider} credits:`, error);
      set(current => ({
        providerCredits: {
          ...current.providerCredits,
          [provider]: null,
        },
        settingsError: `Failed to refresh ${provider} credits: ${error}`,
      }));
    }
  },

  loadProviderCreditsFromCache: async () => {
    try {
      const [deepSeek, piapi] = await Promise.all([
        providerCreditCacheService.getCachedSummary('DeepSeek').catch(() => null),
        providerCreditCacheService.getCachedSummary('PiAPI').catch(() => null),
      ]);

      set(current => ({
        providerCredits: {
          ...current.providerCredits,
          DeepSeek: deepSeek,
          PiAPI: piapi,
        },
      }));
    } catch (error) {
      console.error('[SettingsSlice] Failed to load provider credit cache:', error);
    }
  },
  getOpenRouterOptions: (search = '') => {
    const { openRouterModels } = get();
    
    if (!openRouterModels?.data) {
      return [];
    }
    
    const searchLower = search.toLowerCase();
    
    // Import functions directly instead of using require
    const isTextCapable = (m: any): boolean => {
      const ins = (m.architecture?.input_modalities || []).map((x: any) => String(x).toLowerCase());
      const outs = (m.architecture?.output_modalities || []).map((x: any) => String(x).toLowerCase());
      return ins.includes('text') && outs.includes('text');
    };
    
    const formatPerMillion = (x?: string | number | null): number | null => {
      if (x === null || x === undefined) return null;
      const n = typeof x === 'string' ? parseFloat(x) : x;
      if (!isFinite(n) || n < 0) return null;
      return n * 1_000_000;
    };
    
    return openRouterModels.data
      .filter(isTextCapable)
      .filter(m => {
        if (!searchLower) return true;
        return m.id.toLowerCase().includes(searchLower) || 
               m.name.toLowerCase().includes(searchLower);
      })
      .map(m => {
        const input = formatPerMillion(m.pricing?.prompt);
        const output = formatPerMillion(m.pricing?.completion);
        
        let label = m.name;
        let priceKey: number | null = null;
        
        if (input != null && output != null) {
          label = `${m.name} — USD ${input.toFixed(2)}/${output.toFixed(2)} per 1M`;
          priceKey = input + output;
        }
        
        return {
          id: m.id,
          label,
          priceKey
        };
      })
      .sort((a, b) => {
        const ak = a.priceKey == null ? Number.POSITIVE_INFINITY : a.priceKey;
        const bk = b.priceKey == null ? Number.POSITIVE_INFINITY : b.priceKey;
        return ak - bk || a.id.localeCompare(b.id);
      });
  }
});
