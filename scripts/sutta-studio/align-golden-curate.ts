/**
 * SUTTA-013 part 2, stage 2 — model curation of the alignment residue.
 *
 * Takes the mechanical draft (align-golden-draft.ts) and has models
 * adjudicate ONLY what the dictionary could not: a non-Claude CURATOR
 * (gemini-3-flash) proposes links for unresolved words and ghost tags for
 * unclaimed tokens; a different-family SKEPTIC (grok-4.20, the board's
 * strongest Pāli analyst) attacks the full proposed set. The assembly step
 * enforces invariants IN CODE (a token belongs to at most one word, ids
 * exist, indexes in range): skeptics miss things, invariant checks don't.
 *
 * Provenance ends up layered: most links = dictionary + string match;
 * residue links = curator + survived skeptic; every skeptic objection and
 * every dropped proposal is logged. Mechanical links are immutable — a
 * skeptic objection to one is LOGGED LOUDLY for human review, never applied.
 *
 * Usage: npx tsx --env-file=.env.local scripts/sutta-studio/align-golden-curate.ts
 * Writes: test-fixtures/sutta-studio-alignment-golden.json
 *         docs/benchmarks/alignment-golden-curation-log.json
 * Completion marker: CURATION COMPLETE
 */

import * as fs from 'node:fs';

const CURATOR = 'google/gemini-3-flash-preview';
const SKEPTIC = 'x-ai/grok-4.20';
const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) {
  console.error('OPENROUTER_API_KEY missing — run with --env-file=.env.local');
  process.exit(1);
}

type DraftLink = { phaseId: string; wordId: string; surface: string; tokenIdx: number; token: string; via: string };
type Group = {
  segmentIds: string[];
  phaseIds: string[];
  english: string;
  tokens: string[];
  links: DraftLink[];
  unresolvedWords: Array<{ phaseId: string; wordId: string; surface: string; wordClass?: string }>;
  unclaimedTokens: Array<{ idx: number; token: string }>;
};

const draft = JSON.parse(fs.readFileSync('reports/sutta-studio/align-draft.json', 'utf8')) as { groups: Group[] };
const lexGolden = JSON.parse(fs.readFileSync('test-fixtures/sutta-studio-lexicographer-golden.json', 'utf8')).lexicographer as Record<
  string,
  { senses: Array<{ wordId: string; senses: Array<{ english: string }> }> }
>;

const sensesFor = (phaseId: string, wordId: string): string =>
  (lexGolden[phaseId]?.senses ?? [])
    .filter((e) => e.wordId === wordId)
    .flatMap((e) => e.senses.map((s) => s.english))
    .join('; ') || '(no golden senses)';

async function chatJSON(model: string, prompt: string, maxTokens = 4000): Promise<Record<string, unknown>> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'Return a single JSON object only. No prose, no code fences.' },
            { role: 'user', content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(90_000),
      });
      if (!resp.ok) throw new Error(`${model} HTTP ${resp.status}`);
      const data = await resp.json();
      const text: string = data.choices?.[0]?.message?.content ?? '';
      return JSON.parse(text.replace(/^```(json)?|```$/g, '').trim());
    } catch (e) {
      if (attempt === 3) throw e;
      console.log(`  retry ${attempt} for ${model}: ${e instanceof Error ? e.message : e}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw new Error('unreachable');
}

type FinalLink = { phaseId: string; wordId: string; surface: string; tokenIdxs: number[]; via: 'mechanical' | 'curated' };
type Ghost = { idx: number; token: string; kind: string };

const finalGroups: Array<{ segmentIds: string[]; phaseIds: string[]; english: string; tokens: string[]; links: FinalLink[]; ghosts: Ghost[] }> = [];
const log: Array<Record<string, unknown>> = [];

const run = async () => {
  let gi = 0;
  for (const g of draft.groups) {
    gi++;
    const wordLines = g.unresolvedWords
      .map((w) => `  ${w.wordId} "${w.surface}" [${w.wordClass || '?'}] senses: ${sensesFor(w.phaseId, w.wordId)}`)
      .join('\n');
    const tokenLines = g.tokens.map((t, i) => `${i}:"${t}"`).join(' ');
    const mechLines = g.links.map((l) => `  ${l.wordId} "${l.surface}" -> ${l.tokenIdx}:"${l.token}"`).join('\n') || '  (none)';

    const curatorPrompt = `You are aligning a Pāli phrase with Bhikkhu Sujato's English translation, word to word.

ENGLISH TOKENS (index:"token"):
${tokenLines}

ALREADY-DECIDED LINKS (dictionary-certain, immutable):
${mechLines}

UNRESOLVED PĀLI WORDS (with their curated glosses as hints):
${wordLines}

TASK:
1) For each unresolved Pāli word, list the English token indexes that translate it (0, 1, or several; only tokens not already claimed above). If the translation genuinely has no counterpart, use [].
2) Every remaining unclaimed English token must then be classified as a ghost: "required" (pure English grammar: articles, copulas, auxiliaries, punctuation-bearing function words) or "interpretive" (the translator's added interpretation).

Return JSON: {"links":[{"wordId":"...","tokenIdxs":[...]}],"ghosts":[{"idx":0,"kind":"required"}]}`;

    const curated = (await chatJSON(CURATOR, curatorPrompt)) as {
      links?: Array<{ wordId: string; tokenIdxs: number[] }>;
      ghosts?: Array<{ idx: number; kind: string }>;
    };

    // assemble proposal for the skeptic
    const proposalLines = [
      ...g.links.map((l) => `${l.wordId} "${l.surface}" -> [${l.tokenIdx}] "${l.token}" (dictionary)`),
      ...(curated.links ?? []).flatMap((cl) => {
        const w = g.unresolvedWords.find((u) => u.wordId === cl.wordId);
        return w ? [`${cl.wordId} "${w.surface}" -> [${cl.tokenIdxs.join(',')}] "${cl.tokenIdxs.map((i) => g.tokens[i]).join(' ')}" (curated)`] : [];
      }),
    ].join('\n');

    const skepticPrompt = `You are a Pāli philologist attacking a proposed word-alignment between a Pāli phrase and Sujato's translation. Find genuine errors only.

PĀLI WORDS: ${[...g.links.map((l) => l.surface), ...g.unresolvedWords.map((w) => w.surface)].join(' ')}
ENGLISH: ${g.english}
ENGLISH TOKENS: ${tokenLines}

PROPOSED LINKS:
${proposalLines}

Return JSON: {"wrong":[{"wordId":"...","tokenIdx":0,"reason":"..."}],"missing":[{"wordId":"...","tokenIdx":0,"reason":"..."}]} — empty arrays if the proposal is sound.`;

    const verdict = (await chatJSON(SKEPTIC, skepticPrompt)) as {
      wrong?: Array<{ wordId: string; tokenIdx: number; reason: string }>;
      missing?: Array<{ wordId: string; tokenIdx: number; reason: string }>;
    };

    // ── assembly with invariants in code ──
    const claimed = new Set<number>(g.links.map((l) => l.tokenIdx));
    const wrongSet = new Set((verdict.wrong ?? []).map((w) => `${w.wordId}:${w.tokenIdx}`));
    const links: FinalLink[] = g.links.map((l) => ({ phaseId: l.phaseId, wordId: l.wordId, surface: l.surface, tokenIdxs: [l.tokenIdx], via: 'mechanical' as const }));

    for (const w of verdict.wrong ?? []) {
      if (g.links.some((l) => l.wordId === w.wordId && l.tokenIdx === w.tokenIdx)) {
        log.push({ group: gi, type: 'SKEPTIC-OBJECTS-TO-MECHANICAL', ...w, action: 'kept — needs human review' });
      }
    }

    for (const cl of curated.links ?? []) {
      const w = g.unresolvedWords.find((u) => u.wordId === cl.wordId);
      if (!w) {
        log.push({ group: gi, type: 'invalid-wordId', wordId: cl.wordId, action: 'dropped' });
        continue;
      }
      const idxs = (cl.tokenIdxs ?? []).filter((i) => {
        if (!Number.isInteger(i) || i < 0 || i >= g.tokens.length) {
          log.push({ group: gi, type: 'idx-out-of-range', wordId: cl.wordId, idx: i, action: 'dropped' });
          return false;
        }
        if (claimed.has(i)) {
          log.push({ group: gi, type: 'token-already-claimed', wordId: cl.wordId, idx: i, action: 'dropped' });
          return false;
        }
        if (wrongSet.has(`${cl.wordId}:${i}`)) {
          log.push({ group: gi, type: 'skeptic-rejected', wordId: cl.wordId, idx: i, reason: (verdict.wrong ?? []).find((x) => x.wordId === cl.wordId && x.tokenIdx === i)?.reason, action: 'dropped' });
          return false;
        }
        return true;
      });
      idxs.forEach((i) => claimed.add(i));
      if (idxs.length > 0) links.push({ phaseId: w.phaseId, wordId: w.wordId, surface: w.surface, tokenIdxs: idxs, via: 'curated' });
    }

    const ghosts: Ghost[] = (curated.ghosts ?? [])
      .filter((gh) => Number.isInteger(gh.idx) && gh.idx >= 0 && gh.idx < g.tokens.length && !claimed.has(gh.idx))
      .map((gh) => ({ idx: gh.idx, token: g.tokens[gh.idx], kind: gh.kind === 'interpretive' ? 'interpretive' : 'required' }));

    for (const m of verdict.missing ?? []) log.push({ group: gi, type: 'skeptic-suggests-missing', ...m, action: 'logged only' });

    const unaccounted = g.tokens.map((_, i) => i).filter((i) => !claimed.has(i) && !ghosts.some((gh) => gh.idx === i));
    if (unaccounted.length) log.push({ group: gi, type: 'tokens-unaccounted', idxs: unaccounted, tokens: unaccounted.map((i) => g.tokens[i]), action: 'left unclassified — human review' });

    finalGroups.push({ segmentIds: g.segmentIds, phaseIds: g.phaseIds, english: g.english, tokens: g.tokens, links, ghosts });
    console.log(`[${gi}/${draft.groups.length}] ${g.segmentIds.join('+')} — +${links.length - g.links.length} curated links, ${ghosts.length} ghosts, ${(verdict.wrong ?? []).length} objections`);
  }

  fs.writeFileSync(
    'test-fixtures/sutta-studio-alignment-golden.json',
    JSON.stringify(
      {
        _description: 'SUTTA-013 alignment golden: (Pāli word ↔ Sujato English token) links per segment group. Provenance layered: mechanical = dictionary gloss + unambiguous string match (align-golden-draft.ts); curated = gemini-3-flash proposal surviving a grok-4.20 skeptic, invariants enforced in code (align-golden-curate.ts). See docs/benchmarks/alignment-golden-curation-log.json.',
        _generatedAt: new Date().toISOString(),
        _curator: CURATOR,
        _skeptic: SKEPTIC,
        groups: finalGroups,
      },
      null,
      2
    )
  );
  fs.writeFileSync('docs/benchmarks/alignment-golden-curation-log.json', JSON.stringify(log, null, 2));

  const mech = finalGroups.reduce((a, g) => a + g.links.filter((l) => l.via === 'mechanical').length, 0);
  const cur = finalGroups.reduce((a, g) => a + g.links.filter((l) => l.via === 'curated').length, 0);
  const gh = finalGroups.reduce((a, g) => a + g.ghosts.length, 0);
  console.log(`\nlinks: ${mech} mechanical + ${cur} curated | ghosts: ${gh} | log entries: ${log.length}`);
  console.log('CURATION COMPLETE');
};

run().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
