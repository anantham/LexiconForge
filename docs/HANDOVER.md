# Handover: 2026-07-12

> **Note:** the previous `docs/HANDOVER.md` (2026-06-06) covered the **liturgy-generator /
> Sariputta-chants** lane, which this session did NOT touch. Its threads are carried forward
> verbatim-in-substance at the bottom under *Carried forward from prior handover* — they are
> neither resolved nor obsoleted, just untouched. Retrieve the full prior text with
> `git show HEAD~1:docs/HANDOVER.md` if needed.

## Session Summary (narrative)

Built a **reusable source-grounded bilingual reader pipeline** end-to-end on branch
`feat/local-grounding-pipeline` (**unmerged, unpushed**, main clean). Two books run
through it: Calvino (`/calvino`, live at :5210) and Collodi's Pinocchio (ingested; no reader route
yet). The reader foregrounds the Italian with per-word lens tooltips (meaning / who-acts / cognate /
false-friend), pairs each phrase with the real English translation, and swaps which language leads
on a toggle.

**The session's hardest-won lesson, and the current blocker:** an adversarial audit proved the
deterministic gate was reporting **green while the alignment was broken** — twice, for two different
reasons. Both books' gates now **FAIL honestly**. *Do not "fix" this by loosening thresholds.*

## Commits This Session

Branch `feat/local-grounding-pipeline` — **PUSHED: no — awaits user authorization.**
Authoritative list (never stale): `git log --oneline main..HEAD`. Highlights below.

- `77b73ee` Fix EPUB adapter manifest parse (order-independent id/href) + Calvino scaffold
- `bfa68ab` Stage 1: deterministic 22-unit Calvino IT↔Weaver session
- `937a30b` / `6ed29c1` Stage 2: spaCy grounding (88k tokens) + kaikki Wiktionary glosses
- `147dd64` Stage 3: `/calvino` reader UI
- `4b32abf` **Italian lens: `render(facts, lens) → copy`** — kills the substrate leak
- `96c663b` Sentence is the unit; language-lead toggle with animated swap
- `7f7ae87` Clause refinement + deterministic validator (I1–I4)
- `e76f9e1` Fix the classes an adversarial audit found; add the LOCAL-correspondence gate (I5–I8)
- `6765f78` **Completeness gate**: exact I2 + Playwright DOM test
- `e064349` Cross-lingual embedding anchor (MiniLM, local, free)
- `8aebab1` **Pinocchio ingest — pipeline is REUSABLE, zero stage-code changes**
- `7db69ab` **I5 upgraded to embedding signal — retracts the "fully green" claim**
- `(HEAD)` gitignore Pinocchio derived data (31 MB, regenerable)

**Ambient dirty (NOT committed, not mine):** in the *main* checkout — `package-lock.json`,
`public/steering-images.json` (pre-existing), plus two tech-debt docs I authored earlier
(`docs/roadmaps/TECH-DEBT-{DEEP-AUDIT,FIX-PRIORITY}-2026-07-07.md`, still untracked in main).

## Verbatim user quotes (chronological — grounding for every decision here)

*Timestamps approximate; session spanned 2026-07-07 → 07-12.*

- *"specifically there are vestigial dead code, complexity spirals, many differnt pathways doing the same thing help me simplify"* — opened the tech-debt arc.
- *"Approve for me … what am I missing use /ultraplan ultracode and find the issues htat codex could not find"* — authorized the 13-lens adversarial audit (55 verified findings).
- *"lets codex fix it no your tokens are rare, weekly limit is approaching"* — **standing constraint**: offload heavy execution, conserve my tokens.
- *"can you import that to our library and ensure its aligned with the original italian?"* — started the Calvino arc.
- *"are you being lazy? … lets fetch them all so our system can surface the various translations"* — pushed back on a minimal plan. (Finding: **Weaver 1981 is the ONLY English translation** of this book.)
- *"the point of the interface is to let the reader really engage with the source text right"* — **the north star.** Reframed from parallel columns to source-grounding.
- *"isnt codex expensive why not use local ollama model that is free would this need high intelligence?"* — cost discipline → the free/local/deterministic posture.
- *"yes please do that but I also want this to be recylable I have more books I want to do this with so the pipeline needs to be reusable"* — **the reusability requirement**, later proven by Pinocchio.
- *"i mean you can focus on italian and I mean learn from the malyalam no need to recreate stuff that exists right"* — caught me rebuilding what the Malayalam lane already had.
- *"the tooltips just keep saying part of speech and it keeps saying lemma and things like that, which is not useful. You gotta really rethink the UI because gotta make sure every single thing pays like uh you should fight for why each one exists."* — **the LENSES.md law.** Produced `services/italian/lens/`.
- *"here I dont see Weaver English anywhere!"* — the English was buried below ~2,500 words. Fixed.
- *"i want the english words below the italian words … if I am in italian mode then english words move to the bottom … and in english mode the reverse moment happens"* — the language-lead swap toggle.
- *"well we can make phrases the unit not words how about that?"* — **the key design unlock.** Weaver maps phrase-to-phrase but *not* word-to-word; the sentence/clause became the alignment unit.
- *"it feels like you did not try to make the shortest possible phrase … can you run a adversarial workflow with sonnet agents? … also ensure there are all the deterministic tests are being passed so we can scale this to all the pages"* — produced clause refinement + the adversarial audit (44 confirmed misalignments) + the invariant suite.
- *"is there any CI or test that ensures completeness? that every phrase in the english version is there in our UI nothing is swallowed"* — produced exact-I2 + the DOM completeness gate. **Caught the sentence splitter eating closing quotation marks.**
- *"yea chase them down"* / *"yea push through the ingest"* / *"keep going"* — successive authorizations to continue.

## Pending Threads

### Continue Immediately

1. **THE BLOCKER — residual alignment drift.** *(Root cause is NOT yet fully known — an earlier
   version of this doc claimed "dialogue paragraph structure" was the single cause. That was
   TESTED and is FALSE; see below. Do not inherit the wrong hypothesis.)*
   - **What was tried and DID help:** widening the *paragraph-level* bead vocabulary (paragraph
     structure diverges far more than sentence structure — an editor's title line, a translator
     splitting one paragraph, a dialogue exchange collapsed into one block; beads capped at 1:4
     could not express these). `_PRIORS_PARA` in `build_reader_payload.py`.
     **Calvino 5 → 3 drift pairs. Pinocchio 16 → 16 (no effect).**
   - **What this PROVES:** paragraph-bead capacity explains part of Calvino's drift and NONE of
     Pinocchio's. Measured split of Pinocchio's 16: **8 dialogue-led, 10 non-dialogue.** So
     dialogue is at most half the story, and there is a second, unidentified cause.
   - **Next probe (not yet done):** characterise the 10 non-dialogue Pinocchio pairs — they are
     the untouched half. Use `dump_pairs.py` and the embedding own-vs-next margins.
   - Current: I5 = **3 drift pairs (Calvino)**, **16 (Pinocchio)** → both gates FAIL.
   - Files: `scripts/grounding/build_reader_payload.py` (`align_paragraphs`, `best_alignment`).
   - Verify: `npm run check:calvino` / `check:pinocchio` (pass `--embed-cache data/<book>/emb-cache.npz`).
   - **Do NOT loosen thresholds to go green.** The failing gate is correct.

2. **Pinocchio reader route.** Data built; no UI. `CalvinoReader.tsx` is book-specific — generalize
   to `/book/:slug` reading `books/<slug>/book.json` + `data/<slug>/reader-payload.json`.

3. **CI for Pinocchio (now possible — public domain).** Commit `import/pinocchio/*.epub` (460 KB) and
   have CI **regenerate** derived data. Do NOT commit `data/pinocchio/` (31 MB, now gitignored).
   Calvino can structurally *never* run in CI (copyright).

### Blocked

- Nothing hard-blocked. All threads actionable.

### Deferred

| Item | Notes |
|---|---|
| **P0 tech-debt merge** | **Codex COMPLETED the brief.** 4 unmerged branches: `fix/codex-txn-durability`, `fix/codex-cost-budget-safety`, `fix/codex-image-retry-guard`, `debt/codex-db-transaction-kernel`. These fix real data/money-loss bugs **still live in `main`**. Review + merge. |
| P0.2/P0.3 + P1–P3 tech debt | `docs/roadmaps/TECH-DEBT-FIX-PRIORITY-2026-07-07.md` — 55 findings, prioritized |
| Word-level threading | Hover an Italian word → its English word lights up. Needs a word-aligner (awesome-align/fast_align). |
| Widen cognate / false-friend tables | ~100 curated entries; the kaikki dump has etymology to auto-widen |
| Stress-as-grammar (`parlo`/`parlò`) + explicit etym mode | From LENSES.md; not built |
| Converge on shared `ConceptInterlinear` | Optional; prose shell arguably reads better for a novel |
| EPUB→session coverage check | The **one unchecked link** in the completeness chain (adapter only extracts `<p>`/`<h*>`) |
| Open the PR + dual-family review (codex/grok) | Repo custom, before merge |

### Explicit Decisions NOT to Do

| Item | Why |
|---|---|
| Fetch "all English translations" of Calvino | **Only one exists** (Weaver 1981). Every other English EPUB is that same text repackaged. |
| Swap English to repair translator reordering | **Tried; invariant I2 caught it CORRUPTING text.** On rapid dialogue, adjacent short lines have near-identical embeddings → the mutual-preference test misfires and reverses correctly-ordered lines. Reorderings are now **disclosed**, never silently "fixed". |
| Crank the global lexical weight to fix drift | **Trades one bug for another** (fixes one passage, silently re-seats a bead in another). Weight is now chosen per-bead on evidence, preferring the conservative baseline. |
| Publish Calvino/Weaver | **In copyright.** Local-only; `import/` + `data/calvino/` gitignored; never published. Public Italian book = Pinocchio. |
| Prefix rules (`s-`, `ri-`) in the lens | Regex false-fires on `stare`/`sole`/`riva`. Confident-wrong is worse than silent. |

### Carried forward from prior handover (2026-06-06 — liturgy lane, untouched this session)

Status: **all still pending**; I did not work in this lane. Full text: `git show HEAD~1:docs/HANDOVER.md`.

1. **LLM-authoring stage — implement (was TOP thread).** Prereq: extend `build:dpd` UID routing for KN/Snp/Khp (`scripts/build-dpd.ts` ~L518). First chant = Metta (Snp 1.8).
2. **Author 4 remaining Sariputta chants** — `threefold-vandana`, `dai-hi-shu`, `daisegaki`, `teidai-dempo`.
3. **Buddha Vandana per-word depth** — glosses/morphemes flagged pending in `sariputta-refuges-and-precepts.ts`.
4. **Cross-model adversarial review on any new sacred-text authoring** before merge.
5. Deferred (liturgy): chant-depth parity with `metta-sutta.ts`; `morphemeAlignTo` audit for non-Metta chants; MAPLE/Bodhi retrofit onto `heart-sutra-content.ts`; app does network I/O at module import (real fix for the smoke flake).

## Key Context

- **The pipeline is genuinely reusable** — proven: Pinocchio ran through grounding, glosses, payload
  and validator with **zero stage-code changes** (only a manifest + generic `align-book.ts`).
- **Grounding intelligence is NOT an LLM.** spaCy (`it_core_news_sm`) + kaikki Wiktionary + a
  multilingual-MiniLM embedding anchor. All local, free, deterministic. **No API cost anywhere.**
- **Two generic Gutenberg adapter bugs fixed** (help any PG book): many chapters per xhtml file; and
  the licence appended to the **same file as the final chapter** (silently deleting chapter XXXVI).
- Python venv: `scripts/grounding/.venv` (**3.12** — spaCy breaks on 3.14).
- **Malayalam lane** (`feat/opus-malayalam-reader`) is another agent's; `docs/reader/LENSES.md` lives
  there. Don't grab it.
- Reusable affordances registry: `~/Documents/Ongoing Local/AFFORDANCES.md` (checked; nothing from it
  was needed — this pipeline is all local/deterministic).

## Operator Cleanup

- Kill the dev server when done: `pkill -f "vite --port 5210"`.
- **Port :5199 is a DIFFERENT vite** (Malayalam lane, another session) — leave it alone.
- Decide whether to keep the 761 MB kaikki dump (`$JOB_TMP/it-wikt.jsonl`) — needed to re-gloss a new
  book without re-downloading; otherwise delete.
- `import/calvino/` + `import/pinocchio/` hold book EPUBs (gitignored). Calvino's must never be published.

## Parallel-Session Cruft

- **Worktrees (5):** main; `local-grounding` (this session); `opus-malayalam-reader` (another agent —
  **do not touch**); `/private/tmp/.../codex-db-transaction-kernel`; `/private/tmp/.../codex-txn-durability`.
- **Unmerged branches (6):** `feat/local-grounding-pipeline` (this session), `feat/opus-malayalam-reader`,
  and the four codex tech-debt branches.
- **Merged-but-undeleted:** none. **Stashes:** none. **Stale >14d:** none.
- **Decisions:** nothing swept — every branch holds live, unmerged work. The two `/private/tmp/` codex
  worktrees are on a tmp filesystem; **their branches are safe in the repo**, but confirm before any
  reboot-driven cleanup.

## Learnings Captured

- [x] Project memory `parallel-grounding-pipeline.md` — corrected (it wrongly said "Calvino was never built")
- [x] Project memory `validator-must-not-be-weaker-than-system.md` — new
- [x] This handover doc (committed)
- [x] **`/mu` DONE** — promoted to the cross-project union store (`~/.claude-sync/`):
      - `LIBRARY.md` **testing** ← *validator-must-not-be-weaker-than-the-system* (filed as the sharper
        sibling of the existing "never P-hack" note: there you mask a failing test; here the test
        CANNOT fail, which is worse — a passing gate stops you looking)
      - `LIBRARY.md` **data-pipeline** ← parallel-text alignment (Gale-Church + cross-lingual embedding
        anchor; phrase-not-word; monotonic≠reordering) + the two Project-Gutenberg EPUB traps
      - `SHARED-MEMORY.md` Index updated; Journal entry **`[0064]`**
      - *Collision note:* another agent claimed `[0063]` mid-write. **Re-check the top journal index
        immediately before writing — never from memory.** If a duplicate appears post-Syncthing,
        renumber YOUR entry, never theirs.

## Running Processes

- **Vite dev server, port 5210** (this worktree) — serves `/calvino`. `pkill -f "vite --port 5210"`.

## Resume Instructions

1. Read the **Calibration moments** table below — the compressed version of what went wrong.
2. Fix **dialogue-aware paragraph alignment** (Thread 1). Both gates will tell you immediately
   whether it worked.
3. Then: Pinocchio reader route → CI (PD data) → PR with dual-family review.
4. Separately (independent lane): review + merge the **4 codex tech-debt branches** — those bugs are
   still live in `main`.

## Calibration moments

| Moment | Lesson |
|---|---|
| Deterministic gate reported **green** while 44 misalignments existed | **Global conservation cannot see local correspondence.** If pair *i* and *i+1* swap content, the concatenation is unchanged. Conservation ≠ correctness. |
| Gate reported green **again** after adding I5 | **A detector weaker than your aligner reports green while broken.** I aligned with embeddings but *judged* with gloss-bags. Judge with your strongest signal or you're measuring nothing. |
| Claimed "fully green"; had to retract | Say the gate FAILS when it fails. A flattering number is worse than no number. |
| Cranked lexical weight to fix drift → silently broke another passage | A global knob trades bugs. Select on **measured evidence per unit**; prefer the conservative baseline unless clearly beaten. |
| "Repaired" reordering by swapping English → **corrupted the text**; I2 caught it | Conservation is the stronger guarantee. **Disclose** what you can't fix; never silently "repair" with a heuristic that can misfire. |
| Shipped a tooltip showing `lemma` / `part of speech` | **Substrate is INPUT, never the answer.** "Noun" answers a question no reader asked. Every element must fight for why it exists. |
| Word-level alignment was impossible; *phrases* dissolved it | The user's *"make phrases the unit"* was the unlock. Pick the unit the **evidence** supports, not the one you assumed. |
| My own invariants caught **four** of my bugs (dropped English, eaten quotes, lost tokens, reordered text) | The invariant suite is the real asset — worth more than any single fix. |

---
*Handover by Claude (Opus 4.8, 1M) at ~88% context*
