export type ProviderName = 'OpenAI' | 'Gemini';

export interface CassetteRequest {
  title: string;
  content: string;
  systemPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  includeFanTranslationInPrompt?: boolean;
  enableAmendments?: boolean;
}

export interface CassetteExpected {
  translatedTitle: string;
  translation: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
}

export interface BaseCassette {
  name: string;
  provider: ProviderName;
  model: string;
  request: CassetteRequest;
  expected: CassetteExpected;
}

export interface OpenAICassette extends BaseCassette {
  provider: 'OpenAI';
  mock: {
    sdkResponse: unknown;
  };
}

export interface GeminiCassette extends BaseCassette {
  provider: 'Gemini';
  mock: {
    responseText: string;
    usageMetadata: {
      promptTokenCount: number;
      candidatesTokenCount: number;
    };
  };
}

