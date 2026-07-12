/**
 * The DICTIONARY BASELINE — suttabench's non-LLM floor.
 *
 * A benchmark claim needs a floor: what does pure dictionary lookup score,
 * with no language model anywhere? This "model" does exactly what a
 * rule-based script can: one word per whitespace token (no morpheme cuts),
 * word class from DPD part-of-speech, senses copied verbatim from DPD
 * glosses, roots from DPD root sets, morph only where DPD's readings are
 * unambiguous, and English links via the mechanical unambiguous-gloss rule.
 * Anything a ranked model scores must beat THIS to demonstrate competence
 * beyond lookup (the SUTTA-011 review's "a dict-lookup script could ace it"
 * objection, made explicit and measurable).
 *
 * Outputs are written in the run-dir pipeline-phase shape so every existing
 * scorer/report treats the baseline as just another model:
 *   reports/sutta-studio/baseline-dictionary/outputs/dictionary-baseline/
 * Golden + segments + englishText are copied from an existing run's phase
 * files (grok's dir, which has all 30 test phases with golden v2 embedded).
 *
 * Run: npx tsx scripts/sutta-studio/baseline-dictionary.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadDpdSubsetFromFs } from '../../services/providers/dpd-loader-fs';
import type { LexiconEntry } from '../../services/providers/types';
import { splitPaliTokens } from '../../services/sutta-studio/utils';
import { dpdRoots, type MorphReading } from './facts-scorer';

const SOURCE = 'reports/sutta-studio/2026-07-01T17-39-07-313Z/outputs/grok-4.20';
const OUT = 'reports/sutta-studio/baseline-dictionary/outputs/dictionary-baseline';
fs.mkdirSync(OUT, { recursive: true });

const dpd = loadDpdSubsetFromFs('mn10');
const HW = dpd.headwords as Record<string, LexiconEntry[]>;
const FORMS = (dpd.forms ?? {}) as Record<string, string[]>;
const grammar = JSON.parse(fs.readFileSync('data/dpd/mn10/grammar.json', 'utf8')).readings as Record<string, MorphReading[]>;

const clean = (s: string) => (s || '').toLowerCase().normalize('NFC').replace(/[^a-zāīūṁṃṅñṭḍṇḷ'']/g, '');
const dpdLookup = (surface: string): LexiconEntry[] => {
  const q = clean(surface);
  if (!q) return [];
  if (HW[q]?.length) return HW[q];
  return (FORMS[q] ?? []).flatMap((c) => HW[c] ?? []);
};

const CONTENT_POS = /(masc|fem|nt|adj|noun|verb|aor|pr|fut|imp|opt|pp|prp|abs|ger|inf|caus|denom)/i;
const FUNCTION_POS = /(ind|prep|conj|pron|dem|part|emph|adv|rel|neg|interj)/i;

const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'is', 'and', 'or', 'it', 'at', 'on', 'be', 'that', 'this', 'has', 'have', 'i']);
const normTok = (t: string) => t.toLowerCase().normalize('NFC').replace(/[^a-z''-]/g, '');
const foldKey = (t: string) => {
  let x = normTok(t);
  if (x.endsWith('ies') && x.length > 4) x = x.slice(0, -3) + 'y';
  else if (x.endsWith('es') && x.length > 4) x = x.slice(0, -2);
  else if (x.endsWith('s') && x.length > 3 && !x.endsWith('ss')) x = x.slice(0, -1);
  return x;
};

let phases = 0;
for (const f of fs.readdirSync(SOURCE).filter((f) => f.startsWith('pipeline-phase-'))) {
  const src = JSON.parse(fs.readFileSync(path.join(SOURCE, f), 'utf8'));
  const pali: string = (src.segments || []).map((s: { pali: string }) => s.pali).join(' ');
  const english: string = src.englishText || '';
  const tokens = splitPaliTokens(pali);

  const words: Array<Record<string, unknown>> = [];
  const segments: Array<Record<string, unknown>> = [];
  const senses: Array<Record<string, unknown>> = [];
  const glossOf = new Map<string, Set<string>>(); // wordId -> gloss keys

  tokens.forEach((tok, i) => {
    const id = `p${i + 1}`;
    const entries = dpdLookup(tok);
    const posBlob = entries.map((e) => e.partOfSpeech || '').join(' ');
    const wordClass = FUNCTION_POS.test(posBlob) && !CONTENT_POS.test(posBlob) ? 'function' : 'content';
    const roots = [...dpdRoots(entries)];
    const tooltips = roots.length ? [`√${roots[0]}: root (DPD)`] : entries[0]?.senses?.[0]?.english ? [`${entries[0].lemma}: ${entries[0].senses[0].english.split(';')[0]}`] : [];
    // morph only where DPD is unambiguous
    const readings = grammar[clean(tok)] ?? [];
    const morph: Record<string, string> = {};
    if (readings.length) {
      for (const k of ['gender', 'case', 'number'] as const) {
        const vals = new Set(readings.map((r) => r[k]).filter(Boolean));
        if (vals.size === 1) morph[k] = [...vals][0]!;
      }
    }
    words.push({ id, surface: tok, wordClass, segmentIds: [`${id}s1`] });
    segments.push({ id: `${id}s1`, wordId: id, text: tok, type: 'stem', tooltips, ...(Object.keys(morph).length ? { morph } : {}) });

    const wordSenses = entries.slice(0, 3).flatMap((e) => (e.senses ?? []).slice(0, 1)).map((s) => ({ english: (s.english || '').split(';')[0].trim(), nuance: '' })).filter((s) => s.english);
    if (wordSenses.length) senses.push({ wordId: id, wordClass, senses: wordSenses });
    const keys = new Set<string>();
    for (const e of entries) for (const s of e.senses ?? []) for (const t of (s.english || '').split(/[\s;,/()]+/)) {
      const k = foldKey(t);
      if (k.length > 2 && !STOP.has(k)) keys.add(k);
    }
    glossOf.set(id, keys);
  });

  // weaver: unambiguous-gloss linking (the mechanical aligner rule)
  const engTokens = english.split(/\s+/).filter(Boolean);
  const keyToTokens = new Map<string, number[]>();
  engTokens.forEach((t, i) => {
    const k = foldKey(t);
    if (k) keyToTokens.set(k, [...(keyToTokens.get(k) ?? []), i]);
  });
  const keyClaimants = new Map<string, string[]>();
  for (const [wid, keys] of glossOf) for (const k of keys) keyClaimants.set(k, [...(keyClaimants.get(k) ?? []), wid]);
  const weaverTokens: Array<Record<string, unknown>> = [];
  const linked = new Set<number>();
  for (const [wid, keys] of glossOf) {
    for (const k of keys) {
      const idxs = keyToTokens.get(k);
      if (!idxs || idxs.length !== 1 || (keyClaimants.get(k) ?? []).length !== 1 || linked.has(idxs[0])) continue;
      weaverTokens.push({ tokenIndex: idxs[0], text: engTokens[idxs[0]], isGhost: false, linkedPaliId: wid });
      linked.add(idxs[0]);
      break;
    }
  }
  engTokens.forEach((t, i) => {
    if (!linked.has(i)) weaverTokens.push({ tokenIndex: i, text: t, isGhost: true, ghostKind: 'required' });
  });

  const out = {
    ...src,
    runId: 'dictionary-baseline',
    output: {
      anatomist: { id: src.phaseId, words, segments, relations: [], handoff: { confidence: 'high', notes: 'dictionary baseline' } },
      lexicographer: { id: src.phaseId, senses },
      weaver: { id: src.phaseId, tokens: weaverTokens, handoff: {} },
      typesetter: src.output?.typesetter ?? null,
    },
  };
  fs.writeFileSync(path.join(OUT, f), JSON.stringify(out));
  phases++;
}
console.log(`baseline phases written: ${phases} → ${OUT}`);
console.log('BASELINE COMPLETE');
