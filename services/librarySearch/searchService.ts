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
  '84000.co',
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
- NovelCool (novelcool.com) — for novels
- WuxiaWorld — for novels
- WebNovel (webnovel.com) — for novels
- Novel Updates (novelupdates.com) — for novels
- Light Novel World — for novels
- 84000.co — ONLY for Tibetan canonical Buddhist texts (Mahayana sutras with a Tōhoku/Toh number, e.g. Heart Sutra → toh21, Lotus Sutra → toh113). The URL pattern is https://84000.co/translation/toh{N}. Do not invent toh numbers.
- suttacentral.net — ONLY for Theravada Pali Canon texts (early Buddhist texts with sn/dn/mn/an/sutta-nipata uids). Do NOT suggest SuttaCentral for Mahayana sutras like the Heart Sutra, Lotus Sutra, Vimalakirti, Diamond Sutra — these are Mahayana and not in SuttaCentral's corpus.
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

/**
 * Probe a candidate URL via the local fetch-proxy to confirm it returns
 * something other than 404/403/5xx. The LLM hallucinates fan-translation
 * URLs (most notoriously SuttaCentral entries for Mahayana texts that
 * don't exist there) and the prompt's "only return URLs you're confident
 * exist" instruction doesn't reliably constrain it. This probe runs
 * server-side (no CORS issues) and is short-circuited to ~3s timeout to
 * keep search latency bounded.
 *
 * Returns true if the URL probably works, false otherwise. Inconclusive
 * cases (network failure, proxy down) return TRUE — we don't want a flaky
 * proxy to drop genuine candidates.
 */
async function probeCandidateUrl(
  url: string,
  abortSignal?: AbortSignal,
): Promise<boolean> {
  try {
    const proxyUrl = `/api/fetch-proxy?url=${encodeURIComponent(url)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    // Chain the user-provided abort signal so search-level cancellation works.
    const onAbort = () => controller.abort();
    abortSignal?.addEventListener('abort', onAbort);
    try {
      const response = await fetch(proxyUrl, { signal: controller.signal });
      // 4xx / 5xx → likely hallucinated or moved.
      if (response.status >= 400) {
        console.log(`[LibrarySearch] Probe dropped ${url} — HTTP ${response.status}`);
        return false;
      }
      return true;
    } finally {
      clearTimeout(timeout);
      abortSignal?.removeEventListener('abort', onAbort);
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      // If the user cancelled the search, propagate.
      if (abortSignal?.aborted) throw e;
      // Otherwise our internal timeout fired — keep the candidate (avoid
      // dropping real URLs to flaky network).
      console.warn(`[LibrarySearch] Probe timed out for ${url} — keeping`);
      return true;
    }
    // Other errors: don't drop the candidate just because the proxy failed.
    console.warn(`[LibrarySearch] Probe inconclusive for ${url}:`, e?.message || e);
    return true;
  }
}

/**
 * Filter LLM-suggested fan candidates to only those whose URLs probably
 * exist. Probes run in parallel with bounded concurrency (no need — fan
 * lists are tiny, ≤5 items). Inconclusive probes survive.
 */
async function probeFanCandidates(
  candidates: SourceCandidate[],
  abortSignal?: AbortSignal,
): Promise<SourceCandidate[]> {
  if (candidates.length === 0) return candidates;
  const results = await Promise.all(
    candidates.map((c) => probeCandidateUrl(c.url, abortSignal).then((ok) => ({ c, ok })))
  );
  const kept = results.filter((r) => r.ok).map((r) => r.c);
  const dropped = results.length - kept.length;
  if (dropped > 0) {
    console.log(`[LibrarySearch] Probe dropped ${dropped} fan candidate(s)`);
  }
  return kept;
}

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

interface FojinEnrichment {
  englishDescription: string;
  recommended: boolean;
}

/**
 * Query FoJin's search API and return the raw hits.
 * Routes through the local fetch-proxy because FoJin's CORS only allows
 * its own domain (verified — direct browser fetches get
 * `access-control-allow-credentials: true` but no allow-origin header).
 */
async function fetchFojinHits(
  canonicalTitle: string,
  abortSignal?: AbortSignal,
): Promise<FojinSearchHit[]> {
  if (!canonicalTitle || canonicalTitle.trim().length === 0) return [];

  try {
    const apiUrl = `https://fojin.app/api/search?q=${encodeURIComponent(canonicalTitle.trim())}&size=8`;
    const proxyUrl = `/api/fetch-proxy?url=${encodeURIComponent(apiUrl)}`;
    const response = await fetch(proxyUrl, { signal: abortSignal });
    if (!response.ok) {
      console.warn(`[LibrarySearch] FoJin search failed: HTTP ${response.status}`);
      return [];
    }

    // Local proxy normalises content-type; parse body as JSON since FoJin
    // returns valid JSON regardless of the wrapper's declared content-type.
    const text = await response.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      console.warn('[LibrarySearch] FoJin response was not valid JSON');
      return [];
    }
    const hits: FojinSearchHit[] = Array.isArray(json?.results) ? json.results : [];
    return [...hits].sort((a, b) => b.score - a.score).slice(0, 5);
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    console.warn('[LibrarySearch] FoJin direct search failed:', e?.message || e);
    return [];
  }
}

/**
 * Ask the LLM to disambiguate FoJin search hits with English context. FoJin
 * returns multiple Chinese versions of the same canonical text (e.g. 5 Heart
 * Sutra translations by different Tang-dynasty translators) and a non-Chinese
 * reader can't tell them apart from translator names alone. The LLM has
 * solid background on canonical Buddhist texts; one extra call surfaces the
 * authoritative version + flags commentaries vs the actual sutra.
 *
 * Returns a map keyed by FoJin text id. Best-effort — unmapped hits keep
 * their original Chinese metadata.
 */
async function enrichFojinHitsWithLLM(
  query: string,
  identity: LLMSearchResponse['identity'],
  hits: FojinSearchHit[],
  settings: AppSettings,
  abortSignal?: AbortSignal,
): Promise<Map<number, FojinEnrichment>> {
  const result = new Map<number, FojinEnrichment>();
  if (hits.length === 0) return result;

  const candidatesForPrompt = hits.map((h) => ({
    id: h.id,
    title_zh: h.title_zh,
    translator: h.translator,
    dynasty: h.dynasty,
    cbeta_id: h.cbeta_id,
    category: h.category,
  }));

  const systemPrompt = `You are disambiguating multiple Chinese-canon Buddhist text candidates for an English reader.

The user searched: "${query}"
Resolved canonical title: "${identity.titleZh ?? '(unknown)'}" (${identity.titleEn ?? 'unknown English title'})

You will receive a list of candidate texts from a Buddhist text database. Each is a real translation/commentary in the Taishō or other canons. For each candidate, write a single English sentence (max ~20 words) that helps the reader choose. Highlight:
- Which is the most authoritative / most commonly recited version (mark recommended: true on at most ONE)
- Which is a commentary, abridged version, or alternate framing (so the user knows it's not what they probably want)
- Distinguishing details: length, dynasty/translator significance, doctrinal lineage

Be concise and concrete. Do not hedge. Do not fabricate facts about texts you don't recognize — for unfamiliar IDs, just describe what's known from the metadata (e.g. "Tang-dynasty translation by Zhihuilun (CBETA T0254); less commonly recited than T0251").

Return ONLY this JSON object:
{
  "candidates": [
    { "id": <fojin id>, "englishDescription": "<sentence>", "recommended": <bool> }
  ]
}`;

  try {
    const provider = getProvider(settings.provider as any);
    const response = await provider.chatJSON({
      settings,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify({ candidates: candidatesForPrompt }) },
      ],
      model: settings.model,
      temperature: 0.2,
      maxTokens: 1500,
      apiType: 'library_search',
      abortSignal,
    });

    const cleaned = response.text.replace(/^```json?\s*/m, '').replace(/```\s*$/m, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed?.candidates)) return result;

    let recommendedSeen = false;
    for (const c of parsed.candidates) {
      if (typeof c?.id !== 'number' || typeof c?.englishDescription !== 'string') continue;
      // Enforce single recommendation — first wins, in case the model marks several.
      const recommended = !!c.recommended && !recommendedSeen;
      if (recommended) recommendedSeen = true;
      result.set(c.id, { englishDescription: c.englishDescription.trim(), recommended });
    }
    return result;
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    console.warn('[LibrarySearch] FoJin enrichment failed (falling back to Chinese metadata):', e?.message || e);
    return result;
  }
}

/**
 * Convert FoJin hits into adapter-loadable SourceCandidates. If an enrichment
 * map is provided, each hit's `whyThisMatches` is replaced with the LLM's
 * English description; recommended hits get a "★ Recommended" prefix on the
 * matched title and bumped to 1.0 confidence so they sort first.
 */
function mapFojinHitsToCandidates(
  hits: FojinSearchHit[],
  enrichments: Map<number, FojinEnrichment>,
): SourceCandidate[] {
  return hits.map((hit) => {
    const enrichment = enrichments.get(hit.id);
    const titleDisplay = hit.title_zh || hit.title_en || `FoJin Text ${hit.id}`;
    const dynastyTrans = [hit.dynasty, hit.translator].filter(Boolean).join(' · ');
    const fallbackWhy = [
      dynastyTrans || null,
      hit.cbeta_id ? `CBETA ${hit.cbeta_id}` : null,
      hit.category || null,
    ].filter(Boolean).join(' · ') || `FoJin search match (score ${hit.score.toFixed(1)})`;

    const whyThisMatches = enrichment
      ? `${enrichment.englishDescription}${fallbackWhy ? ` — ${fallbackWhy}` : ''}`
      : fallbackWhy;

    return {
      site: 'FoJin (佛津)',
      url: `https://fojin.app/texts/${hit.id}/read?juan=1`,
      matchedTitle: enrichment?.recommended ? `★ Recommended — ${titleDisplay}` : titleDisplay,
      matchedAuthor: hit.translator || null,
      sourceType: 'official' as const,
      chapterCount: null,
      status: null,
      // Recommended → 1.0 (sorts first). Otherwise normalise score with a hard cap.
      confidence: enrichment?.recommended ? 1 : Math.min(0.99, hit.score / 100),
      whyThisMatches,
      adapterSupported: true,
    };
  });
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
  // search index will surface them when given a canonical title. Then ask the
  // LLM to disambiguate the (typically multiple) Chinese versions for an
  // English-reading user — without this, you get five identical-looking cards.
  let fojinCandidates: SourceCandidate[] = [];
  if (parsed.identity.titleZh) {
    try {
      const hits = await fetchFojinHits(parsed.identity.titleZh, abortSignal);
      const enrichments = hits.length > 0
        ? await enrichFojinHitsWithLLM(query, parsed.identity, hits, settings, abortSignal)
        : new Map<number, FojinEnrichment>();
      fojinCandidates = mapFojinHitsToCandidates(hits, enrichments);
    } catch (e: any) {
      if (e?.name === 'AbortError') throw e;
      // Non-fatal — search still returns LLM results.
    }
  }

  const llmCandidates = parsed.rawSources.map(annotateCandidate);
  const mergedRaw = [...fojinCandidates, ...llmCandidates]
    .sort((a, b) => b.confidence - a.confidence);

  // Fan translations come straight from the LLM (no real-lookup channel
  // like FoJin search). The LLM hallucinates URLs for sites that don't
  // host the requested text — most notoriously SuttaCentral entries for
  // Mahayana sutras. Probe each URL to drop 404s before showing them.
  const fanCandidatesUnverified = parsed.fanTranslations.map(annotateCandidate);
  const fanCandidatesVerified = await probeFanCandidates(fanCandidatesUnverified, abortSignal);

  return {
    query,
    identity: parsed.identity,
    rawSources: mergedRaw,
    fanTranslations: fanCandidatesVerified.sort((a, b) => b.confidence - a.confidence),
  };
}
