import React from 'react';

export interface SettingsTabConfig {
  id: string;
  label: string;
}

interface SettingsTabsProps {
  tabs: SettingsTabConfig[];
  activeTab: string;
  onSelect: (tabId: string) => void;
}

export const SettingsTabs: React.FC<SettingsTabsProps> = ({ tabs, activeTab, onSelect }) => {
  if (tabs.length === 0) return null;

  return (
    <div className="px-4 sm:px-6 md:px-8 pt-4 border-b border-gray-200 dark:border-gray-700">
      <div className="flex gap-1 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className={`px-3 py-2 text-xs sm:text-sm rounded-t-md whitespace-nowrap flex-shrink-0 ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};
