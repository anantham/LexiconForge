/**
 * TranslationEngineSection - Provider, model, and translation settings
 *
 * Extracted from ProvidersPanel for better separation of concerns.
 * Handles provider selection, model selection, language settings, and sliders.
 */

import React from 'react';
import type { TranslationProvider } from '../../types';

interface PricedModel {
  id: string;
  name: string;
  label: string;
  sortKey: number;
}

interface PricedImageModel {
  id: string;
  name: string;
  label: string;
  sortKey: number;
  provider: string;
  source: 'static' | 'dynamic';
  description?: string;
}

interface TranslationEngineSectionProps {
  // Current settings
  provider: TranslationProvider;
  model: string;
  imageModel: string;
  contextDepth: number;
  preloadCount: number;
  sourceLanguage: string;
  targetLanguage: string;

  // Model lists
  pricedTextModels: PricedModel[];
  pricedImageModels: PricedImageModel[];

  // OpenRouter-specific
  isOpenRouter: boolean;
  orSearch: string;
  onOrSearchChange: (value: string) => void;
  openRouterModelsUpdatedAt: string | null;

  // Structured output support
  structuredOutputIndicator: React.ReactNode;

  // Change handlers
  onProviderChange: (provider: TranslationProvider) => void;
  onModelChange: (model: string) => void;
  onImageModelChange: (model: string) => void;
  onContextDepthChange: (value: number) => void;
  onPreloadCountChange: (value: number) => void;
  onSourceLanguageChange: (value: string) => void;
  onTargetLanguageChange: (value: string) => void;
}

export const TranslationEngineSection: React.FC<TranslationEngineSectionProps> = ({
  provider,
  model,
  imageModel,
  contextDepth,
  preloadCount,
  sourceLanguage,
  targetLanguage,
  pricedTextModels,
  pricedImageModels,
  isOpenRouter,
  orSearch,
  onOrSearchChange,
  openRouterModelsUpdatedAt,
  structuredOutputIndicator,
  onProviderChange,
  onModelChange,
  onImageModelChange,
  onContextDepthChange,
  onPreloadCountChange,
  onSourceLanguageChange,
  onTargetLanguageChange,
}) => {
  return (
    <fieldset>
      <legend className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
        Translation engine
      </legend>
      <div className="space-y-4">
        {/* Source Language */}
        <div>
          <label htmlFor="sourceLanguage" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Source Language
          </label>
          <input
            id="sourceLanguage"
            type="text"
            value={sourceLanguage}
            onChange={(e) => onSourceLanguageChange(e.target.value)}
            placeholder="e.g., Korean, Japanese"
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
          />
        </div>

        {/* Target Language */}
        <div>
          <label htmlFor="targetLanguage" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Target Language
          </label>
          <input
            id="targetLanguage"
            type="text"
            value={targetLanguage}
            onChange={(e) => onTargetLanguageChange(e.target.value)}
            placeholder="e.g., English, Malayalam, Español"
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
          />
        </div>

        {/* Provider and Model Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Text Provider */}
          <div>
            <label htmlFor="provider" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Text Provider
            </label>
            <select
              id="provider"
              value={provider}
              onChange={(e) => onProviderChange(e.target.value as TranslationProvider)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="Gemini">Google Gemini</option>
              <option value="DeepSeek">DeepSeek</option>
              <option value="OpenRouter">OpenRouter</option>
              <option value="Claude">Claude (Anthropic)</option>
            </select>
          </div>

          {/* Text Model */}
          <div>
            <label htmlFor="model" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Text Model
              <span
                className="ml-2 inline-block text-xs text-gray-500 dark:text-gray-400 cursor-help"
                title={
                  'Prices are shown as $input/$output per 1M tokens.\n' +
                  '• Input = prompt/context tokens you send.\n' +
                  '• Output = tokens the model generates (includes thinking tokens when applicable).\n' +
                  'Model IDs ending with "latest" are rolling aliases managed by the provider (e.g., gpt-5-chat-latest).\n' +
                  'Fixed IDs (e.g., gpt-5) are specific snapshots. The exact slug you select is passed to the API.\n\n' +
                  'Green checkmarks (✅) indicate models that support structured outputs for better JSON schema compliance.'
                }
              >
                (pricing & capabilities)
              </span>
            </label>

            {/* OpenRouter search input */}
            {isOpenRouter && (
              <div className="mb-2">
                <input
                  type="search"
                  placeholder="Search models or providers (clears after selection)"
                  value={orSearch}
                  onChange={(e) => onOrSearchChange(e.target.value)}
                  className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-gray-200"
                />
              </div>
            )}

            <select
              id="model"
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              className="mt-1 block w-full pl-3 pr-2 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              {pricedTextModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>

            {/* OpenRouter models updated timestamp */}
            {isOpenRouter && (
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Models updated: {openRouterModelsUpdatedAt || '—'}
              </div>
            )}

            {/* Structured output indicator */}
            {structuredOutputIndicator}
          </div>
        </div>

        {/* Image Generation Model */}
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
            value={imageModel}
            onChange={(e) => onImageModelChange(e.target.value)}
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

        {/* Context Depth Slider */}
        <div>
          <label htmlFor="contextDepth" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Context Depth:{' '}
            <span className="font-bold text-blue-500">{contextDepth}</span>
          </label>
          <input
            id="contextDepth"
            type="range"
            min="0"
            max="5"
            value={contextDepth}
            onChange={(e) => onContextDepthChange(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            How many previous chapters to send as context. More improves consistency but costs more.
          </p>
        </div>

        {/* Pre-load Count Slider */}
        <div>
          <label htmlFor="preloadCount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Pre-load Ahead:
            <span
              className={`font-bold ml-1 ${
                preloadCount === 0 ? 'text-red-500' : 'text-blue-500'
              }`}
            >
              {preloadCount === 0 ? 'DISABLED' : preloadCount}
            </span>
          </label>
          <input
            id="preloadCount"
            type="range"
            min="0"
            max="50"
            value={preloadCount}
            onChange={(e) => onPreloadCountChange(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {preloadCount === 0
              ? '🔴 Background preload is DISABLED. Chapters will only load when you navigate to them.'
              : 'How many future chapters to fetch and translate in the background (serially). Higher values may increase API usage and hit provider rate limits.'}
          </p>
        </div>
      </div>
    </fieldset>
  );
};

export default TranslationEngineSection;
