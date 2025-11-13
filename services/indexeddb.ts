/**
 * IndexedDB Service for Versioned Translation Storage
 * 
 * This service manages persistent storage of translation versions using IndexedDB.
 * It replaces localStorage for translation data to support multiple versions per chapter.
 * 
 * SCHEMA DESIGN:
 * - chapters: Store original chapter content and metadata
 * - translations: Store translation versions with full metadata
 * - settings: Store user settings and preferences
 * - feedback: Store user feedback per translation version
 * 
 * KEY FEATURES:
 * - Multiple translation versions per chapter
 * - Full metadata tracking (model, cost, timestamp)
 * - Efficient querying and version management
 * - Migration from localStorage data
 */

import {
  Chapter,
  TranslationResult,
  AppSettings,
  FeedbackItem,
  PromptTemplate,
  GeneratedImageResult,
  ImageCacheKey,
} from '../types';
import type { TranslationSettingsSnapshot } from './db/repositories/interfaces/ITranslationRepository';
import { debugPipelineEnabled, dbDebugEnabled, debugLog } from '../utils/debug';
import { generateStableChapterId } from './stableIdService';
import { memorySummary, memoryDetail, memoryTimestamp, memoryTiming } from '../utils/memoryDiagnostics';
import { telemetryService } from './telemetryService';
import { applyMigrations, SCHEMA_VERSIONS, STORE_NAMES } from './db/core/schema';
import type { ChapterRepository } from './db/repositories/ChapterRepository';
import type { TranslationRepository } from './db/repositories/TranslationRepository';
import type { SettingsRepository } from './db/repositories/SettingsRepository';
import type { FeedbackRepository } from './db/repositories/FeedbackRepository';
import type { PromptTemplatesRepository } from './db/repositories/PromptTemplatesRepository';
import {
  chapterRepository as sharedChapterRepository,
  translationRepository as sharedTranslationRepository,
  settingsRepository as sharedSettingsRepository,
  feedbackRepository as sharedFeedbackRepository,
  promptTemplatesRepository as sharedPromptTemplatesRepository,
} from './db/repositories/instances';
import { exportFullSessionToJson as exportSessionOperation } from './db/operations/export';
import type { ExportOpsDeps } from './db/operations/export';
import {
  getChaptersForReactRendering as renderingOperation,
  type RenderingOpsDeps,
  type ChapterRenderingRecord,
} from './db/operations/rendering';
import {
  recomputeSummary as recomputeSummaryOp,
  deleteSummary as deleteSummaryOp,
  buildSummaryRecord,
  seedChapterSummariesIfEmpty,
  type SummaryOpsDeps,
} from './db/operations/summaries';
import { AmendmentOps } from './db/operations/amendments';
import { ImageOps } from './db/operations/imageVersions';

const dblog = (...args: any[]) => {
  if (debugPipelineEnabled('indexeddb', 'summary')) console.log('[IndexedDB]', ...args);
};
const dblogFull = (...args: any[]) => {
  if (debugPipelineEnabled('indexeddb', 'full')) console.log('[IndexedDB][FULL]', ...args);
};

// Database configuration
const DB_NAME = 'lexicon-forge';
const DB_VERSION = SCHEMA_VERSIONS.CURRENT;

const STORES = STORE_NAMES;
const URL_MAPPINGS_BACKFILL_VERSION = 2;

// IndexedDB Schema Types
export interface ChapterRecord {
  url: string;                    // Primary key (legacy)
  stableId?: string;              // NEW: Content-based stable ID
  title: string;
  content: string;
  originalUrl: string;
  nextUrl?: string;
  prevUrl?: string;
  fanTranslation?: string;        // NEW: Fan translation reference text
  dateAdded: string;              // ISO timestamp
  lastAccessed: string;           // ISO timestamp
  
  // NEW: Stable ID enhancement fields
  chapterNumber?: number;         // For stable ID generation
  canonicalUrl?: string;          // Normalized URL
}

export interface ChapterSummaryRecord {
  stableId: string;               // Primary key
  canonicalUrl?: string;          // Preferred navigation URL
  title: string;                  // Original title (source language)
  translatedTitle?: string;       // Active translation title if available
  chapterNumber?: number;         // Numeric ordering if present
  hasTranslation: boolean;        // Active translation exists
  hasImages: boolean;             // Active translation includes generated images
  lastAccessed?: string;          // ISO timestamp
  lastTranslatedAt?: string;      // ISO timestamp of active translation creation
}

export interface ExportSessionOptions {
  includeChapters?: boolean;
  includeTelemetry?: boolean;
  includeImages?: boolean;
}

export interface ExportedImageAsset {
  chapterId: string | null;
  chapterUrl?: string | null;
  translationVersion: number;
  marker: string;
  dataUrl: string;
  mimeType: string;
  sizeBytes: number;
  source: 'cache' | 'legacy';
  cacheKey?: { chapterId: string; placementMarker: string; version: number };
}

export interface TranslationRecord {
  id: string;                     // Generated UUID
  chapterUrl: string;             // Foreign key to chapters (legacy)
  stableId?: string;              // NEW: Stable chapter reference
  version: number;                // Version number (1, 2, 3...)
  translatedTitle: string;
  translation: string;
  footnotes: Array<{ marker: string; text: string }>;
  suggestedIllustrations: Array<{
    placementMarker: string;
    imagePrompt: string;
    url?: string;
    generatedImage?: string | GeneratedImageResult;
    imageCacheKey?: ImageCacheKey;
  }>;
  
  // Translation metadata
  provider: string;               // 'Gemini', 'OpenAI', 'DeepSeek'
  model: string;                  // 'gemini-2.5-flash', 'gpt-5', etc.
  temperature: number;
  systemPrompt: string;           // Snapshot of prompt used
  promptId?: string;              // Reference to prompt template used
  promptName?: string;            // Snapshot of prompt name at time of translation
  customVersionLabel?: string;    // Optional user-supplied label appended to display
  
  // Usage metrics
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
  requestTime: number;            // Seconds
  
  // Timestamps
  createdAt: string;              // ISO timestamp
  isActive: boolean;              // Currently selected version
  settingsSnapshot?: TranslationSettingsSnapshot;
  
  // Amendment proposal (if any)
  proposal?: {
    observation: string;
    currentRule: string;
    proposedChange: string;
    reasoning: string;
  };
}

export interface ChapterLookupResult {
  stableId: string;
  canonicalUrl: string;
  title: string;
  content: string;
  nextUrl?: string;
  prevUrl?: string;
  chapterNumber?: number;
  fanTranslation?: string;
  data: {
    chapter: {
      title: string;
      content: string;
      originalUrl: string;
      nextUrl?: string;
      prevUrl?: string;
      chapterNumber?: number;
    };
    translationResult: TranslationRecord | null;
  };
}

export interface SettingsRecord {
  key: string;                    // Primary key
  value: any;                     // JSON serializable value
  updatedAt: string;              // ISO timestamp
}

export interface FeedbackRecord {
  id: string;                     // Generated UUID
  chapterUrl: string;             // Foreign key to chapters
  translationId?: string;         // Optional: specific to translation version
  type: 'positive' | 'negative' | 'suggestion';
  selection: string;              // Text user selected
  comment: string;                // User's comment
  createdAt: string;              // ISO timestamp
}

export interface PromptTemplateRecord {
  id: string;                     // Generated UUID
  name: string;                   // Display name like "Wuxia Romance"
  description?: string;           // Optional description
  content: string;                // The actual system prompt
  isDefault: boolean;             // One template marked as default
  createdAt: string;              // ISO timestamp
  lastUsed?: string;              // ISO timestamp when last selected
}

// NEW: Stable ID system interfaces
export interface UrlMappingRecord {
  url: string;                    // Primary key: any URL variant
  stableId: string;              // Foreign key to chapters
  isCanonical: boolean;          // True for the canonical URL
  dateAdded: string;             // ISO timestamp
}

export interface NovelRecord {
  id: string;                    // Primary key
  title?: string;                // Novel title (if known)
  source: string;                // Domain (e.g., 'kakuyomu.jp')
  chapterCount: number;          // Number of chapters
  dateAdded: string;             // ISO timestamp
  lastAccessed: string;          // ISO timestamp
}

export interface AmendmentLogRecord {
  id: string;                    // UUID primary key
  timestamp: number;             // Unix timestamp (ms)
  chapterId?: string;            // Optional chapter stable ID
  proposal: {
    observation: string;
    currentRule: string;
    proposedChange: string;
    reasoning: string;
  };
  action: 'accepted' | 'rejected' | 'modified';
  finalPromptChange?: string;    // For 'modified': the actual change applied
  notes?: string;                // Optional user notes
}

// Singleton pattern for database connection management
let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

// Database service class
class IndexedDBService {
  private summariesInitialized = false;
  private summariesInitPromise: Promise<void> | null = null;
  private chapterRepository: ChapterRepository = sharedChapterRepository;
  private translationRepository: TranslationRepository = sharedTranslationRepository;
  private settingsRepository: SettingsRepository = sharedSettingsRepository;
  private feedbackRepository: FeedbackRepository = sharedFeedbackRepository;
  private promptTemplatesRepository: PromptTemplatesRepository = sharedPromptTemplatesRepository;

  constructor() {}

  /**
   * Singleton database opener with proper event handling
   * Prevents thundering herd opens and handles blocked upgrades correctly
   */
  async openDatabase(): Promise<IDBDatabase> {
    console.log('[DEBUG:openDatabase] Called');
    // Return existing instance if available
    if (dbInstance) {
      console.log('[DEBUG:openDatabase] Returning existing instance');
      return dbInstance;
    }

    // Return existing promise if open is in progress
    if (dbPromise) {
      console.log('[DEBUG:openDatabase] Returning existing promise');
      return dbPromise;
    }

    console.log('[DEBUG:openDatabase] Creating new promise');
    // Create new open promise with proper event handling
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const startTime = performance.now();
      console.log('[DEBUG:openDatabase] Opening database...', { DB_NAME, DB_VERSION });
      // dblog('[IndexedDB] Opening database...', { DB_NAME, DB_VERSION });
      
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      // Warning timer (don't reject - let browser complete)
      const warnTimer = setTimeout(() => {
        const elapsed = Math.round(performance.now() - startTime);
        // if (dbDebugEnabled()) console.warn(`[IndexedDB] Open taking ${elapsed}ms. Possibly BLOCKED by another tab or slow I/O. Still waiting...`);
      }, 5000);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = (event as IDBVersionChangeEvent).oldVersion || 0;
        const targetVersion = (event.target as IDBOpenDBRequest).result.version;
        console.log(`[DEBUG:onupgradeneeded] Upgrade needed: v${oldVersion} → v${db.version}`);
        // dblog(`[IndexedDB] Upgrade needed: v${oldVersion} → v${db.version}`);
        try {
          const transaction = request.transaction;
          if (!transaction) {
            throw new Error('[IndexedDB] Upgrade transaction missing; cannot apply migrations');
          }
          console.log('[DEBUG:onupgradeneeded] Applying migrations...');
          applyMigrations(db, transaction, oldVersion, targetVersion ?? DB_VERSION);
          console.log('[DEBUG:onupgradeneeded] Migrations completed');
          // dblog('[IndexedDB] Schema creation/migrations completed');
        } catch (error) {
          console.error('[IndexedDB] Schema migration failed:', error);
          clearTimeout(warnTimer);
          reject(error);
        }
      };

      request.onblocked = () => {
        // if (dbDebugEnabled()) console.warn('[IndexedDB] Upgrade BLOCKED by another open connection. Close other tabs or reload to proceed.');
        // Don't reject - let browser handle when other connection closes
      };

      request.onerror = () => {
        clearTimeout(warnTimer);
        dbPromise = null;
        console.error('[IndexedDB] Open failed:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        clearTimeout(warnTimer);
        const db = request.result;
        const elapsed = Math.round(performance.now() - startTime);
        console.log(`[DEBUG:onsuccess] Opened successfully v${db.version} in ${elapsed}ms`);
        // dblog(`[IndexedDB] Opened successfully v${db.version} in ${elapsed}ms`);

        if (db.version > DB_VERSION) {
          const message = `[IndexedDB] Database version ${db.version} is newer than runtime schema ${DB_VERSION}. Refresh the app (or clear IndexedDB) to align with the latest build.`;
          console.error(message);
          db.close();
          dbInstance = null;
          dbPromise = null;
          reject(new Error(message));
          return;
        }

        // Handle version changes from other tabs
        db.onversionchange = () => {
          // if (dbDebugEnabled()) console.warn('[IndexedDB] Version change detected - closing old connection');
          db.close();
          dbInstance = null;
          dbPromise = null;
        };

        console.log('[DEBUG:onsuccess] Calling verifySchemaOrAutoMigrate...');
        // Verify schema and auto-migrate if needed
        this.verifySchemaOrAutoMigrate(db).then(() => {
          console.log('[DEBUG:onsuccess] verifySchemaOrAutoMigrate completed, resolving with db');
          dbInstance = db;
          resolve(db);
        }).catch((error) => {
          console.error('[IndexedDB] Schema verification failed:', error);
          db.close();
          dbPromise = null;
          reject(error);
        });
      };
    });

    return dbPromise;
  }

  /**
   * Verify schema completeness and auto-migrate missing stores
   * Handles schema drift where DB version is correct but stores are missing
   */
  private async verifySchemaOrAutoMigrate(db: IDBDatabase): Promise<void> {
    console.log('[DEBUG:verifySchema] Starting verification...');
    const requiredStores = Object.values(STORES);

    const existingStores = Array.from(db.objectStoreNames);
    console.log('[DEBUG:verifySchema] Existing stores:', existingStores);
    const missingStores = requiredStores.filter(store => !existingStores.includes(store));

    if (missingStores.length > 0) {
      const message = `[IndexedDB] Schema drift detected - missing stores: ${missingStores.join(', ')}`;
      console.error(message);
      throw new Error(message);
    }

    console.log('[DEBUG:verifySchema] All stores present, ensuring indexes...');
    // Ensure critical indexes exist (translations compound unique indexes)
    await this.ensureTranslationIndexes(db);
    console.log('[DEBUG:verifySchema] Translation indexes ensured');
    await this.ensureChapterIndexes(db);
    console.log('[DEBUG:verifySchema] Chapter indexes ensured');
    await this.ensureChapterSummaries(db);
    console.log('[DEBUG:verifySchema] Chapter summaries ensured, verification complete');
  }

  /** Ensure translations store has expected indexes; if missing, perform a lightweight upgrade. */
  private async ensureTranslationIndexes(db: IDBDatabase): Promise<void> {
    try {
      const tx = db.transaction([STORES.TRANSLATIONS], 'readonly');
      const store = tx.objectStore(STORES.TRANSLATIONS);
      const idxNames = Array.from(store.indexNames || []);
      const need = [
        !idxNames.includes('chapterUrl_version'),
        !idxNames.includes('stableId'),
        !idxNames.includes('stableId_version'),
      ].some(Boolean);
      if (!need) return;
    } catch {
      return;
    }

    const message = '[IndexedDB] Missing translation indexes (chapterUrl_version / stableId / stableId_version) after migration';
    console.error(message);
    throw new Error(message);
  }

  /**
   * Ensure chapters store has chapterNumber index for efficient preload queries.
   * Migration added to fix O(n) table scans in findChapterByNumber().
   */
  private async ensureChapterIndexes(db: IDBDatabase): Promise<void> {
    try {
      const tx = db.transaction([STORES.CHAPTERS], 'readonly');
      const store = tx.objectStore(STORES.CHAPTERS);
      const idxNames = Array.from(store.indexNames || []);
      if (idxNames.includes('chapterNumber')) return; // Already exists
    } catch {
      return;
    }

    const message = '[IndexedDB] Missing chapterNumber index on chapters store after migration';
    console.error(message);
    throw new Error(message);
  }

  /** Normalize stableId format (hyphen → underscore) and ensure URL mappings exist. */
  async normalizeStableIds(): Promise<void> {
    try {
      const already = await this.getSetting<boolean>('stableIdNormalized');
      if (already) {
        console.log('[IndexedDB] StableId normalization already marked complete');
        return;
      }
      console.log('[IndexedDB] StableId normalization start');
      const db = await this.openDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORES.CHAPTERS, STORES.URL_MAPPINGS, STORES.TRANSLATIONS], 'readwrite');
        const chStore = tx.objectStore(STORES.CHAPTERS);
        const mapStore = tx.objectStore(STORES.URL_MAPPINGS);
        const trStore = tx.objectStore(STORES.TRANSLATIONS);

        const getCh = chStore.getAll();
        getCh.onsuccess = () => {
          const chapters = (getCh.result || []) as ChapterRecord[];
          chapters.forEach((rec) => {
            if (!rec) return;
            const oldId = rec.stableId;
            const newId = oldId?.includes('-') ? oldId.replace(/-/g, '_') : oldId;
            if (newId && newId !== oldId) {
              rec.stableId = newId;
              chStore.put(rec);
              const idx = trStore.index('chapterUrl');
              const curReq = idx.openCursor(IDBKeyRange.only(rec.url));
              curReq.onsuccess = (ev) => {
                const cursor = (ev.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                  const tr = cursor.value as TranslationRecord;
                  tr.stableId = newId;
                  cursor.update(tr);
                  cursor.continue();
                }
              };
            }

            const canonical = rec.canonicalUrl || this.normalizeUrlAggressively(rec.originalUrl || rec.url) || rec.url;
            const sid = rec.stableId || oldId || '';
            if (canonical && sid) {
              mapStore.put({ url: canonical, stableId: sid, isCanonical: true, dateAdded: new Date().toISOString() } as any);
              const raw = rec.originalUrl || rec.url;
              if (raw && raw !== canonical) {
                mapStore.put({ url: raw, stableId: sid, isCanonical: false, dateAdded: new Date().toISOString() } as any);
              }
            }
          });
        };
        getCh.onerror = () => reject(getCh.error as any);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error as any);
      });
      await this.setSetting('stableIdNormalized', true);
      console.log('[IndexedDB] StableId normalization finished');
    } catch (e) {
      console.warn('[IndexedDB] StableId normalization failed', e);
    }
  }

  /** Backfill isActive flag and stableId on legacy translations (one-time migration) */
  async backfillActiveTranslations(): Promise<void> {
    try {
      const already = await this.getSetting<boolean>('activeTranslationsBackfilledV2');
      if (already) {
        console.log('[IndexedDB] Active translations backfill already completed');
        return;
      }

      console.log('[IndexedDB] Starting active translations backfill migration...');
      const db = await this.openDatabase();

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORES.CHAPTERS, STORES.TRANSLATIONS], 'readwrite');
        const chaptersStore = tx.objectStore(STORES.CHAPTERS);
        const translationsStore = tx.objectStore(STORES.TRANSLATIONS);

        // First, get all chapters to build URL -> stableId mapping
        const getChaptersReq = chaptersStore.getAll();

        getChaptersReq.onsuccess = () => {
          const chapters = (getChaptersReq.result || []) as ChapterRecord[];

          // Build URL -> stableId map
          const urlToStableId = new Map<string, string>();
          for (const ch of chapters) {
            if (ch.url && ch.stableId) {
              urlToStableId.set(ch.url, ch.stableId);
            }
            if (ch.canonicalUrl && ch.stableId && ch.canonicalUrl !== ch.url) {
              urlToStableId.set(ch.canonicalUrl, ch.stableId);
            }
          }

          console.log(`[IndexedDB] Built URL->StableId map with ${urlToStableId.size} entries`);

          // Now get all translations
          const getAllReq = translationsStore.getAll();

          getAllReq.onsuccess = () => {
            const allTranslations = (getAllReq.result || []) as TranslationRecord[];

            console.log(`[IndexedDB] Found ${allTranslations.length} translation records to process`);

            // Group translations by chapterUrl
            const byChapter = new Map<string, TranslationRecord[]>();
            for (const tr of allTranslations) {
              if (!tr.chapterUrl) continue;
              if (!byChapter.has(tr.chapterUrl)) {
                byChapter.set(tr.chapterUrl, []);
              }
              byChapter.get(tr.chapterUrl)!.push(tr);
            }

            let activeUpdated = 0;
            let stableIdUpdated = 0;

            // For each chapter, ensure exactly one translation is active AND stableId is set
            let processedCount = 0;
            for (const [chapterUrl, translations] of byChapter) {
              const stableId = urlToStableId.get(chapterUrl);
              const hasActive = translations.some(t => t.isActive);

              // DIAGNOSTIC: Log first few chapters in detail
              if (processedCount < 3) {
                console.log(`[IndexedDB] 🔍 Processing chapter ${processedCount + 1}:`);
                console.log(`   chapterUrl: ${chapterUrl}`);
                console.log(`   stableId lookup result: ${stableId || 'NOT FOUND'}`);
                console.log(`   translation count: ${translations.length}`);
                console.log(`   first translation:`, {
                  id: translations[0]?.id,
                  version: translations[0]?.version,
                  stableId: translations[0]?.stableId,
                  stableIdType: typeof translations[0]?.stableId,
                  isActive: translations[0]?.isActive
                });
                processedCount++;
              }

              for (const tr of translations) {
                let needsUpdate = false;

                // Backfill stableId if missing
                if (!tr.stableId && stableId) {
                  tr.stableId = stableId;
                  needsUpdate = true;
                  stableIdUpdated++;
                  console.log(`[IndexedDB] Backfilled stableId for translation ${tr.id}: ${stableId}`);
                }

                // Set isActive if no translation is active
                if (!hasActive && translations.length > 0) {
                  // Find latest version
                  const latest = translations.reduce((max, t) =>
                    (t.version > max.version) ? t : max
                  );

                  if (tr === latest) {
                    tr.isActive = true;
                    needsUpdate = true;
                    activeUpdated++;
                    console.log(`[IndexedDB] Set translation v${tr.version} as active for ${chapterUrl}`);
                  } else if (tr.isActive) {
                    tr.isActive = false;
                    needsUpdate = true;
                  }
                }

                // Write updates
                if (needsUpdate) {
                  translationsStore.put(tr);
                }
              }
            }

            console.log(`[IndexedDB] ✅ Active translations backfill complete:`);
            console.log(`   - ${activeUpdated} chapters with isActive set`);
            console.log(`   - ${stableIdUpdated} translations with stableId backfilled`);
          };

          getAllReq.onerror = () => reject(getAllReq.error);
        };

        getChaptersReq.onerror = () => reject(getChaptersReq.error);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      await this.setSetting('activeTranslationsBackfilledV2', true);
    } catch (e) {
      console.error('[IndexedDB] Active translations backfill failed:', e);
    }
  }
  
  /**
   * Get stable ID for a URL (centralized database access)
   * Replaces direct database opening from useAppStore
   */
  async getStableIdByUrl(url: string): Promise<string | null> {
    try {
      const db = await this.openDatabase();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['url_mappings'], 'readonly');
        const store = transaction.objectStore('url_mappings');
        
        // Try exact URL first
        const request = store.get(url);
        
        request.onsuccess = () => {
          if (request.result?.stableId) {
            // console.log('[IndexedDB] Found stable ID for URL:', url, '→', request.result.stableId);
            resolve(request.result.stableId);
            return;
          }
          
          // Try normalized URL as fallback
          const normalizedUrl = this.normalizeUrlAggressively(url);
          if (normalizedUrl && normalizedUrl !== url) {
            const normalizedRequest = store.get(normalizedUrl);
            normalizedRequest.onsuccess = () => {
              if (normalizedRequest.result?.stableId) {
                // console.log('[IndexedDB] Found stable ID for normalized URL:', normalizedUrl, '→', normalizedRequest.result.stableId);
                resolve(normalizedRequest.result.stableId);
              } else {
                // console.log('[IndexedDB] No stable ID found for URL:', url);
                resolve(null);
              }
            };
            normalizedRequest.onerror = () => {
              console.warn('[IndexedDB] Error checking normalized URL:', normalizedRequest.error);
              resolve(null);
            };
          } else {
            // console.log('[IndexedDB] No stable ID found for URL:', url);
            resolve(null);
          }
        };
        
        request.onerror = () => {
          console.error('[IndexedDB] Error getting stable ID for URL:', url, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('[IndexedDB] Failed to get stable ID for URL:', url, error);
      return null;
    }
  }

  /**
   * Return all URL → stableId mappings for boot-time index hydration
   */
  async getAllUrlMappings(): Promise<UrlMappingRecord[]> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.URL_MAPPINGS], 'readonly');
      const store = tx.objectStore(STORES.URL_MAPPINGS);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = (req.result || []) as UrlMappingRecord[];
        resolve(
          rows.map(row => ({
            url: row.url,
            stableId: row.stableId,
            isCanonical: !!row.isCanonical,
            dateAdded: row.dateAdded,
          }))
        );
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * One-time backfill of URL mappings and stableId/canonicalUrl into CHAPTERS and URL_MAPPINGS.
   * Marks completion in SETTINGS under key 'urlMappingsBackfilled'.
   */
  private buildUrlMappingEntries(record: ChapterRecord): UrlMappingRecord[] {
    const stableId =
      record.stableId ||
      generateStableChapterId(record.content || '', record.chapterNumber || 0, record.title || '');

    if (!stableId) return [];

    const canonical =
      record.canonicalUrl ||
      this.normalizeUrlAggressively(record.originalUrl || record.url) ||
      record.url;
    const original = record.originalUrl || record.url;
    const dateAdded = new Date().toISOString();
    const entries: UrlMappingRecord[] = [];

    if (canonical) {
      entries.push({
        url: canonical,
        stableId,
        isCanonical: true,
        dateAdded,
      });
    }

    if (original && original !== canonical) {
      entries.push({
        url: original,
        stableId,
        isCanonical: false,
        dateAdded,
      });
    }

    return entries;
  }

  private async upsertUrlMappingsForChapter(record: ChapterRecord): Promise<void> {
    const entries = this.buildUrlMappingEntries(record);
    if (!entries.length) return;

    const db = await this.openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORES.URL_MAPPINGS], 'readwrite');
      const store = tx.objectStore(STORES.URL_MAPPINGS);
      entries.forEach(entry => store.put(entry as any));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async backfillUrlMappingsFromChapters(): Promise<void> {
    try {
      const version = await this.getSetting<number>('urlMappingsBackfillVersion');
      if (version && version >= URL_MAPPINGS_BACKFILL_VERSION) {
        console.log(`[IndexedDB] URL mappings backfill already completed (v${version})`);
        return;
      }
      console.log(`[IndexedDB] URL mappings backfill start (target v${URL_MAPPINGS_BACKFILL_VERSION})`);
      const db = await this.openDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORES.CHAPTERS, STORES.URL_MAPPINGS], 'readwrite');
        const chaptersStore = tx.objectStore(STORES.CHAPTERS);
        const urlStore = tx.objectStore(STORES.URL_MAPPINGS);

        const getAllReq = chaptersStore.getAll();
        getAllReq.onsuccess = () => {
          const chapters = (getAllReq.result || []) as ChapterRecord[];
          let processed = 0;
          for (const rec of chapters) {
            processed += 1;
            if (!rec.stableId) {
              const content = rec.content || '';
              const number = rec.chapterNumber || 0;
              const title = rec.title || '';
              rec.stableId = generateStableChapterId(content, number, title);
            }
            rec.canonicalUrl =
              rec.canonicalUrl ||
              this.normalizeUrlAggressively(rec.originalUrl || rec.url) ||
              rec.url;
            chaptersStore.put(rec);

            const entries = this.buildUrlMappingEntries(rec);
            entries.forEach(entry => urlStore.put(entry as any));
          }
          console.log('[IndexedDB] URL mappings backfill processed chapters', { count: processed });
        };
        getAllReq.onerror = () => reject(getAllReq.error);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      await this.setSetting('urlMappingsBackfilled', true);
      await this.setSetting('urlMappingsBackfillVersion', URL_MAPPINGS_BACKFILL_VERSION);
      console.log(`[IndexedDB] URL mappings backfill completed (v${URL_MAPPINGS_BACKFILL_VERSION})`);
    } catch (e) {
      console.warn('[IndexedDB] URL mappings backfill failed', e);
    }
  }

  /**
   * Normalize URL aggressively for consistent lookups
   */
  private normalizeUrlAggressively(url: string): string | null {
    if (!url) return null;
    
    try {
      const urlObj = new URL(url);
      // Remove ALL query parameters and hash for maximum normalization
      urlObj.search = '';
      urlObj.hash = '';
      // Ensure no trailing slash for consistency
      const pathname = urlObj.pathname.replace(/\/$/, '');
      return `${urlObj.origin}${pathname}`;
    } catch (e) {
      return url; // Return as-is if invalid
    }
  }

  private async ensureChapterSummaries(db: IDBDatabase): Promise<void> {
    console.log('[DEBUG:ensureChapterSummaries] Called');
    if (!db.objectStoreNames.contains(STORES.CHAPTER_SUMMARIES)) {
      console.log('[DEBUG:ensureChapterSummaries] Store does not exist, returning early');
      return;
    }
    if (this.summariesInitialized) {
      console.log('[DEBUG:ensureChapterSummaries] Already initialized, returning');
      return;
    }
    if (this.summariesInitPromise) {
      console.log('[DEBUG:ensureChapterSummaries] Init promise exists, awaiting...');
      await this.summariesInitPromise;
      return;
    }

    console.log('[DEBUG:ensureChapterSummaries] Creating deps with overridden openDatabase');
    // Pass the already-open db to avoid re-entrant openDatabase() call
    const depsWithDb = {
      ...this.getSummaryDeps(),
      openDatabase: async () => {
        console.log('[DEBUG:ensureChapterSummaries:openDatabase] Returning already-open db instance');
        return db;
      },
    };

    console.log('[DEBUG:ensureChapterSummaries] Calling seedChapterSummariesIfEmpty...');
    this.summariesInitPromise = seedChapterSummariesIfEmpty(depsWithDb)
      .then(() => {
        console.log('[DEBUG:ensureChapterSummaries] seedChapterSummariesIfEmpty completed successfully');
      })
      .catch((error) => {
        console.warn('[IndexedDB] Chapter summary initialization failed:', error);
      })
      .finally(() => {
        console.log('[DEBUG:ensureChapterSummaries] Cleaning up promise');
        this.summariesInitPromise = null;
      });

    await this.summariesInitPromise;
    this.summariesInitialized = true;
    console.log('[DEBUG:ensureChapterSummaries] Completed');
  }


  private async recomputeChapterSummary(options: { chapterUrl?: string; stableId?: string }): Promise<void> {
    const db = await this.openDatabase();
    await this.ensureChapterSummaries(db);
    await recomputeSummaryOp(this.getSummaryDeps(), options);
  }

  private async deleteChapterSummary(stableId: string): Promise<void> {
    await deleteSummaryOp(this.getSummaryDeps(), stableId);
  }
  
  /**
   * Store chapter data
   */
  async storeChapter(chapter: Chapter): Promise<void> {
    const record = await this.chapterRepository.storeChapter(chapter);
    await this.upsertUrlMappingsForChapter(record);
    await this.recomputeChapterSummary({ chapterUrl: record.url });
  }

  private toTranslationSnapshot(settings: AppSettings | TranslationSettingsSnapshot): TranslationSettingsSnapshot {
    return {
      provider: settings.provider,
      model: settings.model,
      temperature: settings.temperature,
      systemPrompt: settings.systemPrompt,
      promptId: 'promptId' in settings ? settings.promptId : undefined,
      promptName: 'promptName' in settings ? settings.promptName : undefined,
    };
  }

  async storeTranslation(
    chapterUrl: string,
    translation: TranslationResult,
    settings: AppSettings | TranslationSettingsSnapshot,
    _options?: { isActive?: boolean }
  ): Promise<TranslationRecord> {
    const record = await this.translationRepository.storeTranslation(
      chapterUrl,
      translation,
      this.toTranslationSnapshot(settings)
    );
    await this.recomputeChapterSummary({ chapterUrl });
    return record;
  }

  async storeTranslationByStableId(
    stableId: string,
    translation: TranslationResult,
    settings: AppSettings | TranslationSettingsSnapshot
  ): Promise<TranslationRecord> {
    const record = await this.translationRepository.storeTranslationByStableId(
      stableId,
      translation,
      this.toTranslationSnapshot(settings)
    );
    await this.recomputeChapterSummary({ stableId });
    return record;
  }

  async getTranslation(chapterUrl: string, version?: number): Promise<TranslationRecord | null> {
    return this.translationRepository.getTranslation(chapterUrl, version);
  }

  async getTranslationById(translationId: string): Promise<TranslationRecord | null> {
    return this.translationRepository.getTranslationById(translationId);
  }

  async getTranslationVersions(chapterUrl: string): Promise<TranslationRecord[]> {
    return this.translationRepository.getTranslationVersions(chapterUrl);
  }

  async getActiveTranslation(chapterUrl: string): Promise<TranslationRecord | null> {
    return this.translationRepository.getActiveTranslation(chapterUrl);
  }

  async setActiveTranslation(chapterUrl: string, version: number): Promise<void> {
    await this.translationRepository.setActiveTranslation(chapterUrl, version);
    await this.recomputeChapterSummary({ chapterUrl });
  }

  /**
   * Update an existing translation record.
   * Uses put() which is an insert-or-update operation.
   */
  async updateTranslation(translation: TranslationRecord): Promise<void> {
    await this.translationRepository.updateTranslation(translation);
    await this.recomputeChapterSummary({ chapterUrl: translation.chapterUrl });
  }
  
  /**
   * Get chapter data
   */
  async getChapter(url: string): Promise<ChapterRecord | null> {
    return this.chapterRepository.getChapter(url);
  }

  /**
   * Get a chapter by its stableId using the chapters index
   */
  async getChapterByStableId(stableId: string): Promise<ChapterRecord | null> {
    return this.chapterRepository.getChapterByStableId(stableId);
  }

  /**
   * Update chapterNumber by stableId (insert-or-update on existing chapter record)
   */
  async setChapterNumberByStableId(stableId: string, chapterNumber: number): Promise<void> {
    await this.chapterRepository.setChapterNumberByStableId(stableId, chapterNumber);
  }
  
  /**
   * Store settings
   */
  async storeSettings(settings: AppSettings): Promise<void> {
    await this.settingsRepository.storeAppSettings(settings);
  }

  /**
   * Generic key/value setting setter
   */
  async setSetting(key: string, value: any): Promise<void> {
    await this.settingsRepository.setSetting(key, value);
  }

  /**
   * Generic key/value setting getter
   */
  async getSetting<T = any>(key: string): Promise<T | null> {
    return this.settingsRepository.getSetting<T>(key);
  }
  
  /**
   * Get settings
   */
  async getSettings(): Promise<AppSettings | null> {
    return this.settingsRepository.getAppSettings();
  }
  
  /**
   * Store feedback
   */
  async storeFeedback(chapterUrl: string, feedback: FeedbackItem, translationId?: string): Promise<void> {
    await this.feedbackRepository.storeFeedback(chapterUrl, feedback, translationId);
  }
  
  /**
   * Get feedback for a chapter
   */
  async getFeedback(chapterUrl: string): Promise<FeedbackRecord[]> {
    return this.feedbackRepository.getFeedbackByChapter(chapterUrl);
  }

  /**
   * Update feedback comment by feedback ID
   */
  async updateFeedbackComment(feedbackId: string, comment: string): Promise<void> {
    await this.feedbackRepository.updateFeedbackComment(feedbackId, comment);
  }

  /**
   * Delete feedback by ID
   */
  async deleteFeedbackById(feedbackId: string): Promise<void> {
    await this.feedbackRepository.deleteFeedback(feedbackId);
  }

  /**
   * Convenience: get URL mapping for a stableId
   */
  async getUrlForStableId(stableId: string): Promise<string | null> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([STORES.URL_MAPPINGS], 'readonly');
        const store = tx.objectStore(STORES.URL_MAPPINGS);
        const idx = store.index('stableId');
        const req = idx.get(stableId);
        req.onsuccess = () => resolve((req.result as UrlMappingRecord | undefined)?.url ?? null);
        req.onerror = () => reject(req.error);
      } catch (e) { reject(e); }
    });
  }

  /**
   * Convenience: get mapping record by URL
   */
  async getUrlMappingForUrl(url: string): Promise<UrlMappingRecord | null> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([STORES.URL_MAPPINGS], 'readonly');
        const store = tx.objectStore(STORES.URL_MAPPINGS);
        const req = store.get(url);
        req.onsuccess = () => resolve((req.result as UrlMappingRecord) || null);
        req.onerror = () => reject(req.error);
      } catch (e) { reject(e); }
    });
  }

  /**
   * List all chapters
   */
  async getAllChapters(): Promise<ChapterRecord[]> {
    return this.chapterRepository.getAllChapters();
  }

  /**
   * Get all translations from IndexedDB (for migration purposes)
   */
  async getAllTranslations(): Promise<TranslationRecord[]> {
    return this.translationRepository.getAllTranslations();
  }

  /**
   * Delete a chapter and all its associated translations
   */
  async deleteChapter(chapterUrl: string): Promise<void> {
    const db = await this.openDatabase();
    const stableId = await this.getStableIdByUrl(chapterUrl);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CHAPTERS, STORES.TRANSLATIONS], 'readwrite');

      // Delete chapter
      const chaptersStore = transaction.objectStore(STORES.CHAPTERS);
      chaptersStore.delete(chapterUrl);

      // Delete associated translations
      const translationsStore = transaction.objectStore(STORES.TRANSLATIONS);
      const index = translationsStore.index('chapterUrl');
      const request = index.openCursor(IDBKeyRange.only(chapterUrl));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      transaction.oncomplete = () => {
        if (stableId) {
          this.deleteChapterSummary(stableId).then(resolve).catch(reject);
        } else {
          resolve();
        }
      };

      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Update a translation record in IndexedDB (for migration purposes)
   */
  async updateTranslationRecord(translation: TranslationRecord): Promise<void> {
    await this.translationRepository.updateTranslation(translation);
    await this.recomputeChapterSummary({ chapterUrl: translation.chapterUrl });
  }

  /**
   * List all novels
   */
  async getAllNovels(): Promise<NovelRecord[]> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.NOVELS], 'readonly');
      const store = tx.objectStore(STORES.NOVELS);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as NovelRecord[]) || []);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * List all feedback across chapters
   */
  async getAllFeedback(): Promise<FeedbackRecord[]> {
    return this.feedbackRepository.getAllFeedback();
  }

  /**
   * Get all diff results from the database
   */
  async getAllDiffResults(): Promise<any[]> {
    const db = await this.openDatabase();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([STORES.DIFF_RESULTS], 'readonly');
        const store = transaction.objectStore(STORES.DIFF_RESULTS);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      } catch (error) {
        // Store might not exist in older DB versions
        resolve([]);
      }
    });
  }

  /**
   * Export a full session JSON with everything stored in IndexedDB
  */
  async exportFullSessionToJson(options: ExportSessionOptions = {}): Promise<any> {
    return exportSessionOperation(this.getExportDeps(), options);
  }

  private getExportDeps(): ExportOpsDeps {
    return {
      getSettings: () => this.getSettings(),
      getAllUrlMappings: () => this.getAllUrlMappings(),
      getAllNovels: () => this.getAllNovels(),
      getAllChapters: () => this.getAllChapters(),
      getSetting: <T>(key: string) => this.getSetting<T>(key),
      getAllDiffResults: () => this.getAllDiffResults(),
      getUrlMappingForUrl: (url: string) => this.getUrlMappingForUrl(url),
      getTranslationVersionsByStableId: (stableId: string) => this.getTranslationVersionsByStableId(stableId),
      getTranslationVersions: (url: string) => this.getTranslationVersions(url),
      getFeedback: (url: string) => this.getFeedback(url),
      getPromptTemplates: () => this.getPromptTemplates(),
      getAmendmentLogs: () => AmendmentOps.getLogs(),
    };
  }

  private getRenderingDeps(): RenderingOpsDeps {
    return {
      openDatabase: () => this.openDatabase(),
      getActiveTranslation: (chapterUrl: string) => this.getActiveTranslation(chapterUrl),
    };
  }

  private getSummaryDeps(): SummaryOpsDeps {
    return {
      openDatabase: () => this.openDatabase(),
      getChapter: (url: string) => this.getChapter(url),
      getChapterByStableId: (stableId: string) => this.getChapterByStableId(stableId),
      getActiveTranslation: (chapterUrl: string) => this.getActiveTranslation(chapterUrl),
      normalizeUrl: (url: string) => this.normalizeUrlAggressively(url),
    };
  }

  async storePromptTemplate(template: PromptTemplate): Promise<void> {
    await this.promptTemplatesRepository.storeTemplate(template);
  }

  async getPromptTemplates(): Promise<PromptTemplateRecord[]> {
    return this.promptTemplatesRepository.getTemplates();
  }

  async getDefaultPromptTemplate(): Promise<PromptTemplateRecord | null> {
    return this.promptTemplatesRepository.getDefaultTemplate();
  }
  
  /**
   * Get prompt template by ID
   */
  async getPromptTemplate(id: string): Promise<PromptTemplateRecord | null> {
    return this.promptTemplatesRepository.getTemplate(id);
  }
  
  /**
   * Delete prompt template
   */
  async deletePromptTemplate(id: string): Promise<void> {
    await this.promptTemplatesRepository.deleteTemplate(id);
  }
  
  /**
   * Set default prompt template (unsets others)
   */
  async setDefaultPromptTemplate(id: string): Promise<void> {
    await this.promptTemplatesRepository.setDefaultTemplate(id);
  }
  
  /**
   * Close database connection (simplified - no state to manage)
   */
  close(): void {
    // console.log('[IndexedDB] No persistent connections to close');
  }

  /**
   * Test stable ID schema migration
   * This method verifies that the database schema has been properly upgraded
   */
  async testStableIdSchema(): Promise<{ success: boolean; message: string; details: any }> {
    try {
      // console.log('[IndexedDB] Testing stable ID schema migration...');
      
      const db = await this.openDatabase();
      
      // Check database version
      const version = db.version;
      console.log(`[IndexedDB] Database version: ${version}`);
      
      // Check that all expected stores exist
      const storeNames = Array.from(db.objectStoreNames).sort();
      const expectedStores = Object.values(STORES).sort();
      
      console.log('[IndexedDB] Found stores:', storeNames);
      console.log('[IndexedDB] Expected stores:', expectedStores);
      
      const missingStores = expectedStores.filter(store => !storeNames.includes(store));
      if (missingStores.length > 0) {
        return {
          success: false,
          message: `Missing stores: ${missingStores.join(', ')}`,
          details: { version, storeNames, expectedStores, missingStores }
        };
      }
      
      // Test URL_MAPPINGS store structure
      const urlTransaction = db.transaction([STORES.URL_MAPPINGS], 'readonly');
      const urlStore = urlTransaction.objectStore(STORES.URL_MAPPINGS);
      const urlIndexes = Array.from(urlStore.indexNames).sort();
      const expectedUrlIndexes = ['stableId', 'isCanonical', 'dateAdded'].sort();
      
      console.log('[IndexedDB] URL_MAPPINGS indexes:', urlIndexes);
      console.log('[IndexedDB] Expected URL_MAPPINGS indexes:', expectedUrlIndexes);
      
      // Test NOVELS store structure  
      const novelTransaction = db.transaction([STORES.NOVELS], 'readonly');
      const novelStore = novelTransaction.objectStore(STORES.NOVELS);
      const novelIndexes = Array.from(novelStore.indexNames).sort();
      const expectedNovelIndexes = ['source', 'title', 'dateAdded', 'lastAccessed'].sort();
      
      console.log('[IndexedDB] NOVELS indexes:', novelIndexes);
      console.log('[IndexedDB] Expected NOVELS indexes:', expectedNovelIndexes);
      
      db.close();
      
      return {
        success: true,
        message: `Schema migration successful. Database version ${version} with ${storeNames.length} stores.`,
        details: {
          version,
          storeNames,
          urlIndexes,
          novelIndexes,
          dbName: DB_NAME
        }
      };
      
    } catch (error: any) {
      console.error('[IndexedDB] Schema test failed:', error);
      return {
        success: false,
        message: `Schema test failed: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  // ========================================
  // PHASE 2: ENHANCED METHODS WITH STABLE ID SUPPORT  
  // ========================================
  
  /**
   * Check if the database service is available
   */
  isAvailable(): boolean {
    return true; // IndexedDB service is always available when imported
  }

  /**
   * Store enhanced chapter with stable ID support
   */
  async storeEnhancedChapter(enhancedChapter: any): Promise<void> {
    // For now, convert enhanced chapter to regular chapter format
    const chapter: Chapter = {
      title: enhancedChapter.title,
      content: enhancedChapter.content,
      originalUrl: enhancedChapter.canonicalUrl || enhancedChapter.originalUrl,
      nextUrl: enhancedChapter.nextUrl,
      prevUrl: enhancedChapter.prevUrl
    };
    
    await this.storeChapter(chapter);
    console.log('[IndexedDB] Stored enhanced chapter with stable ID:', enhancedChapter.id);
  }

  async getTranslationVersionsByStableId(stableId: string): Promise<TranslationRecord[]> {
    return this.translationRepository.getTranslationVersionsByStableId(stableId);
  }

  async getActiveTranslationByStableId(stableId: string): Promise<TranslationRecord | null> {
    return this.translationRepository.getActiveTranslationByStableId(stableId);
  }

  async deleteTranslation(chapterUrl: string, version: number): Promise<void> {
    const versions = await this.translationRepository.getTranslationVersions(chapterUrl);
    const target = versions.find(v => v.version === version);
    if (!target) return;
    await this.translationRepository.deleteTranslationVersion(target.id);
    await this.recomputeChapterSummary({ chapterUrl });
  }

  async deleteTranslationVersion(translationId: string): Promise<void> {
    const translation = await this.translationRepository.getTranslationById(translationId);
    if (!translation) return;
    await this.translationRepository.deleteTranslationVersion(translationId);
    await this.recomputeChapterSummary({ chapterUrl: translation.chapterUrl });
  }

  async ensureActiveTranslationByStableId(stableId: string): Promise<TranslationRecord | null> {
    const active = await this.translationRepository.ensureActiveTranslationByStableId(stableId);
    if (active) {
      await this.recomputeChapterSummary({ stableId });
    }
    return active;
  }

  /**
   * Set active translation by stable ID (wrapper around URL-based method)
   */
  async setActiveTranslationByStableId(stableId: string, version: number): Promise<void> {
    await this.translationRepository.setActiveTranslationByStableId(stableId, version);
    await this.recomputeChapterSummary({ stableId });
  }

  /**
   * Get chapters formatted for React rendering with stable IDs
   * Generates stable IDs from existing chapter data for UI consistency
   */
  async getChapterSummaries(): Promise<ChapterSummaryRecord[]> {
    const db = await this.openDatabase();
    await this.ensureChapterSummaries(db);

    if (!db.objectStoreNames.contains(STORES.CHAPTER_SUMMARIES)) {
      memorySummary('Chapter summaries store missing despite initialization attempt');
      console.warn(`[⚠️ RETRIEVE] CHAPTER_SUMMARIES store doesn't exist!`);
      return [];
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([STORES.CHAPTER_SUMMARIES], 'readonly');
        const store = tx.objectStore(STORES.CHAPTER_SUMMARIES);
        const req = store.getAll();
        req.onsuccess = () => {
          const summaries = ((req.result || []) as ChapterSummaryRecord[]).slice();
          console.log(`[📚 RETRIEVE] Retrieved ${summaries.length} summaries from CHAPTER_SUMMARIES`);

          summaries.forEach(s => {
            console.log(`[📄 RETRIEVE]   Ch #${s.chapterNumber}: "${s.translatedTitle || s.title}" (stableId: ${s.stableId})`);
          });

          summaries.sort((a, b) => {
            const aNum = a.chapterNumber ?? Number.POSITIVE_INFINITY;
            const bNum = b.chapterNumber ?? Number.POSITIVE_INFINITY;
            if (aNum !== bNum) return aNum - bNum;
            return (a.title || '').localeCompare(b.title || '');
          });

          console.log(`[🔢 RETRIEVE] Sorted ${summaries.length} summaries by chapterNumber`);

          // DIAGNOSTIC: Compare CHAPTERS vs CHAPTER_SUMMARIES
          this.compareChaptersVsSummaries().catch(err => {
            console.error('[🔍 DIAGNOSTIC] Failed to run comparison:', err);
          });

          resolve(summaries);
        };
        req.onerror = () => {
          console.error(`[❌ RETRIEVE] Error retrieving summaries:`, req.error);
          reject(req.error);
        };
      } catch (error) {
        console.error(`[❌ RETRIEVE] Exception in getChapterSummaries:`, error);
        reject(error as Error);
      }
    });
  }

  /**
   * DIAGNOSTIC: Compare CHAPTERS vs CHAPTER_SUMMARIES to identify missing summaries
   */
  private async compareChaptersVsSummaries(): Promise<void> {
    try {
      const db = await this.openDatabase();

      // Get all chapters
      const chaptersPromise = new Promise<ChapterRecord[]>((resolve, reject) => {
        const tx = db.transaction([STORES.CHAPTERS], 'readonly');
        const store = tx.objectStore(STORES.CHAPTERS);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      // Get all summaries
      const summariesPromise = new Promise<ChapterSummaryRecord[]>((resolve, reject) => {
        const tx = db.transaction([STORES.CHAPTER_SUMMARIES], 'readonly');
        const store = tx.objectStore(STORES.CHAPTER_SUMMARIES);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      const [chapters, summaries] = await Promise.all([chaptersPromise, summariesPromise]);

      console.log(`[🔍 DIAGNOSTIC] ========== CHAPTERS vs SUMMARIES COMPARISON ==========`);
      console.log(`[🔍 DIAGNOSTIC] Total in CHAPTERS store: ${chapters.length}`);
      console.log(`[🔍 DIAGNOSTIC] Total in CHAPTER_SUMMARIES store: ${summaries.length}`);

      const summariesByStableId = new Map<string, ChapterSummaryRecord>();
      summaries.forEach(s => summariesByStableId.set(s.stableId, s));

      const chaptersWithoutSummaries: ChapterRecord[] = [];
      const chaptersWithSummaries: ChapterRecord[] = [];

      chapters.forEach(ch => {
        if (ch.stableId && summariesByStableId.has(ch.stableId)) {
          chaptersWithSummaries.push(ch);
        } else {
          chaptersWithoutSummaries.push(ch);
        }
      });

      console.log(`[🔍 DIAGNOSTIC] Chapters WITH summaries: ${chaptersWithSummaries.length}`);
      console.log(`[🔍 DIAGNOSTIC] Chapters WITHOUT summaries: ${chaptersWithoutSummaries.length}`);

      if (chaptersWithoutSummaries.length > 0) {
        console.log(`[⚠️ DIAGNOSTIC] ===== MISSING SUMMARIES =====`);
        chaptersWithoutSummaries.forEach(ch => {
          console.log(`[⚠️ DIAGNOSTIC]   Ch #${ch.chapterNumber}: "${ch.title}" (stableId: ${ch.stableId}, url: ${ch.url})`);
        });
      }

      // Check for orphaned summaries (summaries without chapters)
      const chaptersById = new Map<string, ChapterRecord>();
      chapters.forEach(ch => { if (ch.stableId) chaptersById.set(ch.stableId, ch); });

      const orphanedSummaries = summaries.filter(s => !chaptersById.has(s.stableId));
      if (orphanedSummaries.length > 0) {
        console.log(`[⚠️ DIAGNOSTIC] ===== ORPHANED SUMMARIES (no matching chapter) =====`);
        orphanedSummaries.forEach(s => {
          console.log(`[⚠️ DIAGNOSTIC]   Summary stableId: ${s.stableId}, Ch #${s.chapterNumber}: "${s.title}"`);
        });
      }

      console.log(`[🔍 DIAGNOSTIC] ===== END COMPARISON =====`);
    } catch (error) {
      console.error('[❌ DIAGNOSTIC] Exception in compareChaptersVsSummaries:', error);
    }
  }

  /**
   * Get chapters formatted for React rendering with stable IDs
   * Generates stable IDs from existing chapter data for UI consistency
   */
  async getChaptersForReactRendering(): Promise<ChapterRenderingRecord[]> {
    return renderingOperation(this.getRenderingDeps());
  }

  /**
   * Find chapter by URL and return with stable ID
   */
  async findChapterByUrl(url: string): Promise<ChapterLookupResult | null> {
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction(['chapters'], 'readonly');
      const store = transaction.objectStore('chapters');
      
      return new Promise((resolve, reject) => {
        const request = store.get(url);
        request.onsuccess = () => {
          const chapter = request.result as ChapterRecord;
          if (!chapter) {
            resolve(null);
            return;
          }

          // Generate stable ID if not already present
          const stableId = chapter.stableId || generateStableChapterId(chapter.content, chapter.chapterNumber || 0, chapter.title);
          
          resolve({
            stableId,
            canonicalUrl: chapter.canonicalUrl || chapter.url,
            title: chapter.title,
            content: chapter.content,
            nextUrl: chapter.nextUrl,
            prevUrl: chapter.prevUrl,
            chapterNumber: chapter.chapterNumber,
            fanTranslation: chapter.fanTranslation,
            data: {
              chapter: {
                title: chapter.title,
                content: chapter.content,
                originalUrl: chapter.url,
                nextUrl: chapter.nextUrl,
                prevUrl: chapter.prevUrl,
                chapterNumber: chapter.chapterNumber,
              },
              translationResult: null
            }
          });
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('[IndexedDB] Failed to find chapter by URL:', error);
      return null;
    }
  }

  /**
   * Persist stable session data into IndexedDB stores for durability across reloads.
   * Minimal implementation: writes chapters and URL mappings. Can be extended for novels/metadata.
   */
  async importStableSessionData(stableData: {
    novels: Map<string, any>;
    chapters: Map<string, any>;
    urlIndex: Map<string, string>;
    rawUrlIndex: Map<string, string>;
    currentChapterId?: string | null;
    navigationHistory?: string[];
  }): Promise<void> {
    const db = await this.openDatabase();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction([
        STORES.CHAPTERS,
        STORES.URL_MAPPINGS,
        // STORES.NOVELS // optional, not strictly needed for rendering
      ], 'readwrite');

      tx.oncomplete = () => {
        // console.log('[IndexedDB] importStableSessionData: write complete');
        resolve();
      };
      tx.onerror = () => {
        console.error('[IndexedDB] importStableSessionData: transaction error', tx.error);
        reject(tx.error as any);
      };

      const chaptersStore = tx.objectStore(STORES.CHAPTERS);
      const urlMapStore = tx.objectStore(STORES.URL_MAPPINGS);

      // Write chapters
      for (const [, ch] of stableData.chapters) {
        try {
          const canonicalUrl = ch.canonicalUrl || ch.originalUrl || ch.chapter?.originalUrl;
          if (!canonicalUrl) continue;
          const record: ChapterRecord = {
            url: canonicalUrl,
            stableId: ch.stableId || ch.id || undefined,
            title: ch.title || ch.chapter?.title || '',
            content: ch.content || ch.chapter?.content || '',
            originalUrl: canonicalUrl,
            nextUrl: ch.nextUrl || ch.chapter?.nextUrl || undefined,
            prevUrl: ch.prevUrl || ch.chapter?.prevUrl || undefined,
            fanTranslation: ch.fanTranslation || ch.chapter?.fanTranslation || undefined,
            dateAdded: new Date().toISOString(),
            lastAccessed: new Date().toISOString(),
            chapterNumber: ch.chapterNumber || ch.chapter?.chapterNumber || undefined,
            canonicalUrl,
          } as ChapterRecord;
          chaptersStore.put(record);
        } catch (e) {
          console.error('[IndexedDB] Failed to store chapter record', e, ch);
        }
      }

      // Write URL mappings (raw and normalized -> stableId)
      const writeMapping = (url: string, stableId: string, isCanonical: boolean) => {
        try {
          const rec: UrlMappingRecord = {
            url,
            stableId,
            isCanonical,
            dateAdded: new Date().toISOString(),
          };
          urlMapStore.put(rec);
        } catch (e) {
          console.error('[IndexedDB] Failed to store URL mapping', e, { url, stableId, isCanonical });
        }
      };

      for (const [normUrl, sid] of stableData.urlIndex || []) {
        writeMapping(normUrl, sid, true);
      }
      for (const [rawUrl, sid] of stableData.rawUrlIndex || []) {
        writeMapping(rawUrl, sid, false);
      }
    });
  }

  /**
   * Import a full-session JSON produced by exportFullSessionToJson()
   * WITH PROGRESS TRACKING - Batched import for better UX
   */
  async importFullSessionData(
    payload: any,
    onProgress?: (stage: 'settings' | 'chapters' | 'translations' | 'complete', current: number, total: number, message: string) => void
  ): Promise<void> {
    const db = await this.openDatabase();
    const { settings, urlMappings, novels, chapters, promptTemplates, diffResults } = payload || {};

    // Build transaction store list, including DIFF_RESULTS if it exists
    const stores: string[] = [
      STORES.CHAPTERS,
      STORES.URL_MAPPINGS,
      STORES.TRANSLATIONS,
      STORES.FEEDBACK,
      STORES.SETTINGS,
      STORES.NOVELS,
      STORES.PROMPT_TEMPLATES
    ];

    // Check if diffResults store exists before adding it to transaction
    if (db.objectStoreNames.contains(STORES.DIFF_RESULTS)) {
      stores.push(STORES.DIFF_RESULTS);
    }

    // BATCHED IMPORT WITH PROGRESS TRACKING
    const BATCH_SIZE = 50; // Process 50 chapters per batch

    try {
      // Step 1: Import settings, novels, URL mappings (fast, no batching needed)
      onProgress?.('settings', 0, 1, 'Importing settings and metadata...');

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORES.SETTINGS, STORES.URL_MAPPINGS, STORES.NOVELS, STORES.PROMPT_TEMPLATES, STORES.AMENDMENT_LOGS], 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);

        // Settings
        if (settings) {
          const setStore = tx.objectStore(STORES.SETTINGS);
          setStore.put({ key: 'app-settings', value: settings, updatedAt: new Date().toISOString() });
        }
        if (payload?.navigation) {
          const setStore = tx.objectStore(STORES.SETTINGS);
          setStore.put({ key: 'navigation-history', value: { stableIds: payload.navigation.history || [] }, updatedAt: new Date().toISOString() });
          if (payload.navigation.lastActive) {
            setStore.put({ key: 'lastActiveChapter', value: payload.navigation.lastActive, updatedAt: new Date().toISOString() });
          }
        }

        // URL mappings
        if (Array.isArray(urlMappings)) {
          const mapStore = tx.objectStore(STORES.URL_MAPPINGS);
          for (const m of urlMappings) {
            mapStore.put({
              url: m.url,
              stableId: m.stableId,
              isCanonical: !!m.isCanonical,
              dateAdded: m.dateAdded || new Date().toISOString()
            } as UrlMappingRecord);
          }
        }

        // Novels
        if (Array.isArray(novels)) {
          const novelStore = tx.objectStore(STORES.NOVELS);
          for (const n of novels) {
            novelStore.put({
              id: n.id,
              title: n.title,
              source: n.source,
              chapterCount: n.chapterCount || 0,
              dateAdded: n.dateAdded || new Date().toISOString(),
              lastAccessed: n.lastAccessed || new Date().toISOString()
            } as NovelRecord);
          }
        }

        // Prompt templates
        if (Array.isArray(promptTemplates)) {
          const promptStore = tx.objectStore(STORES.PROMPT_TEMPLATES);
          for (const p of promptTemplates) {
            promptStore.put({
              id: p.id,
              name: p.name,
              description: p.description,
              content: p.content,
              isDefault: Boolean(p.isDefault),
              createdAt: p.createdAt || new Date().toISOString(),
              lastUsed: p.lastUsed || undefined
            } as PromptTemplateRecord);
          }
        }

        if (Array.isArray(payload?.amendmentLogs)) {
          const amendStore = tx.objectStore(STORES.AMENDMENT_LOGS);
          for (const log of payload.amendmentLogs as AmendmentLogRecord[]) {
            amendStore.put(log);
          }
        }
      });

      // Step 2: Import chapters in batches
      if (Array.isArray(chapters) && chapters.length > 0) {
        const totalChapters = chapters.length;

        for (let i = 0; i < chapters.length; i += BATCH_SIZE) {
          const batch = chapters.slice(i, i + BATCH_SIZE);
          const current = Math.min(i + BATCH_SIZE, totalChapters);

          onProgress?.('chapters', current, totalChapters, `Importing chapters ${current}/${totalChapters}...`);

          await new Promise<void>((resolve, reject) => {
            const tx = db.transaction([STORES.CHAPTERS, STORES.TRANSLATIONS, STORES.FEEDBACK], 'readwrite');
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);

            const chStore = tx.objectStore(STORES.CHAPTERS);
            const trStore = tx.objectStore(STORES.TRANSLATIONS);
            const fbStore = tx.objectStore(STORES.FEEDBACK);

            for (const c of batch) {
              // Store chapter
              chStore.put({
                url: c.canonicalUrl,
                stableId: c.stableId,
                title: c.title,
                content: c.content,
                fanTranslation: c.fanTranslation || undefined,
                originalUrl: c.canonicalUrl,
                nextUrl: c.nextUrl || undefined,
                prevUrl: c.prevUrl || undefined,
                dateAdded: new Date().toISOString(),
                lastAccessed: new Date().toISOString(),
                chapterNumber: c.chapterNumber || undefined,
                canonicalUrl: c.canonicalUrl
              } as ChapterRecord);

              // Store translations
              if (Array.isArray(c.translations)) {
                for (const t of c.translations) {
                  trStore.put({
                    id: t.id || crypto.randomUUID(),
                    chapterUrl: c.canonicalUrl,
                    stableId: c.stableId,
                    version: t.version || 1,
                    translatedTitle: t.translatedTitle,
                    translation: t.translation,
                    footnotes: t.footnotes || [],
                    suggestedIllustrations: t.suggestedIllustrations || [],
                    provider: t.provider,
                    model: t.model,
                    temperature: t.temperature,
                    systemPrompt: t.systemPrompt,
                    promptId: t.promptId,
                    promptName: t.promptName,
                    totalTokens: t.usageMetrics?.totalTokens || 0,
                    promptTokens: t.usageMetrics?.promptTokens || 0,
                    completionTokens: t.usageMetrics?.completionTokens || 0,
                    estimatedCost: t.usageMetrics?.estimatedCost || 0,
                    requestTime: t.usageMetrics?.requestTime || 0,
                    createdAt: t.createdAt || new Date().toISOString(),
                    isActive: !!t.isActive
                  } as TranslationRecord);
                }
              }

              // Store feedback
              if (Array.isArray(c.feedback)) {
                for (const f of c.feedback) {
                  fbStore.put({
                    id: f.id || crypto.randomUUID(),
                    chapterUrl: c.canonicalUrl,
                    translationId: undefined,
                    type: f.type,
                    selection: f.selection,
                    comment: f.comment || '',
                    createdAt: f.createdAt || new Date().toISOString()
                  } as FeedbackRecord);
                }
              }
            }
          });

          // Allow UI to update between batches
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      // Step 3: Import diff results if available
      if (Array.isArray(diffResults) && db.objectStoreNames.contains(STORES.DIFF_RESULTS)) {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction([STORES.DIFF_RESULTS], 'readwrite');
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);

          const diffStore = tx.objectStore(STORES.DIFF_RESULTS);
          for (const d of diffResults) {
            diffStore.put(d);
          }
        });
      }

      onProgress?.('complete', 100, 100, 'Import complete!');
    } catch (error) {
      console.error('[IndexedDB] Import failed:', error);
      throw error;
    }
  }

  /**
   * Clear all app data stored in IndexedDB by deleting the database
   */
  async clearAllData(): Promise<void> {
    try {
      const name = 'lexicon-forge';
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase(name);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        req.onblocked = () => {
          console.warn('[IndexedDB] clearAllData blocked: another tab may be open');
        };
      });
      // Reset singleton handles so next open recreates schema
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (dbInstance as any) = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (dbPromise as any) = null;
      console.log('[IndexedDB] Database cleared');
    } catch (err) {
      console.error('[IndexedDB] Failed to clear database', err);
      throw err;
    }
  }

  /**
   * Read the most recently accessed chapter (for optional currentChapterId hydration)
   */
  async getMostRecentChapterStableId(): Promise<{ stableId: string; canonicalUrl: string } | null> {
    try {
      const db = await this.openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORES.CHAPTERS], 'readonly');
        const store = tx.objectStore(STORES.CHAPTERS);
        const idx = store.index('lastAccessed');
        const cursorReq = idx.openCursor(null, 'prev');
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result as IDBCursorWithValue | null;
          if (!cursor) { resolve(null); return; }
          const rec = cursor.value as ChapterRecord;
          const stableId = rec.stableId || generateStableChapterId(rec.content || '', rec.chapterNumber || 0, rec.title || '');
          const canonicalUrl = rec.canonicalUrl || rec.url;
          resolve({ stableId, canonicalUrl });
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      });
    } catch (e) {
      console.warn('[IndexedDB] getMostRecentChapterStableId failed', e);
      return null;
    }
  }

  /**
   * Find a chapter by its chapter number
   * Note: This is inefficient as it requires a full table scan.
   * Use sparingly and in background tasks.
   */
  async findChapterByNumber(chapterNumber: number): Promise<ChapterRecord | null> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CHAPTERS], 'readonly');
      const store = transaction.objectStore(STORES.CHAPTERS);

      // Use index for O(log n) lookup instead of O(n) cursor scan
      try {
        const index = store.index('chapterNumber');
        const request = index.get(chapterNumber);

        request.onsuccess = () => {
          resolve(request.result as ChapterRecord || null);
        };

        request.onerror = () => {
          console.error('[IndexedDB] Error finding chapter by number (index):', request.error);
          reject(request.error);
        };
      } catch (e) {
        // Fallback to cursor scan if index doesn't exist (during migration)
        console.warn('[IndexedDB] chapterNumber index not found, falling back to cursor scan');
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            if (cursor.value.chapterNumber === chapterNumber) {
              resolve(cursor.value as ChapterRecord);
              return;
            }
            cursor.continue();
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          console.error('[IndexedDB] Error finding chapter by number (cursor):', request.error);
          reject(request.error);
        };
      }
    });
  }

  /**
   * Log an amendment proposal action
   */
  async logAmendmentAction(log: Omit<AmendmentLogRecord, 'id' | 'timestamp'>): Promise<void> {
    await AmendmentOps.logAction(log);
  }

  /**
   * Get all amendment logs, optionally filtered by action type or chapter
   */
  async getAmendmentLogs(options?: {
    action?: 'accepted' | 'rejected' | 'modified';
    chapterId?: string;
    limit?: number;
  }): Promise<AmendmentLogRecord[]> {
    return AmendmentOps.getLogs(options);
  }

  /**
   * Get amendment log statistics
   */
  async getAmendmentStats(): Promise<{
    total: number;
    accepted: number;
    rejected: number;
    modified: number;
  }> {
    return AmendmentOps.getStats();
  }

  /**
   * Delete an amendment log by ID
   */
  async deleteAmendmentLog(logId: string): Promise<void> {
    await AmendmentOps.deleteLog(logId);
  }

  /**
   * Delete a specific image version from a chapter's translation result
   * Removes the version from imageVersionState and updates version tracking
   */
  async deleteImageVersion(chapterId: string, placementMarker: string, version: number): Promise<void> {
    await ImageOps.deleteImageVersion(chapterId, placementMarker, version);
  }

  /**
   * Get comprehensive storage diagnostics for IndexedDB
   * Returns statistics about chapters, translations, and images stored on disk
   */
  async getStorageDiagnostics(): Promise<{
    disk: {
      totalChapters: number;
      totalTranslations: number;
      totalImages: number;
      imagesInCache: number;
      imagesLegacy: number;
    };
    quota: {
      usedMB: number;
      quotaMB: number;
      percentUsed: number;
    } | null;
  }> {
    return ImageOps.getStorageDiagnostics();
  }
}

// Export singleton instance
export const indexedDBService = new IndexedDBService();


// Migration functions have been moved to dedicated services

// Expose cleanup function globally for emergency use
if (typeof window !== 'undefined') {
  (window as any).cleanupDuplicateVersions = async () => {
    const { cleanupDuplicateVersions } = await import('./db/maintenanceService');
    return cleanupDuplicateVersions();
  };
  
  // Expose integrated cleanup that refreshes UI
  (window as any).cleanupAndRefresh = async () => {
    const { cleanupDuplicateVersions } = await import('./db/maintenanceService');
    await cleanupDuplicateVersions();
    // Trigger page refresh to reload all version data
    console.log('[Cleanup] Refreshing page to update UI...');
    window.location.reload();
  };
  
  // Expose IndexedDB recovery functions
  (window as any).resetIndexedDB = () => {
    console.log('[Recovery] IndexedDB now uses direct connections - no reset needed');
  };
  
  // NEW: Expose stable ID schema testing
  (window as any).testStableIdSchema = async () => {
    const result = await indexedDBService.testStableIdSchema();
    console.log('[Schema Test]', result.success ? '✅' : '❌', result.message);
    console.log('[Schema Test] Details:', result.details);
    return result;
  };
  
    dblog('[IndexedDB] Service loaded, window.testStableIdSchema() available');
}

// Export utility functions from dedicated services for backward compatibility
export { cleanupDuplicateVersions } from './db/maintenanceService';
export { migrateFromLocalStorage } from './db/migrationService';
