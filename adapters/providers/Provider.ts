export type ProviderName = 'Gemini' | 'DeepSeek' | 'OpenRouter' | 'Claude';

export interface ChatRequest {
  system?: string;
  user: string;
  model: string;
  temperature?: number;
}

export interface ChatResponse {
  text: string;
  // Optional metadata we may enrich later
  tokens?: { prompt?: number; completion?: number; total?: number };
  costUsd?: number;
  raw?: unknown;
}

export interface Provider {
  name: ProviderName;
  chatJSON(input: ChatRequest): Promise<ChatResponse>;
}

