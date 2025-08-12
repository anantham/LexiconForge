
import { ModelInfo } from './types';

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
    
    // DeepSeek Models
    { id: 'deepseek-chat', name: 'DeepSeek Chat (V3)', provider: 'DeepSeek' },
    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)', provider: 'DeepSeek' },
];

export const COSTS_PER_MILLION_TOKENS: { [key: string]: { input: number, output: number } } = {
    // --- Gemini Models (estimated based on competitive pricing) ---
    'gemini-2.5-pro': { input: 3.50, output: 10.50 },
    'gemini-2.5-flash': { input: 0.35, output: 0.70 },
    'gemini-2.5-flash-lite': { input: 0.15, output: 0.30 },
    'gemini-2.0-flash': { input: 0.25, output: 0.50 },
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

    // --- DeepSeek Models (Standard pricing - cache miss) ---
    'deepseek-chat': { input: 0.27, output: 1.10 },
    'deepseek-reasoner': { input: 0.55, output: 2.19 },
};