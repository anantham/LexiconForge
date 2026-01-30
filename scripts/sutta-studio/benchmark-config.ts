import type { AppSettings } from '../../types';
import { getEnvVar } from '../../services/env';
import type { PassName } from '../../services/suttaStudioPassRunners';

export type BenchmarkModel = {
  id: string;
  provider: AppSettings['provider'];
  model: string;
  apiKeyEnv?: string;
};

export type BenchmarkPassConfig = {
  pass: PassName;
  maxTokens?: number;
  structuredOutputs?: boolean;
  modelId?: string;
};

export type BenchmarkRun = {
  id: string;
  label?: string;
  model: BenchmarkModel;
  passOverrides?: Partial<Record<PassName, Omit<BenchmarkPassConfig, 'pass'>>>;
};

export type BenchmarkFixtureConfig = {
  path: string;
  phaseKey: 'phase1' | 'phase2';
  workId: string;
};

export type DependencyMode = 'fixture' | 'live';

export const BENCHMARK_CONFIG = {
  outputRoot: 'reports/sutta-studio',
  dependencyMode: 'fixture' as DependencyMode,
  repeatRuns: 3,
  captureOutputs: {
    skeleton: true,
    anatomist: true,
    lexicographer: true,
    weaver: true,
    typesetter: true,
  },
  fixture: {
    path: 'test-fixtures/sutta-studio-golden-data.json',
    phaseKey: 'phase1' as const,
    workId: 'mn10',
  },
  // All pipeline passes - comment out to run subset
  passes: ['skeleton', 'anatomist', 'lexicographer', 'weaver', 'typesetter'] as PassName[],
  runs: [
    {
      id: 'openrouter-gemini-3-flash',
      model: {
        id: 'openrouter-gemini-3-flash',
        provider: 'OpenRouter',
        model: 'google/gemini-3-flash-preview',
        apiKeyEnv: 'OPENROUTER_API_KEY',
      },
    },
    {
      id: 'openrouter-gemini-2.5-flash',
      model: {
        id: 'openrouter-gemini-2.5-flash',
        provider: 'OpenRouter',
        model: 'google/gemini-2.5-flash',
        apiKeyEnv: 'OPENROUTER_API_KEY',
      },
    },
    {
      id: 'openrouter-kimi-k2.5',
      model: {
        id: 'openrouter-kimi-k2.5',
        provider: 'OpenRouter',
        model: 'moonshotai/kimi-k2.5',
        apiKeyEnv: 'OPENROUTER_API_KEY',
      },
    },
    {
      id: 'openrouter-kimi-k2',
      model: {
        id: 'openrouter-kimi-k2',
        provider: 'OpenRouter',
        model: 'moonshotai/kimi-k2',
        apiKeyEnv: 'OPENROUTER_API_KEY',
      },
    },
    {
      id: 'openrouter-glm-4.7',
      model: {
        id: 'openrouter-glm-4.7',
        provider: 'OpenRouter',
        model: 'z-ai/glm-4.7',
        apiKeyEnv: 'OPENROUTER_API_KEY',
      },
    },
    {
      id: 'openrouter-glm-4.7-flash',
      model: {
        id: 'openrouter-glm-4.7-flash',
        provider: 'OpenRouter',
        model: 'z-ai/glm-4.7-flash',
        apiKeyEnv: 'OPENROUTER_API_KEY',
      },
    },
    {
      id: 'openrouter-deepseek-v3.2',
      model: {
        id: 'openrouter-deepseek-v3.2',
        provider: 'OpenRouter',
        model: 'deepseek/deepseek-v3.2',
        apiKeyEnv: 'OPENROUTER_API_KEY',
      },
    },
  ] as BenchmarkRun[],
};

const BASE_SETTINGS: AppSettings = {
  contextDepth: 2,
  preloadCount: 0,
  fontSize: 18,
  fontStyle: 'serif',
  lineHeight: 1.7,
  systemPrompt: '',
  provider: 'OpenRouter',
  model: 'google/gemini-3-flash-preview',
  imageModel: 'imagen-3.0-generate-001',
  temperature: 0.2,
  maxOutputTokens: 16384,
};

const apiKeyMap: Record<AppSettings['provider'], keyof AppSettings> = {
  Gemini: 'apiKeyGemini',
  DeepSeek: 'apiKeyDeepSeek',
  OpenRouter: 'apiKeyOpenRouter',
  Claude: 'apiKeyClaude',
  OpenAI: 'apiKeyOpenAI',
};

export const resolveSettingsForModel = (model: BenchmarkModel): AppSettings => {
  const apiKey = model.apiKeyEnv ? getEnvVar(model.apiKeyEnv) : undefined;
  const keyField = apiKeyMap[model.provider];
  return {
    ...BASE_SETTINGS,
    provider: model.provider,
    model: model.model,
    [keyField]: apiKey ?? '',
  } as AppSettings;
};
