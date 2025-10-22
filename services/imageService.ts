
import { GoogleGenAI } from '@google/genai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AppSettings, GeneratedImageResult } from '../types';
import { getModelMetadata } from './capabilityService';
import { imageFileToBase64 } from './imageUtils';
import { getEnvVar } from './env';
import { apiMetricsService } from './apiMetricsService';

const imgDebugEnabled = (): boolean => {
  try {
    const lvl = localStorage.getItem('LF_AI_DEBUG_LEVEL');
    return lvl === 'summary' || lvl === 'full';
  } catch { return false; }
};
const imgDebugFullEnabled = (): boolean => {
  try { return localStorage.getItem('LF_AI_DEBUG_LEVEL') === 'full'; } catch { return false; }
};
const ilog = (...args: any[]) => { if (imgDebugEnabled()) console.log(...args); };
const iwarn = (...args: any[]) => { if (imgDebugEnabled()) console.warn(...args); };
const ierror = (...args: any[]) => { console.error(...args); };
import { IMAGE_COSTS } from '../config/costs';

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
  version?: number  // NEW: version number for Cache API storage (defaults to 1)
): Promise<GeneratedImageResult> => {
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
    ilog(`[ImageService] Starting image generation...`);
    ilog(`[ImageService] - Model: ${imageModel}`);
    ilog(`[ImageService] - Prompt: ${prompt.substring(0, 100)}...`);
    const hasKey = imageModel.startsWith('Qubico/')
      ? !!(settings.apiKeyPiAPI || (getEnvVar('PIAPI_API_KEY') as any))
      : imageModel.startsWith('openrouter/')
        ? !!((settings as any).apiKeyOpenRouter || (getEnvVar('OPENROUTER_API_KEY') as any))
        : !!(settings.apiKeyGemini || (getEnvVar('GEMINI_API_KEY') as any));
    ilog(`[ImageService] - API Key present: ${hasKey}`);
    
    const startTime = performance.now();
    
    try {
        let base64Data: string;
        let mimeTypeForReturn: string | null = null;

        if (imageModel.startsWith('imagen')) {
            ilog('[ImageService] Using Imagen model:', imageModel);
            const apiKey = settings.apiKeyGemini || (getEnvVar('GEMINI_API_KEY') as any); if (!apiKey) throw new Error('Gemini API key is missing. Cannot generate images with Imagen.');
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

            if (imgDebugFullEnabled()) console.log('[ImageService/Imagen] Full API Response:', JSON.stringify(response, null, 2));

            if (!response.generatedImages || response.generatedImages.length === 0 || !response.generatedImages[0].image?.imageBytes) {
                ierror("[ImageService/Imagen] Unexpected response structure or empty image list:", response);
                throw new Error("Failed to receive valid image data from Imagen API. The prompt may have been blocked by safety filters.");
            }
            base64Data = response.generatedImages[0].image.imageBytes;

        } else if (imageModel.startsWith('gemini')) {
            ilog('[ImageService] Using Gemini native image generation:', imageModel);
            const apiKey = settings.apiKeyGemini || (getEnvVar('GEMINI_API_KEY') as any); if (!apiKey) throw new Error('Gemini API key is missing. Cannot generate images with Gemini.');
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: imageModel });
            try {
                const needsModalities = imageModel.includes('gemini-2.0') && imageModel.includes('image-generation');
                const result = await model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: `Generate an image based on this description: ${prompt}. Target size approximately ${reqW}x${reqH} with a matching aspect ratio. Style: dark, atmospheric, highly detailed.` }]}],
                    generationConfig: needsModalities ? { responseModalities: ['TEXT','IMAGE'] as any } : undefined,
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
                    ierror("[ImageService/Gemini] No image data found in response:", JSON.stringify(response, null, 2));
                    throw new Error("Failed to receive valid image data from Gemini API. The model may not support image generation or the prompt was rejected.");
                }
                base64Data = foundImageData;
            } catch (err: any) {
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
            
        
        } else if (imageModel.startsWith('openrouter/')) {
            // --- OpenRouter image generation via chat completions ---
            const orKey = (settings as any).apiKeyOpenRouter || (getEnvVar('OPENROUTER_API_KEY') as any);
            if (!orKey) throw new Error('OpenRouter API key is missing. Please add it in Settings.');
            const modelSlug = imageModel.replace('openrouter/', '');
            
            // Validate model capabilities before making request
            try {
              const metadata = await getModelMetadata(modelSlug);
              ilog('[OpenRouter Debug] Model capability check:', {
                model: modelSlug,
                hasMetadata: !!metadata,
                inputModalities: metadata?.architecture?.input_modalities,
                outputModalities: metadata?.architecture?.output_modalities,
                supportsImageOutput: metadata?.architecture?.output_modalities?.includes('image')
              });
              
              if (metadata && metadata.architecture?.output_modalities && !metadata.architecture.output_modalities.includes('image')) {
                throw new Error(`Model ${modelSlug} does not support image generation. Supported output modalities: ${metadata.architecture.output_modalities.join(', ')}`);
              }
            } catch (capError: any) {
              // Don't fail on capability check errors, but log them
              ilog('[OpenRouter Debug] Capability check failed:', capError.message);
            }

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
              modalities: ['image', 'text'],
            };

            const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${orKey}`,
                'Content-Type': 'application/json',
                ...extraHeaders,
              },
              body: JSON.stringify(reqBody),
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
            const apiKeyPi = settings.apiKeyPiAPI || (getEnvVar('PIAPI_API_KEY') as any);
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

            // 2) POLL TASK (with timeout and exponential backoff)
            let taskData: any = null;
            const delays = [1000, 1000, 2000, 3000, 5000, 8000]; // Exponential backoff in ms
            for (let tries = 0; tries < 60; tries++) {
                try {
                    // Add 8-second timeout to each fetch to prevent indefinite hangs
                    const poll = await fetch(`https://api.piapi.ai/api/v1/task/${taskId}`, {
                        headers: {
                            'X-API-Key': apiKeyPi,
                            'Authorization': `Bearer ${apiKeyPi}`,
                        },
                        signal: AbortSignal.timeout(8000) // 8 second timeout per request
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

                    // Exponential backoff delay
                    const delay = delays[Math.min(tries, delays.length - 1)];
                    await new Promise(r => setTimeout(r, delay));
                } catch (err: any) {
                    // Retry on timeout, but re-throw other errors
                    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
                        console.warn(`[PiAPI] Poll timeout on attempt ${tries + 1}/60, retrying...`);
                        continue; // Retry on timeout
                    }
                    throw err; // Re-throw non-timeout errors
                }
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
                        ierror('[ImageService/PiAPI] Failed to fetch image_url:', imgUrl, e);
                        throw new Error(`PiAPI task returned an image_url but it could not be fetched (possible CORS or network issue). URL: ${imgUrl}`);
                    }
                }
            }
            if (!b64) {
                ierror('[ImageService/PiAPI] Unexpected task response:', taskData);
                throw new Error('PiAPI task completed but no image payload found.');
            }
            base64Data = b64;
        }
        else if (imageModel === 'None') {
            // Explicit UX-friendly error when images are disabled
            throw new Error('Image generation is disabled in Settings (Image Generation Model = None). Choose Imagen 3.0/4.0 or a Gemini image-capable model to enable.');
        }
        else {
            ierror(`[ImageService] Unrecognized model: ${imageModel}`);
            throw new Error(`Unrecognized image model: ${imageModel}. Supported prefixes: imagen, gemini.`);
        }

        const requestTime = (performance.now() - startTime) / 1000; // in seconds
        const cost = calculateImageCost(imageModel);
        const base64DataUrl = `data:${mimeTypeForReturn || 'image/png'};base64,${base64Data}`;

        console.log(`[ImageService] Successfully received image data in ${requestTime.toFixed(2)}s. Cost: ${cost.toFixed(5)}`);

        // Determine provider from model name
        const provider = imageModel.startsWith('imagen') ? 'Imagen' :
                        imageModel.startsWith('gemini') ? 'Gemini' :
                        imageModel.startsWith('Qubico/') ? 'PiAPI' :
                        imageModel.startsWith('openrouter/') ? 'OpenRouter' : 'Unknown';

        // Record successful image generation in metrics
        await apiMetricsService.recordMetric({
            apiType: 'image',
            provider,
            model: imageModel,
            costUsd: cost,
            imageCount: 1,
            chapterId,
            success: true,
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
                        cost
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
            cost
        };

    } catch (error: any) {
        console.error(`[ImageService] Image generation failed for prompt: "${prompt}"`, error);

        // Enhanced error handling with specific detection for common issues
        let message = error.message || 'Unknown error occurred';
        let errorType = 'GENERIC_ERROR';

        if (message.includes('API key')) {
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
        const provider = imageModel.startsWith('imagen') ? 'Imagen' :
                        imageModel.startsWith('gemini') ? 'Gemini' :
                        imageModel.startsWith('Qubico/') ? 'PiAPI' :
                        imageModel.startsWith('openrouter/') ? 'OpenRouter' : 'Unknown';

        // Record failed image generation in metrics
        await apiMetricsService.recordMetric({
            apiType: 'image',
            provider,
            model: imageModel,
            costUsd: 0,
            imageCount: 0,
            chapterId,
            success: false,
            errorMessage: message,
        });

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
