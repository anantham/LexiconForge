/**
 * Converts an image file to base64 format using HTTP fetch
 * Works with both local file paths and HTTP URLs
 * @param imagePath Full path to the image file or HTTP URL
 * @returns Base64 encoded string with data URL format
 */
export const imageFileToBase64 = async (imagePath: string): Promise<string> => {
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
    
    const blob = await response.blob();
    
    // Convert blob to base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = () => reject(new Error('Failed to convert blob to base64'));
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    throw new Error(`Failed to convert image to base64: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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
 * Gets list of available steering images from the public/steering directory
 * @param steeringDir Path to steering images directory (ignored, uses /steering/)
 * @returns Array of image filenames
 */
export const getSteeringImages = async (steeringDir?: string): Promise<string[]> => {
  // Return the known list of steering images available in public/steering/
  // These correspond to the files moved to public/steering/
  return ['hypno.jpg', 'train.jpg', 'waitinginline.jpg', 'white.jpg'];
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