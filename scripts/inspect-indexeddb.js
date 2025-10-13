#!/usr/bin/env node
/**
 * IndexedDB Inspector - Get statistics and data summaries
 *
 * Usage:
 *   node scripts/inspect-indexeddb.js                    # Overall statistics
 *   node scripts/inspect-indexeddb.js --chapter <id>     # Specific chapter details
 *   node scripts/inspect-indexeddb.js --images           # Image statistics
 *   node scripts/inspect-indexeddb.js --translations     # Translation statistics
 */

const { chromium } = require('playwright');

async function inspectIndexedDB(options = {}) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to app to ensure IndexedDB is accessible
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });

  const stats = await page.evaluate(async (opts) => {
    const DB_NAME = 'LexiconForgeDB';
    const DB_VERSION = 9;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = async () => {
        const db = request.result;
        const results = {
          database: DB_NAME,
          version: db.version,
          stores: {},
          summary: {},
        };

        try {
          // Get all object stores
          const storeNames = Array.from(db.objectStoreNames);

          for (const storeName of storeNames) {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const countReq = store.count();

            const count = await new Promise((res, rej) => {
              countReq.onsuccess = () => res(countReq.result);
              countReq.onerror = () => rej(countReq.error);
            });

            results.stores[storeName] = { count };
          }

          // Get detailed chapter statistics if requested
          if (opts.chapter) {
            const chapterId = opts.chapter;
            results.chapterDetails = await getChapterDetails(db, chapterId);
          }

          // Get image statistics
          if (opts.images || opts.all) {
            results.imageStats = await getImageStats(db);
          }

          // Get translation statistics
          if (opts.translations || opts.all) {
            results.translationStats = await getTranslationStats(db);
          }

          // Get overall summary
          if (opts.all || (!opts.chapter && !opts.images && !opts.translations)) {
            results.summary = await getOverallSummary(db);
          }

          db.close();
          resolve(results);
        } catch (error) {
          db.close();
          reject(error);
        }
      };
    });

    async function getChapterDetails(db, chapterId) {
      const tx = db.transaction(['chapters', 'translations', 'generatedImages'], 'readonly');
      const details = {
        chapterId,
        found: false,
        chapter: null,
        translations: [],
        images: [],
        stats: {
          translationCount: 0,
          activeTranslation: null,
          imageCount: 0,
          totalImageSize: 0,
          suggestedIllustrationsCount: 0,
          footnotesCount: 0,
        },
      };

      // Get chapter
      const chapterStore = tx.objectStore('chapters');
      const chapterIdx = chapterStore.index('stableId');
      const chapterReq = chapterIdx.get(chapterId);
      const chapter = await new Promise((res) => {
        chapterReq.onsuccess = () => res(chapterReq.result);
        chapterReq.onerror = () => res(null);
      });

      if (chapter) {
        details.found = true;
        details.chapter = {
          url: chapter.url,
          title: chapter.title,
          stableId: chapter.stableId,
          chapterNumber: chapter.chapterNumber,
          contentLength: chapter.content?.length || 0,
        };
      }

      // Get translations
      const translationsStore = tx.objectStore('translations');
      const translationsIdx = translationsStore.index('stableId');
      const translationsReq = translationsIdx.getAll(chapterId);
      const translations = await new Promise((res) => {
        translationsReq.onsuccess = () => res(translationsReq.result || []);
        translationsReq.onerror = () => res([]);
      });

      details.translations = translations.map(t => ({
        id: t.id,
        version: t.version,
        isActive: t.isActive,
        provider: t.provider,
        model: t.model,
        translatedTitle: t.translatedTitle,
        translationLength: t.translation?.length || 0,
        footnotesCount: t.footnotes?.length || 0,
        suggestedIllustrationsCount: t.suggestedIllustrations?.length || 0,
        footnotes: t.footnotes || [],
        suggestedIllustrations: t.suggestedIllustrations || [],
        createdAt: t.createdAt,
        customVersionLabel: t.customVersionLabel,
      }));

      details.stats.translationCount = translations.length;
      const activeTranslation = translations.find(t => t.isActive);
      if (activeTranslation) {
        details.stats.activeTranslation = {
          version: activeTranslation.version,
          footnotesCount: activeTranslation.footnotes?.length || 0,
          suggestedIllustrationsCount: activeTranslation.suggestedIllustrations?.length || 0,
        };
        details.stats.footnotesCount = activeTranslation.footnotes?.length || 0;
        details.stats.suggestedIllustrationsCount = activeTranslation.suggestedIllustrations?.length || 0;
      }

      // Get images
      const imagesStore = tx.objectStore('generatedImages');
      const imagesIdx = imagesStore.index('chapterId');
      const imagesReq = imagesIdx.getAll(chapterId);
      const images = await new Promise((res) => {
        imagesReq.onsuccess = () => res(imagesReq.result || []);
        imagesReq.onerror = () => res([]);
      });

      details.images = images.map(img => ({
        id: img.id,
        chapterId: img.chapterId,
        marker: img.marker,
        provider: img.provider,
        imageDataLength: img.imageData?.length || 0,
        prompt: img.prompt?.substring(0, 100) + (img.prompt?.length > 100 ? '...' : ''),
        createdAt: img.createdAt,
      }));

      details.stats.imageCount = images.length;
      details.stats.totalImageSize = images.reduce((sum, img) => sum + (img.imageData?.length || 0), 0);

      return details;
    }

    async function getImageStats(db) {
      const tx = db.transaction(['generatedImages'], 'readonly');
      const store = tx.objectStore('generatedImages');
      const allReq = store.getAll();
      const images = await new Promise((res) => {
        allReq.onsuccess = () => res(allReq.result || []);
        allReq.onerror = () => res([]);
      });

      const stats = {
        totalImages: images.length,
        totalSize: 0,
        averageSize: 0,
        byChapter: {},
        byProvider: {},
        largestImages: [],
      };

      images.forEach(img => {
        const size = img.imageData?.length || 0;
        stats.totalSize += size;

        // By chapter
        if (!stats.byChapter[img.chapterId]) {
          stats.byChapter[img.chapterId] = { count: 0, totalSize: 0 };
        }
        stats.byChapter[img.chapterId].count++;
        stats.byChapter[img.chapterId].totalSize += size;

        // By provider
        if (!stats.byProvider[img.provider]) {
          stats.byProvider[img.provider] = { count: 0, totalSize: 0 };
        }
        stats.byProvider[img.provider].count++;
        stats.byProvider[img.provider].totalSize += size;
      });

      stats.averageSize = stats.totalImages > 0 ? Math.round(stats.totalSize / stats.totalImages) : 0;
      stats.totalSizeMB = (stats.totalSize / (1024 * 1024)).toFixed(2);

      // Top 10 largest images
      stats.largestImages = images
        .map(img => ({
          chapterId: img.chapterId,
          marker: img.marker,
          size: img.imageData?.length || 0,
          provider: img.provider,
        }))
        .sort((a, b) => b.size - a.size)
        .slice(0, 10);

      return stats;
    }

    async function getTranslationStats(db) {
      const tx = db.transaction(['translations'], 'readonly');
      const store = tx.objectStore('translations');
      const allReq = store.getAll();
      const translations = await new Promise((res) => {
        allReq.onsuccess = () => res(allReq.result || []);
        allReq.onerror = () => res([]);
      });

      const stats = {
        totalTranslations: translations.length,
        activeTranslations: 0,
        byChapter: {},
        byProvider: {},
        withFootnotes: 0,
        withIllustrations: 0,
        totalFootnotes: 0,
        totalIllustrations: 0,
      };

      translations.forEach(t => {
        if (t.isActive) stats.activeTranslations++;

        const footnotesCount = t.footnotes?.length || 0;
        const illustrationsCount = t.suggestedIllustrations?.length || 0;

        if (footnotesCount > 0) {
          stats.withFootnotes++;
          stats.totalFootnotes += footnotesCount;
        }

        if (illustrationsCount > 0) {
          stats.withIllustrations++;
          stats.totalIllustrations += illustrationsCount;
        }

        // By chapter
        if (!stats.byChapter[t.stableId]) {
          stats.byChapter[t.stableId] = {
            versions: 0,
            hasActive: false,
            footnotes: 0,
            illustrations: 0,
          };
        }
        stats.byChapter[t.stableId].versions++;
        if (t.isActive) stats.byChapter[t.stableId].hasActive = true;
        stats.byChapter[t.stableId].footnotes += footnotesCount;
        stats.byChapter[t.stableId].illustrations += illustrationsCount;

        // By provider
        const provider = t.provider || 'unknown';
        if (!stats.byProvider[provider]) {
          stats.byProvider[provider] = { count: 0, footnotes: 0, illustrations: 0 };
        }
        stats.byProvider[provider].count++;
        stats.byProvider[provider].footnotes += footnotesCount;
        stats.byProvider[provider].illustrations += illustrationsCount;
      });

      return stats;
    }

    async function getOverallSummary(db) {
      const tx = db.transaction(
        ['chapters', 'translations', 'generatedImages', 'chapterSummaries'],
        'readonly'
      );

      const summary = {
        chapters: 0,
        translations: 0,
        images: 0,
        chapterSummaries: 0,
        chaptersWithTranslations: 0,
        chaptersWithImages: 0,
        totalImageSizeMB: 0,
        totalFootnotes: 0,
        totalIllustrations: 0,
      };

      // Count chapters
      const chaptersStore = tx.objectStore('chapters');
      const chaptersCount = await new Promise((res) => {
        const req = chaptersStore.count();
        req.onsuccess = () => res(req.result);
        req.onerror = () => res(0);
      });
      summary.chapters = chaptersCount;

      // Count translations
      const translationsStore = tx.objectStore('translations');
      const translationsAll = await new Promise((res) => {
        const req = translationsStore.getAll();
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => res([]);
      });
      summary.translations = translationsAll.length;

      const chapterIds = new Set();
      translationsAll.forEach(t => {
        chapterIds.add(t.stableId);
        summary.totalFootnotes += t.footnotes?.length || 0;
        summary.totalIllustrations += t.suggestedIllustrations?.length || 0;
      });
      summary.chaptersWithTranslations = chapterIds.size;

      // Count images
      const imagesStore = tx.objectStore('generatedImages');
      const imagesAll = await new Promise((res) => {
        const req = imagesStore.getAll();
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => res([]);
      });
      summary.images = imagesAll.length;

      const imageChapterIds = new Set();
      let totalSize = 0;
      imagesAll.forEach(img => {
        imageChapterIds.add(img.chapterId);
        totalSize += img.imageData?.length || 0;
      });
      summary.chaptersWithImages = imageChapterIds.size;
      summary.totalImageSizeMB = (totalSize / (1024 * 1024)).toFixed(2);

      // Count chapter summaries (if store exists)
      try {
        const summariesStore = tx.objectStore('chapterSummaries');
        const summariesCount = await new Promise((res) => {
          const req = summariesStore.count();
          req.onsuccess = () => res(req.result);
          req.onerror = () => res(0);
        });
        summary.chapterSummaries = summariesCount;
      } catch (e) {
        summary.chapterSummaries = 0;
      }

      return summary;
    }
  }, options);

  await browser.close();
  return stats;
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  all: args.includes('--all'),
  images: args.includes('--images'),
  translations: args.includes('--translations'),
  chapter: null,
};

const chapterIdx = args.indexOf('--chapter');
if (chapterIdx !== -1 && args[chapterIdx + 1]) {
  options.chapter = args[chapterIdx + 1];
}

// Run inspection
(async () => {
  try {
    console.log('🔍 Inspecting IndexedDB...\n');
    const stats = await inspectIndexedDB(options);
    console.log(JSON.stringify(stats, null, 2));
  } catch (error) {
    console.error('❌ Error inspecting IndexedDB:', error.message);
    console.error('\n💡 Make sure:');
    console.error('   1. The dev server is running (npm run dev)');
    console.error('   2. Playwright is installed (npm install -D playwright)');
    process.exit(1);
  }
})();
