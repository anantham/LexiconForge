# Publish to Library Feature Design

**Date:** 2025-12-28
**Status:** Approved

## Overview

Add a "Publish to Library" button to the export modal that allows users to save their translation directly to a local git repo (lexiconforge-novels), generating/updating both `metadata.json` and `session.json` files.

## User Flow

```
Step 1: User clicks "Publish to Library" button in export modal
        ↓
Step 2: Folder picker opens → user selects novel folder
        (e.g., lexiconforge-novels/novels/dungeon-defense-wn/)
        ↓
Step 3: App checks: Does metadata.json exist in this folder?
        ↓
        ├─ YES → "Update existing book or add new version?"
        │        [Update Stats Only] [Add New Version]
        │
        └─ NO  → "Create new book" form
                 (novel title, author, language, etc.)
        ↓
Step 4: If "Add New Version" or "New Book":
        Show version details form:
        - Version name (e.g., "Complete AI Translation v2")
        - Translator name
        - Description
        - Style dropdown (faithful/liberal/etc.)
        ↓
Step 5: App writes files:
        - session.json (overwrites or new file)
        - metadata.json (updates stats or creates new)
        ↓
Step 6: If new book AND registry.json found in parent:
        "Update registry.json?" → [Yes] [No]
        ↓
Step 7: Success message with git commands:
        "Files written! Run: git add . && git commit -m 'Update X' && git push"
```

## UI Changes

### A. New button in export modal (SessionInfo.tsx)

Add third button after "Export JSON" and "Export EPUB":

```tsx
<button onClick={() => handleExportFormat('publish')}>
  <div className="font-medium">📚 Publish to Library</div>
  <div className="text-sm text-gray-600">
    Save to local git repo (metadata.json + session.json)
  </div>
</button>
```

### B. New state for publish flow

```tsx
const [publishStep, setPublishStep] = useState<
  'idle' | 'picking-folder' | 'confirm-action' | 'version-form' | 'writing' | 'done'
>('idle');
const [existingMetadata, setExistingMetadata] = useState<NovelEntry | null>(null);
const [selectedDirHandle, setSelectedDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
```

### C. Publish modal states

| Scenario | UI shown |
|----------|----------|
| Existing metadata.json found | Two buttons: "Update Stats Only" / "Add New Version" |
| No metadata.json | Full "Create New Book" form |
| "Add New Version" clicked | Version details form |

### D. Version details form fields

- Version name (text input)
- Translator name (text input)
- Translator website (optional URL)
- Description (textarea)
- Style (dropdown: faithful / liberal / image-heavy / other)
- Completion status (dropdown: In Progress / Complete)

## Service Layer Changes

### A. New method: `ExportService.publishToLibrary()`

```typescript
static async publishToLibrary(options: {
  mode: 'update-stats' | 'new-version' | 'new-book';
  dirHandle: FileSystemDirectoryHandle;
  versionDetails?: {
    versionName: string;
    translatorName: string;
    translatorLink?: string;
    description: string;
    style: 'faithful' | 'liberal' | 'image-heavy' | 'other';
    completionStatus: 'In Progress' | 'Complete';
  };
  novelDetails?: {  // Only for new-book
    title: string;
    author: string;
    originalLanguage: string;
    genres?: string[];
    description?: string;
  };
}): Promise<{ success: boolean; filesWritten: string[]; registryUpdated: boolean }>
```

### B. Logic inside publishToLibrary()

1. Generate session.json from current IndexedDB data (reuse generateQuickExport + include images)

2. If mode === 'update-stats':
   - Read existing metadata.json
   - Recalculate stats (chapters, images, footnotes, etc.)
   - Update lastUpdated timestamp
   - Write back metadata.json + session.json

3. If mode === 'new-version':
   - Read existing metadata.json
   - Append new version to versions[] array
   - Recalculate stats
   - Write metadata.json + new session file

4. If mode === 'new-book':
   - Generate fresh metadata.json with novelDetails + versionDetails
   - Write metadata.json + session.json
   - Check parent folder for registry.json
   - If found, offer to update it

5. Return summary of what was written

### C. Helper: detectExistingNovel()

```typescript
static async detectExistingNovel(
  dirHandle: FileSystemDirectoryHandle
): Promise<{ exists: boolean; metadata?: NovelEntry }>
```

## File Outputs

### What gets written for each mode

| Mode | metadata.json | session.json | registry.json |
|------|---------------|--------------|---------------|
| Update Stats Only | Update stats + lastUpdated | Overwrite | No change |
| New Version | Append to versions[] | New file (e.g., session-v2.json) | No change |
| New Book | Create new | Create new | Add entry (optional) |

### Auto-computed stats in metadata.json

```json
{
  "lastUpdated": "2025-12-28",
  "versions": [{
    "stats": {
      "content": {
        "totalRawChapters": 509,
        "totalTranslatedChapters": 350,
        "totalImages": 463,
        "totalFootnotes": 462,
        "avgImagesPerChapter": 1.32,
        "avgFootnotesPerChapter": 1.32
      },
      "translation": {
        "totalCost": 45.23,
        "totalTokens": 2500000,
        "mostUsedModel": "OpenRouter/deepseek-chat"
      }
    },
    "chapterRange": { "from": 1, "to": 350 },
    "completionStatus": "In Progress"
  }]
}
```

### Session filename convention

- Primary: `session.json`
- Additional versions: `session-v2-translator-name.json`
- metadata.json `sessionJsonUrl` points to the correct file

## Implementation Plan

### Files to modify

1. **`components/SessionInfo.tsx`** (~100 LOC)
   - Add "Publish to Library" button
   - Add publish flow state management
   - Add publish modal UI

2. **`services/exportService.ts`** (~150 LOC)
   - Add `publishToLibrary()` method
   - Add `detectExistingNovel()` helper
   - Add stats recalculation logic

### Optional: Extract to new component

Could extract publish UI to `components/PublishToLibraryModal.tsx` (~200 LOC) if SessionInfo.tsx gets too large.

## Existing Infrastructure

Already implemented in `exportService.ts`:
- `generateMetadataFile()` - generates metadata with auto-computed stats
- `saveToDirectory()` - File System Access API for folder picking
- `updateRegistry()` - updates registry.json
- `generateQuickExport()` - generates session.json data

## Estimated Scope

~300-400 lines of new/modified code
