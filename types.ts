
export interface Chapter {
  title: string;
  content: string;
  originalUrl: string;
  nextUrl: string | null;
  prevUrl: string | null;
}

export abstract class BaseAdapter {
  protected url: string;
  protected doc: Document;

  constructor(url: string, doc: Document) {
    this.url = url;
    this.doc = doc;
  }

  abstract extractTitle(): string | null;
  abstract extractContent(): string | null;
  abstract getNextLink(): string | null;
  abstract getPrevLink(): string | null;
}

export interface FeedbackItem {
  id: string;
  selection: string;
  type: '👍' | '👎' | '?';
  comment?: string;
}

export interface AmendmentProposal {
  observation: string;
  currentRule: string;
  proposedChange: string;
  reasoning: string;
}

export interface Footnote {
  marker: string;
  text: string;
}

export interface SuggestedIllustration {
  placementMarker: string;
  imagePrompt: string;
}

export interface GeneratedImageResult {
  imageData: string; // base64 string
  requestTime: number; // in seconds
  cost: number;
}

export interface UsageMetrics {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
  requestTime: number; // in seconds
  provider: TranslationProvider;
  model: string;
}

export interface TranslationResult {
  translatedTitle: string;
  translation: string;
  proposal: AmendmentProposal | null;
  footnotes: Footnote[];
  suggestedIllustrations: SuggestedIllustration[];
  usageMetrics: UsageMetrics;
}

export interface HistoricalChapter {
  originalTitle: string;
  originalContent: string;
  translatedTitle: string;
  translatedContent: string;
  feedback: FeedbackItem[];
}

export type TranslationProvider = 'Gemini' | 'OpenAI' | 'DeepSeek';

export interface PromptTemplate {
  id: string;                    // UUID
  name: string;                  // "Wuxia Romance", "Technical Manual", etc.
  description?: string;          // Optional description
  content: string;               // The actual system prompt
  isDefault: boolean;            // One template marked as default
  createdAt: string;             // ISO timestamp
  lastUsed?: string;             // ISO timestamp when last selected
}

export interface ModelInfo {
    id: string;
    name: string;
    provider: TranslationProvider;
}

export interface AppSettings {
    contextDepth: number;
    preloadCount: number;
    fontSize: number;
    fontStyle: 'sans' | 'serif';
    lineHeight: number;
    systemPrompt: string;          // Keep for backward compatibility
    activePromptId?: string;       // ID of currently selected prompt template
    provider: TranslationProvider;
    model: string; // The ID of the model, e.g., 'gemini-2.5-pro'
    temperature: number; // 0.0 to 2.0, controls randomness/creativity
    apiKeyGemini?: string;
    apiKeyOpenAI?: string;
    apiKeyDeepSeek?: string;
}

export interface ImportedChapter {
    sourceUrl: string;
    title: string;
    originalContent: string;
    nextUrl: string | null;
    prevUrl: string | null;
    translationResult: TranslationResult | null;
    feedback: FeedbackItem[];
}

export interface ImportedSession {
    session_metadata: {
        exported_at: string;
        settings: Omit<AppSettings, 'apiKeyGemini' | 'apiKeyOpenAI' | 'apiKeyDeepSeek'>;
    };
    urlHistory: string[];
    chapters: ImportedChapter[];
}