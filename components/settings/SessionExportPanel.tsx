import React, { useState } from 'react';
import { ExportService } from '../../services/exportService';
import { useExportPanelStore } from '../../hooks/useExportPanelStore';
import { useSettingsModalContext } from './SettingsModalContext';

interface SessionExportPanelProps {
  onRequireMetadata: () => void;
}

export const SessionExportPanel: React.FC<SessionExportPanelProps> = ({ onRequireMetadata }) => {
  const { showNotification } = useExportPanelStore();
  const { currentSettings, handleSettingChange, novelMetadata } = useSettingsModalContext();
  const [quickExporting, setQuickExporting] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const handleQuickExport = async () => {
    try {
      setQuickExporting(true);
      showNotification?.('Preparing export from IndexedDB...');
      const sessionData = await ExportService.generateQuickExport();
      await ExportService.downloadJSON(sessionData, 'session.json');
      showNotification?.('Session exported successfully!');
    } catch (error) {
      console.error('Quick export failed:', error);
      showNotification?.('Error: Failed to export session');
    } finally {
      setQuickExporting(false);
    }
  };

  const handlePublishToLibrary = async () => {
    if (!novelMetadata) {
      onRequireMetadata();
      showNotification?.('Please fill in the novel metadata first');
      return;
    }

    const metadata: any = novelMetadata;
    if (!metadata.title || !metadata.author || !metadata.description) {
      onRequireMetadata();
      showNotification?.('Please fill in required fields: Title, Author, and Description');
      return;
    }

    try {
      setPublishing(true);
      showNotification?.('Preparing export from IndexedDB...');

      const metadataFile = await ExportService.generateMetadataFile(metadata);
      const sessionData = await ExportService.generatePublishExport(
        {
          id: metadataFile.id,
          title: metadata.title,
          author: metadata.author,
          originalLanguage: metadata.originalLanguage || 'Unknown',
        },
        {
          versionId: 'v1-primary',
          displayName: 'Primary Translation',
          translator: {
            name: metadata.author || 'Unknown',
            link: metadata.sourceLinks?.bestTranslation,
          },
          style: 'faithful',
          features: [],
        }
      );

      try {
        showNotification?.(
          `Select the "novels" folder\n` +
            `(Navigate to: /Users/aditya/Documents/Ongoing Local/lexiconforge-novels/novels/)\n\n` +
            `The app will create a "${metadataFile.id}" subfolder and save both files there.`
        );

        await ExportService.saveToDirectory(metadataFile, sessionData, metadataFile.id);

        showNotification?.(
          `Files saved! Now select registry.json to update it\n` + `(or Cancel to skip this step)`
        );

        try {
          await ExportService.updateRegistry(metadataFile);
          showNotification?.(
            'All done! Files saved and registry updated!\n' +
              'Next steps:\n' +
              `1. Verify files in: novels/${metadataFile.id}/\n` +
              '2. Commit and push to lexiconforge-novels repository'
          );
        } catch (registryError: any) {
          if (registryError.message?.includes('cancelled')) {
            showNotification?.(
              'Files saved! Registry not updated.\n' +
                'Next steps:\n' +
                '1. Manually update registry.json\n' +
                '2. Commit and push to lexiconforge-novels repository'
            );
          } else {
            console.error('Registry update failed:', registryError);
            showNotification?.(
              'Files saved but registry update failed!\n' +
                "You'll need to manually update registry.json.\n" +
                'Error: ' + registryError.message
            );
          }
        }
      } catch (dirError: any) {
        console.warn('[Export] Directory picker failed, falling back to individual saves:', dirError);
        const novelFolder = `/Users/aditya/Documents/Ongoing Local/lexiconforge-novels/novels/${metadataFile.id}`;

        showNotification?.(
          `Step 1: Save metadata.json\n` + `Navigate to: ${novelFolder}\n` + `(Create the folder if it doesn't exist)`
        );
        await ExportService.downloadJSON(metadataFile, 'metadata.json');

        showNotification?.(
          `Step 2: Save session.json\n` + `Save in the same folder: ${novelFolder}`
        );
        await ExportService.downloadJSON(sessionData, 'session.json');

        showNotification?.(
          `Step 3 (Optional): Update registry.json\n` +
            `Navigate to: /Users/aditya/Documents/Ongoing Local/lexiconforge-novels/\n` +
            `Select registry.json (or Cancel to skip)`
        );

        try {
          await ExportService.updateRegistry(metadataFile);
          showNotification?.(
            'All done! Files saved and registry updated!\n' +
              'Next steps:\n' +
              '1. Verify the files\n' +
              '2. Commit and push to lexiconforge-novels repository'
          );
        } catch (registryError: any) {
          if (registryError.message?.includes('cancelled')) {
            showNotification?.(
              'Files saved! Registry not updated.\n' +
                'Next steps:\n' +
                '1. Manually update registry.json\n' +
                '2. Commit and push'
            );
          } else {
            console.error('Registry update failed:', registryError);
            showNotification?.('Files saved but registry update failed!');
          }
        }
      }
    } catch (error) {
      console.error('Failed to generate library files:', error);
      showNotification?.('Error generating files. Check console for details.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <fieldset>
      <legend className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
        Export
      </legend>
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
              <input
                type="checkbox"
                className="mr-2"
                checked={(currentSettings as any).includeTitlePage !== false}
                onChange={(e) => handleSettingChange('includeTitlePage' as any, e.target.checked)}
              />
              Include title page
            </label>
            <label className="inline-flex items-center text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                className="mr-2"
                checked={(currentSettings as any).includeStatsPage !== false}
                onChange={(e) => handleSettingChange('includeStatsPage' as any, e.target.checked)}
              />
              Include acknowledgments page
            </label>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Ordering affects ToC and spine. When not all chapters have numbers, navigation order may give better results.
        </p>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Export Actions</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleQuickExport}
              disabled={quickExporting}
              className={`px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-gray-500 ${
                quickExporting ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
            >
              {quickExporting ? 'Exporting…' : 'Quick Export (Session Only)'}
            </button>

            <button
              type="button"
              onClick={handlePublishToLibrary}
              disabled={publishing}
              className={`px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                publishing ? 'bg-blue-300 text-white cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {publishing ? 'Publishing…' : 'Publish to Library'}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Quick Export downloads just the session data. Publish to Library requires filling out metadata and generates
            both metadata.json and session.json for the community registry.
          </p>
        </div>
      </div>
    </fieldset>
  );
};

export default SessionExportPanel;
