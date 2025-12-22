# Decomposition Plan: `store/slices/imageSlice.ts`

**Status:** Draft
**Target:** Decompose the 1,074-line `imageSlice.ts` into a modular feature slice.

## 1. Problem Analysis
The `imageSlice` has grown into a "God Slice" managing:
- **State Definition**: A large, complex state object.
- **Async Workflow**: Long-running generation/retry logic.
- **Persistence**: Complex snapshotting and IndexedDB writes.
- **Versioning**: Logic for managing multiple image versions.
- **UI Logic**: Getters for advanced controls.

## 2. Target Architecture

We will create a `store/slices/images/` directory:

```
store/slices/images/
├── index.ts                  # Main slice creator (composes parts)
├── types.ts                  # State interfaces
├── imageState.ts             # Initial state & simple setters
├── imageActions.ts           # Advanced controls setters
├── imageGeneration.ts        # Async generation & retry logic
├── imageVersioning.ts        # Version navigation & deletion
├── imagePersistence.ts       # Persistence helpers & snapshotting
└── imageLegacy.ts            # Migration logic for base64 images
```

## 3. Module Responsibilities

### `types.ts`
- Exports `ImageSliceState`, `ImageSliceActions`, `ImageSlice`.

### `imageState.ts`
- Exports `initialImageState`.
- Exports `createImageStateSlice`: Handles `setImageState`, `clearImageState`, `clearAllImages`.

### `imageActions.ts`
- Exports `createImageActionsSlice`: Handles setters for `steeringImages`, `negativePrompts`, `guidanceScales`, `loraModels`, etc.
- Also `resetAdvancedControls`.

### `imageGeneration.ts`
- Exports `createImageGenerationSlice`:
  - `handleGenerateImages`
  - `handleRetryImage`
  - `loadExistingImages` (uses `imageLegacy` for migrations)

### `imageVersioning.ts`
- Exports `createImageVersioningSlice`:
  - `navigateToNextVersion`
  - `navigateToPreviousVersion`
  - `deleteVersion`

### `imagePersistence.ts`
- Helper functions:
  - `buildPersistenceSnapshot`
  - `persistImageVersionState`
- Not a slice itself, but utilities imported by `generation` and `versioning`.

## 4. Execution Plan

1.  **Scaffold**: Create folder and `types.ts`.
2.  **Extract Helpers**: Move persistence and legacy migration logic to helper files.
3.  **Split Slices**: Create the sub-slices (`State`, `Actions`, `Generation`, `Versioning`).
4.  **Compose**: Re-assemble in `store/slices/imageSlice.ts` (or `store/slices/images/index.ts`) using Zustand's pattern.

## 5. Verification
- **Unit Tests**: Existing tests for `imageSlice` should pass without modification (if we keep the public API identical).
- **Manual Test**: Generate an image, switch versions, reload page (persistence check).
