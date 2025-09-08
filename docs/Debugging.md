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

## Useful Spots

- Translation: `services/aiService.ts`, `services/claudeService.ts`, `services/translate/Translator.ts`
- Image Gen: `services/imageService.ts`, `components/AdvancedImageControls.tsx`
- Audio: `services/audio/*`
- EPUB: `services/epub/*`
- Store: `store/*`

