/**
 * Configuration service for reading app.json settings
 */

import appConfig from '../config/app.json';

export interface ImageGenerationConfig {
  defaults: {
    negativePrompt: string;
    guidanceScale: number;
    loraStrength: number;
  };
  limits: {
    guidanceScale: { min: number; max: number; step: number };
    loraStrength: { min: number; max: number; step: number };
  };
  descriptions: {
    negativePrompt: string;
    guidanceScale: string;
    loraStrength: string;
  };
  negativePromptSuggestions: string[];
}

export interface AppConfig {
  footnoteStrictMode: string;
  openrouter: {
    referer: string;
    title: string;
  };
  app: {
    name: string;
    version: string;
    description: string;
  };
  aiParameters: {
    defaults: Record<string, any>;
    limits: Record<string, any>;
    descriptions: Record<string, string>;
  };
  imageGeneration: ImageGenerationConfig;
}

/**
 * Get the complete application configuration
 */
export const getAppConfig = (): AppConfig => {
  return appConfig as AppConfig;
};

/**
 * Get image generation configuration
 */
export const getImageConfig = (): ImageGenerationConfig => {
  return appConfig.imageGeneration as ImageGenerationConfig;
};

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

/**
 * Get negative prompt suggestions from config
 */
export const getNegativePromptSuggestions = (): string[] => {
  return appConfig.imageGeneration?.negativePromptSuggestions || [
    'low quality, blurry, distorted, text, watermark'
  ];
};