# Image Gallery & Cover Selection Design

> **Status:** ✅ Implemented — `GalleryPanel.tsx`, `ImageLightbox.tsx`, cover selection integrated.

**Date:** 2025-12-29
**Status:** Approved

## Overview

Add an image gallery to browse all generated images across chapters, with the ability to select one as the EPUB cover. This also includes restructuring the Settings modal from horizontal tabs to sidebar navigation.

---

## Settings Modal Restructure

### New Sidebar Navigation

Replace horizontal tabs with collapsible sidebar sections:

```
┌─────────────────┬────────────────────────────────┐
│                 │                                │
│ ⚙️ Settings     │                                │
│   ├ Providers   │                                │
│   ├ Prompt      │     [Active Panel Content]     │
│   └ Advanced    │                                │
│                 │                                │
│ ✨ Features     │                                │
│   ├ Display     │                                │
│   ├ Audio       │                                │
│   └ Diff        │                                │
│                 │                                │
│ 📁 Workspace    │                                │
│   ├ Templates   │                                │
│   ├ Metadata    │                                │
│   └ Gallery     │  ◀── NEW                       │
│                 │                                │
│ 📤 Export       │                                │
│   └ Export      │                                │
│                 │                                │
└─────────────────┴────────────────────────────────┘
```

### Tab Reorganization

| Old Location | New Location | Notes |
|--------------|--------------|-------|
| General | Split → Prompt (Settings) + Display (Features) | Prompt is a setting, Display is a feature |
| Providers | Settings > Providers | No change |
| Features | Features section | Becomes a section header |
| Advanced | Settings > Advanced | No change |
| Audio | Features > Audio | Always visible in sidebar |
| Templates | Workspace > Templates | Content management |
| Metadata | Workspace > Metadata | Content management |
| Export | Export section | Action panel |
| *NEW* | Workspace > Gallery | Image browsing |

### Conditional UI

- **Audio tab in sidebar:** Always visible (user needs to find it to enable)
- **Audio icon in chapter UI:** Hidden when "Enable Audio" is OFF in Features
- Same pattern as diff heatmap toggle

---

## Gallery Panel Design

### Layout

```
┌─────────────────────────────────────────────────────┐
│  🖼️ Image Gallery                    [Cover: None] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ▼ Chapter 1: The Beginning (3 images)              │
│  ┌───────┐  ┌───────┐  ┌───────┐                   │
│  │ 🏆    │  │       │  │       │                   │
│  │ img 1 │  │ img 2 │  │ img 3 │                   │
│  └───────┘  └───────┘  └───────┘                   │
│                                                     │
│  ▼ Chapter 5: The Dark Forest (2 images)            │
│  ┌───────┐  ┌───────┐                              │
│  │       │  │       │                              │
│  │ img 1 │  │ img 2 │                              │
│  └───────┘  └───────┘                              │
│                                                     │
│  ▶ Chapter 8: Confrontation (1 image)  [collapsed] │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Elements

- Header shows current cover selection (or "None")
- Chapters as collapsible sections with image count
- Thumbnails in responsive grid (3-4 per row)
- 🏆 badge on selected cover image
- Click thumbnail → opens lightbox

---

## Lightbox Design

### Layout

```
┌─────────────────────────────────────────────────────────┐
│                                              [✕ Close] │
│                                                         │
│      ◀                                        ▶        │
│                                                         │
│              ┌─────────────────────────┐               │
│              │                         │               │
│              │                         │               │
│              │      [Full Image]       │               │
│              │                         │               │
│              │                         │               │
│              └─────────────────────────┘               │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Chapter 5 • Image 2 of 3                         │  │
│  │ Prompt: "A dark forest with twisted trees..."    │  │
│  │                                                  │  │
│  │              [🏆 Set as Cover]                   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Behavior

- ◀ ▶ arrows navigate between images (across all chapters)
- Shows chapter name, image position, prompt used
- "Set as Cover" → instantly selects, button changes to "✓ Cover Selected"
- Click outside or ✕ to close
- Keyboard: Esc to close, ←→ to navigate

---

## Data Flow & Persistence

### Cover Selection Storage

```
Select cover → Save to novelMetadata.coverImage → Persisted in IndexedDB
                                                          │
Days later → Load session → novelMetadata restored → Gallery shows badge
                                                          │
Export EPUB → Read from novelMetadata.coverImage → Include in EPUB
```

### Cover Image Reference

```typescript
// In novel metadata
coverImage: {
  chapterId: string;        // e.g., "ch-005"
  marker: string;           // e.g., "ILLUSTRATION-2"
  cacheKey: ImageCacheKey;  // For fetching from Cache API
}
```

### EPUB Integration

When exporting with cover selected:
1. Fetch image data from Cache API using cacheKey
2. Add to EPUB manifest with `properties="cover-image"`
3. Create cover.xhtml page displaying the image
4. Add cover page to spine (first position)

If no cover selected: EPUB exports without cover (current behavior)

---

## Implementation Plan

### New Files

| File | Purpose | Est. LOC |
|------|---------|----------|
| `components/settings/GalleryPanel.tsx` | Main gallery with chapter sections | ~150 |
| `components/settings/ImageLightbox.tsx` | Full-screen overlay with navigation | ~120 |
| `components/settings/SettingsSidebar.tsx` | Sidebar navigation component | ~100 |

### Files to Modify

| File | Changes |
|------|---------|
| `components/SettingsModal.tsx` | Replace tabs with sidebar, add Gallery route |
| `components/settings/FeaturesPanel.tsx` | Add "Enable Audio" toggle |
| `services/epubService/types.ts` | Ensure coverImage type supports cache key |
| `services/epubService/packagers/epubPackager.ts` | Wire cover into EPUB |
| `hooks/useNovelMetadata.ts` | Add cover selection persistence |

### Estimated Scope

- ~400-500 lines new code
- ~100 lines modifications

---

## Future Considerations

(Captured in docs/FUTURE-FEATURES.md)

- Display customization: emphasis styles, paragraph spacing, themes
- Audio conditional visibility in chapter UI
- Additional gallery features: search, filter by chapter, bulk actions
