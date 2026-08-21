
import { GoogleGenAI } from '@google/genai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AppSettings, GeneratedImageResult } from '../types';
import { imageFileToBase64 } from './imageUtils';
import { getConfiguredApiKey } from './ai/providerCredentials';
import { apiMetricsService } from './apiMetricsService';
import { debugPipelineEnabled, debugLog as _debugLog, debugWarn as _debugWarn } from '../utils/debug';

const ilog = (...args: any[]) => { if (debugPipelineEnabled('image')) console.log(...args); };
const iwarn = (...args: any[]) => { if (debugPipelineEnabled('image')) console.warn(...args); };
const ierror = (...args: any[]) => { console.error(...args); };
import { IMAGE_COSTS } from '../config/costs';
import {
  buildOpenRouterImageRequestConfig,
  getVerifiedOpenRouterImageModel,
} from './openrouterImageModelAdapter';
import {
  generateIndrasNetImage,
  IndrasNetProviderError,
  isIndrasNetImageModel,
  resumeIndrasNetImageTask,
  workflowNameFromImageModel,
} from './providers/indrasNetImageProvider';
import type { ImageJobLifecycleListener } from './imageJobTypes';

// Image dimension constraints (provider API limits)
const IMAGE_DIM_MIN = 256;        // Minimum accepted by Gemini/PiAPI
const IMAGE_DIM_MAX = 4096;       // Maximum accepted by most providers
const IMAGE_DIM_DEFAULT = 1024;   // Standard HD baseline
const IMAGE_MAX_PIXELS = 1048576; // 1024×1024 — max total pixel budget for PiAPI

// A stalled request that never settles hangs the image's isLoading flag — forever, with no error
// and no way back except a reload. Every provider branch is guarded: the raw fetch() paths
// (OpenRouter, PiAPI) pass AbortSignal.timeout, and the Google SDK calls (Imagen via
// ai.models.generateImages, Gemini via model.generateContent) get an abort signal PLUS a
// Promise.race timer backstop (withTimeout below) — the race unwedges the caller even if an SDK
// code path drops the signal, though neither can cancel provider-side work already running.
const IMAGE_GENERATION_TIMEOUT_MS = 180_000; // generation is genuinely slow; be generous
const IMAGE_TASK_CREATE_TIMEOUT_MS = 30_000; // just enqueues a job
const IMAGE_DOWNLOAD_TIMEOUT_MS = 60_000;    // fetching the finished image bytes

/**
 * Race a provider call against a timer. The timer REJECTS (unwedging the caller and failing the
 * image honestly) — it does not and cannot cancel the underlying request, which is why the SDK
 * calls also receive an AbortSignal where their signatures accept one.
 */
const withTimeout = async <T>(work: Promise<T>, ms: number, label: string): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            const err = new Error(
                `${label} timed out after ${Math.round(ms / 1000)}s with no response. ` +
                `The request was abandoned client-side; the provider may still complete (and bill) it.`
            );
            // Named so intermediate handlers (e.g. the Gemini guidance wrapper) can tell a hang
            // from a provider rejection and let it propagate honestly.
            err.name = 'ImageTimeoutError';
            reject(err);
        }, ms);
    });
    try {
        return await Promise.race([work, timedOut]);
    } finally {
        clearTimeout(timer);
    }
};

// Typed error extension used by image generation to carry actionable metadata
interface ImageGenerationError extends Error {
  errorType: string;
  originalError?: unknown;
  model?: string;
  canRetry?: boolean;
  suggestedActions?: string[];
}

// --- CONSTANTS ---
// Using a cutting-edge model known for high-quality image generation.
// This could be parameterized in settings later if needed.
const IMAGE_MODEL = 'gemini-1.5-flash';

// Cache for dynamic OpenRouter prices (populated asynchronously)
let openRouterPriceCache: Record<string, number> = {};

// --- IMAGE COST CALCULATION ---

/**
 * Recorded for an image whose model has no price anywhere — the analogue of
 * scripts/sutta-studio/spend-guard.ts's UNPRICED_CALL_ESTIMATE_USD and ai/cost.ts's fail-closed
 * pairing: unpriced spend must drive the ledger UP where someone sees it, not vanish as $0.
 * Deliberately above every price in the static table.
 */
export const UNPRICED_IMAGE_COST_USD = 0.25;

/**
 * Calculates the cost for generating one image with the specified model (sync version).
 *
 * Precedence: LIVE OpenRouter pricing (cached by fetchOpenRouterImagePrice) first, static
 * costs.ts as the fallback, and the conservative UNPRICED estimate — never $0 — when neither
 * knows the model. Live prices win because the static table goes stale: seedream-4.5 was billed
 * at $0.04/image while the table still said $0.01, and the old static-first order recorded the
 * stale number even when the live price was sitting in the cache.
 *
 * @param model The image model ID
 * @returns Cost in USD for one image
 */
export const calculateImageCost = (model: string): number => {
    // IndrasNet is self-hosted. Electricity/hardware costs are outside the provider spend ledger.
    if (isIndrasNetImageModel(model)) return 0;
    // 1. Live pricing first (OpenRouter models only; populated by fetchOpenRouterImagePrice —
    //    per-image estimates from the verified image-model catalog).
    if (model.startsWith('openrouter/')) {
        const cleanId = model.slice(11); // Remove 'openrouter/' prefix
        if (openRouterPriceCache[cleanId] != null) {
            console.log(`[ImageCost] Using live OpenRouter price for ${model}: $${openRouterPriceCache[cleanId]}`);
            return openRouterPriceCache[cleanId];
        }
        console.log(`[ImageCost] No live price cached for OpenRouter model: ${model} (cleanId: ${cleanId}); falling back to static table`);
    }

    // 2. Static fallback
    if (IMAGE_COSTS[model] != null) {
        console.log(`[ImageCost] Using static price for ${model}: $${IMAGE_COSTS[model]}`);
        return IMAGE_COSTS[model];
    }

    // 3. Unknown model: recording $0 hid the spend from every ledger. Record the conservative
    //    estimate and say so loudly.
    console.error(
        `[ImageCost] No pricing found for image model ${model} — recording conservative $${UNPRICED_IMAGE_COST_USD} estimate (NOT $0) so the spend stays visible. Add the model to config/costs.ts IMAGE_COSTS.`
    );
    return UNPRICED_IMAGE_COST_USD;
};

/**
 * Fetches and caches dynamic pricing for an OpenRouter image model.
 * Call this before generateImage() to ensure accurate cost tracking.
 * @param model The image model ID (with or without 'openrouter/' prefix)
 * @returns The price per image in USD, or null if unavailable
 */
export const fetchOpenRouterImagePrice = async (model: string): Promise<number | null> => {
    console.log('[ImageService] Fetching OpenRouter price for:', model);
    const profile = await getVerifiedOpenRouterImageModel(model);
    const price = profile?.priceEstimate ?? null;
    console.log('[ImageService] OpenRouter price result:', {
        model,
        price,
        pricingLabel: profile?.pricingLabel ?? 'unavailable',
    });
    if (price != null) {
        const cleanId = model.startsWith('openrouter/') ? model.slice(11) : model;
        openRouterPriceCache[cleanId] = price;
        console.log('[ImageService] Cached OpenRouter price:', { cleanId, price });
    } else {
        console.warn('[ImageService] No price found for OpenRouter model:', model);
        console.warn('[ImageService] Model may not exist in the verified OpenRouter image catalog');
    }
    return price;
};

// --- IMAGE GENERATION SERVICE ---

/**
 * Does the provider branch for this model actually SEND the steering image to the provider?
 * Only the PiAPI (Qubico/) img2img path does; the Imagen, Gemini and OpenRouter branches ignore
 * steering images entirely. Callers that persist provenance metadata must consult this instead
 * of assuming a configured steering image was applied (integrity item 6).
 */
export const modelConsumesSteeringImage = (imageModel: string): boolean =>
    imageModel.startsWith('Qubico/');

export const imageProviderForModel = (imageModel: string): string =>
    isIndrasNetImageModel(imageModel) ? 'Asus / IndrasNet' :
    imageModel.startsWith('imagen') ? 'Imagen' :
    imageModel.startsWith('gemini') ? 'Gemini' :
    imageModel.startsWith('Qubico/') ? 'PiAPI' :
    imageModel.startsWith('openrouter/') ? 'OpenRouter' : 'Unknown';

/**
 * Generates an image from a text prompt using the configured Image API.
 * Supports both text-to-image and image-to-image generation.
 *
 * @param prompt The detailed text prompt for the image.
 * @param settings The current application settings containing the API key.
 * @param steeringImagePath Optional path to steering image for img2img (relative to steering directory)
 * @returns A base64 encoded string of the generated PNG image with cost.
 * @throws An error if the API key is missing or if the image generation fails.
 */
export const generateImage = async (
  prompt: string,
  settings: AppSettings,
  steeringImagePath?: string,
  negativePrompt?: string,
  guidanceScale?: number,
  loraModel?: string | null,
  loraStrength?: number,
  chapterId?: string,  // NEW: for Cache API storage
  placementMarker?: string,  // NEW: for Cache API storage
  version?: number,  // NEW: version number for Cache API storage (defaults to 1)
  onJobEvent?: ImageJobLifecycleListener
): Promise<GeneratedImageResult> => {
    const imageModel = settings.imageModel || 'imagen-3.0-generate-001';
    const reqW = Math.max(IMAGE_DIM_MIN, Math.min(IMAGE_DIM_MAX, (settings.imageWidth || IMAGE_DIM_DEFAULT)));
    const reqH = Math.max(IMAGE_DIM_MIN, Math.min(IMAGE_DIM_MAX, (settings.imageHeight || IMAGE_DIM_DEFAULT)));
    let piW = reqW, piH = reqH;
    if (piW * piH > IMAGE_MAX_PIXELS) {
        const scale = Math.sqrt(IMAGE_MAX_PIXELS / (piW * piH));
        piW = Math.max(IMAGE_DIM_MIN, Math.floor(piW * scale));
        piH = Math.max(IMAGE_DIM_MIN, Math.floor(piH * scale));
    }
    ilog(`[ImageService] Starting image generation...`);
    ilog(`[ImageService] - Model: ${imageModel}`);
    ilog(`[ImageService] - Prompt: ${prompt.substring(0, 100)}...`);
    const hasKey = isIndrasNetImageModel(imageModel)
      ? true
      : imageModel.startsWith('Qubico/')
      ? !!getConfiguredApiKey(settings, 'PiAPI')
      : imageModel.startsWith('openrouter/')
        ? !!getConfiguredApiKey(settings, 'OpenRouter')
        : !!getConfiguredApiKey(settings, 'Gemini');
    ilog(`[ImageService] - API Key present: ${hasKey}`);

    // Steering images are consumed ONLY by the PiAPI (Qubico/) branch below. Every other
    // provider branch ignores them — which used to happen SILENTLY while the persisted metadata
    // recorded the steering image as applied. This service has no notification hook (its only
    // user-facing signals are thrown errors), so warn loudly here; the metadata honesty fix
    // lives in imageGenerationService via modelConsumesSteeringImage().
    if (steeringImagePath && !modelConsumesSteeringImage(imageModel)) {
        console.warn(
            `[ImageService] Steering image "${steeringImagePath}" will be IGNORED: model "${imageModel}" does not ` +
            `support steering images in this app (only PiAPI Qubico/ models consume them). Generating from the text prompt alone.`
        );
    }

    const startTime = performance.now();
    
    try {
        let base64Data: string;
        let mimeTypeForReturn: string | null = null;
        // Token usage tracking (primarily for OpenRouter)
        let imageTokenUsage: { prompt: number; completion: number; total: number } | undefined;

        if (isIndrasNetImageModel(imageModel)) {
            ilog('[ImageService] Using IndrasNet workflow:', imageModel);
            const output = await generateIndrasNetImage({
                model: imageModel,
                baseUrl: settings.indrasNetBaseUrl,
                prompt,
                negativePrompt,
                seed: settings.seed,
                width: reqW,
                height: reqH,
                guidanceScale,
                onJobEvent,
            });
            base64Data = output.base64;
            mimeTypeForReturn = output.mimeType;
        }
        else if (imageModel.startsWith('imagen')) {
            ilog('[ImageService] Using Imagen model:', imageModel);
            const apiKey = getConfiguredApiKey(settings, 'Gemini'); if (!apiKey) throw new Error('Gemini API key is missing. Cannot generate images with Imagen.');
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
                response = await withTimeout(ai.models.generateImages({
                    model: imageModel,
                    prompt: `${prompt}. Target size ~${reqW}x${reqH}. Please generate this image in a dark, atmospheric, and highly detailed anime/manga style.`,
                    config: {
                        numberOfImages: 1,
                        sampleImageSize: sampleImageSize,
                        aspectRatio: aspectLabel,
                        abortSignal: AbortSignal.timeout(IMAGE_GENERATION_TIMEOUT_MS),
                    } as any,
                }), IMAGE_GENERATION_TIMEOUT_MS, 'Imagen image generation');
            } else {
                response = await withTimeout(ai.models.generateImages({
                    model: imageModel,
                    prompt: `${prompt}. Target size ~${reqW}x${reqH}. Please generate this image in a dark, atmospheric, and highly detailed anime/manga style.`,
                    config: {
                        numberOfImages: 1,
                        abortSignal: AbortSignal.timeout(IMAGE_GENERATION_TIMEOUT_MS),
                    },
                }), IMAGE_GENERATION_TIMEOUT_MS, 'Imagen image generation');
            }

            if (debugPipelineEnabled('image', 'full')) console.log('[ImageService/Imagen] Full API Response:', JSON.stringify(response, null, 2));

            if (!response.generatedImages || response.generatedImages.length === 0 || !response.generatedImages[0].image?.imageBytes) {
                ierror("[ImageService/Imagen] Unexpected response structure or empty image list:", response);
                throw new Error("Failed to receive valid image data from Imagen API. The prompt may have been blocked by safety filters.");
            }
            base64Data = response.generatedImages[0].image.imageBytes;

        } else if (imageModel.startsWith('gemini')) {
            ilog('[ImageService] Using Gemini native image generation:', imageModel);
            const apiKey = getConfiguredApiKey(settings, 'Gemini'); if (!apiKey) throw new Error('Gemini API key is missing. Cannot generate images with Gemini.');
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: imageModel });
            try {
                const needsModalities = imageModel.includes('gemini-2.0') && imageModel.includes('image-generation');
                const requestPayload: any = {
                    contents: [{
                        role: 'user',
                        parts: [{
                            text: `Generate an image based on this description: ${prompt}. Target size approximately ${reqW}x${reqH} with a matching aspect ratio. Style: dark, atmospheric, highly detailed.`
                        }]
                    }],
                };
                if (needsModalities) {
                    requestPayload.responseModalities = ['TEXT', 'IMAGE'];
                }
                const result = await withTimeout(
                    model.generateContent(requestPayload, { signal: AbortSignal.timeout(IMAGE_GENERATION_TIMEOUT_MS) }),
                    IMAGE_GENERATION_TIMEOUT_MS,
                    'Gemini image generation'
                );
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
                    ierror("[ImageService/Gemini] No image data found in response:", JSON.stringify(response, null, 2));
                    throw new Error("Failed to receive valid image data from Gemini API. The model may not support image generation or the prompt was rejected.");
                }
                base64Data = foundImageData;
            } catch (err: any) {
                // A timeout is a HANG, not a modality/safety rejection: the guidance wrapper
                // below mentions "safety", which the outer handler would classify as
                // SAFETY_FILTER — mislabeling a network stall as blocked content. Propagate it.
                if (err?.name === 'ImageTimeoutError') throw err;
                // Rich diagnostics for debugging (no auto-fallback)
                try {
                    ierror('[ImageService/Gemini] generateContent error (object):', err);
                    if (err?.cause) ierror('[ImageService/Gemini] error.cause:', err.cause);
                    const causeMsg = (err?.cause && err.cause.message) ? String(err.cause.message) : '';
                    const msg = String(err?.message || '');
                    ierror('[ImageService/Gemini] error.message:', msg);
                    if (causeMsg) ierror('[ImageService/Gemini] error.cause.message:', causeMsg);
                } catch {}

                // Re-throw with guidance for the reader to choose a different model
                const guidance = 'This Gemini image model rejected the request due to response modality/mime constraints or safety. Try switching to "Gemini 2.5 Flash (Image Preview)" or "Imagen 3.0/4.0" in Settings, then click Retry.';
                const enhanced: ImageGenerationError = Object.assign(
                  new Error(`${err?.message || 'Image generation failed'}. ${guidance}`),
                  {
                    errorType: /response_mime_type|requested combination of response modalities/i.test(String(err?.message || '') + String(err?.cause?.message || ''))
                      ? 'MODALITY_MISMATCH'
                      : 'GENERIC_ERROR',
                    originalError: err,
                    canRetry: false,
                    suggestedActions: [
                      'Open Settings → Image model and pick Imagen 3.0 or Gemini 2.5 Image Preview',
                      'Simplify the prompt (less graphic detail) and Retry',
                    ],
                  }
                );
                throw enhanced;
            }
            
        
        } else if (imageModel.startsWith('openrouter/')) {
            // --- OpenRouter image generation via chat completions ---
            const orKey = getConfiguredApiKey(settings, 'OpenRouter');
            if (!orKey) throw new Error('OpenRouter API key is missing. Please add it in Settings.');
            const modelSlug = imageModel.replace('openrouter/', '');
            const modelProfile = await getVerifiedOpenRouterImageModel(modelSlug);
            if (!modelProfile) {
              throw new Error(
                `Model ${modelSlug} is not in the verified OpenRouter image catalog. Refresh models or select a different image model.`
              );
            }

            ilog('[OpenRouter Debug] Model capability check:', {
              model: modelSlug,
              inputModalities: modelProfile.inputModalities,
              outputModalities: modelProfile.outputModalities,
              requestModalities: modelProfile.requestModalities,
              supportsImageConfig: modelProfile.supportsImageConfig,
            });

            // Optional headers from config/app.json similar to text path
            const extraHeaders: Record<string, string> = {};
            try {
              const appConfig = await import('../config/app.json');
              if (appConfig.openrouter?.referer) extraHeaders['HTTP-Referer'] = appConfig.openrouter.referer;
              if (appConfig.openrouter?.title) extraHeaders['X-Title'] = appConfig.openrouter.title;
            } catch {}

            const reqBody: any = {
              model: modelSlug,
              messages: [{ role: 'user', content: prompt }],
              modalities: modelProfile.requestModalities,
            };

            const imageConfig = buildOpenRouterImageRequestConfig(modelProfile, reqW, reqH);
            if (imageConfig) {
              reqBody.image_config = imageConfig;
            }

            const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${orKey}`,
                'Content-Type': 'application/json',
                ...extraHeaders,
              },
              body: JSON.stringify(reqBody),
              signal: AbortSignal.timeout(IMAGE_GENERATION_TIMEOUT_MS),
            });

            const raw = await resp.text();
            if (!resp.ok) {
              let msg = `OpenRouter error ${resp.status}`;
              try { const j = JSON.parse(raw); msg = j?.error?.message || j?.message || msg; } catch {}
              throw new Error(msg);
            }
            let parsed: any = {};
            try { parsed = JSON.parse(raw); } catch { throw new Error('Failed to parse OpenRouter response'); }

            // Enhanced debugging: log the actual response structure
            ilog('[OpenRouter Debug] Full response structure:', JSON.stringify(parsed, null, 2));

            // Extract token usage from response (for cost estimation from historical data)
            if (parsed.usage) {
              imageTokenUsage = {
                prompt: parsed.usage.prompt_tokens || 0,
                completion: parsed.usage.completion_tokens || 0,
                total: parsed.usage.total_tokens || 0
              };
              ilog('[OpenRouter Debug] Token usage:', imageTokenUsage);
            }

            const choice = parsed?.choices?.[0];

            // Check for error in response
            if (choice?.error) {
              const errorMsg = choice.error.message || 'Unknown error from provider';
              const errorCode = choice.error.code || 'UNKNOWN';
              throw new Error(`OpenRouter provider error (${errorCode}): ${errorMsg}`);
            }

            // Try multiple possible locations for image data
            // 1. message.images (custom OpenRouter field)
            let images = choice?.message?.images;

            // 2. message.content as array (OpenAI format)
            if (!images && Array.isArray(choice?.message?.content)) {
              images = choice.message.content.filter((item: any) =>
                item.type === 'image' || item.type === 'image_url' || item.image_url
              );
            }

            // 3. message.content as single object with image_url
            if (!images && choice?.message?.content && typeof choice.message.content === 'object' &&
                (choice.message.content.type === 'image' || choice.message.content.image_url)) {
              images = [choice.message.content];
            }

            // 4. message.content as string (might be base64 or data URL directly)
            if (!images && typeof choice?.message?.content === 'string' && choice.message.content.startsWith('data:image/')) {
              images = [{ image_url: { url: choice.message.content } }];
            }

            // 5. Check if content is directly an image object (no array wrapper)
            if (!images && choice?.message?.content?.image_url) {
              images = [choice.message.content];
            }

            // Detailed diagnostic logging
            ilog('[OpenRouter Debug] Response analysis:', {
              hasChoices: !!parsed?.choices,
              choicesLength: parsed?.choices?.length || 0,
              firstChoice: choice ? Object.keys(choice) : 'null',
              hasMessage: !!choice?.message,
              messageKeys: choice?.message ? Object.keys(choice.message) : 'null',
              contentType: typeof choice?.message?.content,
              isContentArray: Array.isArray(choice?.message?.content),
              hasImages: !!images,
              imagesType: Array.isArray(images) ? 'array' : typeof images,
              imagesLength: Array.isArray(images) ? images.length : 'n/a'
            });

            if (!Array.isArray(images) || images.length === 0) {
              // Enhanced error with actual response structure
              const errorDetails = {
                model: modelSlug,
                responseKeys: Object.keys(parsed),
                choiceStructure: choice ? Object.keys(choice) : null,
                messageStructure: choice?.message ? Object.keys(choice.message) : null,
                messageContent: choice?.message?.content,
                actualImages: images,
                fullResponse: parsed
              };

              console.error('[OpenRouter Debug] Missing image data. Full diagnostic:', errorDetails);
              throw new Error(`OpenRouter response missing image data. Model: ${modelSlug}. Response structure: ${JSON.stringify(errorDetails, null, 2)}`);
            }
            const first = images[0];
            const dataUrl = first?.image_url?.url;
            
            // Enhanced image format debugging
            ilog('[OpenRouter Debug] Image format analysis:', {
              firstImageKeys: first ? Object.keys(first) : 'null',
              imageUrlStructure: first?.image_url ? Object.keys(first.image_url) : 'null', 
              dataUrlType: typeof dataUrl,
              dataUrlPrefix: typeof dataUrl === 'string' ? dataUrl.substring(0, 30) + '...' : dataUrl,
              isDataUrl: typeof dataUrl === 'string' && dataUrl.startsWith('data:image/'),
              firstImageFull: first
            });
            
            if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
              const formatError = {
                model: modelSlug,
                expectedFormat: 'data:image/...',
                actualFormat: typeof dataUrl === 'string' ? dataUrl.substring(0, 50) + '...' : dataUrl,
                imageStructure: first,
                allImages: images
              };
              
              console.error('[OpenRouter Debug] Unexpected image format. Full diagnostic:', formatError);
              throw new Error(`OpenRouter returned unexpected image format. Model: ${modelSlug}. Expected: data:image/..., Got: ${typeof dataUrl === 'string' ? dataUrl.substring(0, 50) + '...' : dataUrl}. Structure: ${JSON.stringify(formatError, null, 2)}`);
            }
            // Remove data: prefix to align with other code paths expecting raw base64 in calculate/compose
            const commaIdx = dataUrl.indexOf(',');
            const header = dataUrl.slice(5, commaIdx); // e.g., image/png;base64
            const semi = header.indexOf(';');
            const detectedMime = semi >= 0 ? header.slice(0, semi) : header; // image/png
            const base64Part = dataUrl.slice(commaIdx + 1);
            if (!base64Part) throw new Error('Invalid data URL returned by OpenRouter.');
            base64Data = base64Part;
            mimeTypeForReturn = detectedMime || 'image/png';

        } else if (imageModel.startsWith('Qubico/')) {
            // --- PiAPI Flux (task-based) with img2img support ---
            const apiKeyPi = getConfiguredApiKey(settings, 'PiAPI');
            if (!apiKeyPi) throw new Error('PiAPI API key is missing. Please add it in Settings.');

            // Determine task type based on whether steering image is provided
            const taskType = steeringImagePath ? 'img2img' : 'txt2img';
            const isAdvanced = imageModel === 'Qubico/flux1-dev-advanced';
            const modelForTask = (isAdvanced && taskType === 'txt2img') ? 'Qubico/flux1-dev' : imageModel;
            
            ilog(`[PiAPI] Using ${taskType} with model ${modelForTask}`);

            // Prepare input object with advanced controls
            let inputData: any = { 
                prompt, 
                width: piW, 
                height: piH 
            };
            
            // Add negative prompt if provided
            if (negativePrompt && negativePrompt.trim()) {
                inputData.negative_prompt = negativePrompt.trim();
                ilog(`[PiAPI] Added negative prompt: "${negativePrompt.trim()}"`);
            }
            
            // Add guidance scale if provided (PiAPI supports this parameter)
            if (guidanceScale !== undefined && guidanceScale >= 1.5 && guidanceScale <= 5.0) {
                inputData.guidance_scale = guidanceScale;
                ilog(`[PiAPI] Added guidance scale: ${guidanceScale}`);
            }
            
            // Add LoRA settings if provided
            if (loraModel && loraModel.trim()) {
                const loraSettings = [{
                    lora_type: loraModel.trim(),
                    lora_strength: (loraStrength !== undefined && loraStrength >= 0.1 && loraStrength <= 2.0) 
                        ? loraStrength 
                        : 0.8 // Default strength
                }];
                inputData.lora_settings = loraSettings;
                ilog(`[PiAPI] Added LoRA model: ${loraModel} with strength: ${loraSettings[0].lora_strength}`);
            }
            
            // Add steering image for img2img
            if (steeringImagePath && taskType === 'img2img') {
                try {
                    // Use HTTP URL for steering images in public/steering/
                    const steeringImageBase64 = await imageFileToBase64(steeringImagePath);
                    inputData.image = steeringImageBase64;
                    ilog(`[PiAPI] Added steering image: ${steeringImagePath}`);
                } catch (error) {
                    iwarn(`[PiAPI] Failed to load steering image: ${steeringImagePath}`, error);
                    throw new Error(`Failed to load steering image "${steeringImagePath}". Please check that the file exists in public/steering/. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }

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
                    input: inputData,
                    // service_mode: 'public', // optional
                }),
                signal: AbortSignal.timeout(IMAGE_TASK_CREATE_TIMEOUT_MS),
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
                iwarn('[PiAPI] Unexpected create response (first 500 chars):', rawCreateText.slice(0, 500));
                throw new Error('PiAPI: missing task id in create response.');
            }
            onJobEvent?.({ type: 'submitted', externalTaskId: taskId, resumeKind: 'piapi' });

            const taskData = await pollPiApiTask(taskId, apiKeyPi, onJobEvent);
            base64Data = await extractPiApiTaskImage(taskData);
        }
        else if (imageModel === 'None') {
            // Explicit UX-friendly error when images are disabled
            throw new Error('Image generation is disabled in Settings (Image Generation Model = None). Choose Imagen 3.0/4.0 or a Gemini image-capable model to enable.');
        }
        else {
            ierror(`[ImageService] Unrecognized model: ${imageModel}`);
            throw new Error(`Unrecognized image model: ${imageModel}. Supported prefixes: indrasnet/, imagen, gemini, openrouter/, Qubico/.`);
        }

        const requestTime = (performance.now() - startTime) / 1000; // in seconds

        // For OpenRouter models, fetch dynamic pricing before calculating cost
        if (imageModel.startsWith('openrouter/')) {
            await fetchOpenRouterImagePrice(imageModel);
        }
        const cost = calculateImageCost(imageModel);
        const base64DataUrl = `data:${mimeTypeForReturn || 'image/png'};base64,${base64Data}`;

        console.log(`[ImageService] Successfully received image data in ${requestTime.toFixed(2)}s. Cost: ${cost.toFixed(5)}`);

        // Determine provider from model name
        const provider = imageProviderForModel(imageModel);

        // Record successful image generation in metrics
        await apiMetricsService.recordMetric({
            apiType: 'image',
            provider,
            model: imageModel,
            costUsd: cost,
            duration: requestTime,
            imageCount: 1,
            chapterId,
            success: true,
            tokens: imageTokenUsage, // Include token usage for historical cost estimation
        });

        // NEW: Store in Cache API if chapter/marker provided
        if (chapterId && placementMarker) {
            try {
                const { ImageCacheStore } = await import('./imageCacheService');
                const { telemetryService } = await import('./telemetryService');

                if (ImageCacheStore.isSupported()) {
                    const cacheKey = await ImageCacheStore.storeImage(
                        chapterId,
                        placementMarker,
                        base64DataUrl,
                        version || 1  // Pass version number, default to 1
                    );

                    ilog('[ImageService] Image stored in Cache API', {
                        chapterId,
                        placementMarker,
                        version: version || 1,
                        originalSizeKB: (base64DataUrl.length / 1024).toFixed(2)
                    });

                    // Return cache key (preferred) with empty imageData
                    return {
                        imageData: '',  // Empty - use cache key instead
                        imageCacheKey: cacheKey,
                        requestTime,
                        cost,
                        execution: { provider, model: imageModel },
                    };
                } else {
                    iwarn('[ImageService] Cache API not supported, falling back to base64');
                }
            } catch (error) {
                ierror('[ImageService] Failed to store in cache, falling back to base64:', error);
                // Fall through to base64 fallback below
            }
        }

        // Fallback: Return base64 (backwards compatible)
        return {
            imageData: base64DataUrl,
            requestTime,
            cost,
            execution: { provider, model: imageModel },
        };

    } catch (error: any) {
        console.error(`[ImageService] Image generation failed for prompt: "${prompt}"`, error);

        // Enhanced error handling with specific detection for common issues
        let message = error.message || 'Unknown error occurred';
        let errorType = 'GENERIC_ERROR';

        if (error instanceof IndrasNetProviderError) {
            errorType = error.code;
            message = error.message;
        } else if (message.includes('API key')) {
            errorType = 'INVALID_API_KEY';
            if (imageModel.startsWith('Qubico/')) {
                message = 'Invalid PiAPI API key. Please check your API key in Settings.';
            } else if (imageModel.startsWith('openrouter/')) {
                message = 'Invalid OpenRouter API key. Please check your API key in Settings.';
            } else {
                message = 'Invalid Gemini API key. Please check your API key in Settings.';
            }
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

        // Determine provider from model name
        const provider = imageProviderForModel(imageModel);

        // Record failed image generation in metrics
        await apiMetricsService.recordMetric({
            apiType: 'image',
            provider,
            model: imageModel,
            costUsd: 0,
            duration: (performance.now() - startTime) / 1000,
            imageCount: 0,
            chapterId,
            success: false,
            errorMessage: message,
        });

        // Add error metadata for fallback logic
        const enhancedError: ImageGenerationError = Object.assign(new Error(message), {
          errorType,
          originalError: error,
          model: imageModel,
          canRetry: error instanceof IndrasNetProviderError
            ? error.retryable
            : ['RATE_LIMIT', 'SAFETY_FILTER'].includes(errorType),
          suggestedActions: getSuggestedActions(errorType, imageModel),
        });

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
            if (model.startsWith('openrouter/')) {
                return [
                    'Check that your OpenRouter API key is correct in Settings',
                    'Verify the key has access to image-capable models',
                    'Refresh the OpenRouter model catalog and retry with a verified image model'
                ];
            }
            if (model.startsWith('Qubico/')) {
                return [
                    'Check that your PiAPI API key is correct in Settings',
                    'Verify the key is allowed to create image tasks',
                    'Retry after confirming your account has remaining balance'
                ];
            }
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
export interface ResumeIndrasNetTaskInput {
    taskId: string;
    settings: AppSettings;
    chapterId: string;
    placementMarker: string;
    version: number;
    onJobEvent?: ImageJobLifecycleListener;
}

export const resumeIndrasNetTask = async (
    input: ResumeIndrasNetTaskInput,
): Promise<GeneratedImageResult> => {
    if (!isIndrasNetImageModel(input.settings.imageModel)) {
        throw new Error(`Cannot resume IndrasNet task with model "${input.settings.imageModel}".`);
    }
    const resumedAt = performance.now();
    const output = await resumeIndrasNetImageTask({
        baseUrl: input.settings.indrasNetBaseUrl,
        jobId: input.taskId,
        workflowName: workflowNameFromImageModel(input.settings.imageModel),
        onJobEvent: input.onJobEvent,
    });
    const resumeObservationSeconds = (performance.now() - resumedAt) / 1000;
    const brokerDurationSeconds = typeof output.brokerTimingMs === 'number' && Number.isFinite(output.brokerTimingMs)
        ? Math.max(0, output.brokerTimingMs / 1000)
        : undefined;
    const requestTime = brokerDurationSeconds ?? resumeObservationSeconds;
    const imageData = `data:${output.mimeType};base64,${output.base64}`;

    // A restored job may have spent hours waiting while the tab was closed.
    // Only the broker's own end-to-end timing is a valid empirical ETA sample;
    // the browser's post-reload observation is still useful for this job's UI
    // but must not contaminate the model history.
    if (brokerDurationSeconds !== undefined) {
        await apiMetricsService.recordMetric({
            apiType: 'image',
            provider: 'Asus / IndrasNet',
            model: input.settings.imageModel,
            costUsd: 0,
            duration: brokerDurationSeconds,
            imageCount: 1,
            chapterId: input.chapterId,
            success: true,
        });
    }

    try {
        const { ImageCacheStore } = await import('./imageCacheService');
        if (ImageCacheStore.isSupported()) {
            const imageCacheKey = await ImageCacheStore.storeImage(
                input.chapterId,
                input.placementMarker,
                imageData,
                input.version,
            );
            return {
                imageData: '',
                imageCacheKey,
                requestTime,
                cost: 0,
                execution: { provider: 'Asus / IndrasNet', model: input.settings.imageModel },
            };
        }
    } catch (error) {
        console.error('[ImageService/IndrasNet] Failed to cache resumed task image; keeping base64 fallback:', error);
    }

    return {
        imageData,
        requestTime,
        cost: 0,
        execution: { provider: 'Asus / IndrasNet', model: input.settings.imageModel },
    };
};

export interface ResumePiApiImageTaskInput {
    taskId: string;
    settings: AppSettings;
    chapterId: string;
    placementMarker: string;
    version: number;
    onJobEvent?: ImageJobLifecycleListener;
}

/**
 * Resume polling an already-created PiAPI task. This never creates a second
 * paid task: the durable provider id is the sole input to the provider call.
 */
export const resumePiApiImageTask = async (
    input: ResumePiApiImageTaskInput,
): Promise<GeneratedImageResult> => {
    const model = input.settings.imageModel;
    if (!model.startsWith('Qubico/')) {
        throw new Error(`Cannot resume PiAPI task with non-PiAPI model "${model}".`);
    }
    const apiKey = getConfiguredApiKey(input.settings, 'PiAPI');
    if (!apiKey) throw new Error('PiAPI API key is missing. Cannot resume the existing image task.');

    const resumedAt = performance.now();
    input.onJobEvent?.({ type: 'running' });
    const taskData = await pollPiApiTask(input.taskId, apiKey, input.onJobEvent);
    const base64 = await extractPiApiTaskImage(taskData);
    const resumeSeconds = (performance.now() - resumedAt) / 1000;
    const requestTime = resumeSeconds;
    const cost = calculateImageCost(model);
    const imageData = `data:image/png;base64,${base64}`;

    // PiAPI does not return provider-side generation timing for a restored
    // task. The post-reload polling interval is only a partial observation,
    // so deliberately omit it from empirical ETA history.

    try {
        const { ImageCacheStore } = await import('./imageCacheService');
        if (ImageCacheStore.isSupported()) {
            const imageCacheKey = await ImageCacheStore.storeImage(
                input.chapterId,
                input.placementMarker,
                imageData,
                input.version,
            );
            return {
                imageData: '',
                imageCacheKey,
                requestTime,
                cost,
                execution: { provider: 'PiAPI', model },
            };
        }
    } catch (error) {
        console.error('[ImageService/PiAPI] Failed to cache resumed task image; keeping base64 fallback:', error);
    }

    return {
        imageData,
        requestTime,
        cost,
        execution: { provider: 'PiAPI', model },
    };
};

async function pollPiApiTask(
    taskId: string,
    apiKey: string,
    onJobEvent?: ImageJobLifecycleListener,
): Promise<unknown> {
    const delays = [1000, 1000, 2000, 3000, 5000, 8000];
    for (let tries = 0; tries < 60; tries++) {
        try {
            const poll = await fetch(`https://api.piapi.ai/api/v1/task/${taskId}`, {
                headers: {
                    'X-API-Key': apiKey,
                    'Authorization': `Bearer ${apiKey}`,
                },
                signal: AbortSignal.timeout(8000),
            });
            const raw = await poll.text().catch(() => '');
            let json: any = {};
            try { json = raw ? JSON.parse(raw) : {}; } catch {}
            if (!poll.ok) throw new Error(`PiAPI get-task failed (${poll.status}): ${raw}`);
            const status = String(json.status || json.state || json.data?.status || json.data?.state || '').toLowerCase();
            if ((json && json.error) || (typeof json.code === 'number' && json.code >= 400)) {
                const message = json?.error?.message || json?.message || 'Unknown PiAPI polling error';
                throw new Error(`PiAPI get-task returned error: ${message}\nBody: ${raw}`);
            }
            if (/succeeded|completed|success/.test(status)) return json;
            if (/failed|error/.test(status)) throw new Error(`PiAPI task failed: ${raw || JSON.stringify(json)}`);
            onJobEvent?.({ type: 'running' });
            await new Promise(resolve => setTimeout(resolve, delays[Math.min(tries, delays.length - 1)]));
        } catch (error: any) {
            if (error.name === 'TimeoutError' || error.name === 'AbortError') {
                console.warn(`[PiAPI] Poll timeout on attempt ${tries + 1}/60, retrying task ${taskId}.`);
                continue;
            }
            throw error;
        }
    }
    throw new Error(`PiAPI task ${taskId} did not complete within the polling window.`);
}

async function extractPiApiTaskImage(taskData: unknown): Promise<string> {
    let base64 = extractPiAPIBase64(taskData);
    if (!base64) {
        const imageUrl = extractPiAPIImageUrl(taskData);
        if (imageUrl) {
            try {
                base64 = await fetchImageAsBase64(imageUrl);
            } catch (error) {
                ierror('[ImageService/PiAPI] Failed to fetch image_url:', imageUrl, error);
                throw new Error(`PiAPI task returned an image_url but it could not be fetched (possible CORS or network issue). URL: ${imageUrl}`);
            }
        }
    }
    if (!base64) {
        ierror('[ImageService/PiAPI] Unexpected task response:', taskData);
        throw new Error('PiAPI task completed but no image payload found.');
    }
    return base64;
}

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
    const resp = await fetch(url, { signal: AbortSignal.timeout(IMAGE_DOWNLOAD_TIMEOUT_MS) });
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
