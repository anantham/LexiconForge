/**
 * Gītā TIER-1 render-data builder — the deterministic half of the free,
 * dictionary-grounded word layer (the "Hybrid" plan). Chapter-parameterized so
 * the same pass scales from one chapter to all eighteen.
 *
 * PIPELINE (two stages, both mechanical — NO LLM authors any gloss or sound):
 *
 *   Stage 1  scripts/gita/fetch_padaccheda_gloss.py   (Python; run once/chapter)
 *     · fetches the mūla from sa.wikisource (public domain),
 *     · padaccheda via sanskrit_parser (rule-based sandhi split + morphological
 *       stemming — deterministic, no neural model),
 *     · glosses each lemma from Monier-Williams (Cologne getword.php), taking a
 *       short first-substantive-sense head-gloss, cached to data/gita/mw-cache.json,
 *     → data/gita/chapter<N>-glosses.json   { verses: { key: { line, tokens[] } } }
 *
 *   Stage 2  THIS FILE                                (TS; the render builder)
 *     · reads that JSON,
 *     · SOUND: romanizes each written word with the APP romanizer
 *       (components/liturgy/concept/devanagari.ts) — the per-akshara IAST IS the
 *       romanizer's output, so `romanizationMatches` holds BY CONSTRUCTION and no
 *       sound is ever guessed,
 *     · emits Tier-1 AlignSegment[] (units: [] — no unit spine, no alignment
 *       threads: those are the deferred Tier-2 curation layer, exactly like
 *       data/malayalam/urakam-tier1.ts),
 *     · VALIDATES: surface law (tokens rejoin the source line; each token's
 *       aksharas rejoin the token), romanization gate, and a gloss-coverage
 *       report,
 *     → data/gita/chapter<N>-tier1.ts   `export const GITA_CHAPTER<N>_TIER1`.
 *
 * The four per-word layers: SURFACE (written Devanāgarī, whitespace-tokenized —
 * sandhi-fused words stay one written token, per the SUTTA-025 surface law),
 * SOUND (per-akshara IAST, deterministic), MEANING (MW head-gloss of the
 * padaccheda lemma(s), composed with " + " for a fused word — empty when MW has
 * no clean entry, never guessed), and ALIGNMENT THREADS (skipped in Tier-1).
 *
 * Run:  npx tsx scripts/gita/build-tier1.ts 2
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { aksharasOf, romanizationMatches, segmentAksharas } from '../../components/liturgy/concept/devanagari';
import type { AlignSegment, AlignToken, AlignSegmentPiece } from '../../types/liturgyAlign';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const chapter = Number(process.argv[2] ?? '2');
const GLOSSES = path.join(ROOT, `data/gita/chapter${chapter}-glosses.json`);
const OUT = path.join(ROOT, `data/gita/chapter${chapter}-tier1.ts`);

type SrcPiece = { slp: string; stem: string | null; gloss: string };
type SrcToken = { surface: string; isMarker: boolean; gloss: string; lemmas: string[]; pieces: SrcPiece[] };
type SrcVerse = { line: string; tokens: SrcToken[] };
type SrcFile = { meta: Record<string, string>; verses: Record<string, SrcVerse> };

const DEVA_DIG: Record<string, string> = { '०':'0','१':'1','२':'2','३':'3','४':'4','५':'5','६':'6','७':'7','८':'8','९':'9' };
const arabicOf = (s: string) => s.replace(/[०-९]/g, (d) => DEVA_DIG[d] ?? d);

/** Order keys as the source prints them: speaker line, then half a, then half b. */
const HALF_RANK: Record<string, number> = { s: 0, a: 1, b: 2 };
const keyRank = (k: string): [number, number] => [Number(k.replace(/[a-z]$/, '')), HALF_RANK[k.slice(-1)] ?? 9];

const isDanda = (t: string) => t === '।';
// The verse marker "॥२- NN॥" carries an internal space, so it whitespace-splits
// into "॥२-" and "NN॥" — both are markers (a real word never contains ॥).
const isVerseMark = (t: string) => t.includes('॥');

/** Marker hover gloss (markers are sounded by no akshara — faint, glossed). */
function markerGloss(t: string, verseNum: number): string {
  if (isDanda(t)) return 'daṇḍa — the line pauses';
  const m = t.match(/([०-९]+)\s*॥\s*$/);
  return `verse ${chapter}.${m ? arabicOf(m[1]) : verseNum} ends`;
}

const diagnostics: string[] = [];
let words = 0;
let glossed = 0;
let compounds = 0;

function wordToken(tk: SrcToken, seg: string): AlignToken {
  words++;
  const deva = tk.surface;

  // SOUND — deterministic, self-consistent by construction.
  const ak = aksharasOf(deva);
  const rom = ak.map((a) => a.rom).join('');
  const segments: AlignSegmentPiece[] = ak.map((a) => ({ text: a.text, pronunciation: a.rom, akshara: true }));

  // Surface-law guard: aksharas must rejoin the exact written word.
  const rejoined = segmentAksharas(deva).join('');
  if (rejoined !== deva) diagnostics.push(`${seg}: aksharas of "${deva}" rejoin to "${rejoined}"`);
  // Romanization gate (trivially true when rom is the romanizer's own output;
  // asserted so a future non-mechanical edit can't slip a guessed sound past).
  if (!romanizationMatches(deva, rom)) diagnostics.push(`${seg}: "${deva}" ⇏ romanized "${rom}"`);
  // A word whose romanization dropped characters (unknown glyph) — flag it.
  if (!rom) diagnostics.push(`${seg}: "${deva}" romanized to empty`);

  const token: AlignToken = { text: deva, units: [], pronunciation: rom, segments };
  if (tk.gloss) {
    token.gloss = tk.gloss;
    glossed++;
  }
  // Teach the sandhi cut honestly in a note (the surface stays one written
  // word). Only when the padaccheda actually split the word into >1 lemma.
  const realPieces = tk.pieces.filter((p) => p.stem);
  if (realPieces.length > 1) {
    compounds++;
    token.note = 'padaccheda: ' + realPieces.map((p) => (p.gloss ? `${p.stem} (${p.gloss})` : p.stem)).join(' + ');
  }
  return token;
}

function markerToken(tk: SrcToken, verseNum: number): AlignToken {
  return {
    text: tk.surface,
    units: [],
    gloss: markerGloss(tk.surface, verseNum),
    segments: [{ text: tk.surface, faint: true }],
  };
}

function build(): AlignSegment[] {
  const data = JSON.parse(fs.readFileSync(GLOSSES, 'utf8')) as SrcFile;
  const keys = Object.keys(data.verses).sort((a, b) => {
    const [ra, rb] = [keyRank(a), keyRank(b)];
    return ra[0] - rb[0] || ra[1] - rb[1];
  });
  const segs: AlignSegment[] = [];
  for (const key of keys) {
    const verse = data.verses[key];
    const verseNum = Number(key.replace(/[a-z]$/, ''));
    const id = `bg${chapter}t1-${key}`;
    const tokens: AlignToken[] = verse.tokens.map((tk) =>
      tk.isMarker || isDanda(tk.surface) || isVerseMark(tk.surface)
        ? markerToken(tk, verseNum)
        : wordToken(tk, id),
    );

    // SURFACE LAW: the tokens must rejoin the exact fetched source line.
    const rejoined = tokens.map((t) => t.text).join(' ');
    if (rejoined !== verse.line) {
      diagnostics.push(`${id}: tokens rejoin to\n    "${rejoined}"\n  ≠ source\n    "${verse.line}"`);
    }
    segs.push({ id, units: [], renderings: [{ lang: 'sa-Deva', label: 'Sanskrit', tokens }] });
  }
  return segs;
}

const segs = build();

// ── report ────────────────────────────────────────────────────────────────
const cov = words ? ((100 * glossed) / words).toFixed(1) : '0';
console.log(`\nChapter ${chapter} Tier-1 build`);
console.log(`  segments (half-verses + speaker lines): ${segs.length}`);
console.log(`  words: ${words}   with MW gloss: ${glossed} (${cov}%)   sandhi-compounds: ${compounds}`);
console.log(`  surface/romanization diagnostics: ${diagnostics.length}`);
for (const d of diagnostics.slice(0, 40)) console.log('    ! ' + d);
if (diagnostics.length) {
  console.error(`\nBUILD FAILED — ${diagnostics.length} integrity diagnostics (surface law / romanization).`);
  process.exit(1);
}

const CONST = `GITA_CHAPTER${chapter}_TIER1`;
const header =
  `/**\n` +
  ` * GENERATED — do not edit. Rebuild:\n` +
  ` *   python scripts/gita/fetch_padaccheda_gloss.py ${chapter}   # padaccheda + MW glosses\n` +
  ` *   npx tsx scripts/gita/build-tier1.ts ${chapter}             # romanize + AlignSegment[]\n` +
  ` *\n` +
  ` * Bhagavad Gītā chapter ${chapter}, TIER-1 (free, dictionary-grounded word layer):\n` +
  ` * written Devanāgarī + per-akshara IAST (deterministic romanizer) + Monier-\n` +
  ` * Williams head-glosses on hover. units: [] — NO alignment threads (the Tier-2\n` +
  ` * curation layer is deferred). Mūla: sa.wikisource (PD). Glosses: MW (PD).\n` +
  ` */\n` +
  `import type { AlignSegment } from '../../types/liturgyAlign';\n\n`;

fs.writeFileSync(OUT, header + `export const ${CONST}: AlignSegment[] = ${JSON.stringify(segs, null, 1)};\n`);
console.log(`\nwrote ${path.relative(ROOT, OUT)}`);
