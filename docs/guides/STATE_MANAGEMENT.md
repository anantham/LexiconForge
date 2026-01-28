# State Management Guide

> Zustand store architecture and patterns in LexiconForge

## Overview

LexiconForge uses **Zustand** for centralized state management, organized as a modular store composed of independent slices. Each slice handles a specific domain of application state.

## Store Architecture

The main store (`store/index.ts`) combines eight specialized slices:

| Slice | Responsibility |
|-------|----------------|
| **UiSlice** | UI state and view modes |
| **SettingsSlice** | Application settings and prompt templates |
| **ChaptersSlice** | Chapter data and navigation |
| **TranslationsSlice** | Translation operations and feedback |
| **ImageSlice** | Image generation and version control |
| **ExportSlice** | Session and EPUB export |
| **JobsSlice** | Background job management |
| **AudioSlice** | Audio generation and playback |

### Type Safety

```typescript
export type StoreState = AppState & SessionActions;

export type AppState = UiSlice &
  SettingsSlice &
  ChaptersSlice &
  TranslationsSlice &
  ImageSlice &
  ExportSlice &
  JobsSlice &
  AudioSlice;
```

## Slice Pattern

Each slice follows a consistent pattern:

```typescript
import type { StateCreator } from 'zustand';

export interface MyState {
  data: any[];
}

export interface MyActions {
  addItem: (item: any) => void;
  removeItem: (id: string) => void;
}

export type MySlice = MyState & MyActions;

export const createMySlice: StateCreator<any, [], [], MySlice> = (set, get) => ({
  // Initial state
  data: [],

  // Actions
  addItem: (item) => set(state => ({
    data: [...state.data, item]
  })),

  removeItem: (id) => set(state => ({
    data: state.data.filter(item => item.id !== id)
  }))
});
```

## Major Slices

### UiSlice

**State**:
- `viewMode`: 'original' | 'fan' | 'english'
- `showSettingsModal`, `showExportModal`: Modal states
- `isLoading`: `{ fetching, translating }`
- `error`, `notification`: Error and toast state

**Persistence**: ViewMode → `localStorage['LF_VIEW_MODE']`

### SettingsSlice

**State**:
- `settings`: AppSettings (provider, model, API keys, temperature, etc.)
- `promptTemplates`: Array of reusable templates
- `activePromptTemplate`: Currently selected template

**Key Actions**:
- `loadSettings()`, `updateSettings(partial)`
- `createPromptTemplate()`, `updatePromptTemplate()`, `deletePromptTemplate()`

### ChaptersSlice

**State**:
- `chapters`: Map<chapterId, EnhancedChapter>
- `novels`: Map<novelId, NovelInfo>
- `currentChapterId`: Active chapter
- `navigationHistory`: Recently visited

**Key Actions**:
- `handleNavigate(url)`, `handleFetch(url)`
- `getChapter(id)`, `getCurrentChapter()`
- `updateChapter(id, updates)`

### TranslationsSlice

**State**:
- `activeTranslations`: Record<chapterId, AbortController>
- `pendingTranslations`: Set<chapterId>
- `feedbackHistory`: Record<chapterId, FeedbackItem[]>
- `amendmentProposals`: AmendmentProposal[]

**Key Actions**:
- `handleTranslate(chapterId)`, `cancelTranslation(chapterId)`
- `buildTranslationHistory(chapterId)`
- `submitFeedback()`, `acceptProposal()`, `rejectProposal()`

### ImageSlice

**State**:
- `generatedImages`: Record<key, ImageState>
- `imageVersions`, `activeImageVersion`: Version tracking
- `steeringImages`, `negativePrompts`, `guidanceScales`: Advanced controls

**Key Actions**:
- `handleGenerateImages(chapterId)`
- `handleRetryImage(chapterId, marker)`
- `navigateToNextVersion()`, `navigateToPreviousVersion()`

## Persistence Strategies

### localStorage

Quick, non-sensitive preferences:
```typescript
localStorage.getItem('LF_VIEW_MODE');
localStorage.getItem('LF_AI_DEBUG');
```

### IndexedDB

Large structured data with query support:
- Chapters and content
- Translations and versions
- Feedback and amendments
- Settings and prompt templates

```typescript
const chapter = await ChapterOps.getByStableId(chapterId);
const versions = await TranslationOps.getVersionsByStableId(chapterId);
```

### Cache API

Binary blob storage for images:
```typescript
const blob = await ImageCacheStore.getImageBlob(versionedKey);
```

## Best Practices

### Adding New State

1. **Define interfaces**:
```typescript
export interface MyFeatureState { items: MyItem[]; }
export interface MyFeatureActions { addItem: (item: MyItem) => void; }
export type MyFeatureSlice = MyFeatureState & MyFeatureActions;
```

2. **Create slice factory**:
```typescript
export const createMyFeatureSlice: StateCreator<any, [], [], MyFeatureSlice> = (set, get) => ({
  items: [],
  addItem: (item) => set(state => ({ items: [...state.items, item] }))
});
```

3. **Register in main store**:
```typescript
export const useAppStore = create<StoreState>((set, get, store) => ({
  ...createMyFeatureSlice(set, get, store),
}));
```

4. **Use in components**:
```typescript
const { items, addItem } = useAppStore(
  useShallow((state) => ({
    items: state.items,
    addItem: state.addItem,
  }))
);
```

## Good Patterns ✅

**Selector Functions (useShallow)**:
```typescript
const { chapters } = useAppStore(
  useShallow((state) => ({ chapters: state.chapters }))
);
```

**Compound State Updates**:
```typescript
set(state => ({
  urlLoadingStates: { ...state.urlLoadingStates, [url]: true },
  isLoading: { ...state.isLoading, fetching: true }
}));
```

**Async Actions with State Tracking**:
```typescript
handleTranslate: async (chapterId) => {
  set(state => ({ pendingTranslations: new Set([...state.pendingTranslations, chapterId]) }));
  try {
    const result = await translationService.translate(chapterId);
    set({ /* update with result */ });
  } finally {
    set(state => ({ pendingTranslations: /* remove chapterId */ }));
  }
}
```

## Anti-Patterns ❌

**Over-Selecting**:
```typescript
// BAD: Entire state re-renders on any change
const state = useAppStore();

// GOOD: Select only what you need
const { chapters } = useAppStore(useShallow(s => ({ chapters: s.chapters })));
```

**Mutating State Directly**:
```typescript
// BAD
state.chapters.get('ch1').title = 'New Title';

// GOOD
set(state => ({
  chapters: new Map([...state.chapters]).set('ch1', { ...chapter, title: 'New Title' })
}));
```

**Component UI State in Global Store**:
```typescript
// BAD: Local UI state doesn't belong in global store
isDropdownOpen: boolean;

// GOOD: Use React useState for local state
const [isDropdownOpen, setIsDropdownOpen] = useState(false);
```

## Debugging

### Window Exposure

```javascript
// In browser console
useAppStore.getState();
useAppStore.setState({ /* ... */ });
useAppStore.subscribe(state => console.log(state));
```

### Memory Diagnostics

```typescript
const diagnostics = useAppStore(s => s.getMemoryDiagnostics());
// Returns: totalChapters, chaptersWithTranslations, estimatedRAM, etc.
```

## References

- **Main Store**: `store/index.ts`
- **Type Definitions**: `store/storeTypes.ts`
- **DB Operations**: `services/db/operations/`
- **Session Management**: `services/sessionManagementService.ts`
- **Zustand Documentation**: https://github.com/pmndrs/zustand
