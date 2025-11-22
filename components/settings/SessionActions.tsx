import React, { useRef } from 'react';

interface SessionActionsProps {
  onSave: () => void;
  onCancel: () => void;
  onClear: () => void | Promise<void>;
  onImport: (data: any) => Promise<void> | void;
}

const SessionActions: React.FC<SessionActionsProps> = ({
  onSave,
  onCancel,
  onClear,
  onImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportSession = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        await onImport(data);
      } catch (error) {
        console.error('[SessionActions] Failed to import session:', error);
      }
    };
    reader.readAsText(file);

    event.target.value = '';
  };

  return (
    <footer className="px-4 sm:px-6 md:px-8 py-4 bg-gray-50 dark:bg-gray-700/50 mt-auto sticky bottom-0">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportSession}
        style={{ display: 'none' }}
        accept=".json"
      />
      <div className="hidden md:flex justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={handleImportClick}
            className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 transition duration-300 ease-in-out"
          >
            Import Session
          </button>
          <button
            onClick={onClear}
            className="px-4 py-2 bg-red-600 text-white font-semibold rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800 transition duration-300 ease-in-out"
          >
            Clear Session
          </button>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 transition"
          >
            Save Changes
          </button>
        </div>
      </div>

      <div className="md:hidden space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleImportClick}
            className="px-3 py-2 bg-indigo-600 text-white font-medium text-sm rounded-md shadow-sm hover:bg-indigo-700 transition duration-300 ease-in-out"
          >
            Import Session
          </button>
          <button
            onClick={onClear}
            className="px-3 py-2 bg-red-600 text-white font-medium text-sm rounded-md shadow-sm hover:bg-red-700 transition duration-300 ease-in-out"
          >
            Clear Session
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium text-sm rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium text-sm rounded-md hover:bg-blue-700 transition"
          >
            Save Changes
          </button>
        </div>
      </div>
    </footer>
  );
};

export default SessionActions;
