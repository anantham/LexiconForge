# Handover: 2026-05-18 (Heart Sutra artifact + concept-graph hover + AFFORDANCES.md + automation pattern)

> Replaces the 2026-05-16 handover. None of the prior handover's `Continue Immediately` items were addressed this session (CI test gate PR, PR #60 review, InterleavedReader chunking) — this session was 100% focused on the Heart Sutra artifact + cross-project automation infrastructure. Prior threads are carried forward unchanged in their respective sections below.

## Session summary (narrative — for humans skimming)

Made the MAPLE Heart Sutra page reflect the project's polyglot vision. Split 3 mega-segments into 12 Xuanzang chant-line segments (breath-by-breath rhythm). Replaced the misleading "AI (after Sheng-yen)" witness label with the actual MAPLE chant sheet text (matched against a user-provided photo). Filled four elided prose blocks (Śāriputra all-dharmas, the no-eye enumeration, All Buddhas, Therefore-know). Added the Sino-Japanese longer chant after the Sanskrit dharani. Then built the concept-graph hover primitive (per `docs/sutta-studio/POLYGLOT.md` + `TEXT_GRAPH.md` design): `ConceptNode` types + 30-concept registry (Gemini-deep-researched, multi-source citations) + concept-membership hover filter wired into `TripleScriptWitness.tsx`. Validated end-to-end on `opening-practice`: hovering `prajñā` morpheme now lights only "wisdom" (was: also "transcendent" — the fan-out bug). Plus: validated path-A subagent + GEO-persistent-cookies pattern for self-driven Gemini Deep Research (built `scripts/gemini_research.py`). Plus: created lean `~/Documents/Ongoing Local/AFFORDANCES.md` with two curated entries. Plus: updated handover skill to v1.7.0 with affordances + ask-when-blocked sections.

## Commits this session (all on `feat/opus-heart-sutra-split`, NOT pushed)

- `046085a` feat(scripts): add gemini_research.py — drive Gemini via GEO's persistent session
- `70b9335` feat(concepts): 30-concept Heart Sutra registry from Gemini deep-research
- `c701adc` feat(liturgy): concept-graph hover (prototype on opening-practice)
- `e9e3ae5` feat(liturgy/heart-sutra): label as MAPLE chant, add elided prose, bump arrow visibility
- `f072c7e` fix(liturgy): recompute alignment arrow from live DOM on hover (cherry-pick from `fix/opus-alignment-arrow-stale`)
- `0a3184f` feat(liturgy): split Heart Sutra into Xuanzang chant-line segments

**PUSHED: no — awaits user authorization.**

**Cross-repo changes (NOT in this worktree):**
- `~/Documents/Ongoing Local/AFFORDANCES.md` — created, 40 lines, 2 entries (browser-automation-with-logged-in-frontier-models + scheduled-recurring-tasks). NEEDS DECISION: version-control where? (proposed: tiny git repo at `~/Documents/Ongoing Local/`, or commit into GEO).
- `~/Documents/Ongoing Local/expansion/skills/handover/SKILL.md` — updated to v1.7.0 (added "Available cross-project affordances" section + "Ask the human when blocked" binding section). NEEDS PUSH to `anantham/expansion` GitHub repo + `/plugin marketplace update expansion && /plugin install expansion@expansion` to make durable; installed cache currently still v1.6.1.
- `~/.claude/plugins/known_marketplaces.json` — fixed marketplace registration: key renamed `expansion-marketplace` → `expansion`, repo updated `anantham/expansion-marketplace` → `anantham/expansion` (user had deleted the wrong-named repo).

## Verbatim user quotes (chronological — load-bearing scope directives)

*Capture rationale: these are the scope-setters, redirects, and "why" rationales that drove every commit. Paraphrase would lose specificity. JSONL session log is local-only; this is the durable grounding.*

- `2026-05-18 early` — *"do the bodhi zeno chants now pls, you have the data right and do whatever did for maple for all these chants"* — opened the session with bulk-authoring scope.
- `2026-05-18` — *"if maple and bodhi zendo has the same 4 great vows chant why are you duplicating efforts?"* — surfaced duplication; ratified status quo (no consolidation).
- `2026-05-18` — *"cant you get original text and do the same thing with arrows and segments and all that why is it just text?"* — drove the Zen long-text rebuild (Song of Zazen + Xinxin Ming + Hōkyō Zanmai with original Japanese/Chinese).
- `2026-05-18` — *"I want to break it into smaller phases right now its like 12 words then english the rhytm should be more like 3 words before I see english"* — drove the chant-line segment split (3 mega-segments → 12 breath-sized).
- `2026-05-18` — *"didnt you use the maple chant sheet? why do you call it AI and loosely based on sheng like cant you make sure its exactly MAPLE"* — exposed the misleading label; drove relabel + sheet verification.
- `2026-05-18` — *"make sure its matching this, this is the soryu maple translation... is there anything different"* (photo of MAPLE chant sheet) — drove the four-prose-block additions + comparison against actual sheet.
- `2026-05-18` — *"no need for arrows in the alignment on hover edges"* — drove the arrowhead-marker removal (kept lines, dropped marker).
- `2026-05-18` — *"the thing is Maybe we've got to think about the data model. Like, it's not just about the English, there are multiple Englishes... we've got to think about handling all of that... what are your recommendations?"* — opened the polyglot data-model design conversation.
- `2026-05-18` — *"Can you read the vision document in temporal coordination about and the ADRs and things like that? Because I think you're still going for centralization and not understanding that we're going to be living in a in a high actuation world where things are pluralistic and there is weak correspondences. You can't just try to abstract away uh what is common."* — **pivotal redirect**. Killed the Sanskrit-as-anchor-track design I was proposing. Re-grounded in `POLYGLOT.md` + `TEXT_GRAPH.md` ConceptNode primitive (no canonical pivot). This is the load-bearing design principle of the concept-graph implementation.
- `2026-05-18` — *"i think we should do it now, we have momentum and lets do this right so we can fix all the other chants.... see rather than think of making the perfect model, the goal is to get the heart sutra arrtfact perfect, like I want that page to really reflect our vision, we have a concrete goal"* — **artifact-first framing**. Override of my "defer multi-month investment" recommendation. Heart Sutra page IS the constraint that disciplines the model.
- `2026-05-18` — *"cant you referece and ground using ALL these sources... the idea is to lean on AI making intelligence cheap and using authoriticative sources to prevent hallucinations"* — set the grounding standard (≥2 authoritative sources per concept beyond Wikipedia).
- `2026-05-18` — *"yea let us try A and see if it works and if now we can do C wrapping B"* — authorized testing path-A (subagent + MCP claude-in-chrome) before promoting to path-C (skill wrapping path-B GEO browser_chat.py).
- `2026-05-18` — *"are you using the cookies from GEO"* — surfaced the critical gap; MCP claude-in-chrome was launching a clean Chromium with no cookies. Drove the pivot to GEO's persistent `~/.atlas/browser-state/gemini.google.com/` user-data-dir via Python+Playwright.
- `2026-05-18` — *"feels like too much, I want it to be lean and sleek require approval from me before affing any affordance, so far we dont need redundancy"* — set AFFORDANCES.md scope: one entry at start, manual approval for each addition, no auto-collection.
- `2026-05-18` — *"yes you can do an audit the cron job that handles handover of tasks on obsidian is rich runs daily can be useful for recurring tasks"* — approved the second AFFORDANCES.md entry (scheduled-recurring-tasks runner).
- `2026-05-18` — *"make sure /Handover talks about the affordances using the gemini and chatgpt for deepresearch and asking human for help if there is any blocker"* — drove handover-skill v1.7.0 patch.

## Pending Threads (enumeration — for the next instance's worklist)

### Continue Immediately

1. **Tag remaining 11 Heart Sutra segments with conceptIds** — highest-leverage finish for the artifact.
   - Status: NOT STARTED. Only `opening-practice` has morpheme/word conceptIds attached (prajñā→wisdom, pāramitā→perfection, caryāṃ→practice, gambhīrāṃ→deep, caramāṇo's `cara` root→practice). The other 11 segments have full word/morpheme data + the 30-concept registry exists, but no conceptIds are attached.
   - Next step: in `data/liturgy/heart-sutra.ts`, for each segment's `morphemes:` and (where no morphemes) `conceptIds` field at WordGloss level, attach the matching concept ID(s) from `data/concepts/heart-sutra.ts`. The 30 concept IDs are stable; cross-reference each Sanskrit lemma to the right concept.
   - Estimate: 30-45 min focused. Mechanical edits.
   - After: concept-membership hover works across the WHOLE page, not just one segment.

2. **Push `feat/opus-heart-sutra-split` to remote + open PR** — 6 commits unpushed, none reviewed. User has not authorized push for this branch yet. Surface to user; they decide whether to push as-is or wait for #1 above.

3. **Push `~/Documents/Ongoing Local/expansion/` source to `anantham/expansion` on GitHub + reinstall the plugin** — handover skill v1.7.0 patch is in source only; installed cache still v1.6.1. Without push + `/plugin marketplace update expansion && /plugin install expansion@expansion`, the affordances + ask-when-blocked sections won't fire in future `/handover` runs.

4. **Decide AFFORDANCES.md versioning** — currently a free-floating file at `~/Documents/Ongoing Local/AFFORDANCES.md`. Options: tiny git repo at `~/Documents/Ongoing Local/`, commit into GEO, leave un-versioned. User to decide.

### Carried forward from prior handover (2026-05-16) — none addressed this session

5. **CI test gate PR** — STILL NOT STARTED. User explicitly authorized 2026-05-16T11:55 ("yep go ahead"); 2-day-old authorization. New worktree `../LexiconForge.worktrees/opus-ci-test-gate/` from `main`, branch `feat/opus-ci-test-gate`. Add `.github/workflows/test.yml` running `npm test` on PRs. Context in prior handover lines 107-115.
6. **PR #60 review/merge** — STILL OPEN. https://github.com/anantham/LexiconForge/pull/60 — last status: OPEN, MERGEABLE, no review yet. Awaiting `@codex review`.
7. **#15 InterleavedReader — production-scale chunking strategy** — STILL DEFERRED. L5-verified on 16-char paragraph; real chapters are 2-10k chars. Files: `services/wordAlignment.ts`, `components/chapter/ReaderBody.tsx`. Estimate: 4-6 hr.

### Blocked

8. **claude-in-chrome MCP extension domain permission** — extension returns `Permission denied by user` for gemini.google.com navigation. User attempted to grant once, didn't take. Workaround discovered: GEO's persistent Chrome session at `~/.atlas/browser-state/gemini.google.com/` via Python+Playwright (now wired as `scripts/gemini_research.py`). The MCP path stays blocked but the workaround is solid.

### Deferred (acknowledged but parked)

| Item | Why deferred / sketch |
|---|---|
| **Cross-script concept tagging** | Currently only Sanskrit IAST morphemes + English witness tokens emit `data-concept-ids`. Chinese 般若 / Tibetan ཤེས་རབ tokens via `scriptMorphemes` aren't yet plumbed. Requires renderer changes in `TripleScriptWitness.tsx` to call `conceptsForToken('zh', 'Hant', text)` etc. when rendering script-variant tokens. Big quality win for the "no canonical pivot" pluralism principle. Next sprint. |
| **Vision.md §3 pillars** | Ghost rendering at 30% opacity for supplied English; Visual syntax color logic (gold/blue/orange for grammatical roles); Polysemy Rotator (click contested word, cycle senses). Each ~half-day. |
| **Deep Research mode toggle in `gemini_research.py`** | Current `--deep-research` flag has placeholder logic that falls back to regular chat if it can't find the toggle. Needs the actual Gemini Deep Research selector. ~30 min to wire properly once you re-run with `--deep-research` and observe the actual button. |
| **Promote path-A → path-C** (skill wrapping `gemini_research.py`) | User asked: "C wrapping B." Write `~/.claude/skills/research/SKILL.md` (or in expansion) that codifies `/research <prompt>` → calls `gemini_research.py`, optionally `chatgpt_research.py` in parallel, dedupes results. Deferred — works fine as a manual script for now. |
| **Princeton page numbers for 26/30 concepts** | Marked "Princeton lookup needed" in `data/concepts/heart-sutra.ts`. Requires physical or PDF access to Buswell & Lopez 2014. Gemini research didn't have it. |
| **Verify 84000 URLs** | Gemini gave 84000 glossary slugs but I didn't click through each one. Some may 404 or point at the wrong entry. Could batch-verify via `gemini_research.py` with a small prompt. |
| **Princeton physical lookup** | User to do manually if/when they have the book in hand. |
| Issue #1 phases 2-6 (telemetry, deep-link import race, registry remap, scope validation) | From prior handover — see `issues/1-bootup-time/README.md`. |
| ADR-009 (logging policy) ratification + implementation | From prior handover — `issues/8-wasted-logs-audit/README.md`. |
| ADR-010 (liveness probes) ratification | From prior handover — `issues/6-image-models-dynamic-and-tested/README.md`. |
| Pre-existing TS errors in repo | `AboutThisText.tsx`, `spaNavigate.ts`, `smoke-real-fojin.ts`, etc. From prior handover. |
| DharmaNexus / MITRA framework | Deferred since 2026-05-14. |
| Compiler consolidation Phase 3/4 | Tasks #44, #45 still pending. |
| Path B procedural phases | Task #46 still pending. |
| Refrain-detector post-pass | Task #52. Plan at `docs/sutta-studio/PLANS/refrain-detector.md`. |
| Cost-aware preview-and-confirm UX | Task #53. Plan at `docs/sutta-studio/PLANS/cost-preview-confirm.md`. |

### Explicit Decisions NOT to Do

| Item | Why skipped |
|---|---|
| Add Concept-graph types as project-level architectural commitment NOW | User redirected: "the goal is to get the heart sutra artifact perfect, like I want that page to really reflect our vision, we have a concrete goal." Artifact-first; model emerges from the artifact's requirements. Other chants (Refuges, EJKG, Bodhi vows) can follow the same pattern later if it proves out. |
| Auto-collect AFFORDANCES.md entries from project scans | User said "lean and sleek, require approval from me before affing any affordance." Manual curation only. |
| Register more skills/utilities as affordances (concept-graph types, citation helpers, GEO's contamination audit) | Audited: niche to specific projects, not general affordances. Two entries is the right size. |
| Cross-script concept-tagging in this commit | Scope expansion — would require renderer changes. Deferred as separate sprint. |
| Use MCP Playwright for Gemini Deep Research | Confirmed: MCP Playwright launches clean Chromium, no cookies, hits sign-in wall. Use GEO's persistent state path instead. |

## Key Context

### Pluralism principle (LOAD-BEARING — read POLYGLOT.md + TEXT_GRAPH.md before any data-model change)

The user explicitly redirected away from centralizing data-model patterns. Key principles from `docs/Vision.md`, `docs/sutta-studio/POLYGLOT.md` (manifesto), `docs/sutta-studio/TEXT_GRAPH.md` §4:

- **No canonical anchor track.** Sanskrit, Pāli, Chinese, Tibetan, Japanese, Korean, Vietnamese, multiple Englishes all participate as equal attestations of `ConceptNode`s. Don't make Sanskrit (or any single language) the pivot.
- **Concept membership, not connectivity graph.** Hover semantics = set intersection on `conceptId`s, not edge-following.
- **Weak correspondences, multiple kinds.** `AttestationRelation` distinguishes `semantic | transliteration | calque | interpretive | ghost`. 般若 ↔ prajñā is `transliteration` (by sound), ཤེས་རབ ↔ prajñā is `calque` (by morpheme-equivalence), MAPLE's "wisdom" ↔ Conze's "Wisdom" both `interpretive`.
- **Contested concepts are first-class** (`contested: boolean` per node). Polysemy is data, not error.
- **Per-Work concept curation.** ~30-50 concepts per text. Don't try to build a universal ontology.

This isn't optional architecture — it's the user's explicit rejection of "abstract away what is common."

### Path-A pattern (browser automation via GEO's persistent cookies) — VALIDATED

`scripts/gemini_research.py` works end-to-end. Test prompt "84000 URL for Heart Sutra Toh 21" returned clean answer in ~40s. The pattern:

1. `playwright.sync_api.chromium.launch_persistent_context(user_data_dir=~/.atlas/browser-state/gemini.google.com)` — inherits user's authenticated session.
2. Anti-automation flags: `channel="chrome"`, `--disable-blink-features=AutomationControlled`, `ignore_default_args=["--enable-automation"]`. (Copied from `GEO/runner/atlas_runner/browser_chat.py` BrowserGeminiProvider.)
3. `_wait_and_extract` polls `.markdown` child of `<model-response>` (not parent `innerText` — that contains transient status like "Locating Key Information"). Watches for "Stop generating" button disappearance.

**Reusable for:** any Gemini chat (with `--deep-research` once the toggle selector is wired); analogously could be done for ChatGPT (`~/.atlas/browser-state/chatgpt.com/`), Claude.ai (`~/.atlas/browser-state/claude.ai/`), Grok.

### Non-obvious code knowledge

- **Concept tagging is at MORPHEME granularity, not word.** In `TripleScriptWitness.tsx`, `data-concept-ids` is emitted by `HoverSpan` (one per morpheme) and `EnglishLine` (one per English word with a witness-specific lookup). The arrow-line filter in `adjustedLines` (lines ~945-1010) does idx-match THEN concept-overlap.
- **Witness identifier matters for lookup.** `conceptsForToken('en', 'Latn', 'wisdom', 'MAPLE chant sheet (after Sheng-yen)')` returns concept-membership specific to the MAPLE witness. The full witness `by` string is used — not "MAPLE" — so concept-attestations in `data/concepts/heart-sutra.ts` must match the exact `Witness.by` field. (Discovered + fixed mid-session.)
- **The MAPLE chant sheet has 4 prose passages elided from earlier authoring.** Now added as `prose-commentary` sections between the triple-script-witness sections (heart-opening-and-emptiness → maple-all-dharmas → maple-no-eye-no-ear → heart-result → maple-all-buddhas → maple-great-spell → dharani). Don't re-elide.
- **The Sino-Japanese "longer chant" after the Sanskrit dharani** is a real MAPLE practice — user provided a photo of "Gya tē gya tē ha ra gya tē / Hara sō gya tē bo ji sowa ka" syllabification. Lives as a second sound-formula section `id: 'dharani-japanese-extended'`.

### Architecture state (snapshot)

- **Heart Sutra reader at `/liturgy/maple/heart-sutra`** — fully rendering, concept-hover works on `opening-practice` segment, all other segments still alignTo-only.
- **Concept registry** in `data/concepts/heart-sutra.ts` — 30 entries, ~1750 lines, multi-source citations (84000 + DDB + Princeton + Wikipedia).
- **Type infrastructure**: `types/conceptGraph.ts` (ConceptNode, ConceptAttestation, AttestationRelation). `WordMorpheme` + `WordGloss` in `types/liturgy.ts` got optional `conceptIds?: string[]`.
- **alignment-audit tests**: 372/372 passing after the split + concept work.

### Multi-agent state

Other branches in the repo (don't touch from this worktree unless explicitly directed):

- `main` — clean, 6 commits behind this branch
- `fix/opus-alignment-arrow-stale` — PR #64 open, contains only the arrow-fix that this branch cherry-picked. Either close as superseded once this branch lands, or merge it first and let this branch carry only the unique work.
- Possibly stale worktrees from prior sessions per memory note: opus-batch3-curation, opus-batch4-curation, opus-compiler-consolidation, opus-schema-reconcile.

## Operator Cleanup (manual steps for the human)

1. **Decide AFFORDANCES.md versioning** (see Continue Immediately #4).
2. **Push `anantham/expansion` to GitHub** if you want handover skill v1.7.0 to be live next session. Then `/plugin marketplace update expansion && /plugin install expansion@expansion && /reload-plugins`.
3. **Close the empty browser tab** the early subagent attempt left open (tabId 1340627427 from the claude-in-chrome MCP probe — couldn't close it without permission). Just a stray new-tab page.
4. **Authorize push of `feat/opus-heart-sutra-split`** when ready (currently unpushed by design per CLAUDE.md push-auth rule).
5. **Verify the page visually** at `http://127.0.0.1:5182/liturgy/maple/heart-sutra` — dev server should still be running from earlier (Bash bjxr4kl13). Hover `prajñā` morpheme in the second line of opening; only "wisdom" should highlight. If server is down, restart with `cd ../LexiconForge.worktrees/opus-heart-sutra-split && PORT=5182 npx vite --port 5182 --host 127.0.0.1`.

## Learnings Captured

- [x] **Auto-memory** at `~/.claude/projects/-Users-aditya-Documents-Ongoing-Local-LexiconForge/memory/` is the canonical place for project-specific learnings — no new entry written this session because the existing entries (especially `feedback_architectural_zoom_pattern.md`) already cover what would be added.
- [x] **AFFORDANCES.md** created at `~/Documents/Ongoing Local/AFFORDANCES.md` — 2 entries, lean.
- [x] **Handover skill v1.7.0** in source (not yet installed) — adds affordances + ask-when-blocked binding sections.
- [ ] **Possible MEMORY.md candidate**: "When the user invokes the pluralism principle (POLYGLOT.md, Vision.md), they're rejecting any data model that picks one tradition as the canonical anchor. Concept-as-attestation, not edge-following. Multiple kinds of correspondence (semantic / transliteration / calque / interpretive / ghost) — each first-class." Worth promoting to `~/.claude/MEMORY.md` if this pattern recurs across other projects.
- [ ] **Skill update opportunity**: The expansion:handover skill needs v1.7.0 pushed + reinstalled. Captured in source already.

## Running Processes

- **Dev server** — Bash background ID `bjxr4kl13` — `npx vite --port 5182 --host 127.0.0.1` for the worktree. Idle / running. Check with `curl -s http://127.0.0.1:5182/liturgy/maple/heart-sutra | head -5`. Can be killed when no longer needed.
- **Background subagent** `a8b81341be72c6b84` (claude-in-chrome probe — completed, blocked on permission, no state to clean).
- **Background subagent** `a4bd1619bafc82ad5` (verification probe — completed, blocked).
- **Background subagent** `abbf234fe18e366e1` (capability probe — completed successfully).

## Resume Instructions

1. **Decide push/scope:** Either authorize push of `feat/opus-heart-sutra-split` as-is (6 commits), OR tag the remaining 11 segments with conceptIds first (Continue Immediately #1) THEN push.
2. **If continuing the artifact:** open `data/liturgy/heart-sutra.ts` and `data/concepts/heart-sutra.ts` side-by-side. For each segment's morpheme entries, attach `conceptIds: ['concept.X']` from the registry. The 30 concept IDs are stable; cross-reference by Sanskrit lemma.
3. **If pivoting to other work:** the prior handover's Continue Immediately items (CI test gate, PR #60, InterleavedReader chunking) are still pending. None were touched this session.

## Calibration moments

| Moment | Lesson |
|---|---|
| Proposed a Sanskrit-as-anchor data model in the polyglot discussion | The user's pluralism principle from Vision.md / POLYGLOT.md is binding; defaulting to "pick one canonical pivot" is the centralization reflex. Read the design docs BEFORE proposing new abstractions. |
| Tried MCP claude-in-chrome for browser automation; got `Permission denied by user`; user asked "are you using the cookies from GEO" | When user has prior infrastructure (GEO's persistent contexts), use it. The MCP path is a clean-Chromium throwaway; GEO is the actual logged-in state. |
| Initial Gemini response-extraction script caught only status text ("Locating Key Information") | Gemini's UI streams via parent `model-response` element with transient status, then settles into `.markdown` child. Poll `.markdown` only + watch "Stop generating" button disappearance. Don't trust `.innerText` of the parent during streaming. |
| Proposed AFFORDANCES.md with 7-bullet entries + per-entry "when not to use" + maintenance pattern | User said "feels like too much, I want it to be lean and sleek." Default toward minimum-viable; expand only if the lean version proves insufficient. |
| Recommended deferring concept-graph work to "multi-month with scholar collaboration" per POLYGLOT.md §9 | User overrode: artifact-first ("get the Heart Sutra artifact perfect") not perfect-model-first. The concrete artifact disciplines the model design. POLYGLOT.md §9's caution is for the FULL polyglot reader across the canon; one-page MVP is a different scope. |

---
*Handover by Claude Opus 4.7 instance at ~83% context · 2026-05-18*
