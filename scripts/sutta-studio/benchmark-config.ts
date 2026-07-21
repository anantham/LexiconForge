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
  /**
   * Sampling temperature. undefined = the runner's default (0.2). null = OMIT
   * the parameter entirely — required for models whose endpoints do not accept
   * temperature (e.g. anthropic/claude-sonnet-5): under provider
   * require_parameters:true, an unsupported parameter excludes every endpoint
   * ("No endpoints found that can handle the requested parameters").
   * Root-caused by A/B probe 2026-07-21.
   */
  temperature?: number | null;
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
    path: 'test-fixtures/sutta-studio-golden-from-demo.json',  // Generated from demoPacket - 51 phases
    phaseKey: 'skeleton' as const,  // New format uses skeleton
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
  // HELD-OUT test set (27 phases) — the honest, uncontaminated ranking set.
  // The worked examples embedded in prompts are phase-a/b/aa (config/suttaStudioExamples). The
  // prior claim that "none appear below" was FALSE: phase-ad, phase-ag and phase-aj each grade the
  // exact `ātāpī sampajāno satimā` sequence that phase-aa teaches as a worked example (the
  // satipaṭṭhāna refrain recurs verbatim), so those three were the answer key in the prompt. They
  // are removed from the ranked set — re-goldening can't help, the sequence IS the example. The
  // refrain is still exercised once, as the phase-aa example. Guarded by
  // tests/scripts/sutta-studio/phase-contract.test.ts.
  // (Full 51-phase list preserved in git history / the *Fixture.phases arrays.)
  phasesToTest: [
    'phase-d', 'phase-f', 'phase-h',
    'phase-2', 'phase-4', 'phase-6', 'phase-7',
    'phase-x', 'phase-z',
    'phase-ab', 'phase-af', 'phase-ai', 'phase-al',
    'phase-an', 'phase-ao', 'phase-ap', 'phase-aq', 'phase-as', 'phase-at', 'phase-av', 'phase-ax',
    'phase-az', 'phase-ba', 'phase-bc', 'phase-bd', 'phase-bf', 'phase-bg',
  ],
  // Fail-closed cumulative spend cap for a fleet run, in USD. The runner tracks spend across all
  // model/phase calls and ABORTS once this is reached, so a mispriced model or a runaway loop
  // can't spend unbounded. A call whose cost can't be measured (missing usage or no pricing) is
  // charged UNPRICED_CALL_ESTIMATE_USD so unpriced spend still drives toward the cap instead of
  // being invisible. Set null to disable (not recommended for paid runs).
  maxSpendUsd: 50 as number | null,

  // Filter to specific model IDs (empty = all)
  // gemini-2-flash dropped: slug google/gemini-2.0-flash-001 is deprecated on
  // OpenRouter ("No endpoints found"). 5 live models below.
  // EMPTY = run the full ranked roster. A non-empty list here silently
  // intersects with runs[] — a stale 6-model filter from the 07-01 preview
  // board survived the roster-of-twelve commit and cut the first paid v2.2
  // attempt to 4 models (2026-07-21). Subset runs: set explicitly, then CLEAR.
  onlyRunIds: [] as string[],
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
    // v2.2 RANKED ROSTER — twelve models, operator-approved 2026-07-19.
    // Six incumbents + six new; every slug verified live on OpenRouter's
    // public /models endpoint 2026-07-19. claude-sonnet-5 is the disclosed
    // same-family circularity probe (judge family — see SUTTA-010).
    // Prior zoo retired from the ranked run 2026-07-19: gemini-2-flash,
    // gemini-2.5-flash, trinity-large, molmo-2-8b, kimi-k2.5, glm-4.7-flash,
    // gpt-oss-120b, gemma-3-27b (failed coverage floor twice), gpt-5.1,
    // lfm-thinking, minimax-m2.1. Resurrect deliberately, not by default.
    // ─────────────────────────────────────────────────────────────────────────
    {
      id: 'grok-4.20',
      model: { id: 'grok-4.20', provider: 'OpenRouter', model: 'x-ai/grok-4.20', apiKeyEnv: 'OPENROUTER_API_KEY' },
    },
    {
      id: 'gemini-3-flash',
      model: { id: 'gemini-3-flash', provider: 'OpenRouter', model: 'google/gemini-3-flash-preview', apiKeyEnv: 'OPENROUTER_API_KEY' },
    },
    {
      id: 'mistral-small-3.2',
      model: { id: 'mistral-small-3.2', provider: 'OpenRouter', model: 'mistralai/mistral-small-3.2-24b-instruct', apiKeyEnv: 'OPENROUTER_API_KEY' },
    },
    {
      id: 'deepseek-v4-flash',
      model: { id: 'deepseek-v4-flash', provider: 'OpenRouter', model: 'deepseek/deepseek-v4-flash', apiKeyEnv: 'OPENROUTER_API_KEY' },
    },
    {
      id: 'deepseek-v3.2',
      model: { id: 'deepseek-v3.2', provider: 'OpenRouter', model: 'deepseek/deepseek-v3.2', apiKeyEnv: 'OPENROUTER_API_KEY' },
    },
    {
      id: 'qwen3-235b',
      model: { id: 'qwen3-235b', provider: 'OpenRouter', model: 'qwen/qwen3-235b-a22b-2507', apiKeyEnv: 'OPENROUTER_API_KEY' },
    },
    {
      id: 'gemini-3.5-flash',
      model: { id: 'gemini-3.5-flash', provider: 'OpenRouter', model: 'google/gemini-3.5-flash', apiKeyEnv: 'OPENROUTER_API_KEY' },
      // Reasoning-mode model: thinking tokens count against max_tokens; the
      // default budgets truncate (gemini: unbalanced_json) or empty out
      // (glm: reasoning consumed 100% of the budget). Proven by probe 2026-07-21.
      passOverrides: {
        skeleton: { maxTokens: 16384 },
        anatomist: { maxTokens: 16384 },
        lexicographer: { maxTokens: 16384 },
        weaver: { maxTokens: 16384 },
        typesetter: { maxTokens: 16384 },
      },
    },
    {
      id: 'claude-sonnet-5',
      model: { id: 'claude-sonnet-5', provider: 'OpenRouter', model: 'anthropic/claude-sonnet-5', apiKeyEnv: 'OPENROUTER_API_KEY', temperature: null },
      // Reasoning-mode model (see gemini-3.5-flash note): raise pass budgets so
      // thinking tokens cannot truncate/empty the output. 2026-07-21.
      passOverrides: {
        skeleton: { maxTokens: 16384 },
        anatomist: { maxTokens: 16384 },
        lexicographer: { maxTokens: 16384 },
        weaver: { maxTokens: 16384 },
        typesetter: { maxTokens: 16384 },
      },
    },
    {
      id: 'glm-5.2',
      model: { id: 'glm-5.2', provider: 'OpenRouter', model: 'z-ai/glm-5.2', apiKeyEnv: 'OPENROUTER_API_KEY' },
      // Reasoning-mode model: thinking tokens count against max_tokens; the
      // default budgets truncate (gemini: unbalanced_json) or empty out
      // (glm: reasoning consumed 100% of the budget). Proven by probe 2026-07-21.
      passOverrides: {
        skeleton: { maxTokens: 16384 },
        anatomist: { maxTokens: 16384 },
        lexicographer: { maxTokens: 16384 },
        weaver: { maxTokens: 16384 },
        typesetter: { maxTokens: 16384 },
      },
    },
    {
      id: 'qwen3.7-max',
      model: { id: 'qwen3.7-max', provider: 'OpenRouter', model: 'qwen/qwen3.7-max', apiKeyEnv: 'OPENROUTER_API_KEY' },
      // Reasoning-mode model (see gemini-3.5-flash note): raise pass budgets so
      // thinking tokens cannot truncate/empty the output. 2026-07-21.
      passOverrides: {
        skeleton: { maxTokens: 16384 },
        anatomist: { maxTokens: 16384 },
        lexicographer: { maxTokens: 16384 },
        weaver: { maxTokens: 16384 },
        typesetter: { maxTokens: 16384 },
      },
    },
    {
      id: 'deepseek-v4-pro',
      model: { id: 'deepseek-v4-pro', provider: 'OpenRouter', model: 'deepseek/deepseek-v4-pro', apiKeyEnv: 'OPENROUTER_API_KEY' },
      // Reasoning-mode model (see gemini-3.5-flash note): raise pass budgets so
      // thinking tokens cannot truncate/empty the output. 2026-07-21.
      passOverrides: {
        skeleton: { maxTokens: 16384 },
        anatomist: { maxTokens: 16384 },
        lexicographer: { maxTokens: 16384 },
        weaver: { maxTokens: 16384 },
        typesetter: { maxTokens: 16384 },
      },
    },
    {
      id: 'gpt-5.4-mini',
      model: { id: 'gpt-5.4-mini', provider: 'OpenRouter', model: 'openai/gpt-5.4-mini', apiKeyEnv: 'OPENROUTER_API_KEY', temperature: null },
      // Reasoning-mode model (see gemini-3.5-flash note): raise pass budgets so
      // thinking tokens cannot truncate/empty the output. 2026-07-21.
      passOverrides: {
        skeleton: { maxTokens: 16384 },
        anatomist: { maxTokens: 16384 },
        lexicographer: { maxTokens: 16384 },
        weaver: { maxTokens: 16384 },
        typesetter: { maxTokens: 16384 },
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
