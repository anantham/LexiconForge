# Semantic Diff Heatmap Implementation Plan

**Created:** 2025-10-16
**Status:** Ready for Implementation
**Complexity:** High
**Estimated Effort:** 3-5 days (TDD approach)

---

## Executive Summary

Implement a chapter-level semantic difference visualization system that shows readers where AI translations diverge from reference texts (fan translation and/or raw source). The system displays subtle colored markers in a micro-rail gutter, enabling readers to quickly identify potential mistranslations, omissions, or hallucinations without disrupting the reading flow.

**Key Innovation:** Works with OR without fan translation—always provides value by comparing AI against raw text.

---

## Table of Contents

1. [Design Decisions](#design-decisions)
2. [Architecture Overview](#architecture-overview)
3. [Data Model](#data-model)
4. [Implementation Tasks](#implementation-tasks)
5. [Testing Strategy](#testing-strategy)
6. [Deployment Checklist](#deployment-checklist)
7. [Future Enhancements](#future-enhancements)

---

## Design Decisions

### Core Principles

**1. Paragraph-Level Granularity**
- Split AI translation by `\n\n` (double newline)
- Fan/raw remain as full text strings (AI does implicit alignment)
- Chunk IDs: `para-{position}-{hash4}` (e.g., `para-0-e8f4`)
- Stable across re-renders, changes if content edited

**2. Multi-Color Semantic Encoding**
- **Orange** (Priority 0): AI conflicts with raw text (mistranslation)
- **Red** (Priority 1): AI missing content from fan/raw (omission)
- **Green** (Priority 2): AI added details not in references (hallucination/elaboration)
- **Grey** (Priority 3): Only stylistic differences (faithful translation)
- Multiple colors per chunk allowed (e.g., `["orange", "red"]`)

**3. Visual Strategy (Surface-Specific)**

| Surface | Strategy | Max Colors | Details |
|---------|----------|------------|---------|
| **Gutter** (Desktop) | Stacked mini-dots (6×6px) | 2 visible + halo for 3+ | Opacity 0.45 idle, 1.0 hover |
| **Minimap** (Scrollbar) | Diagonal split/stripe | All colors shown | 2-3px ticks |
| **Mobile** | Dominant color only | 1 | Long-press reveals full list |

**4. Works Without Fan Translation**
- Scenario 1: AI + Fan + Raw → All colors active
- Scenario 2: AI + Raw only → Orange, Green, Grey (Red disabled)
- Scenario 3: AI + Fan only → Red, Green, Grey (Orange disabled)

**5. Automatic Triggering**
- Runs after AI translation completes
- Requires at least raw text (always exists)
- Fan translation optional but enhances analysis
- Auto-recalculates on retranslation with previous feedback

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Translation Complete                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ├─ Has raw text? ──No──> Skip diff
                         │
                         └─ Yes + settings.autoDiffOnTranslation = true
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │   DiffAnalysisService        │
                    │   .analyzeDiff()             │
                    ├──────────────────────────────┤
                    │ 1. Chunk AI by \n\n          │
                    │ 2. Generate chunk IDs (hash) │
                    │ 3. Build LLM prompt          │
                    │ 4. Call AI (temp=0)          │
                    │ 5. Parse structured response │
                    │ 6. Enrich with char ranges   │
                    └───────────┬──────────────────┘
                                │
                                ▼
                    ┌──────────────────────────────┐
                    │   IndexedDB: diffResults     │
                    │   Key: [chapterId,           │
                    │         aiVersionId,         │
                    │         fanVersionId?,       │
                    │         rawVersionId,        │
                    │         algoVersion]         │
                    └───────────┬──────────────────┘
                                │
                                ├─ Dispatch: 'diff-analysis-complete'
                                │
                                ▼
                    ┌──────────────────────────────┐
                    │   useDiffMarkers hook        │
                    │   - Listens to event         │
                    │   - Reloads from DB          │
                    └───────────┬──────────────────┘
                                │
                                ▼
                    ┌──────────────────────────────┐
                    │   ChapterView                │
                    │   ├─ DiffGutter (micro-rail) │
                    │   │   ├─ DiffPip (dots)      │
                    │   │   └─ DiffTooltip         │
                    │   └─ contentRef (text)       │
                    └──────────────────────────────┘
```

---

## Data Model

### TypeScript Interfaces

```typescript
// types.ts

export type DiffColor = 'red' | 'orange' | 'green' | 'grey';

export interface DiffReason {
  type: 'missing' | 'added' | 'raw_conflict' | 'stylistic' | 'note';
  text: string; // <=120 chars, MUST cite actual snippets
}

export interface DiffMarker {
  chunkId: string;                 // "para-0-e8f4"
  colors: DiffColor[];             // ["orange","red"]
  reasons: DiffReason[];           // Ordered by salience
  confidence?: number;             // 0..1
  aiRange: { start: number; end: number }; // Char offsets in AI text
  position: number;                // 0-based para index
}

export interface ChapterDiffResult {
  chapterId: string;
  aiVersionId: string;
  fanVersionId?: string;
  rawVersionId: string;
  versionId: string;               // Generic version handle
  algoVersion: 'llm-v1';
  aiHash: string;                  // 8-char SHA256
  fanHash?: string;
  rawHash: string;
  markers: DiffMarker[];
  analyzedAt: number;              // Unix ms
  settings: {
    model: string;
    provider: string;
    allowCloud: boolean;
    granularity: 'paragraph';
    colorPriority: DiffColor[];    // ["orange","red","green","grey"]
    hasFanReference: boolean;      // Track if fan was available
  };
  status?: 'ok' | 'error' | 'partial';
  errorCode?: string;
  errorMsg?: string;
}

export interface DiffAnalysisChunk {
  id: string;        // "para-0-e8f4"
  text: string;      // Full paragraph text
  position: number;  // 0-based index
}
```

### IndexedDB Schema

```typescript
// services/indexeddb.ts - Add to schema

{
  name: 'diffResults',
  keyPath: ['chapterId', 'aiVersionId', 'fanVersionId', 'rawVersionId', 'algoVersion'],
  indexes: [
    { name: 'by_chapter', keyPath: 'chapterId' },
    { name: 'by_timestamp', keyPath: 'analyzedAt' }
  ]
}
```

### Storage Operations

```typescript
// services/db/operations/diffResults.ts (NEW FILE)

export async function saveDiffResult(result: ChapterDiffResult): Promise<void>;
export async function getDiffResult(
  chapterId: string,
  versionId: string
): Promise<ChapterDiffResult | null>;
export async function deleteDiffResult(
  chapterId: string,
  versionId: string
): Promise<void>;
export async function deleteAllDiffResultsForChapter(
  chapterId: string
): Promise<void>;
```

---

## Implementation Tasks

### Phase 1: Core Service Layer (TDD)

**Files to Create:**
- `services/diffAnalysisService.ts`
- `tests/services/diffAnalysisService.test.ts`

**Tasks:**

#### 1.1: Chunking Logic
```typescript
// Test first
it('should chunk AI translation by double newlines')
it('should generate stable chunk IDs (position + hash)')
it('should handle empty paragraphs gracefully')

// Implementation
private static chunkAiTranslation(text: string): DiffAnalysisChunk[]
private static shortHash(text: string): string
```

#### 1.2: LLM Integration
```typescript
// Test first
it('should build prompt with optional fan translation')
it('should call LLM with temperature=0 for deterministic results')
it('should parse structured JSON response')
it('should retry on failure with exponential backoff (max 2 retries)')

// Implementation
private static buildPrompt(
  aiChunks: DiffAnalysisChunk[],
  fanTranslation: string | null,
  rawText: string
): string

private static async callLLM(
  prompt: string,
  settings?: AppSettings
): Promise<DiffMarker[]>
```

#### 1.3: Main Analysis Pipeline
```typescript
// Test first
it('should work without fan translation (AI + raw only)')
it('should use all colors when fan translation exists')
it('should enrich markers with character ranges')
it('should throw error if raw text is missing')

// Implementation
static async analyzeDiff(
  chapterId: string,
  aiVersionId: string,
  aiTranslation: string,
  fanTranslation: string | null,
  rawText: string,
  settings?: AppSettings
): Promise<ChapterDiffResult>

private static enrichMarkersWithRanges(
  markers: DiffMarker[],
  fullAiText: string,
  aiChunks: DiffAnalysisChunk[]
): DiffMarker[]
```

**Acceptance Criteria:**
- ✅ All tests pass
- ✅ Handles both with/without fan translation
- ✅ Generates stable chunk IDs
- ✅ Retries on LLM failure
- ✅ Returns well-formed ChapterDiffResult

---

### Phase 2: Storage Layer (TDD)

**Files to Create:**
- `services/db/operations/diffResults.ts`
- `tests/services/db/operations/diffResults.test.ts`

**Tasks:**

#### 2.1: CRUD Operations
```typescript
// Test first
it('should save and retrieve diff result')
it('should return null for non-existent diff result')
it('should overwrite existing diff result on save')
it('should delete specific diff result')
it('should delete all diff results for a chapter')
it('should handle concurrent saves correctly')

// Implementation
export async function saveDiffResult(result: ChapterDiffResult): Promise<void>
export async function getDiffResult(chapterId: string, versionId: string): Promise<ChapterDiffResult | null>
export async function deleteDiffResult(chapterId: string, versionId: string): Promise<void>
export async function deleteAllDiffResultsForChapter(chapterId: string): Promise<void>
```

#### 2.2: Schema Migration
```typescript
// Update services/db/migrationService.ts
export async function migrateToVersion_X(): Promise<void> {
  // Add diffResults object store
  // Create indexes
}
```

**Acceptance Criteria:**
- ✅ All CRUD operations tested
- ✅ Composite key works correctly
- ✅ Migration runs cleanly on existing DBs
- ✅ No data loss on upgrade

---

### Phase 3: UI Components (TDD)

**Files to Create:**
- `components/DiffGutter.tsx`
- `components/DiffPip.tsx`
- `components/DiffTooltip.tsx`
- `hooks/useDiffMarkers.ts`
- `tests/components/DiffGutter.test.tsx`
- `tests/components/DiffPip.test.tsx`
- `tests/components/DiffTooltip.test.tsx`
- `tests/hooks/useDiffMarkers.test.ts`

**Tasks:**

#### 3.1: useDiffMarkers Hook
```typescript
// Test first
it('should load markers when enabled')
it('should return empty markers when disabled')
it('should reload when versionId changes')
it('should respond to diff-analysis-complete event')
it('should not reload on unrelated events')

// Implementation
export function useDiffMarkers(
  chapterId: string,
  versionId: string,
  enabled: boolean
): { markers: DiffMarker[]; loading: boolean; error: Error | null }
```

#### 3.2: DiffGutter Component
```typescript
// Test first
it('should render nothing when disabled')
it('should render correct number of pips when enabled')
it('should call onMarkerClick when pip is clicked')
it('should stack multiple colors vertically')
it('should show "more" halo when 3+ colors exist')
it('should suppress grey when other colors exist')

// Implementation
interface DiffGutterProps {
  markers: DiffMarker[];
  contentRef: React.RefObject<HTMLDivElement>;
  onMarkerClick: (marker: DiffMarker) => void;
  enabled: boolean;
}

export const DiffGutter: React.FC<DiffGutterProps>
```

#### 3.3: DiffPip Component
```typescript
// Render individual colored dot with accessibility
interface DiffPipProps {
  marker: DiffMarker;
  yPos: number;
  color: DiffColor;
  slot: number;        // 0 or 1 for stacking
  hasMore: boolean;    // Show "more" halo
  onClick: () => void;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}

export const DiffPip: React.FC<DiffPipProps>
```

#### 3.4: DiffTooltip Component
```typescript
// Tooltip with color legend and reasons
interface DiffTooltipProps {
  marker: DiffMarker;
  x: number;
  y: number;
}

export const DiffTooltip: React.FC<DiffTooltipProps>
```

**Acceptance Criteria:**
- ✅ Components render correctly
- ✅ Accessibility: ARIA labels, keyboard nav (Alt+J/K)
- ✅ Collision detection works (12px threshold)
- ✅ Stacking displays max 2 colors + halo
- ✅ Tooltips show full reason list
- ✅ Colorblind support (dashed border for orange, inner dot for green)

---

### Phase 4: Integration & Triggers

**Files to Modify:**
- `services/translationService.ts`
- `store/slices/translationsSlice.ts`
- `components/ChapterView.tsx`
- `components/SettingsModal.tsx`

**Tasks:**

#### 4.1: Post-Translation Trigger
```typescript
// services/translationService.ts

// After translation completes
if (
  settings.enableSemanticDiff !== false &&
  settings.autoDiffOnTranslation !== false &&
  (fanTranslation || chapter.content) &&
  translationResult.translation
) {
  runDiffAnalysisInBackground(
    chapterId,
    translationResult,
    fanTranslation || null,
    chapter.content,
    settings
  ).catch(error => {
    console.error('[TranslationService] Diff analysis failed:', error);
  });
}

async function runDiffAnalysisInBackground(...): Promise<void> {
  // Run analysis
  // Save to DB
  // Dispatch 'diff-analysis-complete' event
}
```

#### 4.2: ChapterView Integration
```typescript
// components/ChapterView.tsx

// Load diff markers
const activeVersionId = currentChapter?.activeVersion?.toString() || '1';
const { markers, loading: diffLoading } = useDiffMarkers(
  currentChapterId || '',
  activeVersionId,
  settings.enableSemanticDiff ?? true
);

// Handle marker click
const handleMarkerClick = useCallback((marker: DiffMarker) => {
  // Scroll to chunk
  // Highlight temporarily
  // Auto-open comparison if fan exists
}, []);

// Render with gutter
<div className="flex">
  <DiffGutter
    markers={markers}
    contentRef={contentRef}
    onMarkerClick={handleMarkerClick}
    enabled={settings.enableSemanticDiff ?? true}
  />
  <div ref={contentRef} className="prose...">
    {viewMode === 'english' ? translationTokensData.nodes : contentToDisplay}
  </div>
</div>
```

#### 4.3: Settings UI
```typescript
// components/SettingsModal.tsx

// Add toggles
<label>
  <input
    type="checkbox"
    checked={currentSettings.enableSemanticDiff ?? true}
    onChange={(e) => handleSettingChange('enableSemanticDiff', e.target.checked)}
  />
  Show semantic difference markers (colored dots)
</label>

<label>
  <input
    type="checkbox"
    checked={currentSettings.autoDiffOnTranslation ?? true}
    onChange={(e) => handleSettingChange('autoDiffOnTranslation', e.target.checked)}
    disabled={!currentSettings.enableSemanticDiff}
  />
  Auto-analyze when translation completes
</label>

// Add legend with conditional colors
<div className="color-legend">
  <div><span className="dot orange"></span> Orange: Raw conflict</div>
  {hasFanTranslation && (
    <div><span className="dot red"></span> Red: Missing content</div>
  )}
  <div><span className="dot green"></span> Green: Added details</div>
  <div><span className="dot grey"></span> Grey: Stylistic only</div>
</div>
```

**Acceptance Criteria:**
- ✅ Triggers automatically on translation complete
- ✅ Works with/without fan translation
- ✅ UI updates via event system
- ✅ Settings persist to storage
- ✅ Legend adapts to available references

---

### Phase 5: Export/Import Support

**Files to Modify:**
- `services/db/operations/export.ts`
- `services/importTransformationService.ts`
- `types.ts` (SessionExport interface)

**Tasks:**

#### 5.1: Export Integration
```typescript
// services/db/operations/export.ts

interface SessionExport {
  version: string;
  exportedAt: number;
  chapters: ChapterExport[];
  settings: AppSettings;
  diffResults?: ChapterDiffResult[];  // NEW
}

export async function exportSession(): Promise<SessionExport> {
  const db = await openDB();

  // Export all diff results if enabled
  const diffResults = settings.exportIncludesDiff
    ? await db.getAll('diffResults')
    : undefined;

  return {
    version: '2.1',  // Bump version
    exportedAt: Date.now(),
    chapters: exportedChapters,
    settings: currentSettings,
    diffResults,
  };
}
```

#### 5.2: Import Integration
```typescript
// services/importTransformationService.ts

export async function importSession(data: SessionExport): Promise<void> {
  const db = await openDB();

  // Import diff results if present
  if (data.diffResults && Array.isArray(data.diffResults)) {
    for (const diffResult of data.diffResults) {
      await db.put('diffResults', diffResult);
    }
    console.log(`[Import] Restored ${data.diffResults.length} diff analyses`);
  }
}
```

**Acceptance Criteria:**
- ✅ Diff results exported by default
- ✅ Setting to exclude from export
- ✅ Import handles old sessions without diff data
- ✅ No data corruption on import

---

## Testing Strategy

### Unit Tests (80%+ coverage target)

**Service Layer:**
```bash
npm run test tests/services/diffAnalysisService.test.ts
npm run test tests/services/db/operations/diffResults.test.ts
```

**UI Layer:**
```bash
npm run test tests/components/DiffGutter.test.tsx
npm run test tests/components/DiffPip.test.tsx
npm run test tests/hooks/useDiffMarkers.test.ts
```

### Integration Tests

**End-to-End Flow:**
```bash
npm run test tests/integration/diffAnalysisFlow.test.ts
```

**Test Scenarios:**
1. Complete flow: AI translation → diff analysis → DB save → UI render
2. With fan translation (all colors active)
3. Without fan translation (red disabled)
4. Retranslation with feedback integration
5. Export/import round-trip

### Manual Testing Checklist

- [ ] Translate chapter with fan translation → see colored dots
- [ ] Translate chapter without fan translation → see orange/green/grey only
- [ ] Click dot → scrolls to paragraph + highlights
- [ ] Hover dot → tooltip shows reasons
- [ ] Keyboard: Alt+J/K navigates markers
- [ ] Settings toggle disables/enables feature
- [ ] Export session → includes diff data
- [ ] Import session → restores diff markers
- [ ] Retranslate → recalculates diff automatically
- [ ] Mobile: dominant color only, long-press for details

---

## Deployment Checklist

### Pre-Deployment

- [ ] All unit tests pass (`npm run test`)
- [ ] Integration tests pass
- [ ] Coverage >80% on critical paths
- [ ] Manual testing completed
- [ ] No console errors in dev tools
- [ ] Performance: Diff analysis <5s for typical chapter
- [ ] Accessibility audit (ARIA labels, keyboard nav)
- [ ] Colorblind simulation testing

### Database Migration

- [ ] Run migration script locally
- [ ] Verify `diffResults` store created
- [ ] Test with existing production data snapshot
- [ ] Rollback plan documented

### Deployment Steps

1. **Feature Flag (Optional):**
   ```typescript
   // Add to settings
   enableSemanticDiffBeta: boolean;  // Default false initially
   ```

2. **Deploy to Staging:**
   - Test with real translations
   - Monitor LLM costs
   - Check storage growth

3. **Deploy to Production:**
   - Enable for 10% of users (A/B test)
   - Monitor error rates
   - Collect user feedback

4. **Full Rollout:**
   - Enable for 100%
   - Remove feature flag

---

## Configuration

### Prompt Template

**File:** `config/prompts.json`

```json
{
  "diffAnalysisPrompt": "You are a translation quality analyzer. Compare an AI translation (chunked into paragraphs) against reference texts.\n\nTASK:\nFor each AI paragraph chunk, identify semantic differences and return structured analysis.\n\nCOLOR CODING RULES:\n- RED: AI is missing content present in fan/raw (omission, information loss)\n- ORANGE: AI conflicts with raw text (wrong interpretation, mistranslation)\n- GREEN: AI added details not in fan/raw (elaboration, hallucination, creative liberty)\n- GREY: Only stylistic differences (word choice, tone) - content equivalent\n\nIMPORTANT:\n- A chunk can have MULTIPLE colors (e.g., [\"orange\",\"red\"] if both apply)\n- Cite actual text snippets in your reasons (max 120 chars per reason)\n- Use quotes to show exact phrases: fan's \"tears in his eyes\" vs AI's \"sad expression\"\n- Confidence 0-1: how certain you are of this assessment\n\nINPUT DATA:\n\nAI_TRANSLATION_CHUNKS:\n{{aiChunksJson}}\n\n{{#if fanTranslationFull}}\nFAN_TRANSLATION_FULL:\n{{fanTranslationFull}}\n{{/if}}\n\nRAW_TEXT_FULL:\n{{rawTextFull}}\n\nOUTPUT FORMAT (JSON only, no markdown fences):\n{\"markers\":[{\"chunkId\":\"para-0-e8f4\",\"colors\":[\"orange\",\"red\"],\"reasons\":[{\"type\":\"raw_conflict\",\"text\":\"Raw '魔王' (demon king) vs AI 'dark lord' - wrong title\"},{\"type\":\"missing\",\"text\":\"AI omits fan's 'with trembling hands'\"}],\"confidence\":0.9,\"position\":0}]}"
}
```

### Settings Schema

**File:** `types.ts` (AppSettings extension)

```typescript
export interface AppSettings {
  // ... existing fields ...

  // NEW: Diff analysis settings
  enableSemanticDiff?: boolean;        // Default: true
  autoDiffOnTranslation?: boolean;     // Default: true
  diffProvider?: string;               // Default: same as translation
  diffModel?: string;                  // Default: gpt-4o-mini
  exportIncludesDiff?: boolean;        // Default: true
}
```

---

## Cost Estimation

**Per Chapter Analysis:**
- Input tokens: ~2000 (AI chunks) + ~2000 (fan) + ~1000 (raw) + ~500 (prompt) = 5,500 tokens
- Output tokens: ~500 (markers JSON)
- Total: ~6,000 tokens per chapter

**With gpt-4o-mini:**
- Cost: $0.000150/1K input + $0.000600/1K output
- Per chapter: $(5.5 × 0.00015) + (0.5 × 0.0006) = $0.00083 + $0.0003 = **~$0.0011 per chapter**

**For 100-chapter novel:**
- Total cost: ~$0.11 (11 cents)

**Optimization:**
- Cache prompt template
- Use cheaper model for grey-only chapters
- Batch multiple chapters in single request (future)

---

## Future Enhancements

### Phase 2.0 (Post-MVP)

1. **Sentence-Level Granularity**
   - Split on `.` + space for finer precision
   - More dots, more precise pinpointing
   - Setting toggle: paragraph vs sentence

2. **Diff History Timeline**
   - Track how diffs change across versions
   - Show improvement/regression over retranslations
   - Visual diff evolution chart

3. **Custom Color Schemes**
   - User-defined color priorities
   - Accessibility presets (high contrast, colorblind-safe)
   - Theme integration

4. **Batch Analysis**
   - Analyze entire novel at once
   - Progress bar for long operations
   - Background worker thread

5. **AI Explanations on Demand**
   - Click marker → "Why is this orange?"
   - Detailed LLM explanation of the diff
   - Educational tooltips

6. **Diff-Aware Retranslation**
   - "Fix orange markers" button
   - Auto-inject diff issues into retranslation prompt
   - Iterative improvement loop

---

## References

### Related Documents
- `docs/ADR-003-Version-Centric-Data-Model.md` - Version storage patterns
- `docs/ADR-007-Schema-Evolution-And-Migrations.md` - DB migration strategy
- `docs/Providers.md` - Provider configuration
- `docs/Settings.md` - Settings management

### External Resources
- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)
- [IndexedDB Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)
- [WCAG Color Contrast](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)

---

## Success Metrics

**Technical:**
- ✅ 90%+ test coverage on service layer
- ✅ <5s diff analysis time (typical chapter)
- ✅ <100KB storage per chapter
- ✅ Zero data loss on export/import

**User Experience:**
- ✅ <0.5s gutter render time
- ✅ Markers visible at 0.45 opacity (subtle)
- ✅ Keyboard navigation works smoothly
- ✅ Mobile: single tap shows tooltip

**Business:**
- ✅ <$0.01 cost per chapter analysis
- ✅ 80%+ user adoption (setting enabled)
- ✅ Positive user feedback on feature

---

## Notes

- **TDD Approach:** Write tests BEFORE implementation for each task
- **Incremental Commits:** Small, focused commits with clear messages
- **Code Review:** Self-review checklist before marking complete
- **Documentation:** Update README, WORKLOG as you go

**Questions/Blockers:** Document in `docs/WORKLOG.md` with `[DIFF-HEATMAP]` prefix

---

## Timeline Estimate

| Phase | Tasks | Effort | Dependencies |
|-------|-------|--------|--------------|
| **Phase 1** | Core Service | 1 day | None |
| **Phase 2** | Storage Layer | 0.5 days | Phase 1 complete |
| **Phase 3** | UI Components | 1.5 days | Phase 2 complete |
| **Phase 4** | Integration | 1 day | Phase 3 complete |
| **Phase 5** | Export/Import | 0.5 days | Phase 4 complete |
| **Testing** | Manual QA | 0.5 days | All phases complete |

**Total:** 5 days (TDD approach, includes test writing time)

---

**End of Implementation Plan**

*This document is version-controlled and will be updated as implementation progresses.*
