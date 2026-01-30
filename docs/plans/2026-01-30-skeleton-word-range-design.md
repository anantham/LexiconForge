# Skeleton Word Range Extension

**Date:** 2026-01-30
**Status:** Approved, ready for implementation

## Problem

The demoPacket pedagogically splits long API segments across multiple phases (e.g., mn10:2.1 with 6 words splits into phase-1 with 4 words and phase-2 with 2 words). However, the current `SkeletonPhase` schema only supports segment-level grouping:

```typescript
type SkeletonPhase = { id: string; title?: string; segmentIds: string[] };
```

This means:
- The skeleton pass cannot express sub-segment splits
- The benchmark feeds full segments to anatomist, but golden expects partial
- Model outputs appear "wrong" when they correctly parse all words

## Solution

Extend `SkeletonPhase` with an optional `wordRange` field for sub-segment splitting.

### Schema Change

```typescript
type SkeletonPhase = {
  id: string;
  title?: string;
  segmentIds: string[];
  wordRange?: [number, number]; // [start, end) indices into Pali words
};
```

**Design decisions:**
- Word-level indexing (not segment-level) - simpler, covers 99% of cases
- `[start, end)` - 0-indexed, end exclusive (standard slice semantics)
- Optional - only needed when splitting long segments

### Processing Logic

When `wordRange` is present, slice the Pali text before passing to downstream passes:

```typescript
function getPhaseInput(phase: SkeletonPhase, segments: CanonicalSegment[]) {
  const fullPali = segments.map(s => s.pali).join(' ');
  const fullEnglish = segments.map(s => s.baseEnglish).join(' ');

  if (phase.wordRange) {
    const [start, end] = phase.wordRange;
    const paliWords = fullPali.split(/\s+/);
    return {
      pali: paliWords.slice(start, end).join(' '),
      english: fullEnglish, // Don't slice - let weaver handle mapping
    };
  }

  return { pali: fullPali, english: fullEnglish };
}
```

**English handling:** Pass full English text (don't slice). Pali and English don't have 1:1 word correspondence, and the weaver's job is to map English tokens to Pali sources anyway.

### Prompt Update

Add to `SUTTA_STUDIO_SKELETON_CONTEXT`:

```
SUB-SEGMENT SPLITTING:
When a single segment exceeds 8 Pali words, split it across multiple phases using wordRange.

- wordRange is [start, end) - 0-indexed, end is exclusive
- Count words by splitting on whitespace (punctuation stays with its word)
- Each split phase references the SAME segmentId but different wordRange

Example - segment "Ekāyano ayaṁ, bhikkhave, maggo sattānaṁ visuddhiyā" (6 words):
  { "id": "phase-1", "segmentIds": ["mn10:2.1"], "wordRange": [0, 4] }  // words 0-3
  { "id": "phase-2", "segmentIds": ["mn10:2.1"], "wordRange": [4, 6] }  // words 4-5

WHEN TO SPLIT:
- Segment has > 8 words
- Natural phrase boundary exists (vocative, punctuation, grammatical break)
- Prefer splits at: vocatives (bhikkhave), punctuation, clause boundaries

WHEN NOT TO SPLIT:
- Segment ≤ 8 words (no wordRange needed)
- Would break a compound or tight grammatical unit
```

## Implementation Plan

### Files to Change

| File | Change |
|------|--------|
| `services/suttaStudioPassPrompts.ts` | Add `wordRange` to `SkeletonPhase` type and JSON schema |
| `config/suttaStudioPromptContext.ts` | Add sub-segment splitting guidance to `SKELETON_CONTEXT` |
| `services/suttaStudioCompiler.ts` | Slice Pali when `wordRange` present before passing to anatomist |
| `scripts/sutta-studio/benchmark.ts` | Same slicing logic for benchmark pipeline |
| `test-fixtures/sutta-studio-anatomist-golden.json` | Add `wordRange` to phases 1-7 metadata |

### Implementation Order

1. **Schema + types** - Enables everything else
2. **Prompt update** - Skeleton can now emit wordRange
3. **Processing logic** - Compiler + benchmark respect wordRange
4. **Golden fixtures** - Benchmark can validate correctly

### Not Changing (for now)

- Existing phases a-h (they use 1:1 segment mapping, no splitting needed)
- English slicing (pass full English, let weaver handle mapping)

## Example

**Input segment (mn10:2.1):**
```
Pali: "Ekāyano ayaṁ, bhikkhave, maggo sattānaṁ visuddhiyā"
English: "Bhikkhus, this is the direct path for the purification of beings"
```

**Skeleton output:**
```json
{
  "phases": [
    { "id": "phase-1", "segmentIds": ["mn10:2.1"], "wordRange": [0, 4] },
    { "id": "phase-2", "segmentIds": ["mn10:2.1"], "wordRange": [4, 6] }
  ]
}
```

**Anatomist receives:**
- Phase-1: `"Ekāyano ayaṁ, bhikkhave, maggo"` (4 words)
- Phase-2: `"sattānaṁ visuddhiyā"` (2 words)

**English for both phases:** Full text (weaver maps relevant portions)
