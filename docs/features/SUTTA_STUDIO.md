# Sutta Studio

> Natural-language-to-structured-study-material compiler for Pali suttas

## Overview

Sutta Studio transforms Pali suttas from SuttaCentral into deeply annotated, interactive study phases. It uses an assembly-line compiler architecture where specialized LLM passes incrementally build a rich linguistic and semantic structure called a `DeepLoomPacket`.

**Key Goal**: Make ancient Buddhist texts accessible to modern learners by decomposing Pali words into etymological components, mapping English translations to Pali, and visualizing grammatical relationships through interactive arrows and color-coded blocks.

**Status**: MVP in production with assembly-line pipeline architecture (v9). See `docs/adr/SUTTA-003-sutta-studio-mvp.md` for architectural decisions.

## What is Sutta Studio?

Sutta Studio bridges two worlds:

1. **Linguistic Precision**: Breaks down Pali words into roots, prefixes, suffixes, and stems with etymological tooltips and morphological hints (case, number, verb forms).

2. **Semantic Mapping**: Provides multiple English senses per Pali word, capturing polysemy (words with several related meanings), and maps English tokens back to their Pali sources via "ghost" words (articles, prepositions) that are English-only scaffolding.

3. **Visual Structure**: Arranges phases into readable blocks of 5-8 words, draws directional arrows showing grammatical relationships (ownership, direction, location, action), and allows toggling between study mode (detail-rich) and reading mode (clean layout).

### Use Cases

- **Language Students**: Learn Pali etymology and morphology interactively
- **Buddhist Scholars**: Study canonical texts with word-by-word analysis
- **Translators**: Cross-reference English choices with Pali structure
- **Text Annotators**: Seed databases with machine-assisted linguistic structure

## Core Concepts

### Compilation Pipeline (Assembly Line)

The compiler runs **5 optional passes** that refine structure incrementally:

| Pass | Purpose | Input | Output |
|------|---------|-------|--------|
| **Skeleton** | Groups segments into phases (6-12 per phase) | Raw segments | Phase skeleton |
| **Anatomist** | Segments Pali into words, roots, prefixes | Phase segments | `AnatomistPass` |
| **Lexicographer** | English senses (3 for content, 1-2 for function) | Anatomist output | `LexicographerPass` |
| **Weaver** | Maps English tokens to Pali or marks as "ghost" | English + Anatomist | `WeaverPass` |
| **Typesetter** | Arranges words into layout blocks (max 5 per block) | All passes | `TypesetterPass` |

**Fallback**: If passes fail, a unified PhaseView pass generates minimal output. Degraded views show raw text if all passes fail.

### Data Model

**DeepLoomPacket** (top-level):
```typescript
{
  packetId: string;                    // "sutta-mn10-<hash>"
  source: { provider, workId, workIds };
  canonicalSegments: CanonicalSegment[];
  phases: PhaseView[];
  progress?: { totalPhases, readyPhases, state, etaMs };
  compiler: { provider, model, promptVersion };
}
```

**PhaseView** (per phase):
```typescript
{
  id: string;                   // "phase-1"
  title?: string;
  layoutBlocks?: string[][];    // [[p1, p2], [p3, p4, p5]]
  paliWords: PaliWord[];
  englishStructure: EnglishToken[];
  degraded?: boolean;
}
```

**PaliWord** (per word):
```typescript
{
  id: string;                   // "p1", "p2"
  segments: WordSegment[];      // Morphological breakdown
  senses: Sense[];              // English definitions (1-3)
  isAnchor?: boolean;
}
```

## Architecture

### React Components

| Component | Purpose |
|-----------|---------|
| `SuttaStudioApp.tsx` | Entry point; route parsing, DB init, compiler orchestration |
| `SuttaStudioView.tsx` | Main render; phase navigation, xarrows for relations |
| `SuttaStudioFallback.tsx` | Loading/error state with progress bar |
| `PaliWordEngine.tsx` | Pali word rendering; cycles senses on click |
| `EnglishWordEngine.tsx` | English token rendering; ghost opacity |
| `StudioHeader.tsx` | Top bar with progress chip, study toggle |

### Compiler Service

**Canonical location**: `services/sutta-studio/` (per CONSOLIDATION.md).

Was: a single ~1900-line `services/suttaStudioCompiler.ts` monolith, decomposed
in March 2026. That filename is now a 3-line re-export shim; do not edit it.

Current tree:

- `services/sutta-studio/prompts/` — one builder per pass (skeleton, anatomist,
  lexicographer, weaver, typesetter, phase, morphology) + `index.ts` re-exports
- `services/sutta-studio/passes/` — pure per-pass async functions with an
  injectable `LLMCaller` seam (so benchmarks substitute their own caller)
- `services/sutta-studio/grounding/` — providers for contested terms,
  commentarial glosses (Vism TEI), translator-bank lookups
- `services/sutta-studio/schemas.ts` — all 7 LLM response schemas (PR #62)
- `services/sutta-studio/llm.ts` — `callCompilerLLM`, `callCompilerLLMText`,
  `resolveCompilerProvider` (PR #63)
- `services/sutta-studio/utils.ts` — boundary context, chunking, JSON parsing
- `services/sutta-studio/postPasses/syllabify.ts` — Pali syllabification
  (post-LLM enrichment)
- `services/compiler/index.ts` — still concrete (the 773-line orchestrator);
  CONSOLIDATION Phase 2d / PR D ports it to `services/sutta-studio/orchestrator.ts`

The public entry point `compileSuttaStudioPacket(options)` is unchanged.
It still routes through provider adapters (OpenRouter, OpenAI, Gemini),
enforces a 1-second minimum gap between LLM calls, and logs all errors via
`logPipelineEvent()`.

### Zustand State

The app uses Zustand for global state:
- `Chapter.suttaStudio: DeepLoomPacket | undefined` stores the compiled packet
- `updateChapter()` called on each progress update to persist state

## Usage Guide

### URL Format

```
/sutta/<uid>[?lang=<lang>&author=<author>&recompile=1&stitch=<uid2,uid3>&cross=1]
```

**Parameters**:
- `uid`: SuttaCentral work ID (e.g., `mn10`, `dn16`)
- `lang`: Language code (default: `en`)
- `author`: Translator (default: `sujato`)
- `recompile=1`: Force recompile even if cached
- `stitch=uid2,uid3`: Combine multiple works
- `cross=1`: Allow phases to span multiple works

**Examples**:
```
/sutta/mn10                        # MN10 (Satipatthana Sutta)
/sutta/dn16?recompile=1            # DN16 recompiled
/sutta/mn10?stitch=mn11,mn12       # MN10-12 stitched together
```

### Interaction Patterns

**Pali Words**:
- **Click**: Cycle through senses (1/3, 2/3, 3/3)
- **Hover**: Show segment morphology (case, number, root meaning)

**English Tokens**:
- **Hover**: Show linked Pali word ID or ghost type
- **Ghost**: Rendered at reduced opacity

**Navigation**:
- **← →** buttons: Move between phases
- **Study Mode Toggle**: Turn on/off grammatical arrows

## Current Status

### What Works

- ✅ Full assembly-line compiler (skeleton → anatomist → lexicographer → weaver → typesetter)
- ✅ Graceful degradation (each pass optional)
- ✅ Dictionary integration (SuttaCentral API lookups)
- ✅ Morphology detection (roots, prefixes, case/number hints)
- ✅ Relation visualization (ownership, direction, location, action)
- ✅ Progress tracking (EMA-smoothed ETA)
- ✅ Multi-work stitching
- ✅ Interactive cycling (click words to rotate senses)

### Known Limitations

- ⚠️ **Morphological Accuracy**: LLM sometimes over-segments or misclassifies
- ⚠️ **Polysemy Coverage**: 3 senses approximate; rare terms may lack definitions
- ⚠️ **Performance**: Large texts (100+ segments) take 2-5 minutes per phase
- ⚠️ **Degradation**: If all passes fail, phase shows raw text only

## Key Files Reference

| File | Purpose |
|------|---------|
| `types/suttaStudio.ts` | Type definitions (single source of truth) |
| `services/sutta-studio/prompts/` | Per-pass prompt builders |
| `services/sutta-studio/passes/` | Per-pass pure functions + injectable `LLMCaller` |
| `services/sutta-studio/schemas.ts` | All 7 LLM response schemas |
| `services/sutta-studio/llm.ts` | LLM caller (provider resolve, logging, structured outputs) |
| `services/sutta-studio/grounding/` | Contested terms, commentarial glosses, translator bank |
| `services/sutta-studio/utils.ts` | Boundary context, chunking, JSON parsing |
| `services/sutta-studio/postPasses/syllabify.ts` | Pali syllabification post-pass |
| `services/compiler/index.ts` | Orchestrator (transitional; Phase 2d / PR D moves it) |
| `services/suttaStudioCompiler.ts` | Transitional shim — do not edit |
| `config/suttaStudioPromptContext.ts` | Prompt context blocks |
| `config/suttaStudioExamples.ts` | Example JSON for each pass |
| `services/suttaStudioValidator.ts` | Validation logic |
| `docs/sutta-studio/CONSOLIDATION.md` | Migration plan + per-phase status |
| `docs/sutta-studio/GROUNDING.md` | Grounding architecture + provider contracts |
| `docs/sutta-studio/FEATURES.md` | Current architecture (authoritative) |
| `docs/adr/SUTTA-003-sutta-studio-mvp.md` | Architecture Decision Record (MVP) |
| `docs/adr/SUTTA-007-pass-prompt-runner-layer.md` | ADR for runners (see Amendment) |
| `docs/adr/SUTTA-008-grounded-curation-data-layer.md` | ADR for grounding provenance |
