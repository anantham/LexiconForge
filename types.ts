import type { DeepLoomPacket } from './types/suttaStudio';

export interface Chapter {
  title: string;
  content: string;
  originalUrl: string;
  url?: string;
  canonicalUrl?: string;
  stableId?: string;
  nextUrl?: string | null;
  prevUrl?: string | null;
  chapterNumber?: number;
  fanTranslation?: string | null;
  suttaStudio?: DeepLoomPacket | null;
  blurb?: string | null;
  sourceLanguage?: string | null;
  targetLanguage?: string | null;
  translationResult?: TranslationResult | null;
}

export interface ChapterSummary {
  stableId: string;
  canonicalUrl?: string;
  title: string;
  translatedTitle?: string;
  chapterNumber?: number;
  hasTranslation: boolean;
  hasImages: boolean;
  lastAccessed?: string;
  lastTranslatedAt?: string;
}

// Legacy interface for backwards compatibility with tests
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
  text: string;
  category: string;
  timestamp: number;
  chapterId: string;
  // Legacy fields for backward compatibility
  selection?: string;
  type?: '👍' | '👎' | '?' | '🎨';
  comment?: string;
}

export interface AmendmentProposal {
  observation: string;
  currentRule: string;
  proposedChange: string;
  reasoning: string;
}

export type AmendmentAction = 'accepted' | 'rejected' | 'modified';

export interface AmendmentActionLog {
  id: string; // UUID
  timestamp: number; // Unix timestamp
  chapterId?: string; // Optional: chapter that triggered this proposal
  proposal: AmendmentProposal;
  action: AmendmentAction;
  finalPromptChange?: string; // For 'modified' action: what the user actually applied
  notes?: string; // Optional user notes about why they modified/rejected
}

export interface Footnote {
  marker: string;
  text: string;
}

export interface SuggestedIllustration {
  placementMarker: string;
  imagePrompt: string;
  generatedImage?: GeneratedImageResult; // Stores the actual generated image data for persistence
  imageCacheKey?: ImageCacheKey; // NEW: Cache key for images stored in Cache API
  url?: string; // Legacy base64 field (deprecated)
}

/**
 * Cache key for retrieving images from Cache API
 * Store this instead of blob URLs (which are session-scoped)
 */
export interface ImageCacheKey {
  chapterId: string;
  placementMarker: string;
  version: number;  // Version number for tracking multiple generations (1-indexed)
}

export interface GeneratedImageResult {
  /**
   * Image data - supports two storage modes:
   * 1. Legacy: base64 data URL (data:image/png;base64,...)
   * 2. Modern: Cache API key (use imageCacheKey field instead)
   *
   * DEPRECATED: For new images, use imageCacheKey instead.
   * This field kept for backwards compatibility with existing data.
   */
  imageData: string; // base64 string OR empty if using cache key

  /**
   * Cache key for retrieving image from Cache API
   * When present, use ImageCacheStore.createBlobUrl(imageCacheKey) to render
   */
  imageCacheKey?: ImageCacheKey;

  requestTime: number; // in seconds
  cost: number;
  metadata?: ImageGenerationMetadata;
}

export interface ImageGenerationMetadata {
  version: number;
  prompt: string;
  negativePrompt?: string;
  guidanceScale?: number;
  loraModel?: string | null;
  loraStrength?: number;
  steeringImage?: string | null;
  provider?: string | null;
  model?: string | null;
  generatedAt: string;
}

export interface ImageVersionStateEntry {
  latestVersion: number;
  activeVersion: number;
  versions: Record<number, ImageGenerationMetadata>;
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
    maxOutputTokens?: number;
  };
}

export interface TranslationTokensUsed {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface TranslationIllustration {
  description?: string;
  placement: string;
  imagePrompt?: string;
  generatedImage?: string;
  url?: string;
  [key: string]: any;
}

export interface TranslationAmendment {
  issue?: string;
  currentTranslation?: string;
  suggestedImprovement?: string;
  reasoning?: string;
  notes?: string;
  [key: string]: any;
}

export type TranslationSettingsSnapshot = Partial<Pick<
  AppSettings,
  | 'provider'
  | 'model'
  | 'temperature'
  | 'topP'
  | 'frequencyPenalty'
  | 'presencePenalty'
  | 'seed'
  | 'contextDepth'
  | 'systemPrompt'
>> & {
  promptId?: string;
  promptName?: string;
};

export interface TranslationResult {
  translatedTitle: string;
  translation: string;
  proposal: AmendmentProposal | null;
  footnotes: Footnote[];
  suggestedIllustrations: SuggestedIllustration[];
  usageMetrics: UsageMetrics;
  customVersionLabel?: string;
  imageVersionState?: Record<string, ImageVersionStateEntry>;
  // Persistent metadata
  id?: string;
  version?: number;
  provider?: TranslationProvider | string;
  model?: string;
  temperature?: number;
  tokensUsed?: TranslationTokensUsed;
  costUsd?: number;
  requestTime?: number;
  translationSettings?: TranslationSettingsSnapshot | null;
  promptId?: string;
  promptName?: string;
  // Optional illustration/amendment payloads emitted by providers
  illustrations?: TranslationIllustration[];
  amendments?: TranslationAmendment[];
  // Legacy compatibility fields
  translatedContent?: string;
}

export interface HistoricalChapter {
  originalTitle: string;
  originalContent: string;
  translatedTitle: string;
  translatedContent: string;
  footnotes: Footnote[];
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
    novelTitle?: string;           // Optional: user-provided novel title override
    // Localization target
    sourceLanguage?: string;       // e.g., "Korean", "Japanese"
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
    imageAspectRatio?: string;
    imageSizePreset?: string;
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
    maxSessionSize?: number;

    // Advanced AI controls
    maxOutputTokens?: number;                 // Optional hard cap on generated tokens
    retryMax?: number;                        // Max retries for rate-limit/backoff
    retryInitialDelayMs?: number;             // Initial backoff delay in ms
    footnoteStrictMode?: 'append_missing' | 'fail'; // Footnote validation behavior
    enableHtmlRepair?: boolean;               // Enable graceful HTML formatting repairs
    enableAmendments?: boolean;               // Enable prompt amendment proposals from AI
    includeFanTranslationInPrompt?: boolean;  // Include fan translation as reference in API calls
    // Diff heatmap display
    showDiffHeatmap?: boolean;                // Show semantic diff markers in gutter (default: true)
    diffMarkerVisibility?: DiffMarkerVisibilitySettings;
    diffAnalysisPrompt?: string;
    // Audio feature
    enableAudio?: boolean;                    // Show audio generation controls (default: false)
    // Prompt snapshot metadata
    promptId?: string;
    promptName?: string;
}

export interface DiffMarkerVisibilitySettings {
    fan: boolean;            // Blue - fan divergence
    rawLoss: boolean;        // Red - missing vs raw
    rawGain: boolean;        // Orange - added vs raw
    sensitivity: boolean;    // Purple - sanitized vs fan
    stylistic: boolean;      // Grey - stylistic / fallback
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
    fanTranslation?: string | null;
    suttaStudio?: DeepLoomPacket | null;
}

export interface SessionChapterData {
  chapter: Chapter;
  translationResult: TranslationResult | null;
  availableVersions?: any[]; // All available translation versions
  activeVersion?: number; // Currently selected version number
  feedback?: FeedbackItem[];
  translationSettingsSnapshot?: TranslationSettingsSnapshot | null;
}

export interface ImportedSession {
    session_metadata: {
        exported_at: string;
        settings: Omit<AppSettings, 'apiKeyGemini' | 'apiKeyOpenAI' | 'apiKeyDeepSeek'>;
    };
    urlHistory: string[];
    chapters: ImportedChapter[];
}

// Audio Generation Types
export type AudioProvider = 'ace-step' | 'diffrhythm';
export type AudioTaskType = 'txt2audio' | 'audio2audio' | 'txt2audio-base' | 'txt2audio-full';
export type AudioJobStatus = 'queued' | 'generating' | 'completed' | 'failed' | 'cancelled';

export interface AudioStylePreset {
  id: string;
  name: string;
  description: string;
  stylePrompt: string;
  negativePrompt?: string;
  suitableFor: ('action' | 'romance' | 'mystery' | 'peaceful' | 'dramatic' | 'ambient')[];
  provider: AudioProvider;
  taskType: AudioTaskType;
  duration?: number; // in seconds
}

export interface AudioGenerationInput {
  stylePrompt: string;
  negativePrompt?: string;
  lyrics?: string;
  duration?: number;
  styleAudio?: string; // base64 or URL for audio2audio
}

export interface GeneratedAudioResult {
  audioUrl: string; // URL to generated audio (from API)
  duration: number; // in seconds
  requestTime: number; // in seconds
  cost: number;
  provider: AudioProvider;
  taskType: AudioTaskType;
}

export interface AudioManifest {
  id: string; // `${chapterId}:${hash}`
  chapterId: string;
  uri: string; // opfs://ost/... or cache://ost/...
  mime: string; // e.g., 'audio/mpeg'
  durationSec: number;
  size: number;
  hash: string;
  pinned: boolean;
  createdAt: number;
  lastPlayedAt?: number;
  expiresAt?: number; // remote expiry hint
  provider: AudioProvider;
  taskType: AudioTaskType;
  cost: number;
}

export interface AudioJob {
  id: string;
  chapterId: string;
  provider: AudioProvider;
  taskType: AudioTaskType;
  status: AudioJobStatus;
  input: AudioGenerationInput;
  result?: GeneratedAudioResult;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface AudioMetrics {
  totalCost: number;
  totalDuration: number; // total seconds of audio generated
  generationCount: number;
  lastGenerated?: string;
  providerBreakdown: Record<AudioProvider, {
    cost: number;
    duration: number;
    count: number;
  }>;
}

export interface PlaybackState {
  chapterId: string;
  audioUrl: string;
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}
