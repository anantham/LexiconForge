import React, { useState, useEffect } from 'react';
import { getSteeringImages } from '../services/imageUtils';

interface SteeringImageDropdownProps {
  value?: string;
  onChange: (imagePath: string | null) => void;
}

const SteeringImageDropdown: React.FC<SteeringImageDropdownProps> = ({
  value,
  onChange
}) => {
  const [images, setImages] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadImages = async () => {
      try {
        const imageList = await getSteeringImages();
        setImages(imageList);
      } catch (error) {
        console.error('Failed to load steering images:', error);
      }
    };
    loadImages();
  }, []);

  useEffect(() => {
    const loadPreview = async () => {
      if (!value) {
        setPreviewImage(null);
        return;
      }

      try {
        setIsLoading(true);
        // Load image preview from HTTP URL
        const imageUrl = `/steering/${value}`;
        
        // Try to load the image to verify it exists and can be displayed
        const img = new Image();
        img.onload = () => {
          setPreviewImage(imageUrl);
          setIsLoading(false);
        };
        img.onerror = () => {
          console.error(`Failed to load steering image preview: ${imageUrl}`);
          setPreviewImage(null);
          setIsLoading(false);
        };
        img.src = imageUrl;
      } catch (error) {
        console.error('Failed to load image preview:', error);
        setPreviewImage(null);
        setIsLoading(false);
      }
    };

    loadPreview();
  }, [value]);

  const handleSelectionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = event.target.value;
    if (selectedValue === '') {
      onChange(null);
    } else {
      onChange(selectedValue);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Steering Image (Optional)
        </label>
        <select
          value={value || ''}
          onChange={handleSelectionChange}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">None (Text-to-Image)</option>
          {images.map((image) => (
            <option key={image} value={image}>
              {image.replace(/\.[^/.]+$/, '')} {/* Remove file extension for display */}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Select an image to use as guidance for img2img generation, or leave as "None" for standard text-to-image
        </p>
      </div>

      {/* Preview */}
      {value && (
        <div className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-800/50">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Selected Image:</p>
          {isLoading ? (
            <div className="flex items-center justify-center h-24 bg-gray-200 dark:bg-gray-700 rounded">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : previewImage ? (
            <img
              src={previewImage}
              alt={`Steering image: ${value}`}
              className="max-w-full h-auto max-h-32 object-contain rounded border"
            />
          ) : (
            <div className="flex items-center justify-center h-24 bg-gray-200 dark:bg-gray-700 rounded text-gray-500 text-sm">
              <div className="text-center">
                <p className="font-medium">{value}</p>
                <p className="text-xs mt-1">Preview not available</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SteeringImageDropdown;
