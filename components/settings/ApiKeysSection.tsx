/**
 * ApiKeysSection - API key inputs with balance/credit refresh
 *
 * Extracted from ProvidersPanel for better separation of concerns.
 * Handles all provider API key inputs and their associated refresh buttons.
 */

import React from 'react';

interface ProviderCredits {
  remaining?: number | null;
  total?: number | null;
  granted?: number | null;
  toppedUp?: number | null;
  currency?: string;
  note?: string;
  fetchedAt?: string;
  metadata?: Record<string, unknown>;
}

interface ApiKeysSectionProps {
  // Current API key values
  apiKeyGemini: string;
  apiKeyDeepSeek: string;
  apiKeyOpenRouter: string;
  apiKeyClaude: string;
  apiKeyPiAPI: string;

  // Change handler
  onApiKeyChange: (key: string, value: string) => void;

  // Credit display data
  openRouterCreditLine: string;
  deepSeekCreditLine: string;
  piApiCreditLine: string;

  // Refresh handlers
  onRefreshOpenRouterCredits: () => void;
  onRefreshDeepSeekBalance: () => void;
  onRefreshPiApiBalance: () => void;
}

export const ApiKeysSection: React.FC<ApiKeysSectionProps> = ({
  apiKeyGemini,
  apiKeyDeepSeek,
  apiKeyOpenRouter,
  apiKeyClaude,
  apiKeyPiAPI,
  onApiKeyChange,
  openRouterCreditLine,
  deepSeekCreditLine,
  piApiCreditLine,
  onRefreshOpenRouterCredits,
  onRefreshDeepSeekBalance,
  onRefreshPiApiBalance,
}) => {
  return (
    <fieldset>
      <legend className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
        API Keys
      </legend>

      {/* Security notice */}
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
              lives in your browser's storage.
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
        {/* Gemini API Key */}
        <div>
          <label htmlFor="apiKeyGemini" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Google Gemini API Key
          </label>
          <input
            id="apiKeyGemini"
            type="password"
            value={apiKeyGemini}
            onChange={(e) => onApiKeyChange('apiKeyGemini', e.target.value)}
            placeholder="Enter your Gemini API Key"
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-900 dark:text-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* DeepSeek API Key */}
        <div>
          <label htmlFor="apiKeyDeepSeek" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            DeepSeek API Key
          </label>
          <input
            id="apiKeyDeepSeek"
            type="password"
            value={apiKeyDeepSeek}
            onChange={(e) => onApiKeyChange('apiKeyDeepSeek', e.target.value)}
            placeholder="Enter your DeepSeek API Key"
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-900 dark:text-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={onRefreshDeepSeekBalance}
              className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded-md"
            >
              Refresh balance
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400">{deepSeekCreditLine}</span>
          </div>
        </div>

        {/* OpenRouter API Key */}
        <div>
          <label htmlFor="apiKeyOpenRouter" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            OpenRouter API Key
          </label>
          <input
            id="apiKeyOpenRouter"
            type="password"
            value={apiKeyOpenRouter}
            onChange={(e) => onApiKeyChange('apiKeyOpenRouter', e.target.value)}
            placeholder="Enter your OpenRouter API Key"
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-900 dark:text-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={onRefreshOpenRouterCredits}
              className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded-md"
            >
              Refresh credits
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400">{openRouterCreditLine}</span>
          </div>
        </div>

        {/* Claude API Key */}
        <div>
          <label htmlFor="apiKeyClaude" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Claude API Key
          </label>
          <input
            id="apiKeyClaude"
            type="password"
            value={apiKeyClaude}
            onChange={(e) => onApiKeyChange('apiKeyClaude', e.target.value)}
            placeholder="Enter your Claude API Key"
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-900 dark:text-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Required for upcoming Anthropic adapters (kept local on your device).
          </p>
        </div>

        {/* PiAPI Key */}
        <div>
          <label htmlFor="apiKeyPiAPI" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Pi API Key
          </label>
          <input
            id="apiKeyPiAPI"
            type="password"
            value={apiKeyPiAPI}
            onChange={(e) => onApiKeyChange('apiKeyPiAPI', e.target.value)}
            placeholder="Enter your Pi API Key"
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-900 dark:text-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={onRefreshPiApiBalance}
              className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded-md"
            >
              Refresh balance
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400">{piApiCreditLine}</span>
          </div>
        </div>
      </div>
    </fieldset>
  );
};

export default ApiKeysSection;
