/**
 * DeleteConfirmationDialog - Dialog for deleting the last translation version
 *
 * Shows options to either delete just the translation or the entire chapter.
 * Only shown when deleting the last remaining translation version.
 *
 * Extracted from SessionInfo.tsx for better separation of concerns.
 */

import React from 'react';
import { createPortal } from 'react-dom';

export type DeleteMode = 'translation-only' | 'chapter';

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  deleteMode: DeleteMode;
  onDeleteModeChange: (mode: DeleteMode) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmationDialog: React.FC<DeleteConfirmationDialogProps> = ({
  isOpen,
  deleteMode,
  onDeleteModeChange,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Delete Last Translation?
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            This is the last translation for this chapter. What would you like to do?
          </p>

          <div className="space-y-3 mb-6">
            <label
              className="flex items-start p-3 border-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
              style={{
                borderColor: deleteMode === 'translation-only'
                  ? 'rgb(59, 130, 246)'
                  : 'rgb(229, 231, 235)'
              }}
            >
              <input
                type="radio"
                name="deleteMode"
                value="translation-only"
                checked={deleteMode === 'translation-only'}
                onChange={(e) => onDeleteModeChange(e.target.value as DeleteMode)}
                className="mt-1 mr-3"
              />
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  Delete translation only
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Keeps the raw chapter in database. Auto-translate will create a new translation.
                </div>
              </div>
            </label>

            <label
              className="flex items-start p-3 border-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
              style={{
                borderColor: deleteMode === 'chapter'
                  ? 'rgb(59, 130, 246)'
                  : 'rgb(229, 231, 235)'
              }}
            >
              <input
                type="radio"
                name="deleteMode"
                value="chapter"
                checked={deleteMode === 'chapter'}
                onChange={(e) => onDeleteModeChange(e.target.value as DeleteMode)}
                className="mt-1 mr-3"
              />
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  Delete chapter from database
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Removes chapter completely. Use this to clean up accidentally fetched chapters.
                </div>
              </div>
            </label>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DeleteConfirmationDialog;
