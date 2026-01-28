> **STATUS: NOT STARTED** - Both components still exceed 300 LOC target.
> This is the highest-priority tech debt item.

# Component Decomposition Plan
_Targets: `components/SettingsModal.tsx` (2,745 LOC) & `components/ChapterView.tsx` (1,969 LOC)_

## 1. Goals
- Bring each component below 250–300 LOC per Prime Directive #3.
- Enable per-panel rendering, memoization, and code splitting.
- Improve testability by isolating hooks + state.


## 2. SettingsModal Roadmap

### Current Structure
- Single component handles **AI provider**, **prompt templates**, **image generation**, **audio**, **diff heatmap**, **export/EPUB**, and **telemetry** toggles.
- Deeply nested state derived from `settingsSlice`, direct calls to services (provider validation, credit cache).

### Target Folder Layout
```
components/settings/
  SettingsModal.tsx        // orchestrator (entry point)
  panels/
    ProviderPanel.tsx
    PromptTemplatesPanel.tsx
    ImageSettingsPanel.tsx
    AudioSettingsPanel.tsx
    ExportSettingsPanel.tsx
    DiffSettingsPanel.tsx
    AccessibilityPanel.tsx  // optional grouping for font/line-height
  hooks/
    useProviderSettings.ts
    useImageSettings.ts
    useExportSettings.ts
  utils/
    validation.ts
```

### Extraction Steps
1. **Provider panel first** (highest complexity, multiple APIs):
   - Move provider-specific form controls + validation logic into `ProviderPanel`.
   - Accept `settings`, `onChange`, `onValidateKey` props.
   - Memoize derived values (available models, key statuses).
2. **Image/audio/export panels**:
   - Each panel receives typed slices of state + dispatchers.
   - Move local reducers/hook logic into `hooks/useXSettings.ts`.
3. **Diff/accessibility toggles**:
   - Extract simple sections to keep orchestrator small.
4. **SettingsModal.tsx** becomes:
   - Layout shell (tabs/accordion).
   - Wiring for shared alerts, save/cancel handlers.
   - Error boundary to isolate panel failures.
5. **Testing**:
   - Add React Testing Library snapshots per panel.
   - Verify `npm run check:loc` to ensure each panel < 400 LOC.


## 3. ChapterView Roadmap

### Current Structure
- Handles translation rendering, tokenization, diff overlays, inline audio, illustration galleries, footnotes, keyboard navigation.
- Regex-based tokenizer + DOM parsing embedded directly in component.

### Target Folder Layout
```
components/chapter-view/
  ChapterView.tsx              // orchestrator
  TokenizedContent.tsx
  DiffMarkerGutter.tsx
  IllustrationGallery.tsx
  FootnotePopover.tsx
  AudioControlsInline.tsx
  hooks/
    useTokenizedContent.ts
    useDiffHighlights.ts
  utils/
    tokenizer.ts
    htmlSanitizer.ts
```

### Extraction Steps
1. **Tokenizer service**:
   - Move regex + parsing logic into `components/chapter-view/utils/tokenizer.ts`.
   - Expose `tokenizeChapter(chapter, options)` returning typed tokens.
   - Unit test edge cases (nested tags, footnote markers).
2. **TokenizedContent component**:
   - Receives token array, handles mapping to React tree.
   - Reuse in ChapterView + potential preview panes.
3. **Diff overlay**:
   - `DiffMarkerGutter` handles scroll sync + heatmap.
   - Hook `useDiffHighlights(chapterId)` reads from store + memoizes.
4. **Footnotes & illustrations**:
   - Dedicated components to display metadata; reduce prop drilling.
5. **Audio controls**:
   - Wrap existing audio provider logic in `AudioControlsInline`.
6. **ChapterView orchestrator**:
   - Compose extracted pieces.
   - Manage selection state, virtualization (if added later), keyboard shortcuts.


## 4. Execution Order & Dependencies

| Step | Component | Dependencies |
|------|-----------|--------------|
| 1 | Extract tokenizer utilities + tests | None (pure functions) |
| 2 | Create `TokenizedContent` & `FootnotePopover` | Relies on tokenizer output |
| 3 | Split SettingsModal provider panel | Requires `settingsSlice` selectors |
| 4 | Move image/audio/export panels | After provider panel to reuse patterns |
| 5 | ChapterView diff/audio sections | After TokenizedContent component exists |
| 6 | Add index barrel + lazy loading | After panels/slices extracted |


## 5. Verification & Guardrails
- Run `npm run check:loc` after each extraction to ensure new files respect limits.
- Add focused tests per extracted component/hook (`npm test components/...`).
- Update `docs/WORKLOG.md` + this plan after each milestone.
- Flag any new shared utilities (tokenizer, validation) for ADR entries if behavior changes.

Use this plan whenever you or another agent tackles UI decomposition. Update sections as panels/modules land so future work stays coordinated.***
