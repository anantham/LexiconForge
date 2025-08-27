
import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, TranslationProvider } from '../types';
import useAppStore from '../store/useAppStore';
import { AVAILABLE_MODELS, AVAILABLE_IMAGE_MODELS } from '../constants';
import { getDefaultTemplate } from '../services/epubService';
import { MODELS, COSTS_PER_MILLION_TOKENS, IMAGE_COSTS } from '../costs';
import { useShallow } from 'zustand/react/shallow';

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
    setActivePromptTemplate
  } = useAppStore(useShallow(state => ({
      settings: state.settings,
      updateSettings: state.updateSettings,
      clearSession: state.clearSession,
      importSessionData: state.importSessionData,
      promptTemplates: state.promptTemplates,
      activePromptTemplate: state.activePromptTemplate,
      createPromptTemplate: state.createPromptTemplate,
      updatePromptTemplate: state.updatePromptTemplate,
      deletePromptTemplate: state.deletePromptTemplate,
      setActivePromptTemplate: state.setActivePromptTemplate
  })));

  const [currentSettings, setCurrentSettings] = useState(settings);
  const [activeTab, setActiveTab] = useState<'general' | 'export' | 'templates' | 'advanced'>('general');
  const defaultTpl = getDefaultTemplate();
  const [showCreatePrompt, setShowCreatePrompt] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null);
  const [newPromptName, setNewPromptName] = useState('');
  const [newPromptDescription, setNewPromptDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentSettings(settings);
  }, [settings, isOpen]);
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
  const rawTextModels = AVAILABLE_MODELS[currentSettings.provider] || [];
  const pricedTextModels = rawTextModels
    .map(m => {
      const costs = COSTS_PER_MILLION_TOKENS[m.id];
      const input = costs?.input;
      const output = costs?.output;
      const label = (input != null && output != null)
        ? `${m.name} — $${input.toFixed(2)}/$${output.toFixed(2)} per 1M`
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
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={handleCancel}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <header className="px-6 sm:px-8 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Settings
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Customize your reading and translation experience.
          </p>
        </header>

        {/* Tabs */}
        <div className="px-6 sm:px-8 pt-4 border-b border-gray-200 dark:border-gray-700 flex gap-2">
          {[
            { id: 'general', label: 'General' },
            { id: 'export', label: 'Export' },
            { id: 'templates', label: 'Templates' },
            { id: 'advanced', label: 'Advanced' },
          ].map(t => (
            <button key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`px-3 py-2 text-sm rounded-t-md ${activeTab === t.id ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
            >{t.label}</button>
          ))}
        </div>

        <div className="p-6 sm:p-8 space-y-8 overflow-y-auto">
          {activeTab === 'general' && (<>
          {/* Translation Engine Settings */}
          <fieldset>
            <legend className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">Translation Engine</legend>
            <div className="space-y-4">
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
                        'Fixed IDs (e.g., gpt-5) are specific snapshots. The exact slug you select is passed to the API.'
                      }
                    >
                      (what do these prices mean?)
                    </span>
                  </label>
                  <select
                    id="model"
                    value={currentSettings.model}
                    onChange={(e) => handleSettingChange('model', e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  >
                    {pricedTextModels.map(m => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
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
              <p className="text-xs text-gray-500 dark:text-gray-400">Max pixels may be limited by providers (e.g., PiAPI ≤ 1,048,576). For Imagen 4, we map to supported aspect ratios and 1K/2K sizes. For Gemini image preview, we hint desired size/ratio in the prompt.</p>
              
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
                  max="10"
                  value={currentSettings.preloadCount}
                  onChange={(e) => handleSettingChange('preloadCount', parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {currentSettings.preloadCount === 0 
                    ? '🔴 Background preload is DISABLED. Chapters will only load when you navigate to them.'
                    : `How many future chapters to fetch and translate in the background for a smooth experience.`
                  }
                </p>
              </div>
              <div>
                <label htmlFor="temperature" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Temperature: <span className="font-bold text-blue-500">{currentSettings.temperature}</span></label>
                <input
                  id="temperature"
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={currentSettings.temperature}
                  onChange={(e) => handleSettingChange('temperature', parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Controls randomness/creativity. 0 = deterministic, 2 = very creative. Some models only support default (1).</p>
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
                    API keys are stored locally in your browser and visible in client-side code. For production deployments, consider using separate limited-scope keys and monitor usage.
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
              </div>
            </fieldset>
          )}

        </div>
        <footer className="px-6 sm:px-8 py-4 bg-gray-50 dark:bg-gray-700/50 mt-auto sticky bottom-0 flex justify-between items-center gap-4">
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
        </footer>
      </div>
    </div>
  );
};

export default SettingsModal;
