# Workers & Batch Jobs

LexiconForge offloads long‑running tasks to Web Workers.

## Translation Worker (`workers/translate.worker.ts`)

Messages from main thread:
- `START_TRANSLATION_JOB` with payload `{ id, chapters[], settings, history, fanTranslation }`
- `CANCEL_TRANSLATION_JOB` with `{ jobId }`

Progress messages to main thread:
- `TRANSLATION_PROGRESS` with `{ jobId, completed, total, currentChapter?, error?, results? }`

Behavior:
- Sequential processing (respects rate limits), abortable via `AbortController`.
- Retries with exponential backoff on 429s; JSON parse errors fail fast.
- History window limited (keeps last ~3) to bound context.

## EPUB Worker (`workers/epub.worker.ts`)

- Similar request/progress contract for EPUB generation; posts incremental updates.

## Notes

- Errors are surfaced via progress `error` and console with detailed messages.
- Consumers should handle cancellation/UI state transitions idempotently.

