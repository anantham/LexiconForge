import React from 'react';
import type { InlineEditState } from '../../hooks/useInlineTranslationEditor';

interface InlineEditToolbarProps {
  inlineEditState: InlineEditState;
  toolbarCoords: { top: number; left: number };
  onSave: () => void;
  onCancel: () => void;
  onToggleNewVersion: () => void;
}

const InlineEditToolbar: React.FC<InlineEditToolbarProps> = ({
  inlineEditState,
  toolbarCoords,
  onSave,
  onCancel,
  onToggleNewVersion,
}) => (
  <div
    className="absolute z-50 flex items-center gap-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg px-3 py-2 text-xs -translate-x-1/2"
    style={{ top: toolbarCoords.top, left: toolbarCoords.left }}
  >
    <button
      onClick={onSave}
      className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
    >
      Save
    </button>
    <button
      onClick={onCancel}
      className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
    >
      Cancel
    </button>
    <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
      <input
        type="checkbox"
        className="rounded border-gray-300 dark:border-gray-600"
        checked={inlineEditState.saveAsNewVersion}
        onChange={onToggleNewVersion}
      />
      New version
    </label>
  </div>
);

export default InlineEditToolbar;
