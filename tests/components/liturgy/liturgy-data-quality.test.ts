/**
 * Liturgy data-quality audit — catches two *silent* failure classes that
 * neither crash nor fail a render, they just quietly degrade the reader.
 *
 * 1. Morpheme reconstruction.
 *    A word's `morphemes[]` (and per-script `scriptMorphemes[]`) must
 *    concatenate back to the surface form. The renderer's `splitByMorphemes`
 *    walks the surface slicing one morpheme at a time; if the pieces don't
 *    reconstruct it returns `null` and the word silently falls back to a
 *    single whole-word hover — the per-morpheme tooltips/arrows just vanish
 *    with no error. Pāli/Sanskrit sandhi at the morpheme join (two vowels
 *    merging, a vowel shortening, i→y before a vowel) is the usual cause.
 *
 * 2. Segment-ID leaks.
 *    Cross-reference glosses sometimes use the curator's internal segment-ID
 *    shorthand ("same word as v7d") — meaningless to a reader. Reader-facing
 *    text must never contain a `v<number><letter>` token; say "verse N".
 */

import { describe, it, expect } from 'vitest';
import { LITURGY_DOCS_BY_SANGHA } from '../../../data/liturgy';
import type { LiturgyDoc, TripleScriptWitnessSection } from '../../../types/liturgy';

const ALL_DOCS: LiturgyDoc[] = Object.values(LITURGY_DOCS_BY_SANGHA).flatMap(
  (docsForSangha) => Object.values(docsForSangha)
);

function tripleScriptSections(doc: LiturgyDoc): TripleScriptWitnessSection[] {
  return doc.sections.filter(
    (s): s is TripleScriptWitnessSection => s.shape === 'triple-script-witness'
  );
}

// The curator's internal segment-ID shorthand: v + digits + a trailing
// letter (v1a, v7d, v10c). Near-zero false-positive risk in real prose.
const SEGMENT_ID_SHORTHAND = /\bv\d+[a-z]\b/;

// Grammar jargon that CURATION_PROTOCOL.md §3.4 flags as failure-tone in
// the plain-prose register. A glossed word should *show* the grammatical
// idea ("the object of 'I go to'", "the 'X-ed' form") rather than name it
// with a term a no-Pāli-training reader has to already know.
//
// This is a tripwire, not an absolute ban: the protocol's pay-rent rule
// does allow a technical term IF it does work plain English can't AND is
// glossed in the same sentence. If a future gloss legitimately earns one,
// add it to an explicit allowlist here with the rationale — don't just
// delete the test. Today every liturgy gloss is plain, so the list is bare.
const JARGON = /\b(gerundive|accusative|nominative|genitive|locative|ablative|optative|vocative|declension|declensional|instrumental case|past participle|present participle)\b/i;
const JARGON_ALLOWLIST: string[] = [];

for (const doc of ALL_DOCS) {
  const sections = tripleScriptSections(doc);
  if (sections.length === 0) continue;

  describe(`liturgy data quality: ${doc.sangha}/${doc.slug}`, () => {
    for (const section of sections) {
      for (const segment of section.segments) {
        for (const word of segment.words ?? []) {
          // ── 1. Morpheme reconstruction ──────────────────────────────
          if (word.morphemes && word.morphemes.length > 0) {
            it(`${segment.id} · ${word.form}: morphemes reconstruct the surface form`, () => {
              const concat = word.morphemes!.map((m) => m.text).join('');
              expect(
                concat.toLowerCase(),
                `morphemes [${word.morphemes!.map((m) => m.text).join('+')}] ` +
                  `do not reconstruct "${word.form}" — splitByMorphemes will ` +
                  `return null and the word degrades to whole-word hover`
              ).toBe(word.form.toLowerCase());
            });
          }

          // Per-script morphemes must reconstruct that script's surface.
          // A multi-token script word (e.g. `賀多舍 娑曩喃`) carries
          // token separators — ASCII space, Tibetan tsek `་` — that are
          // not morpheme content; the renderer splits per-token, so the
          // morphemes reconstruct the separator-free string. Strip those
          // before comparing.
          const stripSep = (s: string) => s.replace(/[\s་]/g, '');
          for (const [lang, morphs] of Object.entries(word.scriptMorphemes ?? {})) {
            const surface = word.scriptAlts?.[lang];
            if (!surface || !morphs || morphs.length === 0) continue;
            it(`${segment.id} · ${word.form} [${lang}]: scriptMorphemes reconstruct the script surface`, () => {
              const concat = stripSep(morphs.map((m) => m.text).join(''));
              expect(
                concat,
                `${lang} scriptMorphemes do not reconstruct "${surface}"`
              ).toBe(stripSep(surface));
            });
          }

          // ── 2. Segment-ID leaks in word-level reader text ───────────
          const wordText = [word.gloss, word.etymology].filter(Boolean) as string[];
          for (const morph of word.morphemes ?? []) {
            if (morph.gloss) wordText.push(morph.gloss);
          }
          for (const morphs of Object.values(word.scriptMorphemes ?? {})) {
            for (const m of morphs ?? []) {
              if (m.gloss) wordText.push(m.gloss);
            }
          }
          for (const text of wordText) {
            it(`${segment.id} · ${word.form}: gloss text carries no internal segment ID`, () => {
              expect(
                SEGMENT_ID_SHORTHAND.test(text),
                `reader-facing text contains a segment-ID shorthand — ` +
                  `use "verse N" instead: "${text}"`
              ).toBe(false);
            });

            // ── 3. Grammar jargon in plain-register gloss text ────────
            it(`${segment.id} · ${word.form}: gloss text stays in plain register`, () => {
              const match = text.match(JARGON);
              const flagged =
                match !== null && !JARGON_ALLOWLIST.includes(match[0].toLowerCase());
              expect(
                flagged,
                `reader-facing text uses grammar jargon "${match?.[0]}" — ` +
                  `show the idea in plain English (CURATION_PROTOCOL §3.4), ` +
                  `or allowlist it with a pay-rent rationale: "${text}"`
              ).toBe(false);
            });
          }
        }
      }
    }
  });
}
