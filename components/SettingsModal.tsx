
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppSettings, TranslationProvider } from '../types';
import { useAppStore } from '../store';
import { AVAILABLE_MODELS, AVAILABLE_IMAGE_MODELS } from '../constants';
import appConfig from '../config/app.json';
import { getDefaultTemplate } from '../services/epubService';
import { MODELS, COSTS_PER_MILLION_TOKENS, IMAGE_COSTS } from '../costs';
import { supportsStructuredOutputs, supportsParameters } from '../services/capabilityService';
import { useShallow } from 'zustand/react/shallow';
import { formatBytes } from '../services/audio/storage/utils';
import { ostLibraryService } from '../services/audio/OSTLibraryService';
import type { OSTSample } from '../services/audio/OSTLibraryService';
import { KNOWN_DEBUG_PIPELINES, DebugPipeline, getDebugPipelines as readDebugPipelines, setDebugPipelines as writeDebugPipelines, logCurrentDebugConfig, debugLog } from '../utils/debug';

const formatCurrencyValue = (value?: number | null, currency = 'USD'): string | null => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const amount = value.toFixed(2);
  return currency.toUpperCase() === 'USD' ? `$${amount}` : `${currency.toUpperCase()} ${amount}`;
};

const formatUpdatedAt = (iso?: string): string | null => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString();
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { 
    settings, 
    updateSettings, 
    clearSession, 
    importSessionData,
    promptTemplates,
    activePromptTemplate,
    createPromptTemplate,
    updatePromptTemplate,
    deletePromptTemplate,
    setActivePromptTemplate,
    loadOpenRouterCatalogue,
    refreshOpenRouterModels,
    refreshOpenRouterCredits,
    getOpenRouterOptions,
    openRouterModels,
    openRouterKeyUsage,
    providerCredits,
    refreshProviderCredits,
    loadProviderCreditsFromCache,
    // Audio settings
    selectedProvider,
    selectedTaskType,
    selectedPreset,
    volume,
    audioMetrics,
    getAvailablePresets,
    setProvider,
    setTaskType,
    setPreset,
    setVolume,
    selectedStyleAudio,
    uploadedStyleAudio,
    setStyleAudio,
    setUploadedStyleAudio,
    setUIError,
    getMemoryDiagnostics,
  } = useAppStore(useShallow(state => ({
      settings: state.settings,
      updateSettings: state.updateSettings,
      setUIError: state.setError,
      clearSession: state.clearSession,
      importSessionData: state.importSessionData,
      promptTemplates: state.promptTemplates,
      activePromptTemplate: state.activePromptTemplate,
      createPromptTemplate: state.createPromptTemplate,
      updatePromptTemplate: state.updatePromptTemplate,
      deletePromptTemplate: state.deletePromptTemplate,
      setActivePromptTemplate: state.setActivePromptTemplate,
      loadOpenRouterCatalogue: state.loadOpenRouterCatalogue,
      refreshOpenRouterModels: state.refreshOpenRouterModels,
      refreshOpenRouterCredits: state.refreshOpenRouterCredits,
      getOpenRouterOptions: state.getOpenRouterOptions,
      openRouterModels: state.openRouterModels,
      openRouterKeyUsage: state.openRouterKeyUsage,
      providerCredits: state.providerCredits,
      refreshProviderCredits: state.refreshProviderCredits,
      loadProviderCreditsFromCache: state.loadProviderCreditsFromCache,
      // Audio settings
      selectedProvider: state.selectedProvider,
      selectedTaskType: state.selectedTaskType,
      selectedPreset: state.selectedPreset,
      volume: state.volume,
      audioMetrics: state.audioMetrics,
      getAvailablePresets: state.getAvailablePresets,
      setProvider: state.setProvider,
      setTaskType: state.setTaskType,
      setPreset: state.setPreset,
      setVolume: state.setVolume,
      selectedStyleAudio: state.selectedStyleAudio,
      uploadedStyleAudio: state.uploadedStyleAudio,
      setStyleAudio: state.setStyleAudio,
      setUploadedStyleAudio: state.setUploadedStyleAudio,
      getMemoryDiagnostics: state.getMemoryDiagnostics,
  })));

  const openRouterCreditLine = useMemo(() => {
    if (!openRouterKeyUsage) return 'Credits remaining: —';

    const remaining =
      openRouterKeyUsage.remainingCredits ??
      openRouterKeyUsage.remaining ??
      null;
    const total =
      openRouterKeyUsage.totalCredits ??
      openRouterKeyUsage.limit ??
      null;
    const fetchedAt = formatUpdatedAt(openRouterKeyUsage.fetchedAt);

    if (remaining == null && total == null) {
      return fetchedAt
        ? `Credits remaining: ∞ (updated ${fetchedAt})`
        : 'Credits remaining: ∞';
    }

    const parts: string[] = [];
    const primary = formatCurrencyValue(remaining);
    if (primary) {
      const withTotal = total != null ? formatCurrencyValue(total) : null;
      parts.push(`Credits remaining: ${primary}${withTotal ? ` of ${withTotal}` : ''}`);
    } else if (total != null) {
      parts.push(`Credits remaining: ${formatCurrencyValue(total) ?? '—'} total`);
    } else {
      parts.push('Credits remaining: —');
    }

    if (fetchedAt) {
      parts.push(`(updated ${fetchedAt})`);
    }

    return parts.join(' ');
  }, [openRouterKeyUsage]);

  const deepSeekCreditLine = useMemo(() => {
    const entry = providerCredits?.DeepSeek ?? null;
    if (!entry) return 'Balance: —';

    const balance = formatCurrencyValue(entry.remaining ?? entry.total, entry.currency) ?? '—';
    const extras: string[] = [];
    const granted = formatCurrencyValue(entry.granted, entry.currency);
    const topped = formatCurrencyValue(entry.toppedUp, entry.currency);
    if (granted) extras.push(`granted ${granted}`);
    if (topped) extras.push(`topped-up ${topped}`);

    let summary = `Balance: ${balance}`;
    if (extras.length) summary += ` (${extras.join(', ')})`;
    if (entry.note) summary += ` (${entry.note})`;

    const fetchedAt = formatUpdatedAt(entry.fetchedAt);
    if (fetchedAt) summary += ` (updated ${fetchedAt})`;
    return summary;
  }, [providerCredits]);

  const piApiCreditLine = useMemo(() => {
    const entry = providerCredits?.PiAPI ?? null;
    if (!entry) return 'Balance: —';

    const balance = formatCurrencyValue(entry.remaining ?? entry.total, entry.currency) ?? '—';
    let summary = `Balance (USD): ${balance}`;
    if (entry.note) summary += ` (${entry.note})`;
    const fetchedAt = formatUpdatedAt(entry.fetchedAt);
    if (fetchedAt) summary += ` (updated ${fetchedAt})`;

    const metadata = entry.metadata || {};
    const details: string[] = [];
    if (typeof metadata?.account_name === 'string') details.push(`Account: ${metadata.account_name}`);
    if (typeof metadata?.account_id === 'string') details.push(`ID: ${metadata.account_id}`);
    if (details.length) summary += ` — ${details.join(' • ')}`;
    return summary;
  }, [providerCredits]);

  const [currentSettings, setCurrentSettings] = useState(settings);
  const [activeTab, setActiveTab] = useState<'general' | 'export' | 'templates' | 'audio' | 'advanced'>('general');
  const defaultTpl = getDefaultTemplate();
  const [showCreatePrompt, setShowCreatePrompt] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null);
  const [newPromptName, setNewPromptName] = useState('');
  const [newPromptDescription, setNewPromptDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [orSearch, setOrSearch] = useState('');
  const [lastUsedMap, setLastUsedMap] = useState<Record<string, string>>({});
  const [structuredOutputSupport, setStructuredOutputSupport] = useState<Record<string, boolean | null>>({});
  const [parameterSupport, setParameterSupport] = useState<Record<string, { 
    temperature: boolean | null;
    topP: boolean | null; 
    frequencyPenalty: boolean | null;
    presencePenalty: boolean | null;
    seed: boolean | null;
  }>>({});
  const [ostSamples, setOstSamples] = useState<OSTSample[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadOSTSamples = async () => {
      try {
        const samples = await ostLibraryService.getSamples();
        setOstSamples(samples);
      } catch (error) {
        console.error('Failed to load OST samples:', error);
      }
    };
    
    loadOSTSamples();
  }, []);

  const handleTaskTypeChange = (taskType: 'txt2audio' | 'audio2audio') => {
    setTaskType(taskType);
    if (taskType === 'txt2audio') {
      // Clear style audio when switching to txt2audio
      setStyleAudio(null);
      setUploadedStyleAudio(null);
    }
  };
  
  const handleStyleAudioChange = (audioId: string) => {
    setStyleAudio(audioId);
    setUploadedStyleAudio(null); // Clear uploaded file
  };
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3'];
      if (!validTypes.includes(file.type)) {
        setError('Please upload a valid audio file (MP3, WAV, OGG)');
        return;
      }
      
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
      
      setUploadedStyleAudio(file);
      setStyleAudio(null); // Clear OST selection
    }
  };

  useEffect(() => {
    setCurrentSettings(settings);
  }, [settings, isOpen]);

  // Check structured output support for current models when provider/model changes
  useEffect(() => {
    if (!isOpen) return;
    
    const checkStructuredOutputSupport = async (provider: string, modelId: string) => {
      const key = `${provider}:${modelId}`;
      if (structuredOutputSupport[key] !== null) return; // Already checked
      
      try {
        const hasSupport = await supportsStructuredOutputs(provider, modelId);
        setStructuredOutputSupport(prev => ({ ...prev, [key]: hasSupport }));
      } catch (error) {
        console.warn(`Failed to check structured output support for ${provider}:${modelId}`, error);
        setStructuredOutputSupport(prev => ({ ...prev, [key]: false }));
      }
    };
    
    // Check parameter support for current model
    const checkParameterSupport = async (provider: string, modelId: string) => {
      const key = `${provider}:${modelId}`;
      if (parameterSupport[key]) return; // Already checked
      
      try {
        const [temperature, topP, frequencyPenalty, presencePenalty, seed] = await Promise.all([
          supportsParameters(provider, modelId, ['temperature']),
          supportsParameters(provider, modelId, ['top_p']),
          supportsParameters(provider, modelId, ['frequency_penalty']),
          supportsParameters(provider, modelId, ['presence_penalty']),
          supportsParameters(provider, modelId, ['seed'])
        ]);
        
        setParameterSupport(prev => ({ 
          ...prev, 
          [key]: { temperature, topP, frequencyPenalty, presencePenalty, seed }
        }));
      } catch (error) {
        console.warn(`Failed to check parameter support for ${provider}:${modelId}`, error);
        setParameterSupport(prev => ({ 
          ...prev, 
          [key]: { temperature: null, topP: null, frequencyPenalty: null, presencePenalty: null, seed: null }
        }));
      }
    };
    
    checkStructuredOutputSupport(currentSettings.provider, currentSettings.model);
    checkParameterSupport(currentSettings.provider, currentSettings.model);
  }, [currentSettings.provider, currentSettings.model, isOpen, structuredOutputSupport, parameterSupport]);

  // Pre-check structured output support for all visible models when provider changes
  useEffect(() => {
    if (!isOpen || currentSettings.provider === 'OpenRouter') return; // Skip for OpenRouter due to large model list
    
    const checkAllModels = async () => {
      const models = AVAILABLE_MODELS[currentSettings.provider] || [];
      for (const model of models) {
        const key = `${currentSettings.provider}:${model.id}`;
        if (structuredOutputSupport[key] !== null) continue; // Already checked
        
        try {
          const hasSupport = await supportsStructuredOutputs(currentSettings.provider, model.id);
          setStructuredOutputSupport(prev => ({ ...prev, [key]: hasSupport }));
          // Small delay to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          console.warn(`Failed to check structured output support for ${currentSettings.provider}:${model.id}`, error);
          setStructuredOutputSupport(prev => ({ ...prev, [key]: false }));
        }
      }
    };
    
    checkAllModels();
  }, [currentSettings.provider, isOpen, structuredOutputSupport]);

  // For OpenRouter, check structured output support on-demand when model selection changes
  useEffect(() => {
    if (!isOpen || currentSettings.provider !== 'OpenRouter') return;
    
    const checkOpenRouterModel = async (modelId: string) => {
      const key = `OpenRouter:${modelId}`;
      debugLog('api', 'full', `[Capability Check] Checking model: ${key}`);
      if (structuredOutputSupport[key] !== undefined && structuredOutputSupport[key] !== null) {
        debugLog('api', 'full', `[Capability Check] Skipping ${key}, already checked. Result: ${structuredOutputSupport[key]}`);
        return;
      }

      try {
        debugLog('api', 'full', `[Capability Check] Calling supportsStructuredOutputs for ${key}`);
        const hasSupport = await supportsStructuredOutputs('OpenRouter', modelId);
        debugLog('api', 'full', `[Capability Check] Result for ${key}: ${hasSupport}`);
        setStructuredOutputSupport(prev => {
          debugLog('api', 'full', `[Capability Check] Updating state for ${key} to ${hasSupport}`);
          return { ...prev, [key]: hasSupport };
        });
      } catch (error) {
        console.warn(`Failed to check structured output support for OpenRouter:${modelId}`, error);
        setStructuredOutputSupport(prev => ({ ...prev, [key]: false }));
      }
    };
    
    checkOpenRouterModel(currentSettings.model);
  }, [currentSettings.provider, currentSettings.model, isOpen]);

  // Load OpenRouter catalogue + credits when modal opens on OpenRouter, or when switching to OpenRouter
  useEffect(() => {
    if (!isOpen) return;
    if (currentSettings.provider !== 'OpenRouter') return;
    loadOpenRouterCatalogue(false);
    refreshOpenRouterCredits();
    (async () => {
      try {
        const { openrouterService } = await import('../services/openrouterService');
        const map = await openrouterService.getLastUsedMap();
        setLastUsedMap(map);
      } catch {}
    })();
  }, [isOpen, currentSettings.provider]);

  useEffect(() => {
    if (!isOpen) return;
    loadProviderCreditsFromCache();
  }, [isOpen, loadProviderCreditsFromCache]);
  // Developer settings hooks must be before early return to obey Rules of Hooks
  const [showDev, setShowDev] = useState(false);
  type DebugLevel = 'off' | 'summary' | 'full';
  const [apiDebugLevel, setApiDebugLevel] = useState<DebugLevel>(() => {
    try {
      const lvl = localStorage.getItem('LF_AI_DEBUG_LEVEL') as DebugLevel | null;
      if (lvl === 'off' || lvl === 'summary' || lvl === 'full') return lvl;
      // Backward-compat with old flags
      const full = localStorage.getItem('LF_AI_DEBUG_FULL') === '1';
      const summary = localStorage.getItem('LF_AI_DEBUG') === '1';
      if (full) return 'full';
      if (summary) return 'summary';
      return 'off';
    } catch { return 'off'; }
  });
  const setDebugLevel = (level: DebugLevel) => {
    setApiDebugLevel(level);
    try {
      localStorage.setItem('LF_AI_DEBUG_LEVEL', level);
      // Normalize legacy flags so providers can keep using them
      if (level === 'off') {
        localStorage.removeItem('LF_AI_DEBUG');
        localStorage.removeItem('LF_AI_DEBUG_FULL');
      } else if (level === 'summary') {
        localStorage.setItem('LF_AI_DEBUG', '1');
        localStorage.removeItem('LF_AI_DEBUG_FULL');
      } else if (level === 'full') {
        localStorage.setItem('LF_AI_DEBUG', '1');
        localStorage.setItem('LF_AI_DEBUG_FULL', '1');
      }
    } catch {}
  };

  const sortPipelineSelections = (values: DebugPipeline[]): DebugPipeline[] =>
    KNOWN_DEBUG_PIPELINES.filter((pipeline) => values.includes(pipeline));

  const getInitialPipelineSelection = (): DebugPipeline[] => {
    const stored = readDebugPipelines();
    if (stored.length === 0) {
      return [...KNOWN_DEBUG_PIPELINES];
    }
    return sortPipelineSelections(stored);
  };

  const [debugPipelineSelections, setDebugPipelineSelections] = useState<DebugPipeline[]>(getInitialPipelineSelection);

  useEffect(() => {
    if (!isOpen) return;
    const stored = readDebugPipelines();
    if (stored.length === 0) {
      setDebugPipelineSelections([...KNOWN_DEBUG_PIPELINES]);
    } else {
      setDebugPipelineSelections(sortPipelineSelections(stored));
    }
  }, [isOpen]);

  const togglePipeline = (pipeline: DebugPipeline, checked: boolean) => {
    setDebugPipelineSelections((prev) => {
      const nextSet = new Set(prev);
      if (checked) nextSet.add(pipeline);
      else nextSet.delete(pipeline);
      const next = sortPipelineSelections(Array.from(nextSet) as DebugPipeline[]);
      writeDebugPipelines(next);
      logCurrentDebugConfig();
      return next;
    });
  };

  const handleResetPipelines = () => {
    const next = [...KNOWN_DEBUG_PIPELINES];
    setDebugPipelineSelections(next);
    writeDebugPipelines(next);
    logCurrentDebugConfig();
  };

  const handleClearPipelines = () => {
    setDebugPipelineSelections([]);
    writeDebugPipelines([]);
    logCurrentDebugConfig();
  };

  const pipelineOptions: Array<{ id: DebugPipeline; label: string; description: string }> = [
    {
      id: 'indexeddb',
      label: 'IndexedDB / storage',
      description: 'Hydration, migrations, schema updates, and persistence writes.',
    },
    {
      id: 'comparison',
      label: 'Comparison workflow',
      description: 'Fan translation alignment requests and caching.',
    },
    {
      id: 'worker',
      label: 'Preload worker',
      description: 'Background chapter prefetching and translation scheduling.',
    },
    {
      id: 'audio',
      label: 'Audio / OST',
      description: 'Audio service initialization, generation, and caching.',
    },
    {
      id: 'translation',
      label: 'Translation pipeline',
      description: 'Requests sent to the main translation provider and progress updates.',
    },
    {
      id: 'image',
      label: 'Illustration pipeline',
      description: 'Image generation requests, retries, and prompt persistence.',
    },
    {
      id: 'memory',
      label: 'Memory / cache',
      description: 'Chapter cache size, hydration timings, and eviction decisions.',
    },
  ];
  

  // Helpers for aspect ratio and size presets
  const applyAspectAndSize = (ratio: string, preset: string) => {
    if (preset === 'CUSTOM') return;
    const long = preset === '2K' ? 2048 : (preset === '1K' ? 1024 : 768);
    const parts = ratio.split(':').map(n => parseInt(n, 10));
    let w = (currentSettings as any).imageWidth || 1024;
    let h = (currentSettings as any).imageHeight || 1024;
    if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
      const rw = parts[0], rh = parts[1];
      if (rw >= rh) { w = long; h = Math.round(long * rh / rw); }
      else { h = long; w = Math.round(long * rw / rh); }
    } else { w = long; h = long; }
    handleSettingChange('imageWidth' as any, w);
    handleSettingChange('imageHeight' as any, h);
  };
  if (!isOpen) return null;

  const handleSettingChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const newSettings = { ...currentSettings, [key]: value };

    if (key === 'provider') {
      const newProvider = value as TranslationProvider;
      const firstModelForProvider = MODELS.find(m => m.provider === newProvider);
      if (firstModelForProvider) {
        newSettings.model = firstModelForProvider.id;
      }
    }
    
    setCurrentSettings(newSettings);
  };

  const handleSave = () => {
    updateSettings(currentSettings);
    
    // Clear any existing API key errors since settings were updated
    setUIError(null);
    
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };
  
  const handleClear = async () => {
    if (window.confirm('Are you sure you want to clear all cached chapters, translation versions, and settings? This will completely wipe the slate clean - all data including IndexedDB will be permanently deleted. This action cannot be undone.')) {
        await clearSession();
        onClose();
    }
  }
  
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportSession = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        await importSessionData(data);
        console.log('[Import] Session data imported successfully');
        // Optionally show success feedback
      } catch (error) {
        console.error('[Import] Failed to import session:', error);
        // Error is already handled by importSessionData setting error state
      }
    };
    reader.readAsText(file);
    
    // Reset the input so the same file can be imported again
    event.target.value = '';
  };

  const handleCreatePrompt = async () => {
    if (!newPromptName.trim()) return;
    
    await createPromptTemplate({
      name: newPromptName.trim(),
      content: currentSettings.systemPrompt,
      description: newPromptDescription.trim() || undefined,
      isDefault: false,
    });
    
    setShowCreatePrompt(false);
    setNewPromptName('');
    setNewPromptDescription('');
  };

  const handleSelectPrompt = async (templateId: string) => {
    await setActivePromptTemplate(templateId);
    const template = promptTemplates.find(t => t.id === templateId);
    if (template) {
      // Immediately apply globally
      updateSettings({ systemPrompt: template.content, activePromptId: templateId });
      // Reflect in local modal state
      setCurrentSettings(prev => ({
        ...prev,
        systemPrompt: template.content,
        activePromptId: templateId,
      }));
      // Visual cue: scroll and highlight the active prompt
      requestAnimationFrame(() => {
        const el = document.getElementById(`prompt-${templateId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-blue-400');
          setTimeout(() => el.classList.remove('ring-2', 'ring-blue-400'), 1200);
        }
      });
    }
  };

  const handleDeletePrompt = async (templateId: string) => {
    const template = promptTemplates.find(t => t.id === templateId);
    if (template && confirm(`Are you sure you want to delete "${template.name}"?`)) {
      await deletePromptTemplate(templateId);
    }
  };

  const handleSavePromptEdit = async (templateId: string) => {
    const template = promptTemplates.find(t => t.id === templateId);
    if (template) {
      await updatePromptTemplate({
        ...template,
        content: currentSettings.systemPrompt
      });
    }
    setEditingPrompt(null);
  };

  // Build priced, sorted text models for the selected provider
  const rawTextModels = MODELS.filter(m => m.provider === currentSettings.provider) || [];
  const pricedTextModels = currentSettings.provider === 'OpenRouter'
    ? (() => {
        const options = getOpenRouterOptions(orSearch);
        // Apply last-used ordering: top 10 by recency
        const withLU = options.map(o => ({...o, lastUsed: lastUsedMap[o.id]}));
        const recents = withLU.filter(o => !!o.lastUsed)
          .sort((a, b) => new Date(b.lastUsed!).getTime() - new Date(a.lastUsed!).getTime())
          .slice(0, 10);
        const recentIds = new Set(recents.map(r => r.id));
        const rest = withLU.filter(o => !recentIds.has(o.id))
          .sort((a, b) => {
            const ak = a.priceKey == null ? Number.POSITIVE_INFINITY : a.priceKey;
            const bk = b.priceKey == null ? Number.POSITIVE_INFINITY : b.priceKey;
            return ak - bk || a.id.localeCompare(b.id);
          });
        const combined = recents.concat(rest);
        return combined.map(m => ({ id: m.id, name: m.label, label: m.label, sortKey: m.priceKey ?? Number.POSITIVE_INFINITY }));
      })()
    : rawTextModels
        .map(m => {
          const costs = COSTS_PER_MILLION_TOKENS[m.id];
          const input = costs?.input;
          const output = costs?.output;
          const label = (input != null && output != null)
            ? `${m.name} — USD ${input.toFixed(2)}/${output.toFixed(2)} per 1M`
            : m.name;
          const sortKey = (input != null && output != null) ? (input + output) : Number.POSITIVE_INFINITY;
          return { ...m, label, sortKey };
        })
        .sort((a, b) => a.sortKey - b.sortKey);

  // Build priced, sorted image models (Gemini only)
  const rawImageModels = AVAILABLE_IMAGE_MODELS['Gemini'] || [];
  const pricedImageModels = rawImageModels
    .map(m => {
      const price = IMAGE_COSTS[m.id];
      const label = (price != null)
        ? `${m.name} — $${price.toFixed(3)}/image`
        : m.name;
      const sortKey = (price != null) ? price : Number.POSITIVE_INFINITY;
      return { ...m, label, sortKey };
    })
    .sort((a, b) => a.sortKey - b.sortKey);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-2 sm:p-4" onClick={handleCancel}>
      <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-md sm:max-w-2xl lg:max-w-3xl max-h-[95vh] sm:max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <header className="px-6 sm:px-8 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Settings
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Customize your reading and translation experience.
          </p>
        </header>

        {/* Tabs */}
        <div className="px-4 sm:px-6 md:px-8 pt-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {[
              { id: 'general', label: 'General' },
              { id: 'export', label: 'Export' },
              { id: 'templates', label: 'Templates' },
              { id: 'audio', label: 'Audio' },
              { id: 'advanced', label: 'Advanced' },
            ].map(t => (
              <button key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`px-3 py-2 text-xs sm:text-sm rounded-t-md whitespace-nowrap flex-shrink-0 ${activeTab === t.id ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
              >{t.label}</button>
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8 overflow-y-auto">
          {activeTab === 'general' && (<>
          {/* Translation Engine Settings */}
          <fieldset>
            <legend className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">Translation Engine</legend>
            <div className="space-y-4">
              <div>
                <label htmlFor="sourceLanguage" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Source Language</label>
                <input
                  id="sourceLanguage"
                  type="text"
                  value={(currentSettings as any).sourceLanguage || 'Korean'}
                  onChange={(e) => handleSettingChange('sourceLanguage' as any, e.target.value)}
                  placeholder="e.g., Korean, Japanese"
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
                />
              </div>
              <div>
                <label htmlFor="targetLanguage" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Target Language</label>
                <input
                  id="targetLanguage"
                  type="text"
                  value={(currentSettings as any).targetLanguage || 'English'}
                  onChange={(e) => handleSettingChange('targetLanguage' as any, e.target.value)}
                  placeholder="e.g., English, Malayalam, Español"
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="provider" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Text Provider</label>
                  <select
                    id="provider"
                    value={currentSettings.provider}
                    onChange={(e) => handleSettingChange('provider', e.target.value as TranslationProvider)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  >
                    <option value="Gemini">Google Gemini</option>
                    <option value="OpenAI">OpenAI</option>
                    <option value="DeepSeek">DeepSeek</option>
                    <option value="OpenRouter">OpenRouter</option>
                    <option value="Claude">Claude (Anthropic)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="model" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Text Model
                    <span
                      className="ml-2 inline-block text-xs text-gray-500 dark:text-gray-400 cursor-help"
                      title={
                        'Prices are shown as $input/$output per 1M tokens.\n' +
                        '• Input = prompt/context tokens you send.\n' +
                        '• Output = tokens the model generates (includes thinking tokens when applicable).\n' +
                        'Model IDs ending with “latest” are rolling aliases managed by the provider (e.g., gpt-5-chat-latest).\n' +
                        'Fixed IDs (e.g., gpt-5) are specific snapshots. The exact slug you select is passed to the API.\n\n' +
                        'Green checkmarks (✅) indicate models that support structured outputs for better JSON schema compliance.'
                      }
                    >
                      (pricing & capabilities)
                    </span>
                  </label>
                  {currentSettings.provider === 'OpenRouter' && (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="text"
                        placeholder="Search models…"
                        value={orSearch}
                        onChange={(e) => setOrSearch(e.target.value)}
                        className="flex-1 p-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          refreshOpenRouterModels();
                          // Clear structured output cache for OpenRouter to re-check capabilities
                          setStructuredOutputSupport(prev => {
                            const filtered = Object.fromEntries(
                              Object.entries(prev).filter(([key]) => !key.startsWith('OpenRouter:'))
                            );
                            return filtered;
                          });
                        }}
                        className="px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 rounded-md"
                        title={`Last updated: ${openRouterModels?.fetchedAt ? new Date(openRouterModels.fetchedAt).toLocaleString() : '—'}`}
                      >
                        Refresh models
                      </button>
                    </div>
                  )}
                  <select
                    id="model"
                    value={currentSettings.model}
                    onChange={(e) => handleSettingChange('model', e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  >
                    {pricedTextModels.map(m => {
                      const supportKey = `${currentSettings.provider}:${m.id}`;
                      const hasStructuredSupport = structuredOutputSupport[supportKey];
                      const badge = hasStructuredSupport ? " ✅" : "";
                      return (
                        <option key={m.id} value={m.id}>{m.label}{badge}</option>
                      );
                    })}
                  </select>
                  {currentSettings.provider === 'OpenRouter' && (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Models updated: {openRouterModels?.fetchedAt ? new Date(openRouterModels.fetchedAt).toLocaleString() : '—'}
                    </div>
                  )}
                  
                  {/* Current model structured output support indicator */}
                  {(() => {
                    const currentSupportKey = `${currentSettings.provider}:${currentSettings.model}`;
                    const currentSupport = structuredOutputSupport[currentSupportKey];
                    return currentSupport === true ? (
                      <div className="mt-2 flex items-center text-xs text-green-600 dark:text-green-400">
                        <span className="mr-1">✅</span>
                        This model supports structured outputs for better schema compliance
                      </div>
                    ) : currentSupport === false ? (
                      <div className="mt-2 flex items-center text-xs text-gray-500 dark:text-gray-400">
                        <span className="mr-1">ℹ️</span>
                        This model uses JSON object format with fallback handling
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
              <div>
                  <label htmlFor="imageModel" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Image Generation Model
                    <span
                      className="ml-2 inline-block text-xs text-gray-500 dark:text-gray-400 cursor-help"
                      title={
                        'Image prices are per generated image.\n' +
                        'Some image models are previews and may have rate limits or change behavior.'
                      }
                    >
                      (pricing?)
                    </span>
                  </label>
                  <select
                    id="imageModel"
                    value={currentSettings.imageModel}
                    onChange={(e) => handleSettingChange('imageModel', e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  >
                    <option value="None">None (Disable Illustrations) — $0.000/image</option>
                    {pricedImageModels.map(m => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Dedicated models like Imagen can produce higher quality images. All image generation requires a Gemini API key.</p>
              </div>
              
              <div>
                <label htmlFor="contextDepth" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Context Depth: <span className="font-bold text-blue-500">{currentSettings.contextDepth}</span></label>
                <input
                  id="contextDepth"
                  type="range"
                  min="0"
                  max="5"
                  value={currentSettings.contextDepth}
                  onChange={(e) => handleSettingChange('contextDepth', parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">How many previous chapters to send as context. More improves consistency but costs more.</p>
              </div>
              <div>
                <label htmlFor="preloadCount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Pre-load Ahead: 
                  <span className={`font-bold ml-1 ${currentSettings.preloadCount === 0 ? 'text-red-500' : 'text-blue-500'}`}>
                    {currentSettings.preloadCount === 0 ? 'DISABLED' : currentSettings.preloadCount}
                  </span>
                </label>
                <input
                  id="preloadCount"
                  type="range"
                  min="0"
                  max="50"
                  value={currentSettings.preloadCount}
                  onChange={(e) => handleSettingChange('preloadCount', parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {currentSettings.preloadCount === 0 
                    ? '🔴 Background preload is DISABLED. Chapters will only load when you navigate to them.'
                    : `How many future chapters to fetch and translate in the background (serially). Higher values may increase API usage and hit provider rate limits.`
                  }
                </p>
              </div>
            </div>
          </fieldset>
           {/* API Keys */}
          <fieldset>
            <legend className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">API Keys</legend>
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Security Notice</h3>
                  <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                    Your API keys are stored locally on your device. This is a static app with no backend; all data (including keys) lives in your browser’s storage.
                  </p>
                  <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                    Requests to providers (OpenAI, Gemini, OpenRouter, etc.) are sent directly from your current browser session, and your keys are never sent anywhere else. This project is open source - browse the
                    {' '}
                    <a href="https://github.com/anantham/LexiconForge" target="_blank" rel="noopener noreferrer" className="underline font-medium">repo</a>
                    {' '}and see.
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="apiKeyGemini" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Google Gemini API Key</label>
                <input
                  id="apiKeyGemini"
                  type="password"
                  value={currentSettings.apiKeyGemini || ''}
                  onChange={(e) => handleSettingChange('apiKeyGemini', e.target.value)}
                  placeholder="Enter your Gemini API Key"
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-900 dark:text-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                {/* OpenAI API Key - Note: Usage dashboards require a backend proxy due to OpenAI CORS restrictions.
                    Users should check their billing portal for spend details. No balance refresh endpoint available. */}
                <label htmlFor="apiKeyOpenAI" className="block text-sm font-medium text-gray-700 dark:text-gray-300">OpenAI API Key</label>
                <input
                  id="apiKeyOpenAI"
                  type="password"
                  value={currentSettings.apiKeyOpenAI || ''}
                  onChange={(e) => handleSettingChange('apiKeyOpenAI', e.target.value)}
                  placeholder="Enter your OpenAI API Key"
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-900 dark:text-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="apiKeyDeepSeek" className="block text-sm font-medium text-gray-700 dark:text-gray-300">DeepSeek API Key</label>
                <input
                  id="apiKeyDeepSeek"
                  type="password"
                  value={currentSettings.apiKeyDeepSeek || ''}
                  onChange={(e) => handleSettingChange('apiKeyDeepSeek', e.target.value)}
                  placeholder="Enter your DeepSeek API Key"
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-900 dark:text-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => refreshProviderCredits('DeepSeek')}
                    className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded-md"
                  >
                    Refresh balance
                  </button>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {deepSeekCreditLine}
                  </span>
                </div>
              </div>
              <div>
                <label htmlFor="apiKeyOpenRouter" className="block text-sm font-medium text-gray-700 dark:text-gray-300">OpenRouter API Key</label>
                <input
                  id="apiKeyOpenRouter"
                  type="password"
                  value={(currentSettings as any).apiKeyOpenRouter || ''}
                  onChange={(e) => handleSettingChange('apiKeyOpenRouter' as any, e.target.value)}
                  placeholder="Enter your OpenRouter API Key"
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-900 dark:text-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => refreshOpenRouterCredits()}
                    className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded-md"
                  >
                    Refresh credits
                  </button>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {openRouterCreditLine}
                  </span>
                </div>
              </div>
              <div>
                <label htmlFor="apiKeyClaude" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Claude API Key</label>
                <input
                  id="apiKeyClaude"
                  type="password"
                  value={currentSettings.apiKeyClaude || ''}
                  onChange={(e) => handleSettingChange('apiKeyClaude', e.target.value)}
                  placeholder="Enter your Claude API Key"
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-900 dark:text-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="apiKeyPiAPI" className="block text-sm font-medium text-gray-700 dark:text-gray-300">PiAPI API Key</label>
                <input
                  id="apiKeyPiAPI"
                  type="password"
                  value={(currentSettings as any).apiKeyPiAPI || ''}
                  onChange={(e) => handleSettingChange('apiKeyPiAPI' as any, e.target.value)}
                  placeholder="Enter your PiAPI API Key"
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-900 dark:text-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => refreshProviderCredits('PiAPI')}
                    className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded-md"
                  >
                    Refresh balance
                  </button>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {piApiCreditLine}
                  </span>
                </div>
              </div>
            </div>
          </fieldset>
          {/* Display & Accessibility */}
          <fieldset>
            <legend className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">Display & Accessibility</legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="fontSize" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Font Size: <span className="font-bold">{currentSettings.fontSize}px</span></label>
                <input id="fontSize" type="range" min="14" max="24" value={currentSettings.fontSize} onChange={(e) => handleSettingChange('fontSize', parseInt(e.target.value, 10))} className="w-full" />
              </div>
              <div>
                <label htmlFor="fontStyle" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Font Style</label>
                <select id="fontStyle" value={currentSettings.fontStyle} onChange={(e) => handleSettingChange('fontStyle', e.target.value as 'sans' | 'serif')} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                  <option value="serif">Serif</option>
                  <option value="sans">Sans-serif</option>
                </select>
              </div>
              <div>
                <label htmlFor="lineHeight" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Line Height: <span className="font-bold">{currentSettings.lineHeight}</span></label>
                <input id="lineHeight" type="range" min="1.5" max="2.2" step="0.1" value={currentSettings.lineHeight} onChange={(e) => handleSettingChange('lineHeight', parseFloat(e.target.value))} className="w-full" />
              </div>
            </div>
          </fieldset>

          {/* Prompt Library */}
          <fieldset>
            <legend className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">Prompt Library</legend>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Save and manage different system prompts for different novel types or translation styles.
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Active: <span className="font-medium">{activePromptTemplate?.name || 'None'}</span>
                  </p>
                </div>
                <button
                  onClick={() => setShowCreatePrompt(true)}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition"
                >
                  + Create New
                </button>
              </div>

              {/* Create new prompt form */}
              {showCreatePrompt && (
                <div className="border border-gray-300 dark:border-gray-600 rounded-md p-4 bg-gray-50 dark:bg-gray-700">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Create New Prompt Template</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                      <input
                        type="text"
                        value={newPromptName}
                        onChange={(e) => setNewPromptName(e.target.value)}
                        placeholder="e.g., Wuxia Romance, Technical Manual"
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description (Optional)</label>
                      <input
                        type="text"
                        value={newPromptDescription}
                        onChange={(e) => setNewPromptDescription(e.target.value)}
                        placeholder="Brief description of when to use this prompt"
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => setShowCreatePrompt(false)}
                        className="px-3 py-1 bg-gray-500 text-white text-sm rounded-md hover:bg-gray-600 transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreatePrompt}
                        disabled={!newPromptName.trim()}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition"
                      >
                        Create
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Existing templates */}
              <div className="space-y-2">
                {promptTemplates.map(template => (
                  <div id={`prompt-${template.id}`} key={template.id} className={`border rounded-md p-3 ${template.id === activePromptTemplate?.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">{template.name}</h4>
                          {template.id === activePromptTemplate?.id && (
                            <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">Active</span>
                          )}
                        </div>
                        {template.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{template.description}</p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Created: {new Date(template.createdAt).toLocaleString(undefined, { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                          {template.lastUsed && (
                            <> • Last used: {new Date(template.lastUsed).toLocaleString(undefined, { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {template.id !== activePromptTemplate?.id && (
                          <button
                            onClick={() => handleSelectPrompt(template.id)}
                            className="px-2 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition"
                          >
                            Use
                          </button>
                        )}
                        {template.id === activePromptTemplate?.id && editingPrompt === template.id ? (
                          <button
                            onClick={() => handleSavePromptEdit(template.id)}
                            className="px-2 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 transition"
                          >
                            Save
                          </button>
                        ) : template.id === activePromptTemplate?.id ? (
                          <button
                            onClick={() => setEditingPrompt(template.id)}
                            className="px-2 py-1 bg-gray-500 text-white text-xs rounded-md hover:bg-gray-600 transition"
                          >
                            Edit
                          </button>
                        ) : (
                          <button
                            disabled
                            title="Activate this prompt (Use) to edit"
                            className="px-2 py-1 bg-gray-300 dark:bg-gray-600 text-white text-xs rounded-md opacity-60 cursor-not-allowed"
                          >
                            Edit
                          </button>
                        )}
                        {promptTemplates.length > 1 && (
                          <button
                            onClick={() => handleDeletePrompt(template.id)}
                            className="px-2 py-1 bg-red-600 text-white text-xs rounded-md hover:bg-red-700 transition"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </fieldset>

          {/* System Prompt */}
          <fieldset>
             <legend className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
               System Prompt
               {activePromptTemplate && editingPrompt === activePromptTemplate.id && (
                 <span className="ml-2 text-sm text-blue-600 dark:text-blue-400">(Editing: {activePromptTemplate.name})</span>
               )}
             </legend>
             <textarea
                value={currentSettings.systemPrompt}
                onChange={(e) => handleSettingChange('systemPrompt', e.target.value)}
                readOnly={!(activePromptTemplate && editingPrompt === activePromptTemplate.id)}
                rows={10}
                className={`w-full p-2 border rounded-md font-mono text-xs ${activePromptTemplate && editingPrompt === activePromptTemplate.id ? 'border-blue-300 dark:border-blue-600 dark:bg-gray-900 dark:text-gray-200' : 'border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed'}`}
             />
          </fieldset>
          </>) }

          {activeTab === 'export' && (
            <fieldset>
              <legend className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">Export</legend>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Chapter ordering</label>
                    <select
                      value={(currentSettings as any).exportOrder || 'number'}
                      onChange={(e) => handleSettingChange('exportOrder' as any, e.target.value as any)}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                      <option value="number">By chapter number</option>
                      <option value="navigation">By navigation order</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="inline-flex items-center text-sm text-gray-700 dark:text-gray-300">
                      <input type="checkbox" className="mr-2" checked={(currentSettings as any).includeTitlePage !== false}
                        onChange={(e) => handleSettingChange('includeTitlePage' as any, e.target.checked)} />
                      Include title page
                    </label>
                    <label className="inline-flex items-center text-sm text-gray-700 dark:text-gray-300">
                      <input type="checkbox" className="mr-2" checked={(currentSettings as any).includeStatsPage !== false}
                        onChange={(e) => handleSettingChange('includeStatsPage' as any, e.target.checked)} />
                      Include acknowledgments page
                    </label>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Ordering affects ToC and spine. When not all chapters have numbers, navigation order may give better results.</p>
              </div>
            </fieldset>
          )}

          {activeTab === 'templates' && (
            <fieldset>
              <legend className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">EPUB Template</legend>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Gratitude message</label>
                  <textarea
                    rows={3}
                    value={(currentSettings as any).epubGratitudeMessage || defaultTpl.gratitudeMessage || ''}
                    onChange={(e) => handleSettingChange('epubGratitudeMessage' as any, e.target.value)}
                    className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Project description</label>
                  <textarea rows={3} value={(currentSettings as any).epubProjectDescription || defaultTpl.projectDescription || ''}
                    onChange={(e) => handleSettingChange('epubProjectDescription' as any, e.target.value)}
                    className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Footer (leave blank to hide)</label>
                  <input type="text" value={(currentSettings as any).epubFooter ?? (defaultTpl.customFooter || '')}
                    onChange={(e) => handleSettingChange('epubFooter' as any, e.target.value)}
                    className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
                </div>
              </div>
            </fieldset>
          )}

          {activeTab === 'audio' && (
            <fieldset>
              <legend className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">Audio Settings</legend>
              
              <div className="space-y-6">
                {/* Provider Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Audio Provider</label>
                  <select
                    value={selectedProvider}
                    onChange={(e) => setProvider(e.target.value as any)}
                    className="block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  >
                    <option value="ace-step">Ace Step (Flexible durations)</option>
                    <option value="diffrhythm">DiffRhythm (Fixed durations)</option>
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {selectedProvider === 'ace-step' 
                      ? 'Variable length audio (10-240s) at $0.0005/second'
                      : 'Fixed length audio: 1.35min or 4.45min at $0.02/generation'
                    }
                  </p>
                </div>

                {/* Task Type Selector */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Generation Mode
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTaskTypeChange('txt2audio')}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        selectedTaskType === 'txt2audio'
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700'
                          : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                    >
                      Text → Audio
                    </button>
                    <button
                      onClick={() => handleTaskTypeChange('audio2audio')}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        selectedTaskType === 'audio2audio'
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700'
                          : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                    >
                      Audio → Audio
                    </button>
                  </div>
                </div>

                {/* Style Audio Selection (only for audio2audio) */}
                {selectedTaskType === 'audio2audio' && (
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Reference Audio Style
                    </label>
                    
                    {/* OST Library Dropdown */}
                    <select
                      value={selectedStyleAudio || ''}
                      onChange={(e) => handleStyleAudioChange(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 mb-2"
                    >
                      <option value="">Select from OST Library...</option>
                      {ostSamples.map(sample => (
                        <option key={sample.id} value={sample.url}>
                          {sample.name} ({sample.category})
                        </option>
                      ))}
                    </select>
                    
                    {/* File Upload */}
                    <div className="text-center text-xs text-gray-500 mb-2">or</div>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleFileUpload}
                      className="w-full text-xs text-gray-600 dark:text-gray-400"
                    />
                    
                    {/* Current Selection Display */}
                    {uploadedStyleAudio && (
                      <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded text-xs">
                        ✓ Uploaded: {uploadedStyleAudio.name}
                      </div>
                    )}
                    {selectedStyleAudio && !uploadedStyleAudio && (
                      <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded text-xs">
                        ✓ OST Selected: {ostSamples.find(s => s.url === selectedStyleAudio)?.name}
                      </div>
                    )}
                  </div>
                )}

                {/* Style Preset Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Music Style</label>
                  <select
                    value={selectedPreset || ''}
                    onChange={(e) => setPreset(e.target.value || null)}
                    className="block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Auto-detect from content</option>
                    {getAvailablePresets().map(preset => (
                      <option key={preset.id} value={preset.id}>{preset.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Choose a specific style or let AI analyze chapter content for appropriate music
                  </p>
                </div>

                {/* Volume Control */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Default Volume: {Math.round(volume * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>

                {/* Usage Statistics */}
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-md">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Usage Statistics</h3>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Total Cost:</span>
                      <span className="ml-2 font-mono">${audioMetrics.totalCost.toFixed(4)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Generations:</span>
                      <span className="ml-2 font-mono">{audioMetrics.generationCount}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Total Duration:</span>
                      <span className="ml-2 font-mono">{Math.round(audioMetrics.totalDuration / 60)}m {Math.round(audioMetrics.totalDuration % 60)}s</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Avg Cost/Min:</span>
                      <span className="ml-2 font-mono">${audioMetrics.totalDuration > 0 ? (audioMetrics.totalCost / (audioMetrics.totalDuration / 60)).toFixed(4) : '0.0000'}</span>
                    </div>
                  </div>
                </div>

                {/* How it Works */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md">
                  <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">How It Works</h3>
                  <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                    <li>• Click the music icon in any chapter header to generate OST</li>
                    <li>• Audio is cached locally for offline playback</li>
                    <li>• Content is analyzed to choose appropriate music style</li>
                    <li>• Generated audio plays in background while reading</li>
                  </ul>
                </div>
              </div>
            </fieldset>
          )}

          {activeTab === 'advanced' && (
            <fieldset>
              <legend className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">Advanced</legend>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">API logging level</label>
                  <select
                    value={apiDebugLevel}
                    onChange={(e) => setDebugLevel(e.target.value as DebugLevel)}
                    className="mt-1 block w-full sm:w-64 pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  >
                    <option value="off">Off — errors only</option>
                    <option value="summary">Summary — request/response summaries</option>
                    <option value="full">Full — include full request/response JSON</option>
                  </select>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Full also attaches EPUB parse diagnostics to the export.</p>
                </div>

                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setShowDev((prev) => !prev)}
                    className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-sm rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                  >
                    {showDev ? 'Hide developer logging options' : 'Show developer logging options'}
                  </button>
                </div>

                {showDev && (
                  <div className="mt-4 border border-gray-300 dark:border-gray-600 rounded-md p-4 bg-gray-50 dark:bg-gray-800/40">
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Verbose logging pipelines</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Select which subsystems should emit detailed console logs. Selections apply when the logging level is set to Summary or Full.
                    </p>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {pipelineOptions.map((option) => {
                        const checked = debugPipelineSelections.includes(option.id);
                        return (
                          <label
                            key={option.id}
                            className={`flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 rounded p-2 ${apiDebugLevel === 'off' ? 'opacity-40 cursor-not-allowed' : ''}`}
                          >
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={checked}
                              disabled={apiDebugLevel === 'off'}
                              onChange={(e) => togglePipeline(option.id, e.target.checked)}
                            />
                            <span>
                              <span className="block font-medium text-gray-800 dark:text-gray-100">{option.label}</span>
                              <span className="block text-gray-500 dark:text-gray-400 mt-0.5">{option.description}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={handleResetPipelines}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                        disabled={apiDebugLevel === 'off'}
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={handleClearPipelines}
                        className="px-2 py-1 text-xs bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 disabled:opacity-60"
                        disabled={apiDebugLevel === 'off'}
                      >
                        Clear all
                      </button>
                    </div>
                    {apiDebugLevel === 'off' && (
                      <p className="mt-2 text-xs text-red-500">Enable Summary or Full logging to activate pipeline logs.</p>
                    )}
                    {apiDebugLevel !== 'off' && debugPipelineSelections.length === 0 && (
                      <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-300">
                        No pipelines selected. Console will only show high-level events.
                      </p>
                    )}
                  </div>
                )}

                {/* Image Dimensions */}
                <fieldset>
                  <legend className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3 border-b border-gray-200 dark:border-gray-700 pb-1">Image Generation</legend>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="imageWidth" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Image Width (px)</label>
                      <input
                        id="imageWidth"
                        type="number"
                        min={256}
                        max={2048}
                        step={64}
                        value={(currentSettings as any).imageWidth || 1024}
                        onChange={(e) => handleSettingChange('imageWidth' as any, Math.max(256, Math.min(2048, parseInt(e.target.value || '1024', 10))))}
                        className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label htmlFor="imageHeight" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Image Height (px)</label>
                      <input
                        id="imageHeight"
                        type="number"
                        min={256}
                        max={2048}
                        step={64}
                        value={(currentSettings as any).imageHeight || 1024}
                        onChange={(e) => handleSettingChange('imageHeight' as any, Math.max(256, Math.min(2048, parseInt(e.target.value || '1024', 10))))}
                        className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Max pixels may be limited by providers (e.g., PiAPI ≤ 1,048,576). For Imagen 4, we map to supported aspect ratios and 1K/2K sizes. For Gemini image preview, we hint desired size/ratio in the prompt.</p>
                  
                  {/* Advanced Image Generation Controls */}
                  <div className="mt-6 space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">Advanced Defaults</h4>
                    <div>
                      <label htmlFor="defaultNegativePrompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Default Negative Prompt</label>
                      <textarea
                        id="defaultNegativePrompt"
                        rows={2}
                        value={(currentSettings as any).defaultNegativePrompt || ''}
                        onChange={(e) => handleSettingChange('defaultNegativePrompt' as any, e.target.value)}
                        placeholder="low quality, blurry, distorted, text, watermark"
                        className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Default negative prompt used for all new illustrations (what you don't want in images)</p>
                    </div>
                    <div>
                      <label htmlFor="defaultGuidanceScale" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Default Guidance Scale: <span className="font-mono text-xs">{((currentSettings as any).defaultGuidanceScale || 3.5).toFixed(1)}</span>
                      </label>
                      <input
                        id="defaultGuidanceScale"
                        type="range"
                        min="1.5"
                        max="5.0"
                        step="0.1"
                        value={(currentSettings as any).defaultGuidanceScale || 3.5}
                        onChange={(e) => handleSettingChange('defaultGuidanceScale' as any, parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                      />
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span>1.5 (Creative)</span>
                        <span>5.0 (Precise)</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">How closely the AI follows prompts (higher = more precise, lower = more creative)</p>
                    </div>
                  </div>
                </fieldset>
                
                {/* AI Parameters */}
                <fieldset>
                  <legend className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3 border-b border-gray-200 dark:border-gray-700 pb-1">AI Parameters</legend>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="temperature" className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                        Temperature: <span className="font-bold text-blue-500 mx-1">{currentSettings.temperature}</span>
                        {(() => {
                          const key = `${currentSettings.provider}:${currentSettings.model}`;
                          const support = parameterSupport[key]?.temperature;
                          if (support === true) return <span className="text-green-500 text-xs" title="Supported by this model">✓</span>;
                          if (support === false) return <span className="text-red-500 text-xs" title="Not supported by this model">✗</span>;
                          return <span className="text-gray-400 text-xs" title="Checking support...">?</span>;
                        })()}
                      </label>
                      <input
                        id="temperature"
                        type="range"
                        min={appConfig.aiParameters.limits.temperature.min}
                        max={appConfig.aiParameters.limits.temperature.max}
                        step="0.1"
                        value={currentSettings.temperature}
                        onChange={(e) => handleSettingChange('temperature', parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{appConfig.aiParameters.descriptions.temperature}</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="topP" className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                          Top P: <span className="font-bold text-blue-500 mx-1">{currentSettings.topP ?? appConfig.aiParameters.defaults.top_p}</span>
                          {(() => {
                            const key = `${currentSettings.provider}:${currentSettings.model}`;
                            const support = parameterSupport[key]?.topP;
                            if (support === true) return <span className="text-green-500 text-xs" title="Supported by this model">✓</span>;
                            if (support === false) return <span className="text-red-500 text-xs" title="Not supported by this model">✗</span>;
                            return <span className="text-gray-400 text-xs" title="Checking support...">?</span>;
                          })()}
                        </label>
                        <input
                          id="topP"
                          type="range"
                          min={appConfig.aiParameters.limits.top_p.min}
                          max={appConfig.aiParameters.limits.top_p.max}
                          step="0.05"
                          value={currentSettings.topP ?? appConfig.aiParameters.defaults.top_p}
                          onChange={(e) => handleSettingChange('topP', parseFloat(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{appConfig.aiParameters.descriptions.top_p}</p>
                      </div>
                      
                      <div>
                        <label htmlFor="seed" className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                          Seed (optional)
                          {(() => {
                            const key = `${currentSettings.provider}:${currentSettings.model}`;
                            const support = parameterSupport[key]?.seed;
                            if (support === true) return <span className="text-green-500 text-xs ml-1" title="Supported by this model">✓</span>;
                            if (support === false) return <span className="text-red-500 text-xs ml-1" title="Not supported by this model">✗</span>;
                            return <span className="text-gray-400 text-xs ml-1" title="Checking support...">?</span>;
                          })()}
                        </label>
                        <input
                          id="seed"
                          type="number"
                          min={appConfig.aiParameters.limits.seed.min}
                          max={appConfig.aiParameters.limits.seed.max}
                          value={currentSettings.seed ?? ''}
                          onChange={(e) => handleSettingChange('seed', e.target.value ? parseInt(e.target.value) : null)}
                          placeholder="Random generation"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{appConfig.aiParameters.descriptions.seed}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="frequencyPenalty" className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                          Frequency Penalty: <span className="font-bold text-blue-500 mx-1">{currentSettings.frequencyPenalty ?? appConfig.aiParameters.defaults.frequency_penalty}</span>
                          {(() => {
                            const key = `${currentSettings.provider}:${currentSettings.model}`;
                            const support = parameterSupport[key]?.frequencyPenalty;
                            if (support === true) return <span className="text-green-500 text-xs" title="Supported by this model">✓</span>;
                            if (support === false) return <span className="text-red-500 text-xs" title="Not supported by this model">✗</span>;
                            return <span className="text-gray-400 text-xs" title="Checking support...">?</span>;
                          })()}
                        </label>
                        <input
                          id="frequencyPenalty"
                          type="range"
                          min={appConfig.aiParameters.limits.frequency_penalty.min}
                          max={appConfig.aiParameters.limits.frequency_penalty.max}
                          step="0.1"
                          value={currentSettings.frequencyPenalty ?? appConfig.aiParameters.defaults.frequency_penalty}
                          onChange={(e) => handleSettingChange('frequencyPenalty', parseFloat(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{appConfig.aiParameters.descriptions.frequency_penalty}</p>
                      </div>
                      
                      <div>
                        <label htmlFor="presencePenalty" className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                          Presence Penalty: <span className="font-bold text-blue-500 mx-1">{currentSettings.presencePenalty ?? appConfig.aiParameters.defaults.presence_penalty}</span>
                          {(() => {
                            const key = `${currentSettings.provider}:${currentSettings.model}`;
                            const support = parameterSupport[key]?.presencePenalty;
                            if (support === true) return <span className="text-green-500 text-xs" title="Supported by this model">✓</span>;
                            if (support === false) return <span className="text-red-500 text-xs" title="Not supported by this model">✗</span>;
                            return <span className="text-gray-400 text-xs" title="Checking support...">?</span>;
                          })()}
                        </label>
                        <input
                          id="presencePenalty"
                          type="range"
                          min={appConfig.aiParameters.limits.presence_penalty.min}
                          max={appConfig.aiParameters.limits.presence_penalty.max}
                          step="0.1"
                          value={currentSettings.presencePenalty ?? appConfig.aiParameters.defaults.presence_penalty}
                          onChange={(e) => handleSettingChange('presencePenalty', parseFloat(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{appConfig.aiParameters.descriptions.presence_penalty}</p>
                      </div>
                    </div>
                  </div>
                </fieldset>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="maxOutputTokens" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Max Output Tokens</label>
                    <input
                      id="maxOutputTokens"
                      type="number"
                      min={256}
                      max={200000}
                      step={256}
                      value={(currentSettings as any).maxOutputTokens ?? 16384}
                      onChange={(e) => handleSettingChange('maxOutputTokens' as any, Math.max(256, Math.min(200000, parseInt(e.target.value || '16384', 10))))}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-900 dark:text-gray-200 dark:border-gray-600"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Hard cap for generated tokens. Applied where supported.</p>
                  </div>
                  <div>
                    <label htmlFor="retryMax" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Retry Attempts</label>
                    <input
                      id="retryMax"
                      type="number"
                      min={0}
                      max={10}
                      value={(currentSettings as any).retryMax ?? 3}
                      onChange={(e) => handleSettingChange('retryMax' as any, Math.max(0, Math.min(10, parseInt(e.target.value || '3', 10))))}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-900 dark:text-gray-200 dark:border-gray-600"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Max retries for rate-limits and transient failures.</p>
                  </div>
                  <div>
                    <label htmlFor="retryInitialDelayMs" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Retry Initial Delay (ms)</label>
                    <input
                      id="retryInitialDelayMs"
                      type="number"
                      min={100}
                      max={60000}
                      step={100}
                      value={(currentSettings as any).retryInitialDelayMs ?? 2000}
                      onChange={(e) => handleSettingChange('retryInitialDelayMs' as any, Math.max(100, Math.min(60000, parseInt(e.target.value || '2000', 10))))}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-900 dark:text-gray-200 dark:border-gray-600"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Exponential backoff starts with this delay.</p>
                  </div>
                </div>
                
              </div>
            </fieldset>
          )}

          {/* Memory Diagnostics Section */}
          <fieldset className="border border-gray-300 dark:border-gray-600 rounded-md p-4">
            <legend className="text-lg font-semibold px-2 text-gray-900 dark:text-gray-100">Memory Diagnostics</legend>
            <div className="space-y-4">
              {(() => {
                const diagnostics = getMemoryDiagnostics();

                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                        <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">Chapters Loaded</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{diagnostics.totalChapters}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                          {diagnostics.chaptersWithTranslations} translated • {diagnostics.chaptersWithImages} with images
                        </div>
                      </div>

                      <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                        <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">Estimated RAM Usage</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {diagnostics.estimatedRAM.totalMB.toFixed(2)} MB
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                          Content: {(diagnostics.estimatedRAM.chapterContentBytes / 1024 / 1024).toFixed(2)} MB
                          {diagnostics.estimatedRAM.base64ImageBytes > 0 && (
                            <> • Images: {(diagnostics.estimatedRAM.base64ImageBytes / 1024 / 1024).toFixed(2)} MB</>
                          )}
                        </div>
                      </div>

                      <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                        <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">Image Storage</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {diagnostics.imagesInCache + diagnostics.imagesInRAM}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                          {diagnostics.imagesInCache} in cache • {diagnostics.imagesInRAM} in RAM (legacy)
                        </div>
                      </div>
                    </div>

                    {diagnostics.warnings.length > 0 && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3">
                        <div className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                          Warnings
                        </div>
                        <ul className="space-y-1">
                          {diagnostics.warnings.map((warning, idx) => (
                            <li key={idx} className="text-xs text-yellow-700 dark:text-yellow-300">
                              {warning}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                      <p><strong>Tips:</strong></p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>For optimal performance, keep loaded chapters under 50</li>
                        <li>Legacy base64 images use significantly more RAM than cache-stored images</li>
                        <li>Run the migration script to move existing images to cache storage</li>
                        <li>Clear session data to free up memory if experiencing performance issues</li>
                      </ul>
                    </div>
                  </>
                );
              })()}
            </div>
          </fieldset>

        </div>
        <footer className="px-4 sm:px-6 md:px-8 py-4 bg-gray-50 dark:bg-gray-700/50 mt-auto sticky bottom-0">
            {/* Desktop: Horizontal layout */}
            <div className="hidden md:flex justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                   <input type="file" ref={fileInputRef} onChange={handleImportSession} style={{display: 'none'}} accept=".json" />
                   <button
                      onClick={handleImportClick}
                      className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 transition duration-300 ease-in-out"
                  >
                      Import Session
                  </button>
                   <button
                      onClick={handleClear}
                      className="px-4 py-2 bg-red-600 text-white font-semibold rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800 transition duration-300 ease-in-out"
                  >
                      Clear Session
                  </button>
              </div>
              <div className="flex items-center gap-4">
                  <button onClick={handleCancel} className="px-6 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition">
                      Cancel
                  </button>
                  <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 transition">
                      Save Changes
                  </button>
              </div>
            </div>

            {/* Mobile: Stacked layout */}
            <div className="md:hidden space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                   <input type="file" ref={fileInputRef} onChange={handleImportSession} style={{display: 'none'}} accept=".json" />
                   <button
                      onClick={handleImportClick}
                      className="px-3 py-2 bg-indigo-600 text-white font-medium text-sm rounded-md shadow-sm hover:bg-indigo-700 transition duration-300 ease-in-out"
                  >
                      Import Session
                  </button>
                   <button
                      onClick={handleClear}
                      className="px-3 py-2 bg-red-600 text-white font-medium text-sm rounded-md shadow-sm hover:bg-red-700 transition duration-300 ease-in-out"
                  >
                      Clear Session
                  </button>
              </div>
              <div className="flex gap-2">
                  <button onClick={handleCancel} className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium text-sm rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition">
                      Cancel
                  </button>
                  <button onClick={handleSave} className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium text-sm rounded-md hover:bg-blue-700 transition">
                      Save Changes
                  </button>
              </div>
            </div>
        </footer>
      </div>
    </div>
  );
};

export default SettingsModal;
