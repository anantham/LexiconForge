import * as fs from 'fs';
import * as path from 'path';

import {
  inferMonolithicTextStructure,
  parseChineseMonolithicText,
  parseEnglishMonolithicText,
} from '../chapter-parsing';
import { decodeTextBuffer } from '../text-processing';
import type {
  TranslationSourceAdapter,
  TranslationSourceOutput,
} from '../translation-source-types';

export class TxtFileAdapter implements TranslationSourceAdapter {
  name = 'txt-file';
  fileExtensions = ['.txt'];

  canHandle(input: string): boolean {
    return input.toLowerCase().endsWith('.txt') && fs.existsSync(input) && fs.statSync(input).isFile();
  }

  async extract(filePath: string): Promise<TranslationSourceOutput> {
    console.log(`📄 Parsing TXT file: ${path.basename(filePath)}`);

    const buffer = fs.readFileSync(filePath);
    const decoded = decodeTextBuffer(buffer);
    const structure = inferMonolithicTextStructure(decoded.text);

    console.log(`   Encoding: ${decoded.encoding}`);
    console.log(`   Structure: ${structure}`);

    if (structure === 'unknown') {
      throw new Error('Unsupported TXT structure. Expected numbered Chinese or English chapter headings.');
    }

    const chapters = structure === 'chinese-numbered-chapters'
      ? parseChineseMonolithicText(decoded.text)
      : parseEnglishMonolithicText(decoded.text);

    if (chapters.length === 0) {
      throw new Error('No chapters could be parsed from TXT file.');
    }

    console.log(`\n📊 Extracted ${chapters.length} chapters from TXT file`);

    return {
      translatorId: structure === 'chinese-numbered-chapters' ? 'source-text' : 'english-monolithic-txt',
      translator: {
        name: path.basename(filePath, path.extname(filePath)),
        language: structure === 'chinese-numbered-chapters' ? 'Chinese' : 'English',
        tradition: structure === 'chinese-numbered-chapters' ? 'Source Text' : 'Fan/Community',
        notes: `Decoded as ${decoded.encoding}`,
      },
      chapters,
    };
  }
}
