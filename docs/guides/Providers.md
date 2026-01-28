# Providers & Models

This page orients you to available providers/models and feature support.

## Text Translation

Providers: Gemini, OpenAI, Claude, DeepSeek, OpenRouter (routing).

Examples (see `config/constants.ts` -> `AVAILABLE_MODELS`):

**Gemini:**
- `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`
- `gemini-2.0-flash`, `gemini-2.0-flash-lite`

**OpenAI:**
- `gpt-5`, `gpt-5-mini`, `gpt-5-nano`, `gpt-5-chat-latest`
- `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1-nano`

**Claude:**
- `claude-opus-4-1`, `claude-opus-4-0`, `claude-sonnet-4-0`
- `claude-3-7-sonnet-latest`, `claude-3-5-sonnet-latest`, `claude-3-5-haiku-latest`

**DeepSeek:**
- `deepseek-chat` (non-thinking mode)
- `deepseek-reasoner` (thinking mode)

**OpenRouter:**
- `openai/gpt-4o`, `deepseek/deepseek-reasoner`

Notes:
- Structured outputs/JSON mode and parameter support vary by provider; the app auto-adapts and validates.
- Rate limits/backoff are enforced centrally (Translator + worker), and can be tuned via Settings.

## Image Generation

Models (see `config/constants.ts` -> `AVAILABLE_IMAGE_MODELS`):

**Gemini/Imagen:**
- `gemini-2.5-flash-image-preview`, `gemini-2.0-flash-preview-image-generation`

**PiAPI Flux:**
- `Qubico/flux1-dev`, `Qubico/flux1-schnell`, `Qubico/flux1-dev-advanced`
- Advanced features: LoRA, img2img, negative prompt, guidance scale

**OpenRouter:**
- `openrouter/google/gemini-2.5-flash-image`, `openrouter/google/gemini-3-pro-image-preview`
- `openrouter/openai/gpt-5-image`, `openrouter/openai/gpt-5-image-mini`

Feature Gating:
- Advanced controls (LoRA, guidance, negative prompt, steering images) are enabled for Flux models.
- Capability checks are centralized in `utils/imageModelUtils.ts`.

## Audio Generation

- PiAPI providers: `ace-step`, `diffrhythm`. See `docs/Audio.md`.
