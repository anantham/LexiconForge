/**
 * Shared types for canonical pass functions.
 *
 * The `LLMCaller` type is the injection seam that lets benchmarks and tests
 * substitute their own LLM implementation. Production code uses the default
 * caller from services/sutta-studio/llm.
 */

import type { AppSettings } from '../../../types';
import type { ChatMessage } from '../../../adapters/providers/Provider';
import type { CompilerLLMOptions, CompilerLLMResult } from '../llm';

export type PassName = 'skeleton' | 'anatomist' | 'lexicographer' | 'weaver' | 'typesetter' | 'morphology';

export type LLMCaller = (params: {
  settings: AppSettings;
  messages: ChatMessage[];
  signal?: AbortSignal;
  maxTokens?: number;
  options?: CompilerLLMOptions;
}) => Promise<CompilerLLMResult>;

export type PassCallResult<T> = {
  output: T | null;
  llm?: CompilerLLMResult;
  error?: string;
  requestName: string;
  schemaName?: string;
  phaseId?: string;
};

import type { SkeletonPhase } from '../utils';

export type SkeletonChunkResult = PassCallResult<SkeletonPhase[]> & {
  chunkIndex: number;
  chunkCount: number;
  segmentCount: number;
  fallbackUsed: boolean;
};

export type SkeletonRunResult = {
  phases: SkeletonPhase[];
  chunks: SkeletonChunkResult[];
};
