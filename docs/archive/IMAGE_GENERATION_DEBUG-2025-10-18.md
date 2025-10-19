# Image Generation Debug Report - OpenRouter gpt-5-image-mini

**Date:** 2025-10-18
**Issue:** Images are not being received from OpenRouter API despite successful requests
**Model:** `openai/gpt-5-image-mini` via OpenRouter

---

## Problem Summary

The application is sending image generation requests to OpenRouter's `gpt-5-image-mini` model, but the response parsing is failing to extract image data. Error logs show two types of failures:

1. **Provider Error (502)**: OpenAI backend returning server errors
2. **Missing Image Data**: Response structure doesn't match expected format

---

## Evidence from Logs

### Error Example 1: Provider 502 Error

```json
{
  "id": "gen-1760720146-9yNHpajXiFsFLRQd4Er6",
  "provider": "OpenAI",
  "model": "openai/gpt-5-image-mini",
  "choices": [{
    "error": {
      "message": "An error occurred while processing your request...",
      "code": 502,
      "metadata": {
        "raw": {
          "code": "server_error",
          "message": "An error occurred while processing your request..."
        },
        "provider_name": "OpenAI"
      }
    },
    "message": {
      "role": "assistant",
      "content": "",
      "refusal": null,
      "reasoning": "**Preparing image generation prompt**...",
      "reasoning_details": [...]
    }
  }],
  "usage": {
    "prompt_tokens": 134,
    "completion_tokens": 0,
    "total_tokens": 134
  }
}
```

**Key Observations:**
- Response has `choices[0].error` field with 502 error code
- `message.content` is empty string `""`
- Model includes `reasoning` and `reasoning_details` (o1-style format)
- No `images` field in `message`

### Error Example 2: Network Error

```
POST https://openrouter.ai/api/v1/chat/completions net::ERR_NETWORK_CHANGED 200 (OK)
TypeError: Failed to fetch
```

**Observation:** Network changed during request, causing fetch to fail

---

## Current Request Format

**File:** `services/imageService.ts:215-229`

```typescript
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
```

**Status:** ✅ Request format appears correct for multimodal models

---

## Response Parsing Logic

### Original Code (BEFORE FIX)

**File:** `services/imageService.ts:243-244`

```typescript
const choice = parsed?.choices?.[0];
const images = choice?.message?.images;
```

**Problem:** Only looked for `message.images` field, which may not exist in OpenAI's response format

### Updated Code (AFTER FIX)

**File:** `services/imageService.ts:243-297`

Changes made:

1. ✅ **Added error checking** - Detect and handle `choice.error` field (lines 245-250)
2. ✅ **Multiple parsing strategies** - Try 3 different locations for image data:
   - `message.images` (OpenRouter custom field)
   - `message.content` as array with image items (OpenAI format)
   - `message.content` as single image object
3. ✅ **Enhanced diagnostics** - Added `contentType`, `isContentArray`, `messageContent` to error logs

```typescript
// Check for error in response
if (choice?.error) {
  const errorMsg = choice.error.message || 'Unknown error from provider';
  const errorCode = choice.error.code || 'UNKNOWN';
  throw new Error(`OpenRouter provider error (${errorCode}): ${errorMsg}`);
}

// Try multiple possible locations for image data
let images = choice?.message?.images;

if (!images && Array.isArray(choice?.message?.content)) {
  images = choice.message.content.filter((item: any) =>
    item.type === 'image' || item.type === 'image_url' || item.image_url
  );
}

if (!images && choice?.message?.content && typeof choice.message.content === 'object' &&
    (choice.message.content.type === 'image' || choice.message.content.image_url)) {
  images = [choice.message.content];
}
```

---

## What Has Been Tried

### ✅ Completed
1. Enhanced error detection for provider errors (502, etc.)
2. Added multiple parsing strategies for different response formats
3. Improved diagnostic logging to show response structure
4. Added validation to check `message.content` type and structure

### ⏳ Pending Investigation

1. **Get successful response example**
   - Need to see what a successful `gpt-5-image-mini` response looks like
   - Current errors are all 502s or network failures
   - **Action:** Retry image generation and capture full successful response

2. **Verify image data location**
   - Where exactly does OpenRouter return image data for this model?
   - Possible locations:
     - `choices[0].message.images[].image_url.url`
     - `choices[0].message.content[].image_url.url` (if content is array)
     - `choices[0].message.content.image_url.url` (if content is object)
     - Some other field we haven't discovered yet
   - **Action:** Check OpenRouter documentation or test with working model

3. **Model-specific behavior**
   - Is `gpt-5-image-mini` actually an image generation model?
   - Does it require special parameters beyond `modalities`?
   - Is it using tool calls to generate images?
   - **Action:** Verify model capabilities via OpenRouter model metadata

4. **Tool/Function calling**
   - Some image generation models use function/tool calling
   - Response might have `tool_calls` field instead of direct image data
   - **Action:** Check if response contains `choices[0].message.tool_calls`

5. **Base64 vs URL format**
   - Current code expects `image_url.url` with data URI format
   - Some APIs return raw base64 in different field
   - **Action:** Check all possible image data fields in successful response

---

## Diagnostic Questions for Next Steps

1. **Has image generation ever worked with this model?**
   - If yes: Get a successful response example
   - If no: Model may not be configured correctly

2. **What does a successful response look like?**
   - Need full JSON structure of successful generation
   - Use browser DevTools Network tab to capture

3. **Are 502 errors consistent or intermittent?**
   - If consistent: Model may be unavailable or misconfigured
   - If intermittent: May be rate limiting or capacity issues

4. **Does a different OpenRouter image model work?**
   - Try `openai/dall-e-3` or `stability-ai/stable-diffusion-xl`
   - Compare response structures

---

## Testing Checklist

- [ ] Retry image generation with updated code
- [ ] Capture full successful response JSON (if any)
- [ ] Check browser DevTools Network tab for actual response
- [ ] Test with alternative image generation model
- [ ] Verify OpenRouter API key has image generation permissions
- [ ] Check OpenRouter dashboard for API errors/logs
- [ ] Review OpenRouter model documentation for `gpt-5-image-mini`
- [ ] Test if model requires specific request parameters

---

## Files Modified

1. **services/imageService.ts** (lines 240-297)
   - Added error handling for provider errors
   - Added multiple image data parsing strategies
   - Enhanced diagnostic logging

---

## Next Immediate Actions

1. **Test the fix:** Try generating an image and observe new error messages
2. **Capture response:** Get full JSON of successful response (if any)
3. **Report findings:** Share what the new diagnostics show
4. **Consult docs:** Check OpenRouter documentation for `gpt-5-image-mini` response format

---

## Contact Points for Help

- **OpenRouter Discord:** May have examples of working image generation
- **OpenRouter Support:** Can clarify response format for specific models
- **OpenAI API Docs:** May document `gpt-5-image-mini` response structure

---

## Code Reference

- Request construction: `services/imageService.ts:215-229`
- Response parsing: `services/imageService.ts:240-297`
- Error handling: `services/imageService.ts:245-250`
- Image extraction: `services/imageService.ts:298-299`
