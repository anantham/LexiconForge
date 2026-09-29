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

  const visibleItems = (section: SidebarSection) => section.items.filter((item) => !item.hidden);

  return (
    <>
      {/* Phones: a native picker keeps the whole width for the settings form. */}
      <div className="sm:hidden px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <label htmlFor="settings-section" className="sr-only">
          Settings section
        </label>
        <select
          id="settings-section"
          value={activeItem}
          onChange={(event) => onSelect(event.target.value)}
          className="w-full min-h-11 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-semibold"
        >
          {sections.map((section) => (
            <optgroup key={section.id} label={`${section.icon} ${section.label}`}>
              {visibleItems(section).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <nav
        aria-label="Settings sections"
        className="hidden sm:block w-48 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-y-auto flex-shrink-0"
      >
        {sections.map((section) => {
          const expanded = !collapsedSections.has(section.id);
          return (
            <div key={section.id} className="py-2">
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                aria-expanded={expanded}
                className="w-full px-4 py-2 pointer-coarse:min-h-11 flex items-center gap-2 text-left text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <span aria-hidden="true">{section.icon}</span>
                <span>{section.label}</span>
                <span className="ml-auto text-xs" aria-hidden="true">
                  {expanded ? '▼' : '▶'}
                </span>
              </button>
              {expanded && (
                <div className="mt-1">
                  {visibleItems(section).map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => onSelect(item.id)}
                      aria-current={activeItem === item.id ? 'page' : undefined}
                      className={`w-full px-4 py-2 pointer-coarse:min-h-11 pl-10 text-left text-sm ${
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
          );
        })}
      </nav>
    </>
  );
};

export default SettingsSidebar;
