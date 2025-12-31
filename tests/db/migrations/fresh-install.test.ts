/**
 * Fresh Install Migration Test
 *
 * Tests that a fresh database installation (v0 → v12) creates all required stores
 * and indexes correctly using ONLY the migration system.
 *
 * This validates that migrations are complete and createSchema() is not needed.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SCHEMA_VERSIONS, STORE_NAMES, applyMigrations } from '../../../services/db/core/schema';

const TEST_DB_NAME = 'test-fresh-install';
const DB_VERSION = SCHEMA_VERSIONS.CURRENT;

describe('Fresh Install: v0 → v12 Migration', () => {
  let db: IDBDatabase;

  beforeEach(async () => {
    // Simulate a completely fresh install (oldVersion = 0)
    db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(TEST_DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = request.transaction!;
        const oldVersion = event.oldVersion;

        console.log(`[Test] Upgrading database from v${oldVersion} to v${DB_VERSION}`);

        // Apply all migrations (this is what the real code does)
        applyMigrations(db, transaction, oldVersion, DB_VERSION);
      };
    });
  });

  afterEach(async () => {
    db.close();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(TEST_DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });

  describe('Store Creation', () => {
    it('should create all 10 required stores', () => {
      const expectedStores = Object.values(STORE_NAMES);
      const actualStores = Array.from(db.objectStoreNames);

      console.log('[Test] Expected stores:', expectedStores);
      console.log('[Test] Actual stores:', actualStores);

      expect(actualStores).toHaveLength(expectedStores.length);

      for (const storeName of expectedStores) {
        expect(db.objectStoreNames.contains(storeName)).toBe(true);
      }
    });

    it('should create chapters store with correct keyPath', () => {
      const tx = db.transaction([STORE_NAMES.CHAPTERS], 'readonly');
      const store = tx.objectStore(STORE_NAMES.CHAPTERS);

      expect(store.keyPath).toBe('url');
    });

    it('should create translations store with correct keyPath', () => {
      const tx = db.transaction([STORE_NAMES.TRANSLATIONS], 'readonly');
      const store = tx.objectStore(STORE_NAMES.TRANSLATIONS);

      expect(store.keyPath).toBe('id');
    });

    it('should create settings store with correct keyPath', () => {
      const tx = db.transaction([STORE_NAMES.SETTINGS], 'readonly');
      const store = tx.objectStore(STORE_NAMES.SETTINGS);

      expect(store.keyPath).toBe('key');
    });

    it('should create feedback store with correct keyPath', () => {
      const tx = db.transaction([STORE_NAMES.FEEDBACK], 'readonly');
      const store = tx.objectStore(STORE_NAMES.FEEDBACK);

      expect(store.keyPath).toBe('id');
    });

    it('should create prompt_templates store with correct keyPath', () => {
      const tx = db.transaction([STORE_NAMES.PROMPT_TEMPLATES], 'readonly');
      const store = tx.objectStore(STORE_NAMES.PROMPT_TEMPLATES);

      expect(store.keyPath).toBe('id');
    });

    it('should create url_mappings store with correct keyPath', () => {
      const tx = db.transaction([STORE_NAMES.URL_MAPPINGS], 'readonly');
      const store = tx.objectStore(STORE_NAMES.URL_MAPPINGS);

      expect(store.keyPath).toBe('url');
    });

    it('should create novels store with correct keyPath', () => {
      const tx = db.transaction([STORE_NAMES.NOVELS], 'readonly');
      const store = tx.objectStore(STORE_NAMES.NOVELS);

      expect(store.keyPath).toBe('id');
    });

    it('should create chapter_summaries store with correct keyPath', () => {
      const tx = db.transaction([STORE_NAMES.CHAPTER_SUMMARIES], 'readonly');
      const store = tx.objectStore(STORE_NAMES.CHAPTER_SUMMARIES);

      expect(store.keyPath).toBe('stableId');
    });

    it('should create amendment_logs store with correct keyPath', () => {
      const tx = db.transaction([STORE_NAMES.AMENDMENT_LOGS], 'readonly');
      const store = tx.objectStore(STORE_NAMES.AMENDMENT_LOGS);

      expect(store.keyPath).toBe('id');
    });

    it('should create diffResults store with correct composite keyPath', () => {
      const tx = db.transaction([STORE_NAMES.DIFF_RESULTS], 'readonly');
      const store = tx.objectStore(STORE_NAMES.DIFF_RESULTS);

      expect(store.keyPath).toEqual(['chapterId', 'aiVersionId', 'fanVersionId', 'rawVersionId', 'algoVersion']);
    });
  });

  describe('Critical Index Creation', () => {
    it('should create stableId index on chapters store', () => {
      const tx = db.transaction([STORE_NAMES.CHAPTERS], 'readonly');
      const store = tx.objectStore(STORE_NAMES.CHAPTERS);

      expect(store.indexNames.contains('stableId')).toBe(true);
    });

    it('should create chapterNumber index on chapters store', () => {
      const tx = db.transaction([STORE_NAMES.CHAPTERS], 'readonly');
      const store = tx.objectStore(STORE_NAMES.CHAPTERS);

      expect(store.indexNames.contains('chapterNumber')).toBe(true);
    });

    it('should create chapterUrl index on translations store', () => {
      const tx = db.transaction([STORE_NAMES.TRANSLATIONS], 'readonly');
      const store = tx.objectStore(STORE_NAMES.TRANSLATIONS);

      expect(store.indexNames.contains('chapterUrl')).toBe(true);
    });

    it('should create stableId index on translations store', () => {
      const tx = db.transaction([STORE_NAMES.TRANSLATIONS], 'readonly');
      const store = tx.objectStore(STORE_NAMES.TRANSLATIONS);

      expect(store.indexNames.contains('stableId')).toBe(true);
    });

    it('should create compound chapterUrl_version index on translations store', () => {
      const tx = db.transaction([STORE_NAMES.TRANSLATIONS], 'readonly');
      const store = tx.objectStore(STORE_NAMES.TRANSLATIONS);

      expect(store.indexNames.contains('chapterUrl_version')).toBe(true);

      const index = store.index('chapterUrl_version');
      expect(index.keyPath).toEqual(['chapterUrl', 'version']);
      expect(index.unique).toBe(true);
    });

    it('should create compound stableId_version index on translations store', () => {
      const tx = db.transaction([STORE_NAMES.TRANSLATIONS], 'readonly');
      const store = tx.objectStore(STORE_NAMES.TRANSLATIONS);

      expect(store.indexNames.contains('stableId_version')).toBe(true);

      const index = store.index('stableId_version');
      expect(index.keyPath).toEqual(['stableId', 'version']);
      expect(index.unique).toBe(true);
    });

    it('should create stableId index on url_mappings store', () => {
      const tx = db.transaction([STORE_NAMES.URL_MAPPINGS], 'readonly');
      const store = tx.objectStore(STORE_NAMES.URL_MAPPINGS);

      expect(store.indexNames.contains('stableId')).toBe(true);
    });

    it('should create action index on amendment_logs store', () => {
      const tx = db.transaction([STORE_NAMES.AMENDMENT_LOGS], 'readonly');
      const store = tx.objectStore(STORE_NAMES.AMENDMENT_LOGS);

      expect(store.indexNames.contains('action')).toBe(true);
    });

    it('should create chapterId index on amendment_logs store', () => {
      const tx = db.transaction([STORE_NAMES.AMENDMENT_LOGS], 'readonly');
      const store = tx.objectStore(STORE_NAMES.AMENDMENT_LOGS);

      expect(store.indexNames.contains('chapterId')).toBe(true);
    });

    it('should create by_chapter index on diffResults store', () => {
      const tx = db.transaction([STORE_NAMES.DIFF_RESULTS], 'readonly');
      const store = tx.objectStore(STORE_NAMES.DIFF_RESULTS);

      expect(store.indexNames.contains('by_chapter')).toBe(true);
    });
  });

  describe('Data Operations', () => {
    it('should allow storing and retrieving a chapter', async () => {
      const chapter = {
        url: 'https://example.com/chapter1',
        title: 'Test Chapter',
        content: 'Test content',
        originalUrl: 'https://example.com/chapter1',
        dateAdded: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        stableId: 'test-stable-id-123'
      };

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_NAMES.CHAPTERS], 'readwrite');
        const store = tx.objectStore(STORE_NAMES.CHAPTERS);
        const request = store.put(chapter);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      const retrieved = await new Promise<any>((resolve, reject) => {
        const tx = db.transaction([STORE_NAMES.CHAPTERS], 'readonly');
        const store = tx.objectStore(STORE_NAMES.CHAPTERS);
        const request = store.get(chapter.url);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      expect(retrieved).toMatchObject(chapter);
    });

    it('should allow querying chapters by stableId', async () => {
      const chapter = {
        url: 'https://example.com/chapter2',
        title: 'Test Chapter 2',
        content: 'Test content 2',
        originalUrl: 'https://example.com/chapter2',
        dateAdded: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        stableId: 'stable-id-for-query'
      };

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_NAMES.CHAPTERS], 'readwrite');
        const store = tx.objectStore(STORE_NAMES.CHAPTERS);
        const request = store.put(chapter);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      const results = await new Promise<any[]>((resolve, reject) => {
        const tx = db.transaction([STORE_NAMES.CHAPTERS], 'readonly');
        const store = tx.objectStore(STORE_NAMES.CHAPTERS);
        const index = store.index('stableId');
        const request = index.getAll('stable-id-for-query');

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject(chapter);
    });

    it('should allow storing translations with compound unique constraint', async () => {
      const translation = {
        id: 'trans-123',
        chapterUrl: 'https://example.com/chapter1',
        stableId: 'stable-id-123',
        version: 1,
        translation: 'Translated text',
        translatedTitle: 'Translated Title',
        isActive: true,
        createdAt: new Date().toISOString(),
        provider: 'OpenAI',
        model: 'gpt-4o-mini',
        temperature: 0.2,
        systemPrompt: 'Test prompt',
        footnotes: [],
        suggestedIllustrations: [],
        totalTokens: 100,
        promptTokens: 50,
        completionTokens: 50,
        estimatedCost: 0.001,
        requestTime: 1000
      };

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_NAMES.TRANSLATIONS], 'readwrite');
        const store = tx.objectStore(STORE_NAMES.TRANSLATIONS);
        const request = store.put(translation);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      const retrieved = await new Promise<any>((resolve, reject) => {
        const tx = db.transaction([STORE_NAMES.TRANSLATIONS], 'readonly');
        const store = tx.objectStore(STORE_NAMES.TRANSLATIONS);
        const request = store.get(translation.id);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      expect(retrieved).toMatchObject(translation);
    });
  });

  describe('Migration Completeness', () => {
    it('should have created exactly 10 stores (no more, no less)', () => {
      expect(db.objectStoreNames.length).toBe(10);
    });

    it('should have the correct database version', () => {
      expect(db.version).toBe(DB_VERSION);
      expect(db.version).toBe(13); // SCHEMA_REPAIR version
    });

    it('should not throw errors when accessing all stores', () => {
      const allStores = Object.values(STORE_NAMES);

      expect(() => {
        const tx = db.transaction(allStores, 'readonly');
        allStores.forEach(storeName => {
          tx.objectStore(storeName);
        });
      }).not.toThrow();
    });
  });
});
