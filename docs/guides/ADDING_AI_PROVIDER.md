# Adding a New AI Provider

Step-by-step guide for integrating a new AI provider into LexiconForge.

## Prerequisites

- **Provider API access**: API key or authentication method
- **API documentation**: Understanding of endpoints and request/response format
- **SDK availability**: Ideally an official npm package
- **Understanding of existing adapters**: Review ClaudeAdapter, GeminiAdapter, or OpenAIAdapter

## Understanding the Adapter Pattern

LexiconForge uses two adapter interfaces:

### 1. Provider Interface (generic chat)

```typescript
export interface Provider {
  name: ProviderName;
  chatJSON(input: ChatRequest): Promise<ChatResponse>;
}
```

Used for Sutta Studio compiler, generic chat operations.

### 2. TranslationProvider Interface (translation)

```typescript
export interface TranslationProvider {
  translate(request: TranslationRequest): Promise<TranslationResult>;
}
```

Used for chapter translation with specialized prompt handling.

## Step-by-Step Implementation

### Step 1: Create the Adapter Class

**File**: `adapters/providers/YourProviderAdapter.ts`

```typescript
import type { ChatRequest, ChatResponse, Provider, ProviderName } from './Provider';
import type { TranslationProvider, TranslationRequest } from '../../services/translate/Translator';
import type { TranslationResult, AppSettings } from '../../types';
import { calculateCost } from '../../services/aiService';
import { apiMetricsService } from '../../services/apiMetricsService';
import { getEnvVar } from '../../services/env';

export class YourProviderAdapter implements Provider, TranslationProvider {
  name: ProviderName = 'YourProvider';

  async chatJSON(input: ChatRequest): Promise<ChatResponse> {
    // Implementation here
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    // Implementation here (optional)
  }
}
```

### Step 2: Implement chatJSON Method

```typescript
async chatJSON(input: ChatRequest): Promise<ChatResponse> {
  const settings = input.settings;
  if (!settings) throw new Error('chatJSON requires settings');

  // 1. Get API key
  const apiKey = settings.apiKeyYourProvider || getEnvVar('YOUR_PROVIDER_API_KEY');
  if (!apiKey) {
    throw new Error('YourProvider API key is missing. Please add it in settings.');
  }

  // 2. Prepare messages
  const messages = input.messages?.length
    ? input.messages
    : [
        ...(input.system ? [{ role: 'system' as const, content: input.system }] : []),
        ...(input.user ? [{ role: 'user' as const, content: input.user }] : []),
      ];

  // 3. Initialize client and make request
  const client = this.initializeClient(apiKey);

  try {
    const response = await client.chat.completions.create({
      model: input.model || settings.model,
      messages: this.formatMessages(messages),
      temperature: input.temperature ?? settings.temperature ?? 0.2,
      max_tokens: input.maxTokens ?? settings.maxOutputTokens,
    });

    // 4. Extract response
    const responseText = response.choices[0]?.message?.content || '';
    if (!responseText.trim()) {
      throw new Error('Empty response from YourProvider');
    }

    // 5. Calculate cost and record metrics
    const promptTokens = response.usage?.prompt_tokens || 0;
    const completionTokens = response.usage?.completion_tokens || 0;
    const costUsd = await calculateCost(input.model, promptTokens, completionTokens);

    await apiMetricsService.recordMetric({
      apiType: input.apiType ?? 'sutta_studio',
      provider: settings.provider,
      model: input.model,
      costUsd,
      tokens: { prompt: promptTokens, completion: completionTokens, total: promptTokens + completionTokens },
      chapterId: input.chapterId,
      success: true,
    });

    return {
      text: responseText,
      tokens: { prompt: promptTokens, completion: completionTokens },
      costUsd,
      model: input.model,
      raw: response,
    };

  } catch (error: any) {
    await apiMetricsService.recordMetric({
      apiType: input.apiType ?? 'sutta_studio',
      provider: settings.provider,
      model: input.model,
      costUsd: 0,
      tokens: { prompt: 0, completion: 0, total: 0 },
      chapterId: input.chapterId,
      success: false,
      errorMessage: error.message,
    });
    throw error;
  }
}
```

### Step 3: Update Provider Type

**File**: `adapters/providers/Provider.ts`

```typescript
export type ProviderName = 'Gemini' | 'DeepSeek' | 'OpenRouter' | 'Claude' | 'OpenAI' | 'YourProvider';
```

### Step 4: Register the Provider

**File**: `adapters/providers/index.ts`

```typescript
import { YourProviderAdapter } from './YourProviderAdapter';

const yourProviderAdapter = new YourProviderAdapter();

// Register for translation
translator.registerProvider('YourProvider', yourProviderAdapter);

// Register for generic chat
registerProvider(yourProviderAdapter);
```

### Step 5: Update AppSettings

**File**: `types/index.ts`

```typescript
export interface AppSettings {
  // ... existing fields
  apiKeyYourProvider?: string;
}
```

## Error Handling Patterns

### Missing API Keys

```typescript
const apiKey = settings.apiKeyYourProvider || getEnvVar('YOUR_PROVIDER_API_KEY');
if (!apiKey) {
  throw new Error('YourProvider API key is missing. Please add it in settings.');
}
```

### Empty Responses

```typescript
const responseText = response.choices[0]?.message?.content || '';
if (!responseText.trim()) {
  throw new Error('Empty response from YourProvider');
}
```

### JSON Parsing Fallback

```typescript
try {
  parsed = JSON.parse(responseText);
} catch (error) {
  const extracted = this.extractBalancedJson(responseText);
  if (extracted) {
    parsed = JSON.parse(extracted);
  } else {
    throw new Error(`No valid JSON found in response`);
  }
}
```

### Abort Signal Support

```typescript
if (input.abortSignal?.aborted) {
  throw new DOMException('Aborted', 'AbortError');
}

const response = await client.chat.completions.create(
  requestOptions,
  { signal: input.abortSignal }
);
```

## Testing

### Unit Tests

**File**: `tests/adapters/providers/YourProviderAdapter.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { YourProviderAdapter } from '../../../adapters/providers/YourProviderAdapter';

// Mock the provider SDK
vi.mock('your-provider-sdk', () => ({ ... }));

describe('YourProviderAdapter', () => {
  it('should call chatJSON and return response', async () => {
    const adapter = new YourProviderAdapter();
    const result = await adapter.chatJSON({
      user: 'Test message',
      settings: baseSettings,
    });
    expect(result.text).toBeTruthy();
  });

  it('should throw error when API key is missing', async () => {
    // ...
  });

  it('should record metrics on success', async () => {
    // ...
  });
});
```

## Checklist

- [ ] Created `adapters/providers/YourProviderAdapter.ts`
- [ ] Implemented `Provider` interface with `chatJSON` method
- [ ] (Optional) Implemented `TranslationProvider` interface
- [ ] Added error handling (missing keys, empty responses, JSON parsing)
- [ ] Added abort signal support
- [ ] Added metrics recording
- [ ] Updated `ProviderName` type
- [ ] Registered in `index.ts`
- [ ] Added API key field to `AppSettings`
- [ ] Created unit tests
- [ ] Tested with real API calls

## References

- **Provider Interface**: `adapters/providers/Provider.ts`
- **Translator**: `services/translate/Translator.ts`
- **Existing adapters**: `adapters/providers/ClaudeAdapter.ts`, `GeminiAdapter.ts`, `OpenAIAdapter.ts`
- **Provider Architecture**: [PROVIDER_ARCHITECTURE.md](../architecture/PROVIDER_ARCHITECTURE.md)
