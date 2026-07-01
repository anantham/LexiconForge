/**
 * verify-golden.ts — ground the MN10 golden against the authoritative DPD.
 *
 * The 51-phase MN10 golden (test-fixtures/sutta-studio-*-golden.json) was
 * generated from demoPacket.ts. It is broad but UNVERIFIED — and scoring
 * models against an unverified reference at scale just amplifies whatever
 * errors the reference happens to contain (Goodhart). Before we grow board
 * coverage from 2 → 51 phases, we verify the golden against DPD (the Digital
 * Pāli Dictionary), which ships locally at data/dpd/mn10 with authoritative
 * roots, grammar, construction, and senses per lemma.
 *
 * What this checks, per golden word (all phases):
 *   1. COVERAGE     — does the surface resolve to a DPD headword at all?
 *   2. ROOT         — every √root the golden asserts in its tooltips must be
 *                     attested by DPD for that word. A golden √root DPD does
 *                     not list is a probable folk-etymology (the money check —
 *                     e.g. golden says bhikkhu ← √bhaj; DPD says √bhikkh only).
 *   3. POS          — golden wordClass (content/function) vs DPD part-of-speech.
 *   4. SENSE        — token overlap between golden senses and DPD senses. Low
 *                     overlap is a SOFT flag (senses legitimately enrich), not
 *                     an error — surfaced for human review, never auto-failed.
 *
 * Output:
 *   - reports/sutta-studio/golden-verification.md   (human-readable, by severity)
 *   - reports/sutta-studio/golden-verification.json  (machine-readable deltas)
 *
 * Run: npx tsx scripts/sutta-studio/verify-golden.ts
 * No API key required — DPD is local.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDpdSubsetFromFs } from '../../services/providers/dpd-loader-fs';
import type { DpdData, DpdHeadwords, DpdForms } from '../../services/providers/dpd';
import type { LexiconEntry } from '../../services/providers/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
const p = (rel: string) => path.join(REPO, rel);

// ── golden fixtures ──────────────────────────────────────────────────────────
type Seg = { id: string; wordId: string; text: string; tooltips?: string[] };
type Word = { id: string; surface: string; wordClass?: string; segmentIds?: string[] };
type AnatPhase = { words: Word[]; segments: Seg[] };
type LexSense = { wordId: string; wordClass?: string; senses: { english: string; nuance?: string }[] };
type LexPhase = { senses: LexSense[] };

const readJson = <T,>(rel: string): T => JSON.parse(fs.readFileSync(p(rel), 'utf8')) as T;

const anatGolden = readJson<{ anatomist: Record<string, AnatPhase> }>(
  'test-fixtures/sutta-studio-anatomist-golden.json',
).anatomist;
const lexGolden = readJson<{ lexicographer: Record<string, LexPhase> }>(
  'test-fixtures/sutta-studio-lexicographer-golden.json',
).lexicographer;

const dpd: DpdData = loadDpdSubsetFromFs('mn10');
const HW: DpdHeadwords = dpd.headwords;
const FORMS: DpdForms = dpd.forms ?? {};

// ── helpers ──────────────────────────────────────────────────────────────────
const norm = (s: string) => s.trim().toLowerCase().normalize('NFC');

/** Resolve a surface → DPD entries (direct headword, else forms→lemma). */
function dpdLookup(surface: string): LexiconEntry[] {
  const q = norm(surface);
  if (!q) return [];
  if (HW[q]?.length) return HW[q];
  const cands = FORMS[q] ?? [];
  const out: LexiconEntry[] = [];
  const seen = new Set<string>();
  for (const c of cands) {
    for (const e of HW[c] ?? []) {
      const k = e.sourceId ?? `${e.lemma}:${e.senses?.[0]?.english ?? ''}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(e);
    }
  }
  return out;
}

/** Strip a √root token to its bare stem: "√bhikkh 1 a (beg)" → "bhikkh". */
function rootStem(tok: string): string {
  return norm(tok)
    .replace(/^√/, '')
    .replace(/[0-9].*$/, '') // drop class number + everything after
    .replace(/[^a-zāīūṁṅñṭḍṇḷṃ].*$/i, '') // drop trailing punctuation/notes
    .trim();
}

/** All √roots asserted anywhere in a blob of text. */
function extractRoots(text: string): Set<string> {
  const out = new Set<string>();
  const re = /√\s*([a-zāīūṁṅñṭḍḷṇṃ]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const stem = rootStem('√' + m[1]);
    if (stem) out.add(stem);
  }
  return out;
}

/** DPD's authoritative root set for a word: roots from every homonym entry +
 *  the Sanskrit-root bracket in the citation ("Sanskrit: bhikṣu [bhikṣ]"). */
function dpdRoots(entries: LexiconEntry[]): Set<string> {
  const out = new Set<string>();
  for (const e of entries) {
    const raw = (e.rawExcerpt ?? '') + ' ' + (e.senses?.map((s) => s.citation ?? '').join(' ') ?? '');
    for (const r of extractRoots(raw)) out.add(r);
    // Sanskrit root bracket, e.g. "Sanskrit: bhikṣu [bhikṣ]" — record the bracketed stem.
    const cite = e.senses?.map((s) => s.citation ?? '').join(' ') ?? '';
    const br = /\[([a-zāīūṁṅñṭḍḷṇṃ√\s]+)\]/gi;
    let m: RegExpExecArray | null;
    while ((m = br.exec(cite)) !== null) out.add(norm(m[1].replace(/√/g, '')));
  }
  return out;
}

const CONTENT_POS = /(masc|fem|nt|adj|noun|verb|aor|pr|fut|imp|opt|pp|prp|abs|ger|inf|caus|denom)/i;
const FUNCTION_POS = /(ind|prep|conj|pron|dem|part|emph|adv|rel|neg|interj)/i;

/** DPD part-of-speech tokens for a word, unioned across homonyms. */
function dpdPos(entries: LexiconEntry[]): string[] {
  return [...new Set(entries.map((e) => e.partOfSpeech).filter(Boolean) as string[])];
}

const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'that', 'this', 'is', 'one', 'who', 'lit', 'and', 'at', 'it', 'be']);
function contentTokens(s: string): Set<string> {
  return new Set(
    norm(s)
      .replace(/[^a-zāīūṁṅñṭḍḷṇṃ\s]/gi, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

// ── verification pass ────────────────────────────────────────────────────────
type Flag = {
  phase: string;
  surface: string;
  wordId: string;
  severity: 'ERROR' | 'WARN' | 'INFO';
  kind: 'UNMATCHED' | 'ROOT_MISMATCH' | 'POS_MISMATCH' | 'SENSE_DIVERGENCE';
  detail: string;
};

/**
 * Documented DPD-disambiguation false-positives: cases where the golden is
 * CORRECT for the MN10 context but DPD's forms.json resolves the surface to the
 * wrong homonym. Downgraded to INFO with the reason, never silently dropped —
 * suppressing them to zero would itself be goodharting the verifier.
 */
const KNOWN_FP: Record<string, string> = {
  // sato in MN10's breathing refrain = "ever MINDFUL he breathes" (pp of sarati,
  // √sar/smṛ). DPD forms.json maps "sato" → the santa/√as "when being" homonym,
  // the wrong reading here. The golden's √sm (smṛ) is right.
  'sato:sm': 'MN10 sato = "mindful" (√sar/smṛ); DPD resolves the √as "being" homonym — golden is correct',
};

const flags: Flag[] = [];
let totalWords = 0;
let matchedWords = 0;

const phaseIds = Object.keys(anatGolden);
for (const phase of phaseIds) {
  const anat = anatGolden[phase];
  const lex = lexGolden[phase];
  if (!anat?.words) continue;

  for (const w of anat.words) {
    totalWords++;
    const segs = (anat.segments ?? []).filter((s) => s.wordId === w.id);
    const goldenTooltipBlob = segs.flatMap((s) => s.tooltips ?? []).join(' \n ');
    const entries = dpdLookup(w.surface);

    if (!entries.length) {
      flags.push({
        phase, surface: w.surface, wordId: w.id, severity: 'WARN', kind: 'UNMATCHED',
        detail: `surface "${w.surface}" did not resolve to any DPD headword — cannot verify`,
      });
      continue;
    }
    matchedWords++;

    // 2. ROOT check — golden √roots not attested by DPD = probable folk etymology.
    const gRoots = extractRoots(goldenTooltipBlob);
    const dRoots = dpdRoots(entries);
    const spurious = [...gRoots].filter((r) => r && !dRoots.has(r) && ![...dRoots].some((d) => d.startsWith(r) || r.startsWith(d)));
    if (spurious.length && dRoots.size) {
      const fpKey = spurious.map((r) => `${norm(w.surface)}:${r}`).find((k) => KNOWN_FP[k]);
      flags.push({
        phase, surface: w.surface, wordId: w.id,
        severity: fpKey ? 'INFO' : 'ERROR', kind: 'ROOT_MISMATCH',
        detail: fpKey
          ? `KNOWN FALSE-POSITIVE — ${KNOWN_FP[fpKey]}`
          : `golden asserts √[${spurious.join(', ')}] not in DPD roots {${[...dRoots].join(', ')}} for lemma "${entries[0].lemma}"`,
      });
    }

    // 3. POS check — content/function vs DPD pos (coarse).
    const gClass = (w.wordClass ?? '').toLowerCase();
    const pos = dpdPos(entries);
    const posStr = pos.join(',');
    if (gClass === 'content' && FUNCTION_POS.test(posStr) && !CONTENT_POS.test(posStr)) {
      flags.push({
        phase, surface: w.surface, wordId: w.id, severity: 'WARN', kind: 'POS_MISMATCH',
        detail: `golden=content but DPD pos=[${posStr}] (function-like)`,
      });
    } else if (gClass === 'function' && CONTENT_POS.test(posStr) && !FUNCTION_POS.test(posStr)) {
      flags.push({
        phase, surface: w.surface, wordId: w.id, severity: 'WARN', kind: 'POS_MISMATCH',
        detail: `golden=function but DPD pos=[${posStr}] (content-like)`,
      });
    }

    // 4. SENSE overlap — soft, review-only.
    const lexEntry = lex?.senses?.find((s) => s.wordId === w.id);
    if (lexEntry) {
      const gSenses = contentTokens(lexEntry.senses.map((s) => s.english).join(' '));
      const dSenses = contentTokens(entries.flatMap((e) => e.senses?.map((s) => s.english) ?? []).join(' '));
      const j = jaccard(gSenses, dSenses);
      if (j < 0.1 && gSenses.size && dSenses.size) {
        flags.push({
          phase, surface: w.surface, wordId: w.id, severity: 'INFO', kind: 'SENSE_DIVERGENCE',
          detail: `sense overlap ${j.toFixed(2)} — golden {${[...gSenses].slice(0, 4).join(', ')}} vs DPD {${[...dSenses].slice(0, 4).join(', ')}}`,
        });
      }
    }
  }
}

// ── report ───────────────────────────────────────────────────────────────────
const bySeverity = (sev: Flag['severity']) => flags.filter((f) => f.severity === sev);
const errors = bySeverity('ERROR');
const warns = bySeverity('WARN');
const infos = bySeverity('INFO');

const byKind: Record<string, number> = {};
for (const f of flags) byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;

const lines: string[] = [];
lines.push('# MN10 Golden — DPD Verification Report\n');
lines.push(`Generated by \`scripts/sutta-studio/verify-golden.ts\` against \`data/dpd/mn10\`.\n`);
lines.push(`- Phases: **${phaseIds.length}**`);
lines.push(`- Golden words: **${totalWords}** (DPD-matched: **${matchedWords}**, ${((matchedWords / totalWords) * 100).toFixed(1)}%)`);
lines.push(`- Flags: **${errors.length} ERROR** · ${warns.length} WARN · ${infos.length} INFO`);
lines.push(`- By kind: ${Object.entries(byKind).map(([k, v]) => `${k}=${v}`).join(' · ')}\n`);

const section = (title: string, list: Flag[]) => {
  if (!list.length) return;
  lines.push(`\n## ${title} (${list.length})\n`);
  lines.push('| phase | surface | detail |');
  lines.push('|---|---|---|');
  for (const f of list) lines.push(`| ${f.phase} | \`${f.surface}\` | ${f.detail.replace(/\|/g, '\\|')} |`);
};
section('🔴 ROOT_MISMATCH — probable folk etymology (fix these)', errors.filter((f) => f.kind === 'ROOT_MISMATCH'));
section('🟡 POS_MISMATCH — content/function disagreement', warns.filter((f) => f.kind === 'POS_MISMATCH'));
section('🟡 UNMATCHED — not in DPD, cannot verify', warns.filter((f) => f.kind === 'UNMATCHED'));
section('🔵 SENSE_DIVERGENCE — low overlap, review only', infos);

const outDir = p('reports/sutta-studio');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'golden-verification.md'), lines.join('\n'));
fs.writeFileSync(
  path.join(outDir, 'golden-verification.json'),
  JSON.stringify({ totalWords, matchedWords, byKind, flags }, null, 2),
);

console.log(lines.slice(0, 8).join('\n'));
console.log(`\nWrote reports/sutta-studio/golden-verification.{md,json}`);
console.log(`ROOT_MISMATCH (folk etymology) count: ${errors.filter((f) => f.kind === 'ROOT_MISMATCH').length}`);
