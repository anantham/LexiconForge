/**
 * ImageGenerationSection - Image dimensions and preset controls
 *
 * Extracted from AdvancedPanel for better separation of concerns.
 */

import React from 'react';
import type { AppSettings } from '../../types';

interface ImageGenerationSectionProps {
  imageWidth: number;
  imageHeight: number;
  imageAspectRatio: string;
  imageSizePreset: string;
  onImageWidthChange: (value: number) => void;
  onImageHeightChange: (value: number) => void;
  onAspectRatioChange: (value: string) => void;
  onSizePresetChange: (value: string) => void;
  onApplyPreset: () => void;
}

export const ImageGenerationSection: React.FC<ImageGenerationSectionProps> = ({
  imageWidth,
  imageHeight,
  imageAspectRatio,
  imageSizePreset,
  onImageWidthChange,
  onImageHeightChange,
  onAspectRatioChange,
  onSizePresetChange,
  onApplyPreset,
}) => {
  return (
    <fieldset>
      <legend className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3 border-b border-gray-200 dark:border-gray-700 pb-1">
        Image Generation
      </legend>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="imageWidth" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Image Width (px)
          </label>
          <input
            id="imageWidth"
            type="number"
            min={256}
            max={2048}
            step={64}
            value={imageWidth}
            onChange={(e) =>
              onImageWidthChange(Math.max(256, Math.min(2048, parseInt(e.target.value || '1024', 10))))
            }
            className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div>
          <label htmlFor="imageHeight" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Image Height (px)
          </label>
          <input
            id="imageHeight"
            type="number"
            min={256}
            max={2048}
            step={64}
            value={imageHeight}
            onChange={(e) =>
              onImageHeightChange(Math.max(256, Math.min(2048, parseInt(e.target.value || '1024', 10))))
            }
            className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Aspect Ratio</label>
          <select
            value={imageAspectRatio}
            onChange={(e) => onAspectRatioChange(e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white"
          >
            <option value="1:1">1:1 (Square)</option>
            <option value="3:4">3:4 (Portrait)</option>
            <option value="4:3">4:3 (Landscape)</option>
            <option value="16:9">16:9 (Widescreen)</option>
            <option value="9:16">9:16 (Vertical video)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Size Preset</label>
          <div className="flex items-center gap-2">
            <select
              value={imageSizePreset}
              onChange={(e) => onSizePresetChange(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white"
            >
              <option value="512">512px (legacy)</option>
              <option value="768">768px (legacy HD)</option>
              <option value="1K">1K (Default)</option>
              <option value="2K">2K (High detail)</option>
              <option value="CUSTOM">Custom</option>
            </select>
            <button
              type="button"
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
              onClick={onApplyPreset}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </fieldset>
  );
};

export default ImageGenerationSection;
