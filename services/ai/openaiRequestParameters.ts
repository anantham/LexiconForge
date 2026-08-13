export type ChatCompletionTokenLimit =
  | { max_completion_tokens: number; max_tokens?: never }
  | { max_tokens: number; max_completion_tokens?: never };

export type ChatCompletionOptionalParameters = {
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  seed?: number;
};

export type ChatCompletionRequestParameters =
  ChatCompletionTokenLimit & ChatCompletionOptionalParameters;

const MAX_COMPLETION_TOKEN_PREFIXES = ['claude', 'gpt-5'] as const;

const targetsOpenAIGpt5 = (providerName: string, model: string): boolean =>
  (providerName === 'OpenAI' && model.startsWith('gpt-5')) ||
  (providerName === 'OpenRouter' && model.startsWith('openai/gpt-5'));

export const getChatCompletionTokenLimit = (
  model: string,
  maxTokens: number
): ChatCompletionTokenLimit =>
  MAX_COMPLETION_TOKEN_PREFIXES.some(prefix => model.startsWith(prefix))
    ? { max_completion_tokens: maxTokens }
    : { max_tokens: maxTokens };

export const getChatCompletionOptionalParameters = (
  providerName: string,
  model: string,
  parameters: ChatCompletionOptionalParameters
): ChatCompletionOptionalParameters => {
  if (!targetsOpenAIGpt5(providerName, model)) return { ...parameters };

  // GPT-5 reasoning requests reject these sampling controls. Keep this local
  // and deterministic so OpenRouter metadata availability cannot delay a
  // request or change its shape. `seed` remains supported.
  const {
    temperature: _temperature,
    top_p: _topP,
    frequency_penalty: _frequencyPenalty,
    presence_penalty: _presencePenalty,
    ...supported
  } = parameters;
  return supported;
};

export const getChatCompletionRequestParameters = (
  providerName: string,
  model: string,
  maxTokens: number,
  optionalParameters: ChatCompletionOptionalParameters = {}
): ChatCompletionRequestParameters => ({
  ...getChatCompletionTokenLimit(model, maxTokens),
  ...getChatCompletionOptionalParameters(providerName, model, optionalParameters),
});
