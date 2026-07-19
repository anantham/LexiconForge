/**
 * Tier-1 legend builder — Aithihyamala ഊരകത്ത് അമ്മതിരുവടി (PD, 1909).
 *
 * Turns the raw Wikisource text into renderable AlignSegments:
 *   sentence-per-segment · word tokens · DETERMINISTIC romanization
 *   (romanizeWord) · English draft witness merged from a translations file.
 *
 * Two modes:
 *   npx tsx scripts/malayalam/build-legend.ts --list
 *     → data/malayalam/urakam-sentences.json  [{id, ml}] for the translator
 *   npx tsx scripts/malayalam/build-legend.ts --build
 *     → data/malayalam/urakam-tier1.json      AlignSegment[] for the page
 *
 * Tier-1 segments carry NO unit spine (units: []) — alignment threads and
 * morpheme pieces arrive with Tier-2 curation. Etym mode (clusters, exploded
 * symbols, sound slices) works in full from the deterministic layer alone.
 * The first sentence (p01s01) is skipped — it exists hand-curated.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { romanizeWord } from '../../services/malayalam/graphemes';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RAW = path.join(ROOT, 'data/malayalam/urakam-raw.txt');
const SENTENCES = path.join(ROOT, 'data/malayalam/urakam-sentences.json');
const ENGLISH = path.join(ROOT, 'data/malayalam/urakam-english.json');
const ALIGNMENT = path.join(ROOT, 'data/malayalam/urakam-alignment.json');
const OUT = path.join(ROOT, 'data/malayalam/urakam-tier1.ts');

/**
 * Optional per-sentence alignment (Tier-1.5): a unit spine + per-word unit
 * bindings + English phrase chunks. Authored in batches (LLM-drafted,
 * review-gated) — sentences without an entry stay flat. Shape:
 *   { "p01s02": { units: [{id, gloss}], ml: string[][],  // per WORD, in order
 *                 en: [text, unitIds[]][] } }
 */
type SentenceAlignment = {
  units: { id: string; gloss: string }[];
  ml: string[][];
  en: [string, string[]][];
};
const SKIP = new Set([
  'p01s01', // hand-curated in urakam-ammathiruvadi.ts
  'p31s01', // wiki category line (വർഗ്ഗം:ഐതിഹ്യമാല), not text
]);

type Sentence = { id: string; ml: string };

function sentences(): Sentence[] {
  const raw = fs.readFileSync(RAW, 'utf8');
  // ':{2,}' = wikitext verse-indent markers that survive the scrape.
  const paras = raw.split(/\n{2,}/).map((p) => p.replace(/:{2,}/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const out: Sentence[] = [];
  paras.forEach((p, pi) => {
    const sents = p.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
    sents.forEach((s, si) => {
      out.push({ id: `p${String(pi + 1).padStart(2, '0')}s${String(si + 1).padStart(2, '0')}`, ml: s });
    });
  });
  return out;
}

const stripPunct = (w: string) => w.replace(/^[^ഀ-ൿ]+|[^ഀ-ൿ]+$/g, '');

function buildSegment(s: Sentence, en: string | undefined, align: SentenceAlignment | undefined) {
  const words = s.ml.split(/\s+/).filter(Boolean);
  if (align && align.ml.length !== words.length) {
    console.error(`✗ ${s.id}: alignment has ${align.ml.length} word bindings, sentence has ${words.length} words`);
    process.exit(1);
  }
  return {
    id: `urk-${s.id}`,
    gloss: en ?? '',
    units: align ? align.units : [],
    renderings: [
      {
        lang: 'ml-Mlym',
        label: 'Malayalam',
        tokens: words.map((w, i) => {
          const core = stripPunct(w);
          return {
            text: w,
            units: align ? align.ml[i] : ([] as string[]),
            ...(core ? { pronunciation: romanizeWord(core) } : {}),
          };
        }),
      },
      ...(en
        ? [
            {
              lang: 'en',
              label: 'English (Opus draft)',
              by: 'opus-draft',
              tokens: align
                ? align.en.map(([text, units]) => ({ text, units }))
                : [{ text: en, units: [] as string[], relation: 'interpretive' as const }],
            },
          ]
        : []),
    ],
  };
}

const mode = process.argv[2];
const all = sentences();

if (mode === '--list') {
  fs.writeFileSync(SENTENCES, JSON.stringify(all, null, 1));
  console.log(`${all.length} sentences → ${path.relative(ROOT, SENTENCES)}`);
} else if (mode === '--build') {
  const en: Record<string, string> = JSON.parse(fs.readFileSync(ENGLISH, 'utf8'));
  const alignment: Record<string, SentenceAlignment> = fs.existsSync(ALIGNMENT)
    ? JSON.parse(fs.readFileSync(ALIGNMENT, 'utf8'))
    : {};
  const missing = all.filter((s) => !SKIP.has(s.id) && !en[s.id]);
  if (missing.length) {
    console.error(`✗ ${missing.length} sentences missing translations: ${missing.slice(0, 5).map((m) => m.id).join(', ')}…`);
    process.exit(1);
  }
  const segs = all.filter((s) => !SKIP.has(s.id)).map((s) => buildSegment(s, en[s.id], alignment[s.id]));
  const aligned = Object.keys(alignment).length;
  console.log(`${aligned} sentences aligned (unit spines); ${segs.length - aligned} flat`);
  const body =
    '/**\n' +
    ' * GENERATED — do not edit. Rebuild: npx tsx scripts/malayalam/build-legend.ts --build\n' +
    ' * Tier-1 segments for Aithihyamala ch. 64 (PD 1909): deterministic\n' +
    ' * romanization + Opus-draft English witness. See build-legend.ts header.\n' +
    ' */\n' +
    "import type { AlignSegment } from '../../types/liturgyAlign';\n\n" +
    `export const URAKAM_TIER1: AlignSegment[] = ${JSON.stringify(segs, null, 1)};\n\n` +
    'export default URAKAM_TIER1;\n';
  fs.writeFileSync(OUT, body);
  console.log(`${segs.length} segments → ${path.relative(ROOT, OUT)}`);
} else {
  console.error('usage: build-legend.ts --list | --build');
  process.exit(1);
}
