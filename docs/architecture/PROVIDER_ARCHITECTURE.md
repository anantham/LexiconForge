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
switch (settings.provider) {
  case 'OpenAI':
    baseURL = 'https://api.openai.com/v1';
    apiKey = settings.apiKeyOpenAI || getEnvVar('OPENAI_API_KEY');
    break;
  case 'OpenRouter':
    baseURL = 'https://openrouter.ai/api/v1';
    apiKey = settings.apiKeyOpenRouter || getDefaultApiKey();
    break;
  case 'DeepSeek':
    baseURL = 'https://api.deepseek.com/v1';
    apiKey = settings.apiKeyDeepSeek;
    break;
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

Runtime detection of provider capabilities:

```typescript
// Check structured output support
const hasStructuredOutputs = await supportsStructuredOutputs('OpenRouter', 'openai/gpt-4o');

// Check parameter support
const supportsTemp = await supportsParameters('OpenRouter', 'gpt-4o', ['temperature']);

// Get model pricing
const pricing = await getModelPricing('gpt-4o');
```

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

## API Key Resolution Priority

1. **User settings** (`settings.apiKey{Provider}`)
2. **Environment variables** (`OPENAI_API_KEY`, etc.)
3. **Trial key** (OpenRouter only via `getDefaultApiKey()`)

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
