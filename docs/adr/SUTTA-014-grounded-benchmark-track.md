# SUTTA-014 — Grounded benchmark track (benchmark↔production parity)

**Status:** Proposed — designed 2026-07-03. Target: rubric v2.2, implemented TOGETHER with
SUTTA-013 so the model fleet re-runs once, not twice.
**Closes:** task #19, carried since 2026-07-01 as a material caveat on every published score.

## Context

The ranked board's methodology note admits it: *"All ranked runs use the IDENTICAL harness
pipeline — scores are comparable to each other but NOT to the richer production pipeline."*
The harness starves models relative to what production feeds them, so the board measures
"how well does a model do sutta analysis with less help than production gives it."

Two things changed this week:

1. **We measured the gap's consequences.** The MN117 production bake-off showed benchmark
   profiles DO transfer (deepseek-v4-flash's benchmark drop-penalty profile predicted its
   40%-coverage production collapse; gemini's benchmark win predicted its production win) —
   but transfer was luck of the failure mode, not design. A production-model decision
   deserves a production-shaped instrument.
2. **The infrastructure now exists.** `scripts/sutta-studio/compile-packet.ts` runs the real
   compiler headless, and the canonical pass runners already accept every production input
   as optional parameters.

### The actual parity gap (measured against the code, 2026-07-03)

| Input | Production (`compiler/index.ts`) | Benchmark (`benchmark.ts`) |
|---|---|---|
| DPD attestations (`dpdLookups`) | fed to anatomist + lexicographer | **already fed** (since #21) — at parity |
| SC dictionary (`dictionaryEntries`) | fetched per content word, cached | **hardcoded `{}`** |
| `retrievalContext` | built from segments | **never passed** |
| Prior-phases window (`priorPhases`, v12-b) | last 3 compiled phases | **never passed** |
| Morphology fallback pass | runs when anatomist fails | absent (benchmark scores the failure instead — correct for measurement) |
| Grounding post-pass (citations) | runs | absent (doesn't affect fidelity scoring; citations aren't ranked) |

So "parity" = passing three more arguments the pass runners already accept, plus the input
assembly (one network fetch + two pure builders).

## Decision 1 — Fixed skeleton, production inputs

The grounded track keeps the harness's FIXED phase segmentation and upgrades the INPUTS.
Models do NOT run their own skeleton pass.

Why: the golden is keyed to the fixed 51-phase MN10 segmentation. Production skeletons are
nondeterministic — the same model segmented MN117 into 175 phases in one run and 121 in the
next. Model-run skeletons would (a) detach every phase from its golden entry, making
fidelity unscorable, and (b) make cross-model comparison depend on segmentation luck.
Skeleton quality is a real question, but it is a SEPARATE benchmark (boundary-F1 vs the
canonical cut — already on the deferred list) with its own reference, not a rider on this one.

## Decision 2 — Score the RAW output; publish repair count as a column

Production now auto-repairs mangled surfaces (`repairAnatomistSurfaces`, SUTTA-025
enforcement). The benchmark does NOT apply the repair before scoring.

Why: the repair would flatten every model's textIntegrity to ~1.0 by construction, masking
exactly the discipline signal the gate exists to price (MN117: gemini needed 77 corrections,
deepseek 72 in ~120 phases — a real, model-differentiating measurement). The board instead
gains a **Repairs** column: the count of words production's repair layer WOULD have to fix
(computable deterministically from the raw output vs the canonical text — same alignment as
the repair function, no LLM). Readers see both truths: what the model emits, and that
production ships clean text regardless.

## Decision 3 — The ranked board becomes the grounded track

- **Ranked board = grounded track.** The board's purpose is the production-model decision;
  it should measure models under production conditions. This is a rubric bump (v2.1 → v2.2,
  shared with SUTTA-013's metric changes) and a full fleet re-run — stored v2.1 outputs
  CANNOT be re-scored into v2.2 because the pipeline inputs changed, which is exactly why
  this lands BEFORE the next multi-model pass, not after.
- **Closed-book becomes an occasional secondary sweep**, not a per-board obligation. The
  operator's standing position holds: *"parametric knowledge, recall is good to test... we
  need something to check how much models hallucinate."* The closed-book vs grounded DELTA
  (how much does grounding rescue a model; who fabricates when starved) is itself a finding,
  but it doesn't need refreshing with every board. Existing v2.1 closed-book boards stay
  archived and disclosed.
- The board's methodology note and closed-book badge update accordingly; the grounding/
  provenance panel gains a row for the SC dictionary as an input source.

## Implementation sketch (~0.5-1 day, after SUTTA-013's scorer changes)

1. `benchmark.ts` `runPipelineForPhase`: build and pass `retrievalContext`
   (`buildRetrievalContext(segments)`), `dictionaryEntries` (production's fetch+cache path,
   extracted into a shared helper so compiler and benchmark literally share it), and
   `priorPhases` (thread the model's own compiled phases forward, window 3).
2. Prior-phases threading makes each model's phases SEQUENTIAL (matches production; phase
   parallelism across MODELS is unaffected). Benchmark wall-clock rises accordingly.
3. Repairs column: run `repairAnatomistSurfaces` in "measure-only" mode on each phase's raw
   anatomist output; count, don't apply.
4. Leaderboard: `RANKED_RUBRIC_VERSION = '2.2'` (single bump shared with SUTTA-013),
   `grounding.closedBook = false` with the note rewritten, repairs column added,
   hard-fail on mixed-version runs already enforced.
5. Re-run the fleet once on v2.2 (the multi-model pass the operator has queued).

## Out of scope

- Model-run skeletons (separate benchmark, separate reference).
- Applying surface repair before scoring (Decision 2 forbids it).
- MN117 golden (SUTTA-013 workflow reruns on MN117 later; grounded track works on MN10 today).

## Consequences

- Scores stop carrying the "weaker-than-production" caveat; the board finally measures the
  thing it exists to decide.
- v2.1 and v2.2 numbers are not comparable, by design and by version gate. The board says so.
- Benchmark runs get slower (sequential phases per model, dictionary fetches) and marginally
  costlier (longer prompts, ~zero extra calls). Flash-tier stays well under $1/run.
- The closed-book recall question survives as a deliberate occasional experiment instead of
  a permanent tax on every board refresh.
