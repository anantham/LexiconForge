# Grounded LLM Authoring for Pāli-Canonical Chants — Design

**Date:** 2026-05-31
**Status:** Approved (design); spec-review iteration 3 (dual review — reviewer subagent + `codex exec`, 2 rounds)
**Branch:** `feat/codex-liturgy-generator`
**Authors:** Aditya + Claude (Opus)
**Relates to:** ADR `docs/adr/LITURGY-001`; the validation/alignment kernel (`f134627`/`9abc235`/`6d6a6f7`); `docs/sutta-studio/GROUNDING.md`.

## 1. Problem

The liturgy reader renders chant sheets from hand-authored `LiturgyDoc` files. Their quality is *inconsistent in depth and grounding*. The existing "liturgy generator" does **not** fix this — it is an alignment-inference + linter + serializer that requires every gloss, morpheme, etymology, and translation to be hand-authored in its input packet. The quality-bearing content is an input, not an output.

This spec covers the stage that produces that content: an LLM-authoring pass that generates **consistent-depth** chant content, **grounded where verifiable evidence exists and honestly marked interpretive where it doesn't**, feeding `LiturgyGeneratorInput` → `buildLiturgyDraft` → review.

Dominant risk: **fabricated citations and Goodharted gloss depth in sacred text.** The reused machinery does NOT prevent this on its own (§3); the design must *enforce* prevention (§5).

## 2. Decisions locked (with the user)

1. **Scope: Pāli-canonical chants first** (Metta = Snp 1.8, Maṅgala, Ratana, Refuges = Khp 1). Non-Pāli deferred (§9).
2. **DPD grounding: build a real subset** (install `better-sqlite3`; `build:dpd`; commit the JSON). See Stage 0 (§4.2) for the build-routing caveat.
3. **Architecture: Approach A — compile-then-bridge**, where "compile" reuses the Sutta Studio **passes + grounding orchestrated headlessly** (the `ground-packet.ts` pattern with the **fs** DPD loader), **not** `compileSuttaStudioPacket()`.
4. **First chant: Metta Sutta (Snp 1.8)** — the existing gold standard, as a calibration target measuring depth + voice drift.

## 3. How grounding actually works (verified against code, both review rounds)

- **DPD is prompt context, not a citation source.** `DpdProvider` is a `LexiconProvider`; its entries are injected into the lexicographer *prompt* so the LLM grounds its sense *wording*. DPD is **not** in `buildDefaultProviders()` and attaches no citations.
- **The grounding pass ADDS provider citations and PRESERVES existing ones — it does not discard.** `applyGroundingToPhase` merges into a `Set` seeded from `sense.citationIds` (`grounding.ts:185-198`; preservation test `grounding.test.ts:204`). **The grounded field is `sense.citationIds`** (what the pass writes and the renderer reads), distinct from the lexicographer schema's LLM-emitted `sourceCitationIds`. A model-emitted id therefore survives.
- **So the no-fabricated-citation guarantee is NOT inherited — this design enforces it** (§5.1).
- **The translator-bank is not in the production grounding path** (`compileSuttaStudioPacket` calls `runGroundingPass` with no verseBank; wiring lives in `scripts/sutta-studio/ground-packet.ts`). **And when a verseBank IS passed, `runGroundingPass` appends the verse citation to *every* word** (`grounding.ts:164`) — which would manufacture blanket per-word grounding. Therefore we do **not** feed a verseBank into per-word grounding; the witness translation + its citation are fetched separately and attached at **witness/doc level**, never per-word (§4.2 Stage 3).
- **Citation coverage is inherently thin.** Deterministic providers cover curated MN10/DN22 terms + Vism. Most liturgy words correctly get **no** citation (interpretive). Value = DPD-grounded sense *quality* + verified citations *where they exist* + a hard guarantee that **no unverified citation is ever emitted** — not blanket coverage.

## 4. Architecture

### 4.1 Pipeline

```
chant config (UID + metadata + translator)
  ├─0 PREREQ      extend build-dpd UID routing for KN/Snp/Khp; build:dpd <uid>; commit data/dpd/<uid>/
  ├─1 COMPILE     run Sutta Studio passes headless (fs DPD loader + lexical grounding providers,
  │                NO verseBank) ─► grounded PhaseView (paliWords[].segments[], senses[].citationIds)
  ├─2 BRIDGE      phaseView ─► partial LiturgyGeneratorInput; resolve sense.citationIds ─►
  │                WordGloss.citations (drop unresolved); LEXICAL citations only
  ├─3 FIELD FILL  Devanāgarī (translit lib → scriptAlt/scriptAlts['pi-Deva'] + segment paliDeva),
  │                accent (concept table), witness.text = real SC translation fetched separately
  │                (its ACTUAL license; citation at witness/doc level), alignTo = inferred (kernel-loud)
  ├─4 VOICE PASS  LLM re-voices each attested sense into REQUIRED WordGloss.gloss; morpheme glosses
  │                only where per-morpheme DPD evidence exists; emits NO citationIds; entailment-checked
  └─5 ENFORCE     strip any unverified citation; AUTHORING-scoped citation-integrity check (NOT the
        +EMIT      corpus validateLiturgyDoc); validateLiturgyDoc; emit OUTSIDE data/liturgy (CLI
                   refuses data/liturgy out-paths); REVIEW REQUIRED; not registered until human confirms
```

### 4.2 Stage detail

- **Stage 0 — DPD subset (prereq, with a build caveat).** `scripts/build-dpd.ts` currently routes only MN/SN/AN/DN UIDs and sends others to `mn` (`build-dpd.ts:518`); **Snp 1.8 / Khp 1 require extending the builder's UID→Bilara routing first** (small, well-scoped). Then `build:dpd snp1.8`, commit `data/dpd/snp1.8/`. The only committed subset today is `data/dpd/mn10`.
- **Stage 1 — Compile (reuse passes, headless).** Orchestrate the passes with `dpd-loader-fs.ts` (**not** the Vite loader, which returns empty under Node and would silently ungroundedness) + the **lexical** grounding providers (contested-terms, commentarial). **No verseBank** (see §3). Output: grounded `PhaseView`.
- **Stage 2 — Bridge (new, pure).** `phaseViewToLiturgyInput`: surface `form`, morpheme `text`/`type` (PhaseView `segments`). Resolve each `sense.citationIds` against the verified registry → `WordGloss.citations` (`Citation` objects), **dropping unresolved ids**. Only **lexical** citations land here. Snapshot-tested.
- **Stage 3 — Deterministic / grounded field fill.**
  - Devanāgarī via a transliteration library → `WordGloss.scriptAlt` (or `scriptAlts['pi-Deva']`) and segment-level `paliDeva`. Deterministic; never the LLM.
  - `accent`: concept table extracted from `accent-alignment.test.ts` → shared `services/liturgy/concepts.ts`.
  - `witnesses[].text`: a real SC translation fetched separately, `by` = translator, **carrying that translation's actual license** — SC Bilara is **CC BY-SA 4.0** (`translatorBank.ts:149`), *not* CC0. Its citation attaches at **witness/doc level**, never per-word. (Note: `metta-sutta.ts:78` mislabels Sujato as CC0 — existing data debt; do **not** copy it.)
  - `alignTo`: inferred by the kernel aligner (already loud + review-gated).
- **Stage 4 — Voice pass (one LLM step, grounded, supplies required glosses).** Re-voices each attested sense into the **required** `WordGloss.gloss`, forbidden from exceeding the attested sense and **forbidden from emitting any citationId**. **Morphemes are optional and emitted only where per-morpheme evidence exists** (DPD construction/root data supplies each `WordMorpheme.gloss`); a word without per-morpheme evidence ships with no morpheme breakdown rather than an invented one. Adversarial **entailment check** gates each gloss.
- **Stage 5 — Enforce + validate + emit + review.** Strip any citation not in the verified set. Run an **authoring-scoped** citation-integrity check (in the generator/authoring path — **not** the corpus-wide `validateLiturgyDoc`, which runs over chants that legitimately carry manual/`ungroundedCitation` citations). Then `validateLiturgyDoc` (unchanged corpus invariants). Emit **outside `data/liturgy/`**; the CLI **refuses an `--out` under `data/liturgy/`**. REVIEW REQUIRED; not registered until human review + confirmed (`preserve`-mode) `alignTo`.

## 5. Anti-fabrication invariants (normative)

1. **No emitted citation is unverified.** Every `WordGloss.citations` entry resolves to a verified provider entry; unresolved ids are dropped at the bridge and re-checked at Stage 5. *New enforcement* (the compiler preserves LLM ids; it does not discard them).
2. **Transliteration, accent, witness line: deterministic or grounded — never LLM.**
3. **Etymology/roots/morpheme glosses only with per-morpheme evidence**; otherwise omitted. No invented roots; no morpheme breakdown without evidence.
4. **The voice LLM re-voices attested meaning only, emits no citationIds**, gated by the entailment check.
5. **Words without verified citations are honestly interpretive.** Thin coverage is acceptable; fabricated coverage is not.
6. **Unverified citations are fatal; absent citations are not — checked in the AUTHORING path only.** The corpus `validateLiturgyDoc` is NOT extended with this (it runs over chants with legit manual citations); the fatal check lives in the authoring pipeline / a generator-scoped validator so it cannot break unrelated registered chants or pull deferred non-Pāli cleanup into this work.

## 6. Module layout

New, under `services/liturgy-generator/authoring/`:
- `config.ts`, `compile.ts` (fs loader + lexical providers, no verseBank; mirrors `ground-packet.ts`), `bridge.ts` (pure; resolves `citationIds`→`WordGloss.citations`, drops unresolved, lexical-only), `transliterate.ts`, `voice.ts` (`callCompilerLLM`; required glosses; no citationIds; entailment check), `citationIntegrity.ts` (authoring-scoped fatal check), `index.ts` (orchestration → `buildLiturgyDraft`).
- `services/liturgy/concepts.ts` — shared accent table (extracted from the accent test).

Reused (named explicitly): `services/liturgy-generator/{pipeline.ts (buildLiturgyDraft), types.ts (LiturgyGeneratorInput), align.ts (inferWitnessAlignment + inferred_alignment_unreviewed), emit.ts, validate.ts (the validateLiturgyDraft adapter)}`; `services/liturgy/validation.ts` (unchanged); Sutta Studio passes + lexical grounding providers + `dpd-loader-fs.ts`.

CLI: a **new** `scripts/liturgy-generator/author-chant.ts` (UID-in → draft-out via `callCompilerLLM`), additive alongside the existing `build-liturgy-draft.ts` (packet-in → draft-out). Both **refuse `--out` under `data/liturgy/`**.

## 7. Testing

- **Deterministic units:** bridge (recorded PhaseView fixture → expected partial input, incl. `citationIds` resolution + unresolved-id drop + lexical-only); transliteration (known IAST→Devanāgarī pairs, correct field shape); accent (concept table).
- **Anti-fabrication:** a sense carrying an unverified `citationId` → asserted stripped + rejected by the authoring-scoped check; a witness/verse citation → asserted NOT on any `WordGloss`; entailment check: over-claiming gloss → flagged; morpheme without evidence → no breakdown emitted.
- **DPD loader:** assert the headless path uses `dpd-loader-fs.ts` and yields non-empty DPD for the committed subset.
- **Corpus safety:** assert the existing corpus `validateLiturgyDoc` is unchanged (manual/ungrounded citations in shipped chants still pass).
- **Offline end-to-end on Snp 1.8:** committed DPD subset + recorded SC fixtures (no network in tests); every emitted word citation resolves; no unverified citation survives; `validateLiturgyDoc` clean.
- LLM calls live only in the CLI; tests use recorded responses.

## 8. Rejected alternatives

- **B — Dedicated liturgy passes:** reimplements/retunes gloss authoring + re-wires grounding. Rejected.
- **C — Grounded-import, minimal LLM:** depth capped at attestation; its discipline folded into Stage 4.

## 9. Deferred scope

Non-Pāli chants; raw-text/OCR ingestion; periodic citation-URL re-verification; cleanup of existing data debt (e.g. metta-sutta CC0 mislabel).

## 10. Risks & open questions

1. **build-dpd UID routing** — only MN/SN/AN/DN today; KN/Snp/Khp need a routing extension before Stage 0. (codex iter-2 Blocker.)
2. **Headless DPD loader** — must inject `dpd-loader-fs.ts`; the Vite loader is empty under Node. (codex iter-1 Blocker.)
3. **Translator-bank blanket grounding** — passing verseBank cites every word; witness citation kept at witness/doc level instead. (codex iter-2 Blocker.)
4. **Citation-integrity check scope** — authoring-path only; the corpus validator must not be made fatal-on-citation. (codex iter-2 Blocker.)
5. **PhaseView segmentation vs. chant display lines** — bridge needs an explicit segmentation strategy.
6. **Review gate** — advisory; mitigated by the CLI refusing `data/liturgy/` out-paths.
7. **Real API cost** (CLI only); headless **cost telemetry is IDB-backed** — needs a Node-safe shim or accept lost batch telemetry.
8. **DPD homographs** — a surface maps to multiple lemmas; the voice pass disambiguates by context.
9. **Voice drift** from the gold standard — why Metta is calibration-first.
10. **License debt** — `metta-sutta.ts` CC0 mislabel must not be copied; correct license carried from the translation source.

## 11. Success criteria (first slice)

The generated Metta Sutta draft, after review: reaches word/morpheme **depth** comparable to the hand-authored gold standard; **every emitted word citation resolves to a verified provider entry** and the authoring-scoped check rejects any that don't; witness/verse citations live at witness/doc level (none smeared across words); words without verified citations are honestly interpretive; the corpus `validateLiturgyDoc` is unchanged and still green; and a human voice-diff quantifies LLM-vs-curated voice drift. Blanket citation coverage is explicitly **not** a success criterion.
