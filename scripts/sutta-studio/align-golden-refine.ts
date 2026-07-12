/**
 * SUTTA-013 part 2, stage 3 — refinement round for the alignment golden.
 *
 * Fixes the two defects stage 2's log surfaced:
 *  1. Compound words: the mechanical draft linked ONE token per word, so
 *     compounds lost their other halves; the skeptic flagged them as
 *     "missing". Each such extension is now put to the CURATOR as a yes/no
 *     vote — so every added link is skeptic-proposed AND curator-confirmed
 *     (two families) AND code-validated (unclaimed, in-range).
 *  2. Long-phrase curator failures (group mn10:4.9 hallucinated 59 token
 *     indexes; all dropped by invariants): unresolved words of any group
 *     with dropped-index entries are re-curated with the token list split
 *     into numbered lines (the failure was losing count on a flat list).
 *
 * Reads/updates test-fixtures/sutta-studio-alignment-golden.json in place
 * (via marks each link's provenance) and appends to the curation log.
 */

import * as fs from 'node:fs';

const CURATOR = 'google/gemini-3-flash-preview';
const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) {
  console.error('OPENROUTER_API_KEY missing');
  process.exit(1);
}

type Link = { phaseId: string; wordId: string; surface: string; tokenIdxs: number[]; via: string };
type Group = { segmentIds: string[]; phaseIds: string[]; english: string; tokens: string[]; links: Link[]; ghosts: Array<{ idx: number; token: string; kind: string }> };

const fixturePath = 'test-fixtures/sutta-studio-alignment-golden.json';
const logPath = 'docs/benchmarks/alignment-golden-curation-log.json';
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as { groups: Group[] } & Record<string, unknown>;
const log = JSON.parse(fs.readFileSync(logPath, 'utf8')) as Array<Record<string, unknown>>;
const draft = JSON.parse(fs.readFileSync('reports/sutta-studio/align-draft.json', 'utf8')) as {
  groups: Array<{ segmentIds: string[]; unresolvedWords: Array<{ phaseId: string; wordId: string; surface: string; wordClass?: string }> }>;
};
const lexGolden = JSON.parse(fs.readFileSync('test-fixtures/sutta-studio-lexicographer-golden.json', 'utf8')).lexicographer as Record<
  string,
  { senses: Array<{ wordId: string; senses: Array<{ english: string }> }> }
>;

async function chatJSON(prompt: string): Promise<Record<string, unknown>> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: CURATOR,
          temperature: 0,
          max_tokens: 4000,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'Return a single JSON object only.' },
            { role: 'user', content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(90_000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      return JSON.parse((data.choices?.[0]?.message?.content ?? '').replace(/^```(json)?|```$/g, '').trim());
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw new Error('unreachable');
}

const run = async () => {
  let extended = 0;
  let rejectedExt = 0;
  let recovered = 0;

  for (let gi = 0; gi < fixture.groups.length; gi++) {
    const g = fixture.groups[gi];
    const groupNo = gi + 1;
    const claimed = new Set(g.links.flatMap((l) => l.tokenIdxs));
    const ghostIdx = new Set(g.ghosts.map((gh) => gh.idx));

    // ── 1. skeptic-proposed extensions → curator confirmation vote ──
    const missing = log.filter((e) => e.group === groupNo && e.type === 'skeptic-suggests-missing') as Array<{
      wordId: string;
      tokenIdx: number;
      reason?: string;
    }>;
    const candidates = missing.filter(
      (m) => Number.isInteger(m.tokenIdx) && m.tokenIdx >= 0 && m.tokenIdx < g.tokens.length && !claimed.has(m.tokenIdx)
    );
    if (candidates.length) {
      const linkLines = g.links.map((l) => `  ${l.wordId} "${l.surface}" -> [${l.tokenIdxs.join(',')}] "${l.tokenIdxs.map((i) => g.tokens[i]).join(' ')}"`).join('\n');
      const candLines = candidates
        .map((c, i) => {
          const w = g.links.find((l) => l.wordId === c.wordId);
          return `  ${i}: word ${c.wordId} "${w?.surface ?? '?'}" + token [${c.tokenIdx}] "${g.tokens[c.tokenIdx]}" — reviewer's reason: ${c.reason ?? ''}`;
        })
        .join('\n');
      const vote = (await chatJSON(`A reviewer proposed ADDITIONAL word-alignment links between this Pāli phrase and Sujato's translation. Vote yes/no on each.

ENGLISH: ${g.english}
CURRENT LINKS:
${linkLines}

PROPOSED ADDITIONS:
${candLines}

Accept a proposal only if that English token genuinely translates (part of) that Pāli word. Return JSON: {"accept":[0,2,...]} (candidate numbers).`)) as { accept?: number[] };

      for (const i of vote.accept ?? []) {
        const c = candidates[i];
        if (!c || claimed.has(c.tokenIdx)) continue;
        const existing = g.links.find((l) => l.wordId === c.wordId);
        if (existing) {
          existing.tokenIdxs.push(c.tokenIdx);
          existing.tokenIdxs.sort((a, b) => a - b);
          if (existing.via === 'mechanical') existing.via = 'mechanical+extended';
        } else {
          const dw = draft.groups[gi]?.unresolvedWords.find((w) => w.wordId === c.wordId);
          if (!dw) continue;
          g.links.push({ phaseId: dw.phaseId, wordId: c.wordId, surface: dw.surface, tokenIdxs: [c.tokenIdx], via: 'skeptic+curator' });
        }
        claimed.add(c.tokenIdx);
        ghostIdx.delete(c.tokenIdx);
        extended++;
        log.push({ group: groupNo, type: 'extension-accepted', wordId: c.wordId, tokenIdx: c.tokenIdx, via: 'skeptic-proposed, curator-confirmed' });
      }
      rejectedExt += candidates.length - (vote.accept ?? []).length;
    }

    // ── 2. re-curate unresolved words of groups that had dropped indexes ──
    const hadDrops = log.some((e) => e.group === groupNo && e.type === 'idx-out-of-range');
    if (hadDrops) {
      const linkedIds = new Set(g.links.map((l) => l.wordId));
      const unresolved = (draft.groups[gi]?.unresolvedWords ?? []).filter((w) => !linkedIds.has(w.wordId));
      if (unresolved.length) {
        const tokenLines = g.tokens.map((t, i) => `${i}: "${t}"${claimed.has(i) ? ' (claimed)' : ''}`).join('\n');
        const wordLines = unresolved
          .map((w) => {
            const senses = (lexGolden[w.phaseId]?.senses ?? []).filter((e) => e.wordId === w.wordId).flatMap((e) => e.senses.map((s) => s.english)).join('; ');
            return `  ${w.wordId} "${w.surface}" senses: ${senses || '(none)'}`;
          })
          .join('\n');
        const redo = (await chatJSON(`Align these Pāli words to Sujato's English tokens. Use ONLY unclaimed token numbers from the list. A word with no counterpart gets [].

ENGLISH TOKENS (one per line):
${tokenLines}

PĀLI WORDS:
${wordLines}

Return JSON: {"links":[{"wordId":"...","tokenIdxs":[...]}]}`)) as { links?: Array<{ wordId: string; tokenIdxs: number[] }> };

        for (const cl of redo.links ?? []) {
          const w = unresolved.find((u) => u.wordId === cl.wordId);
          if (!w) continue;
          const idxs = (cl.tokenIdxs ?? []).filter((i) => Number.isInteger(i) && i >= 0 && i < g.tokens.length && !claimed.has(i));
          if (!idxs.length) continue;
          idxs.forEach((i) => {
            claimed.add(i);
            ghostIdx.delete(i);
          });
          g.links.push({ phaseId: w.phaseId, wordId: w.wordId, surface: w.surface, tokenIdxs: idxs.sort((a, b) => a - b), via: 'curated-retry' });
          recovered++;
          log.push({ group: groupNo, type: 'retry-recovered', wordId: w.wordId, tokenIdxs: idxs });
        }
      }
    }

    g.ghosts = g.ghosts.filter((gh) => ghostIdx.has(gh.idx));
    if (candidates?.length || hadDrops) console.log(`[${groupNo}] extensions/retries applied`);
  }

  (fixture as Record<string, unknown>)._refinedAt = new Date().toISOString();
  fs.writeFileSync(fixturePath, JSON.stringify(fixture, null, 2));
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
  console.log(`\nextensions accepted: ${extended} (rejected ${rejectedExt}) | group-22-class recoveries: ${recovered}`);
  console.log('REFINE COMPLETE');
};

run().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
