# Sutta Studio Assembly-Line Pipeline Roadmap

Date: 2026-01-28  
Status: Accepted  
Owner: Aditya + Codex  
Scope: Compiler pipeline (assembly-line), prompt contracts, rehydration, rate limits, error handling, and test harness.

## Purpose
Ship a quality-first, sequential compiler pipeline that preserves ambiguity, reduces LLM overload, and keeps the UI stable and debuggable.

## Guiding Principles (Vision Alignment)
- Translation is holographic, not linear; preserve polysemy and ambiguity.
- Ghost words are scaffolding, not source truth.
- Visual syntax should reveal deep structure without enforcing word order.
- Treat each pass as a specialist, not a generalist.

---

## Phase State Envelope (Plain Text)
All LLM calls must include a plain-text "Phase State Envelope" before the JSON input payload.

Example:
```
=== PHASE STATE (READ ONLY) ===
• Work: mn10
• Phase: 12 (active)
• Segments: mn10:3.2 — mn10:3.6
• Current Stage: Lexicographer (2/4)

STATUS CHECK:
[x] Anatomist: Nodes & Grammar established.
[ ] Lexicographer: PENDING...
[ ] Weaver: PENDING...
[ ] Typesetter: PENDING...

INVARIANTS:
1) Do NOT add/remove Pali IDs (p1, p2...).
2) Do NOT change segment definitions.
3) Do NOT alter semantic definitions.
================================
```

---

## Pipeline Overview (Assembly Line)
1) Skeleton (chunked)  
2) Anatomist  
3) Lexicographer  
4) Weaver  
5) Typesetter  
6) Validator (full, at end)

Rationale: Isolate cognitive tasks, reduce JSON complexity, and preserve handoff clarity.

---

## Phase 0.5 — Golden Set Benchmark (Testing)
Goal: Benchmark prompt quality without compiling the full sutta.

Deliverables:
- Pick a complex MN10 paragraph.
- Create a hand-authored "golden" JSON output.
- Add a diff test harness that compares pipeline output to golden.

Success criteria:
- Clear diffs for segmentation errors and missing senses.

---

## Phase 1 — Skeleton Pass (Chunked)
Goal: Avoid truncation on long suttas and preserve semantic phase grouping.

Plan:
- Split canonical segments into 50-segment windows.
- Run skeleton pass per window.
- Merge results; renumber phase IDs.
- Optional merge of adjacent phases if boundary splits a clause.

Success criteria:
- No "finish_reason: length" for skeleton on MN10.

---

## Phase 1.4 — Throttled Queue (Rate Limit + Cost Control)
Goal: Prevent 429s and runaway costs.

Plan:
- Implement a throttled queue (e.g., 1 phase at a time, 1s delay between passes).
- Optional per-phase concurrency: disabled by default.
- Surface cost estimate or token counter in settings/progress UI.

Success criteria:
- No 429s during full MN10 compile on OpenRouter/Gemini.
- User can see cost before/while compiling.

---

## Phase 2 — Anatomist (Flattened Schema)
Goal: Create nodes + morphology + relations only.

Key rules:
- No meanings, no English.
- Segments must concatenate to surface text exactly.
- Word class encoded here (content vs function).

Output:
- words[] + segments[] + relations[] + handoff (confidence/flags)

---

## Phase 2.5 — Rehydrator Utility (Missing Link)
Goal: Join flattened outputs into the UI-ready PhaseView tree.

Function:
```
rehydratePhase(anatomist, lexicographer, weaver, typesetter) -> PhaseView
```

Responsibilities:
- Group segments by wordId.
- Attach senses by id (content vs function).
- Attach englishStructure and layoutBlocks.
- Strip invalid relations/links and preserve fallback behavior.

Success criteria:
- Always produce a valid PhaseView for UI rendering.

---

## Phase 3 — Lexicographer (Senses Only)
Goal: Rich, contextual meanings without hallucination.

Rules:
- Content words: exactly 3 senses.
- Function words: 1-2 senses.
- If segmentation seems wrong, flag in handoff.segmentationIssues.

Optional RAG:
- If dictionary data is available, inject raw definitions into prompt.

---

## Phase 3.3 — Give Up State (Graceful Degradation)
Goal: Avoid infinite retries and blank UI.

Rules:
- If a pass fails max_retries, return a "Raw Phase" view:
  - Pali text and English text side-by-side.
  - No relations, no graph, no weaving.
- Mark phase as degraded in progress state.

---

## Phase 3.4 — English Tokenization Standard
Goal: Ensure stable English mapping with Weaver.

Rule:
- Tokenize English in code, do not let LLM reword.

Recommended splitter:
```
text.split(/(\\s+|[.,;?!])/)
```

Weaver input:
```
Tokens: ["Thus"," ","have"," ","I"," ","heard","."]
```
Weaver output:
- Return token indices for non-ghost tokens.

---

## Phase 4 — Weaver (Syntax Mapping)
Goal: Link English tokens to Pali IDs with ghost scaffolding.

Rules:
- Do not alter token text.
- Ghosts are permitted when implied by morphology.
- Link ghosts to word IDs (stable), not segment IDs.

---

## Phase 5 — Typesetter (Layout Only)
Goal: Minimize crossing lines using relations + englishStructure ordering.

Rules:
- layoutBlocks are hints only.
- UI fallback chunks to <=5 words if layoutBlocks invalid.

---

## Phase 6 — Dictionary RAG (Optional Enhancement)
Goal: Ground senses in authoritative sources.

Plan:
- Start with SuttaCentral dictionary lookup.
- Later add DPD data as a local/hosted option.
- Cache dictionary results per `{surface, lang, source}`.

---

## Error Handling & Sanity Checks
Light checks between passes:
- segment wordId exists
- relation endpoints exist
- englishStructure links exist
- layoutBlocks only include known IDs

Repair flow:
- If Lexicographer flags segmentation issues, run targeted Anatomist repair for those words and rerun Lexicographer for the subset.

---

## Deliverables Checklist
- [x] Chunked skeleton pass (Codex, 2026-01-28)
- [x] Throttled queue (Codex, 2026-01-28)
- [x] Anatomist pass (flattened schema) (Codex, 2026-01-28)
- [x] Rehydrator utility (Opus, 2026-01-28)
- [x] Lexicographer pass (3/1-2 senses) (Codex, 2026-01-28)
- [x] Weaver pass (token indices) (Opus, 2026-01-28)
- [x] Typesetter pass (layout hints) (Opus, 2026-01-28)
- [x] Graceful degraded-phase rendering (Opus, 2026-01-28)
- [ ] Cyclable indicator in UI
- [ ] Golden set benchmark test
- [ ] Remove PhaseView fallback prompt (blocked: needs testing)

