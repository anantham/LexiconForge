
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
    const apiKey = settings.apiKeyGemini;
    if (!apiKey) {
        throw new Error("Gemini API key is missing. Cannot generate images.");
    }

    const imageModel = settings.imageModel || 'gemini-1.5-flash';
    console.log(`[ImageService] Generating image with model: ${imageModel}`);
    const startTime = performance.now();
    
    try {
        const ai = new GoogleGenAI({ apiKey });
        let base64Data: string;

        // Use the appropriate API based on the model name
        if (imageModel.startsWith('imagen')) {
            // This path is for dedicated Imagen models, using a different API method
            const response = await ai.models.generateImages({
                model: imageModel,
                prompt: prompt,
                // Assuming a similar config structure to the user's Python snippet
                config: { number_of_images: 1 },
            });

            // Assuming the response structure is an array of generated images
            const firstImage = response.generated_images?.[0];
            if (!firstImage || !firstImage.image_data) {
                console.error("[ImageService/Imagen] Unexpected response structure:", JSON.stringify(response, null, 2));
                throw new Error("Failed to receive valid image data from Imagen API.");
            }
            base64Data = firstImage.image_data as string;

        } else {
            // This path is for multimodal Gemini models
            const response = await ai.models.generateContent({
                model: imageModel,
                contents: [{
                    role: 'user',
                    parts: [
                        { text: prompt },
                        { text: "Please generate this image in a dark, atmospheric, and highly detailed anime/manga style." }
                    ]
                }],
                generationConfig: {
                    responseMimeType: 'image/png',
                }
            });

            const imagePart = response.response.candidates?.[0].content.parts[0];
            if (!imagePart || !('inlineData' in imagePart)) {
                console.error("[ImageService/Gemini] Unexpected response structure:", JSON.stringify(response.response, null, 2));
                throw new Error("Failed to receive valid image data from Gemini API.");
            }
            base64Data = imagePart.inlineData.data;
        }

        const requestTime = (performance.now() - startTime) / 1000; // in seconds

        console.log(`[ImageService] Successfully received image data in ${requestTime.toFixed(2)}s.`);
        return {
            imageData: `data:image/png;base64,${base64Data}`,
            requestTime,
            cost: 0 // Image generation is currently free for these models
        };

    } catch (error: any) {
        console.error(`[ImageService] Image generation failed for prompt: "${prompt}"`, error);
        const message = error.message?.includes('API key') 
            ? 'Invalid Gemini API key.' 
            : `Image generation failed. ${error.message || ''}`;
        throw new Error(message);
    }
};
