
import { GoogleGenAI } from '@google/genai';
import { AppSettings, GeneratedImageResult } from '../types';
import { IMAGE_COSTS } from '../costs';

// --- CONSTANTS ---
// Using a cutting-edge model known for high-quality image generation.
// This could be parameterized in settings later if needed.
const IMAGE_MODEL = 'gemini-1.5-flash';

// --- IMAGE COST CALCULATION ---

/**
 * Calculates the cost for generating one image with the specified model
 * @param model The image model ID
 * @returns Cost in USD for one image
 */
export const calculateImageCost = (model: string): number => {
    return IMAGE_COSTS[model] || 0;
};

// --- IMAGE GENERATION SERVICE ---

/**
 * Generates an image from a text prompt using the Gemini Image API.
 *
 * @param prompt The detailed text prompt for the image.
 * @param settings The current application settings containing the API key.
 * @returns A base64 encoded string of the generated PNG image with cost.
 * @throws An error if the API key is missing or if the image generation fails.
 */
export const generateImage = async (prompt: string, settings: AppSettings): Promise<GeneratedImageResult> => {
    const apiKey = settings.apiKeyGemini;
    if (!apiKey) {
        throw new Error("Gemini API key is missing. Cannot generate images.");
    }

    const imageModel = settings.imageModel || 'imagen-3.0-generate-001';
    console.log(`[ImageService] Starting image generation...`);
    console.log(`[ImageService] - Model: ${imageModel}`);
    console.log(`[ImageService] - Prompt: ${prompt.substring(0, 100)}...`);
    console.log(`[ImageService] - API Key present: ${!!apiKey}`);
    
    const startTime = performance.now();
    
    try {
        const ai = new GoogleGenAI({ apiKey });
        let base64Data: string;

        if (imageModel.startsWith('imagen')) {
            console.log('[ImageService] Using Imagen model:', imageModel);
            const response = await ai.models.generateImages({
                model: imageModel,
                prompt: `${prompt}. Please generate this image in a dark, atmospheric, and highly detailed anime/manga style.`,
                config: {
                    numberOfImages: 1,
                },
            });

            if (!response.generated_images || response.generated_images.length === 0) {
                console.error("[ImageService/Imagen] Unexpected response structure or empty image list:", response);
                throw new Error("Failed to receive valid image data from Imagen API. The prompt may have been blocked by safety filters.");
            }
            base64Data = response.generated_images[0].image;

        } else if (imageModel.startsWith('gemini')) {
            console.log('[ImageService] Using Gemini native image generation:', imageModel);
            const model = ai.getGenerativeModel({ model: imageModel });
            
            const result = await model.generateContent(prompt);
            const response = await result.response;

            let foundImageData = null;
            const parts = response.candidates?.[0]?.content?.parts || [];
            for (const part of parts) {
                if (part.inlineData) {
                    foundImageData = part.inlineData.data;
                    break;
                }
            }
            
            if (!foundImageData) {
                console.error("[ImageService/Gemini] No image data found in response:", response);
                throw new Error("Failed to receive valid image data from Gemini API.");
            }
            base64Data = foundImageData;
            
        } else {
            console.error(`[ImageService] Unrecognized model: ${imageModel}`);
            throw new Error(`Unrecognized image model: ${imageModel}.`);
        }

        const requestTime = (performance.now() - startTime) / 1000; // in seconds
        const cost = calculateImageCost(imageModel);

        console.log(`[ImageService] Successfully received image data in ${requestTime.toFixed(2)}s. Cost: ${cost.toFixed(5)}`);
        return {
            imageData: `data:image/png;base64,${base64Data}`,
            requestTime,
            cost
        };

    } catch (error: any) {
        console.error(`[ImageService] Image generation failed for prompt: "${prompt}"`, error);
        const message = error.message?.includes('API key') 
            ? 'Invalid Gemini API key.' 
            : `Image generation failed. ${error.message || ''}`;
        throw new Error(message);
    }
};
