#!/usr/bin/env node
/**
 * IndexedDB Inspector - Terminal Statistics
 *
 * Run: node scripts/inspect-db.js
 */

const { chromium } = require('playwright');

async function inspectDatabase() {
  console.log('🔍 Opening IndexedDB...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000); // Give IndexedDB time to initialize

  const data = await page.evaluate(async () => {
    const DB_NAME = 'LexiconForgeDB';
    const DB_VERSION = 9;

    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    const tx = db.transaction(
      ['chapters', 'translations', 'generatedImages', 'audioFiles'],
      'readonly'
    );

    // Get all chapters
    const chapters = await new Promise((res) => {
      const req = tx.objectStore('chapters').getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res([]);
    });

    // Get all translations
    const translations = await new Promise((res) => {
      const req = tx.objectStore('translations').getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res([]);
    });

    // Get all images
    const images = await new Promise((res) => {
      const req = tx.objectStore('generatedImages').getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res([]);
    });

    // Get all audio files
    const audioFiles = await new Promise((res) => {
      const req = tx.objectStore('audioFiles').getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res([]);
    });

    db.close();

    // Build chapter statistics
    const chapterStats = chapters.map(ch => {
      const chapterTranslations = translations.filter(t => t.stableId === ch.stableId);
      const activeTranslation = chapterTranslations.find(t => t.isActive);
      const chapterImages = images.filter(img => img.chapterId === ch.stableId);
      const chapterAudio = audioFiles.filter(a => a.chapterId === ch.stableId);

      return {
        stableId: ch.stableId,
        number: ch.chapterNumber || 0,
        title: ch.title || 'Untitled',
        translations: chapterTranslations.length,
        hasActive: !!activeTranslation,
        footnotes: activeTranslation?.footnotes?.length || 0,
        illustrations: activeTranslation?.suggestedIllustrations?.length || 0,
        images: chapterImages.length,
        imageSize: chapterImages.reduce((sum, img) => sum + (img.imageData?.length || 0), 0),
        audio: chapterAudio.length,
        audioSize: chapterAudio.reduce((sum, a) => sum + (a.audioData?.length || 0), 0),
      };
    });

    // Sort by chapter number
    chapterStats.sort((a, b) => (a.number || 0) - (b.number || 0));

    // Overall totals
    const totals = {
      chapters: chapters.length,
      translations: translations.length,
      activeTranslations: translations.filter(t => t.isActive).length,
      images: images.length,
      totalImageSize: images.reduce((sum, img) => sum + (img.imageData?.length || 0), 0),
      audio: audioFiles.length,
      totalAudioSize: audioFiles.reduce((sum, a) => sum + (a.audioData?.length || 0), 0),
      totalFootnotes: translations.reduce((sum, t) => sum + (t.footnotes?.length || 0), 0),
      totalIllustrations: translations.reduce((sum, t) => sum + (t.suggestedIllustrations?.length || 0), 0),
    };

    return { chapterStats, totals };
  });

  await browser.close();
  return data;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

(async () => {
  try {
    const { chapterStats, totals } = await inspectDatabase();

    // Print overall statistics
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                    DATABASE OVERVIEW                          ');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Chapters:             ${totals.chapters}`);
    console.log(`Translations:         ${totals.translations} (${totals.activeTranslations} active)`);
    console.log(`Footnotes:            ${totals.totalFootnotes}`);
    console.log(`Illustrations:        ${totals.totalIllustrations}`);
    console.log(`Generated Images:     ${totals.images} (${formatBytes(totals.totalImageSize)})`);
    console.log(`Audio Files:          ${totals.audio} (${formatBytes(totals.totalAudioSize)})`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Print chapter details
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                    CHAPTER DETAILS                            ');
    console.log('═══════════════════════════════════════════════════════════════');

    // Table header
    console.log(
      '  #  | ' +
      'Vers | ' +
      'Act | ' +
      'Footnotes | ' +
      'Illustrations | ' +
      'Images | ' +
      'Image Size | ' +
      'Audio | ' +
      'Audio Size | ' +
      'Title'
    );
    console.log('─────┼──────┼─────┼───────────┼───────────────┼────────┼────────────┼───────┼────────────┼─────────────────────');

    chapterStats.forEach(ch => {
      const num = String(ch.number).padStart(3, ' ');
      const trans = String(ch.translations).padStart(4, ' ');
      const active = ch.hasActive ? ' ✓ ' : '   ';
      const footnotes = String(ch.footnotes).padStart(9, ' ');
      const illustrations = String(ch.illustrations).padStart(13, ' ');
      const images = String(ch.images).padStart(6, ' ');
      const imageSize = formatBytes(ch.imageSize).padStart(10, ' ');
      const audio = String(ch.audio).padStart(5, ' ');
      const audioSize = formatBytes(ch.audioSize).padStart(10, ' ');
      const title = ch.title.substring(0, 40);

      console.log(
        ` ${num} | ` +
        `${trans} | ` +
        `${active} | ` +
        `${footnotes} | ` +
        `${illustrations} | ` +
        `${images} | ` +
        `${imageSize} | ` +
        `${audio} | ` +
        `${audioSize} | ` +
        `${title}`
      );
    });

    console.log('═══════════════════════════════════════════════════════════════\n');

    // Summary statistics
    const chaptersWithTranslations = chapterStats.filter(ch => ch.translations > 0).length;
    const chaptersWithImages = chapterStats.filter(ch => ch.images > 0).length;
    const chaptersWithAudio = chapterStats.filter(ch => ch.audio > 0).length;
    const chaptersWithFootnotes = chapterStats.filter(ch => ch.footnotes > 0).length;
    const chaptersWithIllustrations = chapterStats.filter(ch => ch.illustrations > 0).length;

    console.log('📊 SUMMARY STATISTICS');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`Chapters with translations:   ${chaptersWithTranslations}/${totals.chapters} (${((chaptersWithTranslations/totals.chapters)*100).toFixed(1)}%)`);
    console.log(`Chapters with footnotes:      ${chaptersWithFootnotes}/${totals.chapters} (${((chaptersWithFootnotes/totals.chapters)*100).toFixed(1)}%)`);
    console.log(`Chapters with illustrations:  ${chaptersWithIllustrations}/${totals.chapters} (${((chaptersWithIllustrations/totals.chapters)*100).toFixed(1)}%)`);
    console.log(`Chapters with images:         ${chaptersWithImages}/${totals.chapters} (${((chaptersWithImages/totals.chapters)*100).toFixed(1)}%)`);
    console.log(`Chapters with audio:          ${chaptersWithAudio}/${totals.chapters} (${((chaptersWithAudio/totals.chapters)*100).toFixed(1)}%)`);
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`Average footnotes/chapter:       ${(totals.totalFootnotes/totals.chapters).toFixed(1)}`);
    console.log(`Average illustrations/chapter:   ${(totals.totalIllustrations/totals.chapters).toFixed(1)}`);
    console.log(`Average images/chapter:          ${(totals.images/totals.chapters).toFixed(1)}`);
    console.log(`Average image size:              ${formatBytes(totals.totalImageSize/totals.images)}`);
    if (totals.audio > 0) {
      console.log(`Average audio size:              ${formatBytes(totals.totalAudioSize/totals.audio)}`);
    }
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\n💡 Make sure:');
    console.error('   1. Dev server is running: npm run dev');
    console.error('   2. Playwright is installed: npm install -D playwright');
    process.exit(1);
  }
})();
