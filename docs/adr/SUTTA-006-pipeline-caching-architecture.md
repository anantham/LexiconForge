# SUTTA-004: Pipeline Caching Architecture

**Date:** 2026-01-30
**Status:** Proposed
**Deciders:** Aditya

## Context

The Sutta Studio pipeline processes suttas through multiple LLM passes (anatomist → lexicographer → weaver → typesetter). For a sutta like MN10 with 235 segments, this is expensive:

- **235 phases × 4 passes × ~$0.002/pass = ~$1.88** (Gemini Flash)
- **235 phases × 4 passes × ~$0.04/pass = ~$37.60** (GPT-4o)

Analysis of MN10 reveals significant repetition:
- **15.3%** of segments are exact duplicates (refrains)
- **76.3%** of words repeat within the sutta
- Key terms like "pajānāti" appear 133x, "viharati" 111x

Pali has a **closed vocabulary** (~20,000 word forms in the entire Tipiṭaka). After processing a few suttas, most words will be cached.

## Decision

Implement a **5-level hierarchical cache** that maximizes reuse while maintaining output quality.

### Cache Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                     CACHE ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  L1: DICTIONARY CACHE (Global, Permanent)          [EXISTS]     │
│  ├── Key: normalized_word                                       │
│  ├── Value: SuttaCentral dictionary response                    │
│  ├── Backend: IndexedDB (browser) / SQLite (scripts)            │
│  └── Scope: ALL suttas, never expires                           │
│                                                                 │
│  L2: MORPHOLOGY CACHE (Global, Model-Versioned)    [IMPLEMENT]  │
│  ├── Key: surface_form                                          │
│  ├── Value: { segments[], tooltips[], wordClass }               │
│  ├── Backend: SQLite                                            │
│  ├── Invalidation: prompt_version change                        │
│  └── Scope: ALL suttas (same word = same segmentation)          │
│                                                                 │
│  L3: SENSES CACHE (Global, Context-Aware)          [FUTURE]     │
│  ├── Key: lemma + wordClass + context_signature                 │
│  ├── Value: { senses[], confidence }                            │
│  ├── Context: bigram neighbors + domain tag                     │
│  └── Scope: ALL suttas with similar contexts                    │
│                                                                 │
│  L4: FORMULA CACHE (Corpus-Level, Curated)         [FUTURE]     │
│  ├── Key: normalized_pali_pattern                               │
│  ├── Value: { template PhaseView, variable slots }              │
│  ├── Patterns: Stock phrases across suttas                      │
│  │   - "evaṃ me sutaṃ" (opening formula)                        │
│  │   - "iti ajjhattaṁ vā X-ānupassī viharati" (satipaṭṭhāna)   │
│  │   - "vivicceva kāmehi..." (jhāna formulas)                   │
│  └── Backend: Git-tracked JSON (version-controlled)             │
│                                                                 │
│  L5: SEGMENT CACHE (Sutta-Specific, Ephemeral)     [IMPLEMENT]  │
│  ├── Key: hash(sutta_id + pali_text)                            │
│  ├── Value: { anatomist, lexicographer, weaver, typesetter }    │
│  ├── Backend: In-memory Map                                     │
│  └── Scope: Single compilation run (refrain deduplication)      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Cache Key Strategies

#### L2 Morphology Key
```typescript
// Simple: just the surface form (punctuation-stripped)
function morphologyKey(surface: string): string {
  return surface.replace(/[,."'—;:!?""'']/g, '').toLowerCase();
}
```

#### L3 Senses Key (Future)
```typescript
// Context-aware: same word in same grammatical context = same senses
type ContextSignature = {
  prevWord: string | null;
  nextWord: string | null;
  domain?: 'meditation' | 'ethics' | 'cosmology' | 'narrative';
};

function sensesKey(lemma: string, wordClass: string, ctx: ContextSignature): string {
  return `${lemma}:${wordClass}:${ctx.prevWord || '_'}:${ctx.nextWord || '_'}`;
}
```

#### L4 Formula Key (Future)
```typescript
// Parameterized patterns - replace variable slots with placeholders
function formulaKey(pali: string): string {
  return pali
    .replace(/[,;.'"]/g, '')
    .replace(/\b(kāye|vedanāsu|citte|dhammesu)\b/g, '{FOUNDATION}')
    .replace(/\b(rūpe|vedanāya|saññāya|saṅkhāresu|viññāṇe)\b/g, '{KHANDHA}')
    .toLowerCase()
    .trim();
}
```

### Invalidation Strategy

| Cache | Invalidate When |
|-------|-----------------|
| L1 Dictionary | Never (SuttaCentral data is stable) |
| L2 Morphology | `SUTTA_STUDIO_PROMPT_VERSION` changes |
| L3 Senses | Prompt version OR model changes |
| L4 Formula | Manual curation only |
| L5 Segment | End of compilation run |

### Estimated Savings

| Stage | First Sutta | After 5 Suttas | After 20 Suttas |
|-------|-------------|----------------|-----------------|
| L1 Dictionary | 0% | 80% | 95% |
| L2 Morphology | 0% | 60% | 80% |
| L3 Senses | 0% | 50% | 70% |
| L4 Formula | 10% | 30% | 40% |
| L5 Segment | 15% | 15% | 15% |
| **Combined** | **~25%** | **~75%** | **~85%** |

## Implementation Plan

### Phase 1: Low-Hanging Fruit (This PR)

1. **L5 Segment Cache** - In-memory exact-match for refrains within a sutta
   - Zero risk (identical input = identical output)
   - 15-40% savings depending on sutta

2. **L2 Morphology Cache** - SQLite-backed word segmentation cache
   - Low risk (morphology is context-independent)
   - 60-80% savings after warmup

### Phase 2: Context-Aware Caching (Future)

3. **L3 Senses Cache** - Requires context signature design
4. **L4 Formula Cache** - Requires pattern library curation

### Phase 3: Cross-Session Persistence (Future)

5. Browser-side IndexedDB for L2/L3
6. Shared cache file for team/CI

## Schema

```typescript
// services/suttaStudioCache.ts

interface MorphologyCacheEntry {
  surface: string;
  segments: Array<{
    text: string;
    type: 'root' | 'prefix' | 'suffix' | 'stem';
    tooltips: string[];
  }>;
  wordClass: 'content' | 'function';
  confidence: number;
  promptVersion: string;
  createdAt: string;
  hitCount: number;
}

interface SegmentCacheEntry {
  paliHash: string;
  anatomist: AnatomistPass;
  lexicographer?: LexicographerPass;
  weaver?: WeaverPass;
  typesetter?: TypesetterPass;
}

interface CacheStats {
  l1Hits: number;
  l1Misses: number;
  l2Hits: number;
  l2Misses: number;
  l5Hits: number;
  l5Misses: number;
  estimatedSavingsUsd: number;
}
```

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Stale cache after prompt changes | Version key includes `SUTTA_STUDIO_PROMPT_VERSION` |
| Context-dependent meanings cached wrong | L3 uses context signature, not just word |
| Cache grows unbounded | LRU eviction, size limits per level |
| Cache corruption | Validation on read, rebuild on error |

## Alternatives Considered

1. **No caching** - Too expensive for full suttas
2. **Simple memoization** - Doesn't persist across sessions
3. **Embedding similarity** - Too risky for accuracy
4. **Pre-computed corpus** - Maintenance burden, doesn't adapt

## References

- MN10 analysis: 235 segments, 524 unique words, 15.3% exact duplicates
- Dictionary cache: `services/localDictionaryCache.ts` (existing)
- Prompt version: `services/suttaStudioPromptVersion.ts`
