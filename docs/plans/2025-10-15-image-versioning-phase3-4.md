# Image Versioning Phase 3+ Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Stabilize the multi-version image workflow by seeding version state, persisting user selections/metadata, migrating legacy images into Cache API, and enabling version deletion with metadata-aware exports.

**Architecture:** Extend the existing version tracking stored in Zustand + IndexedDB. Introduce metadata records keyed by `chapterId:placementMarker:version`, migrate legacy base64 assets into Cache API, and add deletion flows that invalidate Cache entries, metadata, and store state without renumbering versions.

**Tech Stack:** TypeScript, React, Zustand, IndexedDB service layer, Cache API, Vite tooling, Vitest (optional tests).

---

### Task 1: Seed Versions After Initial Generation & Hydration

**Files:**
- Modify: `store/slices/imageSlice.ts`
- Modify: `services/imageGenerationService.ts`
- Modify: `services/imageCacheService.ts`
- Modify: `services/translationPersistenceService.ts`

**Step 1: Identify generation completion points**
- Review `ImageGenerationService.generateImages` resolution path.
- Note where `generatedImages` map is merged into store.

**Step 2: Update store post-generation**
- In `imageSlice.handleGenerateImages` final `set`, populate `imageVersions[key] = 1` and `activeImageVersion[key] = 1` for each illustration that gained an image.

**Step 3: Seed hydration path**
- In `ImageGenerationService.loadExistingImages`, when an illustration has `generatedImage.imageCacheKey`, ensure returned `ImageState` includes version (store separately if needed).
- After calling `loadExistingImages`, update store to set versions based on hydrated cache keys.

**Step 4: Persist metadata to IndexedDB**
- Extend translation persistence to include image version + metadata snapshots.
- Ensure active version is stored alongside translation record.

**Step 5: Run build**
Run: `npm run build`
Expected: success

**Step 6: Commit (Phase 3 - seeding/persistence)**
```bash
git add store/slices/imageSlice.ts services/imageGenerationService.ts services/translationPersistenceService.ts
npm run build
git commit -m "feat(images): seed and persist initial image version state"
```

---

### Task 2: Legacy Base64 Migration to Cache API

**Files:**
- Modify: `services/imageGenerationService.ts`
- Modify: `services/imageCacheService.ts`
- Modify: `store/slices/imageSlice.ts`
- Modify: `services/translationPersistenceService.ts`

**Step 1: Create migration helper**
- Implement `ImageCacheStore.migrateBase64Image(chapterId, placementMarker, base64, existingVersion?)` returning `{ cacheKey, version }`.

**Step 2: Hydration upgrade**
- During `loadExistingImages`, detect `illust.url`.
- Call migration helper, replace `url` with `generatedImage.imageCacheKey` referencing version=1.
- Update `translationResult` in-memory object and persist to IndexedDB to remove legacy `url`.

**Step 3: Store update**
- After migration, seed `imageVersions`/`activeImageVersion` with the migrated version.

**Step 4: Telemetry/logging**
- Add debug logs to record migrations (count, size, time).

**Step 5: Build & commit**
```bash
git add services/imageCacheService.ts services/imageGenerationService.ts store/slices/imageSlice.ts services/translationPersistenceService.ts
npm run build
git commit -m "feat(images): migrate legacy base64 illustrations into cache versions"
```

---

### Task 3: Persist Active Version & Metadata

**Files:**
- Modify: `types.ts`
- Modify: `services/translationPersistenceService.ts`
- Modify: `store/slices/imageSlice.ts`
- Modify: `services/imageGenerationService.ts`
- Modify: `store/slices/exportSlice.ts`

**Step 1: Define metadata schema**
- Extend `GeneratedImageResult` to include `version`, `metadata` (prompt, negative prompt, guidance, LoRA, steering, timestamp).

**Step 2: Capture metadata on generation/retry**
- When generating/retrying images, populate metadata object.

**Step 3: Persist metadata & active version**
- Update translation persistence to store metadata per version.
- Store `activeImageVersion` map in IndexedDB (per chapter).

**Step 4: Hydration restore**
- On loadExistingImages, restore metadata into store (maybe new `imageMetadata` map).

**Step 5: Export captions**
- In `exportSlice.ts`, use metadata to populate illustration caption/alt text in EPUB (e.g., prompt + version label).

**Step 6: Build & commit**
```bash
git add types.ts services/imageGenerationService.ts services/translationPersistenceService.ts store/slices/imageSlice.ts store/slices/exportSlice.ts
npm run build
git commit -m "feat(images): persist active versions and metadata for exports"
```

---

### Task 4: Reuse Base64 Helper & Hoist Cache Import

**Files:**
- Modify: `store/slices/exportSlice.ts`
- Modify: `services/imageUtils.ts`

**Step 1: Export helper**
- Ensure `services/imageUtils.ts` exports a reusable `blobToBase64DataUrl`.

**Step 2: Update export slice**
- Import helper instead of local function.
- Move dynamic `ImageCacheStore` import outside `Promise.all` loop.

**Step 3: Build & commit**
```bash
git add services/imageUtils.ts store/slices/exportSlice.ts
npm run build
git commit -m "refactor(images): reuse base64 helper and optimize cache import"
```

---

### Task 5: Version Deletion Flow

**Files:**
- Modify: `store/slices/imageSlice.ts`
- Modify: `components/Illustration.tsx`
- Modify: `services/imageCacheService.ts`
- Modify: `services/translationPersistenceService.ts`

**Step 1: Add store action**
- Implement `deleteImageVersion(chapterId, placementMarker, version)`:
  * Remove metadata entry and Cache API blob
  * Update `imageVersions` (mark version as deleted, but keep max) and `activeImageVersion`
  * If active version deleted, switch to nearest available (`max <= version ? max available lower : version+1`)

**Step 2: UI control**
- Add “Delete version” button with confirm dialog (tooltip warns cannot undo).

**Step 3: Persist removal**
- Update IndexedDB storage to remove metadata and mark version deleted.

**Step 4: Export safeguard**
- Ensure export slice skips deleted versions.

**Step 5: Build & commit**
```bash
git add store/slices/imageSlice.ts components/Illustration.tsx services/imageCacheService.ts services/translationPersistenceService.ts
npm run build
git commit -m "feat(images): allow deleting individual generated versions"
```

---

### Task 6: Tests & Manual Verification

**Files:**
- Modify/Add: `tests/services/imageGenerationService.test.ts` (if feasible)
- Modify: `docs/WORKLOG.md`

**Step 1: Add targeted tests (optional but encouraged)**
- Add unit tests covering version metadata serialization/deserialization.

**Step 2: Manual QA checklist**
- Use markdown checklist to confirm scenarios: initial gen, retry, deletion, hydration, EPUB export.

**Step 3: Update WORKLOG**
- Document the feature completion.

**Step 4: Final build & commit**
```bash
git add tests/services/imageGenerationService.test.ts docs/WORKLOG.md
npm run build
git commit -m "test(images): cover version metadata plumbing"  # adjust if no tests
```

---

### Execution Handoff

Plan complete and saved to `docs/plans/2025-10-15-image-versioning-phase3-4.md`. Two execution options:

1. **Subagent-Driven (this session)** – dispatch a fresh subagent per task with review after each.
2. **Parallel Session (separate)** – open new session using executing-plans skill to implement tasks in batches.

Which approach would you like?
