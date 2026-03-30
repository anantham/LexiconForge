import * as fs from 'fs';
import * as path from 'path';

import type {
  PolyglotChapter,
  PolyglotDocument,
  TranslationSourceAdapter,
  TranslationSourceOutput,
} from '../translation-source-types';

export class PolyglottaJsonAdapter implements TranslationSourceAdapter {
  name = 'polyglotta-json';
  fileExtensions = ['.json'];

  canHandle(input: string): boolean {
    if (!input.endsWith('.json') || !fs.existsSync(input)) {
      return false;
    }

    try {
      const content = JSON.parse(fs.readFileSync(input, 'utf-8'));
      return content.metadata?.source === 'polyglotta';
    } catch {
      return false;
    }
  }

  async extract(jsonPath: string): Promise<TranslationSourceOutput> {
    console.log(`📜 Parsing Polyglotta JSON: ${path.basename(jsonPath)}`);

    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    console.log(`   Title: ${data.metadata?.text?.title || 'Unknown'}`);
    console.log(`   Sections: ${data.chapters?.length || 0}`);
    console.log(`   Paragraphs: ${data.metadata?.totalParagraphs || 0}`);

    const chapters = (data.chapters || []).map((chapter: any) => ({
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      paragraphs: (chapter.polyglotContent || []).map((paragraph: any) => ({
        id: paragraph.id,
        text: paragraph.versions?.sanskrit?.text ||
          (Object.values(paragraph.versions || {})[0] as { text?: string } | undefined)?.text ||
          '',
      })),
    }));

    return {
      translatorId: 'polyglotta-source',
      translator: {
        name: 'Polyglotta Archive',
        language: 'Multiple',
        tradition: 'Academic/Scholarly',
        sourceReference: 'University of Oslo Polyglotta',
      },
      chapters,
    };
  }

  async extractAllVersions(jsonPath: string): Promise<PolyglotDocument> {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    const translators = {
      sanskrit: {
        name: 'Sanskrit Original',
        language: 'Sanskrit',
        tradition: 'Source Text',
      },
      'chinese-kumarajiva': {
        name: 'Kumārajīva',
        era: '406 CE',
        language: 'Chinese',
        tradition: 'Mādhyamaka',
        notes: 'Most influential Chinese translation, emphasizes emptiness',
      },
      'chinese-xuanzang': {
        name: 'Xuánzàng',
        era: '650 CE',
        language: 'Chinese',
        tradition: 'Yogācāra',
        notes: 'More literal translation, Yogācāra terminology',
      },
      'chinese-zhiqian': {
        name: 'Zhīqiān',
        era: '224 CE',
        language: 'Chinese',
        tradition: 'Early Chinese Buddhism',
        notes: 'Earliest Chinese translation, Daoist influence',
      },
      tibetan: {
        name: 'Tibetan Translation',
        language: 'Tibetan',
        tradition: 'Tibetan Buddhism',
      },
      'english-lamotte': {
        name: 'Étienne Lamotte',
        era: '1962',
        language: 'English (via French)',
        tradition: 'Academic/Sinological',
        notes: 'Scholarly translation with extensive commentary',
      },
      'english-thurman': {
        name: 'Robert Thurman',
        era: '1976',
        language: 'English',
        tradition: 'Tibetan Buddhist/Academic',
        notes: 'Translation from Tibetan, accessible style',
      },
    };

    const chapters: PolyglotChapter[] = (data.chapters || []).map((chapter: any) => ({
      chapterNumber: chapter.chapterNumber,
      stableId: chapter.stableId,
      title: chapter.title,
      units: (chapter.polyglotContent || []).map((paragraph: any) => ({
        id: paragraph.id,
        versions: paragraph.versions || {},
      })),
    }));

    return {
      metadata: {
        title: data.metadata?.text?.title || 'Unknown Text',
        sourceLanguage: 'Sanskrit',
        genre: 'Buddhist Sūtra',
      },
      translators,
      chapters,
    };
  }
}
