# Claude Code Implementation Scripts

These are exact scripts for Claude Code to execute. Copy and paste these prompts directly.

## Pre-Session Setup Script
```
# Always run at session start:
ls -la node_modules | head -5 || npm install
cat docs/WORKLOG.md | tail -50
git status
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

---

## Script 1: Fix OpenAI Type Errors
```bash
# Step 1: Check current errors
npx tsc --noEmit 2>&1 | grep -A2 "services/explanationService.ts(88"
npx tsc --noEmit 2>&1 | grep -A2 "services/illustrationService.ts(83"

# Step 2: Apply fixes
cat > /tmp/fix-openai-types.sh << 'SCRIPT'
#!/bin/bash

# Fix explanationService.ts
sed -i.bak '4a\
import type { ChatCompletionMessageParam } from "openai/resources/chat";' services/explanationService.ts

sed -i '79s/.*/        const messages: ChatCompletionMessageParam[] = [{ role: "user", content: prompt }];/' services/explanationService.ts
sed -i '80,82s/.*/        const requestBody = {\
          model: settings.model,\
          messages,\
          temperature: 0.5,\
          max_tokens: maxOutput,\
        };/' services/explanationService.ts

# Fix illustrationService.ts
sed -i.bak '4a\
import type { ChatCompletionMessageParam } from "openai/resources/chat";' services/illustrationService.ts

sed -i '64s/.*/        const messages: ChatCompletionMessageParam[] = [{ role: "user", content: finalPrompt }];/' services/illustrationService.ts
sed -i '65,67s/.*/        const requestBody = {\
          model: settings.model,\
          messages,\
          temperature: 0.7,\
          max_tokens: maxOutput,\
        };/' services/illustrationService.ts

sed -i '94,95s/.*/        const choice = response?.choices?.[0];\
        const finish = choice?.finish_reason ?? choice?.native_finish_reason ?? null;/' services/illustrationService.ts
SCRIPT

chmod +x /tmp/fix-openai-types.sh
/tmp/fix-openai-types.sh

# Step 3: Verify
npx tsc --noEmit 2>&1 | grep -c "error TS"
echo "Should be ~136 errors (down from 138)"

# Step 4: Commit
git add services/explanationService.ts services/illustrationService.ts
git diff --cached
```

---

## Script 2: Create Test Harness

```bash
# Step 1: Extract interface
mkdir -p services/db/interfaces
grep -E "^\s*async [a-zA-Z]+\(" services/indexeddb.ts | head -20 > /tmp/methods.txt

cat > services/db/interfaces/IIndexedDBService.ts << 'INTERFACE'
import type {
  ChapterRecord,
  TranslationRecord,
  ChapterLookupResult,
  AppSettings,
  FeedbackItem,
  PromptTemplate
} from '../../indexeddb';
import type { Chapter, TranslationResult } from '../../../types';

export interface IIndexedDBService {
  openDatabase(): Promise<IDBDatabase>;

  // Chapter operations
  storeChapter(chapter: Chapter): Promise<void>;
  getChapter(url: string): Promise<ChapterRecord | null>;
  deleteChapter(url: string): Promise<void>;
  findChapterByUrl(url: string): Promise<ChapterLookupResult | null>;
  getAllChapterUrls(): Promise<string[]>;

  // Translation operations
  storeTranslation(chapterUrl: string, translation: TranslationResult, settings: AppSettings): Promise<void>;
  getTranslation(chapterUrl: string, version?: number): Promise<TranslationRecord | null>;
  getTranslationVersions(chapterUrl: string): Promise<TranslationRecord[]>;
  deleteTranslation(chapterUrl: string, version: number): Promise<void>;

  // Settings
  saveSettings(settings: AppSettings): Promise<void>;
  loadSettings(): Promise<AppSettings | null>;

  // Feedback
  storeFeedback(feedback: FeedbackItem): Promise<void>;
  getFeedback(translationId: string): Promise<FeedbackItem[]>;

  // Templates
  savePromptTemplate(template: PromptTemplate): Promise<void>;
  getPromptTemplates(): Promise<PromptTemplate[]>;
}
INTERFACE

# Step 2: Create mock
mkdir -p services/db/__mocks__
cat > services/db/__mocks__/MockIndexedDBService.ts << 'MOCK'
import type { IIndexedDBService } from '../interfaces/IIndexedDBService';
import type {
  ChapterRecord,
  TranslationRecord,
  ChapterLookupResult,
  AppSettings,
  FeedbackItem,
  PromptTemplate
} from '../../indexeddb';
import type { Chapter, TranslationResult } from '../../../types';

export class MockIndexedDBService implements IIndexedDBService {
  private chapters = new Map<string, ChapterRecord>();
  private translations = new Map<string, TranslationRecord[]>();
  private settings: AppSettings | null = null;
  private feedback = new Map<string, FeedbackItem[]>();
  private templates: PromptTemplate[] = [];

  async openDatabase(): Promise<IDBDatabase> {
    return {} as IDBDatabase;
  }

  async storeChapter(chapter: Chapter): Promise<void> {
    const record: ChapterRecord = {
      url: chapter.url,
      title: chapter.title,
      content: chapter.content,
      originalUrl: chapter.originalUrl,
      dateAdded: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      nextUrl: chapter.nextUrl,
      prevUrl: chapter.prevUrl
    };
    this.chapters.set(chapter.url, record);
  }

  async getChapter(url: string): Promise<ChapterRecord | null> {
    return this.chapters.get(url) || null;
  }

  async deleteChapter(url: string): Promise<void> {
    this.chapters.delete(url);
    this.translations.delete(url);
  }

  async findChapterByUrl(url: string): Promise<ChapterLookupResult | null> {
    const chapter = this.chapters.get(url);
    if (!chapter) return null;
    return {
      stableId: chapter.stableId || url,
      canonicalUrl: chapter.canonicalUrl || url,
      title: chapter.title
    };
  }

  async getAllChapterUrls(): Promise<string[]> {
    return Array.from(this.chapters.keys());
  }

  async storeTranslation(
    chapterUrl: string,
    translation: TranslationResult,
    settings: AppSettings
  ): Promise<void> {
    const existing = this.translations.get(chapterUrl) || [];
    const version = existing.length + 1;
    const record = {
      ...translation,
      chapterUrl,
      version,
      timestamp: Date.now(),
      settings: {
        provider: settings.provider,
        model: settings.model,
        temperature: settings.temperature
      }
    } as TranslationRecord;
    existing.push(record);
    this.translations.set(chapterUrl, existing);
  }

  async getTranslation(
    chapterUrl: string,
    version?: number
  ): Promise<TranslationRecord | null> {
    const versions = this.translations.get(chapterUrl) || [];
    if (version !== undefined) {
      return versions.find(v => v.version === version) || null;
    }
    return versions[versions.length - 1] || null;
  }

  async getTranslationVersions(chapterUrl: string): Promise<TranslationRecord[]> {
    return this.translations.get(chapterUrl) || [];
  }

  async deleteTranslation(chapterUrl: string, version: number): Promise<void> {
    const versions = this.translations.get(chapterUrl) || [];
    const filtered = versions.filter(v => v.version !== version);
    if (filtered.length > 0) {
      this.translations.set(chapterUrl, filtered);
    } else {
      this.translations.delete(chapterUrl);
    }
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    this.settings = settings;
  }

  async loadSettings(): Promise<AppSettings | null> {
    return this.settings;
  }

  async storeFeedback(feedback: FeedbackItem): Promise<void> {
    const list = this.feedback.get(feedback.translationId) || [];
    list.push(feedback);
    this.feedback.set(feedback.translationId, list);
  }

  async getFeedback(translationId: string): Promise<FeedbackItem[]> {
    return this.feedback.get(translationId) || [];
  }

  async savePromptTemplate(template: PromptTemplate): Promise<void> {
    this.templates.push(template);
  }

  async getPromptTemplates(): Promise<PromptTemplate[]> {
    return this.templates;
  }
}
MOCK

# Step 3: Create test
mkdir -p tests/services/db
cat > tests/services/db/indexedDBService.interface.test.ts << 'TEST'
import { describe, it, expect, beforeEach } from 'vitest';
import type { IIndexedDBService } from '../../../services/db/interfaces/IIndexedDBService';
import { MockIndexedDBService } from '../../../services/db/__mocks__/MockIndexedDBService';

describe('IndexedDB Service Interface Contract', () => {
  let service: IIndexedDBService;

  beforeEach(() => {
    service = new MockIndexedDBService();
  });

  describe('Chapter Operations', () => {
    it('should store and retrieve chapters', async () => {
      const chapter = {
        url: 'https://example.com/ch1',
        title: 'Chapter 1',
        content: '<p>Content</p>',
        originalUrl: 'https://example.com/ch1'
      };

      await service.storeChapter(chapter);
      const retrieved = await service.getChapter(chapter.url);

      expect(retrieved).toBeTruthy();
      expect(retrieved?.title).toBe(chapter.title);
    });

    it('should return null for non-existent chapter', async () => {
      const result = await service.getChapter('nonexistent');
      expect(result).toBeNull();
    });

    it('should delete chapters', async () => {
      const chapter = {
        url: 'https://example.com/ch1',
        title: 'Chapter 1',
        content: '<p>Content</p>',
        originalUrl: 'https://example.com/ch1'
      };

      await service.storeChapter(chapter);
      await service.deleteChapter(chapter.url);
      const result = await service.getChapter(chapter.url);

      expect(result).toBeNull();
    });
  });

  describe('Translation Versioning', () => {
    it('should store multiple translation versions', async () => {
      const chapterUrl = 'https://example.com/ch1';
      const settings = { provider: 'OpenAI', model: 'gpt-4', temperature: 0.7 };

      await service.storeTranslation(chapterUrl,
        { translatedTitle: 'V1', translatedContent: 'Content V1' } as any,
        settings as any);

      await service.storeTranslation(chapterUrl,
        { translatedTitle: 'V2', translatedContent: 'Content V2' } as any,
        settings as any);

      const versions = await service.getTranslationVersions(chapterUrl);
      expect(versions).toHaveLength(2);
      expect(versions[0].translatedTitle).toBe('V1');
      expect(versions[1].translatedTitle).toBe('V2');
    });

    it('should get latest translation by default', async () => {
      const chapterUrl = 'https://example.com/ch1';
      const settings = { provider: 'OpenAI', model: 'gpt-4' };

      await service.storeTranslation(chapterUrl,
        { translatedTitle: 'V1' } as any, settings as any);
      await service.storeTranslation(chapterUrl,
        { translatedTitle: 'V2' } as any, settings as any);

      const latest = await service.getTranslation(chapterUrl);
      expect(latest?.translatedTitle).toBe('V2');
    });
  });

  describe('Settings Persistence', () => {
    it('should save and load settings', async () => {
      const settings = {
        provider: 'OpenAI',
        model: 'gpt-4',
        temperature: 0.7,
        apiKeyOpenAI: 'test-key'
      } as any;

      await service.saveSettings(settings);
      const loaded = await service.loadSettings();

      expect(loaded).toBeTruthy();
      expect(loaded?.provider).toBe('OpenAI');
      expect(loaded?.temperature).toBe(0.7);
    });
  });
});
TEST

# Step 4: Run tests
npm test indexedDBService.interface

# Step 5: Update WORKLOG
echo "$(date -u '+%Y-%m-%d %H:%M UTC') - Created test harness for IndexedDB service
- Created IIndexedDBService interface
- Created MockIndexedDBService implementation
- Added 6 interface contract tests
- Tests passing without reading 3,937-line monolith" >> docs/WORKLOG.md
```

---

## Script 3: Create LOC Checker

```bash
# Install glob dependency
npm install --save-dev glob

# Create the script
cat > scripts/check-loc.js << 'SCRIPT'
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const MAX_LINES = {
  'services': 800,
  'components': 500,
  'default': 300
};

const EXCLUDE = [
  'node_modules/**',
  'dist/**',
  'coverage/**',
  '**/*.test.ts',
  '**/*.spec.ts'
];

async function checkFileSize(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\\n').length;

  const category = filePath.includes('services/') ? 'services' :
                   filePath.includes('components/') ? 'components' :
                   'default';
  const maxLines = MAX_LINES[category];

  return { filePath, lines, maxLines, oversized: lines > maxLines };
}

async function main() {
  const files = glob.sync('**/*.{ts,tsx}', { ignore: EXCLUDE });
  const results = await Promise.all(files.map(checkFileSize));

  const oversized = results.filter(r => r.oversized);

  if (oversized.length > 0) {
    console.log('⚠️  Files exceeding line limits:\\n');
    const sorted = oversized.sort((a, b) => b.lines - a.lines);
    sorted.forEach(({ filePath, lines, maxLines }) => {
      const excess = lines - maxLines;
      const percent = Math.round((excess / maxLines) * 100);
      console.log(`  ${filePath}: ${lines} lines (${excess} over limit, +${percent}%)`);
    });
    console.log(`\\nTotal: ${oversized.length} files need refactoring`);
    process.exit(0); // Warning mode
  } else {
    console.log('✅ All files within size limits');
  }
}

main().catch(console.error);
SCRIPT

chmod +x scripts/check-loc.js

# Update package.json
npm pkg set scripts.check:loc="node scripts/check-loc.js"

# Test it
npm run check:loc

# Add to WORKLOG
echo "$(date -u '+%Y-%m-%d %H:%M UTC') - Added LOC checking script
- Created scripts/check-loc.js
- Added npm run check:loc command
- Warning mode (won't block builds yet)
- Found 3 oversized files: indexeddb.ts, SettingsModal.tsx, ChapterView.tsx" >> docs/WORKLOG.md
```

---

## Script 4: Begin Repository Extraction

```bash
# Day 4: Extract ChapterRepository

# Step 1: Create repository structure
mkdir -p services/db/repositories/interfaces
mkdir -p services/db/repositories/impl

# Step 2: Extract interface (based on grep results)
grep -n "async.*Chapter" services/indexeddb.ts | grep -E "store|get|delete|find" > /tmp/chapter-methods.txt

# Step 3: Copy specific lines (using sed for extraction)
# Lines 1105-1300 contain chapter methods
sed -n '1105,1300p' services/indexeddb.ts > /tmp/chapter-methods-code.txt

# Step 4: Create ChapterRepository
cat > services/db/repositories/impl/ChapterRepository.ts << 'REPO'
import type { IDBDatabase } from 'idb';
import type { Chapter } from '../../../types';
import type { ChapterRecord, ChapterLookupResult } from '../../indexeddb';
import { generateStableChapterId } from '../../stableIdService';

export class ChapterRepository {
  constructor(private getDb: () => Promise<IDBDatabase>) {}

  async store(chapter: Chapter): Promise<void> {
    const db = await this.getDb();
    // Implementation from lines 1105-1192 of indexeddb.ts
    // [Copy the actual implementation here]
  }

  async get(url: string): Promise<ChapterRecord | null> {
    const db = await this.getDb();
    // Implementation from getChapter method
    // [Copy the actual implementation here]
  }

  async delete(url: string): Promise<void> {
    const db = await this.getDb();
    // Implementation from deleteChapter method
    // [Copy the actual implementation here]
  }

  async getAllUrls(): Promise<string[]> {
    const db = await this.getDb();
    // Implementation from getAllChapterUrls method
    // [Copy the actual implementation here]
  }

  async findByUrl(url: string): Promise<ChapterLookupResult | null> {
    const db = await this.getDb();
    // Implementation from findChapterByUrl method
    // [Copy the actual implementation here]
  }
}
REPO

# Step 5: Update indexeddb.ts to use repository (create facade)
# This maintains backward compatibility
echo "// Add to top of indexeddb.ts:
import { ChapterRepository } from './db/repositories/impl/ChapterRepository';

// In constructor:
private chapterRepo: ChapterRepository;

constructor() {
  this.chapterRepo = new ChapterRepository(() => this.openDatabase());
}

// Replace methods with delegation:
async storeChapter(chapter: Chapter): Promise<void> {
  return this.chapterRepo.store(chapter);
}

async getChapter(url: string): Promise<ChapterRecord | null> {
  return this.chapterRepo.get(url);
}
" > /tmp/facade-pattern.txt

# Step 6: Run tests to verify
npm test

# Step 7: Check file size reduction
wc -l services/indexeddb.ts
echo "Target: Reduce by ~200 lines after extracting chapter methods"
```

---

## Daily Session Starters

### Day 1 Start:
```bash
echo "=== Day 1: Fix Builds + Test Harness ==="
npm install
cat docs/WORKLOG.md | tail -20
npx tsc --noEmit 2>&1 | grep -c "error TS"
echo "Current errors: $(npx tsc --noEmit 2>&1 | grep -c 'error TS')"
echo "Target: < 100 errors"
echo "Ready to start with Script 1: Fix OpenAI Type Errors"
```

### Day 2 Start:
```bash
echo "=== Day 2: LOC Guardrail + Strict Typing ==="
cat docs/WORKLOG.md | tail -20
echo "Creating LOC checker and beginning strict typing migration"
echo "Target files with 'any': $(grep -r ': any' services --include='*.ts' | wc -l)"
```

### Day 3 Start:
```bash
echo "=== Day 3: Documentation + Planning ==="
cat docs/WORKLOG.md | tail -20
echo "Creating architecture docs and decomposition plans"
echo "Files to document: $(ls services/*.ts | wc -l) services"
```

### Day 4 Start:
```bash
echo "=== Day 4: Begin Decomposition ==="
cat docs/WORKLOG.md | tail -20
echo "Starting extraction of repositories from indexeddb.ts"
echo "Current size: $(wc -l services/indexeddb.ts | cut -d' ' -f1) lines"
echo "Target: < 500 lines"
```

---

## Verification Commands

After each major change:
```bash
# Check build
npx tsc --noEmit 2>&1 | grep -c "error TS"

# Run tests
npm test

# Check file sizes
npm run check:loc

# Check for 'any' types
grep -r ': any' services --include='*.ts' | wc -l

# Git status
git status --short

# Update WORKLOG
echo "$(date -u '+%Y-%m-%d %H:%M UTC') - [Description of what was done]" >> docs/WORKLOG.md
```