/**
 * Re-export shim — the transformer moved to services/ai/openaiStrictSchema.ts
 * so the production adapter (OpenAIAdapter.chatJSON) can apply it, not just
 * the benchmark. Benchmark imports keep working through this path.
 */
export { toOpenAIStrictSchema, needsOpenAIStrictSchema } from '../../services/ai/openaiStrictSchema';
