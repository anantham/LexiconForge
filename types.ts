
export interface Chapter {
  title: string;
  content: string;
  originalUrl: string;
  nextUrl: string | null;
  prevUrl: string | null;
  chapterNumber?: number;
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
  generatedImage?: GeneratedImageResult; // Stores the actual generated image data for persistence
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
  // Track actual parameters sent to API (only non-default, supported values)
  actualParams?: {
    temperature?: number;
    topP?: number; 
    frequencyPenalty?: number;
    presencePenalty?: number;
    seed?: number | null;
  };
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

export type TranslationProvider = 'Gemini' | 'OpenAI' | 'DeepSeek' | 'Claude' | 'OpenRouter';

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
    // Localization target
    targetLanguage?: string;       // e.g., "English", "Malayalam"
    provider: TranslationProvider;
    model: string; // The ID of the model, e.g., 'gemini-2.5-pro'
    imageModel: string; // The ID of the image model, e.g., 'imagen-4.0-ultra...'
    temperature: number; // 0.0 to 2.0, controls randomness/creativity
    // Expanded AI parameters (OpenAI-compatible)
    topP?: number;               // 0.0 to 1.0, nucleus sampling 
    frequencyPenalty?: number;   // -2.0 to 2.0, reduces repetition
    presencePenalty?: number;    // -2.0 to 2.0, encourages topic diversity  
    seed?: number | null;        // For reproducible outputs
    apiKeyGemini?: string;
    apiKeyOpenAI?: string;
    apiKeyDeepSeek?: string;
    apiKeyClaude?: string;
    apiKeyOpenRouter?: string;
    apiKeyPiAPI?: string;
    imageWidth?: number;
    imageHeight?: number;
    // Image generation advanced controls
    defaultNegativePrompt?: string;
    defaultGuidanceScale?: number;
    // EPUB/export options
    exportOrder?: 'number' | 'navigation';
    includeTitlePage?: boolean;
    includeStatsPage?: boolean;
    // EPUB template overrides (optional; leave blank to use defaults)
    epubGratitudeMessage?: string;
    epubProjectDescription?: string;
    epubFooter?: string | null;

    // Advanced AI controls
    maxOutputTokens?: number;                 // Optional hard cap on generated tokens
    retryMax?: number;                        // Max retries for rate-limit/backoff
    retryInitialDelayMs?: number;             // Initial backoff delay in ms
    footnoteStrictMode?: 'append_missing' | 'fail'; // Footnote validation behavior
}

export interface ImportedChapter {
    sourceUrl: string;
    title: string;
    originalContent: string;
    nextUrl: string | null;
    prevUrl: string | null;
    translationResult: TranslationResult | null;
    feedback: FeedbackItem[];
    chapterNumber?: number;
}

export interface SessionChapterData {
  chapter: Chapter;
  translationResult: TranslationResult | null;
  availableVersions?: any[]; // All available translation versions
  activeVersion?: number; // Currently selected version number
}

export interface ImportedSession {
    session_metadata: {
        exported_at: string;
        settings: Omit<AppSettings, 'apiKeyGemini' | 'apiKeyOpenAI' | 'apiKeyDeepSeek'>;
    };
    urlHistory: string[];
    chapters: ImportedChapter[];
}
