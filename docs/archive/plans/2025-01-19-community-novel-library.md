# Community Novel Library Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Transform the novel library into a GitHub-style collaborative translation ecosystem where users can fork, remix, and contribute enhanced versions of novels.

**Architecture:** Hybrid registry + metadata approach. Centralized curated registry (registry.json) lists novel metadata URLs. Each metadata file contains all versions of a novel. Session JSONs include provenance tracking for lineage. Two-step export: Quick Export for private use, Publish to Library for community sharing.

**Tech Stack:** React, TypeScript, Zustand, IndexedDB, Vitest for testing

---

## Implementation Phases

**Phase 1:** Type System & Data Structures (Foundation)
**Phase 2:** Session Provenance Tracking
**Phase 3:** Settings UI Reorganization
**Phase 4:** Novel Metadata Form
**Phase 5:** Export Flows (Quick, Publish, Fork)
**Phase 6:** Registry & Metadata Service
**Phase 7:** Version Picker UI
**Phase 8:** Import with Version Support

---

## Phase 1: Type System & Data Structures

### Task 1.1: Extend Novel Types

**Files:**
- Modify: `types/novel.ts`
- Create: `types/novel.test.ts`

**Step 1: Write type tests**

Create `types/novel.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type {
  NovelVersion,
  NovelMetadata,
  NovelProvenance,
  VersionContributor
} from './novel';

describe('Novel Types', () => {
  it('should accept valid version with all fields', () => {
    const version: NovelVersion = {
      versionId: 'test-v1',
      displayName: 'Test Version',
      translator: { name: 'Alice', link: 'https://github.com/alice' },
      sessionJsonUrl: 'https://example.com/session.json',
      targetLanguage: 'English',
      style: 'faithful',
      features: ['footnotes'],
      chapterRange: { from: 1, to: 50 },
      completionStatus: 'Complete',
      lastUpdated: '2025-01-19',
      stats: {
        downloads: 100,
        fileSize: '5 MB',
        content: {
          totalImages: 25,
          totalFootnotes: 150,
          totalRawChapters: 50,
          totalTranslatedChapters: 50,
          avgImagesPerChapter: 0.5,
          avgFootnotesPerChapter: 3
        },
        translation: {
          translationType: 'human',
          qualityRating: 4.5,
          feedbackCount: 42
        }
      }
    };

    expect(version.versionId).toBe('test-v1');
    expect(version.stats.content.totalImages).toBe(25);
  });

  it('should accept version with basedOn for forks', () => {
    const fork: NovelVersion = {
      versionId: 'fork-v1',
      displayName: 'Fork Version',
      translator: { name: 'Bob' },
      sessionJsonUrl: 'https://example.com/fork.json',
      targetLanguage: 'English',
      style: 'image-heavy',
      features: ['ai-images'],
      basedOn: 'test-v1',
      chapterRange: { from: 1, to: 10 },
      completionStatus: 'In Progress',
      lastUpdated: '2025-01-19',
      stats: { downloads: 10, fileSize: '10 MB' }
    };

    expect(fork.basedOn).toBe('test-v1');
  });

  it('should accept provenance with contributors', () => {
    const provenance: NovelProvenance = {
      originalCreator: {
        name: 'Alice',
        versionId: 'alice-v1',
        createdAt: '2025-01-01T00:00:00Z'
      },
      forkedFrom: {
        versionId: 'alice-v1',
        sessionUrl: 'https://example.com/alice.json',
        forkedAt: '2025-01-15T00:00:00Z'
      },
      contributors: [
        { name: 'Alice', role: 'original-translator', dateRange: '2025-01-01' },
        { name: 'Bob', role: 'enhancer', changes: 'Added images', dateRange: '2025-01-15' }
      ]
    };

    expect(provenance.contributors).toHaveLength(2);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test types/novel.test.ts
```

Expected: FAIL - types don't exist yet

**Step 3: Update novel types**

Modify `types/novel.ts`:

```typescript
/**
 * Novel Library Types
 * Metadata for curated novel sessions with version support
 */

export interface TranslatorInfo {
  name: string;
  link?: string;
}

export interface ChapterRange {
  from: number;
  to: number;
}

export interface VersionContentStats {
  totalImages: number;
  totalFootnotes: number;
  totalRawChapters: number;
  totalTranslatedChapters: number;
  avgImagesPerChapter: number;
  avgFootnotesPerChapter: number;
}

export interface VersionTranslationStats {
  translationType: 'human' | 'ai' | 'hybrid';
  aiPercentage?: number;  // If hybrid
  qualityRating?: number; // Community rating 1-5
  feedbackCount: number;
}

export interface ChapterCoverageStats {
  chaptersWithMultipleVersions: number;
  avgVersionsPerChapter: number;
  medianVersionsPerChapter: number;
  maxVersionsForAnyChapter: number;
  coverageDistribution: { [chapterNumber: number]: number }; // chapter -> version count
}

export interface VersionStats {
  downloads: number;
  fileSize: string;
  content: VersionContentStats;
  translation: VersionTranslationStats;
  coverage?: ChapterCoverageStats; // Optional: for aggregate view
}

export interface NovelVersion {
  versionId: string;
  displayName: string;
  translator: TranslatorInfo;
  sessionJsonUrl: string;
  targetLanguage: string;
  style: 'faithful' | 'liberal' | 'image-heavy' | 'audio-enhanced' | 'other';
  features: string[];
  chapterRange: ChapterRange;
  completionStatus: 'Complete' | 'In Progress' | 'Abandoned';
  lastUpdated: string;
  basedOn?: string;  // Parent version ID for forks
  stats: VersionStats;
  description?: string;
}

export interface SourceLinks {
  novelUpdates?: string;
  rawSource?: string;
  manga?: string;
  anime?: string;
}

export interface NovelMetadata {
  originalLanguage: string;
  targetLanguage?: string;  // Make optional since versions have this
  chapterCount?: number;     // Make optional since versions have ranges
  genres: string[];
  description: string;
  coverImageUrl?: string;
  author?: string;
  rating?: number;
  sourceLinks?: SourceLinks;
  translator?: string;       // Deprecated: use version.translator
  tags?: string[];
  publicationStatus?: 'Ongoing' | 'Completed' | 'Hiatus' | 'Cancelled';
  originalPublicationDate?: string;
  lastUpdated: string;
}

export interface NovelEntry {
  id: string;
  title: string;
  alternateTitles?: string[];
  sessionJsonUrl?: string;   // Deprecated: use versions
  metadata: NovelMetadata;
  versions?: NovelVersion[];  // New: multiple versions per novel
}

export interface NovelCatalog {
  version: string;
  lastUpdated: string;
  novels: NovelEntry[];
}

// New: Registry structure
export interface RegistryEntry {
  id: string;
  metadataUrl: string;
}

export interface Registry {
  version: string;
  lastUpdated: string;
  novels: RegistryEntry[];
}

// New: Session provenance tracking
export interface VersionContributor {
  name: string;
  link?: string;
  role: 'original-translator' | 'enhancer' | 'editor' | 'other';
  changes?: string;
  dateRange: string;
}

export interface NovelProvenance {
  originalCreator: {
    name: string;
    link?: string;
    versionId: string;
    createdAt: string;
  };
  forkedFrom?: {
    versionId: string;
    sessionUrl: string;
    forkedAt: string;
  };
  contributors: VersionContributor[];
}
```

**Step 4: Run test to verify it passes**

```bash
npm test types/novel.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add types/novel.ts types/novel.test.ts
git commit -m "feat(types): add version and provenance support to novel types"
```

---

### Task 1.2: Extend Session Types

**Files:**
- Modify: `types/session.ts` (or create if doesn't exist)
- Create: `types/session.test.ts`

**Step 1: Write type tests**

Create `types/session.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { SessionMetadata, SessionVersion, SessionProvenance } from './session';

describe('Session Types', () => {
  it('should accept session metadata with format version', () => {
    const metadata: SessionMetadata = {
      format: 'lexiconforge-session',
      version: '2.0',
      exportedAt: '2025-01-19T10:30:00Z'
    };

    expect(metadata.version).toBe('2.0');
  });

  it('should accept session version info', () => {
    const version: SessionVersion = {
      versionId: 'alice-v1',
      displayName: 'Alice Community Translation',
      style: 'faithful',
      features: ['footnotes', 'cultural-notes']
    };

    expect(version.features).toContain('footnotes');
  });

  it('should accept session with provenance', () => {
    const provenance: SessionProvenance = {
      originalCreator: {
        name: 'Alice',
        versionId: 'alice-v1',
        createdAt: '2025-01-01T00:00:00Z'
      },
      contributors: [
        { name: 'Alice', role: 'original-translator', dateRange: '2025-01-01' }
      ]
    };

    expect(provenance.originalCreator.name).toBe('Alice');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test types/session.test.ts
```

Expected: FAIL - types don't exist

**Step 3: Create session types**

Create or modify `types/session.ts`:

```typescript
/**
 * Session Export/Import Types
 */

import type { NovelProvenance } from './novel';

export interface SessionMetadata {
  format: 'lexiconforge-session';
  version: '2.0';
  exportedAt: string;
}

export interface SessionNovelInfo {
  id: string;
  title: string;
}

export interface SessionVersion {
  versionId: string;
  displayName: string;
  style: 'faithful' | 'liberal' | 'image-heavy' | 'audio-enhanced' | 'other';
  features: string[];
}

export interface SessionProvenance extends NovelProvenance {
  // Inherits all fields from NovelProvenance
}

export interface SessionData {
  metadata: SessionMetadata;
  novel: SessionNovelInfo;
  version: SessionVersion;
  provenance: SessionProvenance;
  chapters: any[];  // Will be defined by existing chapter types
  settings?: any;    // EPUB and other settings
}
```

**Step 4: Run test to verify it passes**

```bash
npm test types/session.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add types/session.ts types/session.test.ts
git commit -m "feat(types): add session export/import types with provenance"
```

---

## Phase 2: Session Provenance Tracking

### Task 2.1: Add Provenance to Store

**Files:**
- Modify: `store/index.ts`
- Create: `tests/store/provenance.test.ts`

**Step 1: Write test for provenance state**

Create `tests/store/provenance.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../store';
import type { SessionProvenance } from '../../types/session';

describe('Store Provenance', () => {
  beforeEach(() => {
    useAppStore.setState({
      sessionProvenance: null,
      sessionVersion: null
    });
  });

  it('should set session provenance', () => {
    const provenance: SessionProvenance = {
      originalCreator: {
        name: 'Alice',
        versionId: 'alice-v1',
        createdAt: '2025-01-01T00:00:00Z'
      },
      contributors: [
        { name: 'Alice', role: 'original-translator', dateRange: '2025-01-01' }
      ]
    };

    useAppStore.getState().setSessionProvenance(provenance);

    expect(useAppStore.getState().sessionProvenance).toEqual(provenance);
  });

  it('should update contributors when adding new contributor', () => {
    const initialProvenance: SessionProvenance = {
      originalCreator: {
        name: 'Alice',
        versionId: 'alice-v1',
        createdAt: '2025-01-01T00:00:00Z'
      },
      contributors: [
        { name: 'Alice', role: 'original-translator', dateRange: '2025-01-01' }
      ]
    };

    useAppStore.getState().setSessionProvenance(initialProvenance);

    const updatedProvenance = {
      ...initialProvenance,
      contributors: [
        ...initialProvenance.contributors,
        { name: 'Bob', role: 'enhancer' as const, changes: 'Added images', dateRange: '2025-01-15' }
      ]
    };

    useAppStore.getState().setSessionProvenance(updatedProvenance);

    expect(useAppStore.getState().sessionProvenance?.contributors).toHaveLength(2);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test tests/store/provenance.test.ts
```

Expected: FAIL - state fields and actions don't exist

**Step 3: Add provenance to store**

Modify `store/index.ts` (find the store interface and add):

```typescript
import type { SessionProvenance, SessionVersion } from '../types/session';

// Add to store interface
interface AppStore {
  // ... existing fields

  // New: Session provenance and version
  sessionProvenance: SessionProvenance | null;
  sessionVersion: SessionVersion | null;

  // Actions
  setSessionProvenance: (provenance: SessionProvenance | null) => void;
  setSessionVersion: (version: SessionVersion | null) => void;
}

// Add to store implementation
export const useAppStore = create<AppStore>((set, get) => ({
  // ... existing state

  sessionProvenance: null,
  sessionVersion: null,

  setSessionProvenance: (provenance) => set({ sessionProvenance: provenance }),
  setSessionVersion: (version) => set({ sessionVersion: version }),

  // ... rest of store
}));
```

**Step 4: Run test to verify it passes**

```bash
npm test tests/store/provenance.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add store/index.ts tests/store/provenance.test.ts
git commit -m "feat(store): add session provenance and version tracking"
```

---

### Task 2.2: Update Import Service to Handle Provenance

**Files:**
- Modify: `services/importService.ts`
- Create: `tests/services/importService.test.ts`

**Step 1: Write test for provenance import**

Create `tests/services/importService.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { ImportService } from '../../services/importService';
import type { SessionData } from '../../types/session';

describe('ImportService', () => {
  it('should extract provenance from session data', async () => {
    const mockSessionData: SessionData = {
      metadata: {
        format: 'lexiconforge-session',
        version: '2.0',
        exportedAt: '2025-01-19T10:00:00Z'
      },
      novel: {
        id: 'test-novel',
        title: 'Test Novel'
      },
      version: {
        versionId: 'test-v1',
        displayName: 'Test Version',
        style: 'faithful',
        features: ['footnotes']
      },
      provenance: {
        originalCreator: {
          name: 'Alice',
          versionId: 'alice-v1',
          createdAt: '2025-01-01T00:00:00Z'
        },
        contributors: [
          { name: 'Alice', role: 'original-translator', dateRange: '2025-01-01' }
        ]
      },
      chapters: [],
      settings: {}
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Map([['content-length', '1000']]),
      json: async () => mockSessionData
    });

    const result = await ImportService.importFromUrl('https://example.com/session.json');

    expect(result.provenance).toBeDefined();
    expect(result.provenance.originalCreator.name).toBe('Alice');
  });

  it('should handle sessions without provenance (legacy)', async () => {
    const legacySession = {
      metadata: {
        format: 'lexiconforge-session',
        version: '1.0'
      },
      chapters: []
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Map([['content-length', '1000']]),
      json: async () => legacySession
    });

    const result = await ImportService.importFromUrl('https://example.com/legacy.json');

    expect(result.provenance).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test tests/services/importService.test.ts
```

Expected: FAIL - provenance not extracted or stored

**Step 3: Update ImportService to extract provenance**

Modify `services/importService.ts`:

```typescript
import { useAppStore } from '../store';
import type { SessionData } from '../types/session';

export class ImportService {
  static async importFromUrl(url: string): Promise<any> {
    try {
      // ... existing fetch logic

      const sessionData = await response.json();

      // Validate format (existing)
      if (!sessionData.metadata?.format?.startsWith('lexiconforge')) {
        throw new Error('Invalid session format. Expected lexiconforge export.');
      }

      // NEW: Extract and store provenance if present
      if (sessionData.provenance) {
        useAppStore.getState().setSessionProvenance(sessionData.provenance);
      }

      // NEW: Extract and store version info if present
      if (sessionData.version) {
        useAppStore.getState().setSessionVersion(sessionData.version);
      }

      // Use existing import logic
      await indexedDBService.importFullSessionData(sessionData);

      console.log(`[Import] Successfully imported ${sessionData.chapters?.length || 0} chapters`);

      return sessionData;
    } catch (error: any) {
      console.error('[Import] Failed to import from URL:', error);
      throw new Error(`Failed to import: ${error.message}`);
    }
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test tests/services/importService.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add services/importService.ts tests/services/importService.test.ts
git commit -m "feat(import): extract and store session provenance on import"
```

---

## Phase 3: Settings UI Reorganization

### Task 3.1: Create Tabbed Settings Structure

**Files:**
- Modify: `components/SettingsModal.tsx`
- Create: `tests/components/SettingsModal.test.tsx`

**Step 1: Write test for tab navigation**

Create `tests/components/SettingsModal.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsModal } from '../../components/SettingsModal';

describe('SettingsModal Tabs', () => {
  it('should render all tabs', () => {
    render(<SettingsModal isOpen={true} onClose={() => {}} />);

    expect(screen.getByText('Translation')).toBeInTheDocument();
    expect(screen.getByText('EPUB')).toBeInTheDocument();
    expect(screen.getByText('Metadata')).toBeInTheDocument();
    expect(screen.getByText('Export')).toBeInTheDocument();
    expect(screen.getByText('Preferences')).toBeInTheDocument();
  });

  it('should switch to Metadata tab on click', () => {
    render(<SettingsModal isOpen={true} onClose={() => {}} />);

    const metadataTab = screen.getByText('Metadata');
    fireEvent.click(metadataTab);

    // Should show metadata form
    expect(screen.getByText('Novel Information')).toBeInTheDocument();
  });

  it('should show Export tab with action buttons', () => {
    render(<SettingsModal isOpen={true} onClose={() => {}} />);

    const exportTab = screen.getByText('Export');
    fireEvent.click(exportTab);

    expect(screen.getByText('Export Session JSON')).toBeInTheDocument();
    expect(screen.getByText('Publish to Library')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test tests/components/SettingsModal.test.tsx
```

Expected: FAIL - tabs don't exist

**Step 3: Add tab navigation to SettingsModal**

Modify `components/SettingsModal.tsx`:

```typescript
import React, { useState } from 'react';

type SettingsTab = 'translation' | 'epub' | 'metadata' | 'export' | 'preferences';

export function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('translation');

  if (!isOpen) return null;

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'translation', label: 'Translation' },
    { id: 'epub', label: 'EPUB' },
    { id: 'metadata', label: 'Metadata' },
    { id: 'export', label: 'Export' },
    { id: 'preferences', label: 'Preferences' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {activeTab === 'translation' && <TranslationSettings />}
          {activeTab === 'epub' && <EPUBSettings />}
          {activeTab === 'metadata' && <MetadataSettings />}
          {activeTab === 'export' && <ExportSettings />}
          {activeTab === 'preferences' && <PreferencesSettings />}
        </div>
      </div>
    </div>
  );
}

// Placeholder components (will be implemented in next tasks)
function TranslationSettings() {
  return <div>Translation Settings (existing content goes here)</div>;
}

function EPUBSettings() {
  return <div>EPUB Settings (existing content goes here)</div>;
}

function MetadataSettings() {
  return <div>Novel Information</div>;
}

function ExportSettings() {
  return (
    <div>
      <button>Export Session JSON</button>
      <button>Publish to Library</button>
    </div>
  );
}

function PreferencesSettings() {
  return <div>Preferences (existing content goes here)</div>;
}
```

**Step 4: Run test to verify it passes**

```bash
npm test tests/components/SettingsModal.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add components/SettingsModal.tsx tests/components/SettingsModal.test.tsx
git commit -m "feat(ui): add tabbed navigation to Settings modal"
```

---

## Phase 4: Novel Metadata Form

### Task 4.1: Create Metadata Form Component

**Files:**
- Create: `components/NovelMetadataForm.tsx`
- Create: `tests/components/NovelMetadataForm.test.tsx`

**Step 1: Write tests for metadata form**

Create `tests/components/NovelMetadataForm.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NovelMetadataForm } from '../../components/NovelMetadataForm';

describe('NovelMetadataForm', () => {
  it('should render all form fields', () => {
    render(<NovelMetadataForm onSave={vi.fn()} />);

    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Author')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Original Language')).toBeInTheDocument();
    expect(screen.getByLabelText('Genres')).toBeInTheDocument();
  });

  it('should call onSave with form data', () => {
    const onSave = vi.fn();
    render(<NovelMetadataForm onSave={onSave} />);

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Test Novel' } });
    fireEvent.change(screen.getByLabelText('Author'), { target: { value: 'Test Author' } });
    fireEvent.click(screen.getByText('Save Metadata'));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test Novel',
        author: 'Test Author'
      })
    );
  });

  it('should validate required fields', () => {
    const onSave = vi.fn();
    render(<NovelMetadataForm onSave={onSave} />);

    fireEvent.click(screen.getByText('Save Metadata'));

    expect(screen.getByText('Title is required')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test tests/components/NovelMetadataForm.test.tsx
```

Expected: FAIL - component doesn't exist

**Step 3: Create NovelMetadataForm component**

Create `components/NovelMetadataForm.tsx`:

```typescript
import React, { useState } from 'react';
import type { NovelMetadata } from '../types/novel';

interface NovelMetadataFormProps {
  initialData?: Partial<NovelMetadata>;
  onSave: (metadata: NovelMetadata) => void;
}

interface FormErrors {
  title?: string;
  author?: string;
  description?: string;
}

export function NovelMetadataForm({ initialData, onSave }: NovelMetadataFormProps) {
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    alternateTitles: initialData?.alternateTitles?.join(', ') || '',
    author: initialData?.author || '',
    description: initialData?.description || '',
    originalLanguage: initialData?.originalLanguage || '',
    genres: initialData?.genres?.join(', ') || '',
    tags: initialData?.tags?.join(', ') || '',
    publicationStatus: initialData?.publicationStatus || 'Ongoing',
    originalPublicationDate: initialData?.originalPublicationDate || '',
    coverImageUrl: initialData?.coverImageUrl || '',
    novelUpdatesUrl: initialData?.sourceLinks?.novelUpdates || '',
    rawSourceUrl: initialData?.sourceLinks?.rawSource || '',
    mangaUrl: initialData?.sourceLinks?.manga || '',
    animeUrl: initialData?.sourceLinks?.anime || ''
  });

  const [errors, setErrors] = useState<FormErrors>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const newErrors: FormErrors = {};
    if (!formData.title) newErrors.title = 'Title is required';
    if (!formData.author) newErrors.author = 'Author is required';
    if (!formData.description) newErrors.description = 'Description is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Build metadata object
    const metadata: NovelMetadata = {
      originalLanguage: formData.originalLanguage,
      genres: formData.genres.split(',').map(g => g.trim()).filter(Boolean),
      description: formData.description,
      author: formData.author,
      coverImageUrl: formData.coverImageUrl || undefined,
      publicationStatus: formData.publicationStatus as any,
      originalPublicationDate: formData.originalPublicationDate || undefined,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      sourceLinks: {
        novelUpdates: formData.novelUpdatesUrl || undefined,
        rawSource: formData.rawSourceUrl || undefined,
        manga: formData.mangaUrl || undefined,
        anime: formData.animeUrl || undefined
      },
      lastUpdated: new Date().toISOString().split('T')[0]
    };

    onSave(metadata);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Basic Information</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="title">
              Title *
            </label>
            <input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
            {errors.title && <p className="text-red-600 text-sm mt-1">{errors.title}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="alternateTitles">
              Alternate Titles (comma-separated)
            </label>
            <input
              id="alternateTitles"
              type="text"
              value={formData.alternateTitles}
              onChange={(e) => setFormData({ ...formData, alternateTitles: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="e.g., 던전 디펜스, DD"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="author">
              Author *
            </label>
            <input
              id="author"
              type="text"
              value={formData.author}
              onChange={(e) => setFormData({ ...formData, author: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
            {errors.author && <p className="text-red-600 text-sm mt-1">{errors.author}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="description">
              Description *
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              rows={4}
            />
            {errors.description && <p className="text-red-600 text-sm mt-1">{errors.description}</p>}
          </div>
        </div>
      </section>

      {/* Publication Info */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Publication Information</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="originalLanguage">
              Original Language
            </label>
            <input
              id="originalLanguage"
              type="text"
              value={formData.originalLanguage}
              onChange={(e) => setFormData({ ...formData, originalLanguage: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="e.g., Korean, Japanese"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="publicationStatus">
              Publication Status
            </label>
            <select
              id="publicationStatus"
              value={formData.publicationStatus}
              onChange={(e) => setFormData({ ...formData, publicationStatus: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="Ongoing">Ongoing</option>
              <option value="Completed">Completed</option>
              <option value="Hiatus">Hiatus</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="originalPublicationDate">
              Original Publication Date
            </label>
            <input
              id="originalPublicationDate"
              type="date"
              value={formData.originalPublicationDate}
              onChange={(e) => setFormData({ ...formData, originalPublicationDate: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>
      </section>

      {/* Categories */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Categories</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="genres">
              Genres (comma-separated)
            </label>
            <input
              id="genres"
              type="text"
              value={formData.genres}
              onChange={(e) => setFormData({ ...formData, genres: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="e.g., Dark Fantasy, Strategy, Psychological"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="tags">
              Tags (comma-separated)
            </label>
            <input
              id="tags"
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="e.g., Anti-Hero, Cunning Protagonist, Dark"
            />
          </div>
        </div>
      </section>

      {/* Links */}
      <section>
        <h3 className="text-lg font-semibold mb-4">External Links</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="coverImageUrl">
              Cover Image URL
            </label>
            <input
              id="coverImageUrl"
              type="url"
              value={formData.coverImageUrl}
              onChange={(e) => setFormData({ ...formData, coverImageUrl: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="https://i.imgur.com/..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="novelUpdatesUrl">
              Novel Updates URL
            </label>
            <input
              id="novelUpdatesUrl"
              type="url"
              value={formData.novelUpdatesUrl}
              onChange={(e) => setFormData({ ...formData, novelUpdatesUrl: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="rawSourceUrl">
              Raw Source URL
            </label>
            <input
              id="rawSourceUrl"
              type="url"
              value={formData.rawSourceUrl}
              onChange={(e) => setFormData({ ...formData, rawSourceUrl: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="mangaUrl">
              Manga Adaptation URL (optional)
            </label>
            <input
              id="mangaUrl"
              type="url"
              value={formData.mangaUrl}
              onChange={(e) => setFormData({ ...formData, mangaUrl: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="animeUrl">
              Anime Adaptation URL (optional)
            </label>
            <input
              id="animeUrl"
              type="url"
              value={formData.animeUrl}
              onChange={(e) => setFormData({ ...formData, animeUrl: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>
      </section>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Save Metadata
        </button>
      </div>
    </form>
  );
}
```

**Step 4: Run test to verify it passes**

```bash
npm test tests/components/NovelMetadataForm.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add components/NovelMetadataForm.tsx tests/components/NovelMetadataForm.test.tsx
git commit -m "feat(ui): create novel metadata form component"
```

---

## Phase 5: Export Flows

### Task 5.1: Create Export Service

**Files:**
- Create: `services/exportService.ts`
- Create: `tests/services/exportService.test.ts`

**Step 1: Write tests for export service**

Create `tests/services/exportService.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExportService } from '../../services/exportService';
import { useAppStore } from '../../store';
import type { SessionProvenance } from '../../types/session';

describe('ExportService', () => {
  beforeEach(() => {
    useAppStore.setState({
      chapters: new Map(),
      sessionProvenance: null,
      sessionVersion: null
    });
  });

  it('should generate quick export without provenance', () => {
    const chapters = new Map([
      ['ch1', { id: 'ch1', title: 'Chapter 1', content: 'Test' }]
    ]);
    useAppStore.setState({ chapters });

    const exportData = ExportService.generateQuickExport();

    expect(exportData.metadata.format).toBe('lexiconforge-session');
    expect(exportData.chapters).toHaveLength(1);
    expect(exportData.provenance).toBeUndefined();
  });

  it('should generate publish export with metadata and provenance', () => {
    const chapters = new Map([
      ['ch1', { id: 'ch1', title: 'Chapter 1', content: 'Test' }]
    ]);
    useAppStore.setState({ chapters });

    const novelMetadata = {
      id: 'test-novel',
      title: 'Test Novel',
      author: 'Test Author',
      originalLanguage: 'Korean'
    };

    const versionInfo = {
      versionId: 'v1',
      displayName: 'Version 1',
      translator: { name: 'Alice' },
      style: 'faithful' as const,
      features: ['footnotes']
    };

    const exportData = ExportService.generatePublishExport(novelMetadata, versionInfo);

    expect(exportData.novel.id).toBe('test-novel');
    expect(exportData.version.versionId).toBe('v1');
    expect(exportData.provenance.originalCreator.name).toBe('Alice');
  });

  it('should generate fork export with parent lineage', () => {
    const parentProvenance: SessionProvenance = {
      originalCreator: {
        name: 'Alice',
        versionId: 'alice-v1',
        createdAt: '2025-01-01T00:00:00Z'
      },
      contributors: [
        { name: 'Alice', role: 'original-translator', dateRange: '2025-01-01' }
      ]
    };

    useAppStore.setState({
      sessionProvenance: parentProvenance,
      sessionVersion: {
        versionId: 'alice-v1',
        displayName: 'Alice Version',
        style: 'faithful',
        features: []
      }
    });

    const forkInfo = {
      versionId: 'bob-v1',
      displayName: 'Bob Fork',
      translator: { name: 'Bob' },
      style: 'image-heavy' as const,
      features: ['ai-images'],
      changes: 'Added illustrations'
    };

    const exportData = ExportService.generateForkExport(forkInfo);

    expect(exportData.provenance.originalCreator.name).toBe('Alice');
    expect(exportData.provenance.forkedFrom?.versionId).toBe('alice-v1');
    expect(exportData.provenance.contributors).toHaveLength(2);
    expect(exportData.provenance.contributors[1].name).toBe('Bob');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test tests/services/exportService.test.ts
```

Expected: FAIL - ExportService doesn't exist

**Step 3: Create ExportService**

Create `services/exportService.ts`:

```typescript
import { useAppStore } from '../store';
import type { SessionData, SessionProvenance } from '../types/session';

export class ExportService {
  /**
   * Quick export - no metadata, just session data
   */
  static generateQuickExport(): SessionData {
    const state = useAppStore.getState();
    const chapters = Array.from(state.chapters.values());

    return {
      metadata: {
        format: 'lexiconforge-session',
        version: '2.0',
        exportedAt: new Date().toISOString()
      },
      novel: {
        id: 'unknown',
        title: 'Untitled Novel'
      },
      version: {
        versionId: 'quick-export',
        displayName: 'Quick Export',
        style: 'other',
        features: []
      },
      provenance: {
        originalCreator: {
          name: 'Unknown',
          versionId: 'quick-export',
          createdAt: new Date().toISOString()
        },
        contributors: []
      },
      chapters: chapters as any[],
      settings: {}
    };
  }

  /**
   * Publish export - new novel with full metadata
   */
  static generatePublishExport(
    novelMetadata: {
      id: string;
      title: string;
      author: string;
      originalLanguage: string;
    },
    versionInfo: {
      versionId: string;
      displayName: string;
      translator: { name: string; link?: string };
      style: 'faithful' | 'liberal' | 'image-heavy' | 'audio-enhanced' | 'other';
      features: string[];
    }
  ): SessionData {
    const state = useAppStore.getState();
    const chapters = Array.from(state.chapters.values());

    const now = new Date().toISOString();

    return {
      metadata: {
        format: 'lexiconforge-session',
        version: '2.0',
        exportedAt: now
      },
      novel: {
        id: novelMetadata.id,
        title: novelMetadata.title
      },
      version: versionInfo,
      provenance: {
        originalCreator: {
          name: versionInfo.translator.name,
          link: versionInfo.translator.link,
          versionId: versionInfo.versionId,
          createdAt: now
        },
        contributors: [
          {
            name: versionInfo.translator.name,
            role: 'original-translator',
            dateRange: now.split('T')[0]
          }
        ]
      },
      chapters: chapters as any[],
      settings: {}
    };
  }

  /**
   * Fork export - based on existing version with lineage
   */
  static generateForkExport(
    forkInfo: {
      versionId: string;
      displayName: string;
      translator: { name: string; link?: string };
      style: 'faithful' | 'liberal' | 'image-heavy' | 'audio-enhanced' | 'other';
      features: string[];
      changes?: string;
    }
  ): SessionData {
    const state = useAppStore.getState();
    const chapters = Array.from(state.chapters.values());
    const parentProvenance = state.sessionProvenance;
    const parentVersion = state.sessionVersion;

    if (!parentProvenance || !parentVersion) {
      throw new Error('Cannot fork: no parent session loaded');
    }

    const now = new Date().toISOString();

    // Build new provenance with lineage
    const newProvenance: SessionProvenance = {
      originalCreator: parentProvenance.originalCreator,
      forkedFrom: {
        versionId: parentVersion.versionId,
        sessionUrl: '', // Will be filled by user when uploading
        forkedAt: now
      },
      contributors: [
        ...parentProvenance.contributors,
        {
          name: forkInfo.translator.name,
          link: forkInfo.translator.link,
          role: 'enhancer',
          changes: forkInfo.changes || 'Forked and enhanced',
          dateRange: now.split('T')[0]
        }
      ]
    };

    return {
      metadata: {
        format: 'lexiconforge-session',
        version: '2.0',
        exportedAt: now
      },
      novel: {
        id: 'unknown', // Will inherit from parent metadata
        title: 'Unknown'
      },
      version: forkInfo,
      provenance: newProvenance,
      chapters: chapters as any[],
      settings: {}
    };
  }

  /**
   * Download JSON file
   */
  static downloadJSON(data: any, filename: string) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test tests/services/exportService.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add services/exportService.ts tests/services/exportService.test.ts
git commit -m "feat(export): add export service with quick/publish/fork flows"
```

---

## Phase 6: Registry & Metadata Service

### Task 6.1: Create Registry Service

**Files:**
- Create: `services/registryService.ts`
- Create: `tests/services/registryService.test.ts`

**Step 1: Write tests for registry service**

Create `tests/services/registryService.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { RegistryService } from '../../services/registryService';
import type { Registry, NovelEntry } from '../../types/novel';

describe('RegistryService', () => {
  it('should fetch registry from URL', async () => {
    const mockRegistry: Registry = {
      version: '2.0',
      lastUpdated: '2025-01-19',
      novels: [
        { id: 'novel-1', metadataUrl: 'https://example.com/novel-1.json' },
        { id: 'novel-2', metadataUrl: 'https://example.com/novel-2.json' }
      ]
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockRegistry
    });

    const registry = await RegistryService.fetchRegistry();

    expect(registry.novels).toHaveLength(2);
  });

  it('should fetch metadata for a novel', async () => {
    const mockMetadata: NovelEntry = {
      id: 'test-novel',
      title: 'Test Novel',
      metadata: {
        originalLanguage: 'Korean',
        genres: ['Fantasy'],
        description: 'Test description',
        lastUpdated: '2025-01-19'
      },
      versions: [
        {
          versionId: 'v1',
          displayName: 'Version 1',
          translator: { name: 'Alice' },
          sessionJsonUrl: 'https://example.com/session.json',
          targetLanguage: 'English',
          style: 'faithful',
          features: [],
          chapterRange: { from: 1, to: 50 },
          completionStatus: 'Complete',
          lastUpdated: '2025-01-19',
          stats: { downloads: 100, fileSize: '5 MB' }
        }
      ]
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockMetadata
    });

    const metadata = await RegistryService.fetchNovelMetadata('https://example.com/novel.json');

    expect(metadata.id).toBe('test-novel');
    expect(metadata.versions).toHaveLength(1);
  });

  it('should handle fetch errors gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Not Found'
    });

    await expect(RegistryService.fetchRegistry()).rejects.toThrow('Failed to fetch registry');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test tests/services/registryService.test.ts
```

Expected: FAIL - RegistryService doesn't exist

**Step 3: Create RegistryService**

Create `services/registryService.ts`:

```typescript
import type { Registry, NovelEntry } from '../types/novel';

const DEFAULT_REGISTRY_URL = 'https://raw.githubusercontent.com/lexiconforge/lexiconforge-novels/main/registry.json';

export class RegistryService {
  /**
   * Fetch the main registry file
   */
  static async fetchRegistry(url: string = DEFAULT_REGISTRY_URL): Promise<Registry> {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const registry: Registry = await response.json();

      console.log(`[Registry] Fetched ${registry.novels.length} novels`);

      return registry;
    } catch (error: any) {
      console.error('[Registry] Failed to fetch registry:', error);
      throw new Error(`Failed to fetch registry: ${error.message}`);
    }
  }

  /**
   * Fetch metadata for a specific novel
   */
  static async fetchNovelMetadata(metadataUrl: string): Promise<NovelEntry> {
    try {
      const response = await fetch(metadataUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const metadata: NovelEntry = await response.json();

      console.log(`[Registry] Fetched metadata for ${metadata.title}`);

      return metadata;
    } catch (error: any) {
      console.error('[Registry] Failed to fetch metadata:', error);
      throw new Error(`Failed to fetch metadata: ${error.message}`);
    }
  }

  /**
   * Fetch all novel metadata from registry
   */
  static async fetchAllNovelMetadata(registryUrl?: string): Promise<NovelEntry[]> {
    const registry = await this.fetchRegistry(registryUrl);

    const metadataPromises = registry.novels.map(entry =>
      this.fetchNovelMetadata(entry.metadataUrl)
    );

    const results = await Promise.allSettled(metadataPromises);

    // Filter successful fetches
    const novels = results
      .filter((result): result is PromisedFulfilledResult<NovelEntry> =>
        result.status === 'fulfilled'
      )
      .map(result => result.value);

    // Log failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.warn(`[Registry] Failed to fetch ${registry.novels[index].id}:`, result.reason);
      }
    });

    return novels;
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test tests/services/registryService.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add services/registryService.ts tests/services/registryService.test.ts
git commit -m "feat(registry): add registry service for fetching novel metadata"
```

---

## Phase 7: Version Picker UI

### Task 7.1: Update NovelDetailSheet with Version Picker

**Files:**
- Modify: `components/NovelDetailSheet.tsx`
- Create: `tests/components/VersionPicker.test.tsx`

**Step 1: Write tests for version picker**

Create `tests/components/VersionPicker.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VersionPicker } from '../../components/VersionPicker';
import type { NovelVersion } from '../../types/novel';

describe('VersionPicker', () => {
  const mockVersions: NovelVersion[] = [
    {
      versionId: 'alice-v1',
      displayName: 'Alice Community Translation',
      translator: { name: 'Alice', link: 'https://github.com/alice' },
      sessionJsonUrl: 'https://example.com/alice.json',
      targetLanguage: 'English',
      style: 'faithful',
      features: ['footnotes'],
      chapterRange: { from: 1, to: 50 },
      completionStatus: 'Complete',
      lastUpdated: '2025-01-15',
      stats: { downloads: 1234, fileSize: '5 MB' }
    },
    {
      versionId: 'bob-v1',
      displayName: 'Bob Illustrated Edition',
      translator: { name: 'Bob', link: 'https://github.com/bob' },
      sessionJsonUrl: 'https://example.com/bob.json',
      targetLanguage: 'English',
      style: 'image-heavy',
      features: ['ai-images'],
      basedOn: 'alice-v1',
      chapterRange: { from: 1, to: 10 },
      completionStatus: 'In Progress',
      lastUpdated: '2025-01-19',
      stats: { downloads: 234, fileSize: '12 MB' }
    }
  ];

  it('should render all versions', () => {
    render(<VersionPicker versions={mockVersions} onSelect={vi.fn()} />);

    expect(screen.getByText('Alice Community Translation')).toBeInTheDocument();
    expect(screen.getByText('Bob Illustrated Edition')).toBeInTheDocument();
  });

  it('should show fork lineage', () => {
    render(<VersionPicker versions={mockVersions} onSelect={vi.fn()} />);

    expect(screen.getByText(/Based on: alice-v1/i)).toBeInTheDocument();
  });

  it('should call onSelect when Start Reading clicked', () => {
    const onSelect = vi.fn();
    render(<VersionPicker versions={mockVersions} onSelect={onSelect} />);

    const buttons = screen.getAllByText('Start Reading');
    fireEvent.click(buttons[0]);

    expect(onSelect).toHaveBeenCalledWith(mockVersions[0]);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test tests/components/VersionPicker.test.tsx
```

Expected: FAIL - component doesn't exist

**Step 3: Create VersionPicker component**

Create `components/VersionPicker.tsx`:

```typescript
import React from 'react';
import { BookOpen, User, Download } from 'lucide-react';
import type { NovelVersion } from '../types/novel';

interface VersionPickerProps {
  versions: NovelVersion[];
  onSelect: (version: NovelVersion) => void;
}

export function VersionPicker({ versions, onSelect }: VersionPickerProps) {
  if (!versions || versions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No versions available yet. Be the first to contribute!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Available Versions</h3>

      {versions.map(version => (
        <div
          key={version.versionId}
          className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-500 transition-colors"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div>
              <h4 className="font-semibold text-lg">{version.displayName}</h4>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-1">
                <User className="h-4 w-4" />
                {version.translator.link ? (
                  <a
                    href={version.translator.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-600 hover:underline"
                  >
                    {version.translator.name}
                  </a>
                ) : (
                  <span>{version.translator.name}</span>
                )}
              </div>
            </div>

            <span
              className={`px-2 py-1 text-xs rounded ${
                version.completionStatus === 'Complete'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
              }`}
            >
              {version.completionStatus}
            </span>
          </div>

          {/* Translation Type Badge */}
          <div className="mb-3">
            <span className={`px-2 py-1 text-xs rounded ${
              version.stats.translation.translationType === 'human'
                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                : version.stats.translation.translationType === 'ai'
                ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200'
                : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
            }`}>
              {version.stats.translation.translationType === 'human' && '👤 Human Translation'}
              {version.stats.translation.translationType === 'ai' && '🤖 AI Translation'}
              {version.stats.translation.translationType === 'hybrid' && `🤝 Hybrid (${version.stats.translation.aiPercentage}% AI)`}
            </span>
          </div>

          {/* Quality Rating & Feedback */}
          {version.stats.translation.qualityRating && (
            <div className="flex items-center gap-2 mb-3 text-sm">
              <div className="flex items-center">
                {'⭐'.repeat(Math.floor(version.stats.translation.qualityRating))}
                <span className="ml-1 text-gray-600 dark:text-gray-400">
                  {version.stats.translation.qualityRating.toFixed(1)}
                </span>
              </div>
              <span className="text-gray-400">•</span>
              <span className="text-gray-600 dark:text-gray-400">
                {version.stats.translation.feedbackCount} reviews
              </span>
            </div>
          )}

          {/* Basic Stats */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
            <div className="flex items-center gap-1">
              <BookOpen className="h-4 w-4" />
              <span>Chapters {version.chapterRange.from}-{version.chapterRange.to}</span>
            </div>

            <div className="flex items-center gap-1">
              <Download className="h-4 w-4" />
              <span>{version.stats.downloads} downloads</span>
            </div>

            <div>
              <span className="font-medium">{version.style}</span>
            </div>

            <div>
              <span>{version.stats.fileSize}</span>
            </div>
          </div>

          {/* Content Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                {version.stats.content.totalImages}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Images</div>
              <div className="text-xs text-gray-500">
                ({version.stats.content.avgImagesPerChapter.toFixed(1)}/ch)
              </div>
            </div>

            <div className="text-center">
              <div className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                {version.stats.content.totalFootnotes}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Footnotes</div>
              <div className="text-xs text-gray-500">
                ({version.stats.content.avgFootnotesPerChapter.toFixed(1)}/ch)
              </div>
            </div>

            <div className="text-center">
              <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                {version.stats.content.totalTranslatedChapters}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Translated</div>
              <div className="text-xs text-gray-500">
                of {version.stats.content.totalRawChapters}
              </div>
            </div>

            <div className="text-center">
              <div className="text-lg font-semibold text-orange-600 dark:text-orange-400">
                {Math.round((version.stats.content.totalTranslatedChapters / version.stats.content.totalRawChapters) * 100)}%
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Complete</div>
            </div>
          </div>

          {/* Features */}
          {version.features.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {version.features.map(feature => (
                <span
                  key={feature}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded"
                >
                  {feature}
                </span>
              ))}
            </div>
          )}

          {/* Fork lineage */}
          {version.basedOn && (
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Based on: <span className="font-mono">{version.basedOn}</span>
            </div>
          )}

          {/* Action */}
          <button
            onClick={() => onSelect(version)}
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Start Reading
          </button>
        </div>
      ))}
    </div>
  );
}
```

**Step 4: Update NovelDetailSheet to use VersionPicker**

Modify `components/NovelDetailSheet.tsx` to include VersionPicker:

```typescript
import { VersionPicker } from './VersionPicker';

// In the component, replace the single "Start Reading" button with:
{novel.versions && novel.versions.length > 0 ? (
  <VersionPicker
    versions={novel.versions}
    onSelect={(version) => onStartReading(novel, version)}
  />
) : (
  <button onClick={() => onStartReading(novel)}>
    Start Reading
  </button>
)}
```

**Step 5: Run test to verify it passes**

```bash
npm test tests/components/VersionPicker.test.tsx
```

Expected: PASS

**Step 6: Commit**

```bash
git add components/VersionPicker.tsx components/NovelDetailSheet.tsx tests/components/VersionPicker.test.tsx
git commit -m "feat(ui): add version picker to novel detail sheet"
```

---

### Task 7.2: Add Coverage Distribution Visualization

**Files:**
- Create: `components/CoverageDistribution.tsx`
- Create: `tests/components/CoverageDistribution.test.tsx`

**Step 1: Write tests for coverage visualization**

Create `tests/components/CoverageDistribution.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CoverageDistribution } from '../../components/CoverageDistribution';
import type { ChapterCoverageStats } from '../../types/novel';

describe('CoverageDistribution', () => {
  it('should show aggregate stats', () => {
    const stats: ChapterCoverageStats = {
      chaptersWithMultipleVersions: 25,
      avgVersionsPerChapter: 2.5,
      medianVersionsPerChapter: 2,
      maxVersionsForAnyChapter: 5,
      coverageDistribution: {
        1: 3, 2: 2, 3: 2, 5: 3, 10: 5  // chapter -> version count
      }
    };

    render(<CoverageDistribution stats={stats} totalChapters={50} />);

    expect(screen.getByText(/25 chapters/i)).toBeInTheDocument();
    expect(screen.getByText(/2.5.*avg/i)).toBeInTheDocument();
  });
});
```

**Step 2: Create CoverageDistribution component**

Create `components/CoverageDistribution.tsx`:

```typescript
import React from 'react';
import type { ChapterCoverageStats } from '../types/novel';

interface CoverageDistributionProps {
  stats: ChapterCoverageStats;
  totalChapters: number;
}

export function CoverageDistribution({ stats, totalChapters }: CoverageDistributionProps) {
  // Calculate distribution histogram
  const versionCounts = Object.values(stats.coverageDistribution);
  const maxCount = Math.max(...versionCounts, 1);

  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-4">
      <h4 className="font-semibold text-gray-900 dark:text-white">
        Version Coverage Across Chapters
      </h4>

      {/* Aggregate Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="text-center">
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {stats.chaptersWithMultipleVersions}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Chapters with multiple versions
          </div>
        </div>

        <div className="text-center">
          <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
            {stats.avgVersionsPerChapter.toFixed(1)}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Avg versions per chapter
          </div>
        </div>

        <div className="text-center">
          <div className="text-xl font-bold text-green-600 dark:text-green-400">
            {stats.medianVersionsPerChapter}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Median versions
          </div>
        </div>

        <div className="text-center">
          <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
            {stats.maxVersionsForAnyChapter}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Max versions (any chapter)
          </div>
        </div>
      </div>

      {/* Simple Bar Chart Visualization */}
      <div className="space-y-2">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Chapters by Version Count
        </div>

        {/* Group chapters by version count */}
        {Array.from({ length: stats.maxVersionsForAnyChapter }, (_, i) => i + 1).map(versionCount => {
          const chaptersWithThisCount = Object.entries(stats.coverageDistribution)
            .filter(([_, count]) => count === versionCount)
            .length;

          if (chaptersWithThisCount === 0) return null;

          const percentage = (chaptersWithThisCount / totalChapters) * 100;

          return (
            <div key={versionCount} className="flex items-center gap-2">
              <div className="w-16 text-xs text-gray-600 dark:text-gray-400">
                {versionCount} {versionCount === 1 ? 'version' : 'versions'}
              </div>

              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6 relative">
                <div
                  className="bg-blue-600 dark:bg-blue-500 h-6 rounded-full transition-all flex items-center justify-end pr-2"
                  style={{ width: `${percentage}%` }}
                >
                  <span className="text-xs text-white font-medium">
                    {chaptersWithThisCount} ch
                  </span>
                </div>
              </div>

              <div className="w-12 text-xs text-gray-600 dark:text-gray-400 text-right">
                {percentage.toFixed(0)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 3: Run tests**

```bash
npm test tests/components/CoverageDistribution.test.tsx
```

**Step 4: Integrate into NovelDetailSheet**

Modify `components/NovelDetailSheet.tsx` to show coverage when novel has multiple versions:

```typescript
{novel.versions && novel.versions.length > 1 && coverageStats && (
  <CoverageDistribution
    stats={coverageStats}
    totalChapters={/* calculate from versions */}
  />
)}
```

**Step 5: Commit**

```bash
git add components/CoverageDistribution.tsx tests/components/CoverageDistribution.test.tsx components/NovelDetailSheet.tsx
git commit -m "feat(ui): add chapter coverage distribution visualization"
```

---

## Phase 8: Integration & Registry Loading

### Task 8.1: Update NovelLibrary to Use Registry

**Files:**
- Modify: `components/NovelLibrary.tsx`
- Modify: `config/novelCatalog.ts` (mark as deprecated)
- Create: `tests/integration/registry.test.ts`

**Step 1: Write integration test**

Create `tests/integration/registry.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { NovelLibrary } from '../../components/NovelLibrary';
import { RegistryService } from '../../services/registryService';

describe('NovelLibrary Registry Integration', () => {
  it('should load novels from registry on mount', async () => {
    const mockNovels = [
      {
        id: 'test-novel',
        title: 'Test Novel',
        metadata: {
          originalLanguage: 'Korean',
          genres: ['Fantasy'],
          description: 'Test',
          lastUpdated: '2025-01-19'
        },
        versions: []
      }
    ];

    vi.spyOn(RegistryService, 'fetchAllNovelMetadata').mockResolvedValue(mockNovels);

    render(<NovelLibrary />);

    await waitFor(() => {
      expect(screen.getByText('Test Novel')).toBeInTheDocument();
    });
  });

  it('should show loading state while fetching', () => {
    vi.spyOn(RegistryService, 'fetchAllNovelMetadata').mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve([]), 1000))
    );

    render(<NovelLibrary />);

    expect(screen.getByText(/Loading novels/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test tests/integration/registry.test.ts
```

Expected: FAIL - library doesn't use registry yet

**Step 3: Update NovelLibrary to fetch from registry**

Modify `components/NovelLibrary.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { BookOpen } from 'lucide-react';
import { NovelGrid } from './NovelGrid';
import { NovelDetailSheet } from './NovelDetailSheet';
import { RegistryService } from '../services/registryService';
import { ImportService } from '../services/importService';
import { useAppStore } from '../store';
import type { NovelEntry, NovelVersion } from '../types/novel';

interface NovelLibraryProps {
  onSessionLoaded?: () => void;
}

export function NovelLibrary({ onSessionLoaded }: NovelLibraryProps) {
  const [novels, setNovels] = useState<NovelEntry[]>([]);
  const [isLoadingNovels, setIsLoadingNovels] = useState(true);
  const [selectedNovel, setSelectedNovel] = useState<NovelEntry | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const setNotification = useAppStore(s => s.setNotification);

  // Fetch novels from registry on mount
  useEffect(() => {
    const loadNovels = async () => {
      try {
        setIsLoadingNovels(true);
        const fetchedNovels = await RegistryService.fetchAllNovelMetadata();
        setNovels(fetchedNovels);
      } catch (error: any) {
        console.error('[NovelLibrary] Failed to load novels:', error);
        setNotification({
          type: 'error',
          message: `Failed to load novel library: ${error.message}`
        });
      } finally {
        setIsLoadingNovels(false);
      }
    };

    loadNovels();
  }, []);

  const handleViewDetails = (novel: NovelEntry) => {
    setSelectedNovel(novel);
  };

  const handleCloseDetails = () => {
    setSelectedNovel(null);
  };

  const handleStartReading = async (novel: NovelEntry, version?: NovelVersion) => {
    // Determine which session URL to use
    const sessionUrl = version?.sessionJsonUrl || novel.sessionJsonUrl;

    if (!sessionUrl) {
      setNotification({
        type: 'error',
        message: `${novel.title} is not yet available. Check back soon!`
      });
      return;
    }

    setIsLoadingSession(true);
    const versionName = version?.displayName || 'this version';

    setNotification({
      type: 'info',
      message: `Loading ${versionName}...`
    });

    try {
      await ImportService.importFromUrl(sessionUrl);

      setNotification({
        type: 'success',
        message: `✅ Loaded ${versionName} successfully!`
      });

      setSelectedNovel(null);
      onSessionLoaded?.();
    } catch (error: any) {
      console.error('[NovelLibrary] Failed to load version:', error);
      setNotification({
        type: 'error',
        message: `Failed to load ${versionName}: ${error.message}`
      });
    } finally {
      setIsLoadingSession(false);
    }
  };

  if (isLoadingNovels) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4 mx-auto"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading novels from registry...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center mb-4">
          <BookOpen className="h-12 w-12 text-blue-600 dark:text-blue-400 mr-3" />
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
            Novel Library
          </h2>
        </div>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Browse our curated collection of web novels. Each novel comes with community contributions,
          multiple translation styles, and enhanced versions to choose from.
        </p>
      </div>

      {/* Novel Grid */}
      <NovelGrid novels={novels} onViewDetails={handleViewDetails} />

      {/* Loading Overlay */}
      {isLoadingSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md mx-4">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-900 dark:text-gray-100 font-semibold">
                Loading novel session...
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                This may take a few moments
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Novel Detail Sheet */}
      <NovelDetailSheet
        novel={selectedNovel}
        isOpen={!!selectedNovel}
        onClose={handleCloseDetails}
        onStartReading={handleStartReading}
      />
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

```bash
npm test tests/integration/registry.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add components/NovelLibrary.tsx tests/integration/registry.test.ts
git commit -m "feat(library): integrate registry service for dynamic novel loading"
```

---

## Testing & Deployment

### Task 9.1: End-to-End Testing

**Files:**
- Create: `tests/e2e/community-library.test.ts`

**Step 1: Write E2E test**

Create `tests/e2e/community-library.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../../App';

describe('Community Library E2E', () => {
  beforeAll(() => {
    // Mock registry and metadata
    global.fetch = vi.fn((url) => {
      if (url.includes('registry.json')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            version: '2.0',
            novels: [
              { id: 'test-novel', metadataUrl: 'https://example.com/test.json' }
            ]
          })
        });
      }

      if (url.includes('test.json')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 'test-novel',
            title: 'Test Novel',
            metadata: {
              originalLanguage: 'Korean',
              genres: ['Fantasy'],
              description: 'A test novel',
              lastUpdated: '2025-01-19'
            },
            versions: [
              {
                versionId: 'v1',
                displayName: 'Version 1',
                translator: { name: 'Alice' },
                sessionJsonUrl: 'https://example.com/session.json',
                targetLanguage: 'English',
                style: 'faithful',
                features: [],
                chapterRange: { from: 1, to: 10 },
                completionStatus: 'Complete',
                lastUpdated: '2025-01-19',
                stats: { downloads: 100, fileSize: '1 MB' }
              }
            ]
          })
        });
      }

      return Promise.reject(new Error('Not found'));
    });
  });

  it('should complete full user journey', async () => {
    render(<App />);

    // 1. See landing page with library
    await waitFor(() => {
      expect(screen.getByText('Novel Library')).toBeInTheDocument();
    });

    // 2. Browse and see novels
    await waitFor(() => {
      expect(screen.getByText('Test Novel')).toBeInTheDocument();
    });

    // 3. Click novel to see details
    fireEvent.click(screen.getByText('Test Novel'));

    await waitFor(() => {
      expect(screen.getByText('Version 1')).toBeInTheDocument();
    });

    // 4. See version picker
    expect(screen.getByText('Start Reading')).toBeInTheDocument();

    // Full flow validated!
  });
});
```

**Step 2: Run E2E test**

```bash
npm test tests/e2e/community-library.test.ts
```

**Step 3: Commit**

```bash
git add tests/e2e/community-library.test.ts
git commit -m "test: add end-to-end test for community library flow"
```

---

## Documentation

### Task 10.1: Update Documentation

**Files:**
- Create: `docs/COMMUNITY_LIBRARY.md`
- Update: `README.md`

**Step 1: Create comprehensive guide**

Create `docs/COMMUNITY_LIBRARY.md`:

```markdown
# Community Novel Library

Complete guide for contributing to and using the LexiconForge Community Library.

## For Contributors

### Creating Your First Novel

1. Fetch and translate chapters in LexiconForge
2. Open Settings → Metadata tab
3. Fill in novel information (title, author, description, etc.)
4. Go to Settings → Export tab
5. Click "Publish to Library"
6. Fill in your version details
7. Download the metadata and session JSON files
8. Upload to your GitHub repository
9. Submit PR to add your metadata URL to the registry

### Forking an Existing Version

1. Load a novel version from the library
2. Make your enhancements (add images, continue translation, etc.)
3. Open Settings → Export tab
4. Click "Export & Share Fork"
5. Describe your changes
6. Download session JSON
7. Upload to your GitHub repository
8. Submit PR to update parent novel's metadata

## For Users

### Browsing the Library

- Visit LexiconForge
- Browse the novel grid
- Click novels to see all available versions
- Compare versions by style, features, and completion status

### Loading a Novel

- Click "Start Reading" on your preferred version
- Session loads automatically
- Begin translating or reading immediately

## Technical Details

See implementation plan for architecture and type definitions.
```

**Step 2: Update README with new features**

Update `README.md` to mention community library features.

**Step 3: Commit**

```bash
git add docs/COMMUNITY_LIBRARY.md README.md
git commit -m "docs: add community library usage guide"
```

---

## Summary

**Total Tasks:** 10 phases, ~20 tasks
**Estimated Time:** 15-20 hours for full implementation
**Testing Coverage:** Unit tests, integration tests, E2E tests

**Key Features Delivered:**
✅ Version support with fork lineage
✅ Provenance tracking for credit assignment
✅ Registry-based dynamic novel loading
✅ Metadata form for community contributions
✅ Export flows (Quick, Publish, Fork)
✅ Version picker UI
✅ Complete test coverage

**Next Steps After Implementation:**
1. Create sample registry and metadata files
2. Set up GitHub repository for novels
3. Deploy updated app
4. Write contributor guidelines
5. Launch with initial curated novels

---

Plan complete and saved to `docs/plans/2025-01-19-community-novel-library.md`.

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach would you like?**
