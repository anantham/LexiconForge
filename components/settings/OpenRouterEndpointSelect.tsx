import React, { useEffect, useMemo, useState } from 'react';
import {
  fetchOpenRouterEndpoints,
  type OpenRouterEndpointOption,
} from '../../services/openrouterRouting';

interface OpenRouterEndpointSelectProps {
  id: string;
  label: string;
  modelId: string;
  value?: string;
  onChange: (endpoint: string) => void;
}

export const OpenRouterEndpointSelect: React.FC<OpenRouterEndpointSelectProps> = ({
  id,
  label,
  modelId,
  value = 'auto',
  onChange,
}) => {
  const [endpoints, setEndpoints] = useState<OpenRouterEndpointOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setEndpoints([]);

    fetchOpenRouterEndpoints(modelId, { signal: controller.signal })
      .then(setEndpoints)
      .catch(fetchError => {
        if (controller.signal.aborted) return;
        const message = fetchError instanceof Error ? fetchError.message : 'Unknown endpoint discovery error.';
        console.error(`[OpenRouterEndpointSelect] ${label} discovery failed:`, fetchError);
        setError(message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [label, modelId]);

  const selected = value.trim().toLowerCase() || 'auto';
  const options = useMemo(() => {
    if (selected === 'auto' || endpoints.some(endpoint => endpoint.id === selected)) return endpoints;
    return [
      {
        id: selected,
        label: `${selected} (saved; unavailable for this model)`,
        tags: [],
      },
      ...endpoints,
    ];
  }, [endpoints, selected]);

  return (
    <div className="mt-3">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <select
        id={id}
        value={selected}
        onChange={event => onChange(event.target.value)}
        disabled={loading && options.length === 0}
        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md disabled:opacity-60"
      >
        <option value="auto">Auto (any eligible zero-retention endpoint)</option>
        {options.map(endpoint => (
          <option key={endpoint.id} value={endpoint.id}>
            {endpoint.label} — {endpoint.id}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {loading
          ? 'Loading endpoints for this model…'
          : error
            ? `Endpoint list unavailable: ${error}`
            : 'Requests require data collection deny and zero data retention. Choosing one host disables provider fallback.'}
      </p>
    </div>
  );
};

export default OpenRouterEndpointSelect;
