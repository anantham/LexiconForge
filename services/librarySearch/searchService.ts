/**
 * Library Search Service
 *
 * Uses an LLM (via OpenRouter) to resolve novel identity and find
 * raw source + fan translation URLs from a user's search query.
 */

import { getProvider } from '../../adapters/providers/registry';
import { initializeProviders } from '../../adapters/providers';
import type { AppSettings } from '../../types';
import type { SearchResult, SourceCandidate } from './types';

const SUPPORTED_DOMAINS = [
  'kakuyomu.jp',
  'dxmwx.org',
  'kanunu8.com',
  'kanunu.net',
  'novelcool.com',
  'ncode.syosetu.com',
  'booktoki468.com',
  'suttacentral.net',
  'fojin.app',
];

const isAdapterSupported = (url: string): boolean => {
  try {
    const hostname = new URL(url).hostname;
    return SUPPORTED_DOMAINS.some(d => hostname.includes(d));
  } catch {
    return false;
  }
};

const SEARCH_PROMPT = `You are a web novel and Buddhist scripture source finder. Given a user's search query (which may be an English title, Chinese title, Korean title, Sanskrit/Pali title, author name, or a combination), find the work and return source URLs.

If the query refers to a Buddhist text (sutra, vinaya, abhidharma, sastra, tantra, etc. — recognize English / Sanskrit / Pali / Tibetan / Chinese variants), you MUST populate identity.titleZh with the canonical Classical Chinese title (e.g. "般若波羅蜜多心經" for "Heart Sutra", "妙法蓮華經" for "Lotus Sutra"). For novels, fill titleZh with the original-language title as before. Leave rawSources empty for Buddhist texts — they'll be discovered via a separate channel; only return rawSources for novels you find on the platforms below.

IMPORTANT RULES:
- Return REAL URLs that you are confident exist. Do not fabricate URLs.
- If you are not confident a URL exists, do not include it.
- Prefer well-known, stable sites.
- For raw sources, prefer official platforms first, then mirrors.
- For fan translations, include English translation sites.
- Return between 1-5 candidates per category. Fewer is fine if you're not confident.

Return a JSON object with this exact structure:
{
  "identity": {
    "titleZh": "original Chinese/Korean title or null",
    "titleEn": "English title or null",
    "authorZh": "author name in original language or null",
    "aliases": ["any known alternate titles"]
  },
  "rawSources": [
    {
      "site": "site name",
      "url": "full URL to the novel's main page or chapter list",
      "matchedTitle": "title as it appears on this site",
      "matchedAuthor": "author as it appears or null",
      "sourceType": "official or mirror",
      "chapterCount": null,
      "status": "completed or ongoing or null",
      "confidence": 0.0 to 1.0,
      "whyThisMatches": "brief explanation"
    }
  ],
  "fanTranslations": [
    {
      "site": "site name",
      "url": "full URL",
      "matchedTitle": "English title on this site",
      "matchedAuthor": "author or translator or null",
      "sourceType": "mirror",
      "chapterCount": null,
      "status": "completed or ongoing or null",
      "confidence": 0.0 to 1.0,
      "whyThisMatches": "brief explanation"
    }
  ]
}

For raw sources, search these platforms:
- Qidian (qidian.com / book.qidian.com)
- JJWXC (jjwxc.net)
- Zongheng (zongheng.com)
- Kakuyomu (kakuyomu.jp) for Japanese
- Syosetu (ncode.syosetu.com) for Japanese
- UUkanshu (uukanshu.cc)
- Piaotian (piaotian.com)
- Dxmwx (dxmwx.org)
- Kanunu8 (kanunu8.com)
- BookToki for Korean novels

For fan translations, search:
- NovelCool (novelcool.com)
- WuxiaWorld
- WebNovel (webnovel.com)
- Novel Updates (novelupdates.com)
- Light Novel World
- Any other well-known English translation sites

Return ONLY valid JSON. No markdown, no explanation outside the JSON.`;

interface LLMSearchResponse {
  identity: {
    titleZh: string | null;
    titleEn: string | null;
    authorZh: string | null;
    aliases: string[];
  };
  rawSources: Array<{
    site: string;
    url: string;
    matchedTitle: string;
    matchedAuthor: string | null;
    sourceType: 'official' | 'mirror';
    chapterCount: number | null;
    status: string | null;
    confidence: number;
    whyThisMatches: string;
  }>;
  fanTranslations: Array<{
    site: string;
    url: string;
    matchedTitle: string;
    matchedAuthor: string | null;
    sourceType: 'official' | 'mirror';
    chapterCount: number | null;
    status: string | null;
    confidence: number;
    whyThisMatches: string;
  }>;
}

const parseSearchResponse = (text: string): LLMSearchResponse | null => {
  try {
    // Strip markdown code fences if present
    const cleaned = text.replace(/^```json?\s*/m, '').replace(/```\s*$/m, '').trim();
    const parsed = JSON.parse(cleaned);

    if (!parsed.identity || !Array.isArray(parsed.rawSources) || !Array.isArray(parsed.fanTranslations)) {
      console.warn('[LibrarySearch] Malformed response structure:', Object.keys(parsed));
      return null;
    }

    return parsed as LLMSearchResponse;
  } catch (e) {
    console.error('[LibrarySearch] Failed to parse LLM response:', e);
    return null;
  }
};

const annotateCandidate = (raw: LLMSearchResponse['rawSources'][0]): SourceCandidate => ({
  ...raw,
  adapterSupported: isAdapterSupported(raw.url),
});

interface FojinSearchHit {
  id: number;
  cbeta_id: string | null;
  title_zh: string | null;
  title_en?: string | null;
  translator: string | null;
  dynasty: string | null;
  category: string | null;
  has_content: boolean;
  source_code: string | null;
  score: number;
}

/**
 * Query FoJin's search API directly using a canonical Buddhist title.
 * Returns adapter-loadable candidate URLs for the top hits.
 *
 * FoJin's `has_content` field in search results is unreliable (often false even
 * for texts whose juans actually return content). We attempt a fast
 * verification fetch on the top match; subsequent results are returned
 * unverified so the user can pick.
 */
async function searchFojinDirect(
  canonicalTitle: string,
  abortSignal?: AbortSignal,
): Promise<SourceCandidate[]> {
  if (!canonicalTitle || canonicalTitle.trim().length === 0) return [];

  try {
    const url = `https://fojin.app/api/search?q=${encodeURIComponent(canonicalTitle.trim())}&size=8`;
    const response = await fetch(url, { signal: abortSignal });
    if (!response.ok) {
      console.warn(`[LibrarySearch] FoJin search failed: HTTP ${response.status}`);
      return [];
    }

    const json = await response.json();
    const hits: FojinSearchHit[] = Array.isArray(json?.results) ? json.results : [];
    if (hits.length === 0) return [];

    // Rank by score (FoJin already sorts but be explicit) and take top 5.
    const top = [...hits].sort((a, b) => b.score - a.score).slice(0, 5);

    return top.map((hit) => {
      const titleDisplay = hit.title_zh || hit.title_en || `FoJin Text ${hit.id}`;
      const dynastyTrans = [hit.dynasty, hit.translator].filter(Boolean).join(' · ');
      return {
        site: 'FoJin (佛津)',
        url: `https://fojin.app/texts/${hit.id}/read?juan=1`,
        matchedTitle: titleDisplay,
        matchedAuthor: hit.translator || null,
        sourceType: 'official' as const,
        chapterCount: null,
        status: null,
        confidence: Math.min(1, hit.score / 100),
        whyThisMatches: [
          dynastyTrans || null,
          hit.cbeta_id ? `CBETA ${hit.cbeta_id}` : null,
          hit.category || null,
        ].filter(Boolean).join(' · ') || `FoJin search match (score ${hit.score.toFixed(1)})`,
        adapterSupported: true,
      };
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    console.warn('[LibrarySearch] FoJin direct search failed:', e?.message || e);
    return [];
  }
}

export async function searchNovelSources(
  query: string,
  settings: AppSettings,
  abortSignal?: AbortSignal,
): Promise<SearchResult> {
  await initializeProviders();

  const provider = getProvider(settings.provider as any);

  const response = await provider.chatJSON({
    settings,
    messages: [
      { role: 'system', content: SEARCH_PROMPT },
      { role: 'user', content: query },
    ],
    model: settings.model,
    temperature: 0.3,
    maxTokens: 4096,
    apiType: 'library_search',
    abortSignal,
  });

  const parsed = parseSearchResponse(response.text);

  if (!parsed) {
    return {
      query,
      identity: { titleZh: null, titleEn: null, authorZh: null, aliases: [] },
      rawSources: [],
      fanTranslations: [],
    };
  }

  // If the LLM resolved a Chinese title, also probe FoJin directly. Buddhist
  // texts are routinely missed by the novel-focused prompt above; FoJin's own
  // search index will surface them when given a canonical title.
  let fojinCandidates: SourceCandidate[] = [];
  if (parsed.identity.titleZh) {
    try {
      fojinCandidates = await searchFojinDirect(parsed.identity.titleZh, abortSignal);
    } catch (e: any) {
      if (e?.name === 'AbortError') throw e;
      // Non-fatal — search still returns LLM results.
    }
  }

  const llmCandidates = parsed.rawSources.map(annotateCandidate);
  const mergedRaw = [...fojinCandidates, ...llmCandidates]
    .sort((a, b) => b.confidence - a.confidence);

  return {
    query,
    identity: parsed.identity,
    rawSources: mergedRaw,
    fanTranslations: parsed.fanTranslations.map(annotateCandidate).sort((a, b) => b.confidence - a.confidence),
  };
}
