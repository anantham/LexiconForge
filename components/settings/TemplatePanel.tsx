import React from 'react';
import { useSettingsModalContext } from './SettingsModalContext';
import { getDefaultTemplate } from '../../services/epubService';

export const TemplatePanel: React.FC = () => {
  const { currentSettings, handleSettingChange } = useSettingsModalContext();
  const defaultTpl = getDefaultTemplate();

  return (
    <fieldset>
      <legend className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
        EPUB Template
      </legend>
      <div className="space-y-3">
        <div>
          <label htmlFor="epub-gratitude" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Gratitude message
          </label>
          <textarea
            id="epub-gratitude"
            rows={3}
            value={(currentSettings as any).epubGratitudeMessage || defaultTpl.gratitudeMessage || ''}
            onChange={(e) => handleSettingChange('epubGratitudeMessage' as any, e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label htmlFor="epub-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Project description
          </label>
          <textarea
            id="epub-description"
            rows={3}
            value={(currentSettings as any).epubProjectDescription || defaultTpl.projectDescription || ''}
            onChange={(e) => handleSettingChange('epubProjectDescription' as any, e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label htmlFor="epub-footer" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Footer (leave blank to hide)
          </label>
          <input
            id="epub-footer"
            type="text"
            value={(currentSettings as any).epubFooter ?? (defaultTpl.customFooter || '')}
            onChange={(e) => handleSettingChange('epubFooter' as any, e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>
    </fieldset>
  );
};

export default TemplatePanel;
