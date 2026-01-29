/**
 * VersionSelector - Desktop version dropdown with delete button
 *
 * Extracted from SessionInfo.tsx for better separation of concerns.
 */

import React from 'react';
import TrashIcon from '../icons/TrashIcon';
import { formatVersionLabel, formatVersionTimestamp } from '../../utils/versionFormatting';

export interface TranslationVersion {
  id: string;
  version: number;
  isActive?: boolean;
  model?: string;
  createdAt?: string;
  customVersionLabel?: string;
}

interface VersionSelectorProps {
  versions: TranslationVersion[];
  selectedVersion: number | '';
  onVersionSelect: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onDeleteVersion: () => void;
}

export const VersionSelector: React.FC<VersionSelectorProps> = ({
  versions,
  selectedVersion,
  onVersionSelect,
  onDeleteVersion,
}) => {
  return (
    <div className="hidden md:flex items-center gap-2 min-w-0">
      <select
        value={selectedVersion}
        onChange={onVersionSelect}
        className="px-2 py-1 text-xs text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded max-w-[22rem]"
      >
        {versions.sort((a, b) => a.version - b.version).map((v) => {
          const label = formatVersionLabel(v);
          const ts = formatVersionTimestamp(v.createdAt);
          return (
            <option key={v.id} value={v.version} title={ts}>
              {label}
            </option>
          );
        })}
      </select>
      <button
        onClick={onDeleteVersion}
        disabled={!selectedVersion}
        className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Delete selected version"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  );
};

export default VersionSelector;
