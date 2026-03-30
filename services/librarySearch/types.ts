export interface SourceCandidate {
  site: string;
  url: string;
  matchedTitle: string;
  matchedAuthor: string | null;
  sourceType: 'official' | 'mirror';
  chapterCount: number | null;
  status: string | null;
  confidence: number;
  whyThisMatches: string;
  adapterSupported: boolean;
}

export interface SearchResult {
  query: string;
  identity: {
    titleZh: string | null;
    titleEn: string | null;
    authorZh: string | null;
    aliases: string[];
  };
  rawSources: SourceCandidate[];
  fanTranslations: SourceCandidate[];
}
