/**
 * Shared types for script-side translation source adapters.
 */

export interface TranslatorMetadata {
  name: string;
  era?: string;
  tradition?: string;
  language: string;
  notes?: string;
  sourceReference?: string;
}

export interface AlignedUnit {
  id: string;
  sourceText?: string;
  versions: Record<string, {
    text: string;
    reference?: string;
    notes?: string[];
  }>;
}

export interface PolyglotChapter {
  chapterNumber: number;
  stableId: string;
  title: string;
  sourceTitle?: string;
  units: AlignedUnit[];
}

export interface PolyglotDocument {
  metadata: {
    title: string;
    sourceLanguage?: string;
    genre?: string;
    period?: string;
  };
  translators: Record<string, TranslatorMetadata>;
  chapters: PolyglotChapter[];
}

export interface SourceChapterRange {
  from: number;
  to: number;
}

export interface TranslationParagraph {
  id?: string;
  text: string;
  notes?: string[];
}

export interface TranslationSourceChapter {
  chapterNumber: number;
  title: string;
  chapterRange?: SourceChapterRange;
  paragraphs: TranslationParagraph[];
}

export interface TranslationSourceOutput {
  translatorId: string;
  translator: TranslatorMetadata;
  chapters: TranslationSourceChapter[];
}

export interface TranslationSourceAdapter {
  name: string;
  fileExtensions?: string[];
  canHandle(input: string): boolean;
  extract(input: string): Promise<TranslationSourceOutput>;
}
