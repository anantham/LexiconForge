# Audio Generation

This guide explains how to generate background music and audio cues directly in LexiconForge.

## Overview

- Providers: `ace-step` and `diffrhythm` via PiAPI
- Tasks: `txt2audio` (from style prompt) and `audio2audio` (style transfer)
- UI: Controls live in the reader via Audio Controls and Audio Player
- Storage: Results cached and addressable; supports pinning and metrics

## Requirements

- API key: set `VITE_PIAPI_API_KEY` in `.env.local` or add in Settings → API Keys

## Quick Start

1. Open Settings → Audio Generation and review defaults (duration, volume, negative prompt).
2. In the reader, open Audio Controls, pick a style preset, adjust the style prompt, and generate.
3. Use Audio Player to preview, scrub, and manage playback.

## Concepts

- Style Presets: Curated prompts in `config/app.json` → `audioGeneration.stylePresets`.
- Tasks:
  - `txt2audio`: Generate from a text style description (default).
  - `audio2audio`: Provide a reference audio clip to transfer style.
- Costs:
  - `ace-step`: ~$0.0005/second (config-driven; may change by provider).
  - `diffrhythm`: fixed cost per generation (see `config/app.json`).

## Debugging

- Enable `LF_AUDIO_DEBUG=1` (and optionally `LF_PROVIDER_DEBUG=1`) in localStorage to see detailed logs.
- Errors surface in the UI and console with provider responses.

## Implementation Notes

- Service layer: `services/audio/*`
- Types: `types.ts` (Audio*)
- UI: `components/AudioControls.tsx`, `components/AudioPlayer.tsx`

