/**
 * Pedagogical probe, stage 2 — the STUDENT run.
 *
 * One deliberately weak student model reads each contestant's compiled phase
 * output as its ONLY material and answers the deterministic question bank.
 * The same student with NO material is the CLOSED-BOOK CONTROL: its
 * parametric Pāli knowledge. A packet's probe score is its LIFT over that
 * control — which is also the contamination answer at the probe level (a
 * student that already knows MN10 shows up in the control, not in lift).
 *
 * Grading is deterministic containment against the bank's human-authority
 * answer keys, so the only model judgment in the loop is the student's —
 * which is precisely the judgment being measured.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/sutta-studio/probe-student.ts \
 *     [--student google/gemma-4-26b-it:free] [--models grok-4.20,...] [--control-only]
 * Writes reports/sutta-studio/probe-results.json (incremental; safe to re-run —
 * completed (student, model, phase) cells are skipped).
 * Completion marker: PROBE RUN COMPLETE
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) {
  console.error('OPENROUTER_API_KEY missing');
  process.exit(1);
}
const argValue = (f: string) => {
  const i = process.argv.indexOf(f);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
// Paid slug: the :free variant is rate-limited upstream, and a 300-call run
// needs reliability more than it needs $0.30. (First attempt used a slug that
// doesn't exist — the a4b infix matters. Slug churn strikes again.)
const STUDENT = argValue('--student') || 'google/gemma-4-26b-a4b-it';
const STUDENT_FALLBACK = 'google/gemma-4-26b-a4b-it:free';

const ROOT = 'reports/sutta-studio';
const DIRS = ['2026-07-01T10-11-40-333Z', '2026-07-01T17-39-07-313Z', 'baseline-dictionary'];
const bank = JSON.parse(fs.readFileSync('test-fixtures/sutta-studio-probe-questions.json', 'utf8')).questions as Array<{
  id: string;
  phaseId: string;
  split: string;
  type: string;
  surface: string;
  question: string;
  accepted: string[];
}>;
const testQs = bank.filter((q) => q.split === 'test');
const byPhase = new Map<string, typeof testQs>();
for (const q of testQs) byPhase.set(q.phaseId, [...(byPhase.get(q.phaseId) ?? []), q]);

// Results are keyed by (contestant, phase) and reruns SKIP completed cells —
// so a change to renderMaterial requires a FRESH results path or the rerun
// silently reuses answers from the old material.
const RESULTS = argValue('--results') || path.join(ROOT, 'probe-results.json');
const results: Record<string, Record<string, { correct: string[]; wrong: string[] }>> = fs.existsSync(RESULTS)
  ? JSON.parse(fs.readFileSync(RESULTS, 'utf8')).cells ?? {}
  : {};

const fold = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFC')
    .replace(/√/g, '')
    .replace(/[^a-zāīūṁṃṅñṭḍṇḷ\s-]/g, '')
    .trim();
const isCorrect = (answer: string, accepted: string[]): boolean => {
  const a = fold(answer);
  if (!a) return false;
  return accepted.some((acc) => {
    const f = fold(acc);
    return f.length > 0 && (a.includes(f) || f.includes(a));
  });
};

async function ask(model: string, prompt: string): Promise<Record<string, string>> {
  let slug = model;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: slug,
          temperature: 0,
          max_tokens: 2500,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'Answer each question in 1-6 words. Return one JSON object mapping question ids to answer strings. No prose outside JSON.' },
            { role: 'user', content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const text: string = data.choices?.[0]?.message?.content ?? '';
      return JSON.parse(text.replace(/^```(json)?|```$/g, '').trim());
    } catch (e) {
      if (attempt === 2 && slug !== STUDENT_FALLBACK) slug = STUDENT_FALLBACK; // free tier flaked → paid sibling
      if (attempt === 4) throw e;
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
  }
  throw new Error('unreachable');
}

/** Render a contestant's stored phase output as the student's reading page. */
function renderMaterial(data: Record<string, any>): string {
  const anat = data.output?.anatomist;
  const lex = data.output?.lexicographer;
  const weaver = data.output?.weaver;
  if (!anat?.words?.length) return '';
  const lines: string[] = ['PALI PASSAGE, word by word:'];
  for (const w of anat.words) {
    const segs = (anat.segments || []).filter((s: any) => s.wordId === w.id);
    const parts = segs.map((s: any) => s.text).join('·');
    const tips = segs.flatMap((s: any) => s.tooltips || []).join(' | ');
    // v1.1: structured morph fields ARE part of the interface (the view shows
    // them); omitting them under-served morph-asserting packets on grammar
    // questions (grok most, 90% morph coverage).
    const CASE_NAMES: Record<string, string> = { nom: 'nominative', acc: 'accusative', instr: 'instrumental', dat: 'dative', abl: 'ablative', gen: 'genitive', loc: 'locative', voc: 'vocative' };
    const NUM_NAMES: Record<string, string> = { sg: 'singular', pl: 'plural' };
    const morph = segs
      .flatMap((s: any) => Object.entries(s.morph || {}))
      .map(([k, v]: [string, any]) => (k === 'case' ? CASE_NAMES[String(v)] ?? v : k === 'number' ? NUM_NAMES[String(v)] ?? v : `${k}:${v}`))
      .join(', ');
    const senses = (lex?.senses || [])
      .filter((e: any) => e.wordId === w.id)
      .flatMap((e: any) => e.senses.map((x: any) => x.english))
      .join('; ');
    lines.push(`  ${w.surface}${parts && parts !== w.surface ? `  [${parts}]` : ''}${senses ? `  — meanings: ${senses}` : ''}${morph ? `  — grammar: ${morph}` : ''}${tips ? `  — notes: ${tips}` : ''}`);
  }
  if (data.englishText) lines.push(`\nENGLISH TRANSLATION: ${data.englishText}`);
  const links = (weaver?.tokens || []).filter((t: any) => !t.isGhost && (t.linkedPaliId || t.linkedSegmentId));
  if (links.length) {
    const wordById = new Map((anat.words || []).map((w: any) => [w.id, w.surface]));
    lines.push('WORD LINKS (english ← pali):');
    for (const t of links) {
      const wid = t.linkedPaliId || String(t.linkedSegmentId).replace(/s\d+$/, '');
      const pali = wordById.get(wid);
      if (pali) lines.push(`  "${t.text}" ← ${pali}`);
    }
  }
  return lines.join('\n');
}

const run = async () => {
  // discover contestants
  const contestants = new Map<string, string>(); // model -> dir
  for (const d of DIRS) {
    const o = path.join(ROOT, d, 'outputs');
    if (!fs.existsSync(o)) continue;
    for (const m of fs.readdirSync(o)) if (fs.statSync(path.join(o, m)).isDirectory()) contestants.set(m, path.join(o, m));
  }
  const only = argValue('--models')?.split(',');
  const jobs: Array<[string, string | null]> = [['closed-book-control', null]];
  for (const [m, dir] of contestants) if (!only || only.includes(m)) jobs.push([m, dir]);

  for (const [label, dir] of jobs) {
    results[label] = results[label] ?? {};
    for (const [phaseId, qs] of byPhase) {
      if (results[label][phaseId]) continue; // resume support
      let material = '';
      if (dir) {
        const f = path.join(dir, `pipeline-${phaseId}.json`);
        if (!fs.existsSync(f)) continue;
        material = renderMaterial(JSON.parse(fs.readFileSync(f, 'utf8')));
        if (!material) continue;
      }
      const qLines = qs.map((q) => `${q.id}: ${q.question}`).join('\n');
      const prompt = dir
        ? `Study this material about a Pāli passage, then answer the questions USING ONLY THE MATERIAL. If the material does not contain the answer, reply "unknown".\n\n${material}\n\nQUESTIONS:\n${qLines}`
        : `Answer these questions about Pāli words from your own knowledge. If unsure, reply "unknown".\n\nQUESTIONS:\n${qLines}`;
      try {
        const answers = await ask(STUDENT, prompt);
        const correct: string[] = [];
        const wrong: string[] = [];
        for (const q of qs) (isCorrect(String(answers[q.id] ?? ''), q.accepted) ? correct : wrong).push(q.id);
        results[label][phaseId] = { correct, wrong };
        fs.writeFileSync(RESULTS, JSON.stringify({ _student: STUDENT, _updatedAt: new Date().toISOString(), cells: results }, null, 1));
        console.log(`[${label}] ${phaseId}: ${correct.length}/${qs.length}`);
      } catch (e) {
        console.log(`[${label}] ${phaseId}: FAILED ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  // summary
  const qType = new Map(bank.map((q) => [q.id, q.type]));
  console.log('\nmodel                 | answered | acc   | lift');
  const ctl = results['closed-book-control'] ?? {};
  const acc = (label: string) => {
    const cells = results[label] ?? {};
    let c = 0;
    let t = 0;
    for (const v of Object.values(cells)) {
      c += v.correct.length;
      t += v.correct.length + v.wrong.length;
    }
    return t ? c / t : NaN;
  };
  const ctlAcc = acc('closed-book-control');
  for (const label of Object.keys(results).sort((a, b) => acc(b) - acc(a))) {
    const a = acc(label);
    const lift = label === 'closed-book-control' ? '' : (a - ctlAcc >= 0 ? '+' : '') + (a - ctlAcc).toFixed(3);
    console.log(`${label.padEnd(21)} | ${String(Object.values(results[label]).reduce((x, v) => x + v.correct.length + v.wrong.length, 0)).padStart(8)} | ${a.toFixed(3)} | ${lift}`);
  }
  void qType;
  console.log('\nPROBE RUN COMPLETE');
};

run().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
