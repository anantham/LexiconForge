import { generateStableChapterId } from '../../stableIdService';
import type { ChapterRecord, TranslationRecord, UrlMappingRecord } from '../types';
import type { TranslationResult } from '../../../types';
import type {
  ChapterRef,
  ITranslationRepository,
  TranslationSettingsSnapshot,
} from './interfaces/ITranslationRepository';

interface TranslationRepositoryDeps {
  getDb: () => Promise<IDBDatabase>;
  getChapter: (chapterUrl: string) => Promise<ChapterRecord | null>;
  stores: {
    TRANSLATIONS: string;
    CHAPTERS: string;
    URL_MAPPINGS: string;
  };
}

const generateId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export class TranslationRepository implements ITranslationRepository {
  constructor(private readonly deps: TranslationRepositoryDeps) {}

  private async resolveChapterUrl(ref: ChapterRef): Promise<string> {
    if (ref.url) return ref.url;
    if (!ref.stableId) throw new Error('Chapter reference requires url or stableId');

    const db = await this.deps.getDb();
    const tx = db.transaction([this.deps.stores.URL_MAPPINGS], 'readonly');
    const store = tx.objectStore(this.deps.stores.URL_MAPPINGS);
    const index = store.index('stableId');
    const request = index.get(ref.stableId);

    return await new Promise<string>((resolve, reject) => {
      request.onsuccess = () => {
        const result = request.result as UrlMappingRecord | undefined;
        if (result?.url) {
          resolve(result.url);
        } else {
          reject(new Error(`No URL mapping for stableId ${ref.stableId}`));
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async loadChapter(url: string): Promise<ChapterRecord | null> {
    return this.deps.getChapter(url);
  }

  private async fetchTranslationsByUrl(
    chapterUrl: string
  ): Promise<TranslationRecord[]> {
    const db = await this.deps.getDb();
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction([this.deps.stores.TRANSLATIONS], 'readonly');
      const store = transaction.objectStore(this.deps.stores.TRANSLATIONS);
      const index = store.index('chapterUrl');
      const request = index.getAll(IDBKeyRange.only(chapterUrl));

      request.onsuccess = () => {
        const results = (request.result as TranslationRecord[] | undefined) || [];
        resolve(results.sort((a, b) => b.version - a.version));
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async fetchTranslationById(translationId: string): Promise<TranslationRecord | null> {
    const db = await this.deps.getDb();
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction([this.deps.stores.TRANSLATIONS], 'readonly');
      const store = transaction.objectStore(this.deps.stores.TRANSLATIONS);
      const request = store.get(translationId);
      request.onsuccess = () => resolve((request.result as TranslationRecord) || null);
      request.onerror = () => reject(request.error);
    });
  }

  private buildUsageMetrics(result: TranslationResult, settings: TranslationSettingsSnapshot) {
    return (
      result.usageMetrics || {
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        estimatedCost: 0,
        requestTime: 0,
        provider: settings.provider,
        model: settings.model,
      }
    );
  }

  private async writeTranslation(record: TranslationRecord): Promise<void> {
    const db = await this.deps.getDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([this.deps.stores.TRANSLATIONS], 'readwrite');
      const store = transaction.objectStore(this.deps.stores.TRANSLATIONS);
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async deactivateTranslations(records: TranslationRecord[]): Promise<void> {
    const updates = records
      .filter(record => record.isActive)
      .map(record => ({ ...record, isActive: false }));

    if (!updates.length) return;

    const db = await this.deps.getDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([this.deps.stores.TRANSLATIONS], 'readwrite');
      const store = transaction.objectStore(this.deps.stores.TRANSLATIONS);
      let remaining = updates.length;

      updates.forEach(update => {
        const request = store.put(update);
        request.onsuccess = () => {
          remaining -= 1;
          if (remaining === 0) resolve();
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  async storeTranslation(
    chapterUrl: string,
    translation: TranslationResult,
    settings: TranslationSettingsSnapshot
  ): Promise<TranslationRecord> {
    const existing = await this.fetchTranslationsByUrl(chapterUrl);
    const chapter = await this.loadChapter(chapterUrl);
    const stableId =
      chapter?.stableId ||
      (chapter
        ? generateStableChapterId(
            chapter.content || '',
            chapter.chapterNumber || 0,
            chapter.title || ''
          )
        : undefined);

    const nextVersion = existing.reduce((max, record) => Math.max(max, record.version || 0), 0) + 1;

    await this.deactivateTranslations(existing);

    const metrics = this.buildUsageMetrics(translation, settings);
    const newRecord: TranslationRecord = {
      id: generateId(),
      chapterUrl,
      stableId,
      version: nextVersion,
      translatedTitle: translation.translatedTitle,
      translation: translation.translation,
      footnotes: translation.footnotes || [],
      suggestedIllustrations: translation.suggestedIllustrations || [],
      provider: settings.provider,
      model: settings.model,
      temperature: settings.temperature,
      systemPrompt: settings.systemPrompt,
      promptId: settings.promptId,
      promptName: settings.promptName,
      customVersionLabel: translation.customVersionLabel,
      totalTokens: metrics.totalTokens,
      promptTokens: metrics.promptTokens,
      completionTokens: metrics.completionTokens,
      estimatedCost: metrics.estimatedCost,
      requestTime: metrics.requestTime,
      createdAt: new Date().toISOString(),
      isActive: true,
      proposal: translation.proposal || undefined,
      settingsSnapshot: settings,
    };

    await this.writeTranslation(newRecord);
    return newRecord;
  }

  async storeTranslationByStableId(
    stableId: string,
    translation: TranslationResult,
    settings: TranslationSettingsSnapshot
  ): Promise<TranslationRecord> {
    const chapterUrl = await this.resolveChapterUrl({ stableId });
    const record = await this.storeTranslation(chapterUrl, translation, settings);
    record.stableId = stableId;
    await this.writeTranslation(record);
    return record;
  }

  async getTranslation(chapterUrl: string, version?: number): Promise<TranslationRecord | null> {
    const versions = await this.fetchTranslationsByUrl(chapterUrl);
    if (version != null) {
      return versions.find(v => v.version === version) || null;
    }
    // Use Boolean coercion to handle legacy data (may be stored as 1, 'true', or true)
    return versions.find(v => Boolean(v.isActive)) || versions[0] || null;
  }

  async getTranslationById(translationId: string): Promise<TranslationRecord | null> {
    return this.fetchTranslationById(translationId);
  }

  async getTranslationVersions(chapterUrl: string): Promise<TranslationRecord[]> {
    return this.fetchTranslationsByUrl(chapterUrl);
  }

  async getTranslationVersionsByStableId(stableId: string): Promise<TranslationRecord[]> {
    const chapterUrl = await this.resolveChapterUrl({ stableId });
    const versions = await this.fetchTranslationsByUrl(chapterUrl);
    return versions.map(v => ({ ...v, stableId }));
  }

  async getActiveTranslation(chapterUrl: string): Promise<TranslationRecord | null> {
    return this.getTranslation(chapterUrl);
  }

  async getActiveTranslationByStableId(stableId: string): Promise<TranslationRecord | null> {
    const chapterUrl = await this.resolveChapterUrl({ stableId });
    const translation = await this.getTranslation(chapterUrl);
    if (translation) translation.stableId = stableId;
    return translation;
  }

  async ensureActiveTranslationByStableId(stableId: string): Promise<TranslationRecord | null> {
    const versions = await this.getTranslationVersionsByStableId(stableId);
    if (!versions.length) return null;
    const active = versions.find(v => v.isActive) || versions[0];
    if (active.isActive) return active;
    await this.setActiveTranslationByStableId(stableId, active.version);
    return this.getActiveTranslationByStableId(stableId);
  }

  async setActiveTranslation(chapterUrl: string, version: number): Promise<void> {
    const db = await this.deps.getDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([this.deps.stores.TRANSLATIONS], 'readwrite');
      const store = transaction.objectStore(this.deps.stores.TRANSLATIONS);
      const index = store.index('chapterUrl');
      const request = index.openCursor(IDBKeyRange.only(chapterUrl));
      request.onsuccess = () => {
        const cursor = request.result as IDBCursorWithValue | null;
        if (!cursor) return;
        const record = cursor.value as TranslationRecord;
        const shouldBeActive = record.version === version;
        if (Boolean(record.isActive) !== shouldBeActive) {
          record.isActive = shouldBeActive;
          cursor.update(record);
        }
        cursor.continue();
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async setActiveTranslationByStableId(stableId: string, version: number): Promise<void> {
    const chapterUrl = await this.resolveChapterUrl({ stableId });
    await this.setActiveTranslation(chapterUrl, version);
  }

  async deleteTranslationVersion(translationId: string): Promise<void> {
    const translation = await this.fetchTranslationById(translationId);
    if (!translation) return;
    const db = await this.deps.getDb();

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([this.deps.stores.TRANSLATIONS], 'readwrite');
      const store = transaction.objectStore(this.deps.stores.TRANSLATIONS);
      const request = store.delete(translationId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    const remaining = await this.fetchTranslationsByUrl(translation.chapterUrl);
    if (remaining.length && !remaining.some(r => r.isActive)) {
      const latest = remaining[0];
      await this.setActiveTranslation(translation.chapterUrl, latest.version);
    }
  }

  async deleteTranslationVersionByChapter(chapterUrl: string, version: number): Promise<boolean> {
    const versions = await this.fetchTranslationsByUrl(chapterUrl);
    const target = versions.find(record => record.version === version);
    if (!target) {
      return false;
    }
    await this.deleteTranslationVersion(target.id);
    return true;
  }

  async updateTranslation(record: TranslationRecord): Promise<void> {
    await this.writeTranslation(record);
  }

  async getAllTranslations(): Promise<TranslationRecord[]> {
    const db = await this.deps.getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.deps.stores.TRANSLATIONS], 'readonly');
      const store = transaction.objectStore(this.deps.stores.TRANSLATIONS);
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result as TranslationRecord[]) || []);
      request.onerror = () => reject(request.error);
    });
  }
}
