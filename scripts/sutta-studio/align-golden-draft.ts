/**
 * SUTTA-013 part 2, stage 1 — the MECHANICAL alignment draft.
 *
 * Builds candidate (Pāli word ↔ English token) links for the alignment
 * golden with no model calls: a link is accepted when a word's dictionary
 * gloss token (golden senses first, DPD senses second) matches an English
 * token of the phrase UNAMBIGUOUSLY (that token appears exactly once in the
 * phrase and exactly one Pāli word claims it; cheap singular/plural folding).
 *
 * Everything ambiguous or unmatched lands in the residue for the model
 * curation stage — so most of the answer key traces to the dictionary plus
 * a string match, and only the residue rests on model judgment + a skeptic.
 *
 * Phases sharing canonical segments (wordRange sub-splits) are grouped and
 * aligned against the group's combined English, since the harness passes the
 * full segment English through to every sub-split phase.
 *
 * Output: reports/sutta-studio/align-draft.json + a coverage summary.
 */

import * as fs from 'node:fs';
import { loadDpdSubsetFromFs } from '../../services/providers/dpd-loader-fs';
import type { LexiconEntry } from '../../services/providers/types';

type Word = { id: string; surface: string; wordClass?: string };
type Seg = { ref: { segmentId: string }; pali: string; baseEnglish?: string };

const anatGolden = JSON.parse(fs.readFileSync('test-fixtures/sutta-studio-anatomist-golden.json', 'utf8')).anatomist as Record<
  string,
  { words: Word[] }
>;
const lexGolden = JSON.parse(fs.readFileSync('test-fixtures/sutta-studio-lexicographer-golden.json', 'utf8')).lexicographer as Record<
  string,
  { senses: Array<{ wordId: string; senses: Array<{ english: string }> }> }
>;
const fixture = JSON.parse(fs.readFileSync('test-fixtures/sutta-studio-golden-from-demo.json', 'utf8')).skeleton as {
  canonicalSegments: Seg[];
  expectedPhases: Array<{ id: string; segmentIds: string[] }>;
};

const dpd = loadDpdSubsetFromFs('mn10');
const HW = dpd.headwords as Record<string, LexiconEntry[]>;
const FORMS = (dpd.forms ?? {}) as Record<string, string[]>;
const dpdLookup = (surface: string): LexiconEntry[] => {
  const q = surface.trim().toLowerCase().normalize('NFC');
  if (HW[q]?.length) return HW[q];
  return (FORMS[q] ?? []).flatMap((c) => HW[c] ?? []);
};

const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'is', 'and', 'or', 'it', 'at', 'on', 'be', 'that', 'this', 'has', 'have', 'i']);
const normTok = (t: string) => t.toLowerCase().normalize('NFC').replace(/[^a-z''-]/g, '');
/** Cheap inflection folding: map plural/3sg variants onto a shared key. */
const foldKey = (t: string) => {
  let x = normTok(t);
  if (x.endsWith('ies') && x.length > 4) x = x.slice(0, -3) + 'y';
  else if (x.endsWith('es') && x.length > 4) x = x.slice(0, -2);
  else if (x.endsWith('s') && x.length > 3 && !x.endsWith('ss')) x = x.slice(0, -1);
  return x;
};

const glossKeysFor = (phaseId: string, word: Word): Set<string> => {
  const keys = new Set<string>();
  const add = (text: string) =>
    text
      .split(/[\s;,/()]+/)
      .map(foldKey)
      .filter((k) => k.length > 2 && !STOP.has(k))
      .forEach((k) => keys.add(k));
  for (const e of lexGolden[phaseId]?.senses ?? []) {
    if (e.wordId !== word.id) continue;
    for (const s of e.senses ?? []) add(s.english || '');
  }
  for (const e of dpdLookup(word.surface)) {
    for (const s of e.senses ?? []) add(s.english || '');
  }
  return keys;
};

// group phases by their segment tuple (sub-splits share English)
const segById = new Map(fixture.canonicalSegments.map((s) => [s.ref.segmentId, s]));
const groups = new Map<string, string[]>(); // segTuple -> phaseIds
for (const ph of fixture.expectedPhases) {
  const key = ph.segmentIds.join('+');
  groups.set(key, [...(groups.get(key) ?? []), ph.id]);
}

type Link = { phaseId: string; wordId: string; surface: string; tokenIdx: number; token: string; via: 'golden-sense' | 'dpd' };
type Group = {
  segmentIds: string[];
  phaseIds: string[];
  english: string;
  tokens: string[];
  links: Link[];
  unresolvedWords: Array<{ phaseId: string; wordId: string; surface: string; wordClass?: string }>;
  unclaimedTokens: Array<{ idx: number; token: string }>;
};

const out: Group[] = [];
let contentWords = 0;
let linkedContent = 0;

for (const [key, phaseIds] of groups) {
  const segmentIds = key.split('+');
  const english = segmentIds.map((id) => segById.get(id)?.baseEnglish ?? '').join(' ').trim();
  const tokens = english.split(/\s+/).filter(Boolean);
  const tokenKeyCount = new Map<string, number[]>();
  tokens.forEach((t, i) => {
    const k = foldKey(t);
    if (!k) return;
    tokenKeyCount.set(k, [...(tokenKeyCount.get(k) ?? []), i]);
  });

  // gather every word of every phase in the group, with its gloss keys
  const wordEntries = phaseIds.flatMap((pid) =>
    (anatGolden[pid]?.words ?? []).map((w) => ({ phaseId: pid, word: w, keys: glossKeysFor(pid, w) }))
  );

  // key -> claiming words (for the one-claimant rule)
  const claimants = new Map<string, number[]>();
  wordEntries.forEach((we, wi) => {
    for (const k of we.keys) claimants.set(k, [...(claimants.get(k) ?? []), wi]);
  });

  const links: Link[] = [];
  const linkedWordIdx = new Set<number>();
  const claimedTokenIdx = new Set<number>();
  wordEntries.forEach((we, wi) => {
    for (const k of we.keys) {
      const tokenIdxs = tokenKeyCount.get(k);
      if (!tokenIdxs || tokenIdxs.length !== 1) continue; // token must be unique in phrase
      if ((claimants.get(k) ?? []).length !== 1) continue; // exactly one claimant
      const idx = tokenIdxs[0];
      if (claimedTokenIdx.has(idx)) continue;
      const viaGolden = (lexGolden[we.phaseId]?.senses ?? []).some(
        (e) => e.wordId === we.word.id && (e.senses ?? []).some((s) => (s.english || '').split(/[\s;,/()]+/).map(foldKey).includes(k))
      );
      links.push({ phaseId: we.phaseId, wordId: we.word.id, surface: we.word.surface, tokenIdx: idx, token: tokens[idx], via: viaGolden ? 'golden-sense' : 'dpd' });
      linkedWordIdx.add(wi);
      claimedTokenIdx.add(idx);
      break; // one mechanical link per word is enough for the draft
    }
  });

  wordEntries.forEach((we, wi) => {
    if (we.word.wordClass === 'content') {
      contentWords += 1;
      if (linkedWordIdx.has(wi)) linkedContent += 1;
    }
  });

  out.push({
    segmentIds,
    phaseIds,
    english,
    tokens,
    links,
    unresolvedWords: wordEntries.filter((_, wi) => !linkedWordIdx.has(wi)).map((we) => ({ phaseId: we.phaseId, wordId: we.word.id, surface: we.word.surface, wordClass: we.word.wordClass })),
    unclaimedTokens: tokens.map((t, i) => ({ idx: i, token: t })).filter(({ idx }) => !claimedTokenIdx.has(idx)),
  });
}

fs.writeFileSync('reports/sutta-studio/align-draft.json', JSON.stringify({ generatedBy: 'align-golden-draft.ts', groups: out }, null, 2));

const totalLinks = out.reduce((a, g) => a + g.links.length, 0);
const viaGolden = out.reduce((a, g) => a + g.links.filter((l) => l.via === 'golden-sense').length, 0);
const unresolvedContent = out.reduce((a, g) => a + g.unresolvedWords.filter((w) => w.wordClass === 'content').length, 0);
console.log(`groups: ${out.length} | mechanical links: ${totalLinks} (${viaGolden} via golden senses, ${totalLinks - viaGolden} via DPD)`);
console.log(`content words: ${contentWords} | mechanically linked: ${linkedContent} (${Math.round((100 * linkedContent) / contentWords)}%)`);
console.log(`residue for model curation: ${unresolvedContent} content words + ghosts/function words`);
console.log('DRAFT COMPLETE');
