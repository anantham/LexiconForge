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

export type AnatomistFixtureConfig = {
  path: string;
  /** Which demo phases to test (e.g., ['phase-a', 'phase-b']) */
  phases: string[];
};

export type DependencyMode = 'fixture' | 'live';

export const BENCHMARK_CONFIG = {
  outputRoot: 'reports/sutta-studio',
  // 'live' = realistic pipeline (each pass feeds into next)
  // 'fixture' = each pass gets curated golden data (for testing individual passes)
  dependencyMode: 'live' as DependencyMode,
  repeatRuns: 1,
  captureOutputs: {
    skeleton: true,
    anatomist: true,
    lexicographer: true,
    weaver: true,
    typesetter: true,
  },
  fixture: {
    path: 'test-fixtures/sutta-studio-golden-data.json',  // Has phase1/phase2 format
    phaseKey: 'phase1' as const,
    workId: 'mn10',
  },
  // ─────────────────────────────────────────────────────────────────────────
  // TRAIN/TEST SPLIT - Avoid data contamination!
  // ─────────────────────────────────────────────────────────────────────────
  // TRAINING phases (used in prompt examples): phase-a, phase-b, phase-c
  // TEST phases (benchmark only, model hasn't seen these): phase-1 through phase-7
  //
  // For honest evaluation, test ONLY on unseen phases.
  // Set includeTrainingPhases: true to also benchmark on seen phases (for comparison).
  // ─────────────────────────────────────────────────────────────────────────
  includeTrainingPhases: false,  // Set true to also test on phases used in examples
  trainingPhases: ['phase-a', 'phase-b', 'phase-c'],  // Used in prompt examples
  testPhases: ['phase-1', 'phase-2', 'phase-3', 'phase-4', 'phase-5', 'phase-6', 'phase-7'],  // Unseen by model
  // ─────────────────────────────────────────────────────────────────────────
  // ALL 51 PHASES - Full coverage benchmark
  // ─────────────────────────────────────────────────────────────────────────
  phasesToTest: [
    // Opening/Nidana (8 phases)
    'phase-a', 'phase-b', 'phase-c', 'phase-d', 'phase-e', 'phase-f', 'phase-g', 'phase-h',
    // Uddesa (7 phases - uses wordRange slicing)
    'phase-1', 'phase-2', 'phase-3', 'phase-4', 'phase-5', 'phase-6', 'phase-7',
    // Kāyānupassanā intro (3 phases)
    'phase-x', 'phase-y', 'phase-z',
    // Body contemplation (12 phases)
    'phase-aa', 'phase-ab', 'phase-ac', 'phase-ad', 'phase-ae', 'phase-af',
    'phase-ag', 'phase-ah', 'phase-ai', 'phase-aj', 'phase-ak', 'phase-al',
    // Breathing section (12 phases)
    'phase-am', 'phase-an', 'phase-ao', 'phase-ap', 'phase-aq', 'phase-ar',
    'phase-as', 'phase-at', 'phase-au', 'phase-av', 'phase-aw', 'phase-ax',
    // End sections (9 phases)
    'phase-ay', 'phase-az', 'phase-ba', 'phase-bb', 'phase-bc', 'phase-bd',
    'phase-be', 'phase-bf', 'phase-bg',
  ],
  // Fixture configs - all 51 phases available
  anatomistFixture: {
    path: 'test-fixtures/sutta-studio-anatomist-golden.json',
    phases: [
      'phase-a', 'phase-b', 'phase-c', 'phase-d', 'phase-e', 'phase-f', 'phase-g', 'phase-h',
      'phase-1', 'phase-2', 'phase-3', 'phase-4', 'phase-5', 'phase-6', 'phase-7',
      'phase-x', 'phase-y', 'phase-z',
      'phase-aa', 'phase-ab', 'phase-ac', 'phase-ad', 'phase-ae', 'phase-af', 'phase-ag', 'phase-ah', 'phase-ai', 'phase-aj', 'phase-ak', 'phase-al',
      'phase-am', 'phase-an', 'phase-ao', 'phase-ap', 'phase-aq', 'phase-ar', 'phase-as', 'phase-at', 'phase-au', 'phase-av', 'phase-aw', 'phase-ax',
      'phase-ay', 'phase-az', 'phase-ba', 'phase-bb', 'phase-bc', 'phase-bd', 'phase-be', 'phase-bf', 'phase-bg',
    ],
  },
  lexicographerFixture: {
    path: 'test-fixtures/sutta-studio-lexicographer-golden.json',
    phases: [
      'phase-a', 'phase-b', 'phase-c', 'phase-d', 'phase-e', 'phase-f', 'phase-g', 'phase-h',
      'phase-1', 'phase-2', 'phase-3', 'phase-4', 'phase-5', 'phase-6', 'phase-7',
      'phase-x', 'phase-y', 'phase-z',
      'phase-aa', 'phase-ab', 'phase-ac', 'phase-ad', 'phase-ae', 'phase-af', 'phase-ag', 'phase-ah', 'phase-ai', 'phase-aj', 'phase-ak', 'phase-al',
      'phase-am', 'phase-an', 'phase-ao', 'phase-ap', 'phase-aq', 'phase-ar', 'phase-as', 'phase-at', 'phase-au', 'phase-av', 'phase-aw', 'phase-ax',
      'phase-ay', 'phase-az', 'phase-ba', 'phase-bb', 'phase-bc', 'phase-bd', 'phase-be', 'phase-bf', 'phase-bg',
    ],
  },
  weaverFixture: {
    path: 'test-fixtures/sutta-studio-weaver-golden.json',
    phases: [
      'phase-a', 'phase-b', 'phase-c', 'phase-d', 'phase-e', 'phase-f', 'phase-g', 'phase-h',
      'phase-1', 'phase-2', 'phase-3', 'phase-4', 'phase-5', 'phase-6', 'phase-7',
      'phase-x', 'phase-y', 'phase-z',
      'phase-aa', 'phase-ab', 'phase-ac', 'phase-ad', 'phase-ae', 'phase-af', 'phase-ag', 'phase-ah', 'phase-ai', 'phase-aj', 'phase-ak', 'phase-al',
      'phase-am', 'phase-an', 'phase-ao', 'phase-ap', 'phase-aq', 'phase-ar', 'phase-as', 'phase-at', 'phase-au', 'phase-av', 'phase-aw', 'phase-ax',
      'phase-ay', 'phase-az', 'phase-ba', 'phase-bb', 'phase-bc', 'phase-bd', 'phase-be', 'phase-bf', 'phase-bg',
    ],
  },
  typesetterFixture: {
    path: 'test-fixtures/sutta-studio-typesetter-golden.json',
    phases: [
      'phase-a', 'phase-b', 'phase-c', 'phase-d', 'phase-e', 'phase-f', 'phase-g', 'phase-h',
      'phase-1', 'phase-2', 'phase-3', 'phase-4', 'phase-5', 'phase-6', 'phase-7',
      'phase-x', 'phase-y', 'phase-z',
      'phase-aa', 'phase-ab', 'phase-ac', 'phase-ad', 'phase-ae', 'phase-af', 'phase-ag', 'phase-ah', 'phase-ai', 'phase-aj', 'phase-ak', 'phase-al',
      'phase-am', 'phase-an', 'phase-ao', 'phase-ap', 'phase-aq', 'phase-ar', 'phase-as', 'phase-at', 'phase-au', 'phase-av', 'phase-aw', 'phase-ax',
      'phase-ay', 'phase-az', 'phase-ba', 'phase-bb', 'phase-bc', 'phase-bd', 'phase-be', 'phase-bf', 'phase-bg',
    ],
  },
  // All pipeline passes
  passes: ['skeleton', 'anatomist', 'lexicographer', 'weaver', 'typesetter'] as PassName[],
  runs: [
    // ─────────────────────────────────────────────────────────────────────────
    // MULTI-MODEL VARIANCE ANALYSIS
    // Testing diverse models including free tiers for cost-effective benchmarking
    // ─────────────────────────────────────────────────────────────────────────
    {
      id: 'gemini-2-flash',
      model: {
        id: 'gemini-2-flash',
        provider: 'OpenRouter',
        model: 'google/gemini-2.0-flash-001',
        apiKeyEnv: 'OPENROUTER_API_KEY',
      },
    },
    {
      id: 'kimi-k2.5',
      model: {
        id: 'kimi-k2.5',
        provider: 'OpenRouter',
        model: 'moonshotai/kimi-k2.5',
        apiKeyEnv: 'OPENROUTER_API_KEY',
      },
    },
    {
      id: 'trinity-large',
      model: {
        id: 'trinity-large',
        provider: 'OpenRouter',
        model: 'arcee-ai/trinity-large-preview:free',
        apiKeyEnv: 'OPENROUTER_API_KEY',
      },
    },
    {
      id: 'solar-pro-3',
      model: {
        id: 'solar-pro-3',
        provider: 'OpenRouter',
        model: 'upstage/solar-pro-3:free',
        apiKeyEnv: 'OPENROUTER_API_KEY',
      },
    },
    {
      id: 'minimax-m2',
      model: {
        id: 'minimax-m2',
        provider: 'OpenRouter',
        model: 'minimax/minimax-m2-her',
        apiKeyEnv: 'OPENROUTER_API_KEY',
      },
    },
    {
      id: 'lfm-thinking',
      model: {
        id: 'lfm-thinking',
        provider: 'OpenRouter',
        model: 'liquid/lfm-2.5-1.2b-thinking:free',
        apiKeyEnv: 'OPENROUTER_API_KEY',
      },
    },
    {
      id: 'glm-4.7-flash',
      model: {
        id: 'glm-4.7-flash',
        provider: 'OpenRouter',
        model: 'z-ai/glm-4.7-flash',
        apiKeyEnv: 'OPENROUTER_API_KEY',
      },
    },
    {
      id: 'molmo-2-8b',
      model: {
        id: 'molmo-2-8b',
        provider: 'OpenRouter',
        model: 'allenai/molmo-2-8b:free',
        apiKeyEnv: 'OPENROUTER_API_KEY',
      },
    },
    {
      id: 'nemotron-3-nano',
      model: {
        id: 'nemotron-3-nano',
        provider: 'OpenRouter',
        model: 'nvidia/nemotron-3-nano-30b-a3b:free',
        apiKeyEnv: 'OPENROUTER_API_KEY',
      },
    },
    {
      id: 'llama-3.3-70b',
      model: {
        id: 'llama-3.3-70b',
        provider: 'OpenRouter',
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        apiKeyEnv: 'OPENROUTER_API_KEY',
      },
    },
    {
      id: 'qwen-2.5-72b',
      model: {
        id: 'qwen-2.5-72b',
        provider: 'OpenRouter',
        model: 'qwen/qwen-2.5-72b-instruct:free',
        apiKeyEnv: 'OPENROUTER_API_KEY',
      },
    },
    {
      id: 'gemma-2-27b',
      model: {
        id: 'gemma-2-27b',
        provider: 'OpenRouter',
        model: 'google/gemma-2-27b-it:free',
        apiKeyEnv: 'OPENROUTER_API_KEY',
      },
    },
    {
      id: 'mistral-large',
      model: {
        id: 'mistral-large',
        provider: 'OpenRouter',
        model: 'mistralai/mistral-large:free',
        apiKeyEnv: 'OPENROUTER_API_KEY',
      },
    },
    // Uncomment for more models (adds cost/time):
    // {
    //   id: 'claude-3.5-haiku',
    //   model: {
    //     id: 'claude-3.5-haiku',
    //     provider: 'OpenRouter',
    //     model: 'anthropic/claude-3.5-haiku',
    //     apiKeyEnv: 'OPENROUTER_API_KEY',
    //   },
    // },
    // {
    //   id: 'gpt-4o-mini',
    //   model: {
    //     id: 'gpt-4o-mini',
    //     provider: 'OpenRouter',
    //     model: 'openai/gpt-4o-mini',
    //     apiKeyEnv: 'OPENROUTER_API_KEY',
    //   },
    // },
    // {
    //   id: 'deepseek-chat',
    //   model: {
    //     id: 'deepseek-chat',
    //     provider: 'OpenRouter',
    //     model: 'deepseek/deepseek-chat',
    //     apiKeyEnv: 'OPENROUTER_API_KEY',
    //   },
    // },
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
