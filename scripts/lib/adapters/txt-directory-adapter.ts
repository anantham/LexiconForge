import * as fs from 'fs';
import * as path from 'path';

import { splitTextIntoParagraphs } from '../text-processing';
import type {
  TranslationSourceAdapter,
  TranslationSourceOutput,
} from '../translation-source-types';

export class TxtDirectoryAdapter implements TranslationSourceAdapter {
  name = 'txt-directory';

  canHandle(input: string): boolean {
    return fs.existsSync(input) && fs.statSync(input).isDirectory();
  }

  async extract(dirPath: string): Promise<TranslationSourceOutput> {
    console.log(`📁 Reading TXT files from: ${path.basename(dirPath)}`);

    const files = fs.readdirSync(dirPath)
      .filter((file) => file.endsWith('.txt'))
      .sort();

    const chapters: TranslationSourceOutput['chapters'] = [];

    for (const file of files) {
      const chapterNumber = this.extractChapterNumber(file);
      if (chapterNumber === null) {
        console.log(`   ⚠️ Skipping: ${file} (no chapter number)`);
        continue;
      }

      const content = fs.readFileSync(path.join(dirPath, file), 'utf-8').trim();
      if (!content) {
        continue;
      }

      const paragraphs = splitTextIntoParagraphs(content);
      const title = this.extractTitle(file) || `Chapter ${chapterNumber}`;

      chapters.push({
        chapterNumber,
        title,
        paragraphs,
      });

      console.log(`   ✅ Chapter ${chapterNumber}: "${title}" (${paragraphs.length} paragraphs)`);
    }

    console.log(`\n📊 Loaded ${chapters.length} chapters from TXT files`);

    return {
      translatorId: 'english-fan',
      translator: {
        name: 'Fan Translation',
        language: 'English',
        tradition: 'Fan/Community',
      },
      chapters,
    };
  }

  private extractChapterNumber(filename: string): number | null {
    const namedChapter = filename.match(/^Chapter-(\d+)-/i);
    if (namedChapter) {
      return parseInt(namedChapter[1], 10);
    }

    const numericPrefix = filename.match(/^(\d+)[-_]/);
    if (numericPrefix) {
      return parseInt(numericPrefix[1], 10);
    }

    return null;
  }

  private extractTitle(filename: string): string | null {
    const namedChapter = filename.match(/^Chapter-\d+-(.+)\.txt$/i);
    if (namedChapter) {
      return namedChapter[1].trim();
    }

    const numericPrefix = filename.match(/^\d+[-_](.+)\.txt$/i);
    if (numericPrefix) {
      return numericPrefix[1].trim();
    }

    return null;
  }
}
