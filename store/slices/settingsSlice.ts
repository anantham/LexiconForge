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
import type { AppSettings, PromptTemplate } from '../../types';
import type { OpenRouterKeyUsageCache } from '../../services/openrouterService';
import type { ProviderCreditSummary, SupportedCreditProvider } from '../../services/providerCreditCacheService';
import { SessionManagementService, defaultSettings } from '../../services/sessionManagementService';
import { debugLog } from '../../utils/debug';
import { providerCreditCacheService } from '../../services/providerCreditCacheService';

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
  any,
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
  },
  
  resetSettings: () => {
    SessionManagementService.saveSettings(defaultSettings);
    set({ 
      settings: { ...defaultSettings },
      settingsError: null 
    });
  },
  
  loadSettings: () => {
    try {
      const loadedSettings = SessionManagementService.loadSettings();
      set({ 
        settings: loadedSettings,
        settingsLoaded: true,
        settingsError: null 
      });
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
      SessionManagementService.importSessionConfig(config);
      
      // Reload settings after import
      const loadedSettings = SessionManagementService.loadSettings();
      set({ 
        settings: loadedSettings,
        settingsError: null 
      });
      
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
      
      // Check if we already have cached models and they're fresh enough
      const currentModels = get().openRouterModels;
      if (!force && currentModels?.fetchedAt) {
        const age = Date.now() - new Date(currentModels.fetchedAt).getTime();
        // Use cache if less than 1 hour old
        if (age < 60 * 60 * 1000) {
          return;
        }
      }
      
      // Fetch fresh models
      let apiKey = get().settings.apiKeyOpenRouter;
      
      // If no API key in settings, check environment variables as fallback
      if (!apiKey) {
        try {
          apiKey = import.meta.env.VITE_OPENROUTER_API_KEY || 
                   (globalThis as any).process?.env?.OPENROUTER_API_KEY ||
                   '';
        } catch (e) {
          // Ignore environment access errors
        }
      }
      
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
      
      // Check for API key in settings first, then fall back to env
      let apiKey = get().settings.apiKeyOpenRouter;
      
      // If no API key in settings, check environment variables as fallback
      if (!apiKey) {
        try {
          apiKey = import.meta.env.VITE_OPENROUTER_API_KEY || 
                   (globalThis as any).process?.env?.OPENROUTER_API_KEY ||
                   '';
        } catch (e) {
          // Ignore environment access errors
        }
      }
      
      if (!apiKey) {
        console.warn('[SettingsSlice] No OpenRouter API key available for credit check (checked settings and env)');
        return;
      }
      
      debugLog('translation', 'summary', '[SettingsSlice] Using OpenRouter API key from:', get().settings.apiKeyOpenRouter ? 'settings' : 'environment');
      
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
      let apiKey: string | undefined | null;

      if (provider === 'DeepSeek') {
        apiKey = state.settings.apiKeyDeepSeek;
        if (!apiKey) {
          try {
            apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY ||
              (globalThis as any).process?.env?.DEEPSEEK_API_KEY ||
              '';
          } catch {
            /* noop */
          }
        }
      } else if (provider === 'PiAPI') {
        apiKey = (state.settings as any).apiKeyPiAPI;
        if (!apiKey) {
          try {
            apiKey = import.meta.env.VITE_PIAPI_API_KEY ||
              (globalThis as any).process?.env?.PIAPI_API_KEY ||
              '';
          } catch {
            /* noop */
          }
        }
      }

      if (!apiKey) {
        console.warn(`[SettingsSlice] No ${provider} API key available for credit check (checked settings and env)`);
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
        `[SettingsSlice] Refreshing ${provider} credits using`,
        provider === 'PiAPI'
          ? (state.settings as any).apiKeyPiAPI ? 'settings key' : 'environment key'
          : state.settings.apiKeyDeepSeek ? 'settings key' : 'environment key'
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
      if (!isFinite(n) || n <= 0) return null;
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
        let priceKey = null;
        
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
