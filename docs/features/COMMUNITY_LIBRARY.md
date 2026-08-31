> **STATUS: VISION ONLY** - No implementation exists yet.
> This document describes a future feature. No timeline set.

# Community-Driven Novel Library

## Overview

The Community Library is a GitHub-style collaborative platform for web novel translations. It enables multiple contributors to create, share, and improve translations of the same novel, giving readers the freedom to choose versions that match their preferences.

## Key Features

### 🌐 **Dynamic Registry System**
- Novels are loaded from a remote registry (not hardcoded)
- Easy to add new novels without code changes
- Community can contribute via pull requests

### 📚 **Multi-Version Support**
Each novel can have multiple versions:
- **Different translation styles**: Faithful vs. liberal translations
- **Enhanced editions**: Image-heavy, audio-enhanced, or with detailed footnotes
- **Work-in-progress versions**: Track completion status per version
- **Fork and remix**: Credit system tracks original creators and contributors

### 📊 **Enhanced Statistics**
Each version displays comprehensive metrics to help readers choose:

**Content Statistics:**
- Total images, footnotes, raw chapters, translated chapters
- Average images/footnotes per chapter

**Translation Information:**
- Translation type badges (Human / AI / Hybrid)
- For hybrid translations: AI percentage shown
- Quality ratings from community feedback
- Feedback count

**Coverage Distribution:**
- Chapters with multiple versions
- Average, median, and max versions per chapter
- Visual distribution graph

### 🔍 **Version Comparison**
- Side-by-side version picker in detail sheet
- Compare statistics across versions
- See translator info and last update dates
- View completion status and chapter ranges

## Architecture

### Registry System

The system uses a **hybrid architecture**:

1. **Centralized Registry** (`registry.json`)
   - Lists all available novels
   - Points to metadata URLs for each novel
   - Maintained in a public GitHub repo

2. **Distributed Metadata** (per-novel `metadata.json`)
   - Contains full novel information
   - Lists all versions for that novel
   - Can be hosted anywhere (GitHub, CDN, personal server)

**Example Registry Structure:**

```json
{
  "version": "1.0",
  "lastUpdated": "2025-10-20",
  "novels": [
    {
      "id": "novel-id",
      "metadataUrl": "https://raw.githubusercontent.com/user/repo/main/novels/novel-id/metadata.json"
    }
  ]
}
```

**Example Metadata Structure:**

```json
{
  "id": "novel-id",
  "title": "Novel Title",
  "metadata": {
    "author": "Original Author",
    "originalLanguage": "Korean",
    "targetLanguage": "English",
    "chapterCount": 100,
    "genres": ["Fantasy", "Action"],
    "description": "Novel description...",
    "coverImageUrl": "https://...",
    "rating": 4.5
  },
  "versions": [
    {
      "versionId": "v1",
      "displayName": "Official Translation",
      "translator": {
        "name": "Translator Name",
        "link": "https://..."
      },
      "sessionJsonUrl": "https://.../session.json",
      "chapterManifestUrl": "https://.../chapter-manifest.json",
      "targetLanguage": "English",
      "style": "faithful",
      "features": ["high-quality", "footnotes"],
      "chapterRange": { "from": 1, "to": 100 },
      "completionStatus": "Complete",
      "lastUpdated": "2025-10-20",
      "stats": {
        "downloads": 1000,
        "fileSize": "50MB",
        "content": {
          "totalImages": 50,
          "totalFootnotes": 200,
          "totalRawChapters": 100,
          "totalTranslatedChapters": 100,
          "avgImagesPerChapter": 0.5,
          "avgFootnotesPerChapter": 2.0
        },
        "translation": {
          "translationType": "human",
          "aiPercentage": 0,
          "qualityRating": 4.8,
          "feedbackCount": 45
        }
      }
    }
  ]
}
```

### Key Components

**Services:**
- `RegistryService` - Fetches registry and novel metadata
- `ExportService` - Exports sessions with provenance tracking
- `ImportService` - Imports novels with streaming support

**Components:**
- `NovelLibrary` - Main library browser (registry loader)
- `NovelGrid` / `NovelCard` - Grid display of novels
- `NovelDetailSheet` - Detailed novel information
- `VersionPicker` - Version selection with statistics
- `CoverageDistribution` - Visual coverage distribution
- `NovelMetadataForm` - Metadata entry for publishers

**Types:**
- `NovelEntry` - Full novel with all versions
- `NovelVersion` - Single version information
- `VersionStats` - Comprehensive statistics
- `SessionProvenance` - Lineage tracking

## User Workflows

### 1. **Browsing and Reading**

```
User opens Novel Library
  ↓
Registry fetched from remote URL
  ↓
Novels displayed in grid (covers, titles, ratings)
  ↓
User clicks on novel card
  ↓
Detail sheet opens showing:
  - Novel metadata (author, genres, description)
  - Version picker (if multiple versions)
  - Version statistics
  - Coverage distribution
  ↓
User selects version and clicks "Start Reading"
  ↓
Session JSON streamed from version's URL
  ↓
First 10 chapters loaded → Navigate to Chapter 1
  ↓
Remaining chapters load in background
```

### 2. **Publishing a New Novel**

```
Translator prepares novel in LexiconForge
  ↓
Opens Settings → Metadata tab
  ↓
Fills in Novel Metadata Form:
  - Title, Author, Description
  - Original language
  - Genres, Tags
  - Links (Novel Updates, source, etc.)
  ↓
Clicks "Export → Publish to Library"
  ↓
Exports three files:
  - metadata.json (novel + version info)
  - session.json (chapter data)
  - chapter-manifest.json (exact identities + session checksum)
  ↓
Uploads files to hosting (GitHub, CDN, etc.)
  ↓
Creates PR to add novel to registry.json
```

### 3. **Forking an Existing Version**

```
User imports existing version
  ↓
Makes modifications (add images, improve translations, etc.)
  ↓
Opens Settings → Export tab
  ↓
Clicks "Fork Version"
  ↓
System captures provenance:
  - originalCreator
  - forkedFrom (version ID)
  - contributors (current user)
  ↓
Exports with fork metadata
  ↓
User uploads and adds to registry as new version
```

## Contributing to the Library

### Adding a New Novel

1. **Prepare your translation** in LexiconForge
2. **Fill in metadata** via Settings → Metadata
3. **Export with "Publish to Library"**
4. **Verify the publication** before uploading:
   ```bash
   npm run verify-library-publication -- metadata.json session.json chapter-manifest.json
   ```
5. **Upload files** to your preferred hosting:
   - GitHub repo (recommended for collaboration)
   - GitHub releases
   - CDN or personal server
6. **Create PR** to add entry to registry

**Registry PR Example:**

```json
{
  "id": "my-novel",
  "metadataUrl": "https://raw.githubusercontent.com/myuser/lexicon-novels/main/my-novel/metadata.json"
}
```

### Adding a New Version

1. **Create your version** (translation, remix, or fork)
2. **Export with provenance** tracking
3. **Update metadata.json** to add your version
4. **Upload session.json and chapter-manifest.json** with your version ID
5. **Update the metadata URL** (or create PR if different repo)

### Publication Integrity Contract

`metadata.chapterCount` is the expected size of the work; it is not proof that
all of those chapters are currently downloadable. For a manifested version,
`version.stats.content.totalRawChapters` and
`chapterManifest.publishedChapterCount` describe the exact published package.
Only the ordered identities in `chapter-manifest.json` appear as package-backed
chapters in the reader.

The publication verifier fails closed on duplicate or unordered chapter
numbers, duplicate stable IDs, identity drift between the session and manifest,
metadata count/range mismatches, falsely complete versions, or a session byte
length/SHA-256 mismatch. Do not repair those failures by truncating, inventing,
or silently renumbering chapters; resolve them from provenance and regenerate
the manifest.

## Technical Implementation

### Default Registry

The default registry is hosted at:
```
https://raw.githubusercontent.com/lexiconforge/lexiconforge-novels/main/registry.json
```

Users can configure a custom registry URL in Settings if they want to use a different source.

### Session Provenance

All exported sessions include provenance tracking:

```typescript
interface SessionProvenance {
  originalCreator: {
    name: string;
    link?: string;
  };
  forkedFrom?: string;  // Parent version ID
  contributors: Array<{
    name: string;
    link?: string;
    contributions: string[];
  }>;
  changes?: string;
}
```

This ensures proper credit attribution across forks and remixes.

### Statistics Calculation

Statistics are computed from the session data:

- **Content stats**: Count images, footnotes, chapters during export
- **Translation type**: User-specified (human/AI/hybrid) with AI percentage
- **Quality ratings**: Aggregated from community feedback (future feature)
- **Coverage distribution**: Computed from version chapter ranges

## Development

### Testing

**Unit Tests:**
- `tests/services/exportService.test.ts` - Export flows
- `tests/services/registryService.test.ts` - Registry fetching
- `tests/components/VersionPicker.test.tsx` - Version selection
- `tests/components/CoverageDistribution.test.tsx` - Distribution viz

**Integration Tests:**
- `tests/integration/registry.test.ts` - Full registry loading

**E2E Tests:**
- `tests/e2e/novel-library-flow.test.tsx` - Complete user journey

### Adding New Features

**To add a new statistic type:**

1. Update `VersionStats` type in `types/novel.ts`
2. Add computation logic to `ExportService.calculateStats()`
3. Update `VersionPicker` component to display new stat
4. Add tests

**To modify the registry format:**

1. Update `Registry` type in `types/novel.ts`
2. Update `RegistryService.fetchRegistry()` parsing
3. Maintain backwards compatibility or bump version
4. Update documentation

## FAQ

**Q: How do I host my novel's files?**

A: You can use:
- GitHub repo (free, version control, collaborative)
- GitHub releases (for large files)
- CDN (fast global access)
- Personal server (full control)

**Q: Can I have multiple versions in progress?**

A: Yes! Each version tracks its own `completionStatus` (Complete / In Progress / Abandoned).

**Q: How are statistics calculated?**

A: Statistics are computed during export from your session data. You can verify them in the exported `metadata.json`.

**Q: Can I update an existing version?**

A: Yes, simply export again with the same version ID and update the hosted files.

**Q: How do translations get rated?**

A: Currently, quality ratings are manually entered. Community feedback features are planned for future releases.

**Q: What if the registry is unavailable?**

A: The NovelLibrary component gracefully handles failures and shows an error notification. Users can still import novels via local files.

## Roadmap

Future enhancements planned:

- ☐ Community feedback and rating system
- ☐ In-app version comparison tool
- ☐ Auto-update checks for versions
- ☐ Translation progress tracking
- ☐ Collaborative editing features
- ☐ Decentralized registry support (IPFS, etc.)

## Credits

This community library system was designed with inspiration from:
- **GitHub**: Fork/PR workflow for collaboration
- **npm**: Registry + distributed packages model
- **Scanlation community**: Multiple translation groups, version tracking

Built with ❤️ for the web novel translation community.
