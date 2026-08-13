# Provider/Adapter Architecture

> How LexiconForge abstracts AI providers behind a unified interface

## Overview

LexiconForge implements a **provider adapter pattern** to abstract different AI service providers (Gemini, Claude, OpenAI, OpenRouter, DeepSeek) behind unified interfaces. This enables:

- **Provider agnostic code** - Translation and compilation don't know which provider they're using
- **Runtime provider selection** - Users can switch providers without code changes
- **Capability detection** - Dynamic detection of which features each provider supports
- **Graceful degradation** - Fallback behavior when providers don't support certain features

## Architecture Layers

```
┌─────────────────────────────────────────────────────┐
│  Applications (Translation, Compilation, etc.)      │
├─────────────────────────────────────────────────────┤
│  Translator Orchestrator                            │
│  - Retry logic, error handling, sanitization       │
├─────────────────────────────────────────────────────┤
│  Provider Adapters                                  │
│  - OpenAIAdapter, GeminiAdapter, ClaudeAdapter     │
├─────────────────────────────────────────────────────┤
│  Capability Detection (capabilityService)          │
│  - Runtime capability queries                       │
├─────────────────────────────────────────────────────┤
│  AI Provider APIs                                   │
└─────────────────────────────────────────────────────┘
```

## Core Interfaces

### Provider Interface

```typescript
export type ProviderName = 'Gemini' | 'DeepSeek' | 'OpenRouter' | 'Claude' | 'OpenAI';

export interface Provider {
  name: ProviderName;
  chatJSON(input: ChatRequest): Promise<ChatResponse>;
}

export interface ChatRequest {
  settings?: AppSettings;
  messages?: ChatMessage[];
  system?: string;
  user?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  schema?: any;
  structuredOutputs?: boolean;
  abortSignal?: AbortSignal;
}

export interface ChatResponse {
  text: string;
  tokens?: { prompt?: number; completion?: number; total?: number };
  costUsd?: number;
  model?: string;
}
```

### TranslationProvider Interface

```typescript
export interface TranslationProvider {
  translate(request: TranslationRequest): Promise<TranslationResult>;
}
```

## Provider Implementations

### OpenAIAdapter

**Used for**: OpenAI, OpenRouter, DeepSeek (all OpenAI-compatible APIs)

```typescript
const { apiKey, baseURL } = getOpenAICompatibleConfig(
  settings,
  settings.provider
);

if (!apiKey) {
  throw new Error(`${settings.provider} API key is missing. Please add it in Settings.`);
}
```

### GeminiAdapter

**Used for**: Google Gemini models

- Native Google Generative AI SDK
- JSON schema support via `responseMimeType` and `responseSchema`
- System instructions via preamble (no native system parameter)

### ClaudeAdapter

**Used for**: Anthropic Claude models

- Anthropic SDK integration
- Native system parameter support
- Legacy wrapper around existing `translateWithClaude` service

## Capability Detection

### capabilityService

Runtime metadata for Settings hints and pricing:

```typescript
// Check structured output support
const hasStructuredOutputs = await supportsStructuredOutputs('OpenRouter', 'openai/gpt-4o');

// Check parameter support
const supportsTemp = await supportsParameters('OpenRouter', 'gpt-4o', ['temperature']);

// Get model pricing
const pricing = await getModelPricing('gpt-4o');
```

Ordinary request construction does not await this metadata service. Initial structured-output
mode comes from the synchronous transport policy in `services/ai/structuredOutputPolicy.ts`;
OpenAI-compatible adapters use a bounded `json_schema` to `json_object` fallback when the
configured provider explicitly rejects the schema request. This keeps metadata outages off the
paid request path while retaining adaptive behavior for OpenRouter's model-dependent support.

### Capability Matrix

| Feature | OpenAI | OpenRouter | Claude | Gemini | DeepSeek |
|---------|--------|-----------|--------|--------|----------|
| **Structured Outputs** | ✓ (gpt-4o+) | ✓ (varies) | ✗ | ✓ | ✗ |
| **temperature** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **top_p** | ✓ | ✓ | ✓ | ✗ | ✗ |
| **frequency_penalty** | ✓ | ✓ | ✓ | ✗ | ✗ |
| **seed** | ✓ | ✗ | ✗ | ✗ | ✗ |
| **system parameter** | ✓ | ✓ | ✓ | ✗ | ✓ |

## Request/Response Flow

```
translateChapter()
  ↓
translator.translate()
  ├─ Get appropriate adapter
  ├─ Call adapter.translate(request)
  └─ Sanitize result
  ↓
Provider Adapter
  ├─ Resolve API configuration
  ├─ Query capability service
  ├─ Build request (only supported params)
  ├─ Call provider API
  ├─ Parse JSON (with fallback extraction)
  ├─ Record metrics
  └─ Return result
```

## Error Handling

### JSON Parsing Fallback

```typescript
try {
  parsed = JSON.parse(responseText);
} catch (error) {
  const extracted = extractBalancedJson(responseText);
  if (extracted) {
    parsed = JSON.parse(extracted);
  } else {
    throw new Error('No valid JSON found');
  }
}
```

### Truncation Detection

```typescript
if (finishReason === 'length' || seemsTruncated(responseText)) {
  throw new Error('length_cap: Model hit token limit');
}
```

### Parameter Error Handling

```typescript
try {
  response = await client.chat.completions.create(options);
} catch (error) {
  if (isParameterError(error)) {
    const simpleOptions = removeAdvancedParameters(options);
    response = await client.chat.completions.create(simpleOptions);
  } else {
    throw error;
  }
}
```

### Retry Strategy

```typescript
for (let attempt = 0; attempt < maxRetries; attempt++) {
  try {
    return await provider.translate(request);
  } catch (error) {
    if (isJsonParsingError(error)) throw error;  // Fail fast
    if (isLengthCap) { request.maxOutputTokens *= 2; continue; }
    if (isRateLimit) { await delay(initialDelay * 2 ** attempt); continue; }
  }
}
```

## Provider Registration

```typescript
// adapters/providers/index.ts
const openRouterAdapter = new OpenAIAdapter('OpenRouter');
const geminiAdapter = new GeminiAdapter();
const claudeAdapter = new ClaudeAdapter();

// Register for translation
translator.registerProvider('OpenRouter', openRouterAdapter);
translator.registerProvider('Gemini', geminiAdapter);
translator.registerProvider('Claude', claudeAdapter);

// Register for generic chat
registerProvider(openRouterAdapter);
registerProvider(geminiAdapter);
registerProvider(claudeAdapter);
```

## API Key Boundary

Browser provider calls have exactly one credential source: the current user's Settings value (`settings.apiKey{Provider}`), resolved through `services/ai/providerCredentials.ts`.

- Build-time and runtime environment fallbacks are forbidden in browser services.
- There is no shared client-side trial key.
- Node-only benchmark scripts may read `process.env.OPENROUTER_API_KEY`; that path is outside the browser adapter graph.
- Shared funded access would require an authenticated server-side broker and a separate architecture decision.

## Metrics Recording

All adapter calls record metrics:

```typescript
await apiMetricsService.recordMetric({
  apiType: 'translation' | 'sutta_studio' | 'illustration',
  provider: 'OpenRouter',
  model: 'gpt-4o',
  costUsd: 0.025,
  tokens: { prompt: 1000, completion: 500, total: 1500 },
  chapterId: 'chapter-123',
  success: true,
});
```

## Best Practices

### For Provider-Agnostic Code

```typescript
// Good: Use abstract interfaces
async function translateWithAnyProvider(request: TranslationRequest) {
  return translator.translate(request);
}

// Avoid: Checking provider directly
if (settings.provider === 'OpenRouter') { ... }
```

### For Using Providers

1. **Never assume capability** - always query capability service
2. **Handle unsupported parameters** - adapters will strip them
3. **Distinguish error types** - JSON parsing vs API errors
4. **Leverage retry logic** - Translator handles rate limits

## References

- **Provider Interface**: `adapters/providers/Provider.ts`
- **Registry**: `adapters/providers/registry.ts`
- **Translator**: `services/translate/Translator.ts`
- **Capability Service**: `services/capabilityService.ts`
- **Adding a Provider**: [ADDING_AI_PROVIDER.md](../guides/ADDING_AI_PROVIDER.md)
