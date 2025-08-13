
import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, TranslationProvider } from '../types';
import useAppStore from '../store/useAppStore';
import { AVAILABLE_MODELS, AVAILABLE_IMAGE_MODELS } from '../constants';
import { MODELS } from '../costs';
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
    importSession,
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
      importSession: state.importSession,
      promptTemplates: state.promptTemplates,
      activePromptTemplate: state.activePromptTemplate,
      createPromptTemplate: state.createPromptTemplate,
      updatePromptTemplate: state.updatePromptTemplate,
      deletePromptTemplate: state.deletePromptTemplate,
      setActivePromptTemplate: state.setActivePromptTemplate
  })));

  const [currentSettings, setCurrentSettings] = useState(settings);
  const [showCreatePrompt, setShowCreatePrompt] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null);
  const [newPromptName, setNewPromptName] = useState('');
  const [newPromptDescription, setNewPromptDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentSettings(settings);
  }, [settings, isOpen]);
  
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

  const handleCreatePrompt = async () => {
    if (!newPromptName.trim()) return;
    
    await createPromptTemplate(
      newPromptName.trim(),
      currentSettings.systemPrompt,
      newPromptDescription.trim() || undefined
    );
    
    setShowCreatePrompt(false);
    setNewPromptName('');
    setNewPromptDescription('');
  };

  const handleSelectPrompt = async (templateId: string) => {
    await setActivePromptTemplate(templateId);
    const template = promptTemplates.find(t => t.id === templateId);
    if (template) {
      setCurrentSettings(prev => ({
        ...prev,
        systemPrompt: template.content,
        activePromptId: templateId
      }));
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

  const availableTextModels = AVAILABLE_MODELS[currentSettings.provider] || [];
  const availableImageModels = AVAILABLE_IMAGE_MODELS['Gemini'] || [];

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

        <div className="p-6 sm:p-8 space-y-8 overflow-y-auto">
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
                  </select>
                </div>
                <div>
                  <label htmlFor="model" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Text Model</label>
                  <select
                    id="model"
                    value={currentSettings.model}
                    onChange={(e) => handleSettingChange('model', e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  >
                    {availableTextModels.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                  <label htmlFor="imageModel" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Image Generation Model (Gemini only)</label>
                  <select
                    id="imageModel"
                    value={currentSettings.imageModel}
                    onChange={(e) => handleSettingChange('imageModel', e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  >
                    {availableImageModels.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
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
                  <div key={template.id} className={`border rounded-md p-3 ${template.id === activePromptTemplate?.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'}`}>
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
                          Created: {new Date(template.createdAt).toLocaleDateString()}
                          {template.lastUsed && ` • Last used: ${new Date(template.lastUsed).toLocaleDateString()}`}
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
                        ) : (
                          <button
                            onClick={() => setEditingPrompt(template.id)}
                            className="px-2 py-1 bg-gray-500 text-white text-xs rounded-md hover:bg-gray-600 transition"
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
                rows={10}
                className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-900 dark:text-gray-200 dark:border-gray-600 font-mono text-xs"
             />
          </fieldset>

        </div>
        <footer className="px-6 sm:px-8 py-4 bg-gray-50 dark:bg-gray-700/50 mt-auto sticky bottom-0 flex justify-between items-center gap-4">
            <div className="flex items-center gap-2">
                 <input type="file" ref={fileInputRef} onChange={importSession} style={{display: 'none'}} accept=".json" />
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