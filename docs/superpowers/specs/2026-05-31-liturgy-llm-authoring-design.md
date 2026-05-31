# Grounded LLM Authoring for Pāli-Canonical Chants — Design

**Date:** 2026-05-31
**Status:** Approved (design); pending spec-review loop
**Branch:** `feat/codex-liturgy-generator`
**Authors:** Aditya + Claude (Opus)
**Relates to:** ADR `docs/adr/LITURGY-001-liturgy-generator-pipeline.md`; the validation/alignment kernel landed in commits `f134627`/`9abc235`/`6d6a6f7`.

## 1. Problem

The liturgy reader renders chant sheets from hand-authored `LiturgyDoc` files. Their quality is *inconsistent in depth and grounding*: the Metta Sutta is at full word-by-word depth with 16 citations; most other sheets are thinner, and some carry zero citations. The existing "liturgy generator" does **not** fix this — it is an alignment-inference + linter + serializer that requires every gloss, morpheme, etymology, and translation to be *hand-authored in its input packet*. The quality-bearing content is an input, not an output.

This spec covers the stage that actually produces that content: an LLM-authoring pass that generates **consistent-depth, grounded** chant-sheet content and feeds the existing `LiturgyGeneratorInput` → `buildLiturgyDraft` → `validateLiturgyDoc` → human-review path.

The dominant risk, stated up front: **fabricated citations and Goodharted gloss depth in sacred text.** A hallucinated citation in a Buddhist liturgy is an integrity failure, not a cosmetic bug. The design's spine is built around preventing it.

## 2. Decisions locked (with the user)

1. **Scope: Pāli-canonical chants first.** Chants that are SuttaCentral suttas (Metta = Snp 1.8, Maṅgala, Ratana, the Refuges = Khp 1). These are where Sutta Studio's grounding already works. Non-Pāli chants (Heart Sutra, Zen Japanese, dharani, Tibetan) have no grounding corpus and are explicitly deferred to later specs (§9).
2. **DPD grounding: build a real subset.** Install `better-sqlite3` (already a declared devDep) and run `build:dpd` for the chosen chant (~168 MB one-time download); the resulting per-sutta JSON is committed so all later runs are offline. `better-sqlite3` is needed only for the build step, not at lookup/runtime.
3. **Architecture: Approach A — compile-then-bridge.** Reuse the Sutta Studio compiler for grounded glosses/morphemes/citations; bridge its `PhaseView` output into `LiturgyGeneratorInput`; fill liturgy-only fields deterministically or from grounded sources. (Alternatives B and C rejected — §8.)
4. **First chant: Metta Sutta (Snp 1.8)** — the existing gold standard, used as a calibration target so "generated vs. hand-authored" is a direct measurement of depth and voice drift.

## 3. Why this shape (reuse findings)

Sutta Studio already LLM-authors exactly the content we want, from a SuttaCentral UID, and — crucially — has a proven anti-fabrication architecture we inherit rather than reinvent:

- A dedicated **grounding pass** (`services/sutta-studio/passes/grounding.ts`) runs *after* all LLM phases and **discards every LLM-claimed citation**, attaching citations only from deterministic providers: a hand-curated, URL-verified-at-build-time registry (`ContestedTermProvider` + `contested-terms.json`), a commentarial-gloss provider, and a live SuttaCentral translator-bank that emits a citation only for `(segment × translator)` pairs the API actually returns. Anti-pattern guard: "no LLM-as-DB-fallback" — a term with no registry/corpus match gets **no** citation and the sense is marked *interpretive*, not fabricated.
- The V2 `SENSE_METADATA` block (LLM-authored confidence/citationIds) was **retired 2026-05-14** because the model produced "confident-sounding hallucinations." Lesson encoded into this design: never trust LLM output for anything verifiable.
- The canonical structured-JSON LLM entry point is `callCompilerLLM` (`services/sutta-studio/llm.ts`): provider resolution, schema pass-through, telemetry, cost tracking. We route through it (not a hand-rolled fetch) so cost/telemetry are preserved.

## 4. Architecture

### 4.1 Pipeline (five stages)

```
chant config (UID + metadata + translator)
  │
  ├─1─ COMPILE (reuse)     Sutta Studio compiler(UID) ─► grounded PhaseView
  │                         (words, morpheme segments, senses, VERIFIED citations)
  │
  ├─2─ BRIDGE (new, pure)  phaseView ─► LiturgyGeneratorInput (partial)
  │                         surface forms, morphemes[].text/type, citations→doc.sources
  │
  ├─3─ FIELD FILL (new,    Devanāgarī (transliteration lib), accent (concept table),
  │     deterministic/      witness.text = real SC translation (+citation),
  │     grounded)           alignTo = inferred (kernel-loud, review-gated)
  │
  ├─4─ VOICE PASS (new,    LLM re-voices each DPD-attested sense into liturgy voice;
  │     1 LLM step)         adversarial ENTAILMENT check gates each gloss
  │
  └─5─ VALIDATE+EMIT       buildLiturgyDraft ─► validateLiturgyDoc ─► draft .ts
        (reuse kernel)      outside data/liturgy + REVIEW REQUIRED; not registered
```

### 4.2 Stage detail

- **Stage 1 — Compile (reuse).** Run the compiler headless on the UID. Requires the committed DPD subset for the UID and SC translator-bank access. Open risk: the compiler's cost tracking is IDB-backed — a settings/metrics shim is needed for Node/tsx execution (§10).
- **Stage 2 — Bridge (new, deterministic, pure function).** `phaseViewToLiturgyInput(phaseView, config)`. Maps PhaseView words → `WordGloss` (`form`, `morphemes[]` with `text`/`type`), and the grounding pass's verified citations → `doc.sources`. No LLM, no I/O — snapshot-tested against a recorded PhaseView fixture.
- **Stage 3 — Deterministic / grounded field fill (new).** Everything verifiable, never the LLM:
  - `paliDeva` / `scriptAlt['deva']`: IAST→Devanāgarī via a transliteration library (deterministic; round-trip tested).
  - `accent`: the Buddha→amber / Dharma→sky / Sangha→rose concept table, **extracted** from `tests/components/liturgy/accent-alignment.test.ts` into shared `services/liturgy/concepts.ts` (so the test and the authoring stage share one table).
  - `witnesses[].text`: a real SuttaCentral translation line (e.g. Sujato, CC0), `by` = translator, carrying a translator-bank citation. Never LLM-rendered.
  - `alignTo` (witness English → Pāli word): **inferred** by the kernel aligner, which already emits `inferred_alignment_unreviewed` + `low_alignment_coverage` warnings and a REVIEW REQUIRED banner. Human confirms before registration.
- **Stage 4 — Voice pass (the one generative LLM step, grounded).** The liturgy voice is warm, first-person-reflective, concrete-first, jargon-free (per `feedback_liturgy_voice`); DPD senses are dictionary-style. The LLM is fed a single DPD-attested sense and re-voices it, **forbidden from introducing meaning beyond the attested sense**. An **adversarial entailment check** (a second judge call) verifies the voiced gloss is entailed by the attested sense; over-claiming → flagged and withheld, not shipped. Citations remain from Stage 1's grounding pass, never the LLM.
- **Stage 5 — Validate + emit + review (reuse kernel).** `validateLiturgyDoc`; emit a draft `.ts` *outside* `data/liturgy/`; REVIEW REQUIRED banner; not registered until a human reviews and authors the confirmed (`preserve`-mode) `alignTo` arrays.

## 5. Anti-fabrication invariants (normative)

These are the acceptance criteria for "grounded," not nice-to-haves:

1. **Citations come only from the grounding pass's deterministic providers.** Any LLM-emitted citation/confidence is discarded. (Inherited from Sutta Studio.)
2. **Transliteration, accent, and the English witness line are deterministic or grounded — never LLM.**
3. **Etymology/roots are emitted only when DPD-attested**; otherwise omitted. No invented roots. (This tightens the layer Sutta Studio leaves ungrounded — its anatomist tooltips are unverified LLM output.)
4. **Glosses: the LLM re-voices attested meaning only**, gated by the entailment check.
5. **Words with no DPD attestation are marked `interpretive`**, never given a fabricated citation.
6. **Grounding is fatal here.** If a sheet emerges with zero verified citations where it should have them, the stage fails loudly. (Sutta Studio's grounding is non-fatal and can silently ship ungrounded; we do not inherit that.)

## 6. Module layout

New code (isolated under an `authoring/` namespace; each unit single-purpose, testable in isolation):

- `services/liturgy-generator/authoring/config.ts` — chant authoring config type (UID(s), translator slug, liturgy metadata, optional segmentation).
- `services/liturgy-generator/authoring/compile.ts` — thin headless wrapper over the Sutta Studio compiler.
- `services/liturgy-generator/authoring/bridge.ts` — `phaseViewToLiturgyInput` (pure).
- `services/liturgy-generator/authoring/transliterate.ts` — IAST→Devanāgarī (library wrapper).
- `services/liturgy-generator/authoring/voice.ts` — the LLM voice pass + entailment check (via `callCompilerLLM` + a new schema).
- `services/liturgy-generator/authoring/index.ts` — orchestration → `LiturgyGeneratorInput` → `buildLiturgyDraft`.
- `services/liturgy/concepts.ts` — shared accent concept table (extracted from the accent test).
- `scripts/liturgy-generator/author-chant.ts` — CLI, mirrors `scripts/sutta-studio/run-phase-experiment.ts` but routes LLM calls through `callCompilerLLM`.

Reused unchanged: Sutta Studio compiler + grounding + `DpdProvider`; the kernel's `services/liturgy/validation.ts` and `services/liturgy-generator/pipeline.ts`.

## 7. Testing

- **Deterministic units:** bridge (recorded PhaseView fixture → expected `LiturgyGeneratorInput`); transliteration (known IAST→Devanāgarī pairs); accent (concept-table cases).
- **Entailment check:** fixture with a correct sense + a known over-claiming gloss → asserted flagged.
- **Grounding-fatal:** fixture with no citations → asserted failure.
- **Offline end-to-end on Snp 1.8:** against the committed DPD subset + **recorded** SC fixtures (no network in tests); assert every emitted citation is verified and `validateLiturgyDoc` is clean.
- **LLM calls live only in the CLI**, never in tests (tests use recorded/fixture responses).

## 8. Rejected alternatives

- **B — Dedicated liturgy passes:** new chant-tuned LLM passes reusing only the AI caller + grounding providers. Rejected: reimplements and re-tunes the gloss/morpheme authoring Sutta Studio already does well, and re-wires grounding by hand — more surface, less proven.
- **C — Grounded-import, minimal LLM:** DPD senses used directly as glosses; LLM only re-voices. Rejected as the *primary* shape because pure-DPD depth is capped at attestation and misses chant context — but its discipline (LLM bounded to attested meaning) is folded into Approach A's Stage 4.

## 9. Deferred scope

- Non-Pāli chants (Heart Sutra/Sanskrit-Chinese, Zen Japanese, dharani, Tibetan): no grounding corpus exists; each needs new providers and a per-tradition anti-fabrication strategy. Separate specs.
- Raw-text / OCR ingestion (no UID): separate effort.
- A periodic citation-URL re-verification job (the grounding registries verify URLs at curation time, not at compile time).

## 10. Risks & open questions

1. **PhaseView segmentation vs. chant display lines** — SC segments may not map 1:1 to the chant's displayed segments; the bridge needs an explicit segmentation strategy.
2. **Headless compiler execution** — cost tracking is IDB-backed; needs a settings/metrics shim for Node/tsx.
3. **Real API cost** on the author CLI (gated out of tests).
4. **Voice drift** from the curated gold standard — the reason Metta is the calibration-first target; success includes a human diff of generated vs. curated voice.
5. **Witness `alignTo` is inferred**, not authored — relies on the kernel's loud review gate and human sign-off.
6. **DPD homographs** — a surface form can map to multiple lemmas; the voice pass must disambiguate by context, not silently pick the first.

## 11. Success criteria (first slice)

The generated Metta Sutta draft, after grounding and review, reaches word/morpheme coverage comparable to the hand-authored gold standard; every citation is verified (none LLM-claimed); `validateLiturgyDoc` is clean; and a human voice-diff shows where (and how far) the LLM voice diverges from the curated voice — quantifying the Goodhart gap before we trust the pipeline on thinner chants.
