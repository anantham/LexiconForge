/**
 * Audit script: catches accent/alignment bugs across triple-script-witness
 * segments.
 *
 * Per segment:
 *   1. Tokenize segment.pali into surface positions (paliIdx 0, 1, 2, …)
 *   2. For each surface token, look up its WordGloss (by exact match on `.form`).
 *      If the WordGloss has `.accent`, record (paliIdx, accent, glossText).
 *   3. For each witness, walk alignTo. Each English-token-index whose alignTo
 *      value points at an accented paliIdx will be colored that accent.
 *   4. Check whether the colored English token looks like a semantically-
 *      compatible match for the Pāli word: if the Pāli word's gloss matches
 *      a known concept (Buddha / Dharma / Sangha), the English token should
 *      contain a recognizable form of the same word.
 *
 * Reports only the likely-real bugs (semantic mismatches), not every accent
 * propagation.
 */
import { LITURGY_DOCS_BY_SANGHA as liturgyDocs } from '../data/liturgy/index.ts';

// Pāli surface tokenizer (matches the renderer's tokenizer).
function tokenizePali(text) {
  const re = /[A-Za-zĀāĪīŪūṚṛṂṃṄṅÑñṬṭḌḍṆṇŚśṢṣḤḥṁÀ-ɏ]+/g;
  return text.match(re) || [];
}

function tokenizeEnglish(text) {
  return text.split(/\s+/).filter((s) => s.length > 0);
}

function stripWord(w) {
  return w.toLowerCase().replace(/[.,;:!?'"()—–\-]/g, '');
}

// Concept categories we care about. paliMatch is run against the Pāli
// surface form (or its scriptAlt) AND the gloss text — if either matches,
// the audit expects the corresponding English token to look like one of
// expectedEnglish.
const CONCEPTS = [
  {
    matchPali: (form, gloss) =>
      /^budd?h/i.test(form) || /^butsu/i.test(form) || /awakened/i.test(gloss),
    expectedEnglish: new Set(['buddha', 'buddhas', 'tathagata', 'tathāgata', 'awakened', "awaken'd", 'enlightened']),
    color: 'amber',
    concept: 'Buddha',
  },
  {
    matchPali: (form, gloss) =>
      /^dhamm/i.test(form) || /^dharm/i.test(form) || (/dharma/i.test(gloss) && !/wisdom|practice|view|element/i.test(gloss)),
    expectedEnglish: new Set(['dharma', 'dhamma', 'teaching', 'teachings', 'law', 'doctrine']),
    color: 'sky',
    concept: 'Dharma',
  },
  {
    matchPali: (form, gloss) =>
      /^saṅgh/i.test(form) || /^sangh/i.test(form) || /^so$/i.test(form),
    expectedEnglish: new Set(['sangha', 'saṅgha', 'community']),
    color: 'rose',
    concept: 'Sangha',
  },
];

function classify(form, gloss) {
  return CONCEPTS.find((c) => c.matchPali(form, gloss || '')) || null;
}

const issues = [];

for (const [sanghaSlug, docsForSangha] of Object.entries(liturgyDocs)) {
  for (const doc of Object.values(docsForSangha)) {
    const tswSections = doc.sections.filter((s) => s.shape === 'triple-script-witness');
    for (const section of tswSections) {
      for (const segment of section.segments) {
        if (!segment.words || !segment.witnesses) continue;
        // Build word index keyed by surface form (case-sensitive).
        const wordIdx = new Map();
        for (const w of segment.words) wordIdx.set(w.form, w);
        // Tokenize pali into surface positions.
        const paliTokens = tokenizePali(segment.pali);
        // For each surface position, find the WordGloss + accent + concept.
        const surfaceAccent = []; // [{ paliIdx, accent, concept, form, expectedEnglish }]
        paliTokens.forEach((tok, paliIdx) => {
          const w = wordIdx.get(tok);
          if (!w || !w.accent) return;
          const concept = classify(w.form, w.gloss);
          if (!concept) return;
          if (concept.color !== w.accent) {
            issues.push({
              kind: 'paliAccentMismatch',
              doc: `${sanghaSlug}/${doc.slug}`,
              segment: segment.id,
              paliWord: w.form,
              concept: concept.concept,
              hasAccent: w.accent,
              expectedAccent: concept.color,
            });
          }
          surfaceAccent.push({ paliIdx, ...concept, form: w.form });
        });
        // For each accented surface position, check each witness's alignTo.
        for (const acc of surfaceAccent) {
          for (const witness of segment.witnesses) {
            if (!witness.alignTo) continue;
            const enTokens = tokenizeEnglish(witness.text);
            for (let i = 0; i < witness.alignTo.length; i++) {
              if (witness.alignTo[i] !== acc.paliIdx) continue;
              const raw = enTokens[i] || '';
              const enTok = stripWord(raw);
              if (!enTok) continue;
              if (!acc.expectedEnglish.has(enTok)) {
                issues.push({
                  kind: 'englishMismatch',
                  doc: `${sanghaSlug}/${doc.slug}`,
                  segment: segment.id,
                  witness: witness.by,
                  paliForm: acc.form,
                  concept: acc.concept,
                  color: acc.color,
                  enRaw: raw,
                  enIdx: i,
                  expectedSet: Array.from(acc.expectedEnglish).join('/'),
                });
              }
            }
          }
        }
      }
    }
  }
}

const englishMismatches = issues.filter((i) => i.kind === 'englishMismatch');
const accentMismatches = issues.filter((i) => i.kind === 'paliAccentMismatch');

console.log(`Found ${englishMismatches.length} English-token mismatches (colored word doesn't match concept):\n`);
for (const iss of englishMismatches) {
  console.log(
    `  [${iss.doc} · ${iss.segment} · ${iss.witness}]\n` +
    `    Pāli "${iss.paliForm}" (${iss.concept}, ${iss.color}) → English "${iss.enRaw}" at idx ${iss.enIdx}\n` +
    `    Expected English to be one of: ${iss.expectedSet}\n`
  );
}

if (accentMismatches.length > 0) {
  console.log(`\nFound ${accentMismatches.length} Pāli-side color/concept mismatches:`);
  for (const iss of accentMismatches) {
    console.log(`  ${iss.doc} · ${iss.segment} · ${iss.paliWord}: ${iss.concept} should be ${iss.expectedAccent}, has ${iss.hasAccent}`);
  }
}
