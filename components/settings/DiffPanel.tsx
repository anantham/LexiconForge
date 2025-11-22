import React, { useCallback, useMemo, useState } from 'react';
import type { DiffMarkerVisibilitySettings } from '../../types';
import { COLOR_EXAMPLES, getDefaultDiffPrompt } from '../../services/diff/promptUtils';
import { DiffOps } from '../../services/db/operations';
import { useSettingsModalContext } from './SettingsModalContext';
import { useAppStore } from '../../store';
import { useShallow } from 'zustand/react/shallow';

const DEFAULT_DIFF_MARKER_VISIBILITY: DiffMarkerVisibilitySettings = {
  fan: true,
  rawLoss: true,
  rawGain: true,
  sensitivity: true,
  stylistic: true,
};

export const DiffPanel: React.FC = () => {
  const { currentSettings, handleSettingChange } = useSettingsModalContext();
  const { currentChapterId, chapters, showNotification } = useAppStore(
    useShallow((state) => ({
      currentChapterId: state.currentChapterId,
      chapters: state.chapters,
      showNotification: state.showNotification,
    }))
  );
  const [diffInvalidatePending, setDiffInvalidatePending] = useState(false);
  const defaultDiffPrompt = useMemo(() => getDefaultDiffPrompt(), []);

  const markerVisibility: DiffMarkerVisibilitySettings = useMemo(() => {
    const incoming = currentSettings.diffMarkerVisibility ?? {};
    const normalized: DiffMarkerVisibilitySettings = {
      ...DEFAULT_DIFF_MARKER_VISIBILITY,
      ...(incoming as Record<string, boolean>),
    };
    if (Object.prototype.hasOwnProperty.call(incoming, 'raw')) {
      const legacyRaw = (incoming as Record<string, boolean>).raw;
      if (typeof legacyRaw === 'boolean') {
        normalized.rawLoss = legacyRaw;
        normalized.rawGain = legacyRaw;
      }
    }
    return normalized;
  }, [currentSettings.diffMarkerVisibility]);

  const heatmapEnabled = currentSettings.showDiffHeatmap !== false;

  const handleMarkerVisibilityToggle = (
    markerType: keyof DiffMarkerVisibilitySettings,
    checked: boolean
  ) => {
    const currentVisibility: DiffMarkerVisibilitySettings = {
      ...DEFAULT_DIFF_MARKER_VISIBILITY,
      ...(currentSettings.diffMarkerVisibility ?? {}),
    };
    const nextVisibility: DiffMarkerVisibilitySettings = {
      ...currentVisibility,
      [markerType]: checked,
    };
    handleSettingChange('diffMarkerVisibility' as any, nextVisibility as any);
  };

  const handleInvalidateDiffMarkers = useCallback(async () => {
    if (!currentChapterId) {
      showNotification?.('Open a chapter before refreshing diff markers.', 'info');
      return;
    }

    const chapter = chapters.get(currentChapterId);
    if (!chapter) {
      showNotification?.('Active chapter data is unavailable. Try reopening the chapter.', 'warning');
      return;
    }

    const translationResult: any = chapter.translationResult;
    const aiTranslation = translationResult?.translation ?? '';
    if (!aiTranslation.trim()) {
      showNotification?.('This chapter has no AI translation yet. Translate it first to run diff analysis.', 'warning');
      return;
    }

    const rawText = chapter.content ?? '';
    if (!rawText.trim()) {
      showNotification?.('Original chapter text is missing; cannot run diff analysis.', 'warning');
      return;
    }

    try {
      setDiffInvalidatePending(true);
      await DiffOps.deleteByChapter(currentChapterId);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('diff:updated', {
          detail: { chapterId: currentChapterId, invalidated: true }
        }));

        const snapshot = (chapter as any).translationSettingsSnapshot || {};
        const preferredProvider = snapshot.provider ?? currentSettings.provider;
        const preferredModel = snapshot.model ?? currentSettings.model;
        const preferredTemperature = snapshot.temperature ?? currentSettings.temperature;

        window.dispatchEvent(new CustomEvent('translation:complete', {
          detail: {
            chapterId: currentChapterId,
            aiTranslation,
            aiTranslationId: translationResult?.id ?? null,
            fanTranslation: (chapter as any)?.fanTranslation || null,
            fanTranslationId: null,
            rawText,
            previousVersionFeedback: undefined,
            preferredProvider,
            preferredModel,
            preferredTemperature,
          }
        }));
      }

      showNotification?.('Diff analysis refresh requested. Markers will update once the new analysis completes.', 'success');
    } catch (error) {
      console.error('[DiffPanel] Failed to invalidate diff markers', error);
      showNotification?.('Failed to refresh diff markers. Check console for details.', 'error');
    } finally {
      setDiffInvalidatePending(false);
    }
  }, [chapters, currentChapterId, currentSettings, showNotification]);

  return (
    <fieldset>
      <legend className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
        Reader Features
      </legend>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Diff Heatmap</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Configure semantic diff markers that appear beside each paragraph while you read. Toggle entire categories on or off and re-run
            the analysis when you need fresh markers.
          </p>
        </div>
        <div className="space-y-3">
          <label className="inline-flex items-center text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              className="mr-2"
              checked={heatmapEnabled}
              onChange={(e) => handleSettingChange('showDiffHeatmap' as any, e.target.checked)}
            />
            Show semantic diff heatmap
          </label>
          <div className="ml-6 space-y-2">
            {(
              [
                { key: 'fan', label: 'Fan translation divergence', color: 'text-blue-600 dark:text-blue-300', swatch: '(blue)' },
                { key: 'rawLoss', label: 'Missing vs. raw source', color: 'text-red-600 dark:text-red-400', swatch: '(red)' },
                { key: 'rawGain', label: 'Added beyond raw source', color: 'text-orange-500 dark:text-orange-300', swatch: '(orange)' },
                { key: 'sensitivity', label: 'Sensitivity markers', color: 'text-purple-600 dark:text-purple-300', swatch: '(purple)' },
                { key: 'stylistic', label: 'Stylistic diff markers', color: 'text-gray-500 dark:text-gray-300', swatch: '(gray)' },
              ] satisfies Array<{ key: keyof DiffMarkerVisibilitySettings; label: string; color: string; swatch: string }>
            ).map(({ key, label, color, swatch }) => {
              return (
                <label key={key} className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={markerVisibility[key] !== false}
                    disabled={!heatmapEnabled}
                    onChange={(e) => handleMarkerVisibilityToggle(key, e.target.checked)}
                  />
                  {label}
                  <span className={`ml-2 text-xs ${color}`}>{swatch}</span>
                </label>
              );
            })}
          </div>
          <div className="ml-6 pt-2 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleInvalidateDiffMarkers}
              disabled={diffInvalidatePending}
              className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                diffInvalidatePending
                  ? 'bg-gray-300 text-gray-600 dark:bg-gray-700 dark:text-gray-300 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400'
              }`}
            >
              {diffInvalidatePending ? 'Refreshing diff analysis…' : 'Invalidate & Re-run Diff'}
            </button>
            <button
              type="button"
              onClick={() => handleSettingChange('diffAnalysisPrompt' as any, defaultDiffPrompt)}
              className="px-3 py-2 rounded-md text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 transition"
            >
              Reset Prompt
            </button>
          </div>
          <div className="ml-6 mt-6 space-y-4">
            <details className="bg-gray-100 dark:bg-gray-800/70 p-3 rounded-md">
              <summary className="text-sm font-semibold text-gray-800 dark:text-gray-200 cursor-pointer">
                Color examples &amp; guidance
              </summary>
              <div className="mt-3 text-xs whitespace-pre-wrap font-mono text-gray-700 dark:text-gray-300">
                {COLOR_EXAMPLES}
              </div>
            </details>
            <div>
              <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                Diff analysis prompt
              </label>
              <textarea
                rows={14}
                value={currentSettings.diffAnalysisPrompt ?? defaultDiffPrompt}
                onChange={(e) => handleSettingChange('diffAnalysisPrompt' as any, e.target.value)}
                disabled={!heatmapEnabled}
                className={`w-full font-mono text-xs p-3 border rounded-lg bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 ${
                  heatmapEnabled
                    ? 'border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500'
                    : 'border-gray-200 dark:border-gray-700 opacity-60 cursor-not-allowed'
                }`}
              />
              {!heatmapEnabled && (
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  Enable the heatmap to edit the diff prompt.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </fieldset>
  );
};

export default DiffPanel;
