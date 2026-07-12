#!/usr/bin/env node
/**
 * Stage ALIGN — GENERIC, manifest-driven.
 *
 * Reads books/<slug>/book.json, extracts the source + witness EPUBs, pairs their
 * chapters, and emits an import-ready bilingual session (source = chapter `content`,
 * witness = `fanTranslation`).
 *
 * This is the reusability test: a book whose editions share a clean 1:1 chapter
 * structure needs a manifest and NOTHING ELSE. Books with interleaved structures
 * (Calvino's frames + incipits) still need their own aligner — align-calvino.ts —
 * and this script says so loudly rather than guessing.
 *
 * Usage:
 *   tsx scripts/grounding/align-book.ts books/pinocchio/book.json \
 *       --template <any-session.json> -o out/pinocchio-session.json
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { EpubAdapter } from '../lib/adapters/epub-adapter';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');

type Chapter = { chapterNumber: number; title: string; paragraphs: { text: string }[] };

const BOILER = /PROJECT GUTENBERG/i;
const MIN_CHARS = 900;

/** Real chapters only: drop title pages, licences, transcriber notes. */
function realChapters(chapters: Chapter[]): Chapter[] {
  return chapters.filter((c) => {
    const text = c.paragraphs.map((p) => p.text).join('\n\n');
    if (text.length < MIN_CHARS) return false;
    if (BOILER.test((c.title || '') + text.slice(0, 200))) return false;
    return true;
  });
}

const textOf = (c: Chapter) => c.paragraphs.map((p) => p.text).join('\n\n');

async function main() {
  const args = process.argv.slice(2);
  const manifestPath = args[0];
  const ti = args.indexOf('--template');
  const oi = args.indexOf('-o');
  if (!manifestPath || ti < 0 || oi < 0) {
    throw new Error('usage: align-book.ts <book.json> --template <session.json> -o <out.json>');
  }
  const templatePath = args[ti + 1];
  const outPath = args[oi + 1];

  const manifest = JSON.parse(fs.readFileSync(path.resolve(REPO, manifestPath), 'utf8'));
  const witness = manifest.witnesses[0];

  const src = realChapters(
    (await new EpubAdapter().extract(path.resolve(REPO, manifest.source.epub))).chapters as Chapter[],
  );
  const wit = realChapters(
    (await new EpubAdapter().extract(path.resolve(REPO, witness.epub))).chapters as Chapter[],
  );

  console.log(`source (${manifest.source.lang}): ${src.length} chapters`);
  console.log(`witness (${witness.lang}, ${witness.label}): ${wit.length} chapters`);

  if (src.length !== wit.length) {
    console.error(
      `\n✗ chapter counts differ (${src.length} vs ${wit.length}). This generic aligner only ` +
        `handles editions with a 1:1 chapter structure. A book with interleaved or restructured ` +
        `chapters needs its own aligner (see scripts/grounding/align-calvino.ts). Refusing to ` +
        `guess a pairing.`,
    );
    process.exit(2);
  }
  const expected = manifest.alignment?.unitCount;
  if (expected && src.length !== expected) {
    console.error(`\n✗ manifest expects ${expected} units, extraction found ${src.length}.`);
    process.exit(2);
  }

  // Length sanity: a wildly off chapter means the 1:1 assumption is wrong somewhere.
  const ratios = src.map((c, i) => textOf(wit[i]).length / Math.max(textOf(c).length, 1));
  const off = ratios.map((r, i) => (r < 0.5 || r > 2.0 ? i + 1 : 0)).filter(Boolean);
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  console.log(`mean witness/source char ratio: ${mean.toFixed(2)}${off.length ? ` — OFF-RATIO chapters: ${off.join(', ')}` : ' — all chapters within tolerance'}`);
  if (off.length) {
    console.error('\n✗ one or more chapters pair implausibly by length; the 1:1 mapping is suspect.');
    process.exit(2);
  }

  const session = JSON.parse(fs.readFileSync(path.resolve(REPO, templatePath), 'utf8'));
  const slug = manifest.workId;
  const sid = (i: number) => `${slug}_u${i + 1}`;
  const url = (i: number) => `polyglot://${sid(i)}`;

  const chapters = src.map((c, i) => ({
    stableId: sid(i),
    canonicalUrl: url(i),
    title: (wit[i].title || `Chapter ${i + 1}`).replace(/\s+/g, ' ').trim().slice(0, 90),
    content: textOf(c),
    fanTranslation: textOf(wit[i]),
    nextUrl: i < src.length - 1 ? url(i + 1) : undefined,
    prevUrl: i > 0 ? url(i - 1) : undefined,
    chapterNumber: i + 1,
    translations: [],
    feedback: [],
  }));

  session.chapters = chapters;
  session.urlMappings = chapters.map((c) => ({ url: c.canonicalUrl, stableId: c.stableId, canonicalUrl: c.canonicalUrl }));
  session.navigation = {
    ...(session.navigation || {}),
    history: chapters.map((c) => c.stableId),
    lastActive: { id: chapters[0].stableId },
  };
  if (Array.isArray(session.novels) && session.novels[0]) session.novels[0].title = manifest.title;

  fs.mkdirSync(path.dirname(path.resolve(REPO, outPath)), { recursive: true });
  fs.writeFileSync(path.resolve(REPO, outPath), JSON.stringify(session, null, 2));
  console.log(`\n✅ ${outPath} — ${chapters.length} chapters aligned 1:1 (source + ${witness.label}).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
