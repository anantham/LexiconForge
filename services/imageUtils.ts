/**
 * Resizes an image to fit within maximum dimensions while maintaining aspect ratio
 * @param imageBlob The image blob to resize
 * @param maxWidth Maximum width (default: 1024)
 * @param maxHeight Maximum height (default: 2048) 
 * @param quality JPEG quality (0-1, default: 0.9)
 * @returns Resized image blob
 */
export const resizeImage = async (
  imageBlob: Blob, 
  maxWidth: number = 1024, 
  maxHeight: number = 2048, 
  quality: number = 0.9
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }
    
    img.onload = () => {
      // Calculate new dimensions while maintaining aspect ratio
      let { width, height } = img;
      
      // Check for invalid dimensions
      if (width <= 0 || height <= 0) {
        reject(new Error(`Invalid image dimensions: ${width}x${height}`));
        return;
      }
      
      if (width <= maxWidth && height <= maxHeight) {
        // Image is already within limits, return original
        console.log(`[ImageUtils] Image within limits: ${width}x${height}, no resizing needed`);
        resolve(imageBlob);
        return;
      }
      
      // Calculate scaling factor
      const widthRatio = maxWidth / width;
      const heightRatio = maxHeight / height;
      const scale = Math.min(widthRatio, heightRatio);
      
      const newWidth = Math.floor(width * scale);
      const newHeight = Math.floor(height * scale);
      
      // Set canvas dimensions
      canvas.width = newWidth;
      canvas.height = newHeight;
      
      // Draw resized image
      ctx.drawImage(img, 0, 0, newWidth, newHeight);
      
      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            console.log(`[ImageUtils] Resized image: ${width}x${height} -> ${newWidth}x${newHeight} (${(blob.size / 1024).toFixed(1)}KB)`);
            resolve(blob);
          } else {
            reject(new Error('Failed to create resized blob'));
          }
        },
        'image/jpeg',
        quality
      );
    };
    
    const imageUrl = URL.createObjectURL(imageBlob);
    
    const cleanup = () => URL.revokeObjectURL(imageUrl);
    
    img.onerror = () => {
      cleanup();
      reject(new Error('Failed to load image for resizing'));
    };
    
    // Store original onload handler
    const originalOnload = img.onload;
    img.onload = () => {
      try {
        originalOnload?.();
      } finally {
        cleanup();
      }
    };
    
    img.src = imageUrl;
  });
};

/**
 * Converts an image file to base64 format using HTTP fetch
 * Automatically resizes images that exceed PiAPI limits (1024x2048)
 * Works with both local file paths and HTTP URLs
 * @param imagePath Full path to the image file or HTTP URL
 * @param maxWidth Maximum width for PiAPI (default: 1024)
 * @param maxHeight Maximum height for PiAPI (default: 2048)
 * @returns Base64 encoded string with data URL format
 */
export const imageFileToBase64 = async (
  imagePath: string, 
  maxWidth: number = 1024, 
  maxHeight: number = 2048
): Promise<string> => {
  try {
    // Convert local file path to HTTP URL if needed
    let imageUrl = imagePath;
    if (!imagePath.startsWith('http') && !imagePath.startsWith('/')) {
      // Convert local path to HTTP URL
      const filename = imagePath.substring(imagePath.lastIndexOf('/') + 1);
      imageUrl = `/steering/${filename}`;
    } else if (imagePath.startsWith('/Users/') || imagePath.includes('data/Illustrations/steering')) {
      // Convert absolute local path to HTTP URL
      const filename = imagePath.substring(imagePath.lastIndexOf('/') + 1);
      imageUrl = `/steering/${filename}`;
    }
    
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    
    const originalBlob = await response.blob();
    
    // Resize image if it exceeds API limits
    const resizedBlob = await resizeImage(originalBlob, maxWidth, maxHeight);
    
    // Convert blob to base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = () => reject(new Error('Failed to convert blob to base64'));
      reader.readAsDataURL(resizedBlob);
    });
  } catch (error) {
    throw new Error(`Failed to convert image to base64: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Convert a Blob to a base64 data URL string.
 * Shared utility so callers avoid duplicating FileReader code.
 */
export const blobToBase64DataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = () => reject(new Error('Failed to convert blob to base64 data URL'));
    reader.readAsDataURL(blob);
  });
};

/**
 * Gets MIME type from file extension
 * @param filePath Path to the file
 * @returns MIME type string
 */
const getMimeTypeFromExtension = (filePath: string): string => {
  const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.bmp':
      return 'image/bmp';
    default:
      return 'image/jpeg'; // Default fallback
  }
};

/**
 * Gets list of available steering images by fetching the manifest JSON file.
 * @returns Array of image filenames
 */
export const getSteeringImages = async (): Promise<string[]> => {
  try {
    const response = await fetch('/steering-images.json');
    if (!response.ok) {
      console.error('Failed to fetch steering images manifest:', response.statusText);
      return [];
    }
    const imageList = await response.json();
    return imageList;
  } catch (error) {
    console.error('Error fetching or parsing steering images manifest:', error);
    return [];
  }
};

/**
 * Validates if an image file exists and is accessible via HTTP
 * @param imagePath Full path to the image file or filename
 * @returns Boolean indicating if file is valid
 */
export const validateImageFile = async (imagePath: string): Promise<boolean> => {
  try {
    // Convert to HTTP URL if needed
    let imageUrl = imagePath;
    if (!imagePath.startsWith('http') && !imagePath.startsWith('/')) {
      const filename = imagePath.substring(imagePath.lastIndexOf('/') + 1);
      imageUrl = `/steering/${filename}`;
    }
    
    const response = await fetch(imageUrl, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
};
