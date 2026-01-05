# Data Schemas (Source of Truth: `types.ts`)

This page summarizes the core data contracts. Refer to `types.ts` for exact interfaces and updates.

## TranslationResult

Key fields:
- `translatedTitle: string`
- `translation: string` (HTML fragment; sanitized before render)
- `proposal: AmendmentProposal | null`
- `footnotes: Footnote[]` - `{ marker: string; text: string; }`
- `suggestedIllustrations: SuggestedIllustration[]` - `{ placementMarker, imagePrompt, generatedImage?, imageCacheKey? }`
- `usageMetrics: UsageMetrics` - `{ totalTokens, promptTokens, completionTokens, estimatedCost, requestTime, provider, model, actualParams? }`

Metadata fields:
- `id?: string` - unique identifier
- `version?: number` - version number
- `provider?: string`, `model?: string`, `temperature?: number`
- `tokensUsed?: TranslationTokensUsed`
- `costUsd?: number`, `requestTime?: number`
- `translationSettings?: TranslationSettingsSnapshot`
- `promptId?: string`, `promptName?: string`

Optional:
- `customVersionLabel?: string`
- `imageVersionState?: Record<string, ImageVersionStateEntry>`

Constraints:
- Every `[ILLUSTRATION-X]` marker in text should have a matching `suggestedIllustrations` entry.
- Footnote markers in text should have matching `footnotes` entries.

## Chapter

- `title`, `content`, `originalUrl`, `nextUrl?`, `prevUrl?`, `chapterNumber?`.

## EnhancedChapter (extends Chapter)

- `id: string` - stable identifier
- `translationResult?: TranslationResult`
- `feedback?: FeedbackItem[]`
- Additional metadata for UI state

## Session Export (high-level)

- `session_metadata`: contains `exported_at` and sanitized settings.
- `urlHistory`: most recent URLs.
- `chapters[]`: includes chapter metadata, translation results, feedback, and numbering.

## Image Storage

- Images stored in IndexedDB via `ImageCacheOps`
- `ImageCacheKey`: `{ chapterId, placementMarker, version }`
- Blob data stored separately, referenced by cache key

## Notes

- EPUB/XHTML imposes sanitization; see `docs/EPUB.md`.
- JSON modes vary by provider; AI services include guardrails and validation.
