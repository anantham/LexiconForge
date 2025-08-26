
import { GoogleGenAI } from '@google/genai';
import { GoogleGenerativeAI } from '@google/generative-ai';
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
    const imageModel = settings.imageModel || 'imagen-3.0-generate-001';
    const reqW = Math.max(256, Math.min(4096, (settings.imageWidth || 1024)));
    const reqH = Math.max(256, Math.min(4096, (settings.imageHeight || 1024)));
    let piW = reqW, piH = reqH;
    const maxPix = 1048576;
    if (piW * piH > maxPix) {
        const scale = Math.sqrt(maxPix / (piW * piH));
        piW = Math.max(256, Math.floor(piW * scale));
        piH = Math.max(256, Math.floor(piH * scale));
    }
    console.log(`[ImageService] Starting image generation...`);
    console.log(`[ImageService] - Model: ${imageModel}`);
    console.log(`[ImageService] - Prompt: ${prompt.substring(0, 100)}...`);
    const hasKey = imageModel.startsWith('Qubico/') ? !!settings.apiKeyPiAPI : !!settings.apiKeyGemini;
    console.log(`[ImageService] - API Key present: ${hasKey}`);
    
    const startTime = performance.now();
    
    try {
        let base64Data: string;

        if (imageModel.startsWith('imagen')) {
            console.log('[ImageService] Using Imagen model:', imageModel);
            const apiKey = settings.apiKeyGemini; if (!apiKey) throw new Error('Gemini API key is missing. Cannot generate images with Imagen.');
            const ai = new GoogleGenAI({ apiKey });
            let response: any;
            if (imageModel.startsWith('imagen-4.0')) {
                // Map to Imagen 4 parameters when available
                const ratioVal = reqW/reqH;
                const ratios = [1/1, 3/4, 4/3, 9/16, 16/9];
                const labels = ['1:1','3:4','4:3','9:16','16:9'];
                let bestIdx = 0, bestDiff = Infinity;
                ratios.forEach((r,i)=>{ const d=Math.abs(r - ratioVal); if (d < bestDiff) { bestDiff = d; bestIdx = i; } });
                const aspectLabel = labels[bestIdx];
                const sampleImageSize = (Math.max(reqW, reqH) >= 1536) ? '2K' : '1K';
                response = await ai.models.generateImages({
                    model: imageModel,
                    prompt: `${prompt}. Target size ~${reqW}x${reqH}. Please generate this image in a dark, atmospheric, and highly detailed anime/manga style.`,
                    config: {
                        numberOfImages: 1,
                        sampleImageSize: sampleImageSize,
                        aspectRatio: aspectLabel,
                    } as any,
                });
            } else {
                response = await ai.models.generateImages({
                    model: imageModel,
                    prompt: `${prompt}. Target size ~${reqW}x${reqH}. Please generate this image in a dark, atmospheric, and highly detailed anime/manga style.`,
                    config: {
                        numberOfImages: 1,
                    },
                });
            }

            console.log('[ImageService/Imagen] Full API Response:', JSON.stringify(response, null, 2));

            if (!response.generatedImages || response.generatedImages.length === 0 || !response.generatedImages[0].image?.imageBytes) {
                console.error("[ImageService/Imagen] Unexpected response structure or empty image list:", response);
                throw new Error("Failed to receive valid image data from Imagen API. The prompt may have been blocked by safety filters.");
            }
            base64Data = response.generatedImages[0].image.imageBytes;

        } else if (imageModel.startsWith('gemini')) {
            console.log('[ImageService] Using Gemini native image generation:', imageModel);
            const apiKey = settings.apiKeyGemini; if (!apiKey) throw new Error('Gemini API key is missing. Cannot generate images with Gemini.');
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: imageModel });
            try {
                const result = await model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: `Generate an image based on this description: ${prompt}. Target size approximately ${reqW}x${reqH} with a matching aspect ratio. Style: dark, atmospheric, highly detailed.` }]}]
                });
                const response = result.response;
                let foundImageData = null as string | null;
                const parts = response.candidates?.[0]?.content?.parts || [];
                for (const part of parts) {
                    if (part.inlineData?.data) {
                        foundImageData = part.inlineData.data;
                        break;
                    }
                }
                if (!foundImageData) {
                    console.error("[ImageService/Gemini] No image data found in response:", JSON.stringify(response, null, 2));
                    throw new Error("Failed to receive valid image data from Gemini API. The model may not support image generation or the prompt was rejected.");
                }
                base64Data = foundImageData;
            } catch (err: any) {
                // Rich diagnostics for debugging (no auto-fallback)
                try {
                    console.error('[ImageService/Gemini] generateContent error (object):', err);
                    if (err?.cause) console.error('[ImageService/Gemini] error.cause:', err.cause);
                    const causeMsg = (err?.cause && err.cause.message) ? String(err.cause.message) : '';
                    const msg = String(err?.message || '');
                    console.error('[ImageService/Gemini] error.message:', msg);
                    if (causeMsg) console.error('[ImageService/Gemini] error.cause.message:', causeMsg);
                } catch {}

                // Re-throw with guidance for the reader to choose a different model
                const guidance = 'This Gemini image model rejected the request due to response modality/mime constraints or safety. Try switching to "Gemini 2.5 Flash (Image Preview)" or "Imagen 3.0/4.0" in Settings, then click Retry.';
                const enhanced = new Error(`${err?.message || 'Image generation failed'}. ${guidance}`) as any;
                enhanced.errorType = /response_mime_type|requested combination of response modalities/i.test(String(err?.message || '') + String(err?.cause?.message || ''))
                    ? 'MODALITY_MISMATCH'
                    : 'GENERIC_ERROR';
                enhanced.originalError = err;
                enhanced.canRetry = false;
                enhanced.suggestedActions = [
                  'Open Settings → Image model and pick Imagen 3.0 or Gemini 2.5 Image Preview',
                  'Simplify the prompt (less graphic detail) and Retry'
                ];
                throw enhanced;
            }
            
        
        } else if (imageModel.startsWith('Qubico/')) {
            // --- PiAPI Flux (task-based) ---
            const apiKeyPi = settings.apiKeyPiAPI;
            if (!apiKeyPi) throw new Error('PiAPI API key is missing. Please add it in Settings.');

            // Normalize model/task_type pairing: txt2img does not need advanced
            const isAdvanced = imageModel === 'Qubico/flux1-dev-advanced';
            const taskType = 'txt2img';
            const modelForTask = (isAdvanced && taskType === 'txt2img') ? 'Qubico/flux1-dev' : imageModel;

            // 1) CREATE TASK
            const createResp = await fetch('https://api.piapi.ai/api/v1/task', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKeyPi,
                    'Authorization': `Bearer ${apiKeyPi}`,
                },
                body: JSON.stringify({
                    model: modelForTask,
                    task_type: taskType,
                    input: { prompt, width: piW, height: piH },
                    // service_mode: 'public', // optional
                }),
            });
            const rawCreateText = await createResp.text().catch(() => '');
            let created: any = {};
            try { created = rawCreateText ? JSON.parse(rawCreateText) : {}; } catch {}

            // Non-2xx? Show server text verbatim.
            if (!createResp.ok) {
                throw new Error(`PiAPI create-task failed (${createResp.status}): ${rawCreateText || '<no body>'}`);
            }

            // Success wrappers that still carry an error or code
            if ((created && created.error) || (typeof created.code === 'number' && created.code >= 400)) {
                const msg = created?.error?.message || created?.message || 'Unknown PiAPI error';
                throw new Error(`PiAPI create-task returned error: ${msg}\nBody: ${rawCreateText}`);
            }

            // Extract task id robustly
            const taskId = extractTaskId(created);
            if (!taskId) {
                console.warn('[PiAPI] Unexpected create response (first 500 chars):', rawCreateText.slice(0, 500));
                throw new Error('PiAPI: missing task id in create response.');
            }

            // 2) POLL TASK
            let taskData: any = null;
            for (let tries = 0; tries < 60; tries++) { // up to ~60s
                const poll = await fetch(`https://api.piapi.ai/api/v1/task/${taskId}`, {
                    headers: {
                        'X-API-Key': apiKeyPi,
                        'Authorization': `Bearer ${apiKeyPi}`,
                    },
                });
                const raw = await poll.text().catch(() => '');
                let json: any = {};
                try { json = raw ? JSON.parse(raw) : {}; } catch {}
                if (!poll.ok) throw new Error(`PiAPI get-task failed (${poll.status}): ${raw}`);
                // Some envelopes put status in different places
                const status = String(json.status || json.state || json.data?.status || json.data?.state || '').toLowerCase();
                if ((json && json.error) || (typeof json.code === 'number' && json.code >= 400)) {
                    const msg = json?.error?.message || json?.message || 'Unknown PiAPI polling error';
                    throw new Error(`PiAPI get-task returned error: ${msg}\nBody: ${raw}`);
                }
                if (/succeeded|completed|success/.test(status)) { taskData = json; break; }
                if (/failed|error/.test(status)) throw new Error(`PiAPI task failed: ${raw || JSON.stringify(json)}`);
                await new Promise(r => setTimeout(r, 1000));
            }
            if (!taskData) throw new Error('PiAPI: task did not complete in time.');

            // 3) EXTRACT IMAGE
            let b64 = extractPiAPIBase64(taskData);
            if (!b64) {
                // Some responses provide only a temporary image_url
                const imgUrl = extractPiAPIImageUrl(taskData);
                if (imgUrl) {
                    try {
                        b64 = await fetchImageAsBase64(imgUrl);
                    } catch (e: any) {
                        console.error('[ImageService/PiAPI] Failed to fetch image_url:', imgUrl, e);
                        throw new Error(`PiAPI task returned an image_url but it could not be fetched (possible CORS or network issue). URL: ${imgUrl}`);
                    }
                }
            }
            if (!b64) {
                console.error('[ImageService/PiAPI] Unexpected task response:', taskData);
                throw new Error('PiAPI task completed but no image payload found.');
            }
            base64Data = b64;
        }
 else {
            console.error(`[ImageService] Unrecognized model: ${imageModel}`);
            throw new Error(`Unrecognized image model: ${imageModel}. Supported prefixes: imagen, gemini.`);
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
        
        // Enhanced error handling with specific detection for common issues
        let message = error.message || 'Unknown error occurred';
        let errorType = 'GENERIC_ERROR';
        
        if (message.includes('API key')) {
            errorType = 'INVALID_API_KEY';
            message = imageModel.startsWith('Qubico/') ? 'Invalid PiAPI API key. Please check your API key in Settings.' : 'Invalid Gemini API key. Please check your API key in Settings.';
        } else if (message.includes('safety') || message.includes('Responsible AI practices')) {
            errorType = 'SAFETY_FILTER';
            message = `Content blocked by safety filters. Try rephrasing the prompt or using a different model (Imagen 3/4 may be more permissive).`;
        } else if (message.includes('quota') || message.includes('rate limit')) {
            errorType = 'RATE_LIMIT';
            message = 'API rate limit exceeded. Please wait a moment and try again.';
        } else if (message.includes('model not found') || message.includes('does not exist')) {
            errorType = 'MODEL_NOT_FOUND';
            message = `Model "${imageModel}" not found. Please select a different image model in settings.`;
        } else if (message.includes('not support image generation')) {
            errorType = 'MODEL_NO_IMAGE_SUPPORT';
            message = `Model "${imageModel}" does not support image generation. Try Imagen 3.0 or 4.0 instead.`;
        } else {
            message = `Image generation failed: ${message}`;
        }
        
        // Add error metadata for fallback logic
        const enhancedError = new Error(message) as any;
        enhancedError.errorType = errorType;
        enhancedError.originalError = error;
        enhancedError.model = imageModel;
        enhancedError.canRetry = ['RATE_LIMIT', 'SAFETY_FILTER'].includes(errorType);
        enhancedError.suggestedActions = getSuggestedActions(errorType, imageModel);
        
        throw enhancedError;
    }
}

/**
 * Get suggested actions based on error type and model
 */
function getSuggestedActions(errorType: string, model: string): string[] {
    switch (errorType) {
        case 'SAFETY_FILTER':
            return [
                'Try rephrasing the prompt to be less specific about violence or inappropriate content',
                'Switch to Imagen 3.0 or 4.0 which may be more permissive',
                'Use more general terms and avoid detailed descriptions of problematic content'
            ];
        case 'MODEL_NO_IMAGE_SUPPORT':
            return [
                'Switch to Imagen 3.0 for high-quality results',
                'Try Imagen 4.0 for the best quality (higher cost)',
                'Use Gemini 2.0 Flash (Preview) for cheaper generation'
            ];
        case 'RATE_LIMIT':
            return [
                'Wait 1-2 minutes before trying again',
                'Consider switching to a different model temporarily',
                'Reduce the number of simultaneous generations'
            ];
        case 'INVALID_API_KEY':
            return [
                'Check that your Gemini API key is correct in Settings',
                'Ensure your API key has image generation permissions',
                'Try creating a new API key from Google AI Studio'
            ];
        default:
            return [
                'Try switching to a different image model',
                'Check your internet connection',
                'Verify your API key is valid and has sufficient quota'
            ];
    }
}

// ---- PiAPI helpers ----
function extractTaskId(obj: any): string | null {
    if (!obj || typeof obj !== 'object') return null;
    // direct
    if (typeof obj.id === 'string' && obj.id) return obj.id;
    if (typeof obj.task_id === 'string' && obj.task_id) return obj.task_id;
    if (typeof obj.taskId === 'string' && obj.taskId) return obj.taskId;
    if (typeof obj.uuid === 'string' && obj.uuid) return obj.uuid;
    // nested data
    const d = obj.data;
    if (d && typeof d === 'object') {
        if (typeof d.id === 'string' && d.id) return d.id;
        if (typeof d.task_id === 'string' && d.task_id) return d.task_id;
        if (typeof d.taskId === 'string' && d.taskId) return d.taskId;
        if (typeof d.uuid === 'string' && d.uuid) return d.uuid;
        const t = (d as any).task;
        if (t && typeof t === 'object') {
            if (typeof t.id === 'string' && t.id) return t.id;
            if (typeof t.task_id === 'string' && t.task_id) return t.task_id;
            if (typeof t.uuid === 'string' && t.uuid) return t.uuid;
        }
    }
    // shallow scan for *id or *uuid
    for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string' && v && /(^|[_-])(id|uuid)($|[_-])/i.test(k)) return v as string;
    }
    return null;
}

function extractPiAPIBase64(obj: any): string | null {
    if (!obj || typeof obj !== 'object') return null;
    const out = obj.output || obj.data || obj;
    // Common shapes
    if (Array.isArray(out?.images)) {
        const first = out.images[0];
        if (first?.b64_json) return first.b64_json;
        if (first?.base64) return first.base64;
        if (first?.image_base64) return first.image_base64;
    }
    if (Array.isArray(out?.output)) {
        const first = out.output[0];
        if (first?.b64_json) return first.b64_json;
        if (first?.base64) return first.base64;
        if (first?.image_base64) return first.image_base64;
    }
    if (out?.output && typeof out.output === 'object') {
        const o = out.output;
        if (typeof o.image_base64 === 'string' && o.image_base64) return o.image_base64;
        if (typeof o.b64_json === 'string' && o.b64_json) return o.b64_json;
        if (typeof o.base64 === 'string' && o.base64) return o.base64;
    }
    if (typeof out?.image_base64 === 'string') return out.image_base64;
    if (typeof out?.b64_json === 'string') return out.b64_json;
    if (typeof out?.base64 === 'string') return out.base64;
    // Deep-ish scan fallback up to 2 levels for a string value that looks like base64
    const looksLikeB64 = (s: any) => typeof s === 'string' && /^[A-Za-z0-9+/=]{100,}$/.test(s);
    const scan = (o: any, depth = 0): string | null => {
        if (!o || typeof o !== 'object' || depth > 2) return null;
        for (const v of Object.values(o)) {
            if (looksLikeB64(v)) return v as string;
            const nested = scan(v, depth + 1);
            if (nested) return nested;
        }
        return null;
    };
    return scan(out, 0);
}

function extractPiAPIImageUrl(obj: any): string | null {
    if (!obj || typeof obj !== 'object') return null;
    const out = obj.output || obj.data || obj;
    if (typeof out?.image_url === 'string' && out.image_url) return out.image_url;
    if (out?.output && typeof out.output === 'object' && typeof out.output.image_url === 'string' && out.output.image_url) return out.output.image_url;
    if (Array.isArray(out?.images)) {
        const first = out.images[0];
        if (typeof first?.url === 'string' && first.url) return first.url;
    }
    if (Array.isArray(out?.output)) {
        const first = out.output[0];
        if (typeof first?.url === 'string' && first.url) return first.url;
    }
    return null;
}

async function fetchImageAsBase64(url: string): Promise<string> {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const contentType = resp.headers.get('content-type') || 'image/png';
    const ab = await resp.arrayBuffer();
    // Convert to base64
    let binary = '';
    const bytes = new Uint8Array(ab);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, Array.from(chunk) as any);
    }
    const b64 = btoa(binary);
    // return raw base64 payload (without data: prefix) to match other code paths
    return b64;
}
