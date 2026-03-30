import * as fs from 'fs';
import * as path from 'path';

import { parseEnglishMonolithicText } from '../chapter-parsing';
import { extractPdfText } from '../pdf-text';
import type {
  TranslationSourceAdapter,
  TranslationSourceOutput,
} from '../translation-source-types';

export class PdfAdapter implements TranslationSourceAdapter {
  name = 'pdf';
  fileExtensions = ['.pdf'];

  canHandle(input: string): boolean {
    return input.toLowerCase().endsWith('.pdf') && fs.existsSync(input) && fs.statSync(input).isFile();
  }

  async extract(pdfPath: string): Promise<TranslationSourceOutput> {
    console.log(`📘 Parsing PDF: ${path.basename(pdfPath)}`);
    const extractedText = extractPdfText(pdfPath);
    const chapters = parseEnglishMonolithicText(extractedText);

    if (chapters.length === 0) {
      throw new Error('No chapter headings could be parsed from PDF.');
    }

    console.log(`\n📊 Extracted ${chapters.length} chapters from PDF`);

    return {
      translatorId: 'english-pdf',
      translator: {
        name: path.basename(pdfPath, path.extname(pdfPath)),
        language: 'English',
        tradition: 'Fan/Community',
        sourceReference: 'Imported from PDF',
      },
      chapters,
    };
  }
}
