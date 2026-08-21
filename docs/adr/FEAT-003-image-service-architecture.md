# FEAT-003: Image Service Architecture

**Status:** Implemented
**Date:** 2026-03-08
**Domain:** Image Generation & Storage

### Implementation Notes (2026-03-20)

Architecture implemented as documented. Key files confirmed at their stated locations:
- `services/imageService.ts`, `services/imageGenerationService.ts`, `services/imageCacheService.ts`, `services/imageMigrationService.ts`, `services/imageUtils.ts`
- `store/slices/imageSlice.ts` (1,081 LOC)
- `config/costs.ts` for provider cost tracking
- Known debt items (no unit tests, blob URL lifecycle) remain open.

### Implementation Notes (2026-04-03)

Image prompting now includes a structured planning layer rather than treating the human-facing caption as the sole machine prompt source:
- `services/imagePlanPlanner.ts` generates `{ imagePrompt, imagePlan }` via the active text provider/model with schema enforcement where available and caption-derived fallback on planner failure.
- `services/imagePlanService.ts` normalizes editable `ImagePlan` JSON and compiles provider-aware generation prompts from caption + plan.
- `components/Illustration.tsx` and `components/illustration/IllustrationPromptEditor.tsx` now expose the JSON plan in the UI, including an explicit `AI Regenerate JSON` action to hand ownership back to the planner.
- `services/openrouterImageModelAdapter.ts` now serves as the verified OpenRouter image-model catalog for picker and request shaping, replacing the earlier stale static list approach.

---

## Context

LexiconForge generates AI illustrations for translated chapters using multiple providers
(Imagen, Gemini, OpenRouter/Flux, PiAPI). The system needs to orchestrate generation,
manage versioning, handle storage efficiently, and track costs — all from the browser.

---

## Architecture

```
UI (Illustration.tsx, GalleryPanel.tsx)
  ↓
Zustand Store (imageSlice.ts — 1,081 LOC)
  ├── State: generatedImages, imageVersions, activeImageVersion, advancedControls
  ├── Actions: handleGenerateImages, handleRetryImage, loadExistingImages
  └── Versioning: immutable version numbers, user-selectable active version
  ↓
High-Level Service (imageGenerationService.ts — 574 LOC)
  ├── generateImagesForChapter() — orchestrates full chapter generation
  ├── retryImage() — single image retry
  └── loadExistingImages() — hydrates state from storage
  ↓
Core Generation (imageService.ts — 865 LOC)
  ├── generateImage() — provider dispatch + API calls
  ├── calculateImageCost() — static pricing from config/costs.ts
  └── fetchOpenRouterImagePrice() — dynamic pricing (cached)
  ↓
Storage Layer
  ├── Cache API (imageCacheService.ts — 392 LOC)
  │   └── Version-aware: /images/{chapterId}/{marker}/v{version}
  ├── IndexedDB — metadata + version tracking
  └── Migration (imageMigrationService.ts — 242 LOC)
      └── Legacy base64 → Cache API batch migration
```

---

## Key Decisions

### 1. Cache API over IndexedDB for image blobs

**Why:** Base64 strings in IndexedDB consume ~1.37× the raw image size in RAM. Cache API
stores blobs on disk, served via `createBlobUrl()` on demand. Trade-off: blob URLs are
session-scoped and must be regenerated per render.

### 2. Immutable version numbering

Each generation creates version N+1. Deletion shifts remaining versions down. The user
selects `activeImageVersion` independently — switching versions doesn't regenerate.

### 3. No provider auto-fallback

When a provider fails, the error includes `canRetry` and `suggestedActions` for the user.
We don't silently fall back to another provider because: different providers have different
costs, quality, and style. The user should make that choice.

### 4. Dual pricing model

- **Static** (`config/costs.ts`): 14 providers with known per-image costs
- **Dynamic** (OpenRouter): fetches per-token pricing, cached in memory

Known issue: OpenRouter returns per-token, not per-image. A console warning flags this.

### 5. Advanced controls as flat state

Steering images, negative prompts, guidance scale, LoRA models/strengths are stored as
flat `Record<string, T>` maps keyed by `chapterId:marker`. This avoids nested state
updates but creates many top-level keys in the store.

---

## File Inventory

| File | LOC | Role |
|------|-----|------|
| `services/imageService.ts` | 865 | Core generation + provider dispatch |
| `services/imageGenerationService.ts` | 574 | High-level orchestration + persistence |
| `store/slices/imageSlice.ts` | 1,081 | State management + versioning |
| `services/imageCacheService.ts` | 392 | Cache API wrapper (version-aware) |
| `services/imageMigrationService.ts` | 242 | Legacy base64 → Cache API migration |
| `services/imageUtils.ts` | 227 | Resize, base64 conversion, compression |
| `config/costs.ts` | 146 | Static cost constants |

---

## Known Debt

| Item | Severity | Notes |
|------|----------|-------|
| `imageSlice.ts` at 1,081 LOC | Medium | Multiple change reasons; decomposition proposed |
| OpenRouter per-token pricing mismatch | Low | Console warns; cost display may be inaccurate |
| No unit tests for imageService | High | Provider error paths, cost calc untested |
| Blob URL lifecycle | Low | Created on-demand per render; no caching layer |

---

## Related

- [Image Versioning Plan](../archive/plans/2025-10-15-image-versioning-phase3-4.md) — ✅ Implemented
- [Gallery & Cover Selection](../archive/plans/2025-12-29-gallery-cover-selection-design.md) — ✅ Implemented
- `docs/features/ImageGeneration.md` — User-facing guide

---

## Amendment — 2026-08-21: Opt-in IndrasNet workflow provider

**Status:** Implemented on `feat/codex-indrasnet-image-provider`.

The original no-auto-fallback decision remains the default. LexiconForge now
supports a self-hosted Asus/IndrasNet provider with one narrow, explicit
exception: while an IndrasNet workflow is selected, the user may separately
select a cloud fallback model. That fallback runs only when the broker returns a
retryable availability failure (for example `GPU_BUSY` or `COMFYUI_OFFLINE`). It
does not run for invalid manifests, unsupported semantic inputs, or other
configuration errors.

### Decision

1. The browser discovers workflows from `GET /api/comfyui/workflows`; only
   client-ready text-to-image manifests with a semantic `prompt` binding enter
   the image-model dropdown.
2. Image model IDs use `indrasnet/<encoded-workflow-name>`. LexiconForge sends
   semantic fields, never ComfyUI node IDs. IndrasNet owns the graph-specific
   mapping.
3. Production browsers use the Tailscale Serve HTTPS endpoint. A raw
   `http://100.x.x.x` URL is useful for local HTTP development but is blocked as
   mixed content when LexiconForge itself is loaded over HTTPS.
4. Local provider spend is recorded as `$0` in the external API ledger. This is
   not a claim that electricity or hardware is free.
5. Every successful result records the provider and executed model. If the
   explicit cloud fallback ran, provenance also records the attempted local
   model and structured failure reason.

### Implementation notes

- `services/providers/indrasNetImageProvider.ts` owns discovery, semantic
  requests, structured error preservation, and image download.
- `services/imageGenerationFallback.ts` owns the opt-in fallback policy.
- `services/imageService.ts` remains the provider dispatcher and metrics/cache
  boundary.
- `components/settings/IndrasNetImageProviderSection.tsx` exposes endpoint,
  discovery state, and fallback selection.

### Review hardening — 2026-08-21

- Unstructured HTTP 500/503 responses are not sufficient to authorize a cloud
  fallback. The client accepts an explicit structured `retryable: true`, while
  unstructured 502/504 gateway failures remain availability signals.
- Completed-workflow image downloads have a separate 60-second budget and do
  not trigger cloud generation if transfer fails.
- If the selected fallback also fails, one descriptive error preserves both
  provider/model attempts and both failure reasons.
