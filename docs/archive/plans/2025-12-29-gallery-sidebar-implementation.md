# Gallery & Sidebar Navigation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace horizontal tabs in SettingsModal with sidebar navigation and add an image gallery with cover selection for EPUB export.

**Architecture:** Create a new SettingsSidebar component that renders collapsible sections. Extract "General" into "Prompt" (under Settings) and move "Display" into Features. Add GalleryPanel and ImageLightbox components for image browsing. Store cover selection in novel metadata for persistence.

**Tech Stack:** React, TypeScript, Tailwind CSS, Zustand store, existing Cache API for images

---

## Phase 1: Sidebar Navigation

### Task 1: Create SettingsSidebar Component

**Files:**
- Create: `components/settings/SettingsSidebar.tsx`
- Test: `components/settings/SettingsSidebar.test.tsx`

**Step 1: Write the failing test**

```typescript
// components/settings/SettingsSidebar.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SettingsSidebar } from './SettingsSidebar';

const mockSections = [
  {
    id: 'settings',
    label: 'Settings',
    icon: '⚙️',
    items: [
      { id: 'providers', label: 'Providers' },
      { id: 'prompt', label: 'Prompt' },
      { id: 'advanced', label: 'Advanced' },
    ],
  },
  {
    id: 'features',
    label: 'Features',
    icon: '✨',
    items: [
      { id: 'display', label: 'Display' },
      { id: 'audio', label: 'Audio' },
    ],
  },
];

describe('SettingsSidebar', () => {
  it('renders all sections and items', () => {
    const onSelect = vi.fn();
    render(
      <SettingsSidebar
        sections={mockSections}
        activeItem="providers"
        onSelect={onSelect}
      />
    );

    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.getByText('Providers')).toBeInTheDocument();
    expect(screen.getByText('Audio')).toBeInTheDocument();
  });

  it('calls onSelect when item clicked', () => {
    const onSelect = vi.fn();
    render(
      <SettingsSidebar
        sections={mockSections}
        activeItem="providers"
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByText('Audio'));
    expect(onSelect).toHaveBeenCalledWith('audio');
  });

  it('highlights active item', () => {
    const onSelect = vi.fn();
    render(
      <SettingsSidebar
        sections={mockSections}
        activeItem="providers"
        onSelect={onSelect}
      />
    );

    const activeItem = screen.getByText('Providers').closest('button');
    expect(activeItem).toHaveClass('bg-blue-600');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- components/settings/SettingsSidebar.test.tsx --run`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// components/settings/SettingsSidebar.tsx
import React, { useState } from 'react';

export interface SidebarItem {
  id: string;
  label: string;
  hidden?: boolean;
}

export interface SidebarSection {
  id: string;
  label: string;
  icon: string;
  items: SidebarItem[];
}

interface SettingsSidebarProps {
  sections: SidebarSection[];
  activeItem: string;
  onSelect: (itemId: string) => void;
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  sections,
  activeItem,
  onSelect,
}) => {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  return (
    <div className="w-48 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-y-auto">
      {sections.map((section) => (
        <div key={section.id} className="py-2">
          <button
            onClick={() => toggleSection(section.id)}
            className="w-full px-4 py-2 flex items-center gap-2 text-left text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <span>{section.icon}</span>
            <span>{section.label}</span>
            <span className="ml-auto text-xs">
              {collapsedSections.has(section.id) ? '▶' : '▼'}
            </span>
          </button>
          {!collapsedSections.has(section.id) && (
            <div className="mt-1">
              {section.items
                .filter((item) => !item.hidden)
                .map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onSelect(item.id)}
                    className={`w-full px-4 py-2 pl-10 text-left text-sm ${
                      activeItem === item.id
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
```

**Step 4: Run test to verify it passes**

Run: `npm test -- components/settings/SettingsSidebar.test.tsx --run`
Expected: PASS

**Step 5: Commit**

```bash
git add components/settings/SettingsSidebar.tsx components/settings/SettingsSidebar.test.tsx
git commit -m "feat(settings): add SettingsSidebar component with collapsible sections"
```

---

### Task 2: Create PromptPanel (extracted from GeneralPanel)

**Files:**
- Create: `components/settings/PromptPanel.tsx` (if not exists, or verify it exists)
- Modify: Check existing GeneralPanel and ensure Prompt is separate

**Step 1: Verify PromptPanel exists**

Run: `ls -la components/settings/PromptPanel.tsx`

If exists, skip to Task 3. If not, create it by extracting prompt-related settings from GeneralPanel.

**Step 2: Commit if changes made**

```bash
git add components/settings/PromptPanel.tsx
git commit -m "refactor(settings): ensure PromptPanel is standalone"
```

---

### Task 3: Integrate Sidebar into SettingsModal

**Files:**
- Modify: `components/SettingsModal.tsx`

**Step 1: Read current SettingsModal structure**

Understand current tab configuration and panel rendering.

**Step 2: Replace tabs with sidebar**

Update SettingsModal.tsx to:
1. Import SettingsSidebar
2. Define sections array matching new structure
3. Replace SettingsTabs with SettingsSidebar
4. Update layout to sidebar + content panel

**Step 3: Update tab IDs**

Change from: `'providers' | 'general' | 'features' | 'export' | 'templates' | 'audio' | 'advanced' | 'metadata'`

To: `'providers' | 'prompt' | 'advanced' | 'display' | 'audio' | 'diff' | 'templates' | 'metadata' | 'gallery' | 'export'`

**Step 4: Run existing tests**

Run: `npm test -- components/SettingsModal --run`
Expected: Some tests may need updating for new structure

**Step 5: Update failing tests**

Fix any tests that reference old tab structure.

**Step 6: Commit**

```bash
git add components/SettingsModal.tsx
git commit -m "refactor(settings): replace horizontal tabs with sidebar navigation"
```

---

## Phase 2: Gallery Panel

### Task 4: Create GalleryPanel Component

**Files:**
- Create: `components/settings/GalleryPanel.tsx`
- Test: `components/settings/GalleryPanel.test.tsx`

**Step 1: Write the failing test**

```typescript
// components/settings/GalleryPanel.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GalleryPanel } from './GalleryPanel';

// Mock the store
vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn(() => ({
    chapters: {
      'ch1': {
        translationResult: {
          suggestedIllustrations: [
            { placementMarker: '[ILLUSTRATION-1]', imagePrompt: 'A hero', url: 'data:image/png;base64,abc' },
          ],
        },
      },
    },
  })),
}));

describe('GalleryPanel', () => {
  it('renders gallery header', () => {
    render(<GalleryPanel />);
    expect(screen.getByText(/Image Gallery/i)).toBeInTheDocument();
  });

  it('shows "No images" when no illustrations exist', () => {
    vi.mocked(useAppStore).mockReturnValue({ chapters: {} });
    render(<GalleryPanel />);
    expect(screen.getByText(/No images/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- components/settings/GalleryPanel.test.tsx --run`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// components/settings/GalleryPanel.tsx
import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ImageLightbox } from './ImageLightbox';

interface GalleryImage {
  chapterId: string;
  chapterTitle: string;
  marker: string;
  prompt: string;
  imageData: string;
  cacheKey?: any;
}

export const GalleryPanel: React.FC = () => {
  const chapters = useAppStore((s) => s.chapters);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const imagesByChapter = useMemo(() => {
    const result: Record<string, GalleryImage[]> = {};

    Object.entries(chapters).forEach(([chapterId, data]) => {
      const illustrations = data?.translationResult?.suggestedIllustrations || [];
      const chapterTitle = data?.chapter?.title || chapterId;

      const images = illustrations
        .filter((ill: any) => ill.url || ill.generatedImage?.imageData)
        .map((ill: any) => ({
          chapterId,
          chapterTitle,
          marker: ill.placementMarker,
          prompt: ill.imagePrompt,
          imageData: ill.generatedImage?.imageData || ill.url || '',
          cacheKey: ill.imageCacheKey,
        }));

      if (images.length > 0) {
        result[chapterId] = images;
      }
    });

    return result;
  }, [chapters]);

  const allImages = useMemo(() => {
    return Object.values(imagesByChapter).flat();
  }, [imagesByChapter]);

  const coverImage = useAppStore((s) => s.novelMetadata?.coverImage);

  const handleImageClick = (image: GalleryImage) => {
    setSelectedImage(image);
    setLightboxOpen(true);
  };

  const handleSetCover = (image: GalleryImage) => {
    // Will implement in Task 6
    console.log('Set cover:', image);
  };

  if (Object.keys(imagesByChapter).length === 0) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        <p className="text-lg">No images generated yet</p>
        <p className="text-sm mt-2">
          Generate illustrations in chapters to see them here
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 overflow-y-auto h-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Image Gallery</h2>
        <span className="text-sm text-gray-500">
          Cover: {coverImage ? 'Selected' : 'None'}
        </span>
      </div>

      {Object.entries(imagesByChapter).map(([chapterId, images]) => (
        <ChapterSection
          key={chapterId}
          title={images[0]?.chapterTitle || chapterId}
          images={images}
          coverMarker={coverImage?.marker}
          onImageClick={handleImageClick}
        />
      ))}

      {lightboxOpen && selectedImage && (
        <ImageLightbox
          image={selectedImage}
          allImages={allImages}
          onClose={() => setLightboxOpen(false)}
          onSetCover={handleSetCover}
          isCover={coverImage?.marker === selectedImage.marker}
        />
      )}
    </div>
  );
};

interface ChapterSectionProps {
  title: string;
  images: GalleryImage[];
  coverMarker?: string;
  onImageClick: (image: GalleryImage) => void;
}

const ChapterSection: React.FC<ChapterSectionProps> = ({
  title,
  images,
  coverMarker,
  onImageClick,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="mb-4">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 py-2 text-left font-medium text-gray-700 dark:text-gray-200"
      >
        <span>{collapsed ? '▶' : '▼'}</span>
        <span>{title}</span>
        <span className="text-sm text-gray-500">({images.length} images)</span>
      </button>

      {!collapsed && (
        <div className="grid grid-cols-3 gap-2 mt-2">
          {images.map((image, idx) => (
            <div
              key={`${image.marker}-${idx}`}
              className="relative cursor-pointer group"
              onClick={() => onImageClick(image)}
            >
              <img
                src={image.imageData}
                alt={image.prompt}
                className="w-full h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-600 group-hover:border-blue-500"
              />
              {coverMarker === image.marker && (
                <div className="absolute top-1 left-1 bg-yellow-500 text-white text-xs px-1 rounded">
                  🏆
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GalleryPanel;
```

**Step 4: Run test to verify it passes**

Run: `npm test -- components/settings/GalleryPanel.test.tsx --run`
Expected: PASS

**Step 5: Commit**

```bash
git add components/settings/GalleryPanel.tsx components/settings/GalleryPanel.test.tsx
git commit -m "feat(gallery): add GalleryPanel with chapter-grouped images"
```

---

### Task 5: Create ImageLightbox Component

**Files:**
- Create: `components/settings/ImageLightbox.tsx`
- Test: `components/settings/ImageLightbox.test.tsx`

**Step 1: Write the failing test**

```typescript
// components/settings/ImageLightbox.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ImageLightbox } from './ImageLightbox';

const mockImage = {
  chapterId: 'ch1',
  chapterTitle: 'Chapter 1',
  marker: '[ILLUSTRATION-1]',
  prompt: 'A dramatic scene',
  imageData: 'data:image/png;base64,abc',
};

const mockAllImages = [mockImage];

describe('ImageLightbox', () => {
  it('renders image and prompt', () => {
    render(
      <ImageLightbox
        image={mockImage}
        allImages={mockAllImages}
        onClose={vi.fn()}
        onSetCover={vi.fn()}
        isCover={false}
      />
    );

    expect(screen.getByAltText('A dramatic scene')).toBeInTheDocument();
    expect(screen.getByText(/A dramatic scene/)).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(
      <ImageLightbox
        image={mockImage}
        allImages={mockAllImages}
        onClose={onClose}
        onSetCover={vi.fn()}
        isCover={false}
      />
    );

    fireEvent.click(screen.getByText('✕'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows Set as Cover button when not cover', () => {
    render(
      <ImageLightbox
        image={mockImage}
        allImages={mockAllImages}
        onClose={vi.fn()}
        onSetCover={vi.fn()}
        isCover={false}
      />
    );

    expect(screen.getByText(/Set as Cover/)).toBeInTheDocument();
  });

  it('shows Cover Selected when is cover', () => {
    render(
      <ImageLightbox
        image={mockImage}
        allImages={mockAllImages}
        onClose={vi.fn()}
        onSetCover={vi.fn()}
        isCover={true}
      />
    );

    expect(screen.getByText(/Cover Selected/)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- components/settings/ImageLightbox.test.tsx --run`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// components/settings/ImageLightbox.tsx
import React, { useEffect, useCallback, useState } from 'react';

interface GalleryImage {
  chapterId: string;
  chapterTitle: string;
  marker: string;
  prompt: string;
  imageData: string;
  cacheKey?: any;
}

interface ImageLightboxProps {
  image: GalleryImage;
  allImages: GalleryImage[];
  onClose: () => void;
  onSetCover: (image: GalleryImage) => void;
  isCover: boolean;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  image,
  allImages,
  onClose,
  onSetCover,
  isCover,
}) => {
  const [currentIndex, setCurrentIndex] = useState(() =>
    allImages.findIndex((img) => img.marker === image.marker)
  );

  const currentImage = allImages[currentIndex] || image;

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1));
  }, [allImages.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0));
  }, [allImages.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goToPrev();
      if (e.key === 'ArrowRight') goToNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goToPrev, goToNext]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300"
      >
        ✕
      </button>

      {/* Navigation arrows */}
      {allImages.length > 1 && (
        <>
          <button
            onClick={goToPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-4xl hover:text-gray-300"
          >
            ◀
          </button>
          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-4xl hover:text-gray-300"
          >
            ▶
          </button>
        </>
      )}

      {/* Main content */}
      <div className="max-w-4xl max-h-[90vh] flex flex-col items-center">
        <img
          src={currentImage.imageData}
          alt={currentImage.prompt}
          className="max-h-[70vh] object-contain rounded-lg"
        />

        {/* Info panel */}
        <div className="mt-4 bg-gray-800 rounded-lg p-4 w-full max-w-xl">
          <div className="text-gray-400 text-sm">
            {currentImage.chapterTitle} • Image {currentIndex + 1} of {allImages.length}
          </div>
          <div className="text-white mt-2 text-sm">
            Prompt: "{currentImage.prompt}"
          </div>

          <button
            onClick={() => onSetCover(currentImage)}
            disabled={isCover && currentImage.marker === image.marker}
            className={`mt-4 w-full py-2 rounded-lg font-medium ${
              isCover && currentImage.marker === image.marker
                ? 'bg-green-600 text-white cursor-default'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isCover && currentImage.marker === image.marker
              ? '✓ Cover Selected'
              : '🏆 Set as Cover'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageLightbox;
```

**Step 4: Run test to verify it passes**

Run: `npm test -- components/settings/ImageLightbox.test.tsx --run`
Expected: PASS

**Step 5: Commit**

```bash
git add components/settings/ImageLightbox.tsx components/settings/ImageLightbox.test.tsx
git commit -m "feat(gallery): add ImageLightbox with navigation and cover selection"
```

---

## Phase 3: Cover Persistence & EPUB Integration

### Task 6: Add Cover to Novel Metadata

**Files:**
- Modify: `hooks/useNovelMetadata.ts`
- Modify: `types.ts` (NovelMetadata type if needed)

**Step 1: Check current NovelMetadata type**

Read types.ts to understand current structure.

**Step 2: Add coverImage field to metadata handling**

Update useNovelMetadata to handle coverImage with chapterId, marker, cacheKey.

**Step 3: Wire up GalleryPanel to save cover selection**

Update GalleryPanel's handleSetCover to call the metadata update function.

**Step 4: Run tests**

Run: `npm test -- --run`
Expected: All tests pass

**Step 5: Commit**

```bash
git add hooks/useNovelMetadata.ts components/settings/GalleryPanel.tsx
git commit -m "feat(metadata): persist cover image selection in novel metadata"
```

---

### Task 7: Wire Cover into EPUB Packager

**Files:**
- Modify: `services/epubService/packagers/epubPackager.ts`
- Modify: `services/epubService/types.ts`

**Step 1: Update EpubMeta type**

Add coverImage field to EpubMeta interface.

**Step 2: Update generateEpub3WithJSZip**

1. Accept cover in EpubMeta
2. Fetch cover image data from cache
3. Add cover to manifest with `properties="cover-image"`
4. Create cover.xhtml page
5. Add cover.xhtml to spine as first item

**Step 3: Update epubService.ts to pass cover**

Pass novelMetadata.coverImage to the packager.

**Step 4: Test manually**

Generate an EPUB with cover selected and verify it appears.

**Step 5: Commit**

```bash
git add services/epubService/packagers/epubPackager.ts services/epubService/types.ts services/epubService.ts
git commit -m "feat(epub): add cover image support from gallery selection"
```

---

## Phase 4: Final Integration

### Task 8: Add Gallery to Sidebar Config

**Files:**
- Modify: `components/SettingsModal.tsx`

**Step 1: Add Gallery to sidebar sections**

Add Gallery item under Workspace section.

**Step 2: Add GalleryPanel rendering**

Add case for 'gallery' in panel rendering switch.

**Step 3: Test full flow**

1. Open Settings
2. Navigate to Gallery in sidebar
3. Click an image → lightbox opens
4. Set as cover → badge appears
5. Export EPUB → cover appears

**Step 4: Commit**

```bash
git add components/SettingsModal.tsx
git commit -m "feat(settings): integrate Gallery panel into sidebar navigation"
```

---

### Task 9: Final Tests & Cleanup

**Step 1: Run full test suite**

Run: `npm test -- --run`
Expected: All tests pass

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors (or only pre-existing ones)

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: cleanup and final adjustments for gallery feature"
```

---

## Summary

| Phase | Tasks | Estimated LOC |
|-------|-------|---------------|
| Phase 1: Sidebar | Tasks 1-3 | ~200 |
| Phase 2: Gallery | Tasks 4-5 | ~250 |
| Phase 3: Persistence | Tasks 6-7 | ~100 |
| Phase 4: Integration | Tasks 8-9 | ~50 |
| **Total** | 9 tasks | ~600 |
