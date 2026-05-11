# Handover: 2026-05-11 (long session — Opus chapter-identity migrations + Sutta Studio fixes + polyglot architecture docs)

> Session led by Claude Opus 4.7 (1M context). Branch: `main`, all commits pushed to `origin/main`. Clean working tree (the `MAPLE chants/` untracked directory is user content, not session work).

## Session summary

Started on a leftover thread from the prior session (the misleading `beforeunload` warning being downstream of a deeper chapter-identity corruption). Diagnosed and fixed a 2,500+ chapter-row corruption pattern in the user's local IDB across two principled migrations (V4 unwrap + V5 chapter-number drift). Then pivoted to Sutta Studio: shipped three usability fixes (chip honesty, cheap-model default, partial-phase fallback), and produced the design substrate for everything beyond bilingual MVP — a 1700-line three-doc architectural foundation (`FEATURES.md` / `TEXT_GRAPH.md` / `POLYGLOT.md`). Did NOT start the actual phase-by-phase MN10 re-curation work; that's next session's primary task with the schema scope + plan now landed.

## Commits this session (8, all pushed to `origin/main`)

```
efa7c8f docs(sutta-studio): canonical feature catalogue + architecture/charter docs
4ff787e fix(sutta-studio): render side-by-side fallback English for partial phases
5cb15b7 fix(sutta-studio): decouple compiler model from translation, default to cheap
d78b62f fix(sutta-studio): chip count reflects fully-renderable phases, not just Pali-extracted
bef65dd fix(maintenance): issue #20 — chapterNumber drift from history walker
3a08f4b fix(maintenance): V4 unwrap — delete-before-put on translations to clear unique index
e9dcced chore(repo): untrack files matching existing data/ ignore rules
851b8d0 chore(repo): move 62MB session JSON to data/sessions/, untrack at root
```

(plus `dd0de8c` from earlier in the V4 work arc, also pushed.)

## What landed in detail

### 1. Chapter identity migration arc (V4 + V5)

**Issue:** user's IDB had 6544 chapters where the registry says 3521. Continue Reading showed 2 cards per novel. Dropdown duplicates. Audit revealed two distinct corruption sources:
- v1-composite/v1-st-enhanced version split (3271 dup groups)
- nested-scoped stableIds (`lf-library:...v1-st-enhanced:lf-library:...v1-composite:ch1000_*` — scope wrapped a stableId instead of unwrapping first)

**Solution:**
- **V4 unwrap migration** (`MaintenanceOps.unwrapNestedScopedIds`) — peels all scope wrappers, re-scopes under canonical version, re-keys all references atomically. Survivor selection for collision groups (depth-first, prefers active-translation-bearing rows). Multi-source pollution preserved (different bareHashes stay distinct). 7 tests.
- **V5 chapter-number drift** (`MaintenanceOps.correctChapterNumberDrift`) — restores `chapterNumber` for rows where stableId baseHash and title agree on N. Conservative: skips ambiguous rows. 6 tests.
- **Defensive guard** in `setChapterNumberByStableId` — refuses writes that disagree with stableId baseHash. 3 tests.
- **History walker fix** in `services/translationService.ts:858-876` — removed the IDB write call. In-memory inference now only fills missing values.
- **Boot pipeline wiring** — both V4 and V5 run on every user's next visit, idempotent (each gated by its own settings flag).

**Postmortem:** `issues/20-chapter-number-drift-from-history-walker/README.md` — full root-cause analysis. Bug introduced Sept 2025 (commit `a30647c`); corruption only manifested in chapters near the user's recent translation work because the walker has to fire to corrupt anything.

**User's local data post-migration (verified live):** chapters 6544 → 3271, translations 130 → 130 (zero loss), summaries 6544 → 3271.

### 2. Sutta Studio fixes (three)

- **Chip honesty** (`d78b62f`) — progress chip counts phases where `englishStructure` is non-empty, not phases where Pali extraction completed. Old chip lied about progress (said "1046/3370" when only 1 was visually rich).
- **Cheap-model default** (`5cb15b7`) — Sutta Studio compiler defaults to `OpenRouter + google/gemini-3-flash-preview` regardless of global translation model. ~100x cheaper for structured-extraction passes (~$1-7 per long chapter vs ~$135-400 with Sonnet). User can override via `settings.suttaStudioProvider/Model` (no UI yet — dev console only).
- **Partial-phase fallback** (`4ff787e`) — for phases where alignment hasn't completed, render `baseEnglish` from `canonicalSegments` as side-by-side text below the Pali instead of leaving empty space. Progressive enhancement.

### 3. Sutta Studio design substrate (three docs, ~1700 lines)

**`docs/sutta-studio/FEATURES.md`** (status: current implementation, bilingual MVP)
Catalogue of every existing feature. Each has: layer (L1 linguistic / L2 bridge / L3 pedagogy), schema fields, renderer behavior, example JSON, common mistakes, back-compat status. Manifesto: "scripture as a living transmission object." Lists six unused-but-already-in-schema features as immediate wins for MN10 re-curation (refrainId, isAnchor, tooltipsBySense, ripples, citationIds, sense-specific tooltips). Lists small additive bilingual extensions still to add (verb morph, compoundType, expanded ghost kinds, quote spans, EpistemicBasis, provenance, parallels).

**`docs/sutta-studio/TEXT_GRAPH.md`** (status: design — implementation deferred)
Architectural spec for textual transmission. Five entity types (Work / Tradition / Expression / Witness / SourceRef). `Claim<T>` wrapper with two-tier ergonomics. Multi-resolution Alignment. ConceptNode for cross-language anchors. textGraphRefs migration story. TEI as inspiration not implementation; references BDRC, CBETA, SuttaCentral, GRETIL.

**`docs/sutta-studio/POLYGLOT.md`** (status: charter — multi-month, requires scholar collaboration)
Per-language decomposition lenses. Manifesto: "each language teaches its own hidden machinery." Sketches: Sanskrit sound ladder, Chinese term kinds with xíngshēng correction (most characters are NOT pictograms), Tibetan syllable stack with Wylie + Sanskrit equivalence. Heart Sutra MVP scope with honest 6-10 week estimate per passage. ContextGraph spec with explicit warning: do not build context lens without sourced scholarship.

### 4. Repo cleanup

Moved 62 MB session JSON from root → `data/sessions/`. Untracked 47 illustration files + 1 stale FMC metadata file (matched existing ignore rules). Hardened `.gitignore` with `lexicon-forge-session-*.json` patterns. History blobs untouched (not destructive — repo on origin still 769 MB, but future commits stay clean).

## Pending threads

### Continue immediately (next session start here)

1. **Additive bilingual schema fields (task #16)** — defined in `FEATURES.md §2`, deferred from this session. Add to `types/suttaStudio.ts`:
   - Extended `MorphHint` (verb morphology + ablative + dual + gender)
   - `CompoundType` enum + `compoundType`/`compoundSegments` on `PaliWord`
   - Expanded `GhostKind` enum (article/copula/auxiliary/pronoun_from_verb/preposition_from_case/punctuation/quote_marker/required/interpretive)
   - `Span` type for quote markers + `spans?` on `PhaseView`
   - `confidence` + `epistemicBasis` + `sourceCitationIds` on `Sense` and `Relation`
   - `Provenance` type + `provenance?` on `DeepLoomPacket`
   - `ParallelRef` + `parallels?` on `PhaseView`
   - `version?` on `DeepLoomPacket`

   All optional, all additive — zero renderer changes, zero test breakage. Tiny round-trip test. ~30 min, one commit. Spec lives in FEATURES.md §2.1-§2.7.

2. **MN10 demo re-curation (task #14)** — user's stated next priority is **re-curate phases 1-15 first** (the existing rich phases get enriched with the unused-but-in-schema features + new additive features once #16 lands). Then continue 16-51. Workflow user cleared earlier in the session: "go one by one and get my clearance so I know I can trust you."

   For phase-aw (the worst, currently 32 paliWords/0 relations crammed into one phase), user cleared **5-phase split** (intro + 4 parallel breath patterns) with the dual-register tooltip voice from phase-a. The intro phase (`phase-aw-intro`) was DRAFTED in the conversation and cleared by user — that draft is in the conversation but **not yet written to demoPacket.json**. Recover it from the chat or re-draft.

   **Recommended start sequence after #16 lands:** schema additions → walk phase-by-phase from phase-a. For each phase: identify what's missing (refrainId for repeated formulas like "bhikkhave"; isAnchor for the verb that grounds the instruction; ripples for sense-swapping; EpistemicBasis on contested glosses; citationIds for PED/Bodhi/Buddhaghosa attributions; compoundType where compounds exist), draft, show diff, get clearance, edit `components/sutta-studio/demoPacket.json`, commit. Repeat.

### Blocked

None.

### Deferred (acknowledged but parked)

1. **Heart Sutra polyglot MVP** — full charter in `POLYGLOT.md`. User explicitly committed: "lets finish mn10 and then do heart sutra carefully so we can with this UI cycle through specific interfaces for EACH language that is as carefully designed as we did for pali to english". I documented the honest scope: 6-10 weeks per passage with three lenses, requires scholar collaboration. Decision to start should be deliberate.

2. **TextGraph implementation** — full spec in `TEXT_GRAPH.md`. Not blocking bilingual work. Build order in §10. Would land as packets reference graph by ID instead of nesting provenance inline.

3. **Multi-source pollution at chapter 1** (FMC) — V4 migration intentionally preserved this (different bare baseHashes stay distinct per "do not merge different bare base IDs" rule). User has Chinese (`第1章 新的冲突` from hetushu) AND English (`Artifact Graveyard`) both tagged chapterNumber:1. Need: classify hetushu/2991 (different novel imported under FMC namespace? or actually FMC raw?) and decide whether to merge or relocate.

4. **Dungeon Defense chapterNumber-collision bug** — separate from FMC drift. Investigation not started.

5. **Sutta Studio "size guard"** — refuse to compile if phase count > N (e.g. 50) without explicit confirm. Prevents repeat "money is being wasted" panic from this session. ~30 LOC.

6. **Sutta Studio settings UI for compiler model** — currently `suttaStudioProvider/Model` settable only via dev console. Add a small toggle in Settings → AI section.

7. **Phase parallelism in Sutta Studio compiler** — 3-10x wallclock speedup independent of model choice. Replace sequential `for phase of phases` with concurrency-limited Promise pool. Throttle stays at 1/sec floor.

8. **Migration telemetry** — emit one event per V4/V5 run with affected counts so the user can see how many other users hit this. ~30 LOC.

9. **Issue #21 (memory architecture / LRU eviction)** — pre-emptive, no acute pain reported. The V4 migration just dropped chapter count from 6544 → 3271, so immediate pressure reduced.

10. **Registry-side fixes** for FMC: cover image, `legacyVersionIds: ['v1-composite']` so future imports back-compat. Requires PR to the separate `lexiconforge-novels` repo.

11. **`beforeunload` warning** — original thread that started this session. The cancellation-cascade root cause was fixed earlier (CORE-012 ADR, "background work survives navigation"). The dialog itself may still fire under specific edge cases (cleanup-on-error gaps in `state.activeTranslations` / `state.pendingTranslations` / per-chapter `generatedImages[…].isLoading`). Diagnostic snippet in the prior `HANDOVER.md` (commit `f4851f0`).

12. **Repo structure cleanup** — `interfaceIdea.tsx` at root, `types.ts` vs `types/` ambiguity, `Features/Diff` orphan, `media/` purpose unclear, `tools/` purpose unclear. Cosmetic; user noted "it looks messy rn" but we deferred most cleanups.

## Key context (non-obvious things the next instance needs)

### Demo packet anatomy (for MN10 re-curation)

`components/sutta-studio/demoPacket.json` — 12,325 lines, 51 phases, hand-curated 2026-03-05 with `compiler.model: "demo"` (not actual LLM output, hand-authored for showcase). Quality drops sharply after phase 14:

| Phase range | richSegs avg | Notes |
|---|---|---|
| 1-14 (phase-a … phase-7) | 1-2 | Hand-curated DeepLoom richness — relation arrows, per-segment senses |
| 15-30 (phase-x … phase-al) | 0-1 | Sense entries but no relation arrows |
| 36-41 (phase-ar … phase-aw) | 0 | Long paragraphs (14-32 paliWords each!), zero relations |
| 42-51 | 0-2 | Recovers somewhat |

User's specific complaint: "first few lines is great but it immediately fucks up." The empty-space issue (partial phases rendering Pali with no English below) is fixed in the renderer now (`4ff787e`); the data-quality drop is what re-curation addresses.

### User's curation rhythm (cleared earlier in session)

- "go one by one and get my clearance so I know I can trust you"
- 5-phase split for phase-aw (intro + 4 parallel breath patterns), not 4
- Hybrid drafting: Claude draft + Pali knowledge + SC bilara-data fetched via Bash, user reviews each
- Dual register tooltips (formal `[Genitive/Agent]` + accessible `Form is "of me", function is "by me"`)
- "bhikkhus" preferred over "monks" in primary display ("monks" smuggles Christian ascetic assumptions)

### House style for tooltips (codified in FEATURES.md §6)

```
[Past participle] Marks completed action: "heard"
```

Format: `[Formal grammatical term]` + `accessible explanation`. Multi-line tooltips per segment separate concerns by line: definition / grammatical role / pedagogical note. Avoid restating the English gloss (gloss lives in `Sense.english`).

### The three-layer mental model (FEATURES.md §0)

When adding ANY new field, identify which layer it belongs to:
- **L1 linguistic** — facts about the source text (case, sandhi, compound type)
- **L2 bridge** — source-to-target alignment (linkedPaliId, conceptId, ripples)
- **L3 pedagogy** — how renderer displays for a learner (refrainId, ghostOpacity, isAnchor)

Several existing fields conflate layers (`wordClass: 'vocative'` is half-L1, half-L3). Future fields should be tagged with their layer at design time.

### The `Claim<T>` wrapper principle (TEXT_GRAPH.md §3)

Two-tier ergonomics:
- Trivially certain assertions stay as primitives (`case: 'gen'`)
- Genuinely uncertain or contested assertions get the wrapper (`teachingDate: { value, confidence: 'traditional', note: '...' }`)

This prevents the schema from laundering tradition into fact. **Most important type in TEXT_GRAPH.md.**

### The user's epistemic discipline

The user pushes back hard on lazy framing:
- "make beliefs pay rent" (tooltips need to teach, not just label)
- "fake profundity" (don't say "空 means cave-plus-work therefore emptiness means..." for Chinese)
- "don't collapse transmission into immediacy" (provenance discipline)
- "context as lens not cause" (don't reduce Buddhism to economics)

Match this register. Don't soften or hand-wave.

### Recurring conversational pattern this session

We zoomed architecturally several times: phase-aw-1 → FEATURES.md → TEXT_GRAPH.md → POLYGLOT.md → context graph. Each level was worth thinking about; **none resulted in actual code curation**. Next session, **start with the actual phase-by-phase work** (after the small schema additions). The architectural docs are landed; the discipline now is to USE them, not extend them further.

## Learnings captured

### For project memory

- **Chapter identity corruption (V4 + V5)** — root caused, fixed, postmortem at `issues/20-chapter-number-drift-from-history-walker/README.md`. Boot pipeline runs both migrations idempotently. Future debugging starts there.
- **Sutta Studio docs landed 2026-05-11** — three files in `docs/sutta-studio/`. FEATURES.md is the bilingual MVP spec. TEXT_GRAPH.md is the architectural design (not implemented). POLYGLOT.md is the multi-month charter. Read all three before working in this area.
- **Sutta Studio compiler model is decoupled** — `settings.suttaStudioProvider/Model` overrides global translation model. Default is gemini-3-flash-preview. Don't conflate these two settings.

### For cross-project memory (~/.claude/MEMORY.md)

- **Pattern: visible mass cleanup uncovers next-layer bugs.** V4 unwrap removed 3271 duplicate scoped IDs and the dropdown became clean enough to spot the smaller chapterNumber-drift dedup failure. Layer-by-layer cleanup is the right rhythm.
- **Pattern: architectural conversations are seductive.** Tonight's session zoomed FEATURES → TEXT_GRAPH → POLYGLOT → context graph. Each was worth thinking about; none resulted in code. Note this pattern when it recurs and pivot to actual implementation.

### Potential ADR (none required)

- **Sutta Studio compiler model decoupling** — small enough to live in commit message + FEATURES.md mention.
- **TextGraph architecture** — `TEXT_GRAPH.md` itself serves as the spec when this is built. Could become an ADR at implementation time.

## Running processes

None at session end.

## Resume instructions

1. **Read this handover doc.**
2. **Skim** `docs/sutta-studio/FEATURES.md` §1 (existing features), §2 (proposed extensions for MN10), §7 (status table), §8 (where to go from here).
3. **Skim** `docs/sutta-studio/TEXT_GRAPH.md` §3 (Claim wrapper) and `docs/sutta-studio/POLYGLOT.md` §0 (manifesto) — these inform the voice/discipline for re-curation.
4. **Pick task #16 from the list above** (additive schema fields). Add the types to `types/suttaStudio.ts` per FEATURES.md §2 specs. One commit, one tiny round-trip test, push.
5. **Then start task #14** (MN10 phase re-curation). Begin with phase-a. For each phase: identify what's missing, draft, show diff, get user clearance, edit `components/sutta-studio/demoPacket.json`, commit. User cleared this rhythm.
6. **Don't extend the architectural docs further.** They're landed. The job now is to USE them.

---

*Handover by Claude Opus 4.7 (1M context) at end of session 2026-05-11. All commits pushed. Clean tree. Estimated context usage at handover: ~85%.*
