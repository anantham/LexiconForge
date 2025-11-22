import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AVAILABLE_MODELS, AVAILABLE_IMAGE_MODELS } from '../../config/constants';
import { MODELS, COSTS_PER_MILLION_TOKENS, IMAGE_COSTS } from '../../config/costs';
import type { TranslationProvider } from '../../types';
import { supportsStructuredOutputs, supportsParameters } from '../../services/capabilityService';
import { debugLog } from '../../utils/debug';
import { useSettingsModalContext, ParameterSupportState } from './SettingsModalContext';
import { useProvidersPanelStore } from '../../hooks/useProvidersPanelStore';

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
    [parameterSupport]
  );

  useEffect(() => {
    if (!isOpen) return;
    loadProviderCreditsFromCache();
  }, [isOpen, loadProviderCreditsFromCache]);

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

  useEffect(() => {
    if (!isOpen) return;
    checkStructuredOutputSupport(currentSettings.provider, currentSettings.model);
    checkParameterSupport(currentSettings.provider, currentSettings.model);
  }, [isOpen, currentSettings.provider, currentSettings.model, checkStructuredOutputSupport, checkParameterSupport]);

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

    return () => {
      cancelled = true;
    };
  }, [isOpen, currentSettings.provider, checkStructuredOutputSupport]);

  useEffect(() => {
    if (!isOpen || currentSettings.provider !== 'OpenRouter') return;
    const key = `OpenRouter:${currentSettings.model}`;
    debugLog('api', 'full', `[Capability Check] Checking model: ${key}`);

    if (structuredOutputSupport[key] !== undefined && structuredOutputSupport[key] !== null) {
      debugLog('api', 'full', `[Capability Check] Skipping check for ${key}`);
      return;
    }

    (async () => {
      try {
        const hasSupport = await supportsStructuredOutputs('OpenRouter', currentSettings.model);
        debugLog('api', 'full', `[Capability Check] Result for ${key}: ${hasSupport}`);
        setStructuredOutputSupport((prev) => ({ ...prev, [key]: hasSupport }));
      } catch (error) {
        console.warn(`Failed to check structured output support for ${key}`, error);
        setStructuredOutputSupport((prev) => ({ ...prev, [key]: false }));
      }
    })();
  }, [isOpen, currentSettings.provider, currentSettings.model, structuredOutputSupport]);

  const openRouterCreditLine = useMemo(() => {
    if (!openRouterKeyUsage) return 'Credits remaining: —';

    const remaining =
      openRouterKeyUsage.remainingCredits ?? openRouterKeyUsage.remaining ?? null;
    const total =
      openRouterKeyUsage.totalCredits ?? openRouterKeyUsage.limit ?? null;
    const fetchedAt = formatUpdatedAt(openRouterKeyUsage.fetchedAt);

    if (remaining == null && total == null) {
      return fetchedAt
        ? `Credits remaining: ∞ (updated ${fetchedAt})`
        : 'Credits remaining: ∞';
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

    if (fetchedAt) {
      parts.push(`(updated ${fetchedAt})`);
    }

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
      return recents.concat(rest).map((m) => ({
        id: m.id,
        name: m.label,
        label: m.label,
        sortKey: m.priceKey ?? Number.POSITIVE_INFINITY,
      }));
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
  }, [currentSettings.provider, getOpenRouterOptions, lastUsedMap, orSearch]);

  const pricedImageModels = useMemo(() => {
    const rawImageModels = AVAILABLE_IMAGE_MODELS['Gemini'] || [];
    return rawImageModels
      .map((m) => {
        const price = IMAGE_COSTS[m.id];
        const label = price != null ? `${m.name} — $${price.toFixed(3)}/image` : m.name;
        const sortKey = price != null ? price : Number.POSITIVE_INFINITY;
        return { ...m, label, sortKey };
      })
      .sort((a, b) => a.sortKey - b.sortKey);
  }, []);

  const renderStructuredOutputIndicator = () => {
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
  };

  const handleProviderChange = (value: TranslationProvider) => {
    handleSettingChange('provider', value);
  };

  return (
    <>
      <fieldset>
        <legend className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
          Translation engine
        </legend>
        <div className="space-y-4">
          <div>
            <label htmlFor="sourceLanguage" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Source Language
            </label>
            <input
              id="sourceLanguage"
              type="text"
              value={(currentSettings as any).sourceLanguage || 'Korean'}
              onChange={(e) => handleSettingChange('sourceLanguage' as any, e.target.value)}
              placeholder="e.g., Korean, Japanese"
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
            />
          </div>
          <div>
            <label htmlFor="targetLanguage" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Target Language
            </label>
            <input
              id="targetLanguage"
              type="text"
              value={(currentSettings as any).targetLanguage || 'English'}
              onChange={(e) => handleSettingChange('targetLanguage' as any, e.target.value)}
              placeholder="e.g., English, Malayalam, Español"
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="provider" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Text Provider
              </label>
              <select
                id="provider"
                value={currentSettings.provider}
                onChange={(e) => handleProviderChange(e.target.value as TranslationProvider)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="Gemini">Google Gemini</option>
                <option value="DeepSeek">DeepSeek</option>
                <option value="OpenRouter">OpenRouter</option>
                <option value="Claude">Claude (Anthropic)</option>
              </select>
            </div>
            <div>
              <label htmlFor="model" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Text Model
                <span
                  className="ml-2 inline-block text-xs text-gray-500 dark:text-gray-400 cursor-help"
                  title={
                    'Prices are shown as $input/$output per 1M tokens.\n' +
                    '• Input = prompt/context tokens you send.\n' +
                    '• Output = tokens the model generates (includes thinking tokens when applicable).\n' +
                    'Model IDs ending with “latest” are rolling aliases managed by the provider (e.g., gpt-5-chat-latest).\n' +
                    'Fixed IDs (e.g., gpt-5) are specific snapshots. The exact slug you select is passed to the API.\n\n' +
                    'Green checkmarks (✅) indicate models that support structured outputs for better JSON schema compliance.'
                  }
                >
                  (pricing & capabilities)
                </span>
              </label>
              {currentSettings.provider === 'OpenRouter' && (
                <div className="mb-2">
                  <input
                    type="search"
                    placeholder="Search models or providers"
                    value={orSearch}
                    onChange={(e) => setOrSearch(e.target.value)}
                    className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-gray-200"
                  />
                </div>
              )}
              <select
                id="model"
                value={currentSettings.model}
                onChange={(e) => handleSettingChange('model', e.target.value)}
                className="mt-1 block w-full pl-3 pr-2 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                {pricedTextModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
              {currentSettings.provider === 'OpenRouter' && (
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Models updated:{' '}
                  {openRouterModels?.fetchedAt ? new Date(openRouterModels.fetchedAt).toLocaleString() : '—'}
                </div>
              )}
              {renderStructuredOutputIndicator()}
            </div>
          </div>
          <div>
            <label htmlFor="imageModel" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Image Generation Model
              <span
                className="ml-2 inline-block text-xs text-gray-500 dark:text-gray-400 cursor-help"
                title={
                  'Image prices are per generated image.\n' +
                  'Some image models are previews and may have rate limits or change behavior.'
                }
              >
                (pricing?)
              </span>
            </label>
            <select
              id="imageModel"
              value={currentSettings.imageModel}
              onChange={(e) => handleSettingChange('imageModel', e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="none">None (Disable Illustrations) — $0.000/image</option>
              {pricedImageModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Dedicated models like Imagen can produce higher quality images. All image generation requires a Gemini API key.
            </p>
          </div>
          <div>
            <label htmlFor="contextDepth" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Context Depth:{' '}
              <span className="font-bold text-blue-500">{currentSettings.contextDepth}</span>
            </label>
            <input
              id="contextDepth"
              type="range"
              min="0"
              max="5"
              value={currentSettings.contextDepth}
              onChange={(e) => handleSettingChange('contextDepth', parseInt(e.target.value, 10))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              How many previous chapters to send as context. More improves consistency but costs more.
            </p>
          </div>
          <div>
            <label htmlFor="preloadCount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Pre-load Ahead:
              <span
                className={`font-bold ml-1 ${
                  currentSettings.preloadCount === 0 ? 'text-red-500' : 'text-blue-500'
                }`}
              >
                {currentSettings.preloadCount === 0 ? 'DISABLED' : currentSettings.preloadCount}
              </span>
            </label>
            <input
              id="preloadCount"
              type="range"
              min="0"
              max="50"
              value={currentSettings.preloadCount}
              onChange={(e) => handleSettingChange('preloadCount', parseInt(e.target.value, 10))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {currentSettings.preloadCount === 0
                ? '🔴 Background preload is DISABLED. Chapters will only load when you navigate to them.'
                : 'How many future chapters to fetch and translate in the background (serially). Higher values may increase API usage and hit provider rate limits.'}
            </p>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
          API Keys
        </legend>
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Security notice</h3>
              <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                Your API keys are stored locally on your device. This is a static app with no backend; all data (including keys)
                lives in your browser’s storage.
              </p>
              <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                Requests to providers (Gemini, Claude, DeepSeek, OpenRouter, etc.) are sent directly from your current browser
                session, and your keys are never sent anywhere else. This project is open source - browse the{' '}
                <a
                  href="https://github.com/anantham/LexiconForge"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  repo
                </a>
                {' '}and see.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="apiKeyGemini" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Google Gemini API Key
            </label>
            <input
              id="apiKeyGemini"
              type="password"
              value={currentSettings.apiKeyGemini || ''}
              onChange={(e) => handleSettingChange('apiKeyGemini', e.target.value)}
              placeholder="Enter your Gemini API Key"
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-900 dark:text-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="apiKeyDeepSeek" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              DeepSeek API Key
            </label>
            <input
              id="apiKeyDeepSeek"
              type="password"
              value={currentSettings.apiKeyDeepSeek || ''}
              onChange={(e) => handleSettingChange('apiKeyDeepSeek', e.target.value)}
              placeholder="Enter your DeepSeek API Key"
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-900 dark:text-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => refreshProviderCredits('DeepSeek')}
                className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded-md"
              >
                Refresh balance
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400">{deepSeekCreditLine}</span>
            </div>
          </div>
          <div>
            <label htmlFor="apiKeyOpenRouter" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              OpenRouter API Key
            </label>
            <input
              id="apiKeyOpenRouter"
              type="password"
              value={currentSettings.apiKeyOpenRouter || ''}
              onChange={(e) => handleSettingChange('apiKeyOpenRouter', e.target.value)}
              placeholder="Enter your OpenRouter API Key"
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-900 dark:text-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => refreshOpenRouterCredits()}
                className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded-md"
              >
                Refresh credits
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400">{openRouterCreditLine}</span>
            </div>
          </div>
          <div>
            <label htmlFor="apiKeyClaude" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Claude API Key
            </label>
            <input
              id="apiKeyClaude"
              type="password"
              value={currentSettings.apiKeyClaude || ''}
              onChange={(e) => handleSettingChange('apiKeyClaude', e.target.value)}
              placeholder="Enter your Claude API Key"
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-900 dark:text-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Required for upcoming Anthropic adapters (kept local on your device).
            </p>
          </div>
          <div>
            <label htmlFor="apiKeyPiAPI" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Pi API Key
            </label>
            <input
              id="apiKeyPiAPI"
              type="password"
              value={currentSettings.apiKeyPiAPI || ''}
              onChange={(e) => handleSettingChange('apiKeyPiAPI', e.target.value)}
              placeholder="Enter your Pi API Key"
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-900 dark:text-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => refreshProviderCredits('PiAPI')}
                className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded-md"
              >
                Refresh balance
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400">{piApiCreditLine}</span>
            </div>
          </div>
        </div>
      </fieldset>
    </>
  );
};

export default ProvidersPanel;
