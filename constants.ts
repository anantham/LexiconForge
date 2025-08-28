
import prompts from './config/prompts.json';
export const INITIAL_SYSTEM_PROMPT = prompts.systemPrompt;

// Available AI models by provider
export const AVAILABLE_MODELS = {
  Gemini: [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Most capable, best for complex translations' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast and capable, balanced performance' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: 'Lightweight, faster responses' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Previous generation, reliable' },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', description: 'Previous generation, lightweight' },
  ],
  OpenAI: [
    { id: 'gpt-5', name: 'GPT-5', description: 'Latest flagship model, most capable' },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini', description: 'Balanced performance and cost' },
    { id: 'gpt-5-nano', name: 'GPT-5 Nano', description: 'Lightweight, fastest responses' },
    { id: 'gpt-5-chat-latest', name: 'GPT-5 Chat Latest', description: 'Latest conversational model' },
    { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Enhanced previous generation' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', description: 'Efficient 4.1 variant' },
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', description: 'Compact 4.1 variant' },
  ],
  DeepSeek: [
    { id: 'deepseek-chat', name: 'DeepSeek V3.1 (Chat)', description: 'Non-thinking mode of DeepSeek-V3.1' },
    { id: 'deepseek-reasoner', name: 'DeepSeek V3.1 (Reasoner)', description: 'Thinking mode of DeepSeek-V3.1' },
  ],
  OpenRouter: [
    // Common OpenRouter model slugs (examples)
    { id: 'openai/gpt-4o', name: 'OpenAI GPT-4o via OpenRouter', description: 'OpenAI GPT-4o routed through OpenRouter' },
    { id: 'deepseek/deepseek-reasoner', name: 'DeepSeek Reasoner via OpenRouter', description: 'DeepSeek Reasoner via OpenRouter' },
  ],
  Claude: [
    { id: 'claude-opus-4-1', name: 'Claude Opus 4.1', description: 'Most advanced reasoning, best for complex translations' },
    { id: 'claude-opus-4-0', name: 'Claude Opus 4', description: 'Powerful reasoning and analysis capabilities' },
    { id: 'claude-sonnet-4-0', name: 'Claude Sonnet 4', description: 'Balanced performance and intelligence' },
    { id: 'claude-3-7-sonnet-latest', name: 'Claude Sonnet 3.7 Latest', description: 'Enhanced Sonnet with latest improvements' },
    { id: 'claude-3-5-sonnet-latest', name: 'Claude Sonnet 3.5 Latest', description: 'Reliable and fast for most translations' },
    { id: 'claude-3-5-haiku-latest', name: 'Claude Haiku 3.5 Latest', description: 'Fastest and most cost-effective option' },
  ],
};

// Available AI models for Image Generation
export const AVAILABLE_IMAGE_MODELS = {
  Gemini: [
    { id: 'gemini-2.5-flash-image-preview', name: 'Gemini 2.5 Flash (Image Preview)', description: 'Native image generation, $0.039 per image' },
    { id: 'gemini-2.0-flash-preview-image-generation', name: 'Gemini 2.0 Flash (Image Preview)', description: 'Native image generation, $0.039 per image' },
    { id: 'imagen-3.0-generate-002', name: 'Imagen 3.0', description: 'High-quality image generation' },
    { id: 'imagen-4.0-generate-preview-06-06', name: 'Imagen 4.0 (Preview)', description: 'Next-gen image model' },
    { id: 'imagen-4.0-ultra-generate-preview-06-06', name: 'Imagen 4.0 Ultra (Preview)', description: 'Highest quality experimental model' },
    // PiAPI Flux models
    { id: 'Qubico/flux1-schnell', name: 'PiAPI Flux 1 Schnell', description: 'Fast flux text-to-image (PiAPI)' },
    { id: 'Qubico/flux1-dev', name: 'PiAPI Flux 1 Dev', description: 'Balanced flux text-to-image (PiAPI)' },
    { id: 'Qubico/flux1-dev-advanced', name: 'PiAPI Flux 1 Dev Advanced', description: 'Advanced flux text-to-image (PiAPI)' },
    // OpenRouter image models
    { id: 'openrouter/google/gemini-2.5-flash-image-preview', name: 'OpenRouter Gemini 2.5 Flash (Image)', description: 'Gemini image generation via OpenRouter' },
    { id: 'openrouter/google/gemini-2.5-flash-image-preview:free', name: 'OpenRouter Gemini 2.5 Flash (Image, Free)', description: 'Free Gemini image generation via OpenRouter' },
  ]
};

export const SUPPORTED_WEBSITES = [
  'kakuyomu.jp',
  'dxmwx.org',
  'kanunu8.com',
  'novelcool.com',
];

// Abbreviations for model IDs to keep UI labels compact
export const MODEL_ABBREVIATIONS: Record<string, string> = {
  // Gemini 2.5
  'gemini-2.5-pro': 'G2.5-P',
  'gemini-2.5-flash': 'G2.5-F',
  'gemini-2.5-flash-lite': 'G2.5-L',
  // Gemini 2.0
  'gemini-2.0-flash': 'G2.0-F',
  'gemini-2.0-flash-lite': 'G2.0-L',
  // OpenAI
  'gpt-5': 'G5',
  'gpt-5-mini': 'G5 Mini',
  'gpt-5-nano': 'G5 Nano',
  'gpt-5-chat-latest': 'G5 Chat',
  'gpt-4.1': 'G4.1',
  'gpt-4.1-mini': 'G4.1 Mini',
  'gpt-4.1-nano': 'G4.1 Nano',
  // Claude
  'claude-opus-4-1': 'C Opus 4.1',
  'claude-opus-4-0': 'C Opus 4',
  'claude-3-7-sonnet-latest': 'C Sonnet 3.7',
  'claude-3-5-sonnet-latest': 'C Sonnet 3.5',
  'claude-3-5-haiku-latest': 'C Haiku 3.5',
  // DeepSeek
  'deepseek-chat': 'DS Chat',
  'deepseek-reasoner': 'DS Reasoner',
};
