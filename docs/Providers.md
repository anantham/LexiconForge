# Providers & Models

This page orients you to available providers/models and feature support.

## Text Translation

Providers: Gemini, OpenAI, Claude, DeepSeek, OpenRouter (routing).

Examples (see `constants.ts` → `AVAILABLE_MODELS`):
- Gemini: `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`
- OpenAI: `gpt-5`, `gpt-5-mini`, `gpt-4.1(-mini|-nano)`
- Claude: `claude-3.7-sonnet-latest`, `claude-opus-4.1`
- DeepSeek: `deepseek-chat`, `deepseek-reasoner`

Notes:
- Structured outputs/JSON mode and parameter support vary by provider; the app auto‑adapts and validates.
- Rate limits/backoff are enforced centrally (Translator + worker), and can be tuned via Settings.

## Image Generation

Models (see `constants.ts` → `AVAILABLE_IMAGE_MODELS`):
- Gemini/Imagen: native Google image models
- PiAPI Flux: `Qubico/flux1-*` (advanced features: LoRA, img2img, negative prompt, guidance scale)
- OpenRouter image slugs: routed Gemini image preview

Feature Gating:
- Advanced controls (LoRA, guidance, negative prompt, steering images) are enabled for Flux models.
- Capability checks are centralized in `utils/imageModelUtils.ts`.

## Audio Generation

- PiAPI providers: `ace-step`, `diffrhythm`. See `docs/Audio.md`.

