/**
 * Fetch + parse the Eudoxos / edhamma Visuddhimagga TEI glossary.
 *
 * Source: https://github.com/edhamma/vism/blob/master/vism/gloss.tei (116 KB)
 * Hosted: https://edhamma.github.io/vism/
 *
 * The TEI file is a flat sequence of `<entry page_id="..." title="...">`
 * elements containing English gloss text in `<span>`s and Visuddhimagga
 * section references as `<ptr type="vism" target="III.68"/>`.
 *
 * This script downloads the file, parses each entry, and writes
 * `data/sutta-studio/grounding/commentarial-glosses.json` for the
 * `CommentarialGlossProvider` to consume at compile time.
 *
 * Run once whenever upstream gloss.tei changes (rare). Output is committed
 * to the repo so production compiles don't depend on a network fetch.
 *
 * Usage:
 *   npx tsx scripts/sutta-studio/fetch-vism-glosses.ts
 *
 * Licensing: BPS holds copyright on Ñāṇamoli's translation. Edhamma
 * contacted BPS for permission with no reply. Our usage (citation + link
 * to Edhamma's hosted page, no full-text redistribution) should fall under
 * fair-use citation. The committed JSON stores only the gloss text (short,
 * dictionary-style, non-substitutable for the book) + the Vism section
 * pointer. We do NOT store the full Visuddhimagga body. If we ever package
 * the gloss content into a bundled offline app, get explicit BPS permission.
 *
 * See: docs/sutta-studio/RESEARCH_RESULTS.md, AMORTIZATION.md.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');

const SOURCE_URL =
  'https://raw.githubusercontent.com/edhamma/vism/master/vism/gloss.tei';
const OUT_DIR = resolve(PROJECT_ROOT, 'data/sutta-studio/grounding');
const OUT_FILE = resolve(OUT_DIR, 'commentarial-glosses.json');
const CACHE_FILE = '/tmp/vism-gloss.tei';

type GlossEntry = {
  title: string;
  gloss: string;
  vismRefs: string[];
  pageId?: string;
};

type GlossFile = {
  _meta: {
    source: string;
    sourceUrl: string;
    sphinxBaseUrl: string;
    fetchedAt: string;
    license: string;
    entryCount: number;
    note: string;
  };
  entries: Record<string, GlossEntry>;
};

async function fetchGlossTei(): Promise<string> {
  if (existsSync(CACHE_FILE)) {
    console.log(`[fetch-vism] Using cached file: ${CACHE_FILE}`);
    return readFileSync(CACHE_FILE, 'utf8');
  }
  console.log(`[fetch-vism] Downloading ${SOURCE_URL}`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${SOURCE_URL}`);
  const text = await res.text();
  writeFileSync(CACHE_FILE, text, 'utf8');
  console.log(`[fetch-vism] Cached to ${CACHE_FILE} (${text.length} chars)`);
  return text;
}

const ENTRY_REGEX =
  /<entry\s+page_id="([^"]*)"\s+title="([^"]*)"\s*>([\s\S]*?)<\/entry>/g;
const VISM_PTR_REGEX = /<ptr\s+type="vism"\s+target="([^"]+)"[^>]*\/?>/g;
// Strip <ptr>...</ptr> pairs AND self-closing <ptr/> in their entirety so the
// visible text (e.g., "VIII.47") doesn't leak into the gloss after tag-strip.
const PTR_PAIR_REGEX = /<ptr\b[^>]*>[\s\S]*?<\/ptr>/g;
const PTR_SELF_CLOSE_REGEX = /<ptr\b[^>]*\/>/g;
const TAG_REGEX = /<[^>]+>/g;
const WHITESPACE_REGEX = /\s+/g;
const TRAILING_PUNCT_REGEX = /[\s:;,.]+$/;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseGlossTei(xml: string): GlossEntry[] {
  const entries: GlossEntry[] = [];
  let match: RegExpExecArray | null;
  while ((match = ENTRY_REGEX.exec(xml)) !== null) {
    const [, pageId, title, body] = match;
    if (!title) continue;

    const vismRefs: string[] = [];
    let ptrMatch: RegExpExecArray | null;
    const ptrRegex = new RegExp(VISM_PTR_REGEX.source, 'g');
    while ((ptrMatch = ptrRegex.exec(body)) !== null) {
      vismRefs.push(ptrMatch[1]);
    }

    const gloss = decodeEntities(body)
      .replace(PTR_PAIR_REGEX, ' ')
      .replace(PTR_SELF_CLOSE_REGEX, ' ')
      .replace(TAG_REGEX, ' ')
      .replace(WHITESPACE_REGEX, ' ')
      .trim()
      .replace(TRAILING_PUNCT_REGEX, '');

    entries.push({
      title: decodeEntities(title),
      gloss,
      vismRefs,
      pageId: pageId || undefined,
    });
  }
  return entries;
}

function buildOutput(entries: GlossEntry[]): GlossFile {
  const byTitle: Record<string, GlossEntry> = {};
  for (const e of entries) {
    if (byTitle[e.title]) {
      const merged = byTitle[e.title];
      const seen = new Set(merged.vismRefs);
      for (const r of e.vismRefs) if (!seen.has(r)) merged.vismRefs.push(r);
    } else {
      byTitle[e.title] = e;
    }
  }
  return {
    _meta: {
      source: 'edhamma/vism (Ñāṇamoli, Visuddhimagga: The Path of Purification)',
      sourceUrl: SOURCE_URL,
      sphinxBaseUrl: 'https://edhamma.github.io/vism/sphinx/build/html/',
      fetchedAt: new Date().toISOString().slice(0, 10),
      license:
        'BPS-copyrighted translation. Edhamma awaits BPS permission. Citation + link is fair use; full-text bundling requires explicit BPS approval.',
      entryCount: Object.keys(byTitle).length,
      note:
        'Glossary entries are short dictionary-style definitions, not full text. Each entry may reference one or more Visuddhimagga sections via vismRefs (Roman.arabic format like "III.68").',
    },
    entries: byTitle,
  };
}

async function main() {
  const xml = await fetchGlossTei();
  console.log(`[fetch-vism] Loaded ${xml.length} chars`);

  const entries = parseGlossTei(xml);
  console.log(`[fetch-vism] Parsed ${entries.length} raw entries`);

  const output = buildOutput(entries);
  console.log(`[fetch-vism] Output has ${output._meta.entryCount} unique entries`);

  const withVismRefs = Object.values(output.entries).filter((e) => e.vismRefs.length > 0).length;
  const totalRefs = Object.values(output.entries).reduce((a, e) => a + e.vismRefs.length, 0);
  console.log(`[fetch-vism]   ${withVismRefs} entries have >=1 Vism ref`);
  console.log(`[fetch-vism]   ${totalRefs} total Vism refs across all entries`);

  const samples = Object.values(output.entries).slice(0, 3);
  for (const s of samples) {
    console.log(`[fetch-vism]   sample: ${s.title} -- ${s.gloss.slice(0, 60)} refs=${JSON.stringify(s.vismRefs)}`);
  }

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf8');
  console.log(`[fetch-vism] Wrote ${OUT_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
