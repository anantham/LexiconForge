# Settings Reference

This page summarizes key settings and where they apply. The source of truth for types is `types.ts` (interface `AppSettings`).

## Translation

- `provider`, `model` – see Providers; choose LLM and variant.
- `temperature` (0–2): creativity vs. determinism.
- `topP`, `frequencyPenalty`, `presencePenalty`, `seed` – OpenAI‑compatible params; gated per provider.
- `contextDepth` (0–5): number of prior chapters to include.
- `maxOutputTokens` – cap for long responses (when supported).
- `retryMax`, `retryInitialDelayMs` – backoff config for rate limits.
- `footnoteStrictMode` – `append_missing` (default) or `fail`.

## Reading & Preload

- `preloadCount` – chapters to preload ahead (0–50 recommended).
- Typography: `fontSize`, `fontStyle (sans|serif)`, `lineHeight`.

## Image Generation

- `imageModel` – choose Gemini/Imagen/Flux/etc.
- Defaults: `defaultNegativePrompt`, `defaultGuidanceScale`, `loraStrength`.
- Per‑illustration overrides live in the reader and persist.

## Audio Generation

- Provider/task defaults and presets in `config/app.json`.
- `duration`, `negativePrompt`, volume (UI‑only) and style prompt.

## Export/EPUB

- `exportOrder`: `number` | `navigation`.
- `includeTitlePage`, `includeStatsPage`.
- Optional template overrides: `epubGratitudeMessage`, `epubProjectDescription`, `epubFooter`.

## API Keys

- Supply via `.env.local` as `VITE_*` variables or via Settings UI.
- See `docs/EnvVars.md` for a full list and precedence notes.

