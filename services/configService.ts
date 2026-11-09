/**
 * Configuration service for reading app.json settings
 */

import appConfig from '../config/app.json';

/**
 * Get default negative prompt from config
 */
export const getDefaultNegativePrompt = (): string => {
  return appConfig.imageGeneration?.defaults?.negativePrompt || 'low quality, blurry, distorted, text, watermark';
};

/**
 * Get default guidance scale from config
 */
export const getDefaultGuidanceScale = (): number => {
  return appConfig.imageGeneration?.defaults?.guidanceScale || 3.5;
};

/**
 * Get default LoRA strength from config
 */
export const getDefaultLoRAStrength = (): number => {
  return appConfig.imageGeneration?.defaults?.loraStrength || 0.8;
};

/**
 * Get guidance scale limits from config
 */
export const getGuidanceScaleLimits = () => {
  const limits = appConfig.imageGeneration?.limits?.guidanceScale;
  return {
    min: limits?.min || 1.5,
    max: limits?.max || 5.0,
    step: limits?.step || 0.1
  };
};

/**
 * Get LoRA strength limits from config
 */
export const getLoRAStrengthLimits = () => {
  const limits = appConfig.imageGeneration?.limits?.loraStrength;
  return {
    min: limits?.min || 0.1,
    max: limits?.max || 2.0,
    step: limits?.step || 0.1
  };
};
