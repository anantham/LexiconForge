// services/diff/types.ts

/** Semantic difference categories */
export type DiffColor = 'red' | 'orange' | 'blue' | 'purple' | 'grey' | 'green';

/** Granular reason codes for diff markers */
export type DiffReason =
  | 'missing-context'       // AI missing content present in raw (red)
  | 'plot-omission'         // AI skipped plot point from raw (red)
  | 'added-detail'          // AI elaborated beyond raw (orange)
  | 'hallucination'         // AI invented content (orange)
  | 'fan-divergence'        // AI differs from fan translation (blue)
  | 'sensitivity-filter'    // AI sanitized explicit detail vs fan (purple)
  | 'raw-divergence'        // Legacy raw mismatch (treated as red/orange)
  | 'stylistic-choice'      // Stylistic difference only (grey)
  | 'no-change';            // Internal fallback marker (grey)

/** Single diff marker for a paragraph chunk */
export interface DiffMarker {
  chunkId: string;                    // Format: "para-{position}-{hash4}"
  colors: DiffColor[];                // Multiple colors allowed
  reasons: DiffReason[];              // One reason per color
  explanations?: string[];            // Optional 1:1 explanations aligned with colors
  confidence?: number;                // Optional 0-1 confidence score
  aiRange: { start: number; end: number }; // Character offsets in full AI text
  position: number;                   // Paragraph index (0-based)
}

/** Complete diff analysis result for a chapter */
export interface DiffResult {
  chapterId: string;
  aiVersionId: string;                // Timestamp of AI translation
  fanVersionId: string | null;        // Timestamp of fan translation or null
  rawVersionId: string;               // Hash of raw source text
  algoVersion: string;                // E.g., "1.0.0"
  aiHash?: string;                    // 8-char hash of AI translation
  fanHash?: string | null;            // 8-char hash of fan translation if present
  rawHash?: string;                   // 8-char hash of raw source text
  markers: DiffMarker[];
  analyzedAt: number;                 // Timestamp
  costUsd: number;                    // API cost for this analysis
  model: string;                      // E.g., "gpt-4o-mini"
}

/** Input for diff analysis */
export interface DiffAnalysisRequest {
  chapterId: string;
  aiTranslation: string;              // Full AI translation text
  aiTranslationId?: string | null;    // Persistent translation record ID
  aiHash?: string;                    // Optional precomputed hash of AI text
  fanTranslation: string | null;      // Full fan translation or null
  fanTranslationId?: string | null;   // Optional fan translation ID if tracked
  fanHash?: string | null;            // Optional precomputed hash of fan text
  rawText: string;                    // Full raw source text
  rawHash?: string;                   // Optional precomputed hash of raw text
  previousVersionFeedback?: string;   // Optional feedback from prior version
  llmModel?: string;                  // Preferred analysis model
  llmProvider?: string;               // Preferred provider
  llmTemperature?: number;            // Preferred temperature
  promptOverride?: string | null;     // Optional custom diff-analysis prompt
}
