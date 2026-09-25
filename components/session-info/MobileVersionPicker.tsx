/**
 * MobileVersionPicker - Mobile-friendly version selection modal
 *
 * Extracted from SessionInfo.tsx for better separation of concerns.
 */

import React, { useEffect } from 'react';
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

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);
  const buttonLabel = currentVersion ? formatVersionLabelShort(currentVersion) : 'Select version';

  return (
    <>
      {/* Mobile trigger button */}
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        className="md:hidden px-2 py-1 pointer-coarse:min-h-11 text-xs text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded max-w-[12rem] truncate text-left"
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
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-version-picker-title"
            className="bg-white dark:bg-gray-800 rounded-t-lg md:rounded-lg shadow-xl w-full md:max-w-md md:mx-4 max-h-[80dvh] flex flex-col pb-[env(safe-area-inset-bottom)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 id="mobile-version-picker-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">Select Version</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <ul className="space-y-1">
                {versions.sort((a, b) => a.version - b.version).map((v) => {
                  const { title, subtitle } = formatVersionLabelLong(v);

                  return (
                    <li
                      key={v.id}
                      className="flex items-center gap-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      {/* The whole row is the tap target for choosing a version. */}
                      <label className="flex flex-1 items-start gap-3 p-3 min-h-11 cursor-pointer">
                        <input
                          type="radio"
                          name="version"
                          checked={selectedVersion === v.version}
                          onChange={() => onVersionSelect(v.version)}
                          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
                        />
                        <span className="flex-1">
                          <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                            {title}
                          </span>
                          {subtitle && (
                            <span className="block text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {subtitle}
                            </span>
                          )}
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteVersion(v);
                        }}
                        aria-label={`Delete version ${v.version}`}
                        className="min-h-11 min-w-11 inline-flex items-center justify-center rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title={`Delete version ${v.version}`}
                      >
                        <span aria-hidden="true">🗑️</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="w-full px-4 py-2 min-h-11 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
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
