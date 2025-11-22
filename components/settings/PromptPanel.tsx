import React, { useState } from 'react';
import { useSettingsModalContext } from './SettingsModalContext';
import { useAppStore } from '../../store';
import { useShallow } from 'zustand/react/shallow';

export const PromptPanel: React.FC = () => {
  const { currentSettings, handleSettingChange } = useSettingsModalContext();
  const {
    promptTemplates,
    activePromptTemplate,
    createPromptTemplate,
    updatePromptTemplate,
    deletePromptTemplate,
    setActivePromptTemplate,
    updateSettings,
  } = useAppStore(
    useShallow((state) => ({
      promptTemplates: state.promptTemplates,
      activePromptTemplate: state.activePromptTemplate,
      createPromptTemplate: state.createPromptTemplate,
      updatePromptTemplate: state.updatePromptTemplate,
      deletePromptTemplate: state.deletePromptTemplate,
      setActivePromptTemplate: state.setActivePromptTemplate,
      updateSettings: state.updateSettings,
    }))
  );

  const [showCreatePrompt, setShowCreatePrompt] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null);
  const [newPromptName, setNewPromptName] = useState('');
  const [newPromptDescription, setNewPromptDescription] = useState('');

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
    const template = promptTemplates.find((t) => t.id === templateId);
    if (template) {
      updateSettings({ systemPrompt: template.content, activePromptId: templateId });
      handleSettingChange('systemPrompt' as any, template.content as any);
      handleSettingChange('activePromptId' as any, templateId as any);
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
    const template = promptTemplates.find((t) => t.id === templateId);
    if (template && confirm(`Are you sure you want to delete "${template.name}"?`)) {
      await deletePromptTemplate(templateId);
    }
  };

  const handleSavePromptEdit = async (templateId: string) => {
    const template = promptTemplates.find((t) => t.id === templateId);
    if (template) {
      await updatePromptTemplate({
        ...template,
        content: currentSettings.systemPrompt,
      });
    }
    setEditingPrompt(null);
  };

  return (
    <fieldset>
      <legend className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
        Prompt Library
      </legend>
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

        <div className="space-y-2">
          {promptTemplates.map((template) => (
            <div
              id={`prompt-${template.id}`}
              key={template.id}
              className={`border rounded-md p-3 ${
                template.id === activePromptTemplate?.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'
              }`}
            >
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
                    Created: {new Date(template.createdAt).toLocaleString()}
                    {template.lastUsed && <> • Last used: {new Date(template.lastUsed).toLocaleString()}</>}
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
  );
};

export default PromptPanel;
