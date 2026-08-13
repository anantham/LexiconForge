export type ChatCompletionTokenLimit =
  | { max_completion_tokens: number; max_tokens?: never }
  | { max_tokens: number; max_completion_tokens?: never };

const MAX_COMPLETION_TOKEN_PREFIXES = ['claude', 'gpt-5'] as const;

export const getChatCompletionTokenLimit = (
  model: string,
  maxTokens: number
): ChatCompletionTokenLimit =>
  MAX_COMPLETION_TOKEN_PREFIXES.some(prefix => model.startsWith(prefix))
    ? { max_completion_tokens: maxTokens }
    : { max_tokens: maxTokens };
