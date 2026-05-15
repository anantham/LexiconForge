# Plan — Refrain detector post-pass

**Status:** ready to claim
**Estimated effort:** 2–3 hours
**Independence:** high — additive post-pass + reader affordance; no overlap with cost-preview or polyglot plans.

## Goal

After a sutta compile finishes, surface repeated Pāli segments as a
"this phrase appears N times" affordance. MN10's refrain pattern
(`Iti ajjhattaṁ vā kāye kāyānupassī viharati, bahiddhā vā ...`)
repeats verbatim across observation domains; making the repetition
visible reframes the structure from "long discourse" to "patterned
contemplation manual."

## Non-goals (DO NOT DO)

- Cross-sutta refrain detection (single-sutta only — DN22's reuse of
  MN10 segments is interesting but a separate problem)
- Fuzzy / partial matching — only exact-Pāli dedup after normalization
- Reordering content in the reader to "fold" refrains — only annotate
- LLM-driven pattern recognition — purely deterministic count

## Architecture sketch

Post-pass runs after the compile loop completes, before the packet is
finalized:

1. Walk `packet.phases[].segments[]`, collect `{phaseIndex, segmentIndex, paliText}`
2. Normalize Pāli (trim, lowercase, collapse whitespace) and group by hash.
3. Any group with `count ≥ 2` becomes a `RefrainGroup`:
   ```ts
   type RefrainGroup = {
     id: string;                    // stable hash-based id
     normalizedPali: string;
     surfaceSample: string;         // first occurrence's surface form (preserves diacritics)
     occurrences: Array<{ phaseIndex: number; segmentIndex: number }>;
   };
   ```
4. Attach `packet.refrains: RefrainGroup[]` on the compiled packet.
5. Each segment that participates also gets `segment.refrainGroupId?: string`
   so the reader can look up the count without re-grouping.

## Reader affordance

When a segment has `refrainGroupId`, render a subtle indicator (tiny
marginal "×N" badge or a softer-color underline) on hover/focus. No
modal, no panel — the existing hover-tooltip surface is enough:

> "This phrase appears 4 times in MN10 — also at phase 3, 4, 6."

The locations list links to the other phase indices (anchor-scroll).

## Files to touch

| Path | Change |
|---|---|
| `services/compiler/postPasses/refrainDetector.ts` | NEW — pure function `detectRefrains(packet) → RefrainGroup[]` |
| `services/compiler/index.ts` | After per-phase loop, before final `onProgress({stage:'complete'})`, call `detectRefrains` and attach to packet |
| `types/suttaStudio.ts` | Add `RefrainGroup` type and `refrains?: RefrainGroup[]` + `segment.refrainGroupId?: string` |
| `components/sutta-studio/Segment.tsx` (or wherever segments render) | If `refrainGroupId` present, render the affordance |
| `tests/services/compiler/postPasses/refrainDetector.test.ts` | NEW — unit tests on a synthetic 3-phase packet with one 4× refrain |

The post-passes folder already exists at
`services/compiler/postPasses/` (check `ls` there) — follow whatever
naming convention is already in use.

## Validation gate (must pass before opening PR)

- [ ] `npx vitest run tests/services/compiler/postPasses/refrainDetector.test.ts` — green
- [ ] `npx vitest run tests/services/` — no regression
- [ ] Manual smoke on MN10: open in reader, hover one of the
  `Iti ajjhattaṁ vā ...` segments — affordance shows count ≥ 4.
- [ ] Manual smoke on a sutta with no refrains (pick a short one) —
  no affordance rendered.
- [ ] Performance: post-pass adds < 50ms to compile total (it's a
  single linear scan; trivial).

## How to start

```bash
mkdir -p ../LexiconForge.worktrees
git worktree add ../LexiconForge.worktrees/codex-refrain-detector -b feat/codex-refrain-detector main
cd ../LexiconForge.worktrees/codex-refrain-detector
ln -s "/Users/aditya/Documents/Ongoing Local/LexiconForge/node_modules" node_modules
ls services/compiler/postPasses/   # see existing post-pass pattern
```

## Useful context

- Existing post-passes do similar walks — search
  `services/compiler/postPasses/` for the typical shape (pure function,
  takes packet, returns annotations).
- Pāli normalization helper: there's already at least one in the
  codebase. Grep for `normalizePali|hashPaliText` — `hashPaliText` in
  `services/suttaStudioPipelineCache.ts` is the right shape to copy
  (don't import the cache module directly — make a small standalone
  normalizer in the post-pass).
- The packet shape `DeepLoomPacket` is in `types/suttaStudio.ts`.

## Out-of-scope follow-ups

- Cross-sutta refrain stats (would require packet history corpus)
- Pattern-with-variable detection ("X-ānupassī viharati" with X varying)
- "Fold" / collapse UI to hide redundant phases
- Linking refrains to the formula cache (L4 in `SUTTA-006`) — that's
  the design destination, but the schema there isn't ready
