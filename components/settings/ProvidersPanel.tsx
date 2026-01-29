/**
 * ProvidersPanel - Orchestrator for translation provider settings
 *
 * This component has been decomposed into:
 * - TranslationEngineSection: provider/model/language controls
 * - ApiKeysSection: API key inputs with balance refresh
 *
 * This parent component handles state, effects, and data fetching.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AVAILABLE_MODELS, AVAILABLE_IMAGE_MODELS } from '../../config/constants';
import { MODELS, COSTS_PER_MILLION_TOKENS, IMAGE_COSTS } from '../../config/costs';
import type { TranslationProvider } from '../../types';
import { supportsStructuredOutputs, supportsParameters } from '../../services/capabilityService';
import { debugLog } from '../../utils/debug';
import { useSettingsModalContext } from './SettingsModalContext';
import { useProvidersPanelStore } from '../../hooks/useProvidersPanelStore';
import { getOpenRouterImageModels } from '../../services/openrouterService';
import { TranslationEngineSection } from './TranslationEngineSection';
import { ApiKeysSection } from './ApiKeysSection';

const formatCurrencyValue = (value?: number | null, currency = 'USD'): string | null => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const amount = value.toFixed(2);
  return currency.toUpperCase() === 'USD' ? `$${amount}` : `${currency.toUpperCase()} ${amount}`;
};

const formatUpdatedAt = (iso?: string): string | null => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString();
};

interface ProvidersPanelProps {
  isOpen: boolean;
}

const ProvidersPanel: React.FC<ProvidersPanelProps> = ({ isOpen }) => {
  const {
    currentSettings,
    handleSettingChange,
    parameterSupport,
    setParameterSupport,
  } = useSettingsModalContext();
  const {
    loadOpenRouterCatalogue,
    refreshOpenRouterCredits,
    getOpenRouterOptions,
    openRouterModels,
    openRouterKeyUsage,
    providerCredits,
    refreshProviderCredits,
    loadProviderCreditsFromCache,
  } = useProvidersPanelStore();

  const [orSearch, setOrSearch] = useState('');
  const [lastUsedMap, setLastUsedMap] = useState<Record<string, string>>({});
  const [structuredOutputSupport, setStructuredOutputSupport] = useState<Record<string, boolean | null>>({});
  const [dynamicImageModels, setDynamicImageModels] = useState<Array<{ id: string; name: string; pricePerImage: number | null }>>([]);

  // Check structured output support for a model
  const checkStructuredOutputSupport = useCallback(
    async (provider: string, modelId: string) => {
      const key = `${provider}:${modelId}`;
      if (structuredOutputSupport[key] !== undefined && structuredOutputSupport[key] !== null) {
        return;
      }

      try {
        const hasSupport = await supportsStructuredOutputs(provider, modelId);
        setStructuredOutputSupport((prev) => ({ ...prev, [key]: hasSupport }));
      } catch (error) {
        console.warn(`Failed to check structured output support for ${key}`, error);
        setStructuredOutputSupport((prev) => ({ ...prev, [key]: false }));
      }
    },
    [structuredOutputSupport]
  );

  // Check parameter support for a model
  const checkParameterSupport = useCallback(
    async (provider: string, modelId: string) => {
      const key = `${provider}:${modelId}`;
      if (parameterSupport[key]) return;

      try {
        const [temperature, topP, frequencyPenalty, presencePenalty, seed] = await Promise.all([
          supportsParameters(provider, modelId, ['temperature']),
          supportsParameters(provider, modelId, ['top_p']),
          supportsParameters(provider, modelId, ['frequency_penalty']),
          supportsParameters(provider, modelId, ['presence_penalty']),
          supportsParameters(provider, modelId, ['seed']),
        ]);
        setParameterSupport((prev) => ({
          ...prev,
          [key]: { temperature, topP, frequencyPenalty, presencePenalty, seed },
        }));
      } catch (error) {
        console.warn(`Failed to check parameter support for ${key}`, error);
        setParameterSupport((prev) => ({
          ...prev,
          [key]: { temperature: null, topP: null, frequencyPenalty: null, presencePenalty: null, seed: null },
        }));
      }
    },
    [parameterSupport, setParameterSupport]
  );

  // Load provider credits from cache when panel opens
  useEffect(() => {
    if (!isOpen) return;
    loadProviderCreditsFromCache();
  }, [isOpen, loadProviderCreditsFromCache]);

  // Fetch OpenRouter image models dynamically for pricing
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const models = await getOpenRouterImageModels();
        if (models.length > 0) {
          setDynamicImageModels(models);
        }
      } catch (error) {
        console.error('[ProvidersPanel] Failed to load OpenRouter image models:', error);
      }
    })();
  }, [isOpen]);

  // Load OpenRouter catalogue and credits when provider is OpenRouter
  useEffect(() => {
    if (!isOpen || currentSettings.provider !== 'OpenRouter') return;
    loadOpenRouterCatalogue(false);
    refreshOpenRouterCredits();
    (async () => {
      try {
        const { openrouterService } = await import('../../services/openrouterService');
        const map = await openrouterService.getLastUsedMap();
        setLastUsedMap(map);
      } catch (error) {
        console.warn('[ProvidersPanel] Failed to load OpenRouter recents', error);
      }
    })();
  }, [isOpen, currentSettings.provider, loadOpenRouterCatalogue, refreshOpenRouterCredits]);

  // Check capabilities for current model
  useEffect(() => {
    if (!isOpen) return;
    checkStructuredOutputSupport(currentSettings.provider, currentSettings.model);
    checkParameterSupport(currentSettings.provider, currentSettings.model);
  }, [isOpen, currentSettings.provider, currentSettings.model, checkStructuredOutputSupport, checkParameterSupport]);

  // Check structured output support for all models of non-OpenRouter providers
  useEffect(() => {
    if (!isOpen) return;
    if (currentSettings.provider === 'OpenRouter') return;
    const models = AVAILABLE_MODELS[currentSettings.provider] || [];
    let cancelled = false;

    (async () => {
      for (const model of models) {
        if (cancelled) break;
        await checkStructuredOutputSupport(currentSettings.provider, model.id);
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen, currentSettings.provider, checkStructuredOutputSupport]);

  // Check structured output support for OpenRouter current model
  useEffect(() => {
    if (!isOpen || currentSettings.provider !== 'OpenRouter') return;
    const key = `OpenRouter:${currentSettings.model}`;
    debugLog('api', 'full', `[Capability Check] Checking model: ${key}`);

    if (structuredOutputSupport[key] !== undefined && structuredOutputSupport[key] !== null) {
      return;
    }

    (async () => {
      try {
        const hasSupport = await supportsStructuredOutputs('OpenRouter', currentSettings.model);
        setStructuredOutputSupport((prev) => ({ ...prev, [key]: hasSupport }));
      } catch (error) {
        console.warn(`Failed to check structured output support for ${key}`, error);
        setStructuredOutputSupport((prev) => ({ ...prev, [key]: false }));
      }
    })();
  }, [isOpen, currentSettings.provider, currentSettings.model, structuredOutputSupport]);

  // Credit line formatting
  const openRouterCreditLine = useMemo(() => {
    if (!openRouterKeyUsage) return 'Credits remaining: —';

    const remaining = openRouterKeyUsage.remainingCredits ?? openRouterKeyUsage.remaining ?? null;
    const total = openRouterKeyUsage.totalCredits ?? openRouterKeyUsage.limit ?? null;
    const fetchedAt = formatUpdatedAt(openRouterKeyUsage.fetchedAt);

    if (remaining == null && total == null) {
      return fetchedAt ? `Credits remaining: ∞ (updated ${fetchedAt})` : 'Credits remaining: ∞';
    }

    const parts: string[] = [];
    const primary = formatCurrencyValue(remaining);
    if (primary) {
      const withTotal = total != null ? formatCurrencyValue(total) : null;
      parts.push(`Credits remaining: ${primary}${withTotal ? ` of ${withTotal}` : ''}`);
    } else if (total != null) {
      parts.push(`Credits remaining: ${formatCurrencyValue(total) ?? '—'} total`);
    } else {
      parts.push('Credits remaining: —');
    }

    if (fetchedAt) parts.push(`(updated ${fetchedAt})`);
    return parts.join(' ');
  }, [openRouterKeyUsage]);

  const deepSeekCreditLine = useMemo(() => {
    const entry = providerCredits?.DeepSeek ?? null;
    if (!entry) return 'Balance: —';

    const balance = formatCurrencyValue(entry.remaining ?? entry.total, entry.currency) ?? '—';
    const extras: string[] = [];
    const granted = formatCurrencyValue(entry.granted, entry.currency);
    const topped = formatCurrencyValue(entry.toppedUp, entry.currency);
    if (granted) extras.push(`granted ${granted}`);
    if (topped) extras.push(`topped-up ${topped}`);

    let summary = `Balance: ${balance}`;
    if (extras.length) summary += ` (${extras.join(', ')})`;
    if (entry.note) summary += ` (${entry.note})`;

    const fetchedAt = formatUpdatedAt(entry.fetchedAt);
    if (fetchedAt) summary += ` (updated ${fetchedAt})`;
    return summary;
  }, [providerCredits]);

  const piApiCreditLine = useMemo(() => {
    const entry = providerCredits?.PiAPI ?? null;
    if (!entry) return 'Balance: —';

    const balance = formatCurrencyValue(entry.remaining ?? entry.total, entry.currency) ?? '—';
    let summary = `Balance (USD): ${balance}`;
    if (entry.note) summary += ` (${entry.note})`;
    const fetchedAt = formatUpdatedAt(entry.fetchedAt);
    if (fetchedAt) summary += ` (updated ${fetchedAt})`;

    const metadata = entry.metadata || {};
    const details: string[] = [];
    if (typeof metadata?.account_name === 'string') details.push(`Account: ${metadata.account_name}`);
    if (typeof metadata?.account_id === 'string') details.push(`ID: ${metadata.account_id}`);
    if (details.length) summary += ` — ${details.join(' • ')}`;
    return summary;
  }, [providerCredits]);

  // Model lists with pricing
  const pricedTextModels = useMemo(() => {
    if (currentSettings.provider === 'OpenRouter') {
      const options = getOpenRouterOptions(orSearch);
      const withLU = options.map((o) => ({ ...o, lastUsed: lastUsedMap[o.id] }));
      const recents = withLU
        .filter((o) => !!o.lastUsed)
        .sort((a, b) => new Date(b.lastUsed!).getTime() - new Date(a.lastUsed!).getTime())
        .slice(0, 10);
      const recentIds = new Set(recents.map((r) => r.id));
      const rest = withLU
        .filter((o) => !recentIds.has(o.id))
        .sort((a, b) => {
          const ak = a.priceKey == null ? Number.POSITIVE_INFINITY : a.priceKey;
          const bk = b.priceKey == null ? Number.POSITIVE_INFINITY : b.priceKey;
          return ak - bk || a.id.localeCompare(b.id);
        });
      const result = recents.concat(rest).map((m) => ({
        id: m.id,
        name: m.label,
        label: m.label,
        sortKey: m.priceKey ?? Number.POSITIVE_INFINITY,
      }));

      // Always include currently selected model at top if not in filtered results
      const currentModelInResults = result.some(m => m.id === currentSettings.model);
      if (!currentModelInResults && currentSettings.model) {
        const allModels = getOpenRouterOptions('');
        const currentModelData = allModels.find(m => m.id === currentSettings.model);
        if (currentModelData) {
          result.unshift({
            id: currentModelData.id,
            name: `★ ${currentModelData.label} (current)`,
            label: `★ ${currentModelData.label} (current)`,
            sortKey: -1,
          });
        }
      }

      return result;
    }

    return (MODELS.filter((m) => m.provider === currentSettings.provider) || [])
      .map((m) => {
        const costs = COSTS_PER_MILLION_TOKENS[m.id];
        const input = costs?.input;
        const output = costs?.output;
        const label =
          input != null && output != null
            ? `${m.name} — USD ${input.toFixed(2)}/${output.toFixed(2)} per 1M`
            : m.name;
        const sortKey = input != null && output != null ? input + output : Number.POSITIVE_INFINITY;
        return { ...m, label, sortKey };
      })
      .sort((a, b) => a.sortKey - b.sortKey);
  }, [currentSettings.provider, currentSettings.model, getOpenRouterOptions, lastUsedMap, orSearch]);

  // Auto-correct stale model selection
  const selectedModelInList = pricedTextModels.some(m => m.id === currentSettings.model);
  useEffect(() => {
    if (!selectedModelInList && pricedTextModels.length > 0 && !orSearch) {
      console.warn('[ProvidersPanel] Selected model not in list, auto-correcting');
      handleSettingChange('model', pricedTextModels[0].id);
    }
  }, [selectedModelInList, pricedTextModels, currentSettings.model, orSearch, handleSettingChange]);

  // Image models with pricing
  const pricedImageModels = useMemo(() => {
    const rawImageModels = AVAILABLE_IMAGE_MODELS['Gemini'] || [];
    const staticIds = new Set(rawImageModels.map(m => m.id));

    const getProvider = (id: string): string => {
      if (id.startsWith('openrouter/google/')) return 'OpenRouter/Google';
      if (id.startsWith('openrouter/openai/')) return 'OpenRouter/OpenAI';
      if (id.startsWith('openrouter/black-forest-labs/')) return 'OpenRouter/Flux';
      if (id.startsWith('openrouter/bytedance-seed/')) return 'OpenRouter/ByteDance';
      if (id.startsWith('openrouter/sourceful/')) return 'OpenRouter/Sourceful';
      if (id.startsWith('openrouter/')) return 'OpenRouter/Other';
      if (id.startsWith('Qubico/')) return 'PiAPI';
      if (id.startsWith('gemini') || id.startsWith('imagen')) return 'Google';
      return 'Other';
    };

    const staticModels = rawImageModels.map((m) => {
      const price = IMAGE_COSTS[m.id];
      const label = price != null ? `${m.name} — $${price.toFixed(3)}/image` : m.name;
      const sortKey = price != null ? price : Number.POSITIVE_INFINITY;
      const provider = getProvider(m.id);
      return { ...m, label, sortKey, provider, source: 'static' as const };
    });

    const dynamicModels = dynamicImageModels
      .filter(m => !staticIds.has(`openrouter/${m.id}`))
      .map(m => {
        const fullId = `openrouter/${m.id}`;
        const priceLabel = m.pricePerImage != null
          ? `$${m.pricePerImage.toFixed(4)}/image`
          : 'price unknown';
        return {
          id: fullId,
          name: `${m.name} (OpenRouter)`,
          description: `Dynamic pricing: ${priceLabel}`,
          label: `${m.name} — ${priceLabel}`,
          sortKey: m.pricePerImage ?? Number.POSITIVE_INFINITY,
          provider: getProvider(fullId),
          source: 'dynamic' as const,
        };
      });

    return [...staticModels, ...dynamicModels].sort((a, b) => {
      const providerCompare = a.provider.localeCompare(b.provider);
      if (providerCompare !== 0) return providerCompare;
      return a.sortKey - b.sortKey;
    });
  }, [dynamicImageModels]);

  // Structured output indicator
  const structuredOutputIndicator = useMemo(() => {
    const key = `${currentSettings.provider}:${currentSettings.model}`;
    const support = structuredOutputSupport[key];
    if (support === true) {
      return (
        <div className="mt-2 flex items-center text-xs text-green-600 dark:text-green-400">
          <span className="mr-1">✅</span>
          This model supports structured outputs for better schema compliance
        </div>
      );
    }
    if (support === false) {
      return (
        <div className="mt-2 flex items-center text-xs text-gray-500 dark:text-gray-400">
          <span className="mr-1">ℹ️</span>
          This model uses JSON object format with fallback handling
        </div>
      );
    }
    return null;
  }, [currentSettings.provider, currentSettings.model, structuredOutputSupport]);

  // Handlers
  const handleModelChange = useCallback((model: string) => {
    handleSettingChange('model', model);
    if (orSearch) setOrSearch('');
  }, [handleSettingChange, orSearch]);

  const handleApiKeyChange = useCallback((key: string, value: string) => {
    handleSettingChange(key as any, value);
  }, [handleSettingChange]);

  return (
    <>
      <TranslationEngineSection
        provider={currentSettings.provider}
        model={currentSettings.model}
        imageModel={currentSettings.imageModel}
        contextDepth={currentSettings.contextDepth}
        preloadCount={currentSettings.preloadCount}
        sourceLanguage={(currentSettings as any).sourceLanguage || 'Korean'}
        targetLanguage={(currentSettings as any).targetLanguage || 'English'}
        pricedTextModels={pricedTextModels}
        pricedImageModels={pricedImageModels}
        isOpenRouter={currentSettings.provider === 'OpenRouter'}
        orSearch={orSearch}
        onOrSearchChange={setOrSearch}
        openRouterModelsUpdatedAt={openRouterModels?.fetchedAt ? new Date(openRouterModels.fetchedAt).toLocaleString() : null}
        structuredOutputIndicator={structuredOutputIndicator}
        onProviderChange={(p) => handleSettingChange('provider', p)}
        onModelChange={handleModelChange}
        onImageModelChange={(m) => handleSettingChange('imageModel', m)}
        onContextDepthChange={(v) => handleSettingChange('contextDepth', v)}
        onPreloadCountChange={(v) => handleSettingChange('preloadCount', v)}
        onSourceLanguageChange={(v) => handleSettingChange('sourceLanguage' as any, v)}
        onTargetLanguageChange={(v) => handleSettingChange('targetLanguage' as any, v)}
      />

      <ApiKeysSection
        apiKeyGemini={currentSettings.apiKeyGemini || ''}
        apiKeyDeepSeek={currentSettings.apiKeyDeepSeek || ''}
        apiKeyOpenRouter={currentSettings.apiKeyOpenRouter || ''}
        apiKeyClaude={currentSettings.apiKeyClaude || ''}
        apiKeyPiAPI={currentSettings.apiKeyPiAPI || ''}
        onApiKeyChange={handleApiKeyChange}
        openRouterCreditLine={openRouterCreditLine}
        deepSeekCreditLine={deepSeekCreditLine}
        piApiCreditLine={piApiCreditLine}
        onRefreshOpenRouterCredits={refreshOpenRouterCredits}
        onRefreshDeepSeekBalance={() => refreshProviderCredits('DeepSeek')}
        onRefreshPiApiBalance={() => refreshProviderCredits('PiAPI')}
      />
    </>
  );
};

export default ProvidersPanel;
