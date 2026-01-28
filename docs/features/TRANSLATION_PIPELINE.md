# Translation Pipeline

> Multi-stage system for AI-powered chapter translation with context, caching, and persistence

## Overview

The Translation Pipeline transforms raw chapter content into high-quality translations with contextual awareness, error recovery, and persistence. It orchestrates AI providers, web workers, caching mechanisms, and database operations.

**Key Characteristics:**
- Async-first architecture with web worker offloading
- Multi-provider support (OpenRouter, DeepSeek, Gemini, Claude)
- Intelligent context building from translation history
- Automatic error recovery with exponential backoff
- Rate limiting and quota management
- Full translation versioning and rollback

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│  UI / React Components                              │
│  (ChapterView, TranslationEditor, etc.)             │
└────────────────────┬────────────────────────────────┘
                     │ handleTranslate()
         ┌───────────▼──────────────┐
         │  TranslationsSlice       │
         │  (Zustand Store)         │
         └───────────┬──────────────┘
                     │
         ┌───────────▼────────────────────┐
         │  TranslationService (facade)   │
         │  • validateApiKey()            │
         │  • translateChapter()          │
         │  • buildTranslationHistory()   │
         └───────────┬────────────────────┘
                     │
         ┌───────────▼──────────────────────────┐
         │  Translator (Pure Orchestrator)      │
         │  • Retry logic (exponential backoff) │
         │  • Abort signal handling             │
         │  • Provider routing                  │
         └───────────┬──────────────────────────┘
                     │
         ┌───────────▼──────────────────────────────────┐
         │  AI Provider Adapters                        │
         │  • OpenAIAdapter (OpenRouter/DeepSeek)       │
         │  • GeminiAdapter                             │
         │  • ClaudeAdapter                             │
         └───────────┬──────────────────────────────────┘
                     │
      ┌──────────────┼──────────────┐
      ▼              ▼              ▼
   OpenRouter   Gemini API   Anthropic API
```

## Pipeline Stages

### Stage 1: Input Validation

```typescript
const apiValidation = validateApiKey(settings);
if (!apiValidation.isValid) {
  return { error: `Translation API error: ${apiValidation.errorMessage}` };
}
```

### Stage 2: Context Building

Two strategies for building translation history:

**Synchronous (In-Memory)**:
- Scan loaded chapters for prior translations
- Filter and sort by chapter number
- Return last N chapters (N = contextDepth setting)

**Asynchronous (Hybrid)**:
- Memory-first, then IndexedDB
- Walk prevUrl chain if needed
- Infer and persist chapter numbers

### Stage 3: AI Translation Request

```typescript
interface TranslationRequest {
  title: string;
  content: string;
  settings: AppSettings;
  history: HistoricalChapter[];
  fanTranslation?: string | null;
  abortSignal?: AbortSignal;
}
```

### Stage 4: Post-Processing

**HTML Repair** (optional):
- Lowercase `<I>` tags → `<i>`
- Normalize `<hr />` → `<hr>`
- Bracket bare `ILLUSTRATION-N` → `[ILLUSTRATION-N]`

**HTML Sanitization** (always):
- Whitelist-based XSS prevention
- Allowed tags: `p`, `div`, `i`, `b`, `u`, `br`, `hr`, `ul`, `ol`, `li`, `blockquote`, `em`, `strong`, `a`

### Stage 5: Persistence

```typescript
// Store with versioning
await TranslationOps.storeByStableId(chapterId, result, settings);
```

**Database Schema:**
```
{
  id: string,
  chapterUrl: string,
  stableId: string,
  translation: string,
  translatedTitle: string,
  footnotes: Footnote[],
  version: number,
  isActive: boolean,
  provider: string,
  model: string,
  createdAt: ISO timestamp
}
```

## Error Handling & Retry

### Retry Conditions

```
Max retries: settings.retryMax (default 3)
Initial delay: settings.retryInitialDelayMs (default 2000ms)

For each attempt:
  ├─ If AbortError → fail immediately
  ├─ If JSON parsing error → fail immediately
  ├─ If length_cap error → double maxOutputTokens, retry
  └─ If rate limit (429) → exponential backoff, retry
```

### Exponential Backoff

```
delay = initialDelay * (2 ^ attempt)
capped at maxDelay (default 60 seconds)
```

## Configuration

### Translation Settings

```typescript
interface AppSettings {
  provider: 'OpenRouter' | 'DeepSeek' | 'Gemini' | 'Claude';
  model: string;
  temperature: number;         // 0.0-2.0, default 0.7
  maxOutputTokens?: number;    // default 16384
  contextDepth: number;        // prior chapters for context
  systemPrompt: string;
  enableHtmlRepair: boolean;
  retryMax: number;            // default 3
  retryInitialDelayMs: number; // default 2000
}
```

## Worker Architecture

### Translation Worker (`workers/translate.worker.ts`)

**Message Protocol:**
```typescript
// Main → Worker
{ type: 'START_TRANSLATION_JOB', payload: TranslationJob }
{ type: 'CANCEL_TRANSLATION_JOB', payload: { jobId } }

// Worker → Main
{ type: 'TRANSLATION_PROGRESS', payload: TranslationProgress }
```

**Worker Behavior:**
- For each chapter: check abort, post progress, call translateChapter()
- Rate limit (429): exponential backoff, retry same chapter
- Other error: record error result, continue to next chapter

## Caching Strategies

### Translation Caching

No translation-level caching (each request hits API). Translations are versioned in IndexedDB for rollback.

### Image Caching

```
Cache API (browser disk)
  ↓
IndexedDB (metadata)
  └─ chapterId + placementMarker + version
```

### Rate Limiting

```typescript
await rateLimitService.canMakeRequest(modelId);
// Blocks if over limit, waits for reset window (60s)
```

## State Management

### Zustand Store Integration

```typescript
interface TranslationsState {
  activeTranslations: Record<string, AbortController>;
  pendingTranslations: Set<string>;
  feedbackHistory: Record<string, FeedbackItem[]>;
  amendmentProposals: AmendmentProposal[];
  translationProgress: Record<string, { status, progress?, error? }>;
}
```

**Key Actions:**
- `handleTranslate(chapterId)` → main entry point
- `cancelTranslation(chapterId)` → abort + cleanup
- `buildTranslationHistory(chapterId)` → context construction

## Troubleshooting

### No Translation Context Available

**Diagnosis:**
1. Are previous chapters loaded in the browser?
2. Have previous chapters been translated (check IndexedDB)?
3. Are chapters assigned sequential numbers?

### Rate Limit Errors (429)

**Recovery:**
- Translator implements exponential backoff
- Automatic retry on next reset window (60s)

**Manual Fix:** Reduce contextDepth, translate sequentially

### HTML Repair Breaking Content

**Fix:** Disable `settings.enableHtmlRepair = false`

## Related Documentation

- **AI Providers:** See [Providers.md](../guides/Providers.md)
- **Database Schema:** See [INDEXEDDB_SCHEMA.md](../guides/INDEXEDDB_SCHEMA.md)
- **Workers:** See [Workers.md](../guides/Workers.md)
- **State Management:** See [STATE_MANAGEMENT.md](../guides/STATE_MANAGEMENT.md)
