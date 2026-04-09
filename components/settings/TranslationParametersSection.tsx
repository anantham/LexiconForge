/**
 * TranslationParametersSection - Advanced AI parameter controls
 *
 * Extracted from AdvancedPanel for better separation of concerns.
 * Handles temperature, topP, seed, penalties, and feature toggles.
 */

import React from 'react';
import appConfig from '../../config/app.json';

type ParameterSupportStatus = boolean | undefined;

interface ParameterSupport {
  temperature?: ParameterSupportStatus;
  topP?: ParameterSupportStatus;
  seed?: ParameterSupportStatus;
  frequencyPenalty?: ParameterSupportStatus;
  presencePenalty?: ParameterSupportStatus;
}

interface TranslationParametersSectionProps {
  // Current values
  temperature: number;
  topP: number;
  seed: number | null;
  frequencyPenalty: number;
  presencePenalty: number;
  enableAmendments: boolean;
  autoApproveGlossaryAmendments: boolean;
  includeFanTranslationInPrompt: boolean;
  includeHistoricalFanTranslationsInContext: boolean;

  // Parameter support for current model
  parameterSupport: ParameterSupport | undefined;

  // Change handlers
  onTemperatureChange: (value: number) => void;
  onTopPChange: (value: number) => void;
  onSeedChange: (value: number | null) => void;
  onFrequencyPenaltyChange: (value: number) => void;
  onPresencePenaltyChange: (value: number) => void;
  onEnableAmendmentsChange: (value: boolean) => void;
  onAutoApproveGlossaryAmendmentsChange: (value: boolean) => void;
  onIncludeFanTranslationChange: (value: boolean) => void;
  onIncludeHistoricalFanTranslationsChange: (value: boolean) => void;
}

const SupportIndicator: React.FC<{ support: ParameterSupportStatus; title?: string }> = ({ support, title }) => {
  if (support === true) return <span className="text-green-500 text-xs" title={title || "Supported by this model"}>✓</span>;
  if (support === false) return <span className="text-red-500 text-xs" title={title || "Not supported by this model"}>✗</span>;
  return <span className="text-gray-400 text-xs" title={title || "Checking support..."}>?</span>;
};

export const TranslationParametersSection: React.FC<TranslationParametersSectionProps> = ({
  temperature,
  topP,
  seed,
  frequencyPenalty,
  presencePenalty,
  enableAmendments,
  autoApproveGlossaryAmendments,
  includeFanTranslationInPrompt,
  includeHistoricalFanTranslationsInContext,
  parameterSupport,
  onTemperatureChange,
  onTopPChange,
  onSeedChange,
  onFrequencyPenaltyChange,
  onPresencePenaltyChange,
  onEnableAmendmentsChange,
  onAutoApproveGlossaryAmendmentsChange,
  onIncludeFanTranslationChange,
  onIncludeHistoricalFanTranslationsChange,
}) => {
  return (
    <fieldset>
      <legend className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3 border-b border-gray-200 dark:border-gray-700 pb-1">
        Advanced translation parameters
      </legend>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
              Temperature:{' '}
              <span className="font-bold text-blue-500 mx-1">{temperature}</span>
              <SupportIndicator support={parameterSupport?.temperature} />
            </label>
            <input
              type="range"
              min={appConfig.aiParameters.limits.temperature.min}
              max={appConfig.aiParameters.limits.temperature.max}
              step="0.1"
              value={temperature}
              onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {appConfig.aiParameters.descriptions.temperature}
            </p>
          </div>
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
              Top P:{' '}
              <span className="font-bold text-blue-500 mx-1">{topP}</span>
              <SupportIndicator support={parameterSupport?.topP} />
            </label>
            <input
              type="range"
              min={appConfig.aiParameters.limits.top_p.min}
              max={appConfig.aiParameters.limits.top_p.max}
              step="0.05"
              value={topP}
              onChange={(e) => onTopPChange(parseFloat(e.target.value))}
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
              <SupportIndicator support={parameterSupport?.seed} />
            </label>
            <input
              id="seed"
              type="number"
              min={appConfig.aiParameters.limits.seed.min}
              max={appConfig.aiParameters.limits.seed.max}
              value={seed ?? ''}
              onChange={(e) => onSeedChange(e.target.value ? parseInt(e.target.value, 10) : null)}
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
              <span className="font-bold text-blue-500 mx-1">{frequencyPenalty}</span>
              <SupportIndicator support={parameterSupport?.frequencyPenalty} />
            </label>
            <input
              id="frequencyPenalty"
              type="range"
              min={appConfig.aiParameters.limits.frequency_penalty.min}
              max={appConfig.aiParameters.limits.frequency_penalty.max}
              step="0.1"
              value={frequencyPenalty}
              onChange={(e) => onFrequencyPenaltyChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {appConfig.aiParameters.descriptions.frequency_penalty}
            </p>
          </div>
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
              Presence Penalty:{' '}
              <span className="font-bold text-blue-500 mx-1">{presencePenalty}</span>
              <SupportIndicator support={parameterSupport?.presencePenalty} />
            </label>
            <input
              id="presencePenalty"
              type="range"
              min={appConfig.aiParameters.limits.presence_penalty.min}
              max={appConfig.aiParameters.limits.presence_penalty.max}
              step="0.1"
              value={presencePenalty}
              onChange={(e) => onPresencePenaltyChange(parseFloat(e.target.value))}
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
              checked={enableAmendments}
              onChange={(e) => onEnableAmendmentsChange(e.target.checked)}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <div>
              <span className="block font-medium text-gray-800 dark:text-gray-100">Enable Amendment Proposals</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                Run a separate follow-up AI pass after each translation to suggest prompt or glossary amendments for future chapters.
                Glossary accepts update your local override layer on top of the imported book glossary.
                When disabled, no proposal pass runs. Enabling this adds an extra AI call per translated chapter.
              </span>
            </div>
          </label>
        </div>

        {enableAmendments && (
          <div className="mt-2 ml-7">
            <label className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoApproveGlossaryAmendments}
                onChange={(e) => onAutoApproveGlossaryAmendmentsChange(e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div>
                <span className="block font-medium text-gray-800 dark:text-gray-100">Auto-approve Glossary Amendments</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Automatically apply suggested glossary changes without manual approval. 
                  This is useful for consistent terminology in batch translations.
                </span>
              </div>
            </label>
          </div>
        )}

        <div className="mt-4">
          <label className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={includeFanTranslationInPrompt}
              onChange={(e) => onIncludeFanTranslationChange(e.target.checked)}
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

        <div className="mt-4">
          <label className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={includeHistoricalFanTranslationsInContext}
              onChange={(e) => onIncludeHistoricalFanTranslationsChange(e.target.checked)}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <div>
              <span className="block font-medium text-gray-800 dark:text-gray-100">Include Previous Fan Translations in Context</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                When context depth is above zero, include prior chapters&apos; fan translations as separate historical reference blocks. This improves
                terminology and style continuity, but it increases prompt size and cost.
              </span>
            </div>
          </label>
        </div>
      </div>
    </fieldset>
  );
};

export default TranslationParametersSection;
