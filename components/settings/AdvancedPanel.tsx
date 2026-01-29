/**
 * AdvancedPanel - Advanced settings orchestrator
 *
 * Manages state and effects for diagnostic, image generation,
 * translation parameters, and storage diagnostics sections.
 */

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

import DiagnosticsLoggingSection from './DiagnosticsLoggingSection';
import ImageGenerationSection from './ImageGenerationSection';
import TranslationParametersSection from './TranslationParametersSection';
import StorageDiagnosticsSection from './StorageDiagnosticsSection';

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

  const persistDebugLevel = useCallback((level: DebugLevel) => {
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
  }, []);

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

  // Get parameter support for current model
  const modelKey = `${currentSettings.provider}:${currentSettings.model}`;
  const currentParameterSupport = parameterSupport[modelKey];

  return (
    <fieldset>
      <legend className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
        Advanced
      </legend>
      <div className="space-y-4">
        <DiagnosticsLoggingSection
          apiDebugLevel={apiDebugLevel}
          onDebugLevelChange={persistDebugLevel}
          showDev={showDev}
          onShowDevToggle={() => setShowDev((prev) => !prev)}
          debugPipelineSelections={debugPipelineSelections}
          onTogglePipeline={togglePipeline}
          onResetPipelines={handleResetPipelines}
          onClearPipelines={handleClearPipelines}
        />

        <ImageGenerationSection
          imageWidth={(currentSettings as any).imageWidth || 1024}
          imageHeight={(currentSettings as any).imageHeight || 1024}
          imageAspectRatio={(currentSettings as any).imageAspectRatio || '1:1'}
          imageSizePreset={(currentSettings as any).imageSizePreset || '1K'}
          onImageWidthChange={(value) => handleSettingChange('imageWidth' as any, value)}
          onImageHeightChange={(value) => handleSettingChange('imageHeight' as any, value)}
          onAspectRatioChange={(value) => handleSettingChange('imageAspectRatio' as any, value)}
          onSizePresetChange={(value) => handleSettingChange('imageSizePreset' as any, value)}
          onApplyPreset={() =>
            applyAspectAndSize(
              ((currentSettings as any).imageAspectRatio as string) || '1:1',
              (currentSettings as any).imageSizePreset || '1K',
              currentSettings,
              handleSettingChange
            )
          }
        />

        <TranslationParametersSection
          temperature={currentSettings.temperature ?? appConfig.aiParameters.defaults.temperature}
          topP={currentSettings.topP ?? appConfig.aiParameters.defaults.top_p}
          seed={currentSettings.seed ?? null}
          frequencyPenalty={currentSettings.frequencyPenalty ?? appConfig.aiParameters.defaults.frequency_penalty}
          presencePenalty={currentSettings.presencePenalty ?? appConfig.aiParameters.defaults.presence_penalty}
          enableAmendments={(currentSettings as any).enableAmendments ?? false}
          includeFanTranslationInPrompt={(currentSettings as any).includeFanTranslationInPrompt ?? true}
          parameterSupport={currentParameterSupport}
          onTemperatureChange={(value) => handleSettingChange('temperature', value)}
          onTopPChange={(value) => handleSettingChange('topP', value)}
          onSeedChange={(value) => handleSettingChange('seed', value)}
          onFrequencyPenaltyChange={(value) => handleSettingChange('frequencyPenalty', value)}
          onPresencePenaltyChange={(value) => handleSettingChange('presencePenalty', value)}
          onEnableAmendmentsChange={(value) => handleSettingChange('enableAmendments' as any, value)}
          onIncludeFanTranslationChange={(value) => handleSettingChange('includeFanTranslationInPrompt' as any, value)}
        />

        <StorageDiagnosticsSection
          expanded={diagnosticsExpanded}
          onToggleExpanded={() => setDiagnosticsExpanded((prev) => !prev)}
          ramStats={ramStats}
          diskDiagnostics={diskDiagnostics}
          loadingDiskStats={loadingDiskStats}
          clearingCache={clearingCache}
          onClearImageCache={handleClearImageCache}
        />
      </div>
    </fieldset>
  );
};

export default AdvancedPanel;
