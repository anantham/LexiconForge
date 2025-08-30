import React from 'react';
import LoRASelector from './LoRASelector';
import SteeringImageDropdown from './SteeringImageDropdown';
import { DEFAULT_LORA_STRENGTH } from '../constants/loraModels';
import { getDefaultNegativePrompt, getDefaultGuidanceScale, getGuidanceScaleLimits } from '../services/configService';

interface AdvancedImageControlsProps {
  negativePrompt: string;
  guidanceScale: number;
  selectedLoRA: string | null;
  loraStrength: number;
  selectedSteeringImage: string | null;
  onNegativePromptChange: (value: string) => void;
  onGuidanceScaleChange: (value: number) => void;
  onLoRAChange: (loraType: string | null) => void;
  onLoRAStrengthChange: (strength: number) => void;
  onSteeringImageChange: (imagePath: string | null) => void;
  defaultNegativePrompt?: string;
  defaultGuidanceScale?: number;
}

const AdvancedImageControls: React.FC<AdvancedImageControlsProps> = ({
  negativePrompt,
  guidanceScale,
  selectedLoRA,
  loraStrength,
  selectedSteeringImage,
  onNegativePromptChange,
  onGuidanceScaleChange,
  onLoRAChange,
  onLoRAStrengthChange,
  onSteeringImageChange,
  defaultNegativePrompt = getDefaultNegativePrompt(),
  defaultGuidanceScale = getDefaultGuidanceScale(),
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const guidanceLimits = getGuidanceScaleLimits();
  const handleNegativePromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onNegativePromptChange(event.target.value);
  };

  const handleGuidanceScaleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value);
    onGuidanceScaleChange(value);
  };

  const resetToDefaults = () => {
    onNegativePromptChange(defaultNegativePrompt);
    onGuidanceScaleChange(defaultGuidanceScale);
    onLoRAChange(null);
    onLoRAStrengthChange(DEFAULT_LORA_STRENGTH);
    onSteeringImageChange(null);
  };

  return (
    <div className="border rounded-lg bg-gray-50 dark:bg-gray-800/50">
      <div className="flex items-center justify-between p-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <span className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
          Advanced Controls
        </button>
        {isExpanded && (
          <button
            onClick={resetToDefaults}
            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
          >
            Reset to defaults
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="space-y-4 px-3 pb-3 border-t border-gray-200 dark:border-gray-600">
          {/* Steering Image */}
          <div className="pt-3">
            <SteeringImageDropdown
              value={selectedSteeringImage}
              onChange={onSteeringImageChange}
            />
          </div>

          {/* Negative Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Negative Prompt
            </label>
            <textarea
              value={negativePrompt}
              onChange={handleNegativePromptChange}
              placeholder={defaultNegativePrompt}
              rows={2}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Describe what you don't want to see in the image (e.g., "blurry, low quality, text, watermark")
            </p>
          </div>

          {/* Guidance Scale */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Guidance Scale
              </label>
              <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                {guidanceScale.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min={guidanceLimits.min}
              max={guidanceLimits.max}
              step={guidanceLimits.step}
              value={guidanceScale}
              onChange={handleGuidanceScaleChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 slider"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>{guidanceLimits.min} (Creative)</span>
              <span>{guidanceLimits.max} (Precise)</span>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Higher values follow the prompt more closely but may reduce creativity
            </p>
          </div>

          {/* LoRA Model Selection */}
          <LoRASelector
            selectedLoRA={selectedLoRA}
            loraStrength={loraStrength}
            onLoRAChange={onLoRAChange}
            onStrengthChange={onLoRAStrengthChange}
          />

          <style>{`
            .slider::-webkit-slider-thumb {
              appearance: none;
              height: 16px;
              width: 16px;
              border-radius: 50%;
              background: #3b82f6;
              cursor: pointer;
              border: 2px solid white;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }
            
            .slider::-moz-range-thumb {
              height: 16px;
              width: 16px;
              border-radius: 50%;
              background: #3b82f6;
              cursor: pointer;
              border: 2px solid white;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }
            
            .slider::-webkit-slider-track {
              height: 8px;
              background: linear-gradient(to right, #10b981, #3b82f6, #8b5cf6);
              border-radius: 4px;
            }
            
            .slider::-moz-range-track {
              height: 8px;
              background: linear-gradient(to right, #10b981, #3b82f6, #8b5cf6);
              border-radius: 4px;
            }
          `}</style>
        </div>
      )}
    </div>
  );
};

export default AdvancedImageControls;