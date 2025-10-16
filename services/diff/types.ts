// services/diff/types.ts

/** Semantic difference categories */
export type DiffColor = 'red' | 'orange' | 'green' | 'grey';

/** Granular reason codes for diff markers */
export type DiffReason =
  | 'missing-context'      // AI missing content from fan (red)
  | 'plot-omission'        // AI skipped plot point (red)
  | 'added-detail'         // AI elaborated beyond source (green)
  | 'hallucination'        // AI invented content (green)
  | 'raw-divergence'       // AI differs from raw source (orange)
  | 'stylistic-choice';    // Phrasing/word choice difference (grey)

/** Single diff marker for a paragraph chunk */
export interface DiffMarker {
  chunkId: string;                    // Format: "para-{position}-{hash4}"
  colors: DiffColor[];                // Multiple colors allowed
  reasons: DiffReason[];              // One reason per color
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
  markers: DiffMarker[];
  analyzedAt: number;                 // Timestamp
  costUsd: number;                    // API cost for this analysis
  model: string;                      // E.g., "gpt-4o-mini"
}

/** Input for diff analysis */
export interface DiffAnalysisRequest {
  chapterId: string;
  aiTranslation: string;              // Full AI translation text
  fanTranslation: string | null;      // Full fan translation or null
  rawText: string;                    // Full raw source text
  previousVersionFeedback?: string;   // Optional feedback from prior version
}
