/**
 * Canonical liturgy data-quality validation.
 *
 * One implementation of the silent-failure invariants for `LiturgyDoc`, shared
 * by every consumer that used to carry its own copy:
 *
 *  - the generator (services/liturgy-generator/validate.ts) runs it over a
 *    freshly-built draft and refuses to emit on any error;
 *  - the corpus tests (tests/components/liturgy/*) run it over every shipped
 *    chant in `LITURGY_DOCS_BY_SANGHA` so drift in real sheets is caught too.
 *
 * Before this module the morpheme-reconstruction loop, the `alignTo`
 * length/range checks, the segment-ID and grammar-jargon regexes, and the
 * Pāli/English tokenizers were duplicated (byte-for-byte) across the generator
 * and three test files. The tokenizer in particular is a mirror of the
 * renderer's word class in `components/liturgy/shapes/TripleScriptWitness.tsx`;
 * keeping four copies in sync by hand is exactly the drift this module removes.
 *
 * Diagnostic codes here are bare (`morpheme_reconstruction_failed`); the
 * generator namespaces them with a `liturgy_generator.` prefix for its own
 * stream, the corpus tests consume them directly.
 */

import type { LiturgyDoc, TripleScriptWitnessSection, WordGloss } from '../../types/liturgy';

// ── Canonical tokenizers ────────────────────────────────────────────────────
// Pāli word class — MUST stay identical to the renderer's `tokenize` regex in
// components/liturgy/shapes/TripleScriptWitness.tsx (Latin + IAST diacritics).
// `alignTo` indices point into the Pāli words this produces, so this is the
// single source of truth for "how many Pāli words does a segment have".
export const PALI_WORD_RE = /[A-Za-zĀāĪīŪūṚṛṂṃṄṅÑñṬṭḌḍṆṇŚśṢṣḤḥṁÀ-ɏ]+/g;

export function tokenizePali(text: string): string[] {
  return text.match(PALI_WORD_RE) ?? [];
}

export function countPaliWords(text: string): number {
  return tokenizePali(text).length;
}

// English witness tokenizer — mirror of EnglishLine: whitespace split, drop
// empties. `alignTo.length` must equal this count.
export function tokenizeEnglish(text: string): string[] {
  return text.split(/\s+/).filter((token) => token.length > 0);
}

export function countEnglishWords(text: string): number {
  return tokenizeEnglish(text).length;
}

// ── Plain-register tripwires ────────────────────────────────────────────────
// The curator's internal segment-ID shorthand: v + digits + a trailing letter
// (v1a, v7d, v10c). Reader-facing text must never contain it; say "verse N".
export const SEGMENT_ID_SHORTHAND = /\bv\d+[a-z]\b/;

// Grammar jargon that CURATION_PROTOCOL.md §3.4 flags as failure-tone in the
// plain-prose register — show the grammatical idea in plain English instead.
// A tripwire, not an absolute ban: a term that genuinely pays rent (does work
// plain English can't AND is glossed in the same sentence) can be passed via
// the jargonAllowlist option rather than deleting the check.
export const JARGON = /\b(gerundive|accusative|nominative|genitive|locative|ablative|optative|vocative|declension|declensional|instrumental case|past participle|present participle)\b/i;

// Token separators that are not morpheme content: ASCII whitespace and the
// Tibetan tsek `་`. Per-script morphemes reconstruct the separator-free
// surface (the renderer splits per token).
const SCRIPT_SEPARATOR_RE = /[\s་]/g;

// ── Diagnostic contract ─────────────────────────────────────────────────────
export type LiturgyDiagnosticLevel = 'error' | 'warn';

export type LiturgyDiagnostic = {
  level: LiturgyDiagnosticLevel;
  code: string;
  message: string;
  docSlug?: string;
  sectionId?: string;
  segmentId?: string;
  witnessBy?: string;
  path?: string;
};

export type ValidateLiturgyOptions = {
  /** Jargon terms (lowercased) that have earned a pay-rent exception. */
  jargonAllowlist?: readonly string[];
};

type TextContext = {
  sectionId?: string;
  segmentId?: string;
  path: string;
};

function checkText(
  diagnostics: LiturgyDiagnostic[],
  text: string | undefined,
  context: TextContext,
  jargonAllowlist: readonly string[]
): void {
  if (!text) return;

  if (SEGMENT_ID_SHORTHAND.test(text)) {
    diagnostics.push({
      level: 'error',
      code: 'internal_id_leak',
      message: `reader-facing text contains an internal segment id ("verse N" instead): "${text}"`,
      ...context,
    });
  }

  const jargonMatch = text.match(JARGON);
  if (jargonMatch && !jargonAllowlist.includes(jargonMatch[0].toLowerCase())) {
    diagnostics.push({
      level: 'warn',
      code: 'plain_register_jargon',
      message: `reader-facing text uses grammar jargon "${jargonMatch[0]}" — show the idea in plain English (CURATION_PROTOCOL §3.4) or allowlist it: "${text}"`,
      ...context,
    });
  }
}

function checkWord(
  diagnostics: LiturgyDiagnostic[],
  word: WordGloss,
  base: { sectionId?: string; segmentId?: string },
  jargonAllowlist: readonly string[]
): void {
  const wordPath = `${base.segmentId ?? '?'}.words.${word.form}`;

  // 1a. Roman morpheme reconstruction (case-insensitive surface match).
  if (word.morphemes && word.morphemes.length > 0) {
    const reconstructed = word.morphemes.map((m) => m.text).join('');
    if (reconstructed.toLowerCase() !== word.form.toLowerCase()) {
      diagnostics.push({
        level: 'error',
        code: 'morpheme_reconstruction_failed',
        message: `morphemes [${word.morphemes.map((m) => m.text).join('+')}] do not reconstruct "${word.form}" — splitByMorphemes returns null and the word degrades to whole-word hover`,
        ...base,
        path: `${wordPath}.morphemes`,
      });
    }
  }

  // 1b. Per-script morpheme reconstruction (case-sensitive, separators stripped).
  for (const [lang, morphs] of Object.entries(word.scriptMorphemes ?? {})) {
    const surface = word.scriptAlts?.[lang];
    if (!surface || !morphs || morphs.length === 0) continue;
    const reconstructed = morphs.map((m) => m.text).join('').replace(SCRIPT_SEPARATOR_RE, '');
    if (reconstructed !== surface.replace(SCRIPT_SEPARATOR_RE, '')) {
      diagnostics.push({
        level: 'error',
        code: 'script_morpheme_reconstruction_failed',
        message: `${lang} scriptMorphemes do not reconstruct "${surface}"`,
        ...base,
        path: `${wordPath}.scriptMorphemes.${lang}`,
      });
    }
  }

  // 2 & 3. Segment-ID leaks and grammar jargon in every reader-facing string.
  checkText(diagnostics, word.gloss, { ...base, path: `${wordPath}.gloss` }, jargonAllowlist);
  checkText(diagnostics, word.etymology, { ...base, path: `${wordPath}.etymology` }, jargonAllowlist);
  for (const [i, morpheme] of (word.morphemes ?? []).entries()) {
    checkText(diagnostics, morpheme.gloss, { ...base, path: `${wordPath}.morphemes.${i}.gloss` }, jargonAllowlist);
  }
  for (const [lang, morphs] of Object.entries(word.scriptMorphemes ?? {})) {
    for (const [i, morpheme] of (morphs ?? []).entries()) {
      checkText(diagnostics, morpheme.gloss, { ...base, path: `${wordPath}.scriptMorphemes.${lang}.${i}.gloss` }, jargonAllowlist);
    }
  }
}

function checkTripleScriptSection(
  diagnostics: LiturgyDiagnostic[],
  section: TripleScriptWitnessSection,
  jargonAllowlist: readonly string[]
): void {
  for (const segment of section.segments) {
    const paliWordCount = countPaliWords(segment.pali);

    for (const word of segment.words ?? []) {
      checkWord(diagnostics, word, { sectionId: section.id, segmentId: segment.id }, jargonAllowlist);
    }

    for (const witness of segment.witnesses) {
      if (!witness.alignTo) continue;
      const base = { sectionId: section.id, segmentId: segment.id, witnessBy: witness.by };

      const englishWordCount = countEnglishWords(witness.text);
      if (witness.alignTo.length !== englishWordCount) {
        diagnostics.push({
          level: 'error',
          code: 'align_length_mismatch',
          message: `alignTo for "${witness.by}" has ${witness.alignTo.length} entries, expected ${englishWordCount} (one per English word) — every arrow downstream shifts`,
          ...base,
          path: 'witness.alignTo',
        });
      }

      witness.alignTo.forEach((value, index) => {
        if (value === -1) return;
        if (value < 0 || value >= paliWordCount) {
          diagnostics.push({
            level: 'error',
            code: 'align_index_out_of_range',
            message: `alignTo[${index}]=${value} is outside the Pāli word range [0, ${paliWordCount - 1}]`,
            ...base,
            path: `witness.alignTo.${index}`,
          });
        }
      });

      if (witness.morphemeAlignTo && witness.morphemeAlignTo.length !== witness.alignTo.length) {
        diagnostics.push({
          level: 'error',
          code: 'morpheme_align_length_mismatch',
          message: `morphemeAlignTo for "${witness.by}" has ${witness.morphemeAlignTo.length} entries but must be parallel to alignTo (${witness.alignTo.length})`,
          ...base,
          path: 'witness.morphemeAlignTo',
        });
      }
    }
  }
}

/**
 * Validate a `LiturgyDoc` against the silent-failure invariants. Returns a flat
 * list of diagnostics (empty = clean). Callers decide their own pass threshold:
 * the generator refuses to emit on any `error`; the corpus suite asserts zero
 * errors across every shipped chant.
 */
export function validateLiturgyDoc(
  doc: LiturgyDoc,
  options: ValidateLiturgyOptions = {}
): LiturgyDiagnostic[] {
  const jargonAllowlist = options.jargonAllowlist ?? [];
  const diagnostics: LiturgyDiagnostic[] = [];

  for (const section of doc.sections) {
    if (section.shape === 'triple-script-witness') {
      checkTripleScriptSection(diagnostics, section, jargonAllowlist);
    }
    if (section.shape === 'prose-commentary') {
      checkText(
        diagnostics,
        section.body,
        { sectionId: section.id, path: `sections.${section.id}.body` },
        jargonAllowlist
      );
    }
  }

  // Stamp the doc slug so corpus-wide runs can attribute each diagnostic.
  return diagnostics.map((d) => ({ docSlug: doc.slug, ...d }));
}
