# Handover: 2026-05-12 (long session — Tier-1 grounded data layer + 3 MN10 phases curated + renderer arc)

> Session led by Claude Opus 4.7 (1M context). Branch: `feat/opus-grounded-data-layer` (worktree at `../LexiconForge.worktrees/opus-grounded-data-layer`). All 25 commits pushed to origin. Open as **PR #38 (draft)**. `main` is unchanged from prior session (`cfdc48c`).

## Session summary

Started with task #16 (additive schema fields, deferred from prior session) and pivoted into building the entire Tier-1 grounded-curation data layer per ADR SUTTA-008. Architecture, protocol, three phases curated end-to-end, a renderer arc that makes the grounded data *visible*, two schema tensions surfaced and resolved, and a provider-quality bug-fix that increased DPD coverage from 81.6% to 86.5% on MN10.

The session validated the ADR's keystone principle ("hand-curation and the LLM compiler share the same data layer") empirically: phase-a/b/c each surfaced real provider tensions that were impossible to predict in pure design; the fix loop closed each one.

## Commits this session (25, all pushed to `feat/opus-grounded-data-layer`)

Categorized chronologically by arc:

```
Schema + ADR (3, on main from prior session)
  7d38402 feat(sutta-studio): additive bilingual schema fields (FEATURES.md §2)
  cfdc48c docs(sutta-studio): ratify SUTTA-008 grounded-curation data layer ADR
  1242e43 chore(worklog): claim provider abstraction work in feat/opus-grounded-data-layer

Tier-1 build (Commits A-D + E; on the branch)
  9168b5a feat(sutta-studio): provider abstraction + Citation provider-attribution fields
  82fae37 feat(sutta-studio): DPD ingestion script + MN10 subset dataset (Tier-1 commit B.1)
  49d3eba feat(sutta-studio): DpdProvider impl + tests (Tier-1 commit B.2)
  5ff46c0 feat(sutta-studio): curation helper script — lookup-phase (Tier-1 commit E)
  bc46e47 feat(sutta-studio): wire DPD into the live lexicographer pass (Tier-1 commit B.3)
  8c82f73 feat(sutta-studio): SC bilara variants + suttaplex parallels providers (Tier-1 commit D)

Grounded Curation Loop protocol
  b5f56dc docs(sutta-studio): ratify Grounded Curation Loop protocol + phase-a log skeleton
  e1a77fa docs(sutta-studio): protocol §3.4 — replace forbidden-words list with principled tooltip-register check

Phase-a (3 commits)
  c121521 docs(sutta-studio): phase-a curation — fill brief / snapshot / evidence (steps 0-2)
  fae6752 docs(sutta-studio): phase-a curation — apply gate amendments + fill §3-§10
  8e7b197 feat(sutta-studio): apply phase-a re-curation diff + close curation log

Renderer arc — making the data visible
  00fe9ab feat(sutta-studio): chunk 1 — implicit visual grammar (anchor + ghostKind + arrow calm-default)
  29d5c35 feat(sutta-studio): chunk A — distinguish pinned tooltip from hover tooltip
  8df4aba feat(sutta-studio): chunk B — click-Pāli cycles tooltip facets
  b290ff0 fix(sutta-studio): tooltip overflow — wrap + flip-below when near top of viewport
  e379062 feat(sutta-studio): About This Text provenance panel + populate MN10 provenance
  9b5b59c feat(sutta-studio): extend Provenance type — URLs + acknowledgments references
  13164b2 feat(sutta-studio): linked acknowledgments in About-this-text
  0515dd4 feat(sutta-studio): citation chips in pinned tooltip — make 14 grounded citations visible

Phase-b (2)
  17413ef docs(sutta-studio): phase-b curation draft — brief, evidence, proposed diff
  23b1481 feat(sutta-studio): apply phase-b re-curation with gate-2 amendments

Phase-c (2) + provider-quality fix (1) + backfill (1)
  b46aa64 docs(sutta-studio): phase-c curation draft — brief, evidence, proposed diff (awaiting gate)
  c33b115 fix(sutta-studio): DPD ingestion — three stripper bugs surfaced by curation
  69b8eda feat(sutta-studio): apply phase-c re-curation (with DPD-fix in-flight)
  3485523 feat(sutta-studio): backfill phase-a evaṁ citation — DPD fix made the link honest

Schema tension resolution
  4323310 feat(sutta-studio): resolve schema tension #7 — add 'grammatical' + 'curatorial' to EpistemicBasis
```

## What landed (categorized)

### 1. Tier-1 grounded-curation data layer

Six providers + the protocol layer they share with hand-curation:

- **`SuttaCentralDictionaryProvider`** wraps `/api/dictionary_full/{lemma}` (was the existing one, refactored into the abstraction).
- **`DpdProvider`** loads per-sutta JSON subsets built from `dpd-db v0.4.20260501` (CC BY-NC-SA 4.0). Per-sutta ingestion via `scripts/build-dpd.ts`; `data/dpd/mn10/` has 458/534 surface forms matched at 86.5% coverage after the bug-fix.
- **`SuttaCentralBilaraVariantsProvider`** lazy-fetches `variant-pli-ms.json` from GitHub raw; parses witness disagreements per segment.
- **`SuttaCentralSuttaplexParallelProvider`** calls `/api/parallels/{uid}` and projects to `ParallelRef[]`.
- **`LexiconProviderRegistry`** runs providers in parallel; preserves per-source entries via `entriesBySource`; isolates failures.
- **Compiler wiring** — `services/compiler/index.ts:387` calls DPD alongside SC's `dictionary_full`; lexicographer prompt now includes per-source blocks.
- **`scripts/sutta-studio/lookup-phase.ts`** is the curation helper: `npm run sutta:lookup -- --phase phase-X` prints structured evidence for every lemma + parallels + variants.

### 2. Grounded Curation Loop protocol

`docs/sutta-studio/CURATION_PROTOCOL.md` codifies the 12-step loop, four gates (Evidence / Ghost / Affordance / **Plain-Register** added §3.4), human-gate moments, batch sizing, and role locks. The §3.4 amendment replaced an earlier "forbidden-words list" with a principled three-criterion check (reader profile + pay-rent + register layering).

### 3. MN10 phases a/b/c curated

| Phase | Pāli | Anchor | DPD citations | Schema tensions hit |
|---|---|---|---|---|
| **phase-a** | Evaṁ me sutaṁ | `sutaṁ` | 4 (incl. evaṁ backfilled after DPD fix) | #1, #7 (resolved) |
| **phase-b** | Ekaṁ samayaṁ bhagavā | `samayaṁ` | 5 | #7, #10 (deferred) |
| **phase-c** | Kurūsu viharati | `viharati` | 4 (DPD bug fixed mid-curation, kurūsu now real) | #7 |

Total `packet.citations` after the three phases: **14 entries**, with deterministic IDs (`cite:{providerId}:{sourceId}`) and renderer-ready `excerpt` strings baked in. All curation logs in `docs/sutta-studio/curation/phase-{a,b,c}.md` with brief / evidence / proposed diff / gate-amendment record / outcome.

### 4. Renderer arc — data becomes visible

Eight commits added affordances to surface the grounded data without bloating the reading experience:

- **Visual hints (chunk 1):** `isAnchor` → subtle amber underline + medium weight; `ghostKind` differentiated underlines per kind; arrow opacity quieted (0.4 → 0.2) so hover summons feel like summoning.
- **Pin model:** clicking a Pāli segment pins its tooltip (emerald ring + emerald border + × close glyph). Pinned tooltip visually distinct from hover.
- **Click cycles facets:** clicking a pinned Pāli segment advances through its tooltip facets (when `tooltips[]` has multiple strings). Indicator: `1/3`, `2/3`, etc.
- **Tooltip overflow:** `whitespace-normal` + `max-w-[min(28rem,90vw)]` + JS `useLayoutEffect` to flip below-segment when near top of viewport.
- **About-this-text panel:** chip at top of content ("▶ MN10 · Pāli · Theravāda · tr. Bhikkhu Sujato about") expands to a structured provenance panel; Unknowns section makes gaps explicit; **12 outbound links** to upstream sources (DPD, Sujato translation, VRI, SC bilara-data, CC0 deed, etc.) framed as acknowledgement, not citation.
- **Citation chips in pinned tooltip:** when a segment is pinned AND its active sense has `sourceCitationIds`, the tooltip footer renders "SOURCES" + per-citation short ref + italic excerpt. The 14 grounded citations are now READABLE.

### 5. Provider-quality DPD bug-fix (key empirical win)

Phase-a's `evaṁ→eva` and phase-c's `kurūsu→kura` both surfaced provider-side mis-resolutions. Three root causes, fixed in commit `c33b115`:

1. **Niggahīta diacritic mismatch** — DPD uses `ṃ` (U+1E43, m-with-dot-below); bilara uses `ṁ` (U+1E41, m-with-dot-above). Normalize on parse + extraction.
2. **Over-greedy `-ūsu`/`-ūhi` endings** — those aren't single morphological endings; the long vowel belongs to the sandhi-lengthened stem. Removed from PALI_ENDINGS.
3. **Missing bare `-su`/`-hi` endings + vowel-shortening rule** — needed to reach `kuru` after stripping locative-plural.

Coverage: 81.6% → 86.5%. evaṁ now correctly maps to DPD's `evaṃ` headword ("thus; in this way"). kurūsu now maps to both `kurū` (the Kuru people) and `kuru` (the country), neither of which is the unrelated `kura` ("rice").

### 6. Schema tensions

Two of 10 documented tensions resolved this session:

- **#1 DPD stripper conflation** → resolved by `c33b115` (above).
- **#7 `EpistemicBasis 'grammatical'`/`'curatorial'`** → resolved by `4323310`. Three relation `epistemicBasis` placeholders migrated from `'etymological'` (wrong) to `'grammatical'` (honest).

The remaining 8 tensions are documented in `docs/sutta-studio/curation/phase-{a,b,c}.md §10/§5/§7` with hit counts per phase.

## Pending threads (next session pickup)

Listed in priority/effort order, with context-cost notes:

### Continue immediately

1. **Phase-d curation** — batch 2 of `CURATION_PROTOCOL.md §6` (a, b, c, **d**) before re-evaluating the protocol. Phase-d's content depends on `demoPacket.json`; check it for the next clause. Protocol is well-documented; fresh agent can pick up without prior context.

2. **Tooltip plain-first content rewrite** — protocol §3.4 amendment landed but no tooltip content was rewritten under the new register-check discipline. Phase-a/b/c tooltips still use the older "dual-register with [bracket] jargon" pattern. The §3.4 self-check protocol is explicit. ~1 hour per phase to rewrite + clear with user.

### Worth doing soon

3. **Renderer Chunk 3 — structured tooltip facets** — current `tooltips: string[]` array works but doesn't carry semantic labels (Meaning / What English hides / Example). Schema change: `tooltips?: TooltipFacet[]` where `TooltipFacet = { label, plain, grammar?, example? }`. Migration touches all phases' tooltip data. Renderer changes follow the existing facet-cycle mechanism. ~2 hours.

4. **DPD bug-fix unit tests** — `c33b115` shipped with end-to-end verification only. Unit tests for `normalizeNiggahita`, the stem-stripper edge cases (`kurūsu`, `evaṁ`, `bhikkhūsu`, …), and the vowel-shortening logic would catch regressions. ~30 min, ~150 LOC.

5. **File GitHub issues for remaining schema tensions** — 8 tensions documented in curation logs. Filing as actual GitHub issues prevents them from rotting. `gh` available. ~15 min.

### Larger arcs

6. **Tier-1 commit C — VRI edition + Aṭṭhakathā commentary providers** — originally deferred per ADR Open Questions #4 (VRI XML alignment to bilara segment IDs is the unknown). Buddhaghosa's commentary on the formula `Evaṁ me sutaṁ` would deepen phase-a's transmission-frame tension substantially. Estimated 2-4 hours depending on alignment quality.

7. **Phases e through 51** — batch 2/3/4 of MN10 per protocol §6. Each phase ~30-45 min following the rhythm. Phase 14+ are where the data quality drops (per prior handover); re-curation likely most pedagogically rewarding there.

### Process / housekeeping

8. **PR #38 draft → ready-for-review / merge decision** — 25 commits, all green. User's call on cadence.

9. **Schema tension #10 (`RelationType 'temporal'`)** — only 1 hit (phase-b). User's "wait for more data" rule applies. Re-evaluate after phase-d/e.

### Deferred (explicit reasons)

- **Stand-off annotation refactor** — captured in ADR §Stand-off section with 6-12 session migration cost. Trigger conditions documented; not hit yet.
- **CBETA / 84000 / GRETIL providers** — Tier-2 (polyglot work); committed to be deferred until Heart Sutra arc begins.
- **BDRC / BuddhaNexus / PaliNLP** — Tier-3 (TextGraph era); committed to be deferred.

## Key context (non-obvious things the next instance needs)

### The user's curation rhythm

- "Go one by one and get my clearance so I know I can trust you" — applied as gate-1 (post-evidence) + gate-2 (post-diff) for each phase.
- Per-phase compact curation log in `docs/sutta-studio/curation/phase-X.md` with §0-§11 sections (brief, snapshot, evidence, alignment, linguistic, bridge, pedagogy, epistemic, decisions, open questions, schema tensions, outcome).
- Schema/UI tensions get extracted in §10 (or §7 for compact compact format), NEVER implemented mid-phase.

### The DPD bug pattern

When a future phase surfaces another DPD mis-resolution, check the `data/dpd/<sutta>/manifest.json` `unmatchedSurfaces` list + run a targeted grep against `data/_raw/dpd/dpd.txt`. If a real DPD lemma exists but the stripper missed it, the fix is local to `scripts/build-dpd.ts`:
1. Are the ṃ/ṁ codepoints aligned? (covered by `normalizeNiggahita`)
2. Is the case ending in `PALI_ENDINGS`? (some endings may still be missing)
3. Does the strip require vowel-shortening? (long-vowel stems before -su/-hi)

### Renderer pinned-tooltip discipline

- Hover state shows the active tooltip facet only (calm).
- Pin state shows the same content PLUS the SOURCES footer (audit moment).
- × button is the only interactive element inside the tooltip (the rest is `pointer-events-none`).
- Clicking the same pinned segment cycles facet, doesn't unpin. Unpin via × or by pinning a different segment.

### Schema-tension hit-count discipline

When a phase surfaces a tension, increment its count in §10 (or §7) of the phase log. After batch 2 completes (phase-d), tensions hit 3/3 are strongly supported. Tensions hit ≤1/n where n>2 are likely noise. Don't extend the schema on n=1 evidence.

### House style for the gratitude register

When acknowledging upstream sources (DPD, VRI, Sujato, etc.), write in the **gratitude register**, not the citation register. Phrasing like "We use their May 2026 release" — first-person plural, dated, license-respectful. Each named source gets a real outbound link. The point isn't audit (alone) — it's right-relation to the work that came before. See `components/sutta-studio/AboutThisText.tsx` "What this packet rests on" section as the pattern.

## Running processes

None. Dev server at `http://localhost:5191/sutta/demo` was running during the session (worktree, Vite); will need to be restarted for next session. Main repo's dev server (port 5173) was left untouched.

## Resume instructions

1. **Read this handover.**
2. **`cd ../LexiconForge.worktrees/opus-grounded-data-layer`** to enter the feature branch's worktree.
3. **Skim** `docs/sutta-studio/CURATION_PROTOCOL.md` §0-§3 (the loop + gates) and `docs/sutta-studio/curation/phase-c.md` for the latest curated phase as a template.
4. **Pick from pending threads** based on your context-budget. For fresh-context sessions, phase-d curation or the tooltip plain-first rewrite are well-scoped. For continuing sessions, the renderer Chunk 3 (structured tooltip facets) is the next architectural step.
5. **Don't extend the schema speculatively.** Tension hit-counts are documented; re-evaluate after batch 2 completes.

---

*Handover by Claude Opus 4.7 (1M context) at end of session 2026-05-11/12. All 25 commits pushed to `feat/opus-grounded-data-layer`; PR #38 (draft); main unchanged. Estimated context usage at handover: ~60% of 1M.*
