# Segment-Level Architecture Plan

**Date:** 2026-01-29
**Status:** In Progress

## Summary

Rearchitect Sutta Studio to use segments as the atomic unit for English linking, cycling, and relations. This enables proper handling of Pali compound words where each morpheme has distinct meaning.

## Design Decisions

### Always On Features
- [ ] Underline segments on hover
- [ ] Alignment arrows (Pali segment → English)
- [ ] Click segment to cycle its English meaning
- [ ] Highlight linked pair on hover (Pali ↔ English bidirectional)
- [ ] Ghost words at 30% opacity, italic
- [ ] Color by word class (content=green, function=white, vocative=yellow)
- [ ] Phase navigation (←/→)
- [ ] Ripple effects (cycling sense changes related ghosts)
- [ ] Keyboard navigation (arrows for phase, tab for segments)

### Study Mode Toggle Features
- [ ] Grammar arrows (Pali ↔ Pali relations)
- [ ] Tooltips (etymology, morph hints)
- [ ] Pin hover state (click to lock tooltip/highlight)

### Future Features (Not in v1)
- Citation display for definitions
- Search/jump to phase

## Type Changes (✅ DONE)

```typescript
WordSegment: {
  id: string,           // NEW: required for linking
  senses?: Sense[]      // NEW: segment-level cycling
}
EnglishToken: {
  linkedSegmentId?: string  // NEW: primary
  linkedPaliId?: string     // FALLBACK
}
Relation: {
  targetSegmentId?: string  // NEW: segment-to-segment
  targetWordId?: string     // Kept: segment-to-word
}
PaliWord: {
  wordClass?: WordClass     // NEW: for color derivation
}
```

## Implementation Tasks

### Phase 1: Prompts ✅
- [x] Update Anatomist prompt with segment ID examples
- [x] Update Anatomist to output segment-level relations for compounds
- [x] Update Lexicographer prompt for segment-level senses
- [x] Update Weaver prompt for segment-level linking
- [x] Add clear examples showing compound word handling (in suttaStudioExamples.ts)

### Phase 2: Compiler/Rehydrator ✅
- [x] Update rehydrator to process segment senses
- [x] Update rehydrator to handle segment-level English linking
- [x] Validate segment IDs are unique within phase
- [x] Include segment IDs in all WordSegment output
- [x] Support both targetWordId and targetSegmentId in relations
- [x] Include wordClass from Anatomist for color coding

### Phase 3: UI Components (In Progress)
- [x] Derive color from wordClass in PaliWord component
- [ ] Support segment-level cycling (click segment → cycle its senses)
- [x] Support segment-level alignment arrows
- [x] Use segment IDs for DOM elements (for arrow targeting)
- [x] Support segment-to-segment relations in grammar arrows
- [ ] Bidirectional hover highlight (Pali ↔ English)
- [ ] Pin hover state when study mode on
- [ ] Keyboard navigation (←/→ phase, Tab segments, Enter cycle)

### Phase 4: Cleanup (In Progress)
- [x] Update demoPacket.ts with segment IDs and wordClass
- [x] Update demoPacket.ts relations to use targetWordId
- [x] Fix validator fallback segment creation
- [ ] Remove deprecated `targetId` usage from other files
- [ ] Update examples in config files
- [ ] Test with various compound types

## Example: Satipaṭṭhānasutta

**Expected Output:**
```
Pali Segments:
  p1s1: "Sati"      → senses: [Mindfulness, Memory, Awareness]
  p1s2: "paṭṭhāna"  → senses: [Foundation, Establishment]
  p1s3: "sutta"     → senses: [Discourse, Thread]

English Tokens:
  e0: "Mindfulness" → linkedSegmentId: "p1s1"
  e1: "Meditation"  → linkedSegmentId: "p1s2"

Relations (study mode):
  p1s1 → p1s2 (compound: "mindfulness of foundation")
```

## Keyboard Navigation Spec

| Key | Action |
|-----|--------|
| ← | Previous phase |
| → | Next phase |
| Tab | Focus next segment |
| Shift+Tab | Focus previous segment |
| Enter/Space | Cycle focused segment's sense |
| Escape | Clear focus/pin |
| S | Toggle study mode |

## Bug Investigation (2026-01-29)

### Confirmed Issues via Pipeline Logs

#### Phase-4: kammāsadhammaṁ nāma
**Symptoms:**
- kammāsadhammaṁ rendered as single segment (no morpheme breakdown)
- nāma shows "belongs to" but no grammar arrow visible

**Root Cause (CONFIRMED via API logs):**
1. **Anatomist returned kammāsadhammaṁ as single segment** - AI treated it as opaque proper noun despite prompt requesting compound segmentation
2. **nāma relation EXISTS** - Anatomist returned r6: `fromSegmentId: "p7s1", targetWordId: "p6", type: "action", label: "Qualifier"` - relation type is wrong (should be "naming")
3. **9 words is correct** - The sentence has 9 space-separated tokens

**Fixes Implemented:**
- [x] Add "naming" relation type to Anatomist prompt examples
- [x] Add place name compound segmentation example (kammāsadhammaṁ → kammā + āsa + dhammaṁ)

#### Phase-7: Satipaṭṭhānasutta linked as single word
**Symptoms:**
- "Satipaṭṭhānasutta" linked to single English word, not segments

**Root Cause (CONFIRMED via API logs):**
1. **Anatomist returned CORRECT 17 words with 43 segments** - p17 has segments p17s1="sati", p17s2="paṭṭhānā"
2. **Weaver ignored linkedSegmentId** - AI returned `linkedPaliId: "p17"` instead of `linkedSegmentId: "p17s1"` despite explicit examples
3. **Truncation AFTER passes** - "unbalanced_json: Truncated JSON payload" occurred during final assembly, not API calls

**Fixes Implemented:**
- [x] Stronger examples in Weaver prompt for segment-level linking (explicit WRONG vs CORRECT examples)
- [x] Increase max tokens to prevent truncation (4000 → 8000 for Weaver and PhaseView)
- [x] Add validation to log when Weaver uses linkedPaliId instead of linkedSegmentId

#### Phase-8: Too many words
**Symptoms:**
- Phase has 14 words, feels too large

**Root Cause (CONFIRMED via API logs):**
1. **14 words is expected** - Phase combines mn10:3.1 + mn10:3.2 (2 canonical segments)
2. **Issue is skeleton segmentation** - Compiler groups too many canonical segments per phase

**Fixes Implemented:**
- [x] Update skeleton context prompt to limit phases to 5 words OR 9 segments max

### Summary of AI Limitations vs Pipeline Issues

| Issue | Type | Evidence |
|-------|------|----------|
| Weaver ignores linkedSegmentId | AI Intelligence | Explicit examples in prompt, AI used linkedPaliId anyway |
| Anatomist doesn't segment place names | AI Intelligence | Prompt shows compound examples, AI treated as opaque noun |
| Relations use wrong types | AI Intelligence | "action/Qualifier" instead of "naming" |
| Phase truncation | Pipeline | JSON too large after successful API calls |
| Phases too large | Pipeline | Skeleton groups too many canonical segments |
