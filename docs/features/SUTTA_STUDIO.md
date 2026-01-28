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

**File**: `services/suttaStudioCompiler.ts` (~1900 lines)

- `compileSuttaStudioPacket(options)`: Main entry point
- Routes through provider adapters (OpenRouter, OpenAI, Gemini)
- Enforces 1-second minimum gap between LLM calls
- All errors logged via `logPipelineEvent()` for debugging

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
| `types/suttaStudio.ts` | Type definitions |
| `services/suttaStudioCompiler.ts` | Main compiler logic |
| `config/suttaStudioPromptContext.ts` | Prompt context blocks |
| `config/suttaStudioExamples.ts` | Example JSON for each pass |
| `services/suttaStudioValidator.ts` | Validation logic |
| `docs/adr/SUTTA-003-sutta-studio-mvp.md` | Architecture Decision Record |
