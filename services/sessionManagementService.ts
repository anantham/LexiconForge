/**
 * SessionManagementService - Handles session state, settings, and prompt templates
 * 
 * Extracted from useAppStore to separate session management concerns.
 * This service manages:
 * - Settings persistence and loading
 * - Session clearing and initialization
 * - Prompt template management (CRUD operations)
 * - Default settings and bootstrapping
 */

import { TemplatesOps, MaintenanceOps } from './db/operations';
import { INITIAL_SYSTEM_PROMPT } from '../config/constants';
import type { AppSettings, PromptTemplate, DiffMarkerVisibilitySettings } from '../types';
import appConfig from '../config/app.json';
import { getDefaultDiffPrompt } from './diff/promptUtils';

const settingsStorageKey = 'app-settings';

// Default settings configuration
export const defaultSettings: AppSettings = {
  contextDepth: 2,  // Reduced from 3 to save on context/costs
  preloadCount: 0,
  fontSize: 18,
  fontStyle: 'serif',
  lineHeight: 1.7,
  systemPrompt: INITIAL_SYSTEM_PROMPT,
  // Localization
  targetLanguage: 'English',
  provider: (appConfig.defaultModels?.provider as any) || 'Gemini',
  model: appConfig.defaultModels?.textModel || 'gemini-2.5-flash',
  imageModel: appConfig.defaultModels?.imageModel || 'imagen-3.0-generate-001',
  temperature: appConfig.aiParameters.defaults.temperature,
  apiKeyGemini: '',
  apiKeyOpenAI: '',
  apiKeyDeepSeek: '',
  apiKeyOpenRouter: '',
  // Advanced defaults
  maxOutputTokens: 16384,
  retryMax: 3,
  retryInitialDelayMs: 2000,
  footnoteStrictMode: appConfig.footnoteStrictMode as 'append_missing' | 'fail',
  enableHtmlRepair: true,  // Enable graceful HTML repairs by default
  enableAmendments: false, // Disable prompt amendment proposals by default
  includeFanTranslationInPrompt: true, // Include fan translations in API calls by default
  imageWidth: 1024,
  imageHeight: 1024,
  imageAspectRatio: '1:1',
  imageSizePreset: '1K',
  // Image generation advanced controls
  defaultNegativePrompt: 'low quality, blurry, distorted, text, watermark',
  defaultGuidanceScale: 3.5,
  exportOrder: 'number',
  // Diff heatmap - OFF by default to save API costs
  showDiffHeatmap: false,  // Disabled by default - costs API calls
  diffMarkerVisibility: {
    fan: true,
    rawLoss: true,
    rawGain: true,
    sensitivity: true,
    stylistic: true,
  },
  diffAnalysisPrompt: getDefaultDiffPrompt(),
};

export interface SessionData {
  settings: AppSettings;
  promptTemplates: PromptTemplate[];
  activePromptTemplate: PromptTemplate | null;
}

export interface SessionClearOptions {
  clearSettings?: boolean;
  clearPromptTemplates?: boolean;
  clearIndexedDB?: boolean;
  clearLocalStorage?: boolean;
}

const normalizeDiffVisibility = (
  visibility?: Partial<AppSettings['diffMarkerVisibility']> | Record<string, any>
): DiffMarkerVisibilitySettings => {
  const incoming = visibility ?? {};
  const normalized = {
    fan: true,
    rawLoss: true,
    rawGain: true,
    sensitivity: true,
    stylistic: true,
    ...(incoming as Record<string, boolean>),
  } as DiffMarkerVisibilitySettings;

  if (Object.prototype.hasOwnProperty.call(incoming, 'raw')) {
    const legacyRaw = (incoming as Record<string, boolean>).raw;
    if (typeof legacyRaw === 'boolean') {
      normalized.rawLoss = legacyRaw;
      normalized.rawGain = legacyRaw;
    }
  }

  if (typeof (incoming as Record<string, boolean>).stylistic === 'boolean') {
    normalized.stylistic = (incoming as Record<string, boolean>).stylistic;
  }

  return normalized;
};

export class SessionManagementService {
  
  /**
   * Load settings from localStorage with fallback to defaults
   */
  static loadSettings(): AppSettings {
    try {
      const raw = localStorage.getItem(settingsStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const merged = { ...defaultSettings, ...parsed } as AppSettings;
        merged.diffMarkerVisibility = normalizeDiffVisibility(merged.diffMarkerVisibility);
        if (!merged.diffAnalysisPrompt) {
          merged.diffAnalysisPrompt = getDefaultDiffPrompt();
        }
        return merged;
      }
    } catch (e) {
      console.warn('[SessionManagement] Failed to load settings from localStorage:', e);
    }
    return { ...defaultSettings };
  }

  /**
   * Save settings to localStorage
   */
  static saveSettings(settings: AppSettings): void {
    try {
      const normalized: AppSettings = {
        ...settings,
        diffMarkerVisibility: normalizeDiffVisibility(settings.diffMarkerVisibility),
        diffAnalysisPrompt: settings.diffAnalysisPrompt || getDefaultDiffPrompt(),
      };
      localStorage.setItem(settingsStorageKey, JSON.stringify(normalized));
    } catch (e) {
      console.warn('[SessionManagement] Failed to save settings to localStorage:', e);
    }
  }

  /**
   * Update settings with partial changes
   */
  static updateSettings(currentSettings: AppSettings, partialSettings: Partial<AppSettings>): AppSettings {
    const newSettings = {
      ...currentSettings,
      ...partialSettings,
    } as AppSettings;
    newSettings.diffMarkerVisibility = normalizeDiffVisibility(newSettings.diffMarkerVisibility);
    if (!newSettings.diffAnalysisPrompt) {
      newSettings.diffAnalysisPrompt = getDefaultDiffPrompt();
    }
    this.saveSettings(newSettings);
    return newSettings;
  }

  /**
   * Load prompt templates from IndexedDB
   */
  static async loadPromptTemplates(): Promise<{ templates: PromptTemplate[], activeTemplate: PromptTemplate | null }> {
    try {
      const templates = await TemplatesOps.getAll();
      const activeTemplateRecord = await TemplatesOps.getDefault();
      const activeTemplate = activeTemplateRecord
        ? {
            id: activeTemplateRecord.id,
            name: activeTemplateRecord.name,
            description: activeTemplateRecord.description,
            content: activeTemplateRecord.content,
            isDefault: activeTemplateRecord.isDefault,
            createdAt: activeTemplateRecord.createdAt,
            lastUsed: activeTemplateRecord.lastUsed,
          }
        : null;
      
      const normalizedTemplates = templates.map(template => ({
        id: template.id,
        name: template.name,
        description: template.description,
        content: template.content,
        isDefault: template.isDefault,
        createdAt: template.createdAt,
        lastUsed: template.lastUsed,
      }));

      const normalizedActive = activeTemplate
        ? {
            id: activeTemplate.id,
            name: activeTemplate.name,
            description: activeTemplate.description,
            content: activeTemplate.content,
            isDefault: activeTemplate.isDefault,
            createdAt: activeTemplate.createdAt,
            lastUsed: activeTemplate.lastUsed,
          }
        : null;

      return {
        templates: normalizedTemplates,
        activeTemplate: normalizedActive,
      };
    } catch (error) {
      console.error('[SessionManagement] Failed to load prompt templates:', error);
      return {
        templates: [],
        activeTemplate: null
      };
    }
  }

  /**
   * Create a new prompt template
   */
  static async createPromptTemplate(templateData: Omit<PromptTemplate, 'id' | 'createdAt'>): Promise<PromptTemplate> {
    const template: PromptTemplate = {
      ...templateData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    try {
      await TemplatesOps.store(template);
      return template;
    } catch (error) {
      console.error('[SessionManagement] Failed to create prompt template:', error);
      throw error;
    }
  }

  /**
   * Update an existing prompt template
   */
  static async updatePromptTemplate(template: PromptTemplate): Promise<void> {
    try {
      await TemplatesOps.store(template);
    } catch (error) {
      console.error('[SessionManagement] Failed to update prompt template:', error);
      throw error;
    }
  }

  /**
   * Delete a prompt template
   */
  static async deletePromptTemplate(id: string): Promise<void> {
    try {
      await TemplatesOps.delete(id);
    } catch (error) {
      console.error('[SessionManagement] Failed to delete prompt template:', error);
      throw error;
    }
  }

  /**
   * Set the active prompt template
   */
  static async setActivePromptTemplate(id: string): Promise<void> {
    try {
      await TemplatesOps.setDefault(id);
    } catch (error) {
      console.error('[SessionManagement] Failed to set active prompt template:', error);
      throw error;
    }
  }

  /**
   * Get a specific prompt template by ID
   */
  static async getPromptTemplate(id: string, templates: PromptTemplate[]): Promise<PromptTemplate | null> {
    return templates.find(t => t.id === id) || null;
  }

  /**
   * Clear session data with configurable options
   */
  static async clearSession(options: SessionClearOptions = {}): Promise<void> {
    const {
      clearSettings = true,
      clearPromptTemplates = false,
      clearIndexedDB = true,
      clearLocalStorage = true
    } = options;

    try {
      // Clear IndexedDB data if requested
      if (clearIndexedDB) {
        await MaintenanceOps.clearAllData();
      }

      // Bootstrap a default prompt template if we cleared everything
      if (clearIndexedDB && clearPromptTemplates) {
        const defaultTemplate: PromptTemplate = {
          id: crypto.randomUUID(),
          name: 'Default',
          description: 'Initial system prompt',
          content: INITIAL_SYSTEM_PROMPT,
          isDefault: true,
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString(),
        };

        try {
          await TemplatesOps.store(defaultTemplate as any);
          await TemplatesOps.setDefault(defaultTemplate.id);
        } catch (e) {
          console.warn('[SessionManagement] Failed to bootstrap default prompt template', e);
        }
      }

      // Clear localStorage settings if requested
      if (clearLocalStorage && clearSettings) {
        try {
          localStorage.removeItem(settingsStorageKey);
        } catch (e) {
          console.warn('[SessionManagement] Failed to clear settings from localStorage:', e);
        }
      }

      // Clear API debug flags
      if (clearLocalStorage) {
        try {
          localStorage.removeItem('LF_AI_DEBUG');
          localStorage.removeItem('LF_AI_DEBUG_FULL');
          localStorage.removeItem('LF_AI_DEBUG_LEVEL');
          localStorage.removeItem('store-debug');
        } catch (e) {
          console.warn('[SessionManagement] Failed to clear debug flags:', e);
        }
      }

    } catch (error) {
      console.error('[SessionManagement] Failed to clear session:', error);
      throw error;
    }
  }

  /**
   * Initialize session with default data
   */
  static async initializeSession(): Promise<SessionData> {
    try {
      // Load settings
      const settings = this.loadSettings();

      // Load prompt templates
      const { templates, activeTemplate } = await this.loadPromptTemplates();

      // If no templates exist, create a default one
      if (templates.length === 0) {
        const defaultTemplate = await this.createPromptTemplate({
          name: `Default-${crypto.randomUUID().slice(0, 8)}`,
          description: 'Initial system prompt',
          content: INITIAL_SYSTEM_PROMPT,
          isDefault: true,
          lastUsed: new Date().toISOString(),
        });
        
        await this.setActivePromptTemplate(defaultTemplate.id);
        
        return {
          settings: { ...settings, activePromptId: defaultTemplate.id },
          promptTemplates: [defaultTemplate],
          activePromptTemplate: defaultTemplate
        };
      }

      return {
        settings,
        promptTemplates: templates,
        activePromptTemplate: activeTemplate
      };

    } catch (error) {
      console.error('[SessionManagement] Failed to initialize session:', error);
      
      // Fallback to minimal session
      return {
        settings: defaultSettings,
        promptTemplates: [],
        activePromptTemplate: null
      };
    }
  }

  /**
   * Check if session needs migration or repair
   */
  static async validateSession(): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // Check localStorage settings
      const settings = this.loadSettings();
      if (!settings.provider) {
        issues.push('Missing provider in settings');
      }

      // Check prompt templates
      const { templates, activeTemplate } = await this.loadPromptTemplates();
      if (templates.length === 0) {
        issues.push('No prompt templates found');
      }
      
      if (!activeTemplate) {
        issues.push('No active prompt template');
      }

    } catch (error) {
      issues.push(`Session validation error: ${error}`);
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Export session configuration
   */
  static exportSessionConfig(): any {
    const settings = this.loadSettings();
    return {
      settings,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
  }

  /**
   * Import session configuration
   */
  static importSessionConfig(config: any): void {
    try {
      if (config.settings) {
        const mergedSettings = { ...defaultSettings, ...config.settings };
        this.saveSettings(mergedSettings);
      }
    } catch (error) {
      console.error('[SessionManagement] Failed to import session config:', error);
      throw error;
    }
  }
}
