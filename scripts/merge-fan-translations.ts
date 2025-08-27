#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';

interface SessionChapter {
  stableId: string;
  canonicalUrl: string;
  title: string;
  content: string;
  chapterNumber: number;
  fanTranslation?: string;
  translations: any[];
  nextUrl?: string;
  prevUrl?: string;
}

interface SessionData {
  metadata: any;
  settings: any;
  navigation: any;
  urlMappings: any[];
  novels: any[];
  chapters: SessionChapter[];
}

/**
 * Extract chapter number from fan translation filename
 * Format: "Chapter-NNNN-Dungeon Defense (WN) Chapter NNN – Title.txt"
 */
const extractChapterNumber = (filename: string): number | null => {
  // Try pattern: Chapter-NNNN-
  const match = filename.match(/^Chapter-(\d+)-/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
};

/**
 * Read and process all fan translation files
 */
const loadFanTranslations = (fanTranslationDir: string): Map<number, string> => {
  const fanTranslations = new Map<number, string>();
  
  if (!fs.existsSync(fanTranslationDir)) {
    console.error(`❌ Fan translation directory not found: ${fanTranslationDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(fanTranslationDir)
    .filter(file => file.endsWith('.txt'))
    .sort();

  console.log(`📂 Found ${files.length} fan translation files`);

  for (const file of files) {
    const chapterNum = extractChapterNumber(file);
    if (chapterNum === null) {
      console.warn(`⚠️  Could not extract chapter number from: ${file}`);
      continue;
    }

    try {
      const filePath = path.join(fanTranslationDir, file);
      const content = fs.readFileSync(filePath, 'utf-8').trim();
      
      if (content.length === 0) {
        console.warn(`⚠️  Empty file: ${file}`);
        continue;
      }

      fanTranslations.set(chapterNum, content);
      console.log(`✅ Loaded fan translation for chapter ${chapterNum} (${content.length} chars)`);
    } catch (error) {
      console.error(`❌ Error reading ${file}: ${error}`);
    }
  }

  console.log(`\n📊 Successfully loaded ${fanTranslations.size} fan translations`);
  return fanTranslations;
};

/**
 * Merge fan translations into session JSON
 */
const mergeSessionWithFanTranslations = (
  sessionPath: string, 
  fanTranslationDir: string, 
  outputPath?: string
): void => {
  console.log('🚀 Starting fan translation merge process...\n');

  // Load session data
  if (!fs.existsSync(sessionPath)) {
    console.error(`❌ Session file not found: ${sessionPath}`);
    process.exit(1);
  }

  console.log(`📖 Loading session data from: ${sessionPath}`);
  const sessionData: SessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
  console.log(`📊 Session contains ${sessionData.chapters.length} chapters`);

  // Load fan translations
  const fanTranslations = loadFanTranslations(fanTranslationDir);

  // Match and merge
  let matchedCount = 0;
  let skippedCount = 0;

  for (const chapter of sessionData.chapters) {
    const fanTranslation = fanTranslations.get(chapter.chapterNumber);
    
    if (fanTranslation) {
      chapter.fanTranslation = fanTranslation;
      matchedCount++;
      console.log(`✅ Matched fan translation for chapter ${chapter.chapterNumber}: "${chapter.title}"`);
    } else {
      skippedCount++;
      console.log(`⏭️  No fan translation for chapter ${chapter.chapterNumber}: "${chapter.title}"`);
    }
  }

  // Save enhanced session
  const finalOutputPath = outputPath || sessionPath.replace('.json', '-with-fan-translations.json');
  
  console.log(`\n💾 Saving enhanced session to: ${finalOutputPath}`);
  fs.writeFileSync(finalOutputPath, JSON.stringify(sessionData, null, 2));

  // Summary
  console.log(`\n🎉 Merge completed successfully!`);
  console.log(`   📊 Total chapters: ${sessionData.chapters.length}`);
  console.log(`   ✅ Matched with fan translations: ${matchedCount}`);
  console.log(`   ⏭️  Chapters without fan translations: ${skippedCount}`);
  console.log(`   📁 Output file: ${finalOutputPath}`);
  
  const coverage = ((matchedCount / sessionData.chapters.length) * 100).toFixed(1);
  console.log(`   📈 Fan translation coverage: ${coverage}%`);
};

// CLI Usage
const main = () => {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
🔧 Fan Translation Merger

Usage:
  npm run merge-fan-translations <session.json> <fan-translation-dir> [output.json]

Examples:
  npm run merge-fan-translations session.json /path/to/fan/translations
  npm run merge-fan-translations session.json /path/to/fan/translations enhanced-session.json

Arguments:
  session.json         Path to LexiconForge session JSON file
  fan-translation-dir  Directory containing fan translation .txt files  
  output.json          Optional output path (default: adds suffix to input)
`);
    process.exit(1);
  }

  const [sessionPath, fanTranslationDir, outputPath] = args;
  mergeSessionWithFanTranslations(sessionPath, fanTranslationDir, outputPath);
};

// Run if called directly (ES module check)
const isMainModule = () => {
  try {
    return import.meta.url === new URL(process.argv[1], 'file:').href;
  } catch {
    return false;
  }
};

if (isMainModule()) {
  main();
}

export { mergeSessionWithFanTranslations, extractChapterNumber, loadFanTranslations };