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
