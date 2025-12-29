
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AppSettings } from '../types';
import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import ProvidersPanel from './settings/ProvidersPanel';
import MetadataPanel from './settings/MetadataPanel';
import SessionExportPanel from './settings/SessionExportPanel';
import AudioPanel from './settings/AudioPanel';
import DiffPanel from './settings/DiffPanel';
import PromptPanel from './settings/PromptPanel';
import TemplatePanel from './settings/TemplatePanel';
import AdvancedPanel from './settings/AdvancedPanel';
import GalleryPanel from './settings/GalleryPanel';
import { SettingsSidebar, type SidebarSection } from './settings/SettingsSidebar';
import { SettingsModalProvider, ParameterSupportState } from './settings/SettingsModalContext';
import DisplayPanel from './settings/DisplayPanel';
import SessionActions from './settings/SessionActions';
import { useNovelMetadata } from '../hooks/useNovelMetadata';


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
    setUIError,
    getMemoryDiagnostics,
    currentChapterId,
    chapters,
    showNotification,
  } = useAppStore(useShallow(state => ({
      settings: state.settings,
      updateSettings: state.updateSettings,
      setUIError: state.setError,
      clearSession: state.clearSession,
      importSessionData: state.importSessionData,
      getMemoryDiagnostics: state.getMemoryDiagnostics,
      currentChapterId: state.currentChapterId,
      chapters: state.chapters,
      showNotification: state.showNotification,
  })));

  const [currentSettings, setCurrentSettings] = useState(settings);
  type SettingsPanelId = 'providers' | 'prompt' | 'advanced' | 'display' | 'audio' | 'diff' | 'templates' | 'metadata' | 'gallery' | 'export';
  const [activePanel, setActivePanel] = useState<SettingsPanelId>('providers');
  const sidebarSections: SidebarSection[] = useMemo(
    () => [
      {
        id: 'settings',
        label: 'Settings',
        icon: '⚙️',
        items: [
          { id: 'providers', label: 'Providers' },
          { id: 'prompt', label: 'Prompt' },
          { id: 'advanced', label: 'Advanced' },
        ],
      },
      {
        id: 'features',
        label: 'Features',
        icon: '✨',
        items: [
          { id: 'display', label: 'Display' },
          { id: 'audio', label: 'Audio' },
          { id: 'diff', label: 'Diff Heatmap' },
        ],
      },
      {
        id: 'workspace',
        label: 'Workspace',
        icon: '📁',
        items: [
          { id: 'templates', label: 'Templates' },
          { id: 'metadata', label: 'Metadata' },
          { id: 'gallery', label: 'Gallery' },
        ],
      },
      {
        id: 'export-section',
        label: 'Export',
        icon: '📤',
        items: [{ id: 'export', label: 'Export' }],
      },
    ],
    []
  );
  const [parameterSupport, setParameterSupport] = useState<Record<string, ParameterSupportState>>({});
  const chaptersMap = useAppStore(s => s.chapters);
  const { novelMetadata, handleNovelMetadataChange } = useNovelMetadata(chaptersMap);

  useEffect(() => {
    setCurrentSettings(settings);
  }, [settings, isOpen]);

  const handleSettingChange = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setCurrentSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const modalContextValue = useMemo(
    () => ({
      currentSettings,
      handleSettingChange,
      parameterSupport,
      setParameterSupport,
      novelMetadata,
      handleNovelMetadataChange,
    }),
    [currentSettings, handleSettingChange, parameterSupport, setParameterSupport, novelMetadata, handleNovelMetadataChange]
  );

  const handleSave = () => {
    console.log('💾 [SettingsModal] Saving settings:', {
      provider: currentSettings.provider,
      model: currentSettings.model,
      fullSettings: currentSettings
    });
    updateSettings(currentSettings);

    // Verify save worked
    const savedRaw = localStorage.getItem('app-settings');
    if (savedRaw) {
      const saved = JSON.parse(savedRaw);
      console.log('✅ [SettingsModal] Verified in localStorage:', { provider: saved.provider, model: saved.model });
    }

    // Save novel metadata to localStorage
    if (novelMetadata) {
      localStorage.setItem('novelMetadata', JSON.stringify(novelMetadata));
    }

    // Clear any existing API key errors since settings were updated
    setUIError(null);

    showNotification?.('Settings saved successfully');
    onClose();
  };

  if (!isOpen) return null;

  const handleCancel = () => {
    onClose();
  };
  
  const handleClear = async () => {
    if (window.confirm('Are you sure you want to clear all cached chapters, translation versions, and settings? This will completely wipe the slate clean - all data including IndexedDB will be permanently deleted. This action cannot be undone.')) {
        await clearSession();
        onClose();
    }
  }
  
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

        <SettingsModalProvider value={modalContextValue}>
          <div className="flex flex-1 overflow-hidden">
            <SettingsSidebar
              sections={sidebarSections}
              activeItem={activePanel}
              onSelect={(panelId) => setActivePanel(panelId as SettingsPanelId)}
            />

            <div className="flex-1 p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8 overflow-y-auto">
              {activePanel === 'providers' && <ProvidersPanel isOpen={isOpen} />}
              {activePanel === 'prompt' && <PromptPanel />}
              {activePanel === 'advanced' && <AdvancedPanel />}
              {activePanel === 'display' && <DisplayPanel />}
              {activePanel === 'audio' && <AudioPanel />}
              {activePanel === 'diff' && <DiffPanel />}
              {activePanel === 'templates' && <TemplatePanel />}
              {activePanel === 'metadata' && <MetadataPanel />}
              {activePanel === 'gallery' && <GalleryPanel />}
              {activePanel === 'export' && (
                <SessionExportPanel onRequireMetadata={() => setActivePanel('metadata')} />
              )}
            </div>
          </div>
        </SettingsModalProvider>
        <SessionActions
          onSave={handleSave}
          onCancel={handleCancel}
          onClear={handleClear}
          onImport={importSessionData}
        />
      </div>
    </div>
  );
};

export default SettingsModal;
