# Plan — Polyglot foundations: parallel-text sidebar

**Status:** ready to claim
**Estimated effort:** 4–8 hours
**Independence:** high — additive UI panel + adapter extension; no overlap with cost-preview or refrain-detector.

## Context first — read this before claiming

`docs/sutta-studio/POLYGLOT.md` is a charter, not a backlog. It honestly
estimates 6–10 working weeks to do **one Heart Sutra passage** with
three lenses (Sanskrit + Chinese + Tibetan, decomposition + concept
registry). **This plan is not that.**

This plan is the smallest concrete step that makes the polyglot vision
visible to the user without committing to the lens-implementation work:
**show the SuttaCentral parallels** (Pāli + Chinese + Sanskrit + Tibetan
where available) as plain text alongside the current bilingual reader.
No decomposition. No alignment. No concept registry. Just: *here are
the other-language witnesses for this sutta, fetched on demand, rendered
in a sidebar.*

This is the foundation that future polyglot lens work attaches to.

## Goal

Add a "Parallels" panel to the Sutta Studio reader that, when opened,
fetches the list of parallels from SuttaCentral's `/api/parallels/<uid>`
and lets the user load each parallel's root text into a side-by-side
view next to the current sutta.

For MN10, the parallels endpoint returns at least:
- `dn22`, `mn9`, `sn47.1` (Pāli)
- `ea12.1`, `ma98`, `ma31` (Literary Chinese / lzh)
- `sht-sutta11` (Sanskrit fragment from Turfan)

The plan is to surface that list and render the chosen parallel's root
text plain. Bilingual translations exist for many of these (especially
the Chinese parallels — Bhante Anālayo, Charles Patton) and should be
fetched and shown when available.

## Non-goals (DO NOT DO)

- No Sanskrit decomposition (sandhi / compound / morphology)
- No Chinese character / term segmentation
- No Tibetan syllable analysis
- No concept registry / alignment between languages
- No new schema types for `TextLayer`, `TextUnit`, `Alignment` — those
  are in `POLYGLOT.md` and stay parked
- No `DharmaNexus` / MITRA integration — also parked per `AMORTIZATION.md`
- No editing or storing parallels as full chapters (they're a view layer)

## Architecture sketch

1. **Adapter extension** — extend `SuttaCentralAdapter` in
   `services/scraping/siteAdapters.ts` with a static / standalone helper:
   ```ts
   async function fetchParallels(uid: string): Promise<ParallelInfo[]>
   ```
   Hits `https://suttacentral.net/api/parallels/<uid>` and returns
   normalized `{uid, rootLang, type ('full'|'resembling'|'mention'), pali?, ...}`.

2. **Parallel-text fetch** — for a chosen parallel, fetch its root text
   via the existing Bilara endpoint pattern
   (`/api/bilarasuttas/<uid>/<author>` or just `/api/suttas/<uid>` for a
   minimal text version). Use the existing CORS proxy worker — it
   already routes SC traffic (see `services/scraping/proxy.ts`).

3. **UI: `ParallelsPanel` component** — a collapsible side panel in
   `components/sutta-studio/` showing:
   - **Header**: "Parallels (N)" with a count
   - **List**: each parallel as a row — `<uid>` · `<root_lang>` · type
     badge · "Open" button
   - **Open state**: when a parallel is open, show its plain text in
     a scrollable column to the right of (or below) the main reader

4. **State** — store the currently-open parallel uid in component state
   only (NOT in the IDB chapter store; these aren't user chapters).

## Files to touch

| Path | Change |
|---|---|
| `services/scraping/scParallels.ts` | NEW — `fetchParallels(uid)` + `fetchParallelText(uid, lang?)`. Pure functions, mockable in tests. |
| `services/scraping/siteAdapters.ts` | (Optional) re-export the new helpers |
| `types/suttaStudio.ts` | Add `ParallelInfo` type |
| `components/sutta-studio/ParallelsPanel.tsx` | NEW — collapsible panel UI |
| `components/sutta-studio/SuttaStudioApp.tsx` | Mount the panel; pass current sutta uid |
| `tests/services/scraping/scParallels.test.ts` | NEW — mock fetch, assert shape on the canned MN10 response (see "Useful context" below for the canned shape) |

## Validation gate (must pass before opening PR)

- [ ] `npx vitest run tests/services/scraping/scParallels.test.ts` — green
- [ ] `npx vitest run tests/services/` — no regression
- [ ] Manual: `/sutta/mn10` → open Parallels panel → 13+ parallels listed including at least one of each: pli, lzh, san.
- [ ] Manual: click `ea12.1` (lzh) — Chinese text renders, font is readable (handle CJK font fallback if needed).
- [ ] Manual: click `sht-sutta11` (san) — Sanskrit fragment renders. If
  the fragment is romanized (IAST), display it as-is; if Devanāgarī,
  display as-is. Either is fine; no transliteration in this PR.
- [ ] Manual: `/sutta/dn22` → panel shows parallels (DN22 has many).
- [ ] Manual: a sutta with zero parallels (pick a kv or pet entry) —
  panel says "No parallels available" gracefully.

## How to start

```bash
mkdir -p ../LexiconForge.worktrees
git worktree add ../LexiconForge.worktrees/codex-polyglot-parallels -b feat/codex-polyglot-parallels main
cd ../LexiconForge.worktrees/codex-polyglot-parallels
ln -s "/Users/aditya/Documents/Ongoing Local/LexiconForge/node_modules" node_modules

# Peek at the parallels endpoint shape:
curl -s "https://suttacentral.net/api/parallels/mn10" | head -200
```

## Useful context

- **Existing CORS proxy** already handles SuttaCentral — see
  `services/scraping/proxy.ts` and the existing fetch usage in
  `services/scraping/siteAdapters.ts:SuttaCentralAdapter.fetchSutta`.
  Use the same proxy path; do NOT direct-fetch unless you've confirmed
  the response shape doesn't change.

- **SC `/api/parallels/<uid>` shape** (verified 2026-05-15 on `mn10`):
  Returns a nested array. Each leaf node has `root_lang`, `uid`,
  `acronym`, `type` (e.g. `'full'`, `'resembling'`). Walk it as a tree;
  flatten to a list of `{uid, rootLang, type, isPali}`.

- **CJK font** — the reader likely already pulls a CJK font for the
  84000 adapter (Tibetan / Chinese). Check `index.html` and
  `tailwind.config.ts`; reuse what's there rather than adding new font
  loads.

- **What "polyglot" means here is deliberately minimal.** Resist the
  pull to also wire alignment, term recognition, or a lens. The goal
  of this PR is *making the parallels visible to the user with zero
  new schema*. The schema work is in POLYGLOT.md and waits for an
  explicit roadmap commitment.

## Out-of-scope follow-ups (do NOT bundle)

- Sandhi / compound analysis for Sanskrit (`POLYGLOT.md` §2.2)
- Chinese term segmentation + character analysis (`POLYGLOG.md` §2.3)
- Tibetan syllable stack + Wylie (`POLYGLOT.md` §2.4)
- Concept registry (`POLYGLOT.md` §4 MVP)
- Alignment between parallels at the sentence/term level
- Storing parallels as user chapters in IDB
- DharmaNexus / MITRA cross-language search (parked in `AMORTIZATION.md`)
- Editing parallels in the curation flow
