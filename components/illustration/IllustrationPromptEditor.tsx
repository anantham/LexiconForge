import React from 'react';
import PencilIcon from '../icons/PencilIcon';
import type { ImagePlanMode } from '../../types';

type EditorMode = 'caption' | 'plan';

interface IllustrationPromptEditorProps {
  caption: string;
  planJson: string;
  planMode: ImagePlanMode;
  planSourceCaption?: string | null;
  isEditing: boolean;
  isSaving: boolean;
  editorMode: EditorMode;
  validationError?: string | null;
  onEditorModeChange: (mode: EditorMode) => void;
  onStartEditing: (mode?: EditorMode) => void;
  onCaptionChange: (value: string) => void;
  onPlanChange: (value: string) => void;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
  onRegeneratePlanFromCaption?: () => void | Promise<void>;
}

const modeButtonClass = (active: boolean): string =>
  `px-2 py-1 rounded-md text-xs font-medium transition ${
    active
      ? 'bg-blue-600 text-white'
      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
  }`;

const IllustrationPromptEditor: React.FC<IllustrationPromptEditorProps> = ({
  caption,
  planJson,
  planMode,
  planSourceCaption,
  isEditing,
  isSaving,
  editorMode,
  validationError,
  onEditorModeChange,
  onStartEditing,
  onCaptionChange,
  onPlanChange,
  onSave,
  onCancel,
  onRegeneratePlanFromCaption,
}) => {
  const isManualPlan = planMode === 'manual';
  const captionDiffersFromPlan = Boolean(
    isManualPlan &&
    planSourceCaption &&
    planSourceCaption.trim() !== caption.trim()
  );

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mt-1">
            Illustration prompt
          </label>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            {isManualPlan
              ? 'Generation uses the JSON plan. Caption stays human-facing.'
              : 'Caption is the source of truth. JSON stays editable as a structured plan.'}
          </p>
          {captionDiffersFromPlan && (
            <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
              Caption and JSON plan diverged. Regeneration will follow the JSON plan.
            </p>
          )}
        </div>
        {!isEditing && (
          <button
            onClick={() => onStartEditing(editorMode)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
            title={`Edit ${editorMode === 'caption' ? 'caption' : 'JSON plan'}`}
            aria-label={`Edit ${editorMode === 'caption' ? 'caption' : 'JSON plan'}`}
          >
            <PencilIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className={modeButtonClass(editorMode === 'caption')}
          onClick={() => onEditorModeChange('caption')}
        >
          Caption
        </button>
        <button
          type="button"
          className={modeButtonClass(editorMode === 'plan')}
          onClick={() => onEditorModeChange('plan')}
        >
          JSON Plan
        </button>
        {onRegeneratePlanFromCaption && (
          <button
            type="button"
            className="px-2 py-1 rounded-md text-xs font-medium transition bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:hover:bg-emerald-900/60 disabled:opacity-60"
            onClick={() => void onRegeneratePlanFromCaption()}
            disabled={isSaving}
          >
            {isSaving ? 'Planning…' : 'AI Regenerate JSON'}
          </button>
        )}
      </div>

      {!isEditing && editorMode === 'caption' && (
        <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
          {caption || 'No caption.'}
        </p>
      )}

      {!isEditing && editorMode === 'plan' && (
        <pre className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 p-3 text-xs text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
          {planJson}
        </pre>
      )}

      {isEditing && editorMode === 'caption' && (
        <div>
          <textarea
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            value={caption}
            onChange={(e) => onCaptionChange(e.target.value)}
            placeholder="Describe or refine the image…"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => void onSave()}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 transition disabled:opacity-60"
              disabled={isSaving}
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={onCancel} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-xs rounded-md">
              Cancel
            </button>
          </div>
        </div>
      )}

      {isEditing && editorMode === 'plan' && (
        <div>
          <textarea
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={14}
            value={planJson}
            onChange={(e) => onPlanChange(e.target.value)}
            placeholder="Edit the structured image plan as JSON…"
            spellCheck={false}
          />
          {validationError && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{validationError}</p>
          )}
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => void onSave()}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 transition disabled:opacity-60"
              disabled={isSaving}
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={onCancel} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-xs rounded-md">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default IllustrationPromptEditor;
