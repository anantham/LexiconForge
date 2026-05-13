# Sutta Studio Compiler Strategy — When to Hand-Curate, When to Pipeline

> **Status:** Ratified 2026-05-12. Captures the economic-strategic analysis that emerged from MN10 batches 1-4 (phases a-h + phase-1, 9/51 phases done).
> **Companions:** `docs/sutta-studio/CURATION_PROTOCOL.md` (how a phase is hand-curated), `docs/sutta-studio/FEATURES.md` (schema fields the compiler must populate), `config/suttaStudioPromptContextV2.ts` (the v2 prompt overlay codifying protocol learnings).
> **Audience:** a new curator deciding what to do next, or a future agent-session weighing "continue hand-curating MN10" vs "wire the pipeline."

This document exists because the answer to *"should we keep hand-curating?"* changed during batch 4. The CURATION_PROTOCOL tells you how to do a phase well. This document tells you *which* phases are worth doing by hand, and what to do with the rest.

The thesis: **hand-curation should be reserved for the ~10-15 phases per sutta where pedagogical judgment is load-bearing. The remaining ~35-40 phases should be produced by pipeline + deterministic post-passes + light human polish.** Hand-curating routine phases is a misallocation of curator attention.

---

## 1. The economic shape

### 1.1 Cost per phase

Empirical, from MN10 batches 1-4:

| Mode | Time / phase | Cost / phase (LLM) | Output quality |
|---|---|---|---|
| **Hand-curation, rich phase** (translator-debate, anchor-bearing, contested word) | 30-45 min | $0 direct ($X opportunity cost) | 100% |
| **Hand-curation, routine phase** (recurrence, case-quirk variant, refrain hit) | 15-20 min | $0 direct | 100% |
| **Pipeline, Gemini Flash, full sutta** | ~3-5 min / phase auto | $0.10-$0.30 / **full MN10 compile** | ~30-40% (v1) / ~65% (v2) |
| **Pipeline, Claude Sonnet, full sutta** | ~3-5 min / phase auto | $1-$3 / full compile | higher consistency, similar ceiling |
| **Pipeline, Claude Opus, full sutta** | ~5-8 min / phase auto | $3-$10 / full compile | small additional lift on contested phases |

The model-cost spread ($0.30 → $10) is dwarfed by the curator-time spread (15 min → 45 min). The economic question is not "which model" but "which phases get the curator's time."

### 1.2 The 90% ceiling

Pipeline output — even with v2 prompt amendments, deterministic post-passes, and a §3.4 linter — tops out around **85-90%** of hand-curated quality. The last 10-15% is steeply diminishing returns:

- Translator-tradition citations require a database the LLM doesn't have.
- Anchor selection when 2-3 candidates are plausible requires reader-side judgment.
- Confidence calibration ("is this `medium` or `high` for *this* gloss?") drifts under pure-LLM curation.
- Curation-log narrative — explaining *why* a decision was made — has no automated analog.

The 10-15% gap isn't closed by "better prompts." It's closed by human time on the phases that warrant it.

### 1.3 The Pareto distribution within a sutta

MN10 has 51 phases. From batches 1-4 (9 phases done), the empirical breakdown:

| Phase class | Count (estimated, full MN10) | Curator value |
|---|---|---|
| **Famously-contested word** (centerpiece of a teaching) | ~5-8 | hand-curation essential (translator-debate, multi-sense, anchor) |
| **Pattern-establishing** (introduces a recurring lemma, case-quirk, or refrain) | ~5-8 | hand-curation high-value; sets the precedent the pipeline will inherit |
| **Doctrinally-loaded passage** (technical term: paññā, sati, ekāyano, ātāpī, sampajāno) | ~5-10 | hand-curation essential; pedagogical weight is what the reader is *here* for |
| **Routine recurrence / variation** (refrain hits, case-variants of established lemmas, narrative connectives) | ~30-35 | pipeline + post-passes + light polish; 85-90% is indistinguishable from 100% to the reader |

Roughly **10-15 of 51 phases** carry the pedagogical weight. **The remaining 35-40 are routine.** Hand-curating the routine 35-40 is the misallocation.

This Pareto shape generalizes. Any sutta that's mostly refrains and structural recurrences (which is most of them) has the same skewed distribution.

### 1.4 Quality bands by mode

The current state and the path forward, with confidence intervals from batches 1-4:

| Mode | Quality | What it has | What it lacks |
|---|---|---|---|
| **v1 pipeline (current)** — `config/suttaStudioPromptContext.ts` | ~30-40% | bracketed grammar tooltips, basic senses, refrain ids, some relations | plain §3.4 prose; `morph` field; `epistemicBasis`; `sourceCitationIds`; anchor decisions; confidence; cross-phase facets; arrow-earning discipline |
| **v2 pipeline** — v1 + `config/suttaStudioPromptContextV2.ts` overlay (built, not yet wired) | ~65% | plain §3.4 prose, arrow-earning rule, anchor selection, confidence, basis tags (prompted), translator-debate awareness | `morph` field population, citation-id wiring, cross-phase facet detection, scholarly-tradition citations |
| **v2 + 4 deterministic post-passes** — morph-from-POS, citation-linker, cross-phase facet detector, §3.4 linter | ~85% | the structural fields populated reliably; the prompt's failure-modes caught at lint time | scholarly-tradition citations, ultimate pedagogical taste, curation-log narrative |
| **Hand-curated, protocol-disciplined** | 100% | everything above + translator-debate cycles, anchor confirmation, curation log | nothing in scope |

The v2 overlay exists. The 4 post-passes are designed but not built. Stage 2 of §5 closes ~30% of the quality gap for ~30 minutes of wiring work. Stage 3 closes another ~20% for 2-3 days of post-pass work.

---

## 2. What the pipeline does today vs what it could do

Hand-curation does 11 things v1 pipeline doesn't. Each is classifiable as *learnable via prompt*, *deterministic post-process*, or *irreducibly human*.

| # | Hand-curation behavior | Today (v1) | v2 prompt? | Post-pass? | Irreducibly human? |
|---|---|---|---|---|---|
| 1 | Plain-first §3.4 prose — drop bracket jargon, emoji, `√` symbols | absent | **yes** | (lint check) | no |
| 2 | `morph` field on segments (case, number) | absent | **yes** (prompted) | **yes** (morph-from-DPD-POS post-pass) | no |
| 3 | `epistemicBasis` on senses (lexical/grammatical/curatorial/etymological/commentarial/contextual/comparative) | absent | partial (prompted; LLM unreliable at distinguishing) | partial (rules-based for lexical/etymological) | partial (commentarial/contextual disambiguation) |
| 4 | `sourceCitationIds` wiring senses to DPD entries | absent | **yes** | **yes** (citation-linker post-pass — DPD entries are already in compiler context) | no |
| 5 | `isAnchor` decision (one per phase, semantic centerpiece) | absent | **yes** | partial (heuristic: famously-contested-word table + content-word frequency) | partial (taste at edge cases) |
| 6 | `confidence` (high/medium/low) on senses | absent | **yes** (prompted) | (lint check on distribution) | partial (calibration drift) |
| 7 | Cross-phase facets (refrain-explanation, case-contrast cross-references) | absent | partial (only if phase-state context provided) | **yes** (cross-phase facet detector scans corpus for recurring lemmas; injects cross-refs) | no |
| 8 | Color-explanation facets for function-word classes | absent | **yes** | no | no |
| 9 | Translator-debate cycles (multi-sense with Bhikkhu Bodhi / Sujato / Thanissaro citations) | absent | partial (hallucinates plausibly without tradition-database) | no | **yes** (citation accuracy) |
| 10 | Arrow-earning rule (drop relations that name universal grammatical roles) | absent | **yes** | (lint check: flag `subject`/`object`/`predicate` labels) | no |
| 11 | Per-phase curation log narrative | absent | no | no | **yes** (the "why" record for future curators) |

**Summary:** the v2 overlay (`config/suttaStudioPromptContextV2.ts`) addresses items 1-2, 4-6, 9 (awareness), 10 via prompt. Items 3 and 7 are partly prompt + partly post-pass. Item 11 stays human. Items 9 (citation accuracy) and 11 are the irreducibly-human core.

**The mass of work is learnable or post-processable.** The pedagogically-irreplaceable work is narrower than it first appears.

---

## 3. What's irreducibly human

Three categories. Estimating the per-sutta share at the end of each.

### 3.1 Translator-tradition citations

Citing specific scholars (Bhikkhu Bodhi, Sujato, Thanissaro, Walshe, Horner, Ñāṇamoli, Walpola Rahula) for contested-word readings. The LLM will hallucinate plausibly-attributed readings without a curated tradition-database, and the hallucinations are hard to catch unless the curator already knows the literature.

Empirical: in 9 phases of MN10, contested words requiring this discipline included:
- `ekāyano` (phase-1) — 5 distinct readings (direct / one-and-only / solitary / convergent / unified) tied to specific scholars.
- Anticipated for later phases: `ātāpī`, `sampajāno`, `satimā`, `anupassī`, `paññā`, `vineyya loke abhijjhādomanassaṁ`.

**Estimated incidence:** ~5-8 phases per major sutta need this.

The fix isn't "better prompting." It's a curated database keyed by Pāli lemma. (See §6 open question 1.)

### 3.2 Pedagogical taste

- **Anchor confirmation when multiple candidates exist.** Phase-e (Tatra kho bhagavā bhikkhū āmantesi) has 3 plausible anchors: `bhagavā` (the Buddha enters), `bhikkhū` (the audience appears), `āmantesi` (the action). The pipeline can heuristic-pick the verb; the curator picks `āmantesi` because the *pedagogical* job of the phase is the tense-shift to aorist. That's not a rule the prompt can derive without reading the brief.
- **Sense ordering when readings have similar weight.** First sense shown = the default reading. With 5 senses on `ekāyano`, the choice of which goes first shapes the reader's first encounter. Pipeline can rank by frequency; curator ranks by pedagogical entry-point.
- **Confidence ranking calibration.** What counts as `high` vs `medium` drifts under pure-LLM curation because the model lacks a corpus-wide reference. Hand-curators implicitly calibrate against the phases they've already done.
- **"Is this tooltip too long?"** §3.4 plain-prose discipline. The pipeline can be prompted toward concision but the gut-check ("the reader will stop reading after the second clause") is human.

### 3.3 Curation-log narrative

Explaining *why* decisions were made. Audience: future curators (or agents) reviewing/amending the packet. **Not reader-visible.** The reader experiences the output; the log captures the reasoning.

The log is the highest-leverage human artifact in the protocol. It's where a future curator decides whether to keep, amend, or reverse a decision. Auto-generated logs degrade into restating-the-diff — the *because* gets lost. (CURATION_PROTOCOL §9 names this failure explicitly: *"curation log entry is just a restatement of the diff."*)

### 3.4 Per-sutta budget

Combining §3.1-§3.3: **~5-8 phases per sutta** carry irreducible human work end-to-end. Anchor confirmation, sense ordering, and confidence calibration are spread thinly across more phases but the marginal time per phase is small (~2-3 min of review).

The remaining 40+ phases of a typical 50-phase sutta are routine. Pipeline + post-passes + light human polish (5-10 min / phase to read the output and either accept or flag) is sufficient.

---

## 4. Cost telemetry — what we have, what's missing

The curator was surprised, mid-batch-4, to learn how much telemetry already exists.

### 4.1 What we have

In `services/apiMetricsService.ts`:

- Every API call recorded as `ApiCallMetric { apiType, provider, model, costUsd, tokens, duration, chapterId, success, ... }`.
- `apiType: 'sutta_studio'` is first-class — sutta-studio compiler calls are tagged distinctly from translation calls.
- Stored in IndexedDB; survives sessions.
- Session and lifetime aggregation: `getSessionSummary()`, `getLifetimeSummary()`.
- CSV export.
- Per-call cost computed via `calculateCost(model, promptTokens, completionTokens)` — the model-price table is the single source of truth for per-token math.

This means the infrastructure to ask *"what did the last MN10 compile cost?"* exists; the data is sitting in IndexedDB right now.

### 4.2 What's missing

- **No `phaseId` field** on `ApiCallMetric`. Calls can be attributed to a compiler-run (via `chapterId` or a synthetic compile-id) but not to a per-phase breakdown. To answer *"how much did phase-1 cost in the last compile?"* the field needs to exist.
- **No UI** to view metrics. The data is in IndexedDB; today, inspecting it requires browser DevTools and a manual query. A dev-tools page with per-compile / per-phase tables is straightforward but unbuilt.
- **No prompt caching.** Anthropic, Gemini, and OpenAI all support it. The compiler's system prompt + bilara block is identical across 51 phase-calls in a single MN10 compile. Caching would cut input cost by **~50-70%** on that repeated context. Today: every phase re-bills the full prompt.
- **No local-vs-LLM split** beyond the DPD layer. The DPD manifest reports `sqliteLookupCount: 458 / heuristicFallbackCount: 20 / unmatched: 56` for MN10 — that's the resolver split. Above the DPD layer (compiler API spend) we have totals but not a "what fraction of the compiler's work hit deterministic providers vs the LLM" view.

### 4.3 The 3-step plan to close the gap

| # | Action | Estimated time | Payoff |
|---|---|---|---|
| 1 | Add `phaseId?: string` to `ApiCallMetric`; pass through `callCompilerLLM` | ~30 min | per-phase cost attribution |
| 2 | Add prompt caching for the system + bilara context block in `services/compiler/` | ~30-60 min | 50-70% input-cost savings on multi-phase compiles |
| 3 | Build a dev-tools page (sutta-studio settings or a hidden route) showing per-phase cost breakdowns + CSV export | ~2-3 hr | curator can answer cost questions without DevTools |

All three are additive; none blocks the others; none requires schema migration. Steps 1 and 2 are the high-leverage ones.

### 4.4 Claude Code session-side costs

Separate from in-app compiler costs: the Claude Code session itself (curator-side) has its own token spend. `npx ccusage` reads `~/.claude/projects/` and reports per-session cost. Useful for answering *"how much did this 4-batch curation cost Anthropic API-side?"* — but distinct from the compiler's spend on the user's API key. Worth knowing about; not part of the in-app telemetry.

---

## 5. Scaling roadmap — MN10 as exemplar, then outward

Five stages. Stages 1-3 are about MN10 specifically; stages 4-5 extrapolate.

### Stage 1 (in progress) — Hand-curate MN10 to ~100%

9/51 phases done. At ~30-45 min/phase, ~13 hours of curator time remain if continued linearly.

**Likely won't be completed linearly.** The strategic pivot below changes this: most of the remaining 42 phases are routine and don't warrant hand-curation at this depth. The recommended path is to finish the high-value phases (translator-debate centerpieces: paññā, sati-related compounds, ātāpī/sampajāno/satimā) by hand, and run the pipeline+post-passes on the rest.

### Stage 2 — Wire the v2 overlay into the compiler

The overlay (`config/suttaStudioPromptContextV2.ts`) is shipped but not yet wired into `services/compiler/prompts.ts`. Wiring is ~30 minutes of work.

**Effect:** pipeline output jumps from ~30-40% → ~65% hand-quality. Plain-first §3.4 prose, arrow-earning rule, anchor selection, confidence ranking, translator-debate awareness all land via prompt.

**Decision point:** wire before the next compile-driven sutta. Not urgent if hand-curation continues on MN10 specifically; urgent the moment the pipeline is invoked for any new sutta.

### Stage 3 — Build the 4 deterministic post-passes (~2-3 days)

Each post-pass operates on the compiler's output JSON, post-LLM:

1. **morph-from-DPD-POS** — DPD already provides POS tags (`pron`, `ind`, `noun:masc:nom:sg`, etc.) for resolved lemmas. Map these to `MorphHint` fields and populate `WordSegment.morph` automatically. Closes item 2 in §2.
2. **Citation-linker** — DPD entries cited in the compiler's context have stable IDs. For each `Sense.english` traceable to a DPD gloss, wire the corresponding `sourceCitationIds`. Closes item 4.
3. **Cross-phase facet detector** — scan the compiled packet for lemmas appearing in ≥2 phases; for the second+ appearance, inject a facet referencing the prior phase (per CURATION_PROTOCOL §3.4.1). Closes item 7.
4. **§3.4 linter** — regex + heuristic checks for bracket prefixes (`[Past participle]`, `[Genitive Plural]`), bare `√` symbols, emoji defaults, and tooltips exceeding length thresholds. Flag for human review, don't auto-fix. Closes the failure modes in item 1.

**Effect:** pipeline quality → ~85%. The remaining ~15% is the irreducibly-human work from §3.

**Engineering shape:** each post-pass is a pure function over the packet JSON; can be developed and tested independently. No compiler refactor required.

### Stage 4 — Pipeline+post-pass DN22 as the multiplier demo

DN22 (Mahāsatipaṭṭhānasutta) is the major MN10 parallel — same satipaṭṭhāna structure, longer (more recurring refrains). Ideal next target.

**Process:**
1. Run pipeline (v2 prompts + 4 post-passes).
2. Hand-polish ~5 famously-debated words (overlapping vocabulary with MN10: ekāyano isn't in DN22 but ātāpī/sampajāno/satimā are).
3. Curator review pass over the remaining phases for accept/flag (5-10 min / phase).

**Estimated total:** ~5-6 hours of curator time vs ~30+ hours of pure hand-curation. **~5-6x multiplier.** This is the demonstration the strategy hinges on.

### Stage 5 — Scale to other satipaṭṭhāna-pattern suttas

MN119 (Kāyagatāsatisutta), SN and AN satipaṭṭhāna parallels. The mindfulness sub-corpus is structurally similar; pipeline + post-passes inherit the patterns already cemented in MN10/DN22.

**Estimated:** ~2-3 hours of polish per sutta after the pipeline pass. The mindfulness sub-corpus is covered with maybe 10-15 hours of curator time total.

### Beyond — cross-section to other structural patterns

Outside the satipaṭṭhāna structure, each major *structural pattern* in the Pāli canon (jhāna suttas, dependent-origination suttas, narrative suttas, dialogue suttas, simile-driven suttas) needs its own golden-demo exemplar (~5-10 hours of hand-curation to establish the patterns the pipeline can then inherit).

There aren't infinitely many structural patterns. A rough cut: ~20-30 patterns covering most of the readable canon. Bounded work.

---

## 6. Open questions

Genuine unknowns. Capturing here so the next strategic-pivot conversation has a target.

### 6.1 Translator-tradition database

**Question:** should we build a curated DB of scholarly readings (Bhikkhu Bodhi, Sujato, Thanissaro, Walshe, Horner, Ñāṇamoli, Walpola Rahula) keyed by Pāli lemma?

**Shape:** `{ lemma: 'ekāyano', readings: [{ scholar: 'Bodhi', reading: 'solitary', source: 'MLDB p.145', note: '...' }, ...] }`.

**Defer or now?** Defer. Build incrementally: when the 3rd or 4th contested word surfaces in curation, the data structure becomes obvious. Premature schema decisions on this DB are expensive — better to seed it from real curation cases.

**Cost when ready:** ~2-3 days for ~30-50 contested-word entries covering most of MN/DN/SN.

### 6.2 DPD Lookup-gap pattern

Five surfaces across batches 3-4 needed curatorial fallback because DPD's Lookup table doesn't enumerate them: `Bhikkhavo` (phase-f voc-pl alt), `Bhadante` (phase-g voc-sg honorific), `etad` (phase-h demonstrative), `avoca` (phase-h aorist), `Ekāyono` (phase-1 masc nom sg of `ekāyana`). The lemmas are attested; specific surface forms aren't.

**Two options:**
- File an upstream DPD issue. (Cooperative; uncertain timeline.)
- Build a morphology-generator fallback layer between SQLite Lookup and the heuristic stem-stripper — given a known lemma + POS, generate the expected inflected forms and check before falling back to heuristic.

**Defer or now?** Note pattern, don't fix yet. At 5 surfaces in 9 phases the rate is ~0.5/phase; at the same rate, the full MN10 will yield ~25 Lookup-gaps. If that pattern holds in DN22 it warrants the morphology-generator. Until then, curatorial fallback (notes in the curation log) is sufficient.

### 6.3 Prompt-caching tradeoff

Anthropic's prompt cache has a 5-minute TTL. Caching wins big *within* a single compile run (51 phases × ~3-5 min/phase = the cache stays warm phase-to-phase). It doesn't survive across sessions — a compile spread over days re-pays the input-token cost every restart.

**Implication:** prompt caching is a free win for *compile-once-then-cache* scenarios where the run completes in a sitting. Worth implementing (Stage 2 of §4.3). Less valuable if compilation is intentionally spread across days.

**Open question:** is the typical compile-run all-at-once or session-spread? Empirically TBD — depends on operator workflow.

### 6.4 When to commit to pipeline v2

The v2 overlay is shipped (`config/suttaStudioPromptContextV2.ts`) but not yet wired into `services/compiler/prompts.ts`. Wiring is ~30 min.

**Trigger to wire:** before the next compile-driven sutta. Worth doing now if any compile-on-DN22 is plausible in the near term. Not urgent if hand-curation continues on MN10 specifically.

**Risk of not wiring:** the v2 overlay becomes a dead file. Externalized learnings are only valuable when applied. (CLAUDE.md's "earn-the-externalization" note applies here in reverse — once learnings are externalized, they need to be wired or they decay.)

### 6.5 The pedagogical-fidelity floor for the routine 40 phases

At what pipeline-output quality threshold is the routine phase "good enough" that hand-polish isn't worth it?

Estimated 85% based on what the v2 + post-passes can plausibly produce. **The empirical answer requires running the pipeline on phase-2+ and reading the output.** No abstract answer is available.

**Recommendation:** after Stage 2 wiring + Stage 3 post-passes, compile MN10 phases 2-51 and run a curator pass over the output. Categorize each phase as: (a) accept as-is, (b) light polish, (c) hand-rework. The distribution answers the floor question empirically. Until then, the 85% number is calibrated against batch 1-4 hand-curation but unvalidated against pipeline output.

---

## 7. Cross-references

- `docs/sutta-studio/CURATION_PROTOCOL.md` — the discipline for the human-curation portion. §3.4 (plain-register check), §3.4.1 (cross-phase facet rule), §9.1 (root-cause gate). The protocol assumes hand-curation; this document scopes when that assumption holds.
- `docs/sutta-studio/FEATURES.md` — schema fields the compiler must populate. §1.3 (arrow-earning rule) is the most-referenced post-batch-3 amendment.
- `config/suttaStudioPromptContextV2.ts` — the prompt overlay codifying batches 1-4 learnings. The v2 column in §1.4 and the "yes" entries in §2's column 3 refer to this file.
- `docs/sutta-studio/curation/phase-e.md` — first phase on the DPD root-cause-fixed pipeline; demonstrates what hand-curation produces when DPD resolution is reliable.
- `docs/sutta-studio/curation/phase-1.md` — first teaching content of MN10; introduced the translator-debate cycle as a first-class curation pattern (5 senses on `ekāyano`).
- `services/apiMetricsService.ts` — the telemetry plumbing referenced in §4.
- `services/compiler/` — the LLM-driven compiler whose prompts §5 Stage 2 modifies.

---

*This strategy doc is calibrated against 9/51 phases of MN10 curation. Re-evaluate when DN22 pipeline+post-pass output is available — that's the first empirical test of the multiplier claim.*
