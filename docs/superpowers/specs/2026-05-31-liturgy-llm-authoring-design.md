# Grounded LLM Authoring for Pāli-Canonical Chants — Design

**Date:** 2026-05-31
**Status:** Approved (design); spec-review iteration 2 (incorporates dual review — reviewer subagent + `codex exec`)
**Branch:** `feat/codex-liturgy-generator`
**Authors:** Aditya + Claude (Opus)
**Relates to:** ADR `docs/adr/LITURGY-001-liturgy-generator-pipeline.md`; the validation/alignment kernel (`f134627`/`9abc235`/`6d6a6f7`); `docs/sutta-studio/GROUNDING.md`.

## 1. Problem

The liturgy reader renders chant sheets from hand-authored `LiturgyDoc` files. Their quality is *inconsistent in depth and grounding*: the Metta Sutta is at full word-by-word depth; most other sheets are thinner, some with zero citations. The existing "liturgy generator" does **not** fix this — it is an alignment-inference + linter + serializer that requires every gloss, morpheme, etymology, and translation to be *hand-authored in its input packet*. The quality-bearing content is an input, not an output.

This spec covers the stage that produces that content: an LLM-authoring pass that generates **consistent-depth** chant-sheet content, **grounded where verifiable evidence exists and honestly marked interpretive where it doesn't**, feeding `LiturgyGeneratorInput` → `buildLiturgyDraft` → `validateLiturgyDoc` → human review.

Dominant risk, stated up front: **fabricated citations and Goodharted gloss depth in sacred text.** The design's spine is built to prevent it — and, per the review below, to *enforce* that prevention rather than assume the reused machinery already provides it.

## 2. Decisions locked (with the user)

1. **Scope: Pāli-canonical chants first** (Metta = Snp 1.8, Maṅgala, Ratana, Refuges = Khp 1). Non-Pāli chants (Heart Sutra, Zen, dharani, Tibetan) have no grounding corpus and are deferred to later specs (§9).
2. **DPD grounding: build a real subset.** Install `better-sqlite3` (a declared devDep) and run `build:dpd` *for each in-scope UID* (~168 MB one-time download); the per-sutta JSON is committed so later runs are offline. **The only committed subset today is `data/dpd/mn10` (Satipaṭṭhāna) — not an in-scope chant — so building the Snp 1.8 subset is an explicit Stage-0 prerequisite.** `better-sqlite3` is needed only for the build step.
3. **Architecture: Approach A — compile-then-bridge** (alternatives B/C rejected, §8), but see §3/§4: the "compile" step reuses the Sutta Studio **passes + grounding orchestrated headlessly** (the `ground-packet.ts` pattern), **not** `compileSuttaStudioPacket()` directly.
4. **First chant: Metta Sutta (Snp 1.8)** — the existing gold standard, used as a calibration target so "generated vs. hand-authored" is a direct measurement of depth and voice drift.

## 3. How grounding actually works (corrected by review)

The dual spec-review found that several reuse premises in the first draft were **false**. The corrected understanding (the design depends on it):

- **DPD is prompt context, not a citation source.** `DpdProvider` is a `LexiconProvider` (`services/providers/dpd.ts`); its entries are injected into the lexicographer *prompt* (with deterministic `citationId`s) so the LLM grounds its sense *wording* and may *reference* those injected IDs. DPD is **not** wired into `buildDefaultProviders()` and does **not** attach citations.
- **The grounding pass ADDS, and PRESERVES — it does not discard.** `runGroundingPass`/`applyGroundingToPhase` (`services/sutta-studio/passes/grounding.ts`) attach citations from deterministic providers (`ContestedTermProvider`, `CommentarialGlossProvider`, and — only when a `verseBank` is passed — the translator-bank) and **preserve any `citationId`s already on a sense** (a test asserts preservation, `grounding.test.ts:204`). So a model-emitted `citationId` survives. The V2 `SENSE_METADATA` retirement (2026-05-14) reduced LLM citation authoring but did not eliminate the schema field.
- **Therefore the no-fabricated-citation guarantee is NOT inherited — this design must enforce it** (§5.1).
- **The translator-bank is not in the production grounding path.** `compileSuttaStudioPacket()` calls `runGroundingPass` *without* a verseBank; translator-bank wiring lives only in `scripts/sutta-studio/ground-packet.ts`. The witness-translation citation must be wired explicitly (we mirror `ground-packet.ts`).
- **Citation coverage is inherently thin for arbitrary chants.** The deterministic providers cover curated MN10/DN22 contested terms + Vism glosses + (verse) translations. Most liturgy words will correctly get **no** citation and be marked *interpretive*. The value here is: DPD-grounded sense *quality* + verified citations *where they exist* + a hard guarantee that **no unverified citation is ever emitted** — not blanket citation coverage.

## 4. Architecture

### 4.1 Pipeline

```
chant config (UID + metadata + translator)
  │
  ├─0─ PREREQ          build:dpd <uid>  ─►  commit data/dpd/<uid>/  (one-time, needs better-sqlite3)
  │
  ├─1─ COMPILE (reuse  run Sutta Studio PASSES headless (fs DPD loader + grounding
  │     passes, not     providers + translator verseBank), mirroring ground-packet.ts
  │     the Vite        ─► grounded PhaseView (words, segments, senses, provider citations)
  │     compiler)
  │
  ├─2─ BRIDGE (new,    phaseView ─► partial LiturgyGeneratorInput
  │     pure)           forms, morpheme text/type; resolve sense citationIds ─► WordGloss.citations
  │                     (drop any id with no verified citation object)
  │
  ├─3─ FIELD FILL      Devanāgarī (transliteration lib), accent (concept table),
  │     (deterministic  witness.text = real SC translation (carry its ACTUAL license),
  │     / grounded)     alignTo = inferred (kernel-loud, review-gated)
  │
  ├─4─ VOICE PASS      LLM re-voices each attested sense into liturgy voice;
  │     (1 LLM step)    emits NO citationIds; adversarial ENTAILMENT check gates each gloss;
  │                     supplies the REQUIRED WordGloss.gloss / WordMorpheme.gloss
  │
  └─5─ ENFORCE+VALID   strip any unverified citation; validateLiturgyDoc (+ new citation check);
        +EMIT (kernel    emit draft .ts OUTSIDE data/liturgy (CLI refuses data/liturgy paths);
        + new guard)     REVIEW REQUIRED; not registered until human confirms
```

### 4.2 Stage detail

- **Stage 0 — DPD subset (prereq).** `build:dpd snp1.8`; commit `data/dpd/snp1.8/`. Needs `better-sqlite3`.
- **Stage 1 — Compile (reuse passes, headless).** Orchestrate the Sutta Studio passes with the **filesystem DPD loader (`dpd-loader-fs.ts`)** — *not* the Vite loader the in-app compiler uses, which returns empty data under Node/tsx and would silently ungroundedness. Pass the grounding providers **and** a translator `verseBank` (as `ground-packet.ts` does) so verse-level translation citations are available. Output: a grounded `PhaseView` (`types/suttaStudio.ts`: `paliWords[].segments[]`, `.senses[].sourceCitationIds`).
- **Stage 2 — Bridge (new, pure, deterministic).** `phaseViewToLiturgyInput(phaseView, config)` → a *partial* `LiturgyGeneratorInput`: surface `form`, `morphemes[]` (`text`/`type`; PhaseView calls these `segments`). It **resolves each `sourceCitationId` against the verified citation registry and attaches resolved `Citation` objects to `WordGloss.citations`** — dropping any id that does not resolve. Doc-level ritual/canonical references go in `doc.sources`; per-word citations never do. Snapshot-tested against a recorded PhaseView fixture.
- **Stage 3 — Deterministic / grounded field fill (new).**
  - `paliDeva` / `scriptAlt['deva']`: IAST→Devanāgarī via a transliteration library (deterministic; round-trip tested). Never the LLM.
  - `accent`: the Buddha→amber / Dharma→sky / Sangha→rose table, **extracted** from `tests/components/liturgy/accent-alignment.test.ts` into shared `services/liturgy/concepts.ts`.
  - `witnesses[].text`: a real SuttaCentral translation line, `by` = translator, **carrying that translation's actual license** (SC Bilara is **CC BY-SA 4.0**, per `translatorBank.ts:149` — *not* CC0; the first draft's "Sujato, CC0" was wrong). Never LLM-rendered.
  - `alignTo` (witness English → Pāli word): **inferred** by the kernel aligner (already emits `inferred_alignment_unreviewed` + `low_alignment_coverage` + a REVIEW REQUIRED banner). Human confirms before registration.
- **Stage 4 — Voice pass (one generative LLM step, grounded, supplies required glosses).** The liturgy voice is warm, first-person, concrete-first, jargon-free (`feedback_liturgy_voice`); DPD/SC senses are dictionary-style. The LLM is fed a single attested sense and re-voices it into the **required** `WordGloss.gloss` (and `WordMorpheme.gloss`), **forbidden from introducing meaning beyond the attested sense and forbidden from emitting any `citationId`**. An **adversarial entailment check** (second judge call) verifies the voiced gloss is entailed by the attested sense; over-claiming → flagged and withheld.
- **Stage 5 — Enforce + validate + emit + review.** Strip any citation not present in the verified set (defense in depth on top of Stage 2). Run `validateLiturgyDoc` **extended with a new citation-integrity check** (§5). Emit a draft `.ts` **outside `data/liturgy/`**; the author CLI **refuses an `--out` path under `data/liturgy/`** (making the kernel's advisory gate enforceable). REVIEW REQUIRED; not registered until a human reviews and authors the confirmed (`preserve`-mode) `alignTo`.

## 5. Anti-fabrication invariants (normative) — and what each requires building

1. **No emitted citation is unverified.** Every `Citation` on a `WordGloss` must resolve to a verified entry from the deterministic providers (DPD-injected ids, contested-terms, commentarial, translator-bank). **NEW enforcement required** — the compiler *preserves* LLM `citationId`s rather than discarding them, so the bridge (Stage 2) drops unresolved ids and Stage 5 re-checks. *Not inherited.*
2. **Transliteration, accent, and the English witness line are deterministic or grounded — never LLM.**
3. **Etymology/roots only when DPD-attested**; otherwise omitted. No invented roots. (Sutta Studio's anatomist tooltips are ungrounded LLM output; we do not carry them through unless DPD-attested.)
4. **The voice LLM re-voices attested meaning only**, emits no citationIds, and is gated by the entailment check.
5. **Words with no verified citation are honestly interpretive**, never given a fabricated citation. Thin coverage is acceptable; fabricated coverage is not.
6. **Unverified citations are fatal; absent citations are not.** A new `validateLiturgyDoc` check fails the build if any citation is unverified — but a word with *no* citation is valid (honest interpretive). (The current kernel checks morpheme/jargon/id/alignment, **not** citations — so this check is **new work**, not reuse.)

## 6. Module layout

New code (isolated under `authoring/`, single-purpose units):

- `authoring/config.ts` — chant config (UIDs, translator slug, metadata, segmentation).
- `authoring/compile.ts` — headless pass-orchestration using the **fs** DPD loader + grounding providers + translator verseBank (mirrors `ground-packet.ts`).
- `authoring/bridge.ts` — `phaseViewToLiturgyInput` (pure; resolves citationIds → `WordGloss.citations`, drops unresolved).
- `authoring/transliterate.ts` — IAST→Devanāgarī (library wrapper).
- `authoring/voice.ts` — voice LLM pass + entailment check (via `callCompilerLLM`); supplies required glosses; emits no citationIds.
- `authoring/index.ts` — orchestration → `LiturgyGeneratorInput` → `buildLiturgyDraft`.
- `services/liturgy/concepts.ts` — shared accent concept table (extracted from the accent test).
- `services/liturgy/validation.ts` — **extended** with the citation-integrity check (invariant 6).
- `scripts/liturgy-generator/author-chant.ts` — CLI; routes LLM calls through `callCompilerLLM`; **refuses `--out` under `data/liturgy/`**.

Reused: Sutta Studio passes + grounding providers + translator-bank + `dpd-loader-fs.ts`; kernel `pipeline.ts`/`validation.ts`.

## 7. Testing

- **Deterministic units:** bridge (recorded PhaseView fixture → expected partial input, incl. citation resolution + unresolved-id drop); transliteration (known IAST→Devanāgarī pairs); accent (concept-table cases).
- **Anti-fabrication:** a fixture sense carrying a bogus/unverified `citationId` → asserted **stripped** by the bridge and **rejected** by the validator. Entailment check: correct sense + over-claiming gloss → flagged.
- **DPD loader:** assert the headless path uses `dpd-loader-fs.ts` and yields non-empty DPD for the committed subset (guards against the silent-empty Vite-loader trap).
- **Offline end-to-end on Snp 1.8:** against the committed DPD subset + **recorded** SC fixtures (no network in tests); assert every emitted citation resolves to a verified entry, no unverified citation survives, and `validateLiturgyDoc` (with the new check) is clean.
- LLM calls live only in the CLI; tests use recorded/fixture responses.

## 8. Rejected alternatives

- **B — Dedicated liturgy passes:** reimplements/retunes gloss authoring Sutta Studio already does, and re-wires grounding by hand. Rejected.
- **C — Grounded-import, minimal LLM:** depth capped at attestation; its discipline (LLM bounded to attested meaning) is folded into Stage 4.

## 9. Deferred scope

Non-Pāli chants (no grounding corpus); raw-text/OCR ingestion (no UID); a periodic citation-URL re-verification job (registries verify URLs at curation time, not compile time).

## 10. Risks & open questions

1. **Headless DPD loader** — the in-app compiler uses the Vite loader (empty under Node); the design must inject `dpd-loader-fs.ts`. (codex Blocker 3.)
2. **Translator-bank wiring** — not in the production grounding path; must be wired as in `ground-packet.ts`. (codex Should-fix.)
3. **PhaseView segmentation vs. chant display lines** — SC segments may not map 1:1 to displayed segments; bridge needs an explicit segmentation strategy.
4. **Review gate is advisory** — mitigated by the CLI refusing `data/liturgy/` `--out` paths; full enforcement (registry-side) is out of scope.
5. **Citation coverage is thin** — most words honestly interpretive; success is *not* blanket citations (§11).
6. **Real API cost** on the CLI (gated out of tests). **Headless compiler cost tracking** is IDB-backed — needs a Node-safe metrics shim or accept lost cost telemetry in batch.
7. **DPD homographs** — a surface can map to multiple lemmas; the voice pass disambiguates by context, never silently picks the first.
8. **Voice drift** from the curated gold standard — the reason Metta is calibration-first.

## 11. Success criteria (first slice)

The generated Metta Sutta draft, after review: reaches word/morpheme **depth** comparable to the hand-authored gold standard; **every emitted citation resolves to a verified provider entry** and the new validator rejects any that don't; words without verified citations are honestly interpretive (no fabricated citations); `validateLiturgyDoc` (with the citation check) is clean; and a human voice-diff quantifies how far the LLM voice diverges from the curated voice — measuring the Goodhart gap before trusting the pipeline on thinner chants. (Blanket citation coverage is explicitly *not* a success criterion — thin-but-honest is the correct outcome.)
