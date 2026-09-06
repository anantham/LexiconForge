import React from 'react';
import {
  isIndrasNetImageModel,
} from '../../services/providers/indrasNetImageProvider';

interface FallbackModelOption {
  id: string;
  label: string;
}

interface IndrasNetImageProviderSectionProps {
  endpoint: string;
  loading: boolean;
  error: string | null;
  workflowCount: number;
  onEndpointChange: (_value: string) => void;
  onRefresh: () => void;
}

interface IndrasNetImageFallbackSectionProps {
  selectedImageModel: string;
  fallbackModel: string;
  fallbackModels: FallbackModelOption[];
  onFallbackModelChange: (_value: string) => void;
}

export const IndrasNetImageProviderSection: React.FC<IndrasNetImageProviderSectionProps> = ({
  endpoint,
  loading,
  error,
  workflowCount,
  onEndpointChange,
  onRefresh,
}) => {
  return (
    <fieldset className="mt-6">
      <legend className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
        IndrasNet image provider
      </legend>
      <div className="space-y-3">
        <div>
          <label htmlFor="indrasNetBaseUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Tailnet broker endpoint
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="indrasNetBaseUrl"
              type="url"
              value={endpoint}
              onChange={(event) => onEndpointChange(event.target.value)}
              placeholder="https://broker.example.com"
              className="block min-w-0 flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-gray-200"
            />
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading || !endpoint.trim()}
              className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-50"
            >
              {loading ? 'Checking…' : 'Refresh'}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Enter your authorized broker's HTTPS URL. This setting is saved in this browser.
          </p>
          {!endpoint.trim() ? (
            <p role="status" className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Enter a broker URL to discover image workflows.
            </p>
          ) : error ? (
            <p role="status" className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              Broker unavailable: {error}
            </p>
          ) : (
            <p role="status" className="mt-1 text-xs text-green-600 dark:text-green-400">
              {loading ? 'Discovering client-ready workflows…' : `${workflowCount} client-ready workflow${workflowCount === 1 ? '' : 's'} available`}
            </p>
          )}
        </div>
      </div>
    </fieldset>
  );
};

export const IndrasNetImageFallbackSection: React.FC<IndrasNetImageFallbackSectionProps> = ({
  selectedImageModel,
  fallbackModel,
  fallbackModels,
  onFallbackModelChange,
}) => {
  if (!isIndrasNetImageModel(selectedImageModel)) return null;

  const normalizedFallbackModel = fallbackModel.trim() || 'none';
  const savedCloudFallbackUnavailable = normalizedFallbackModel !== 'none'
    && !isIndrasNetImageModel(normalizedFallbackModel)
    && !fallbackModels.some(model => model.id === normalizedFallbackModel);

  return (
    <fieldset className="mt-6">
      <legend className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
        Local image fallback
      </legend>
      <div>
        <label htmlFor="imageFallbackModel" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Cloud fallback when the broker is offline or busy
        </label>
        <select
          id="imageFallbackModel"
          value={normalizedFallbackModel}
          onChange={(event) => onFallbackModelChange(event.target.value)}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
        >
          <option value="none">None — fail visibly</option>
          {savedCloudFallbackUnavailable && (
            <option value={normalizedFallbackModel}>
              Saved cloud fallback: {normalizedFallbackModel} — unavailable (still active)
            </option>
          )}
          {fallbackModels.map(model => (
            <option key={model.id} value={model.id}>{model.label}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Opt-in only. A fallback is used only for retryable local failures and is recorded in the illustration provenance.
        </p>
      </div>
    </fieldset>
  );
};

export default IndrasNetImageProviderSection;
