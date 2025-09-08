# Data Schemas (Source of Truth: `types.ts`)

This page summarizes the core data contracts. Refer to `types.ts` for exact interfaces and updates.

## TranslationResult

Key fields:
- `translatedTitle: string`
- `translation: string` (HTML fragment; sanitized before render)
- `footnotes: { marker: string; text: string; }[]`
- `suggestedIllustrations: { placementMarker: string; imagePrompt: string; generatedImage? }[]`
- `usageMetrics: { totalTokens, promptTokens, completionTokens, estimatedCost, requestTime, provider, model, actualParams? }`

Constraints:
- Every `[ILLUSTRATION-X]` marker in text should have a matching `suggestedIllustrations` entry.
- Footnote markers in text should have matching `footnotes` entries.

## Chapter

- `title`, `content`, `originalUrl`, `nextUrl?`, `prevUrl?`, `chapterNumber?`.

## Session Export (high‑level)

- `session_metadata`: contains `exported_at` and sanitized settings.
- `urlHistory`: most recent URLs.
- `chapters[]`: includes chapter metadata, translation results, feedback, and numbering.

## Illustration Storage

- `generatedImage.imageData`: base64 for quick render and export.

## Notes

- EPUB/XHTML imposes sanitization; see `docs/EPUB.md`.
- JSON modes vary by provider; AI services include guardrails and validation.

