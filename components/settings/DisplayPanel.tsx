import React from 'react';
import { useSettingsModalContext } from './SettingsModalContext';

const DisplayPanel: React.FC = () => {
  const { currentSettings, handleSettingChange } = useSettingsModalContext();

  return (
    <fieldset>
      <legend className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
        Display & Accessibility
      </legend>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="fontSize" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Font Size: <span className="font-bold">{currentSettings.fontSize}px</span>
          </label>
          <input
            id="fontSize"
            type="range"
            min={14}
            max={24}
            value={currentSettings.fontSize}
            onChange={(e) => handleSettingChange('fontSize', parseInt(e.target.value, 10))}
            className="w-full"
          />
        </div>
        <div>
          <label htmlFor="fontStyle" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Font Style
          </label>
          <select
            id="fontStyle"
            value={currentSettings.fontStyle}
            onChange={(e) => handleSettingChange('fontStyle', e.target.value as 'sans' | 'serif')}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
          >
            <option value="serif">Serif</option>
            <option value="sans">Sans-serif</option>
          </select>
        </div>
        <div>
          <label htmlFor="lineHeight" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Line Height: <span className="font-bold">{currentSettings.lineHeight}</span>
          </label>
          <input
            id="lineHeight"
            type="range"
            min={1.5}
            max={2.2}
            step={0.1}
            value={currentSettings.lineHeight}
            onChange={(e) => handleSettingChange('lineHeight', parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
      </div>
    </fieldset>
  );
};

export default DisplayPanel;
