# ADR: Scrollable Stack View for Sutta Studio

**Date:** 2026-01-30
**Status:** Approved
**Author:** Claude + Aditya

## Context

The current carousel-based phase navigation (`← 1/7 →`) creates jarring transitions between phases. Users cannot:
- Compare adjacent phases easily
- See patterns and repeated terms across the sutta
- Maintain visual continuity while exploring

## Decision

Replace the carousel with a **vertically scrollable stack** of all phases.

## Key Requirements

| Requirement | Decision |
|-------------|----------|
| View mode | Replace carousel entirely (not an additional mode) |
| Phase layout | Keep: Pali row → English row → divider |
| Pali-to-Pali arrows | Connect across phases (show on hover to reduce clutter) |
| Context anchors | Remove duplicate anchor words entirely |
| Progress indicator | Side progress bar, visible only while scrolling |
| Performance | Lazy load with prefetch (next 10 when near end) |
| URL hash | Word-level granularity: `#phase-3-p7` |

## Consequences

**Positive:**
- Natural scroll UX familiar to users
- Easy comparison between phases
- Patterns and repetitions become visible
- Deep-linking via URL hash
- Mobile-friendly

**Negative:**
- More content rendered (mitigated by lazy loading)
- Loss of "focused" single-phase view
- Refrain colors require consistent palette management

---

# Implementation Plan

## Phase 1: Core Scrollable Structure
**Goal:** Replace carousel with vertical stack for demo data

### 1.1 Remove carousel navigation
- Remove `← 1/7 →` navigation buttons
- Remove `phaseIndex` state and `usePhaseNavigation` hook
- Remove Framer Motion slide animations

### 1.2 Render all phases vertically
```tsx
<div className="scroll-container overflow-y-auto">
  {packet.phases.map((phase) => (
    <section id={phase.id} key={phase.id}>
      <PaliRow words={phase.paliWords} />
      <EnglishRow tokens={phase.englishStructure} />
      <Divider />
    </section>
  ))}
</div>
```

### 1.3 Add word-level IDs for hash navigation
- Each word div gets `id={`${phaseId}-${word.id}`}`
- Example: `id="phase-3-p7"`

### 1.4 Implement hash scroll-to on load
```tsx
useEffect(() => {
  const hash = window.location.hash.slice(1);
  if (hash) {
    document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
  }
}, []);
```

## Phase 2: Refrain Colors (Replaces Cross-Phase Arrows)
**Goal:** Visually mark repeated phrases/refrains with consistent colors

### Why not arrows?
Cross-phase arrows were considered but rejected:
- Most repetitions are formulaic (Bhagavā, bhikkhu) — arrows add clutter, not insight
- Arrows require viewport tracking and complex rendering
- Sutta structure is *rhythmic* — color captures this better

### 2.1 Define refrain palette
| Refrain | Color | Used for |
|---------|-------|----------|
| bhikkhu | blue | Addressing the monks |
| Bhagavā | gold | The Buddha speaking |
| ātāpī sampajāno satimā | green | "Ardent, aware, mindful" formula |
| vineyya loke abhijjhādomanassaṁ | purple | "Removing covetousness" refrain |
| kāye/vedanāsu/citte/dhammesu | teal | The four objects |

### 2.2 Add `refrainId` to data model
```typescript
// In PaliWord or EnglishToken
refrainId?: string;  // e.g., "ardent-formula", "removing-refrain"
```

### 2.3 Render with consistent colors
- Words with same `refrainId` get same color class
- Creates visual rhythm as you scroll
- No hover/arrow complexity needed

## Phase 3: Progress Indicator
**Goal:** Show scroll progress, visible only while scrolling

### 3.1 Add progress bar component
```tsx
<ProgressBar
  current={currentPhaseIndex}
  total={phases.length}
  visible={isScrolling}
/>
```

### 3.2 Track scroll position
- Use Intersection Observer on phase sections
- Update `currentPhaseIndex` as phases enter/exit viewport

### 3.3 Auto-hide behavior
- Show on scroll start
- Hide 1.5s after scroll stops

## Phase 4: Remove Context Anchors
**Goal:** Clean up duplicate anchor words

### 4.1 Remove `isAnchor` words from rendering
- Filter out words with `isAnchor: true` from `paliWords`
- Or remove them from demo data entirely

### 4.2 Update demo data
- Remove `p4_anchor` (maggo) from phase 2
- Verify no broken references

## Phase 5: Lazy Loading (Production)
**Goal:** Handle large suttas efficiently

- **Initial render**: First 5 phases
- **Prefetch trigger**: When scrolling within 2 phases of the end
- **Load batch**: Next 10 phases
- **Virtualization** (future): For suttas with 100+ phases

---

# Files to Modify

| File | Changes |
|------|---------|
| `components/sutta-studio/SuttaStudioView.tsx` | Replace carousel with scroll container, add hash navigation |
| `components/sutta-studio/demoPacket.ts` | Remove anchor words |
| `components/sutta-studio/ProgressBar.tsx` | New component |
| `components/sutta-studio/hooks/useScrollProgress.ts` | New hook |
| `components/sutta-studio/hooks/useCrossPhaseArrows.ts` | New hook |

---

# Demo First Approach

For the 7-phase demo:
- Skip lazy loading (render all 7 phases)
- Skip cross-phase arrows initially (add in Phase 2)
- Focus on: scroll structure, hash navigation, progress bar

---

# Checklist

- [x] Phase 1.1: Remove carousel navigation
- [x] Phase 1.2: Render phases vertically
- [x] Phase 1.3: Add word-level IDs
- [x] Phase 1.4: Hash scroll-to on load
- [ ] Phase 2: Refrain colors (replaces cross-phase arrows)
- [ ] Phase 3: Progress indicator
- [ ] Phase 4: Remove context anchors from demo
- [ ] Phase 5: Lazy loading (production only)
