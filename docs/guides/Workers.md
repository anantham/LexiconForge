# Workers & Background Tasks

> **Update (2026-07):** LexiconForge no longer uses Web Workers. The `workers/` directory and its
> `translate.worker.ts` / `epub.worker.ts` were removed. Heavy tasks now run on the main thread,
> orchestrated from the Zustand store. This page documents where that work lives now.

## Translation

Translation runs inline (no worker), orchestrated by the store:

- `store/slices/translationsSlice.ts` queues and persists translation jobs; `store/autoTranslateMediator.ts` decides when to auto-translate.
- Provider routing and request/response handling live in `services/ai/` (`translatorRouter.ts`, `responseValidators.ts`) and `services/translate/`.
- Jobs are processed sequentially (to respect rate limits) and are abortable via `AbortController`; retries use exponential backoff on 429s, and JSON parse errors fail fast.

## EPUB export

EPUB export runs on the main thread via a dynamic `import()` of `services/epubService`:

- Triggered from `store/slices/exportSlice.ts` (`generateEpub`).
- Implementation lives under `services/epubService/` (`data/`, `generators/`, `sanitizers/`, `packagers/`, `templates/`). See [EPUB export](../features/EPUB.md).

## Chapter preloading

Preloading was moved into the store layer (see ADR [`FEAT-001`](../adr/FEAT-001-preloader-strategy.md)); it is not a worker.

## Notes

- Errors surface through store state (`uiSlice` error handling) and the console with detailed messages.
- Consumers should handle cancellation and UI state transitions idempotently.
