/**
 * Browser-based IndexedDB Inspector
 *
 * Usage:
 *   1. Open browser DevTools Console (F12)
 *   2. Copy this entire file and paste into console
 *   3. Run commands:
 *      - await inspectIDB.summary()           // Overall statistics
 *      - await inspectIDB.chapter('ch_123')   // Specific chapter details
 *      - await inspectIDB.images()            // Image statistics
 *      - await inspectIDB.translations()      // Translation statistics
 *      - await inspectIDB.findChapters()      // List all chapters with IDs
 */

window.inspectIDB = {
  DB_NAME: 'LexiconForgeDB',
  DB_VERSION: 9,

  async openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  },

  async summary() {
    const db = await this.openDB();
    const summary = {
      database: this.DB_NAME,
      version: db.version,
      stores: {},
      totals: {
        chapters: 0,
        translations: 0,
        activeTranslations: 0,
        images: 0,
        chaptersWithTranslations: 0,
        chaptersWithImages: 0,
        totalImageSizeMB: 0,
        totalFootnotes: 0,
        totalIllustrations: 0,
      },
    };

    // Get store counts
    const storeNames = Array.from(db.objectStoreNames);
    for (const storeName of storeNames) {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const count = await new Promise((res) => {
        const req = store.count();
        req.onsuccess = () => res(req.result);
        req.onerror = () => res(0);
      });
      summary.stores[storeName] = count;
    }

    // Get detailed totals
    const tx = db.transaction(['chapters', 'translations', 'generatedImages'], 'readonly');

    // Chapters
    const chaptersCount = await new Promise((res) => {
      const req = tx.objectStore('chapters').count();
      req.onsuccess = () => res(req.result);
      req.onerror = () => res(0);
    });
    summary.totals.chapters = chaptersCount;

    // Translations
    const translations = await new Promise((res) => {
      const req = tx.objectStore('translations').getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res([]);
    });
    summary.totals.translations = translations.length;

    const chapterIds = new Set();
    translations.forEach(t => {
      if (t.isActive) summary.totals.activeTranslations++;
      chapterIds.add(t.stableId);
      summary.totals.totalFootnotes += t.footnotes?.length || 0;
      summary.totals.totalIllustrations += t.suggestedIllustrations?.length || 0;
    });
    summary.totals.chaptersWithTranslations = chapterIds.size;

    // Images
    const images = await new Promise((res) => {
      const req = tx.objectStore('generatedImages').getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res([]);
    });
    summary.totals.images = images.length;

    const imageChapterIds = new Set();
    let totalSize = 0;
    images.forEach(img => {
      imageChapterIds.add(img.chapterId);
      totalSize += img.imageData?.length || 0;
    });
    summary.totals.chaptersWithImages = imageChapterIds.size;
    summary.totals.totalImageSizeMB = (totalSize / (1024 * 1024)).toFixed(2);

    db.close();

    console.log('📊 IndexedDB Summary:');
    console.table(summary.stores);
    console.log('\n📈 Totals:');
    console.table(summary.totals);

    return summary;
  },

  async chapter(chapterId) {
    const db = await this.openDB();
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
        totalImageSizeMB: 0,
        suggestedIllustrationsCount: 0,
        footnotesCount: 0,
      },
    };

    // Get chapter
    const chapterStore = tx.objectStore('chapters');
    const chapterIdx = chapterStore.index('stableId');
    const chapter = await new Promise((res) => {
      const req = chapterIdx.get(chapterId);
      req.onsuccess = () => res(req.result);
      req.onerror = () => res(null);
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
    } else {
      console.warn(`❌ Chapter not found: ${chapterId}`);
      db.close();
      return details;
    }

    // Get translations
    const translationsStore = tx.objectStore('translations');
    const translationsIdx = translationsStore.index('stableId');
    const translations = await new Promise((res) => {
      const req = translationsIdx.getAll(chapterId);
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res([]);
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
    const images = await new Promise((res) => {
      const req = imagesIdx.getAll(chapterId);
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res([]);
    });

    details.images = images.map(img => ({
      id: img.id,
      chapterId: img.chapterId,
      marker: img.marker,
      provider: img.provider,
      imageDataLength: img.imageData?.length || 0,
      imageDataSizeKB: ((img.imageData?.length || 0) / 1024).toFixed(2),
      prompt: img.prompt?.substring(0, 100) + (img.prompt?.length > 100 ? '...' : ''),
      createdAt: img.createdAt,
    }));

    details.stats.imageCount = images.length;
    details.stats.totalImageSize = images.reduce((sum, img) => sum + (img.imageData?.length || 0), 0);
    details.stats.totalImageSizeMB = (details.stats.totalImageSize / (1024 * 1024)).toFixed(2);

    db.close();

    console.log(`\n📖 Chapter: ${details.chapter.title}`);
    console.log(`   ID: ${chapterId}`);
    console.log(`   Number: ${details.chapter.chapterNumber || 'N/A'}`);
    console.log('\n📝 Translations:', details.stats.translationCount);
    if (details.stats.activeTranslation) {
      console.log(`   Active Version: ${details.stats.activeTranslation.version}`);
      console.log(`   Footnotes: ${details.stats.activeTranslation.footnotesCount}`);
      console.log(`   Illustrations: ${details.stats.activeTranslation.suggestedIllustrationsCount}`);
    }
    console.log('\n🖼️  Images:', details.stats.imageCount);
    console.log(`   Total Size: ${details.stats.totalImageSizeMB} MB`);

    if (details.translations.length > 0) {
      console.log('\n📋 Translation Versions:');
      console.table(details.translations.map(t => ({
        Version: t.version,
        Active: t.isActive ? '✓' : '',
        Provider: t.provider,
        Model: t.model,
        Footnotes: t.footnotesCount,
        Illustrations: t.suggestedIllustrationsCount,
        Label: t.customVersionLabel || '-',
      })));
    }

    if (details.images.length > 0) {
      console.log('\n🖼️  Generated Images:');
      console.table(details.images.map(img => ({
        Marker: img.marker,
        Provider: img.provider,
        'Size (KB)': img.imageDataSizeKB,
        Prompt: img.prompt,
      })));
    }

    // Show footnotes and illustrations from active translation
    if (activeTranslation) {
      if (activeTranslation.footnotes?.length > 0) {
        console.log('\n📌 Footnotes in Active Translation:');
        console.table(activeTranslation.footnotes.map(f => ({
          Marker: f.marker,
          Text: f.text?.substring(0, 100) + (f.text?.length > 100 ? '...' : ''),
        })));
      }

      if (activeTranslation.suggestedIllustrations?.length > 0) {
        console.log('\n🎨 Suggested Illustrations in Active Translation:');
        console.table(activeTranslation.suggestedIllustrations.map(i => ({
          Marker: i.placementMarker,
          Prompt: i.imagePrompt?.substring(0, 100) + (i.imagePrompt?.length > 100 ? '...' : ''),
          Generated: i.generatedImage ? '✓' : '✗',
        })));
      }
    }

    return details;
  },

  async images() {
    const db = await this.openDB();
    const tx = db.transaction(['generatedImages'], 'readonly');
    const images = await new Promise((res) => {
      const req = tx.objectStore('generatedImages').getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res([]);
    });
    db.close();

    const stats = {
      totalImages: images.length,
      totalSize: 0,
      totalSizeMB: 0,
      averageSize: 0,
      averageSizeKB: 0,
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
    stats.averageSizeKB = (stats.averageSize / 1024).toFixed(2);
    stats.totalSizeMB = (stats.totalSize / (1024 * 1024)).toFixed(2);

    // Top 10 largest images
    stats.largestImages = images
      .map(img => ({
        chapterId: img.chapterId,
        marker: img.marker,
        size: img.imageData?.length || 0,
        sizeKB: ((img.imageData?.length || 0) / 1024).toFixed(2),
        provider: img.provider,
      }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);

    console.log('\n🖼️  Image Statistics:');
    console.log(`   Total Images: ${stats.totalImages}`);
    console.log(`   Total Size: ${stats.totalSizeMB} MB`);
    console.log(`   Average Size: ${stats.averageSizeKB} KB`);

    console.log('\n📊 By Provider:');
    console.table(Object.entries(stats.byProvider).map(([provider, data]) => ({
      Provider: provider,
      Count: data.count,
      'Total Size (MB)': (data.totalSize / (1024 * 1024)).toFixed(2),
    })));

    console.log('\n📊 By Chapter (Top 10):');
    const topChapters = Object.entries(stats.byChapter)
      .map(([chapterId, data]) => ({
        ChapterId: chapterId,
        Count: data.count,
        'Total Size (MB)': (data.totalSize / (1024 * 1024)).toFixed(2),
      }))
      .sort((a, b) => parseFloat(b['Total Size (MB)']) - parseFloat(a['Total Size (MB)']))
      .slice(0, 10);
    console.table(topChapters);

    console.log('\n🏆 Top 10 Largest Images:');
    console.table(stats.largestImages.map(img => ({
      Chapter: img.chapterId,
      Marker: img.marker,
      'Size (KB)': img.sizeKB,
      Provider: img.provider,
    })));

    return stats;
  },

  async translations() {
    const db = await this.openDB();
    const tx = db.transaction(['translations'], 'readonly');
    const translations = await new Promise((res) => {
      const req = tx.objectStore('translations').getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res([]);
    });
    db.close();

    const stats = {
      totalTranslations: translations.length,
      activeTranslations: 0,
      withFootnotes: 0,
      withIllustrations: 0,
      totalFootnotes: 0,
      totalIllustrations: 0,
      byChapter: {},
      byProvider: {},
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

    console.log('\n📝 Translation Statistics:');
    console.log(`   Total Translations: ${stats.totalTranslations}`);
    console.log(`   Active Translations: ${stats.activeTranslations}`);
    console.log(`   With Footnotes: ${stats.withFootnotes} (${stats.totalFootnotes} total)`);
    console.log(`   With Illustrations: ${stats.withIllustrations} (${stats.totalIllustrations} total)`);

    console.log('\n📊 By Provider:');
    console.table(Object.entries(stats.byProvider).map(([provider, data]) => ({
      Provider: provider,
      Count: data.count,
      Footnotes: data.footnotes,
      Illustrations: data.illustrations,
    })));

    console.log('\n📊 Chapters with Most Illustrations:');
    const topIllustrations = Object.entries(stats.byChapter)
      .filter(([_, data]) => data.illustrations > 0)
      .map(([chapterId, data]) => ({
        ChapterId: chapterId,
        Versions: data.versions,
        Active: data.hasActive ? '✓' : '✗',
        Footnotes: data.footnotes,
        Illustrations: data.illustrations,
      }))
      .sort((a, b) => b.Illustrations - a.Illustrations)
      .slice(0, 10);
    console.table(topIllustrations);

    return stats;
  },

  async findChapters(limit = 20) {
    const db = await this.openDB();
    const tx = db.transaction(['chapters'], 'readonly');
    const chapters = await new Promise((res) => {
      const req = tx.objectStore('chapters').getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res([]);
    });
    db.close();

    const chapterList = chapters.slice(0, limit).map(ch => ({
      StableId: ch.stableId,
      Number: ch.chapterNumber || 'N/A',
      Title: ch.title?.substring(0, 50) + (ch.title?.length > 50 ? '...' : ''),
    }));

    console.log(`\n📚 Chapters (showing ${limit} of ${chapters.length}):`);
    console.table(chapterList);

    console.log(`\n💡 To inspect a specific chapter, run:`);
    console.log(`   await inspectIDB.chapter('${chapters[0]?.stableId}')`);

    return chapters.map(ch => ({
      stableId: ch.stableId,
      title: ch.title,
      chapterNumber: ch.chapterNumber,
    }));
  },
};

console.log(`
✅ IndexedDB Inspector loaded!

Available commands:
  await inspectIDB.summary()            - Overall database statistics
  await inspectIDB.findChapters()       - List chapters with their IDs
  await inspectIDB.chapter('ch_123')    - Detailed chapter inspection
  await inspectIDB.images()             - Image statistics
  await inspectIDB.translations()       - Translation statistics

Example workflow:
  1. await inspectIDB.summary()
  2. await inspectIDB.findChapters()
  3. await inspectIDB.chapter('copy_id_from_above')
`);
