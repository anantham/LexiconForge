import { supportsParameters } from '../capabilityService';

export type ChatCompletionTokenLimit =
  | { max_completion_tokens: number; max_tokens?: never }
  | { max_tokens: number; max_completion_tokens?: never };

export type ChatCompletionRequestParameters = ChatCompletionTokenLimit & {
  temperature?: number;
};

export type ChatCompletionTemperature = { temperature?: number };

const MAX_COMPLETION_TOKEN_PREFIXES = ['claude', 'gpt-5'] as const;

export const getChatCompletionTokenLimit = (
  model: string,
  maxTokens: number
): ChatCompletionTokenLimit =>
  MAX_COMPLETION_TOKEN_PREFIXES.some(prefix => model.startsWith(prefix))
    ? { max_completion_tokens: maxTokens }
    : { max_tokens: maxTokens };

export const getChatCompletionRequestParameters = async (
  providerName: string,
  model: string,
  maxTokens: number,
  temperature?: number
): Promise<ChatCompletionRequestParameters> => {
  const tokenLimit = getChatCompletionTokenLimit(model, maxTokens);
  const sampling = await getChatCompletionTemperature(providerName, model, temperature);
  return { ...tokenLimit, ...sampling };
};

export const getChatCompletionTemperature = async (
  providerName: string,
  model: string,
  temperature?: number
): Promise<ChatCompletionTemperature> => {
  if (temperature === undefined) return {};

  // OpenAI GPT-5 reasoning models reject non-default sampling, even when
  // remote capability metadata is unavailable and would otherwise fail open.
  const knownOpenAIRestriction =
    (providerName === 'OpenAI' && model.startsWith('gpt-5')) ||
    (providerName === 'OpenRouter' && model.startsWith('openai/gpt-5'));
  const supportsTemperature = !knownOpenAIRestriction &&
    await supportsParameters(providerName, model, ['temperature']);

  return supportsTemperature ? { temperature } : {};
};
