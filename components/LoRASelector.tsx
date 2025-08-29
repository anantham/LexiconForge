import React, { useState } from 'react';
import { LORA_MODELS, getLoRAModelsByCategory, DEFAULT_LORA_STRENGTH, MIN_LORA_STRENGTH, MAX_LORA_STRENGTH } from '../constants/loraModels';

export interface LoRASettings {
  lora_type: string;
  lora_image?: string;
  lora_strength?: number;
}

interface LoRASelectorProps {
  selectedLoRA: string | null;
  loraStrength: number;
  onLoRAChange: (loraType: string | null) => void;
  onStrengthChange: (strength: number) => void;
}

const LoRASelector: React.FC<LoRASelectorProps> = ({
  selectedLoRA,
  loraStrength,
  onLoRAChange,
  onStrengthChange,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);


  const handleLoRAChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    onLoRAChange(value === '' ? null : value);
  };

  const handleStrengthChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value);
    onStrengthChange(value);
  };

  const selectedModel = selectedLoRA ? LORA_MODELS.find(m => m.name === selectedLoRA) : null;

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            LoRA Style Model
          </label>
          {selectedLoRA && (
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
            >
              {showAdvanced ? 'Hide' : 'Show'} strength
            </button>
          )}
        </div>
        
        <select
          value={selectedLoRA || ''}
          onChange={handleLoRAChange}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">None (Default Style)</option>
          
          {/* XLabs Collection */}
          <option disabled style={{ fontWeight: 'bold', backgroundColor: '#f3f4f6' }}>
            🧪 XLabs Collection
          </option>
          {getLoRAModelsByCategory('XLabs').map((model) => (
            <option key={model.id} value={model.name}>
              &nbsp;&nbsp;{model.displayName}
            </option>
          ))}
          
          {/* CivitAI Collection */}
          <option disabled style={{ fontWeight: 'bold', backgroundColor: '#f3f4f6' }}>
            🎨 CivitAI Collection
          </option>
          {getLoRAModelsByCategory('CivitAI').map((model) => (
            <option key={model.id} value={model.name}>
              &nbsp;&nbsp;{model.displayName}
            </option>
          ))}
        </select>
        
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Select an artistic style model to transform your image generation
        </p>
      </div>

      {/* Selected Model Info */}
      {selectedModel && (
        <div className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {selectedModel.displayName}
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {selectedModel.description}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  selectedModel.category === 'XLabs' 
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                }`}>
                  {selectedModel.category}
                </span>
                <a
                  href={selectedModel.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
                >
                  View Source
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Controls */}
      {selectedLoRA && showAdvanced && (
        <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                LoRA Strength
              </label>
              <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                {loraStrength.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min={MIN_LORA_STRENGTH}
              max={MAX_LORA_STRENGTH}
              step="0.1"
              value={loraStrength}
              onChange={handleStrengthChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>0.1 (Subtle)</span>
              <span>2.0 (Strong)</span>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Controls how strongly the LoRA model influences the image style
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoRASelector;