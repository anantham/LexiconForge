import React, { useState } from 'react';

export interface SidebarItem {
  id: string;
  label: string;
  hidden?: boolean;
}

export interface SidebarSection {
  id: string;
  label: string;
  icon: string;
  items: SidebarItem[];
}

interface SettingsSidebarProps {
  sections: SidebarSection[];
  activeItem: string;
  onSelect: (itemId: string) => void;
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  sections,
  activeItem,
  onSelect,
}) => {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  return (
    <div className="w-48 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-y-auto flex-shrink-0">
      {sections.map((section) => (
        <div key={section.id} className="py-2">
          <button
            onClick={() => toggleSection(section.id)}
            className="w-full px-4 py-2 flex items-center gap-2 text-left text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <span>{section.icon}</span>
            <span>{section.label}</span>
            <span className="ml-auto text-xs">
              {collapsedSections.has(section.id) ? '▶' : '▼'}
            </span>
          </button>
          {!collapsedSections.has(section.id) && (
            <div className="mt-1">
              {section.items
                .filter((item) => !item.hidden)
                .map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onSelect(item.id)}
                    className={`w-full px-4 py-2 pl-10 text-left text-sm ${
                      activeItem === item.id
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default SettingsSidebar;
