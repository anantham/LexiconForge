# Debugging & Diagnostics

LexiconForge includes explicit, opt‑in diagnostics. Enable only while developing or investigating issues.

## Enabling Flags

Set these in browser DevTools console (persisted in localStorage):

- `localStorage.setItem('LF_AI_DEBUG', '1')` – high‑level AI request/response logs
- `localStorage.setItem('LF_AI_DEBUG_FULL', '1')` – include full payloads (sensitive)
- `localStorage.setItem('LF_AI_DEBUG_LEVEL', 'trace' | 'debug' | 'info')` – optional level
- `localStorage.setItem('LF_AUDIO_DEBUG', '1')` – audio generation logs
- `localStorage.setItem('LF_PROVIDER_DEBUG', '1')` – provider HTTP request/response summaries
- `localStorage.setItem('store-debug', '1')` – store lifecycle/debug messages

Remove with `localStorage.removeItem('<KEY>')` or clear Storage.

## Where Logs Appear

- Browser console: tagged messages (e.g., `[OpenAI]`, `[Gemini]`, `[AudioService]`, `[EPUB]`, `[Store]`).
- Error surfaces: UI toasts/messages on failures; workers post progress events.

## Safety Notes

- Do not enable `LF_AI_DEBUG_FULL` in production; payloads may include text excerpts.
- Respect provider rate limits; retry/backoff is implemented but still incurs costs.

## Memory Monitoring & Telemetry

LexiconForge includes automatic memory monitoring that runs every 30 seconds (Chromium browsers only).

### Memory Warning System

When memory usage exceeds **90%**, the telemetry service automatically logs a detailed warning with:

#### 1. Basic Memory Stats
```javascript
{
  usedMB: "3963.45",       // Current heap usage
  limitMB: "4095.75",      // Heap size limit
  percentUsed: "96.8",     // Percentage used
  threshold: "90%"         // Warning threshold
}
```

#### 2. Detailed Memory Breakdown
Shows what's consuming memory:

```javascript
breakdown: {
  chapters: {
    total: 87,                        // Total chapters loaded
    withTranslations: 87,             // Chapters with translations
    withImages: 23,                   // Chapters with illustration data
    translationDataSizeKB: "4523.2"  // Translation text size
  },
  images: {
    total: 45,                        // Total image slots
    base64Stored: 23,                 // Images stored as base64
    base64DataSizeMB: "156.73",      // Base64 image data size
    avgImageSizeKB: "6814.5"          // Average size per image
  },
  translationHistory: {
    entriesCount: 15                  // Cached history entries
  }
}
```

#### 3. Actionable Recommendations
Context-aware suggestions to reduce memory usage:

```javascript
recommendations: [
  "⚠️ 23 base64 images consuming 156.73MB - consider clearing old chapters",
  "📚 87 chapters loaded - consider clearing old chapters from session"
]
```

### Common Memory Issues

#### High Base64 Image Storage (Most Common)
**Symptom:** `breakdown.images.base64DataSizeMB` > 50MB
**Cause:** Generated images stored as base64 strings in memory
**Solution:**
- Use the trash icon to clear old chapters
- Refresh the page to start a new session
- Consider disabling automatic image generation (set `imageModel: "none"`)

#### Too Many Chapters Loaded
**Symptom:** `breakdown.chapters.total` > 50
**Cause:** Long reading session with many chapters
**Solution:**
- Clear old chapters from the session
- Use the export feature to save chapters before clearing

#### Large Translation Data
**Symptom:** `breakdown.chapters.translationDataSizeKB` > 5000KB
**Cause:** Normal for many translated chapters
**Solution:** Usually not a problem, but can clear if memory is tight

### Accessing Memory Stats Programmatically

In DevTools console:
```javascript
// Get current memory usage
window.__APP_STORE__.getState().generatedImages

// Count chapters
window.__APP_STORE__.getState().chapters.size

// Check settings
window.__APP_STORE__.getState().settings
```

### Disabling Memory Monitoring

Memory monitoring is always active but only logs warnings at >90% usage. There's no need to disable it as it has minimal performance impact (~50ms every 30 seconds).

## Useful Spots

- Translation: `services/aiService.ts`, `services/claudeService.ts`, `services/translate/Translator.ts`
- Image Gen: `services/imageService.ts`, `components/AdvancedImageControls.tsx`
- Audio: `services/audio/*`
- EPUB: `services/epub/*`
- Store: `store/*`
- Telemetry: `services/telemetryService.ts`

