
import { ModelInfo } from '../types';

export const MODELS: ModelInfo[] = [
    // Gemini Models - Latest generation first
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Gemini' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Gemini' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', provider: 'Gemini' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'Gemini' },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', provider: 'Gemini' },
    
    // OpenAI Models - Current 2025 models
    { id: 'gpt-5', name: 'GPT-5', provider: 'OpenAI' },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini', provider: 'OpenAI' },
    { id: 'gpt-5-nano', name: 'GPT-5 Nano', provider: 'OpenAI' },
    { id: 'gpt-5-chat-latest', name: 'GPT-5 Chat Latest', provider: 'OpenAI' },
    { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'OpenAI' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'OpenAI' },
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', provider: 'OpenAI' },
    // Legacy models (still available)
    { id: 'gpt-4o', name: 'GPT-4o (Legacy)', provider: 'OpenAI' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Legacy)', provider: 'OpenAI' },
    
    // DeepSeek Models (V3.1)
    { id: 'deepseek-chat', name: 'DeepSeek V3.1 (Chat)', provider: 'DeepSeek' },
    { id: 'deepseek-reasoner', name: 'DeepSeek V3.1 (Reasoner)', provider: 'DeepSeek' },
    
    // OpenRouter (example slugs; pricing varies per underlying model)
    { id: 'openai/gpt-4o', name: 'OpenAI GPT-4o (OpenRouter)', provider: 'OpenRouter' },
    { id: 'deepseek/deepseek-reasoner', name: 'DeepSeek Reasoner (OpenRouter)', provider: 'OpenRouter' },
    
    // Claude Models (Anthropic) - 2025 models
    { id: 'claude-opus-4-1', name: 'Claude Opus 4.1', provider: 'Claude' },
    { id: 'claude-opus-4-0', name: 'Claude Opus 4', provider: 'Claude' },
    { id: 'claude-sonnet-4-0', name: 'Claude Sonnet 4', provider: 'Claude' },
    { id: 'claude-3-7-sonnet-latest', name: 'Claude Sonnet 3.7 Latest', provider: 'Claude' },
    { id: 'claude-3-5-sonnet-latest', name: 'Claude Sonnet 3.5 Latest', provider: 'Claude' },
    { id: 'claude-3-5-haiku-latest', name: 'Claude Haiku 3.5 Latest', provider: 'Claude' },
];

export const COSTS_PER_MILLION_TOKENS: { [key: string]: { input: number, output: number } } = {
    // --- Gemini Models (Official Google 2025 pricing) ---
    'gemini-2.5-pro': { input: 1.25, output: 10.00 }, // keep as is unless updated
    // Updated per your latest pricing
    'gemini-2.5-flash': { input: 0.30, output: 2.50 },
    'gemini-2.5-flash-lite': { input: 0.10, output: 0.40 },
    'gemini-2.0-flash': { input: 0.10, output: 0.40 },
    'gemini-2.0-flash-lite': { input: 0.10, output: 0.20 },
    
    // --- OpenAI Models (Official 2025 pricing) ---
    'gpt-5': { input: 1.25, output: 10.00 },
    'gpt-5-mini': { input: 0.25, output: 2.00 },
    'gpt-5-nano': { input: 0.05, output: 0.40 },
    'gpt-5-chat-latest': { input: 1.25, output: 10.00 },
    'gpt-4.1': { input: 2.00, output: 8.00 },
    'gpt-4.1-mini': { input: 0.40, output: 1.60 },
    'gpt-4.1-nano': { input: 0.10, output: 0.40 },
    // Legacy models
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },

    // --- OpenAI Models with date suffixes (real model IDs from API) ---
    'gpt-5-2025-01-12': { input: 1.25, output: 10.00 },
    'gpt-5-mini-2025-08-07': { input: 0.25, output: 2.00 },
    'gpt-5-nano-2025-01-12': { input: 0.05, output: 0.40 },
    'gpt-5-chat-latest-2025-01-12': { input: 1.25, output: 10.00 },

    // --- DeepSeek Models (V3.1)
    // Pricing shown uses cache-miss input rate per 1M tokens.
    // Cache-hit input rate is $0.07/1M (not modeled separately here).
    'deepseek-chat': { input: 0.56, output: 1.68 },
    'deepseek-reasoner': { input: 0.56, output: 1.68 },

    // --- Claude Models (Anthropic - Official 2025 pricing) ---
    'claude-opus-4-1': { input: 15.00, output: 75.00 },
    'claude-opus-4-0': { input: 15.00, output: 75.00 },
    'claude-sonnet-4-0': { input: 3.00, output: 15.00 },
    'claude-3-7-sonnet-latest': { input: 3.00, output: 15.00 },
    'claude-3-5-sonnet-latest': { input: 3.00, output: 15.00 },
    'claude-3-5-haiku-latest': { input: 0.80, output: 4.00 },
    
    // Support exact model IDs as well
    'claude-opus-4-1-20250805': { input: 15.00, output: 75.00 },
    'claude-opus-4-20250514': { input: 15.00, output: 75.00 },
    'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
    'claude-3-7-sonnet-20250219': { input: 3.00, output: 15.00 },
    'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
    'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },
};

// --- IMAGE MODEL COSTS (Per Image in USD) ---
export const IMAGE_COSTS: { [key: string]: number } = {
    // Google Gemini Image Models
    'gemini-2.0-flash-preview-image-generation': 0.039, // $0.039 per image
    'gemini-2.5-flash-image-preview': 0.039, // $0.039 per image

    // Google Imagen Models (Official 2025 pricing)
    'imagen-3.0-generate-002': 0.03, // Imagen 3 - $0.03 per image
    'imagen-4.0-generate-preview-06-06': 0.04, // Imagen 4 Standard - $0.04 per image
    'imagen-4.0-ultra-generate-preview-06-06': 0.06, // Imagen 4 Ultra - $0.06 per image

    // Aliases for shorter model names
    'imagen-3': 0.03,
    'imagen-4': 0.04,
    'imagen-4-ultra': 0.06,

    // OpenRouter Gemini Image Models [Nano Banana]
    'openrouter/google/gemini-2.5-flash-image': 0.039, // $0.039 per image
    'openrouter/google/gemini-2.5-flash-image-preview': 0.039, // $0.039 per image
    'openrouter/google/gemini-2.5-flash-image-preview:free': 0.00, // Free tier

    // PiAPI Flux models (pricing provided by user)
    // Flux.1-Schnell: $0.0015 per image (batch 1-4)
    'Qubico/flux1-schnell': 0.0015,
    // Flux.1-Dev: $0.015 per generation (treat as per image for single-image use)
    'Qubico/flux1-dev': 0.015,
    // Flux.1-Dev-Advanced: $0.02 per generation
    'Qubico/flux1-dev-advanced': 0.02,

    // OpenRouter OpenAI Image Models (token-based pricing converted to per-image estimate)
    // Assuming ~1000 tokens per image generation (typical for image models)
    // gpt-5-image: $10/1M tokens = $0.01 per 1000 tokens
    'openrouter/openai/gpt-5-image': 0.01,
    // gpt-5-image-mini: $2.5/1M tokens = $0.0025 per 1000 tokens
    'openrouter/openai/gpt-5-image-mini': 0.0025,
};
