# EPUB Export Pipeline

## Architecture

The EPUB export pipeline is decomposed into 5 single-responsibility modules:

```
┌─────────────────────────────────────────────────────────────────┐
│                     EPUB EXPORT SERVICE                          │
│                    (Orchestration Layer)                         │
└────────────┬────────────────────────────────────────────────────┘
             │
             ├─► 1. Data Collector ──► CollectedData
             │      │ Walks store/IDB
             │      │ Hydrates chapters + translations
             │      │ Validates ordering
             │      │ Flags missing data
             │
             ├─► 2. Asset Resolver ──► ResolvedAssets
             │      │ Fetches images (ImageCacheStore)
             │      │ Fetches audio (AudioCacheStore)
             │      │ Handles cache misses gracefully
             │      │ Converts to ArrayBuffers
             │
             ├─► 3. Content Builder ──► BuiltContent
             │      │ Generates XHTML per chapter
             │      │ Creates title/stats pages
             │      │ Builds manifest/spine
             │      │ Constructs navigation
             │
             ├─► 4. Package Builder ──► EpubPackage
             │      │ Assembles ZIP structure
             │      │ Writes mimetype (uncompressed)
             │      │ Adds META-INF/container.xml
             │      │ Includes all XHTML + assets
             │
             └─► 5. Returns final Blob + statistics
```

---

## Module Responsibilities

### 1. **epubDataCollector.ts**
**Pure Function**: No side effects, only reads from provided state

**Signature**:
```typescript
export function collectExportData(
  options: EpubExportOptions,
  storeSnapshot: {
    chapters: Map<string, EnhancedChapter>;
    currentNovelTitle?: string;
  }
): Promise<CollectedData>
```

**Responsibilities**:
- Iterate chapters based on `options.order` (number vs navigation)
- Hydrate translations from IndexedDB if not in memory
- Extract image/audio references (cache keys + fallback data)
- Validate chapter sequence, flag gaps/missing data
- Return normalized `CollectedChapter[]` with warnings

**Tests**:
- Unit tests with fixture data
- Chapter ordering (number vs navigation)
- Missing translation handling
- Gap detection in chapter numbers

---

### 2. **epubAssetResolver.ts**
**I/O Function**: Fetches from Cache API and IndexedDB

**Signature**:
```typescript
export async function resolveAssets(
  collectedData: CollectedData
): Promise<ResolvedAssets>
```

**Responsibilities**:
- For each image reference:
  - If `cacheKey` present, fetch via `ImageCacheStore.getImageBlob()`
  - If cache miss, try `base64Fallback`
  - If neither, mark as missing, log warning
  - Convert to ArrayBuffer with MIME type
- For each audio reference (future):
  - Fetch via audio cache
  - Same fallback logic
- Assign unique asset IDs (e.g., `img-ch1-ILL-1`)
- Map chapter image references to resolved asset IDs

**Tests**:
- Mock `ImageCacheStore` responses
- Test cache hit path
- Test cache miss → fallback path
- Test cache miss + no fallback → graceful skip
- Verify asset ID generation

---

### 3. **epubContentBuilder.ts**
**Pure Function**: No I/O, just string manipulation

**Signature**:
```typescript
export function buildEpubContent(
  resolvedAssets: ResolvedAssets,
  options: EpubExportOptions
): BuiltContent
```

**Responsibilities**:
- Generate XHTML for each chapter:
  - Inject images at `[placementMarker]` positions
  - Render footnotes section
  - Apply EPUB-safe HTML sanitization
- Create title page (if enabled)
- Create statistics page (if enabled):
  - Total chapters, words, cost, time
  - Model/provider breakdown
- Build OPF manifest (list all files + assets)
- Build OPF spine (reading order)
- Build navigation document (TOC)

**Tests**:
- Snapshot tests for sample chapters
- HTML validation (XHTML 1.1 compliance)
- Statistics formatting
- Image placeholder replacement
- Footnote rendering

---

### 4. **epubPackageBuilder.ts**
**I/O Function**: Creates ZIP structure

**Signature**:
```typescript
export async function packageEpub(
  content: BuiltContent,
  assets: ResolvedAsset[]
): Promise<EpubPackage>
```

**Responsibilities**:
- Create ZIP using JSZip or similar
- Add files in correct order:
  1. `mimetype` (uncompressed, must be first)
  2. `META-INF/container.xml`
  3. `OEBPS/content.opf` (manifest/spine)
  4. `OEBPS/nav.xhtml` (EPUB 3 navigation)
  5. `OEBPS/toc.ncx` (EPUB 2 compatibility)
  6. `OEBPS/*.xhtml` (chapter files)
  7. `OEBPS/images/*` (resolved assets)
- Validate structure (required files present)
- Return Blob + validation result

**Tests**:
- Integration test: unzip, verify structure
- Check mimetype is first entry, uncompressed
- Validate OPF XML structure
- Ensure all manifest items have corresponding files

---

### 5. **epubExportService.ts**
**Orchestration**: Coordinates the pipeline

**Signature**:
```typescript
export async function exportEpub(
  options: EpubExportOptions,
  progressCallback?: ProgressCallback
): Promise<ExportResult>
```

**Responsibilities**:
- Get store snapshot
- Call modules in sequence:
  1. Collect data (report progress: 25%)
  2. Resolve assets (report progress: 50%)
  3. Build content (report progress: 75%)
  4. Package EPUB (report progress: 95%)
- Aggregate warnings from all phases
- Handle errors, report telemetry
- Return final result + statistics

**Tests**:
- Integration test with real store data
- Error handling at each phase
- Progress callback invocation
- Telemetry capture

---

## Benefits

1. **Testability**: Each module can be unit tested with fixtures
2. **Maintainability**: Clear boundaries, easy to debug specific phase
3. **Extensibility**: Video support only touches asset resolver
4. **Performance**: Can parallelize asset resolution in phase 2
5. **Error Isolation**: Cache miss in one image doesn't fail entire export
6. **Progress Tracking**: Fine-grained progress reporting to UI

---

## File Structure

```
services/epub/
├── types.ts                  # Shared type definitions
├── README.md                 # This file
├── dataCollector.ts          # Phase 1: Collect chapters
├── assetResolver.ts          # Phase 2: Fetch images/audio
├── contentBuilder.ts         # Phase 3: Generate XHTML
├── packageBuilder.ts         # Phase 4: Create ZIP
├── exportService.ts          # Phase 5: Orchestration
└── utils/
    ├── htmlSanitizer.ts      # EPUB-safe HTML cleaning
    ├── opfBuilder.ts         # OPF XML generation
    └── navBuilder.ts         # Navigation document
```

---

## Migration Plan

**Phase 1** (This PR):
- Implement modules 1-4 with image support
- Asset resolver uses `ImageCacheStore` + base64 fallback
- Content builder reuses existing sanitization logic

**Phase 2** (Future):
- Add audio asset resolution
- Add video asset resolution
- Parallel asset fetching

**Phase 3** (Future):
- Alternative export formats (PDF, Markdown)
- Reuse data collector + asset resolver
- Only swap content builder + package builder

---

## Testing Strategy

### Unit Tests (per module)
- `dataCollector.test.ts`: Chapter ordering, missing data
- `assetResolver.test.ts`: Cache hits/misses, fallbacks
- `contentBuilder.test.ts`: HTML generation, statistics
- `packageBuilder.test.ts`: ZIP structure validation

### Integration Tests
- `exportService.test.ts`: Full pipeline with fixtures
- `export-regression.test.ts`: Real-world EPUB samples

### Manual Testing
- Export EPUB with 100 chapters + images
- Validate in Calibre, Apple Books, Google Play Books
- Check file size, loading speed

---

## Example Usage

```typescript
import { exportEpub } from './services/epub/exportService';

const result = await exportEpub(
  {
    order: 'number',
    includeTitlePage: true,
    includeStatsPage: true,
    settings: currentSettings
  },
  (progress) => {
    console.log(`${progress.phase}: ${progress.percent}%`);
    updateUI(progress.message);
  }
);

if (result.success && result.blob) {
  downloadFile(result.blob, 'my-novel.epub');
  console.log(`Exported ${result.stats.totalChapters} chapters, ${result.stats.assetsMissing} images missing`);
}
```
