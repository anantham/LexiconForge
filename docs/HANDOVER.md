# Handover: 2026-05-16 (Liturgy reader — MAPLE complete, multi-sangha architecture, Bodhi Sangha pending)

> **Worktree:** `../LexiconForge.worktrees/opus-liturgy-reader/` on branch
> `feat/opus-liturgy-reader`. 28 commits unpushed.

## Session summary

Built the MAPLE liturgy reader through to a multi-sangha architecture:
`/liturgy` (sangha picker) → `/liturgy/<sangha>` (chants with daily-rhythm
timeline) → `/liturgy/<sangha>/<chant>` (chant page with multi-script +
multi-witness + alignment arrows). 28 commits on the worktree branch. 7
MAPLE chants complete (Morning Chants, Enmē Jikku Kannon Gyō, Sho Sai
Myō Kichijō Darani, Heart Sutra, Jade Method, Oṃ Maṇi Padme Hūṃ,
Bodhicitta Dedication). Bodhi Sangha registered in `sanghas.ts` but 0
chants authored — source booklet extracted to
`/tmp/bodhi-chants/IMG_2340.jpg`–`IMG_2356.jpg`. Audit: 152 tests, 140
passing, 12 expected skips.

## Commits this session (most recent first)

- `1f3c789` fix: general arrow distribution + chant-page cleanup
- `6312108` feat: auto-distribute alignment arrows across Pāli morphemes
- `bdb7e13` fix: rewrite Precept 4 note + strip em-dashes from precept notes
- `037e038` feat: notes on precepts 1 + 4; remove unsourced 3× commentary
- `46d2dc2` feat: daily rhythm becomes the morning-service nav
- `aa11f7e` feat: footer "Translations" row — clickable links
- `14d3108` fix: alignment arrows survive async font-load layout shifts
- `17bcfd4` feat: MAPLE morning service complete — EJKG + Sho Sai + schedule
- `8ecbb0b` feat: multi-sangha architecture — /liturgy/<sangha>/<chant>
- `849dc76` feat: MAPLE — Jade Method + Bodhicitta Dedication
- `c29d09e` feat: transliteration line + de-duplicated tooltip pron
- `424fc31` feat: Heart Sutra result-segment Tibetan — Kangyur Toh 21
- `51695c6` feat: Heart Sutra Tibetan — tokens + per-syllable morphemes
- `7e03f17` feat: OM MANI PADME HUM — full polyglot on the main segment
- `a06ef64` feat: per-character Chinese hover — phonetic loans + semantic doublets
- `c692866` feat: tokens hints + scriptAlts — multi-char CJK tooltips
- `9f5358d` feat: full Sanskrit tooltips + CJK/Tibetan tokenisation
- `8c75e1c` feat: MAPLE / Sheng-yen Heart Sutra witness — primary
- `98f974d` feat: Heart Sutra — polyglot reader + sound-formula shape
- `144f22a` feat: Oṃ Maṇi Padme Hūṃ — multi-tradition mantra reader
- + 8 earlier commits (morpheme-origin arrows, witness dots, refrain accents, …)

**PUSHED: no.** Wait for explicit user approval before `git push`.

## Pending threads

### Continue immediately

1. **Bodhi Sangha authoring** (TaskList #35). Sangha registered. Plan A
   agreed earlier in session: ship the Bodhi-Sangha Heart Sutra (new doc,
   distinct English from MAPLE/Sheng-yen) + Four Great Vows (kanji +
   furigana + English) as proof of the multi-sangha architecture. Inventory
   of remaining chants (13 total) is in the project memory.

2. **Em-dash sweep**. User asked "remove all the m dashes anywhere".
   Only the 5 precept notes were cleaned this session. **320 em-dashes
   remain** in user-facing glosses + commentaries across
   `data/liturgy/*.ts`. User picked precept-notes-only when asked for
   scope, but the broader ask is still open.

### Blocked

1. **Canonical citation for "Chanted 3× = body/speech/mind dedication"**.
   Commentary removed from morning-chants.ts with a code marker. Re-add
   if user surfaces an authoritative source (Vinaya commentary,
   Visuddhimagga, Khuddakapatha Atthakathā).

### Deferred

1. **Per-script morphemes for remaining Pali compounds** (pāṇātipātā,
   kāmesu micchācārā, surāmerayamajjapamādaṭṭhānā). General proportional
   distribution covers them adequately for now.

2. **Per-script alignTo** (Conze's alignment → Chinese character
   positions, etc.). General proportional fallback (commit `1f3c789`)
   makes this less urgent; full per-script authoring is still a real
   feature.

3. **Sangha schedule expansion**. MAPLE has 3 anchor times. Other times
   of day (lunch, work-period, evening sit) not captured.

4. **Sho Sai title canonical character**. Used `消災主` (master) per user;
   more common form may be `消災呪` (incantation). Verify with Soto Zen
   liturgy source.

5. **Task #14**: Rename demoPacket.json → content/references/sutta/mn10.json.
   Pre-existing pending, 8 consumers, unrelated to liturgy.

### Carried forward

The prior handover in this file (2026-05-14, below) was for the Sutta
Studio GROUNDING / DN22 pilot session on a different worktree. Those
threads are not in scope for the current liturgy-reader work but are
preserved below for that session's continuation.

## Key context

- **Branch + worktree:** `feat/opus-liturgy-reader` at
  `../LexiconForge.worktrees/opus-liturgy-reader/`.
- **Audit test:** `tests/components/liturgy/alignment-audit.test.ts`.
- **Architecture files to read first:** `types/liturgy.ts`,
  `data/liturgy/sanghas.ts`, `data/liturgy/index.ts`,
  `data/liturgy/morning-chants.ts` (most complete polyglot example),
  `components/liturgy/shapes/TripleScriptWitness.tsx` (the main renderer
  with inline comments explaining the layered defenses).
- **User feedback patterns** (codified in
  `~/.claude/projects/.../memory/feedback_liturgy_voice.md`):
  - No em-dashes anywhere.
  - No license posture strings visible in attribution rows.
  - No redundant title blocks.
  - First-person reflective voice for chant notes.
  - When user says "I see this throughout", look for the GENERAL fix
    (Goodharting awareness).

## Operator cleanup

- `Bodhi Sanga Chants/` folder + `takeout-3-001.zip` sit in the
  LexiconForge repo root (untracked). Decide whether to gitignore /
  move / delete.
- `/tmp/bodhi-chants/IMG_*.jpg` will eventually be wiped by macOS.
  Move to a stable location before authoring Bodhi Sangha chants.
- 28 unpushed commits on `feat/opus-liturgy-reader`. Push only with
  explicit user approval.

## Learnings captured

- [x] Project memory: `project_liturgy_reader.md` — architecture, state,
  open limitations.
- [x] Feedback memory: `feedback_liturgy_voice.md` — em-dashes, license
  clutter, voice, Goodharting awareness.
- [x] `MEMORY.md` index updated.

## Resume instructions

1. Read the two new memory files before touching the worktree.
2. For Bodhi Sangha authoring: source images at
   `/tmp/bodhi-chants/IMG_2340.jpg`–`IMG_2356.jpg`. Author following the
   `morning-chants.ts` pattern.
3. For em-dash sweep: `grep -n "—" data/liturgy/*.ts`. Ask user for
   scope before executing.
4. Audit gate: `npx vitest run tests/components/liturgy/` — must stay at
   140 passing, 12 expected skips after any change.

---
*Handover by Claude Opus 4.7 at ~95% context*

---

# Handover: 2026-05-14 (late — GROUNDING completion + DN22 pilot + Vism research win)

> Replaces the earlier 2026-05-14 handover. Two PRs merged this session
> (#53, #54). One PR open (#55 — DN22 pilot fixes).
>
> **Worktree:** `../LexiconForge.worktrees/opus-dn22-pilot/` on branch
> `feat/opus-dn22-pilot` (PR #55). Vite running PID 74780 from that worktree
> on port 5180.

## Session summary

Three threads ran end-to-end:

1. **GROUNDING architecture completed through Phase 5** — Phase 2 (TS provider + groundingPass + tests), Phase 2.5 (live compiler wiring), Phase 3 (translator-bank via SC Bilara), Phase 5 (UI grounded-vs-interpretive affordance). Phase 4 (commentarial-gloss) deferred but **now unblocked by research find**.

2. **v12-b prompt with sliding-window prior-phase context** — closes the cross-phase narrative gap that v11 couldn't bridge. Bumped prompt version. Auto-grounding fires on freshly-compiled phases.

3. **DN22 pilot** — first attempt to validate the amortization claim on a new sutta. Surfaced 3 real bugs (Tooltip infinite loop, null fallback, phaseLimit scope) — all fixed in PR #55. Verifying compile end-to-end is the next-session smoke test.

4. **Deep research prompt** ran (`RESEARCH_PROMPT.md`) — yielded the **Eudoxos / edhamma Visuddhimagga TEI** breakthrough. Phase 4 (commentarial-gloss seed) collapses from 6-10 hours to ~2 hours. See `docs/sutta-studio/RESEARCH_RESULTS.md`.

## Commits this session (on main, all merged)

- `072f351` — Merge PR #53 (GROUNDING bootstrap)
- `559307e` — docs(worklog): mark 2026-05-14 GROUNDING+UX session merged
- `af58a0f` — Merge PR #54 (GROUNDING Phase 2/2.5/3/5 + v12-b + registry expansion)
- `99d805d` — docs(worklog): mark 2026-05-14 GROUNDING-completion session
- `659ec5b` — fix: audit panel content-driven height (no blank vertical space)
- `9fcb46f` — docs: RESEARCH_PROMPT.md (deep research prompt artifact)
- `31919c3` — docs(worklog): mark 2026-05-14 session merged via PR #54
- *(in progress, this commit)* — docs: RESEARCH_RESULTS.md + AMORTIZATION.md updates + HANDOVER.md (this file)

## Commits on feat/opus-dn22-pilot (PR #55, NOT yet merged)

- `1b4ac65` feat: `?phaseLimit=N` URL param — pilot-mode compilation cap
- `76ea314` fix: null-safe chapter access in SuttaStudioFallback (blank screen fix)
- `767e4f6` fix: Tooltip infinite render loop (useLayoutEffect deps)
- `5e00c1b` fix: phaseLimit truncation also applies to runSkeletonPass output

PR: https://github.com/anantham/LexiconForge/pull/55

## Pending Threads

### Continue Immediately

1. **Verify DN22 pilot end-to-end** — Tooltip + phaseLimit fixes from PR #55 should make `/sutta/dn22?phaseLimit=4` compile cleanly in ~3 min / ~$0.10. Empirically validates the amortization claim. Once it lands, **merge PR #55** and move on.

2. **GROUNDING Phase 4 wiring via Eudoxos** — research find at `github.com/edhamma/vism/vism/gloss.tei` (116 KB). Pre-parsed Pāli term → Visuddhimagga location mapping. ~2 hr to ship. See RESEARCH_RESULTS.md for the 6-step implementation plan. **HIGHEST-LEVERAGE move now.**

3. **Persistent segmentCache across refreshes and suttas** — user observed (correctly) that the per-phase LLM cache is in-memory only. Persist to IndexedDB (mirror MorphologyCache pattern in `services/suttaStudioPipelineCache.ts`). ~2-4 hr. Big win: DN22 first-compile cost drops because verbatim-MN10 segments cache-hit; refresh during compile no longer loses prior work.

### Blocked

None currently.

### Deferred

1. **DharmaNexus / MITRA framework** — 1.74M cross-language sentence-aligned pairs + fine-tuned Gemma 2 LLM. Verified live but parked until polyglot reader is committed (POLYGLOT.md §4). ~25-40 hr integration; most value is in polyglot scope.

2. **Compiler consolidation Phase 3/4** — single LLM caller + shim cleanup. Low urgency; not blocking.

3. **Path B procedural phases** — 31 remaining. Now mostly auto-grounded via translator-bank, hand-polish would add cross-phase narrative + voice but not chip count. Reader-facing value low per hour.

4. **Refrain-detector post-pass** — independent infra (~2-3 hr). Adds "this phrase appears N times" affordance.

5. **Cost-aware preview-and-confirm UX** — preview first 4 phases, show estimate for remaining, ask user to continue. Needs per-phase cost tracking + pause/resume UI. ~2-4 hr.

## Key Context

### What this context uniquely captured (now in durable artifacts)

- **PR #55 with 4 bug fixes** — each commit message documents the symptom + root cause
- **RESEARCH_RESULTS.md** — Eudoxos breakthrough captured with exact file paths in the repo (`vism/gloss.tei`), licensing caveat, and 6-step wiring plan
- **AMORTIZATION.md backlog updated** — Eudoxos green-lit, MITRA parked, HKU + Pali Translation Project annotated with verified status
- **Smart-caching-across-suttas observation** — Pending Thread #3 with implementation pattern (mirror MorphologyCache)

### Architecture state (snapshot)

- **GROUNDING:** Phases 0/1/1.5/2/2.5/3/5 shipped. Phase 4 unblocked, ready to ship in ~2 hr.
- **Registry:** 11 contested-terms entries covering MN10 vocab + cross-sutta vocab (sati, dukkha, nibbāna, ñāya, satipaṭṭhāna, ātāpī, sampajāno, vedanā, citta, dhammā, kāyānupassī)
- **v12 prompt:** sliding-window prior-phase context. Future v12 compilations will write cross-phase observations automatically.
- **MN10:** ALL 39 phases grounded (every phase has ≥1 citation chip). 4 phases hand-polished (2/5/6/7).
- **DN22:** pilot in progress — compile pending verification with PR #55 fixes.

### Non-obvious bugs the fresh agent should know

- **Tooltip useLayoutEffect MUST NOT include `leftPx` in deps** — caused infinite loop (set→measure→set). Fixed in `767e4f6`. Pattern: any state set inside an effect should NOT be in the effect's deps unless the change-detection guards re-entry.
- **`shouldRecompile = isStaleBuild`** triggers full recompile if `progress.state !== 'complete'` and last update > 3 min ago. Mid-flight crashes leave packets in this state. Persistent segmentCache (Thread #3) would mitigate.
- **`phaseLimit` URL param** truncates phaseSkeleton ONLY after both `runSkeletonPass` AND `chunkPhases` paths. Fixed in `5e00c1b`. Don't add scoped truncation in the future; always after the assignment.

### Eudoxos licensing — be careful

`github.com/edhamma/vism` is BPS-copyrighted Ñāṇamoli translation. Edhamma contacted BPS for permission, got no reply. **Citation + link** (our use case) should be fair use. **Full-text redistribution** would not be. If we ever package the gloss content into the bundled app (not just clickable links), get explicit BPS permission first.

## Running Processes

- **Vite dev server** — PID 74780, port 5180, serving from `opus-dn22-pilot` worktree.
  - To switch to main after PR #55 merges:
    ```bash
    kill 74780
    cd "/Users/aditya/Documents/Ongoing Local/LexiconForge"
    nohup ./node_modules/.bin/vite > /tmp/vite-main.log 2>&1 &
    ```

## Resume Instructions

For the next agent starting cold:

1. **Read in this order:**
   - This file (`docs/HANDOVER.md`)
   - `docs/sutta-studio/RESEARCH_RESULTS.md` (the Eudoxos find — highest-leverage move pending)
   - `docs/sutta-studio/AMORTIZATION.md` (the irreducible-gap framing + verified resources backlog)
   - `docs/sutta-studio/GROUNDING.md` (architecture)
   - `~/.claude/CLAUDE.md` (4 ratified principles)

2. **Check PR #55 status:**
   ```bash
   gh pr view 55 --json state,mergeable
   ```
   If still open: merge it (it has bug fixes that should land before further work).

3. **Decide next move:**
   - **(A) Verify DN22 pilot ran cleanly** — visit `http://localhost:5180/sutta/dn22?phaseLimit=4`, watch the compile, confirm `Phase X/4` (not 0/451) and chips appear. Validates amortization claim empirically.
   - **(B) GROUNDING Phase 4 via Eudoxos** — ~2 hr, biggest quality lift. Pattern in RESEARCH_RESULTS.md.
   - **(C) Persistent segmentCache** — ~2-4 hr, makes all future pilots cheaper. Foundation work.

4. **My recommendation:** (A) → (C) → (B). Verify DN22 first (closes the loop on PR #55), then ship persistent cache (so all future compiles are cheap), then Phase 4 (so quality climbs).

## Learnings Captured

- [x] Bug pattern: useLayoutEffect with self-set state in deps → captured in `767e4f6` commit body
- [x] Architecture insight: per-phase cache is right granularity but not persisted → Pending Thread #3
- [x] Resource discovery: Eudoxos TEI Visuddhimagga → RESEARCH_RESULTS.md + AMORTIZATION.md
- [x] Decision-stack: Eudoxos > MITRA for current Pāli-only product → AMORTIZATION.md verdict section
- [ ] No skill-update opportunities surfaced this session (handover skill already has Phase 0 from earlier patch)

---

*Handover by Claude Opus 4.7 (1M context) at ~83% context. Read cold and pick up.*
