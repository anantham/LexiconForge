/**
 * Provider abstraction for the grounded curation data layer.
 *
 * Every factual linguistic, textual, bibliographic, or parallelism claim
 * in a DeepLoomPacket should be traceable to a provider response captured
 * here. Hand-curation and the live LLM compiler both consume this layer;
 * neither invents data that didn't come from a real source.
 *
 * See `docs/adr/SUTTA-008-grounded-curation-data-layer.md` for the
 * architecture this realises.
 */

import type { MorphHint, ParallelRef } from '../../types/suttaStudio';

// ─────────────────────────────────────────────────────────────────────────────
// Provider identity
// ─────────────────────────────────────────────────────────────────────────────

export type LexiconProviderId =
  | 'sc-dictionary-full'
  | 'dpd'
  | 'ms-dpd'
  | 'ped-dsal'
  | 'cpd';

export type MorphologyProviderId = 'dpd' | 'palinlp';

export type CommentaryProviderId = 'vri-attha' | 'sc-commentary';

export type EditionProviderId = 'vri-cscd' | 'sc-publication' | 'pts-edition';

export type WitnessProviderId = 'bdrc' | 'cbeta' | 'gretil';

export type ParallelProviderId = 'sc-suttaplex' | 'buddhanexus';

export type ProviderId =
  | LexiconProviderId
  | MorphologyProviderId
  | CommentaryProviderId
  | EditionProviderId
  | WitnessProviderId
  | ParallelProviderId;

// ─────────────────────────────────────────────────────────────────────────────
// Response base
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every provider response carries stable identifiers so that citation
 * materialization is mechanical, not hand-glued.
 *
 *   sourceId  — provider-local handle (DPD row id, SC dictionary key, …)
 *   citationId — deterministic packet citation id:
 *                `cite:{providerId}:{sourceId}` when sourceId is present,
 *                `cite:{providerId}:q:{query}` otherwise.
 */
export interface ProviderResponseBase {
  sourceId?: string;
  citationId?: string;
}

export interface LookupOptions {
  signal?: AbortSignal;
  throttle?: (signal?: AbortSignal) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lexicon
// ─────────────────────────────────────────────────────────────────────────────

export interface LexiconSense {
  english: string;
  nuance?: string;
  notes?: string;
  /** Per-sense citation hint if the provider supplies one (e.g., a sutta cf.). */
  citation?: string;
}

export interface LexiconEntry extends ProviderResponseBase {
  /** Lemma the entry answers for. Normalised headword from the provider. */
  lemma: string;
  /** Rough part-of-speech tag if the provider reports one. */
  partOfSpeech?: string;
  senses: LexiconSense[];
  /** Structured morphology when the provider supplies parsed grammar (DPD does; SC doesn't). */
  morphology?: MorphHint;
  /**
   * Raw upstream excerpt — the source string from which the structured fields
   * were derived. This is what gets baked into `Citation.excerpt` so the
   * renderer can show the original attestation without re-fetching.
   */
  rawExcerpt?: string;
}

export interface LexiconProvider {
  readonly id: LexiconProviderId;
  /** Human-readable provider label used in prompts and UI. */
  readonly label: string;
  /** License + attribution string for citations. Surfaced in renderer attribution UI. */
  readonly license: string;
  lookup(lemma: string, opts?: LookupOptions): Promise<LexiconEntry[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Morphology (specialisation; DPD typically fills both LexiconEntry.morphology
// and acts as a MorphologyProvider for inflected-form → lemma resolution).
// ─────────────────────────────────────────────────────────────────────────────

export interface MorphologyCandidate extends ProviderResponseBase {
  lemma: string;
  morph: MorphHint;
  confidence?: 'high' | 'medium' | 'low';
}

export interface MorphologyProvider {
  readonly id: MorphologyProviderId;
  readonly label: string;
  readonly license: string;
  analyze(wordform: string, opts?: LookupOptions): Promise<MorphologyCandidate[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Commentary
// ─────────────────────────────────────────────────────────────────────────────

export interface CommentaryExcerpt extends ProviderResponseBase {
  /** Bilara canonical segment id this commentary entry is keyed to (e.g., 'mn10:1.1'). */
  canonicalSegmentId: string;
  pali?: string;
  english?: string;
  language?: string;
  rawExcerpt?: string;
}

export interface CommentaryProvider {
  readonly id: CommentaryProviderId;
  readonly label: string;
  readonly license: string;
  lookupBySegment(canonicalSegmentId: string, opts?: LookupOptions): Promise<CommentaryExcerpt | null>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Edition descriptors (provenance.edition feeder)
// ─────────────────────────────────────────────────────────────────────────────

export interface EditionDescriptor extends ProviderResponseBase {
  name: string;
  year?: string;
  council?: string;
  digitalSource?: string;
  license?: string;
  url?: string;
}

export interface EditionProvider {
  readonly id: EditionProviderId;
  readonly label: string;
  describe(workId: string, opts?: LookupOptions): Promise<EditionDescriptor | null>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Witnesses (TextGraph layer — BDRC, CBETA, GRETIL …)
// ─────────────────────────────────────────────────────────────────────────────

export interface WitnessRecord extends ProviderResponseBase {
  workId: string;
  kind: 'manuscript' | 'inscription' | 'printed_edition' | 'digital_transcription' | 'reconstruction';
  date?: string;
  place?: string;
  script?: string;
  repository?: string;
  externalIds?: Record<string, string>;
  url?: string;
}

export interface WitnessProvider {
  readonly id: WitnessProviderId;
  readonly label: string;
  getWitnesses(workId: string, opts?: LookupOptions): Promise<WitnessRecord[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parallels
// ─────────────────────────────────────────────────────────────────────────────

export interface ParallelProvider {
  readonly id: ParallelProviderId;
  readonly label: string;
  getParallels(workId: string, opts?: LookupOptions): Promise<ParallelRef[]>;
}
