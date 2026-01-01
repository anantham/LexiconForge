import React, { useCallback, useEffect, useState } from 'react';
import appConfig from '../../config/app.json';
import {
  KNOWN_DEBUG_PIPELINES,
  type DebugPipeline,
  getDebugPipelines as readDebugPipelines,
  setDebugPipelines as writeDebugPipelines,
  logCurrentDebugConfig,
} from '../../utils/debug';
import { ImageOps } from '../../services/db/operations';
import { ImageCacheStore } from '../../services/imageCacheService';
import { useSettingsModalContext } from './SettingsModalContext';
import { useAdvancedPanelStore } from '../../hooks/useAdvancedPanelStore';
import type { AppSettings } from '../../types';

type DebugLevel = 'off' | 'summary' | 'full';

type DiskDiagnostics = {
  disk: {
    totalChapters: number;
    totalTranslations: number;
    totalImages: number;
    imagesInCache: number;
    imagesLegacy: number;
  };
  quota: {
    usedMB: number;
    quotaMB: number;
    percentUsed: number;
  } | null;
};

const pipelineOptions: Array<{
  id: DebugPipeline;
  label: string;
  description: string;
}> = [
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

const sortPipelineSelections = (values: DebugPipeline[]): DebugPipeline[] =>
  KNOWN_DEBUG_PIPELINES.filter((pipeline) => values.includes(pipeline));

const getInitialPipelineSelection = (): DebugPipeline[] => {
  const stored = readDebugPipelines();
  if (stored.length === 0) {
    return [...KNOWN_DEBUG_PIPELINES];
  }
  return sortPipelineSelections(stored);
};

const applyAspectAndSize = (
  ratio: string,
  preset: string,
  currentSettings: AppSettings,
  handleSettingChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
) => {
  if (preset === 'CUSTOM') return;
  const long = preset === '2K' ? 2048 : preset === '1K' ? 1024 : 768;
  const parts = ratio.split(':').map((n) => parseInt(n, 10));
  let w = (currentSettings as any).imageWidth || 1024;
  let h = (currentSettings as any).imageHeight || 1024;
  if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
    const rw = parts[0];
    const rh = parts[1];
    if (rw >= rh) {
      w = long;
      h = Math.round((long * rh) / rw);
    } else {
      h = long;
      w = Math.round((long * rw) / rh);
    }
  } else {
    w = long;
    h = long;
  }
  handleSettingChange('imageWidth' as any, w);
  handleSettingChange('imageHeight' as any, h);
};

const AdvancedPanel: React.FC = () => {
  const { currentSettings, handleSettingChange, parameterSupport } = useSettingsModalContext();
  const { getMemoryDiagnostics } = useAdvancedPanelStore();
  const [showDev, setShowDev] = useState(false);
  const [diagnosticsExpanded, setDiagnosticsExpanded] = useState(false);
  const [diskDiagnostics, setDiskDiagnostics] = useState<DiskDiagnostics | null>(null);
  const [loadingDiskStats, setLoadingDiskStats] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  const [apiDebugLevel, setApiDebugLevel] = useState<DebugLevel>(() => {
    try {
      const lvl = localStorage.getItem('LF_AI_DEBUG_LEVEL') as DebugLevel | null;
      if (lvl === 'off' || lvl === 'summary' || lvl === 'full') return lvl;
      const full = localStorage.getItem('LF_AI_DEBUG_FULL') === '1';
      const summary = localStorage.getItem('LF_AI_DEBUG') === '1';
      if (full) return 'full';
      if (summary) return 'summary';
      return 'full';
    } catch {
      return 'full';
    }
  });

  const [debugPipelineSelections, setDebugPipelineSelections] = useState<DebugPipeline[]>(
    getInitialPipelineSelection
  );

  const ramStats = getMemoryDiagnostics ? getMemoryDiagnostics() : null;

  const persistDebugLevel = useCallback(
    (level: DebugLevel) => {
      setApiDebugLevel(level);
      try {
        localStorage.setItem('LF_AI_DEBUG_LEVEL', level);
        if (level === 'off') {
          localStorage.removeItem('LF_AI_DEBUG');
          localStorage.removeItem('LF_AI_DEBUG_FULL');
        } else if (level === 'summary') {
          localStorage.setItem('LF_AI_DEBUG', '1');
          localStorage.removeItem('LF_AI_DEBUG_FULL');
        } else {
          localStorage.setItem('LF_AI_DEBUG', '1');
          localStorage.setItem('LF_AI_DEBUG_FULL', '1');
        }
      } catch {
        // no-op
      }
    },
    []
  );

  useEffect(() => {
    const stored = readDebugPipelines();
    if (stored.length === 0) {
      setDebugPipelineSelections([...KNOWN_DEBUG_PIPELINES]);
    } else {
      setDebugPipelineSelections(sortPipelineSelections(stored));
    }
  }, []);

  useEffect(() => {
    if (!diagnosticsExpanded) return;
    let cancelled = false;
    const loadDiagnostics = async () => {
      setLoadingDiskStats(true);
      try {
        const stats = await ImageOps.getStorageDiagnostics();
        if (!cancelled) {
          setDiskDiagnostics(stats);
        }
      } catch (error) {
        console.error('Failed to load disk diagnostics:', error);
        if (!cancelled) {
          setDiskDiagnostics(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingDiskStats(false);
        }
      }
    };
    loadDiagnostics();
    return () => {
      cancelled = true;
    };
  }, [diagnosticsExpanded]);

  const togglePipeline = (pipeline: DebugPipeline, checked: boolean) => {
    setDebugPipelineSelections((prev) => {
      const nextSet = new Set(prev);
      if (checked) nextSet.add(pipeline);
      else nextSet.delete(pipeline);
      const next = sortPipelineSelections(Array.from(nextSet) as DebugPipeline[]);
      writeDebugPipelines(next);
      logCurrentDebugConfig();
      return next;
    });
  };

  const handleResetPipelines = () => {
    const next = [...KNOWN_DEBUG_PIPELINES];
    setDebugPipelineSelections(next);
    writeDebugPipelines(next);
    logCurrentDebugConfig();
  };

  const handleClearPipelines = () => {
    setDebugPipelineSelections([]);
    writeDebugPipelines([]);
    logCurrentDebugConfig();
  };

  const handleClearImageCache = async () => {
    const imageCount = diskDiagnostics?.disk.imagesInCache ?? 0;
    const confirmed = window.confirm(
      `⚠️ Clear Image Cache?\n\n` +
      `This will permanently delete ${imageCount} cached image${imageCount !== 1 ? 's' : ''}.\n\n` +
      `Make sure you've exported your session with images included before clearing.\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) return;

    setClearingCache(true);
    try {
      await ImageCacheStore.clear();
      // Refresh disk diagnostics after clearing
      const stats = await ImageOps.getStorageDiagnostics();
      setDiskDiagnostics(stats);
      alert('✓ Image cache cleared successfully.');
    } catch (error) {
      console.error('Failed to clear image cache:', error);
      alert('Failed to clear image cache. See console for details.');
    } finally {
      setClearingCache(false);
    }
  };

  return (
    <fieldset>
      <legend className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
        Advanced
      </legend>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">
            Diagnostics logging level
          </label>
          <select
            value={apiDebugLevel}
            onChange={(e) => persistDebugLevel(e.target.value as DebugLevel)}
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
            onClick={() => setShowDev((prev) => !prev)}
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
                      onChange={(e) => togglePipeline(option.id, e.target.checked)}
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
                onClick={handleResetPipelines}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                disabled={apiDebugLevel === 'off'}
              >
                Select all
              </button>
              <button
                type="button"
                onClick={handleClearPipelines}
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

        <fieldset>
          <legend className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3 border-b border-gray-200 dark:border-gray-700 pb-1">
            Image Generation
          </legend>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="imageWidth" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Image Width (px)
              </label>
              <input
                id="imageWidth"
                type="number"
                min={256}
                max={2048}
                step={64}
                value={(currentSettings as any).imageWidth || 1024}
                onChange={(e) =>
                  handleSettingChange(
                    'imageWidth' as any,
                    Math.max(256, Math.min(2048, parseInt(e.target.value || '1024', 10)))
                  )
                }
                className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="imageHeight" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Image Height (px)
              </label>
              <input
                id="imageHeight"
                type="number"
                min={256}
                max={2048}
                step={64}
                value={(currentSettings as any).imageHeight || 1024}
                onChange={(e) =>
                  handleSettingChange(
                    'imageHeight' as any,
                    Math.max(256, Math.min(2048, parseInt(e.target.value || '1024', 10)))
                  )
                }
                className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Aspect Ratio</label>
              <select
                value={(currentSettings as any).imageAspectRatio || '1:1'}
                onChange={(e) => handleSettingChange('imageAspectRatio' as any, e.target.value)}
                className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white"
              >
                <option value="1:1">1:1 (Square)</option>
                <option value="3:4">3:4 (Portrait)</option>
                <option value="4:3">4:3 (Landscape)</option>
                <option value="16:9">16:9 (Widescreen)</option>
                <option value="9:16">9:16 (Vertical video)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Size Preset</label>
              <div className="flex items-center gap-2">
                <select
                  value={(currentSettings as any).imageSizePreset || '1K'}
                  onChange={(e) => handleSettingChange('imageSizePreset' as any, e.target.value)}
                  className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white"
                >
                  <option value="512">512px (legacy)</option>
                  <option value="768">768px (legacy HD)</option>
                  <option value="1K">1K (Default)</option>
                  <option value="2K">2K (High detail)</option>
                  <option value="CUSTOM">Custom</option>
                </select>
                <button
                  type="button"
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  onClick={() =>
                    applyAspectAndSize(
                      ((currentSettings as any).imageAspectRatio as string) || '1:1',
                      (currentSettings as any).imageSizePreset || '1K',
                      currentSettings,
                      handleSettingChange
                    )
                  }
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3 border-b border-gray-200 dark:border-gray-700 pb-1">
            Advanced translation parameters
          </legend>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                  Temperature:{' '}
                  <span className="font-bold text-blue-500 mx-1">
                    {currentSettings.temperature ?? appConfig.aiParameters.defaults.temperature}
                  </span>
                  {(() => {
                    const key = `${currentSettings.provider}:${currentSettings.model}`;
                    const support = parameterSupport[key]?.temperature;
                    if (support === true) return <span className="text-green-500 text-xs" title="Supported by this model">✓</span>;
                    if (support === false) return <span className="text-red-500 text-xs" title="Not supported by this model">✗</span>;
                    return <span className="text-gray-400 text-xs" title="Checking support...">?</span>;
                  })()}
                </label>
                <input
                  type="range"
                  min={appConfig.aiParameters.limits.temperature.min}
                  max={appConfig.aiParameters.limits.temperature.max}
                  step="0.1"
                  value={currentSettings.temperature ?? appConfig.aiParameters.defaults.temperature}
                  onChange={(e) => handleSettingChange('temperature', parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {appConfig.aiParameters.descriptions.temperature}
                </p>
              </div>
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                  Top P:{' '}
                  <span className="font-bold text-blue-500 mx-1">
                    {currentSettings.topP ?? appConfig.aiParameters.defaults.top_p}
                  </span>
                  {(() => {
                    const key = `${currentSettings.provider}:${currentSettings.model}`;
                    const support = parameterSupport[key]?.topP;
                    if (support === true) return <span className="text-green-500 text-xs" title="Supported by this model">✓</span>;
                    if (support === false) return <span className="text-red-500 text-xs" title="Not supported by this model">✗</span>;
                    return <span className="text-gray-400 text-xs" title="Checking support...">?</span>;
                  })()}
                </label>
                <input
                  type="range"
                  min={appConfig.aiParameters.limits.top_p.min}
                  max={appConfig.aiParameters.limits.top_p.max}
                  step="0.05"
                  value={currentSettings.topP ?? appConfig.aiParameters.defaults.top_p}
                  onChange={(e) => handleSettingChange('topP', parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {appConfig.aiParameters.descriptions.top_p}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Seed
                  {(() => {
                    const key = `${currentSettings.provider}:${currentSettings.model}`;
                    const support = parameterSupport[key]?.seed;
                    if (support === true) return <span className="text-green-500 text-xs ml-1" title="Supported by this model">✓</span>;
                    if (support === false) return <span className="text-red-500 text-xs ml-1" title="Not supported by this model">✗</span>;
                    return <span className="text-gray-400 text-xs ml-1" title="Checking support...">?</span>;
                  })()}
                </label>
                <input
                  id="seed"
                  type="number"
                  min={appConfig.aiParameters.limits.seed.min}
                  max={appConfig.aiParameters.limits.seed.max}
                  value={currentSettings.seed ?? ''}
                  onChange={(e) => handleSettingChange('seed', e.target.value ? parseInt(e.target.value, 10) : null)}
                  placeholder="Random generation"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {appConfig.aiParameters.descriptions.seed}
                </p>
              </div>
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                  Frequency Penalty:{' '}
                  <span className="font-bold text-blue-500 mx-1">
                    {currentSettings.frequencyPenalty ?? appConfig.aiParameters.defaults.frequency_penalty}
                  </span>
                  {(() => {
                    const key = `${currentSettings.provider}:${currentSettings.model}`;
                    const support = parameterSupport[key]?.frequencyPenalty;
                    if (support === true) return <span className="text-green-500 text-xs" title="Supported by this model">✓</span>;
                    if (support === false) return <span className="text-red-500 text-xs" title="Not supported by this model">✗</span>;
                    return <span className="text-gray-400 text-xs" title="Checking support...">?</span>;
                  })()}
                </label>
                <input
                  id="frequencyPenalty"
                  type="range"
                  min={appConfig.aiParameters.limits.frequency_penalty.min}
                  max={appConfig.aiParameters.limits.frequency_penalty.max}
                  step="0.1"
                  value={currentSettings.frequencyPenalty ?? appConfig.aiParameters.defaults.frequency_penalty}
                  onChange={(e) => handleSettingChange('frequencyPenalty', parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {appConfig.aiParameters.descriptions.frequency_penalty}
                </p>
              </div>
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                  Presence Penalty:{' '}
                  <span className="font-bold text-blue-500 mx-1">
                    {currentSettings.presencePenalty ?? appConfig.aiParameters.defaults.presence_penalty}
                  </span>
                  {(() => {
                    const key = `${currentSettings.provider}:${currentSettings.model}`;
                    const support = parameterSupport[key]?.presencePenalty;
                    if (support === true) return <span className="text-green-500 text-xs" title="Supported by this model">✓</span>;
                    if (support === false) return <span className="text-red-500 text-xs" title="Not supported by this model">✗</span>;
                    return <span className="text-gray-400 text-xs" title="Checking support...">?</span>;
                  })()}
                </label>
                <input
                  id="presencePenalty"
                  type="range"
                  min={appConfig.aiParameters.limits.presence_penalty.min}
                  max={appConfig.aiParameters.limits.presence_penalty.max}
                  step="0.1"
                  value={currentSettings.presencePenalty ?? appConfig.aiParameters.defaults.presence_penalty}
                  onChange={(e) => handleSettingChange('presencePenalty', parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {appConfig.aiParameters.descriptions.presence_penalty}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(currentSettings as any).enableAmendments ?? false}
                  onChange={(e) => handleSettingChange('enableAmendments' as any, e.target.checked)}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <div>
                  <span className="block font-medium text-gray-800 dark:text-gray-100">Enable Prompt Amendment Proposals</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Allow the AI to suggest changes to the translation prompt based on feedback patterns. When disabled, no amendment
                    protocol is sent to the AI, and any proposals are automatically rejected. Disabling this saves ~500 tokens per translation.
                  </span>
                </div>
              </label>
            </div>

            <div className="mt-4">
              <label className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(currentSettings as any).includeFanTranslationInPrompt ?? true}
                  onChange={(e) => handleSettingChange('includeFanTranslationInPrompt' as any, e.target.checked)}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <div>
                  <span className="block font-medium text-gray-800 dark:text-gray-100">Include Fan Translation as Reference</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Include fan translation as ground truth reference in API calls when available. Disabling this allows you to test translation
                    quality with only raw text and previous chapters as context. When disabled, the fan translation will be excluded from prompts
                    but still available for comparison.
                  </span>
                </div>
              </label>
            </div>
          </div>
        </fieldset>

        <fieldset className="border border-gray-300 dark:border-gray-600 rounded-md p-4">
          <legend className="text-lg font-semibold px-2 text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDiagnosticsExpanded((prev) => !prev)}
              className="flex items-center gap-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              aria-label={diagnosticsExpanded ? 'Collapse diagnostics' : 'Expand diagnostics'}
            >
              <svg
                className={`w-5 h-5 transition-transform ${diagnosticsExpanded ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Memory & Storage Diagnostics
            </button>
          </legend>
          {diagnosticsExpanded && (
            <div className="space-y-6 mt-4">
              {ramStats ? (
                <>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                      RAM (Current Session)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                        <div className="text-xs text-blue-600 dark:text-blue-400 uppercase font-medium">Chapters Loaded</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{ramStats.totalChapters}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                          {ramStats.chaptersWithTranslations} translated • {ramStats.chaptersWithImages} with images
                        </div>
                      </div>
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                        <div className="text-xs text-blue-600 dark:text-blue-400 uppercase font-medium">RAM Usage</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {ramStats.estimatedRAM.totalMB.toFixed(2)} MB
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                          Content: {(ramStats.estimatedRAM.chapterContentBytes / 1024 / 1024).toFixed(2)} MB
                          {ramStats.estimatedRAM.base64ImageBytes > 0 && (
                            <> • Legacy Images: {(ramStats.estimatedRAM.base64ImageBytes / 1024 / 1024).toFixed(2)} MB</>
                          )}
                        </div>
                      </div>
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                        <div className="text-xs text-blue-600 dark:text-blue-400 uppercase font-medium">Images (RAM)</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {ramStats.imagesInCache + ramStats.imagesInRAM}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                          {ramStats.imagesInCache} cached • {ramStats.imagesInRAM} legacy
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded text-center">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Memory diagnostics unavailable.</div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                  Disk (IndexedDB Storage)
                </h4>
                {loadingDiskStats ? (
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded text-center">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Loading disk statistics...</div>
                  </div>
                ) : diskDiagnostics ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                        <div className="text-xs text-green-600 dark:text-green-400 uppercase font-medium">Total Chapters</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {diskDiagnostics.disk.totalChapters}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                          {diskDiagnostics.disk.totalTranslations} translation
                          {diskDiagnostics.disk.totalTranslations !== 1 ? 's' : ''} stored
                        </div>
                      </div>
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                        <div className="text-xs text-green-600 dark:text-green-400 uppercase font-medium">Total Images</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {diskDiagnostics.disk.totalImages}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                          {diskDiagnostics.disk.imagesInCache} in cache • {diskDiagnostics.disk.imagesLegacy} legacy
                        </div>
                      </div>
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                        <div className="text-xs text-green-600 dark:text-green-400 uppercase font-medium">Quota Usage</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {diskDiagnostics.quota ? `${diskDiagnostics.quota.usedMB} MB` : 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                          {diskDiagnostics.quota
                            ? `${diskDiagnostics.quota.percentUsed}% of ${diskDiagnostics.quota.quotaMB} MB`
                            : 'Quota information unavailable'}
                        </div>
                      </div>
                    </div>
                    {diskDiagnostics.disk.imagesInCache > 0 && (
                      <div className="mt-4 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleClearImageCache}
                          disabled={clearingCache}
                          className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                          {clearingCache ? 'Clearing...' : `Clear Image Cache (${diskDiagnostics.disk.imagesInCache} images)`}
                        </button>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Export with images first to preserve them
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded text-center">
                    <div className="text-sm text-gray-500 dark:text-gray-400">No disk diagnostics available.</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </fieldset>

        {ramStats?.warnings?.length ? (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3">
            <div className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Warnings</div>
            <ul className="space-y-1">
              {ramStats.warnings.map((warning: string, idx: number) => (
                <li key={idx} className="text-xs text-yellow-700 dark:text-yellow-300">
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <p>
            <strong>Understanding the Stats:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>RAM:</strong> Shows only chapters currently loaded in this browser tab
            </li>
            <li>
              <strong>Disk:</strong> Shows all chapters/images stored in IndexedDB (shared across tabs)
            </li>
            <li>For optimal performance, keep loaded chapters under 50</li>
            <li>Legacy base64 images use significantly more RAM than cache-stored images</li>
            <li>Run migration scripts to move existing images to cache storage</li>
            <li>Clear session data to free up memory if experiencing performance issues</li>
          </ul>
        </div>
      </div>
    </fieldset>
  );
};

export default AdvancedPanel;
