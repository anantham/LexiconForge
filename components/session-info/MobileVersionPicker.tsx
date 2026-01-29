/**
 * MobileVersionPicker - Mobile-friendly version selection modal
 *
 * Extracted from SessionInfo.tsx for better separation of concerns.
 */

import React from 'react';
import { createPortal } from 'react-dom';
import {
  formatVersionLabelShort,
  formatVersionLabelLong,
} from '../../utils/versionFormatting';
import type { TranslationVersion } from './VersionSelector';

interface MobileVersionPickerProps {
  versions: TranslationVersion[];
  selectedVersion: number | '';
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onVersionSelect: (version: number) => void;
  onDeleteVersion: (version: TranslationVersion) => void;
}

export const MobileVersionPicker: React.FC<MobileVersionPickerProps> = ({
  versions,
  selectedVersion,
  isOpen,
  onOpen,
  onClose,
  onVersionSelect,
  onDeleteVersion,
}) => {
  const currentVersion = versions.find(v => v.version === selectedVersion);
  const buttonLabel = currentVersion ? formatVersionLabelShort(currentVersion) : 'Select version';

  return (
    <>
      {/* Mobile trigger button */}
      <button
        onClick={onOpen}
        className="md:hidden px-2 py-1 text-xs text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded max-w-[12rem] truncate text-left"
      >
        {buttonLabel}
      </button>

      {/* Mobile picker modal */}
      {isOpen && createPortal(
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50"
          onClick={onClose}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-t-lg md:rounded-lg shadow-xl w-full md:max-w-md md:mx-4 max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Select Version</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <ul className="space-y-1">
                {versions.sort((a, b) => a.version - b.version).map((v) => {
                  const { title, subtitle } = formatVersionLabelLong(v);

                  return (
                    <li
                      key={v.id}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <input
                        type="radio"
                        id={`version-${v.version}`}
                        name="version"
                        checked={selectedVersion === v.version}
                        onChange={() => onVersionSelect(v.version)}
                        className="mt-1 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
                      />
                      <label htmlFor={`version-${v.version}`} className="flex-1 cursor-pointer">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {title}
                        </div>
                        {subtitle && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {subtitle}
                          </div>
                        )}
                      </label>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteVersion(v);
                        }}
                        className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title={`Delete version ${v.version}`}
                      >
                        🗑️
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={onClose}
                className="w-full px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default MobileVersionPicker;
