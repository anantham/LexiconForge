# Segment-Level Architecture Plan

**Date:** 2026-01-29
**Status:** ✅ Complete (v1 features done)

## Summary

Rearchitect Sutta Studio to use segments as the atomic unit for English linking, cycling, and relations. This enables proper handling of Pali compound words where each morpheme has distinct meaning.

## Design Decisions

### Always On Features
- [x] Underline segments on hover
- [x] Alignment arrows (Pali segment → English)
- [x] Click segment to cycle its English meaning
- [x] Highlight linked pair on hover (Pali ↔ English bidirectional)
- [x] Ghost words at 30% opacity, italic
- [x] Color by word class (content=green, function=white, vocative=yellow)
- [x] Phase navigation (←/→)
- [x] Ripple effects (cycling sense changes related ghosts)
- [x] Keyboard navigation (arrows for phase, tab for segments)

### Study Mode Toggle Features
- [x] Grammar arrows (Pali ↔ Pali relations)
- [x] Tooltips (etymology, morph hints)
- [x] Pin hover state (click to lock tooltip/highlight)

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

### Phase 3: UI Components ✅
- [x] Derive color from wordClass in PaliWord component
- [x] Support segment-level cycling (click segment → cycle its senses)
- [x] Support segment-level alignment arrows
- [x] Use segment IDs for DOM elements (for arrow targeting)
- [x] Support segment-to-segment relations in grammar arrows
- [x] Bidirectional hover highlight (Pali ↔ English)
- [x] Pin hover state when study mode on
- [x] Keyboard navigation (←/→ phase, Tab segments, Enter cycle)

### Phase 4: Cleanup ✅
- [x] Update demoPacket.ts with segment IDs and wordClass
- [x] Update demoPacket.ts relations to use targetWordId
- [x] Fix validator fallback segment creation
- [x] Remove deprecated `targetId` usage from other files
- [x] Remove debug console.logs from PaliWord
- [x] Add vocative word class color (yellow)

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
