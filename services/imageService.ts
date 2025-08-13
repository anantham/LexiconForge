
import { GoogleGenAI } from '@google/genai';
import { AppSettings, GeneratedImageResult } from '../types';

// --- CONSTANTS ---
// Using a cutting-edge model known for high-quality image generation.
// This could be parameterized in settings later if needed.
const IMAGE_MODEL = 'gemini-1.5-flash'; 

// --- IMAGE GENERATION SERVICE ---

/**
 * Generates an image from a text prompt using the Gemini Image API.
 *
 * @param prompt The detailed text prompt for the image.
 * @param settings The current application settings containing the API key.
 * @returns A base64 encoded string of the generated PNG image.
 * @throws An error if the API key is missing or if the image generation fails.
 */
export const generateImage = async (prompt: string, settings: AppSettings): Promise<GeneratedImageResult> => {
    const apiKey = settings.apiKeyGemini || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined);
    if (!apiKey) {
        throw new Error("Gemini API key is missing. Cannot generate images.");
    }

    console.log(`[ImageService] Generating image with model: ${IMAGE_MODEL}`);
    const startTime = performance.now();
    
    try {
        const ai = new GoogleGenAI({ apiKey });
        const imageModel = ai.getGenerativeModel({ model: IMAGE_MODEL });

        const response = await imageModel.generateContent([
            prompt, 
            "Please generate this image in a dark, atmospheric, and highly detailed anime/manga style."
        ]);

        // The new Gemini API returns a different response structure.
        // We need to access the function call result to get the image data.
        const result = await response.response;
        const call = result.functionCalls?.[0];

        if (!call || call.name !== 'tools.display_image' || !call.args.image_data) {
            console.error("[ImageService] Unexpected response structure:", JSON.stringify(result, null, 2));
            throw new Error("Failed to receive valid image data from the API.");
        }
        
        // The image_data is already in base64 format.
        const base64Data = call.args.image_data as string;
        const requestTime = (performance.now() - startTime) / 1000; // in seconds

        console.log(`[ImageService] Successfully received image data in ${requestTime.toFixed(2)}s.`);
        return {
            imageData: `data:image/png;base64,${base64Data}`,
            requestTime,
            cost: 0 // Gemini 1.5 Flash image generation is currently free
        };

    } catch (error: any) {
        console.error(`[ImageService] Image generation failed for prompt: "${prompt}"`, error);
        // Provide a more user-friendly error message
        const message = error.message?.includes('API key') 
            ? 'Invalid Gemini API key.' 
            : `Image generation failed. ${error.message || ''}`;
        throw new Error(message);
    }
};
