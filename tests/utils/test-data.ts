// Test data utilities for comprehensive testing
import { 
  Chapter, 
  TranslationResult, 
  FeedbackItem, 
  AmendmentProposal, 
  UsageMetrics, 
  Footnote,
  SuggestedIllustration,
  AppSettings,
  ImportedSession
} from '../../types';

export const MOCK_KAKUYOMU_URLS = {
  chapter1: 'https://kakuyomu.jp/works/16816927859418072361/episodes/16818093085877625597',
  chapter2: 'https://kakuyomu.jp/works/16816927859418072361/episodes/16818093085877625598',
  chapter3: 'https://kakuyomu.jp/works/16816927859418072361/episodes/16818093085877625599',
  chapter26: 'https://kakuyomu.jp/works/16816927859418072361/episodes/16817330667519208237',
  // Broken chain - missing chapter
  orphanChapter: 'https://kakuyomu.jp/works/16816927859418072361/episodes/16818093085877625999',
} as const;

export const createMockChapter = (overrides: Partial<Chapter> = {}): Chapter => ({
  title: '第一話　最強の陰陽師、言い逃れる',
  content: `「君――――魔王なんだって？」

　皇帝ジルゼリウスが放ったその言葉を、ぼくは立ち尽くしたまま聞いていた。

　謁見の間はいつの間にか、皇帝が纏う得体の知れない威圧感に支配されていた。それは魔法でもなく、単純な実力の差でもない。長年この国を統治してきた者だけが持つ、圧倒的な存在感だった。`,
  originalUrl: MOCK_KAKUYOMU_URLS.chapter1,
  nextUrl: MOCK_KAKUYOMU_URLS.chapter2,
  prevUrl: null,
  ...overrides,
});

export const createChapterChain = (count: number): Chapter[] => {
  return Array.from({ length: count }, (_, index) => {
    const urlBase = 'https://kakuyomu.jp/works/16816927859418072361/episodes/';
    const currentId = (16818093085877625597 + index).toString();
    const nextId = index < count - 1 ? (16818093085877625597 + index + 1).toString() : null;
    const prevId = index > 0 ? (16818093085877625597 + index - 1).toString() : null;
    
    return createMockChapter({
      title: `第${index + 1}話　テストチャプター${index + 1}`,
      originalUrl: urlBase + currentId,
      nextUrl: nextId ? urlBase + nextId : null,
      prevUrl: prevId ? urlBase + prevId : null,
    });
  });
};

export const createMockUsageMetrics = (overrides: Partial<UsageMetrics> = {}): UsageMetrics => ({
  totalTokens: 2500,
  promptTokens: 1800,
  completionTokens: 700,
  estimatedCost: 0.00858,
  requestTime: 59.26,
  provider: 'Gemini',
  model: 'gemini-2.5-flash',
  ...overrides,
});

export const createMockFootnotes = (): Footnote[] => [
  {
    marker: '1',
    text: '[TL Note:] <i>yokai</i> (妖): A class of supernatural entities and spirits in Japanese folklore.',
  },
  {
    marker: '2', 
    text: '[Author\'s Note:] The original uses 魔王 (maō), literally "Demon King".',
  },
];

export const createMockIllustrations = (): SuggestedIllustration[] => [
  {
    placementMarker: '[ILLUSTRATION-1]',
    imagePrompt: 'A dramatic wide shot of Seika, a young boy with silver hair, standing defiantly in a windswept graveyard at night. Behind him, a colossal Gashadokuro skeleton, glowing with an eerie blue light, rises from the earth.',
  },
];

export const createMockTranslationResult = (overrides: Partial<TranslationResult> = {}): TranslationResult => ({
  translatedTitle: 'Chapter 1: The Strongest Exorcist Makes Excuses',
  translation: `"You——are the Demon King, aren't you?"

I stood frozen as Emperor Jilzelius spoke those words.

[ILLUSTRATION-1]

Before I knew it, the throne room had fallen under the dominion of an inexplicable pressure emanating from the emperor. It wasn't magic, nor was it simply a difference in raw power. It was the overwhelming presence that only someone who had ruled this nation for many years could possess.`,
  proposal: null,
  footnotes: createMockFootnotes(),
  suggestedIllustrations: createMockIllustrations(),
  usageMetrics: createMockUsageMetrics(),
  ...overrides,
});

export const createMockAmendmentProposal = (overrides: Partial<AmendmentProposal> = {}): AmendmentProposal => ({
  observation: 'This chapter introduces recurring terminology that should be standardized.',
  currentRule: 'Novel-Specific Glossary (Live Document): This glossary will be maintained for consistency.\nRomaji Terms: hitogata, koku, jō, Gashadokuro, ayakashi, onryō, yokai.\nTranslated Terms: Almiraj (Horned Rabbit), Frost Wraith, 認定票 (Adventurer\'s Medallion).',
  proposedChange: '+ Add to Translated Terms: 森人 (Moribito) -> Forestfolk (elf-like race); 死霊兵 -> Necrosoldier(s); 聖騎士 -> Holy Knight (Paladin).\n+ Add to Romaji Terms (for reference only): Moribito.\n- No change to existing entries.',
  reasoning: 'These terms recur frequently and need consistent English translations to avoid drift between chapters.',
  ...overrides,
});

export const createMockFeedbackItems = (): FeedbackItem[] => [
  {
    id: '2023-12-01T10:30:00.000Z',
    selection: 'Demon King',
    type: '👎',
    comment: 'Too generic - maybe "Dark Lord" or keep "Maō"?',
  },
  {
    id: '2023-12-01T10:35:00.000Z', 
    selection: 'overwhelming presence',
    type: '👍',
    comment: 'Perfect translation of the emperor\'s aura!',
  },
  {
    id: '2023-12-01T10:40:00.000Z',
    selection: 'stood frozen',
    type: '?',
    comment: 'Is this the best way to convey the paralysis?',
  },
];

export const createMockAppSettings = (overrides: Partial<AppSettings> = {}): AppSettings => ({
  contextDepth: 2,
  preloadCount: 3,
  fontSize: 18,
  fontStyle: 'serif',
  lineHeight: 1.7,
  systemPrompt: 'Test system prompt for translations...',
  provider: 'Gemini',
  model: 'gemini-2.5-flash', 
  temperature: 0.3,
  apiKeyGemini: 'test-gemini-key',
  apiKeyOpenAI: 'test-openai-key',
  apiKeyDeepSeek: 'test-deepseek-key',
  ...overrides,
});

export const createMockImportedSession = (): ImportedSession => {
  const chapters = createChapterChain(3);
  
  return {
    session_metadata: {
      exported_at: '2023-12-01T12:00:00.000Z',
      settings: {
        contextDepth: 2,
        preloadCount: 3,
        fontSize: 18,
        fontStyle: 'serif',
        lineHeight: 1.7,
        systemPrompt: 'Imported system prompt...',
        provider: 'OpenAI',
        model: 'gpt-5',
        temperature: 0.5,
      },
    },
    urlHistory: [
      MOCK_KAKUYOMU_URLS.chapter1,
      MOCK_KAKUYOMU_URLS.chapter2,
      MOCK_KAKUYOMU_URLS.chapter3,
    ],
    chapters: chapters.map((chapter, index) => ({
      sourceUrl: chapter.originalUrl,
      title: chapter.title,
      originalContent: chapter.content,
      nextUrl: chapter.nextUrl,
      prevUrl: chapter.prevUrl,
      translationResult: index < 2 ? createMockTranslationResult() : null,
      feedback: index === 0 ? createMockFeedbackItems() : [],
    })),
  };
};

// Mock API responses for different providers
export const MOCK_API_RESPONSES = {
  gemini: {
    success: {
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify(createMockTranslationResult()),
          }],
        },
      }],
      usageMetadata: {
        promptTokenCount: 1800,
        candidatesTokenCount: 700,
        totalTokenCount: 2500,
      },
    },
    error: {
      error: {
        code: 429,
        message: 'Resource exhausted',
        status: 'RESOURCE_EXHAUSTED',
      },
    },
  },
  openai: {
    success: {
      choices: [{
        message: {
          content: JSON.stringify(createMockTranslationResult()),
        },
      }],
      usage: {
        prompt_tokens: 1800,
        completion_tokens: 700,
        total_tokens: 2500,
      },
    },
    error: {
      error: {
        code: 'rate_limit_exceeded',
        message: 'Rate limit exceeded',
        type: 'rate_limit_exceeded',
      },
    },
  },
  deepseek: {
    success: {
      choices: [{
        message: {
          content: JSON.stringify(createMockTranslationResult()),
        },
      }],
      usage: {
        prompt_tokens: 1800,
        completion_tokens: 700,
        total_tokens: 2500,
      },
    },
  },
};

// Test scenarios for edge cases
export const TEST_SCENARIOS = {
  emptyChapter: createMockChapter({
    title: '',
    content: '',
  }),
  
  longChapter: createMockChapter({
    content: 'Very long content... '.repeat(1000),
  }),
  
  japaneseOnlyChapter: createMockChapter({
    title: '第二十六話　最強の陰陽師、再び皇帝と相対する',
    content: '「魔王討伐の件について話そう」皇帝は重々しく口を開いた。'.repeat(50),
  }),
  
  brokenChainChapter: createMockChapter({
    originalUrl: MOCK_KAKUYOMU_URLS.orphanChapter,
    nextUrl: 'https://invalid-url.com/404',
    prevUrl: null,
  }),
  
  circularChainStart: createMockChapter({
    originalUrl: MOCK_KAKUYOMU_URLS.chapter1,
    nextUrl: MOCK_KAKUYOMU_URLS.chapter2,
    prevUrl: MOCK_KAKUYOMU_URLS.chapter3, // Creates circular reference
  }),
};