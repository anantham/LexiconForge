import type { AppSettings } from '../../types';
import { getEnvVar } from '../../services/env';
import type { PassName } from '../../services/suttaStudioPassRunners';

export type BenchmarkModel = {
  id: string;
  provider: AppSettings['provider'];
  model: string;
  apiKeyEnv?: string;
  /** OpenRouter provider routing preferences (e.g., order: ['Together']) */
  providerPreferences?: {
    order?: string[];
    allow_fallbacks?: boolean;
  };
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
  // Training phases are used in prompt examples - model has "seen" these.
  // Test phases are held out - model hasn't seen them, for honest evaluation.
  //
  // Split covers ALL sections of MN10 for representative training:
  //   - Opening formula (a-h): train a,b,c,e,g / test d,f,h
  //   - Uddesa declaration (1-7): train 1,3,5 / test 2,4,6,7
  //   - Kāyānupassanā intro (x-z,aa): train y,aa / test x,z
  //   - Body contemplation (ab-al): train ac,ae,ah,ak / test ab,ad,af,ag,ai,aj,al
  //   - Breathing (am-ax): train am,ar,au,aw / test an,ao,ap,aq,as,at,av,ax
  //   - End sections (ay-bg): train ay,bb,be / test az,ba,bc,bd,bf,bg
  //
  // Result: ~20 training / ~31 test phases (60% unseen)
  // ─────────────────────────────────────────────────────────────────────────
  includeTrainingPhases: false,  // Set true to also benchmark on seen phases (for comparison)
  trainingPhases: [
    // Opening formula (5)
    'phase-a', 'phase-b', 'phase-c', 'phase-e', 'phase-g',
    // Uddesa declaration (3)
    'phase-1', 'phase-3', 'phase-5',
    // Kāyānupassanā intro (2)
    'phase-y', 'phase-aa',
    // Body contemplation (4)
    'phase-ac', 'phase-ae', 'phase-ah', 'phase-ak',
    // Breathing (4)
    'phase-am', 'phase-ar', 'phase-au', 'phase-aw',
    // End sections (3)
    'phase-ay', 'phase-bb', 'phase-be',
  ],  // 21 phases used in prompt examples
  testPhases: [
    // Opening formula (3)
    'phase-d', 'phase-f', 'phase-h',
    // Uddesa declaration (4)
    'phase-2', 'phase-4', 'phase-6', 'phase-7',
    // Kāyānupassanā intro (2)
    'phase-x', 'phase-z',
    // Body contemplation (7)
    'phase-ab', 'phase-ad', 'phase-af', 'phase-ag', 'phase-ai', 'phase-aj', 'phase-al',
    // Breathing (8)
    'phase-an', 'phase-ao', 'phase-ap', 'phase-aq', 'phase-as', 'phase-at', 'phase-av', 'phase-ax',
    // End sections (6)
    'phase-az', 'phase-ba', 'phase-bc', 'phase-bd', 'phase-bf', 'phase-bg',
  ],  // 30 phases unseen by model
  // ─────────────────────────────────────────────────────────────────────────
  // ALL 51 PHASES - Full coverage benchmark
  // ─────────────────────────────────────────────────────────────────────────
  // TEMP: Testing problematic models with 2 phases
  phasesToTest: ['phase-a', 'phase-b'],
  // FULL LIST (restore after test):
  // phasesToTest: [
  //   // Opening/Nidana (8 phases)
  //   'phase-a', 'phase-b', 'phase-c', 'phase-d', 'phase-e', 'phase-f', 'phase-g', 'phase-h',
  //   // Uddesa (7 phases - uses wordRange slicing)
  //   'phase-1', 'phase-2', 'phase-3', 'phase-4', 'phase-5', 'phase-6', 'phase-7',
  //   // Kāyānupassanā intro (3 phases)
  //   'phase-x', 'phase-y', 'phase-z',
  //   // Body contemplation (12 phases)
  //   'phase-aa', 'phase-ab', 'phase-ac', 'phase-ad', 'phase-ae', 'phase-af',
  //   'phase-ag', 'phase-ah', 'phase-ai', 'phase-aj', 'phase-ak', 'phase-al',
  //   // Breathing section (12 phases)
  //   'phase-am', 'phase-an', 'phase-ao', 'phase-ap', 'phase-aq', 'phase-ar',
  //   'phase-as', 'phase-at', 'phase-au', 'phase-av', 'phase-aw', 'phase-ax',
  //   // End sections (9 phases)
  //   'phase-ay', 'phase-az', 'phase-ba', 'phase-bb', 'phase-bc', 'phase-bd',
  //   'phase-be', 'phase-bf', 'phase-bg',
  // ],
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
    // WORKING MODELS (0-3 degraded phases, produce usable output)
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
      id: 'gemini-3-flash',
      model: {
        id: 'gemini-3-flash',
        provider: 'OpenRouter',
        model: 'google/gemini-3-flash-preview',
        apiKeyEnv: 'OPENROUTER_API_KEY',
      },
    },
    {
      id: 'gemini-2.5-flash',
      model: {
        id: 'gemini-2.5-flash',
        provider: 'OpenRouter',
        model: 'google/gemini-2.5-flash',
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
      id: 'molmo-2-8b',
      model: {
        id: 'molmo-2-8b',
        provider: 'OpenRouter',
        model: 'allenai/molmo-2-8b:free',
        apiKeyEnv: 'OPENROUTER_API_KEY',
      },
    },
    {
      id: 'deepseek-v3.2',
      model: {
        id: 'deepseek-v3.2',
        provider: 'OpenRouter',
        model: 'deepseek/deepseek-v3.2',
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
        providerPreferences: {
          order: ['Together', 'Atlas-Cloud'],
          allow_fallbacks: false,
        },
      },
    },
    {
      id: 'glm-4.7-flash',
      model: {
        id: 'glm-4.7-flash',
        provider: 'OpenRouter',
        model: 'z-ai/glm-4.7-flash',
        apiKeyEnv: 'OPENROUTER_API_KEY',
        providerPreferences: {
          order: ['Phala'],
          allow_fallbacks: false,
        },
      },
    },
    // ─────────────────────────────────────────────────────────────────────────
    // MARGINAL MODELS (~40-50% success rate, keep for variety)
    // ─────────────────────────────────────────────────────────────────────────
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
      id: 'minimax-m2.1',
      model: {
        id: 'minimax-m2.1',
        provider: 'OpenRouter',
        model: 'minimax/minimax-m2.1',
        apiKeyEnv: 'OPENROUTER_API_KEY',
        providerPreferences: {
          order: ['Inceptron/fp8'],
          allow_fallbacks: false,
        },
      },
    },
    // ─────────────────────────────────────────────────────────────────────────
    // PREMIUM MODELS (uncomment for higher quality, adds cost)
    // ─────────────────────────────────────────────────────────────────────────
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
    // ─────────────────────────────────────────────────────────────────────────
    // REMOVED (100% degraded or mostly broken)
    // ─────────────────────────────────────────────────────────────────────────
    // gemma-2-27b, glm-4.7-flash, llama-3.3-70b, mistral-large,
    // nemotron-3-nano, qwen-2.5-72b, solar-pro-3, kimi-k2.5
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
