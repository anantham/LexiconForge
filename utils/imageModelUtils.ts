/**
 * Utility functions for image model detection and capabilities
 */

/**
 * Checks if the given image model is a Flux model that supports advanced features
 * like LoRA models, steering images, negative prompts, and guidance scale
 */
export const isFluxModel = (imageModel: string): boolean => {
  return imageModel.startsWith('Qubico/flux');
};

/**
 * Checks if the given image model supports img2img (steering images)
 */
export const supportsImg2Img = (imageModel: string): boolean => {
  return isFluxModel(imageModel);
};

/**
 * Checks if the given image model supports LoRA models
 */
export const supportsLoRA = (imageModel: string): boolean => {
  return isFluxModel(imageModel);
};

/**
 * Checks if the given image model supports negative prompts
 */
export const supportsNegativePrompt = (imageModel: string): boolean => {
  return isFluxModel(imageModel);
};

/**
 * Checks if the given image model supports guidance scale parameter
 */
export const supportsGuidanceScale = (imageModel: string): boolean => {
  return isFluxModel(imageModel);
};