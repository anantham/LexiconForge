/**
 * Accent / alignment audit. Catches two failure modes:
 *
 * 1. **Pāli-side accent doesn't match concept**: a Pāli word whose form
 *    or gloss identifies it as Buddha / Dharma / Sangha but whose `accent`
 *    is set to a color other than the convention (amber / sky / rose
 *    respectively). The settings-panel legend documents the convention;
 *    this test enforces it.
 *
 * 2. **English-token alignTo lands on the wrong word**: a Pāli word
 *    accented amber/sky/rose, and the English token at its alignTo
 *    position is "the" / "to" / "of" / etc. — i.e. off-by-one
 *    propagating the wrong color onto a stop-word rather than the
 *    intended target.
 *
 * For (2) we use a "phrase-mapping is OK" heuristic: when multiple
 * English tokens share the same paliIdx group (the curator mapped a
 * whole phrase to one Pāli word), the test passes if AT LEAST ONE token
 * in the group is a recognizable concept word. So "the Way of the
 * Awakened" → Butsudō is fine (Awakened matches), but "the" alone →
 * Butsudō is flagged.
 */
import { describe, it, expect } from 'vitest';
import { LITURGY_DOCS_BY_SANGHA } from '../../../data/liturgy';
import type { LiturgyDoc, TripleScriptWitnessSection } from '../../../types/liturgy';

function tokenizePali(text: string): string[] {
  const re = /[A-Za-zĀāĪīŪūṚṛṂṃṄṅÑñṬṭḌḍṆṇŚśṢṣḤḥṁÀ-ɏ]+/g;
  return text.match(re) || [];
}
function tokenizeEnglish(text: string): string[] {
  return text.split(/\s+/).filter((s) => s.length > 0);
}
function strip(w: string): string {
  return w.toLowerCase().replace(/[.,;:!?'"()—–\-]/g, '');
}

const CONCEPTS = [
  {
    matchPali: (form: string, gloss: string) =>
      /^budd?h/i.test(form) || /^butsu/i.test(form) || /awakened/i.test(gloss),
    expected: new Set(['buddha', 'buddhas', 'tathagata', 'tathāgata', 'awakened', "awaken'd", 'enlightened']),
    color: 'amber',
    concept: 'Buddha',
  },
  {
    matchPali: (form: string, gloss: string) =>
      /^dhamm/i.test(form) || /^dharm/i.test(form) ||
      (/dharma/i.test(gloss) && !/wisdom|practice|view|element/i.test(gloss)),
    expected: new Set(['dharma', 'dhamma', 'teaching', 'teachings', 'law', 'doctrine']),
    color: 'sky',
    concept: 'Dharma',
  },
  {
    matchPali: (form: string, gloss: string) =>
      /^saṅgh/i.test(form) || /^sangh/i.test(form) || /^so$/i.test(form),
    expected: new Set(['sangha', 'saṅgha', 'community']),
    color: 'rose',
    concept: 'Sangha',
  },
];

function classify(form: string, gloss: string) {
  return CONCEPTS.find((c) => c.matchPali(form, gloss));
}

const ALL_DOCS: LiturgyDoc[] = Object.values(LITURGY_DOCS_BY_SANGHA).flatMap((m) => Object.values(m));

describe('accent / alignment audit', () => {
  for (const doc of ALL_DOCS) {
    const tswSections = doc.sections.filter(
      (s): s is TripleScriptWitnessSection => s.shape === 'triple-script-witness'
    );
    if (tswSections.length === 0) continue;

    // Pre-collect all checks so we can skip the whole describe if none.
    type Check =
      | { kind: 'paliAccent'; segId: string; form: string; concept: string; color: string; actual: string | undefined }
      | { kind: 'enAlignTo'; segId: string; witnessBy: string; paliForm: string; concept: string; color: string; enToks: string[]; expected: Set<string> };
    const checks: Check[] = [];
    for (const section of tswSections) {
      for (const segment of section.segments) {
        if (!segment.words) continue;
        const wordIdx = new Map(segment.words.map((w) => [w.form, w]));
        const paliTokens = tokenizePali(segment.pali);

        paliTokens.forEach((tok, _paliIdx) => {
          const w = wordIdx.get(tok);
          if (!w || !w.accent) return;
          const c = classify(w.form, w.gloss || '');
          if (!c) return;
          checks.push({
            kind: 'paliAccent',
            segId: segment.id,
            form: w.form,
            concept: c.concept,
            color: c.color,
            actual: w.accent,
          });
        });

        for (const witness of segment.witnesses || []) {
          if (!witness.alignTo) continue;
          const enTokens = tokenizeEnglish(witness.text);
          const groups = new Map<number, string[]>();
          witness.alignTo.forEach((paliIdx, i) => {
            if (paliIdx < 0) return;
            const tok = enTokens[i];
            if (!tok) return;
            if (!groups.has(paliIdx)) groups.set(paliIdx, []);
            groups.get(paliIdx)!.push(tok);
          });
          for (const [paliIdx, enToks] of groups) {
            const paliForm = paliTokens[paliIdx];
            if (!paliForm) continue;
            const w = wordIdx.get(paliForm);
            if (!w || !w.accent) continue;
            const c = classify(w.form, w.gloss || '');
            if (!c) continue;
            checks.push({
              kind: 'enAlignTo',
              segId: segment.id,
              witnessBy: witness.by,
              paliForm,
              concept: c.concept,
              color: c.color,
              enToks,
              expected: c.expected,
            });
          }
        }
      }
    }

    if (checks.length === 0) {
      describe(`${doc.sangha}/${doc.slug}`, () => {
        it.skip('no tracked-concept accented words (skipped)', () => undefined);
      });
      continue;
    }

    describe(`${doc.sangha}/${doc.slug}`, () => {
      for (const check of checks) {
        if (check.kind === 'paliAccent') {
          it(`${check.segId} · ${check.form}: ${check.concept} accent matches convention`, () => {
            expect(
              check.actual,
              `Expected ${check.concept}=${check.color}, got ${check.actual}`
            ).toBe(check.color);
          });
        } else {
          const stripped = check.enToks.map(strip);
          const hasMatch = stripped.some((t) => check.expected.has(t));
          it(`${check.segId} · ${check.witnessBy}: alignTo group for ${check.paliForm} (${check.concept}) contains a recognizable English match`, () => {
            expect(
              hasMatch,
              `Pāli ${check.paliForm} (${check.concept}, ${check.color}) maps to English tokens [${check.enToks.join(', ')}], none of which match {${[...check.expected].join('/')}}`
            ).toBe(true);
          });
        }
      }
    });
  }
});
