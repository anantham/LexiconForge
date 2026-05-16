/**
 * Liturgy alignment audit.
 *
 * For every `triple-script-witness` segment, each witness carries an optional
 * `alignTo: number[]` whose length MUST equal the witness's English-word count
 * (whitespace-split, non-empty). One off-by-one shifts every arrow downstream
 * of the discrepancy and produces silently-wrong alignment in the reader.
 *
 * The same `alignTo[i]` must be either `-1` (English token with no Pāli
 * source — articles, conjunctions, supplied English) or a valid index into
 * the segment's Pāli surface-word count.
 */

import { describe, it, expect } from 'vitest';
import { LITURGY_DOCS } from '../../../data/liturgy';
import type {
  LiturgyDoc,
  TripleScriptWitnessSection,
} from '../../../types/liturgy';

// Mirror of the renderer's Pāli tokenizer (Roman). Word class is Latin +
// IAST diacritics; everything else is gap. Keep in sync with
// components/liturgy/shapes/TripleScriptWitness.tsx#tokenize.
function countPaliWords(text: string): number {
  const re = /[A-Za-zĀāĪīŪūṚṛṂṃṄṅÑñṬṭḌḍṆṇŚśṢṣḤḥṁÀ-ɏ]+/g;
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

// Mirror of EnglishLine: whitespace split, non-empty tokens count as words.
function countEnglishWords(text: string): number {
  return text.split(/\s+/).filter((s) => s.length > 0).length;
}

function tripleScriptSections(
  doc: LiturgyDoc
): TripleScriptWitnessSection[] {
  return doc.sections.filter(
    (s): s is TripleScriptWitnessSection => s.shape === 'triple-script-witness'
  );
}

// Audit every registered LiturgyDoc — adding a new chant to the index
// automatically gets it covered.
for (const doc of Object.values(LITURGY_DOCS)) {
  describe(`alignment audit: ${doc.slug}`, () => {
    const sections = tripleScriptSections(doc);

    if (sections.length === 0) {
      it.skip('no triple-script-witness sections (skipped)', () => undefined);
      return;
    }

    for (const section of sections) {
      describe(`section: ${section.id}`, () => {
        for (const segment of section.segments) {
          const paliWordCount = countPaliWords(segment.pali);

          for (const witness of segment.witnesses) {
            const label = `${segment.id} · ${witness.by}`;

            if (witness.alignTo === undefined) {
              it.skip(`${label}: no alignTo (skipped)`, () => undefined);
              continue;
            }

            it(`${label}: alignTo length === English word count`, () => {
              const enCount = countEnglishWords(witness.text);
              expect(witness.alignTo!.length).toBe(enCount);
            });

            it(`${label}: every alignTo entry is -1 or a valid Pāli index`, () => {
              for (let i = 0; i < witness.alignTo!.length; i++) {
                const v = witness.alignTo![i];
                if (v === -1) continue;
                expect(
                  v,
                  `alignTo[${i}]=${v} out of range [0, ${paliWordCount - 1}]`
                ).toBeGreaterThanOrEqual(0);
                expect(
                  v,
                  `alignTo[${i}]=${v} out of range [0, ${paliWordCount - 1}]`
                ).toBeLessThan(paliWordCount);
              }
            });
          }
        }
      });
    }
  });
}
