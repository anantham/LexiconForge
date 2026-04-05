import React from 'react';
import { useSettingsModalContext } from './SettingsModalContext';

const SillyTavernPanel: React.FC = () => {
  const { currentSettings, handleSettingChange } = useSettingsModalContext();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
          SillyTavern Integration
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Select a passage and enter the story as a participant via SillyTavern group chat.
          Requires the novel-analyzer bridge and SillyTavern to be running.
        </p>
      </div>

      <div>
        <label className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={currentSettings.enableSillyTavern ?? false}
            onChange={(e) => handleSettingChange('enableSillyTavern', e.target.checked)}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <div>
            <span className="block font-medium text-gray-800 dark:text-gray-100">
              Enable self-insert
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
              Shows a portal icon in the selection toolbar. Click it to enter the story at the selected passage.
            </span>
          </div>
        </label>
      </div>

      {currentSettings.enableSillyTavern && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Bridge URL
          </label>
          <input
            type="text"
            value={currentSettings.sillyTavernBridgeUrl ?? ''}
            onChange={(e) => handleSettingChange('sillyTavernBridgeUrl', e.target.value)}
            placeholder="http://localhost:5001"
            className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            The novel-analyzer bridge endpoint. Start it with: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">uvicorn bridge:app --port 5001</code>
          </p>
        </div>
      )}
    </div>
  );
};

export default SillyTavernPanel;
