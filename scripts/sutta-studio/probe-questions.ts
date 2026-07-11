/**
 * Pedagogical probe, stage 1 — the QUESTION BANK generator.
 *
 * The north-star metric (SUTTA-013 "out of scope", now in scope): grade a
 * compiled packet by whether a weak STUDENT model reading ONLY that packet
 * can answer comprehension questions about the text. Grade the teaching by
 * the learning — no golden prose, no judge taste.
 *
 * This stage is fully deterministic and free: every question and its
 * accepted answers derive from human-authority data we already hold —
 *   root:      DPD root sets (golden √tooltips as fallback authority)
 *   case/num:  DPD grammar readings, ONLY where every reading agrees
 *              (ambiguous forms get no question — fairness over volume)
 *   sense:     golden-v2 sense english strings (DPD-verbatim curated)
 *   align:     the alignment golden's (word ↔ english token) links
 *
 * Questions are tagged with the benchmark's train/test split so the probe
 * can be scored on held-out phases only, and with their authority so the
 * provenance panel can disclose exactly whose answer key this is.
 *
 * Run: npx tsx scripts/sutta-studio/probe-questions.ts
 * Writes: test-fixtures/sutta-studio-probe-questions.json
 */

import * as fs from 'node:fs';
import { loadDpdSubsetFromFs } from '../../services/providers/dpd-loader-fs';
import type { LexiconEntry } from '../../services/providers/types';
import { dpdRoots, extractRoots, type MorphReading } from './facts-scorer';
import { BENCHMARK_CONFIG } from './benchmark-config';

const anatGolden = JSON.parse(fs.readFileSync('test-fixtures/sutta-studio-anatomist-golden.json', 'utf8')).anatomist as Record<
  string,
  { words: Array<{ id: string; surface: string; wordClass?: string; segmentIds?: string[] }>; segments: Array<{ id: string; wordId: string; tooltips?: string[] }> }
>;
const lexGolden = JSON.parse(fs.readFileSync('test-fixtures/sutta-studio-lexicographer-golden.json', 'utf8')).lexicographer as Record<
  string,
  { senses: Array<{ wordId: string; senses: Array<{ english: string }> }> }
>;
const alignGolden = JSON.parse(fs.readFileSync('test-fixtures/sutta-studio-alignment-golden.json', 'utf8')) as {
  groups: Array<{ phaseIds: string[]; tokens: string[]; links: Array<{ phaseId: string; wordId: string; surface: string; tokenIdxs: number[]; via: string }> }>;
};
const grammar = JSON.parse(fs.readFileSync('data/dpd/mn10/grammar.json', 'utf8')).readings as Record<string, MorphReading[]>;

const dpd = loadDpdSubsetFromFs('mn10');
const HW = dpd.headwords as Record<string, LexiconEntry[]>;
const FORMS = (dpd.forms ?? {}) as Record<string, string[]>;
const dpdLookup = (surface: string): LexiconEntry[] => {
  const q = surface.trim().toLowerCase().normalize('NFC');
  if (HW[q]?.length) return HW[q];
  return (FORMS[q] ?? []).flatMap((c) => HW[c] ?? []);
};

const clean = (s: string) => (s || '').toLowerCase().normalize('NFC').replace(/[^a-zāīūṁṃṅñṭḍṇḷ'']/g, '');
const CASE_WORDS: Record<string, string[]> = {
  nom: ['nominative', 'nom'], acc: ['accusative', 'acc'], instr: ['instrumental', 'instr'], dat: ['dative', 'dat'],
  abl: ['ablative', 'abl'], gen: ['genitive', 'gen'], loc: ['locative', 'loc'], voc: ['vocative', 'voc'],
};
const NUMBER_WORDS: Record<string, string[]> = { sg: ['singular', 'sg'], pl: ['plural', 'pl'] };

type Question = {
  id: string;
  phaseId: string;
  split: 'train' | 'test';
  type: 'root' | 'case' | 'number' | 'sense' | 'align';
  surface: string;
  wordId: string;
  question: string;
  accepted: string[];
  authority: string;
};

const testSet = new Set(BENCHMARK_CONFIG.testPhases);
const questions: Question[] = [];
let qn = 0;
const push = (q: Omit<Question, 'id' | 'split'>) => {
  questions.push({ ...q, id: `q${++qn}`, split: testSet.has(q.phaseId) ? 'test' : 'train' });
};

const alignByPhaseWord = new Map<string, { tokens: string[]; idxs: number[] }>();
for (const g of alignGolden.groups) {
  for (const l of g.links) {
    alignByPhaseWord.set(`${l.phaseId}|${l.wordId}`, { tokens: g.tokens, idxs: l.tokenIdxs });
  }
}

for (const [phaseId, phase] of Object.entries(anatGolden)) {
  for (const w of phase.words) {
    if (w.wordClass !== 'content') continue;
    const surf = w.surface.replace(/[.,;:!?""''—]+$/g, '').replace(/^[""''‘’"]+/g, '');

    // ROOT — DPD authority, golden-√ fallback
    const dpdSet = dpdRoots(dpdLookup(w.surface));
    const goldenTips = phase.segments.filter((s) => s.wordId === w.id).flatMap((s) => s.tooltips || []).join(' ');
    const authority = dpdSet.size > 0 ? dpdSet : extractRoots(goldenTips);
    if (authority.size > 0) {
      push({
        phaseId, type: 'root', surface: surf, wordId: w.id,
        question: `According to the material, what is the verbal root of "${surf}"?`,
        accepted: [...authority],
        authority: dpdSet.size > 0 ? 'dpd-roots' : 'golden-tooltips(dpd-verified)',
      });
    }

    // CASE / NUMBER — only where every DPD reading agrees (no ambiguity)
    const readings = grammar[clean(w.surface)];
    if (readings?.length) {
      const cases = new Set(readings.map((r) => r.case).filter(Boolean));
      const numbers = new Set(readings.map((r) => r.number).filter(Boolean));
      if (cases.size === 1) {
        const c = [...cases][0]!;
        push({
          phaseId, type: 'case', surface: surf, wordId: w.id,
          question: `What grammatical case is "${surf}" in?`,
          accepted: CASE_WORDS[c] ?? [c],
          authority: 'dpd-grammar(unambiguous)',
        });
      }
      if (numbers.size === 1) {
        const n = [...numbers][0]!;
        push({
          phaseId, type: 'number', surface: surf, wordId: w.id,
          question: `Is "${surf}" grammatically singular or plural?`,
          accepted: NUMBER_WORDS[n] ?? [n],
          authority: 'dpd-grammar(unambiguous)',
        });
      }
    }

    // SENSE — golden-v2 curated english strings
    const senses = (lexGolden[phaseId]?.senses ?? [])
      .filter((e) => e.wordId === w.id)
      .flatMap((e) => e.senses.map((s) => s.english))
      .filter(Boolean);
    if (senses.length) {
      push({
        phaseId, type: 'sense', surface: surf, wordId: w.id,
        question: `What does "${surf}" mean in this passage?`,
        accepted: senses,
        authority: 'golden-v2-senses(dpd-verbatim)',
      });
    }

    // ALIGN — which English word(s) render it
    const link = alignByPhaseWord.get(`${phaseId}|${w.id}`);
    if (link?.idxs.length) {
      push({
        phaseId, type: 'align', surface: surf, wordId: w.id,
        question: `Which word(s) in the English translation render "${surf}"?`,
        accepted: link.idxs.map((i) => link.tokens[i].replace(/[.,;:!?""'']+$/g, '')),
        authority: 'alignment-golden-v1',
      });
    }
  }
}

fs.writeFileSync(
  'test-fixtures/sutta-studio-probe-questions.json',
  JSON.stringify(
    {
      _description: 'Pedagogical-probe question bank: deterministic comprehension questions with human-authority answer keys, generated from DPD + the curated goldens by probe-questions.ts. The probe grades a compiled packet by whether a weak student model reading ONLY the packet can answer these.',
      _generatedAt: new Date().toISOString(),
      questions,
    },
    null,
    1
  )
);

const by = (k: keyof Question) => {
  const c = new Map<string, number>();
  for (const q of questions) c.set(String(q[k]), (c.get(String(q[k])) ?? 0) + 1);
  return [...c.entries()].map(([a, b]) => `${a}:${b}`).join(' ');
};
console.log(`questions: ${questions.length}`);
console.log(`by type:   ${by('type')}`);
console.log(`by split:  ${by('split')}`);
console.log('BANK COMPLETE');
