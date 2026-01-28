import type { AppSettings } from '../../types';
import type { ApiCallType } from '../../services/apiMetricsService';

export type ProviderName = 'Gemini' | 'DeepSeek' | 'OpenRouter' | 'Claude' | 'OpenAI';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export interface ChatRequest {
  settings?: AppSettings;
  messages?: ChatMessage[];
  system?: string;
  user?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  schema?: any;
  schemaName?: string;
  structuredOutputs?: boolean;
  abortSignal?: AbortSignal;
  apiType?: ApiCallType;
  chapterId?: string;
}

export interface ChatResponse {
  text: string;
  // Optional metadata we may enrich later
  tokens?: { prompt?: number; completion?: number; total?: number };
  costUsd?: number;
  model?: string;
  raw?: unknown;
}

export interface Provider {
  name: ProviderName;
  chatJSON(input: ChatRequest): Promise<ChatResponse>;
}
