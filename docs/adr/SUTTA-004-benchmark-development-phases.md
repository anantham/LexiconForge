# ADR: SUTTA-004 — Sutta Studio Benchmark Development Phases

**Status:** In Progress
**Created:** 2026-01-30
**Authors:** Aditya, Claude
**Relates to:** SUTTA-003 (Sutta Studio MVP)

## Guiding Questions

### Why are we building this benchmark?

**Primary motivations:**
1. **Model selection** — Which model gives best quality per dollar for each pass?
2. **Prompt iteration** — How do we know if a prompt change improved things?
3. **Regression prevention** — Catch quality degradation before users do
4. **Understanding** — What are models actually good/bad at in this domain?

**NOT trying to:**
- Prove one model is universally "best"
- Create a public leaderboard
- Replace human judgment entirely

### What decisions will this inform?

| Decision | How benchmark helps |
|----------|---------------------|
| "Use Gemini vs DeepSeek for skeleton" | Cost-normalized quality scores |
| "This prompt change is an improvement" | Before/after comparison on same fixture |
| "Ship this to users" | Quality threshold gate (e.g., >90% pairwise) |
| "Focus engineering effort on X pass" | Identify weakest link in pipeline |

### What does "good enough" look like?

This is subjective for Pali study tools. Proposed thresholds:

| Pass | Metric | Acceptable | Good | Excellent |
|------|--------|------------|------|-----------|
| Skeleton | Pairwise grouping | >80% | >90% | >95% |
| Anatomist | Morpheme boundary F1 | >70% | >85% | >95% |
| Weaver | Linking accuracy | >85% | >92% | >98% |

**Open question:** Should we weight errors by severity? (Missing a segment > wrong title)

### How do we handle subjectivity?

The "golden standard" problem: multiple valid groupings exist.

**Example:** Should "Tatra kho bhagavā bhikkhū āmantesi: 'bhikkhavo'ti" be:
- One phase (speaker + vocative + verb + quote)
- Two phases (address | response)

**Proposed approach:**
1. Primary golden: One curated "reference" interpretation
2. Acceptable set: Mark alternative valid groupings
3. Scoring: Full credit for primary, partial credit for acceptable alternatives
4. Inter-annotator: Get 2-3 people to annotate same texts, measure agreement

### What's the relationship between passes?

**Isolation mode:** Each pass tested against golden input
- Pro: Fair comparison, errors don't compound
- Con: Doesn't reflect real pipeline behavior

**Integration mode:** Each pass feeds the next
- Pro: Shows real-world quality
- Con: Hard to attribute blame for errors

**Proposed:** Run both modes, report separately.

### What are we explicitly NOT measuring?

- **Latency/UX** — Separate concern (though we capture duration)
- **Streaming quality** — Benchmark runs are batch
- **Rare edge cases** — Focus on common patterns first
- **Aesthetic preferences** — "I like this phrasing better"
- **Pedagogical effectiveness** — Whether users actually learn better

### Who is the audience for benchmark results?

| Audience | What they care about |
|----------|---------------------|
| Developers (us) | Detailed failure modes, per-pass breakdown |
| Future contributors | Clear methodology, reproducible results |
| Users (maybe someday) | Simple quality score, transparency |

### What's the cost/effort budget?

**Per benchmark run:**
- LLM API cost: <$5 for full suite across 7 models × 3 runs
- Human annotation: ~2 hours for 50 examples (Phase 2)
- Compute: Minutes on local machine

**Acceptable ongoing cost:**
- Weekly full runs: <$20/week
- CI on prompt changes: <$2/run

### Long-term vision

```
Now:        Manual model selection, hope for the best
Phase 1-2:  Understand failure modes, build intuition
Phase 3:    Automated scoring, data-driven model selection
Phase 4:    CI gates, regression prevention
Future:     Adaptive model routing (use cheap model for easy texts,
            expensive model for hard texts)
```

### How do we validate the benchmark itself?

A benchmark is only useful if it correlates with what we actually care about.

**Sanity checks:**
- Does a deliberately bad prompt score worse than a good one?
- Does a model known to be good (e.g., Claude on English) score well?
- Do humans agree with the scores? (Spot-check: "this output is 85% — does that feel right?")

**Failure modes of the benchmark:**
- **Goodharting** — Optimizing for metric while quality degrades
- **Overfitting to fixture** — Model memorizes MN10, fails on DN22
- **False precision** — Reporting 87.3% when error bars are ±10%

**Mitigation:**
- Multiple diverse fixtures
- Periodic human review of "high scoring" outputs
- Report confidence intervals, not point estimates
- Track cases where metric disagrees with human judgment

### When is the benchmark "done"?

**Never fully done, but checkpoints:**

| Milestone | Criteria | Target |
|-----------|----------|--------|
| MVP | Can compare 2 models on skeleton pass | ✅ Done |
| Useful | Failure taxonomy covers 90% of observed errors | Phase 2 |
| Trustworthy | Metrics correlate with human judgment (r > 0.8) | Phase 3 |
| Automated | CI blocks regressions, no manual review needed | Phase 4 |
| Mature | Community-validated fixtures, external contributors | Future |

---

## Context

The Sutta Studio pipeline has multiple LLM-powered passes:
1. **Skeleton** — Groups segments into study phases
2. **Anatomist** — Segments words into morphemes, adds tooltips
3. **Lexicographer** — Provides contextual senses for each word/segment
4. **Weaver** — Maps English tokens to Pali segments
5. **Typesetter** — Arranges layout blocks to minimize crossing lines

We need to benchmark these passes across models to:
- Understand cost/performance tradeoffs
- Identify which models work best for which passes
- Detect regressions when prompts change
- Guide model selection decisions

### Problem

Initial benchmarking (2026-01-30) revealed:
- **20/21 model runs failed** to match expected skeleton grouping
- Root cause: Ambiguous prompt instructions
- Insight: We need to understand failure modes qualitatively before designing metrics

Binary "matches golden" evaluation is insufficient because:
- Doesn't capture partial correctness
- Doesn't categorize HOW outputs differ
- Misses subtle quality differences in natural language outputs

## Decision

Adopt a **phased approach** to benchmark development:

```
Phase 1: Observe  →  Phase 2: Categorize  →  Phase 3: Measure  →  Phase 4: Automate
    ↑                                                                    ↓
    └─────────────── Iterate based on what metrics miss ─────────────────┘
```

---

## Phase 1: Observation (Current)

**Goal:** Understand what kinds of variance exist between model outputs.

**Deliverables:**
- [x] Multi-model benchmark runner (`scripts/sutta-studio/benchmark.ts`)
- [x] Side-by-side comparison UI (`/bench/sutta-studio`)
- [x] Extended fixture with 14 segments, 9 expected phases
- [x] Improved skeleton prompt with explicit grouping rules
- [ ] Run full pipeline (all 5 passes) across models
- [ ] Enhanced diff view with segment-level highlighting

**Key Questions to Answer:**
- What grouping patterns do models get wrong?
- Are errors consistent (systematic) or random (stochastic)?
- Do certain models excel at certain passes?
- What's the cost/quality tradeoff?

**Output Format:**
```
reports/sutta-studio/<timestamp>/
├── metrics.json
├── metrics.csv
└── outputs/
    ├── skeleton-golden.json
    └── <runId>/
        ├── skeleton-aggregate.json
        ├── anatomist-output.json      # TODO
        ├── lexicographer-output.json  # TODO
        └── weaver-output.json         # TODO
```

---

## Phase 2: Failure Taxonomy

**Goal:** Categorize observed differences into named failure modes.

**Deliverables:**
- [ ] Failure mode taxonomy per pass (TypeScript enums)
- [ ] Manual annotation interface in bench UI
- [ ] 50+ annotated examples across models
- [ ] Failure mode frequency report per model

**Skeleton Failure Modes (Draft):**
```typescript
type SkeletonFailure =
  | 'over_split'        // Too many phases (each segment → own phase)
  | 'under_group'       // Too few phases (everything merged)
  | 'boundary_error'    // Right count, wrong segment assignment
  | 'segment_missing'   // Dropped a segment entirely
  | 'segment_duplicate' // Same segment in multiple phases
  | 'title_semantic'    // Wrong meaning (not just different wording)
  | 'title_missing';    // No title when expected
```

**Anatomist Failure Modes (Draft):**
```typescript
type AnatomistFailure =
  | 'word_boundary'     // Wrong space-tokenization
  | 'segment_boundary'  // Wrong morpheme split
  | 'segment_missing'   // Didn't split a compound
  | 'tooltip_factual'   // Wrong etymology or meaning
  | 'tooltip_missing'   // No tooltip when expected
  | 'wordclass_error'   // content vs function misclassified
  | 'relation_missing'  // Didn't mark grammatical relation
  | 'relation_wrong';   // Wrong relation type
```

**Weaver Failure Modes (Draft):**
```typescript
type WeaverFailure =
  | 'link_wrong'        // English → wrong Pali target
  | 'link_missing'      // English word not linked
  | 'ghost_false_pos'   // Marked real word as ghost
  | 'ghost_false_neg'   // Didn't mark ghost when needed
  | 'ghost_kind_wrong'; // required vs interpretive
```

---

## Phase 3: Metric Design

**Goal:** Design quantitative metrics based on observed failure modes.

**Deliverables:**
- [ ] Scoring functions per pass
- [ ] Automated scoring in benchmark runner
- [ ] Metric dashboard in bench UI
- [ ] Cost-normalized scores (quality per dollar)

**Skeleton Metrics (Draft):**

| Metric | Description | Formula |
|--------|-------------|---------|
| Pairwise Accuracy | Do segment pairs stay together/apart correctly? | `correct_pairs / total_pairs` |
| Phase Count Delta | How far off is the phase count? | `abs(pred_count - gold_count)` |
| Segment Coverage | Did we lose any segments? | `intersection / gold_segments` |
| Title Similarity | Semantic similarity of phase titles | Embedding cosine or LLM-judge |

**Anatomist Metrics (Draft):**

| Metric | Description | Formula |
|--------|-------------|---------|
| Word Boundary F1 | Token boundary precision/recall | F1 on boundary positions |
| Segment Boundary F1 | Morpheme split precision/recall | F1 on split points |
| Tooltip Factuality | Are etymologies correct? | LLM-as-judge or dictionary lookup |
| Relation Coverage | Did we mark expected relations? | `marked / expected` |

**Weaver Metrics (Draft):**

| Metric | Description | Formula |
|--------|-------------|---------|
| Linking Accuracy | Correct English → Pali links | `correct / total_links` |
| Ghost Precision | Are marked ghosts actually ghosts? | `true_ghosts / marked_ghosts` |
| Ghost Recall | Did we find all ghosts? | `found_ghosts / actual_ghosts` |

---

## Phase 4: Automation & CI

**Goal:** Continuous, automated benchmark runs with regression detection.

**Deliverables:**
- [ ] CI job on prompt changes
- [ ] Historical metric tracking
- [ ] Regression alerts (Slack/email)
- [ ] Model recommendation engine

**Architecture:**
```
prompt change → CI trigger → benchmark run → compare to baseline
                                  ↓
                    regression detected? → alert + block merge
                                  ↓
                         metrics stored → dashboard update
```

**Statistical Requirements:**
- 10+ runs per model for significance testing
- p < 0.05 threshold for "model X beats model Y"
- Confidence intervals on all reported metrics
- Multiple fixtures (3-5 diverse text types)

---

## Fixtures Roadmap

Current fixture covers MN10 opening (formulaic prose). Need diversity:

| Fixture | Text Type | Segments | Purpose |
|---------|-----------|----------|---------|
| `mn10-opening` | Formulaic prose | 14 | Current — tests standard patterns |
| `dhp-verse` | Verse (gāthā) | ~10 | Tests verse/meter handling |
| `an-list` | Numbered lists | ~15 | Tests list/enumeration structure |
| `jataka-narrative` | Story prose | ~20 | Tests narrative/dialogue |
| `abhidhamma-def` | Technical definitions | ~10 | Tests dense technical text |

---

## Current Status

### Completed
- [x] Benchmark runner with multi-model support
- [x] Skeleton pass benchmarking
- [x] Side-by-side comparison UI
- [x] Extended fixture (3 → 14 segments)
- [x] Improved skeleton prompt with explicit rules

### In Progress
- [ ] Enable all pipeline passes in benchmark
- [ ] Add output capture for non-skeleton passes
- [ ] Enhanced diff view with failure highlighting

### Blocked
- [ ] Failure taxonomy (needs observation data)
- [ ] Metric design (needs failure taxonomy)
- [ ] CI automation (needs stable metrics)

---

## Consequences

**Positive:**
- Metrics designed from observed failure modes, not assumptions
- Phased approach allows learning before committing to metrics
- Failure taxonomy enables targeted prompt improvements
- Automated regression detection prevents quality degradation

**Negative:**
- Slower path to "production benchmark" than ad-hoc metrics
- Manual annotation required in Phase 2
- LLM-as-judge metrics add cost and complexity

**Risks:**
- Golden standards may be subjective (mitigate: inter-annotator agreement)
- Failure taxonomy may not cover all cases (mitigate: "other" category + iteration)
- Model performance may be fixture-dependent (mitigate: diverse fixtures)

---

## References

- Benchmark runner: `scripts/sutta-studio/benchmark.ts`
- Benchmark config: `scripts/sutta-studio/benchmark-config.ts`
- Bench UI: `components/bench/SuttaStudioBenchmarkView.tsx`
- Fixture: `test-fixtures/sutta-studio-golden-data.json`
- Prompt context: `config/suttaStudioPromptContext.ts`
