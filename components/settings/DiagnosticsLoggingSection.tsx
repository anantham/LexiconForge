/**
 * DiagnosticsLoggingSection - Debug level and pipeline logging controls
 *
 * Extracted from AdvancedPanel for better separation of concerns.
 */

import React from 'react';
import type { DebugPipeline } from '../../utils/debug';

type DebugLevel = 'off' | 'summary' | 'full';

interface PipelineOption {
  id: DebugPipeline;
  label: string;
  description: string;
}

const pipelineOptions: PipelineOption[] = [
  {
    id: 'indexeddb',
    label: 'IndexedDB / storage',
    description: 'Hydration, migrations, schema updates, and persistence writes.',
  },
  {
    id: 'comparison',
    label: 'Comparison workflow',
    description: 'Fan translation alignment requests and caching.',
  },
  {
    id: 'worker',
    label: 'Preload worker',
    description: 'Background chapter prefetching and translation scheduling.',
  },
  {
    id: 'audio',
    label: 'Audio / OST',
    description: 'Audio service initialization, generation, and caching.',
  },
  {
    id: 'translation',
    label: 'Translation pipeline',
    description: 'Requests sent to the main translation provider and progress updates.',
  },
  {
    id: 'image',
    label: 'Illustration pipeline',
    description: 'Image generation requests, retries, and prompt persistence.',
  },
  {
    id: 'memory',
    label: 'Memory / cache',
    description: 'Chapter cache size, hydration timings, and eviction decisions.',
  },
  {
    id: 'diff',
    label: 'Diff / semantic heatmap',
    description: 'Semantic diff analysis triggers, LLM calls, marker generation, and storage.',
  },
];

interface DiagnosticsLoggingSectionProps {
  apiDebugLevel: DebugLevel;
  onDebugLevelChange: (level: DebugLevel) => void;
  showDev: boolean;
  onShowDevToggle: () => void;
  debugPipelineSelections: DebugPipeline[];
  onTogglePipeline: (pipeline: DebugPipeline, checked: boolean) => void;
  onResetPipelines: () => void;
  onClearPipelines: () => void;
}

export const DiagnosticsLoggingSection: React.FC<DiagnosticsLoggingSectionProps> = ({
  apiDebugLevel,
  onDebugLevelChange,
  showDev,
  onShowDevToggle,
  debugPipelineSelections,
  onTogglePipeline,
  onResetPipelines,
  onClearPipelines,
}) => {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">
          Diagnostics logging level
        </label>
        <select
          value={apiDebugLevel}
          onChange={(e) => onDebugLevelChange(e.target.value as DebugLevel)}
          className="mt-1 block w-full sm:w-64 pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
        >
          <option value="off">Off — errors only</option>
          <option value="summary">Summary — request/response summaries</option>
          <option value="full">Full — include full request/response JSON</option>
        </select>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          Full also attaches EPUB parse diagnostics to the export.
        </p>
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={onShowDevToggle}
          className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-sm rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition"
        >
          {showDev ? 'Hide developer logging options' : 'Show developer logging options'}
        </button>
      </div>

      {showDev && (
        <div className="mt-4 border border-gray-300 dark:border-gray-600 rounded-md p-4 bg-gray-50 dark:bg-gray-800/40">
          <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Verbose logging pipelines</h4>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Select which subsystems should emit detailed console logs. Selections apply when the diagnostics logging level is
            set to Summary or Full.
          </p>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            {pipelineOptions.map((option) => {
              const checked = debugPipelineSelections.includes(option.id);
              return (
                <label
                  key={option.id}
                  className={`flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 rounded p-2 ${
                    apiDebugLevel === 'off' ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checked}
                    disabled={apiDebugLevel === 'off'}
                    onChange={(e) => onTogglePipeline(option.id, e.target.checked)}
                  />
                  <span>
                    <span className="block font-medium text-gray-800 dark:text-gray-100">{option.label}</span>
                    <span className="block text-gray-500 dark:text-gray-400 mt-0.5">{option.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onResetPipelines}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              disabled={apiDebugLevel === 'off'}
            >
              Select all
            </button>
            <button
              type="button"
              onClick={onClearPipelines}
              className="px-2 py-1 text-xs bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 disabled:opacity-60"
              disabled={apiDebugLevel === 'off'}
            >
              Clear all
            </button>
          </div>
          {apiDebugLevel === 'off' && (
            <p className="mt-2 text-xs text-red-500">Enable Summary or Full logging to activate pipeline logs.</p>
          )}
          {apiDebugLevel !== 'off' && debugPipelineSelections.length === 0 && (
            <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-300">
              No pipelines selected. Console will only show high-level events.
            </p>
          )}
        </div>
      )}
    </>
  );
};

export default DiagnosticsLoggingSection;
