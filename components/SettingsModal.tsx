import React, { useState } from 'react';

type SettingsTab = 'translation' | 'epub' | 'metadata' | 'export' | 'preferences';

export default function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('translation');

  if (!isOpen) return null;

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'translation', label: 'Translation' },
    { id: 'epub', label: 'EPUB' },
    { id: 'metadata', label: 'Metadata' },
    { id: 'export', label: 'Export' },
    { id: 'preferences', label: 'Preferences' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {activeTab === 'translation' && <TranslationSettings />}
          {activeTab === 'epub' && <EPUBSettings />}
          {activeTab === 'metadata' && <MetadataSettings />}
          {activeTab === 'export' && <ExportSettings />}
          {activeTab === 'preferences' && <PreferencesSettings />}
        </div>
      </div>
    </div>
  );
}

// Placeholder components (will be implemented in next tasks)
function TranslationSettings() {
  return <div>Translation Settings (existing content goes here)</div>;
}

function EPUBSettings() {
  return <div>EPUB Settings (existing content goes here)</div>;
}

function MetadataSettings() {
  return <div>Novel Information</div>;
}

function ExportSettings() {
  return (
    <div>
      <button>Export Session JSON</button>
      <button>Publish to Library</button>
    </div>
  );
}

function PreferencesSettings() {
  return <div>Preferences (existing content goes here)</div>;
}
