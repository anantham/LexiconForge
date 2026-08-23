import React, { useEffect, useMemo, useState } from 'react';
import { AVAILABLE_IMAGE_MODELS } from '../../config/constants';
import type { AppSettings } from '../../types';
import type { ImageGenerationOverrides } from '../../services/imageJobTypes';
import { getImageCapableModels } from '../../services/openrouterImageModelAdapter';
import {
  DEFAULT_INDRASNET_BASE_URL,
  fetchIndrasNetWorkflows,
  imageModelFromWorkflowName,
} from '../../services/providers/indrasNetImageProvider';
import { OpenRouterEndpointSelect } from '../settings/OpenRouterEndpointSelect';

interface ImageModelOption {
  id: string;
  label: string;
  group: 'Saved' | 'Asus / IndrasNet' | 'OpenRouter' | 'Other';
}

interface IllustrationRouteDialogProps {
  selection: string;
  settings: AppSettings;
  onCancel: () => void;
  onSubmit: (overrides: ImageGenerationOverrides) => void;
}

export const IllustrationRouteDialog: React.FC<IllustrationRouteDialogProps> = ({
  selection,
  settings,
  onCancel,
  onSubmit,
}) => {
  const [imageModel, setImageModel] = useState(settings.imageModel || 'none');
  const [endpoint, setEndpoint] = useState(settings.openRouterImageEndpoint || 'auto');
  const [discoveredModels, setDiscoveredModels] = useState<ImageModelOption[]>([]);
  const [catalogueWarning, setCatalogueWarning] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  useEffect(() => {
    let cancelled = false;
    const endpointUrl = settings.indrasNetBaseUrl?.trim() || DEFAULT_INDRASNET_BASE_URL;
    Promise.allSettled([
      getImageCapableModels(),
      fetchIndrasNetWorkflows(endpointUrl),
    ]).then(([openRouterResult, indrasNetResult]) => {
      if (cancelled) return;
      const options: ImageModelOption[] = [];
      const warnings: string[] = [];
      if (openRouterResult.status === 'fulfilled') {
        options.push(...openRouterResult.value.data.map(model => ({
          id: `openrouter/${model.id}`,
          label: `${model.name} — ${model.pricingLabel}`,
          group: 'OpenRouter' as const,
        })));
      } else {
        warnings.push('OpenRouter model catalogue unavailable');
        console.error('[IllustrationRouteDialog] OpenRouter catalogue failed:', openRouterResult.reason);
      }
      if (indrasNetResult.status === 'fulfilled') {
        options.push(...indrasNetResult.value.map(workflow => ({
          id: imageModelFromWorkflowName(workflow.name),
          label: `Asus: ${workflow.manifest.display_name || workflow.name}`,
          group: 'Asus / IndrasNet' as const,
        })));
      } else {
        warnings.push('Asus workflow catalogue unavailable');
        console.error('[IllustrationRouteDialog] IndrasNet catalogue failed:', indrasNetResult.reason);
      }
      setDiscoveredModels(options);
      setCatalogueWarning(warnings.length ? warnings.join('; ') : null);
    });
    return () => { cancelled = true; };
  }, [settings.indrasNetBaseUrl]);

  const options = useMemo(() => {
    const byId = new Map<string, ImageModelOption>();
    if (settings.imageModel && settings.imageModel !== 'none') {
      byId.set(settings.imageModel, {
        id: settings.imageModel,
        label: `${settings.imageModel} (saved default)`,
        group: 'Saved',
      });
    }
    for (const model of AVAILABLE_IMAGE_MODELS.Gemini) {
      byId.set(model.id, { id: model.id, label: model.name, group: 'Other' });
    }
    for (const model of discoveredModels) byId.set(model.id, model);
    return [...byId.values()];
  }, [discoveredModels, settings.imageModel]);

  const handleModelChange = (nextModel: string) => {
    setImageModel(nextModel);
    setEndpoint(nextModel === settings.imageModel ? settings.openRouterImageEndpoint || 'auto' : 'auto');
  };

  const submit = () => {
    if (!imageModel || imageModel === 'none') return;
    onSubmit({
      imageModel,
      ...(imageModel.startsWith('openrouter/') ? { openRouterImageEndpoint: endpoint } : {}),
    });
  };

  const groups = ['Saved', 'Asus / IndrasNet', 'OpenRouter', 'Other'] as const;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onMouseDown={event => { if (event.target === event.currentTarget) onCancel(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="illustration-route-title"
        className="w-full max-w-xl rounded-t-2xl border border-gray-700 bg-gray-900 p-5 text-gray-100 shadow-2xl sm:rounded-2xl"
      >
        <h2 id="illustration-route-title" className="text-lg font-semibold">Generate illustration</h2>
        <p className="mt-1 line-clamp-2 text-sm text-gray-400">“{selection}”</p>

        <label htmlFor="illustrationImageModel" className="mt-4 block text-sm font-medium">
          Image model for this job
        </label>
        <select
          id="illustrationImageModel"
          value={imageModel}
          onChange={event => handleModelChange(event.target.value)}
          className="mt-1 block w-full rounded-md border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white"
        >
          <option value="none">Select an image model…</option>
          {groups.map(group => {
            const groupOptions = options.filter(option => option.group === group);
            return groupOptions.length ? (
              <optgroup key={group} label={group}>
                {groupOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
              </optgroup>
            ) : null;
          })}
        </select>

        {imageModel.startsWith('openrouter/') && (
          <OpenRouterEndpointSelect
            id="illustrationOpenRouterEndpoint"
            label="OpenRouter endpoint for this job"
            modelId={imageModel}
            value={endpoint}
            onChange={setEndpoint}
          />
        )}

        <p className="mt-3 text-xs text-gray-400">
          This choice applies only to this illustration. Your LexiconForge defaults will not change.
          {catalogueWarning ? ` ${catalogueWarning}. Saved options remain usable.` : ''}
        </p>

        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-md px-4 py-2 text-sm text-gray-300 hover:bg-gray-800">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!imageModel || imageModel === 'none'}
            className="rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Generate
          </button>
        </div>
      </section>
    </div>
  );
};

export default IllustrationRouteDialog;
